# 大客户徽标 + 跨店记录共享 — 实施计划

## Context

当前 [ShopList.jsx](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx) 的店铺列表完全按 `customer_id` 独立展示。但同一老板可能名下多家店共用一个 `store_phone`（如连锁品牌总店+分店、400 号统一客服）——这类"大客户"在 UI 上完全看不出来：销售既不知道某店是大客户，也无法看到同老板其他店的检查记录（容易重复打扰、错失深耕机会）。

本次改动的目标：
1. **大客户徽标**：列表卡片标题旁显示金色 `大客户 · N店` 徽标，N 为同号店数。
2. **跨店记录共享**：将 `check_records` 从按 `customer_id` 维度改为按 `store_phone` 维度聚合，同号店铺的卡片互相能看到对方的检查记录，并标注来源店名。

**项目约束**（已确认）：
- PocketBase 远程托管在 `http://149.88.75.117:8090`，本项目仓库**没有** `pb_hooks/` 或 `pb_migrations/` 目录 → 所有 schema 改动必须通过 PB Admin UI 手动操作，不在本仓库提交 hook/migration 文件。
- 上线后约 1w 条 customers 数据。
- 数据可弃（开发期）→ 无需数据回填脚本。
- 所有改动集中在 [ShopList.jsx](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx) 一个文件 + PB Admin UI 两处一次性操作。

## 两个 PocketBase 关键修正（实施时务必遵守）

1. **View collection 必须返回 `id` 列**，否则 Admin UI 会拒绝保存 SQL。用 `ROW_NUMBER() OVER()` 生成（SQLite 3.25+ 支持）。
2. **`perPage` 上限是 1000**（PB 硬编码 `MaxPerPage = 1000`），`?perPage=9999` 会被静默截断到 1000。前端必须循环分页拉取 view 数据，按响应的 `totalPages` 驱动。

## 1. PocketBase Admin UI 一次性操作

打开 `http://149.88.75.117:8090/_/` 后台。

### 1a. 创建 `customer_phone_counts` View collection

**Collections → New collection → 名称填 `customer_phone_counts`，Type 选 View**

在 SQL 输入框粘贴：

```sql
SELECT
  (ROW_NUMBER() OVER()) AS id,
  store_phone,
  COUNT(*) AS shop_count
FROM customers
GROUP BY store_phone
```

保存后 PB 会自动推断字段：`id` / `store_phone` / `shop_count`。

**API rules**：List 规则留空（public），与现有 `customers` 集合保持一致。Create/Update/Delete 在 view 上不可用（只读），符合预期。

> 注意：view 是只读的，无 realtime 事件 → 大客户列表的更新需要前端刷新页面（可接受）。

### 1b. 给 `check_records` 加 `store_phone` 和 `store_name` 两个 text 字段

**Collections → check_records → 编辑 → New field → Text**

- 字段名：`store_phone`
- 字段名：`store_name`

为什么需要冗余 `store_name`：跨店记录显示时要标注来源店名（"【其他店·荣记本店】"），但 `shops` state 只装当前分页 20 条，跨页的店名查不到 → 必须写入 check_record 时冗余。

`customer_id` 字段保留不动，仍用于"是不是本店记录"的判断。

## 2. 前端改动 — 全部在 ShopList.jsx

所有 API 调用继续用现有 raw `fetch()` + `Bearer` header 模式，不引入 `pocketbase` SDK。

### Edit 1 — 模块顶部加 `normalizePhone` helper

放在 [ShopList.jsx:3](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L3) `formatRelativeTime` 旁边：

```js
function normalizePhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/[\s\-]/g, '').replace(/^\+?86/, '')
}
```

合并现有导入正则接受的多种写法：`400-xxx-xxxx` 与 `400xxxxxxxx`、`0xx-xxxxxxx` 与 `0xxxxxxxxxx` 都归一化成同一字符串。**这是 view SQL `GROUP BY store_phone` 能正确分组的根本前提**——只在读取时归一化无法修复 SQL 分组，必须在写入时归一化。

[ShopList.jsx:355](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L355) 导入校验通过后改为归一化写入：
```js
records.push({ store_name, store_phone: normalizePhone(store_phone), store_address })
```
[ShopList.jsx:344](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L344) 的正则仍校验原始输入（接受带破折号写法），归一化在正则通过后做。

### Edit 2 — `bigCustomerPhones` state + `fetchBigCustomerPhones()` 分页拉取

在 [ShopList.jsx:33-41](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L33-L41) 的 `useState` 群组中加：

```js
const [bigCustomerPhones, setBigCustomerPhones] = useState({}) // { [normalizedPhone]: shop_count }
```

用 object 而非 `Set`，是为了让徽标能显示 N 店数。

新增 fetcher（模式参考 [fetchShops](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L73-L108)）：

```js
async function fetchBigCustomerPhones() {
  try {
    const headers = {}
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`
    const map = {}
    let page = 1, totalPages = 1
    while (page <= totalPages) {
      const res = await fetch(`/api/collections/customer_phone_counts/records?page=${page}&perPage=1000`, { headers })
      if (!res.ok) break
      const data = await res.json()
      totalPages = data.totalPages
      data.items.forEach(item => {
        const p = normalizePhone(item.store_phone)
        if (p && item.shop_count >= 2) map[p] = item.shop_count
      })
      page++
    }
    setBigCustomerPhones(map)
  } catch (err) {
    console.log('获取大客户列表失败:', err)
  }
}
```

在 [ShopList.jsx:55-57](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L55-L57) 的 mount `useEffect` 里调用一次：

```js
useEffect(() => {
  fetchShops(1)
  fetchBigCustomerPhones()
}, [])
```

无自动刷新（out of scope）。

### Edit 3 — `fetchCheckRecords` 改为按 phone 聚合

替换 [ShopList.jsx:121-137](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L121-L137) 的聚合逻辑：

```js
const recordsByPhone = {}
data.items.forEach(record => {
  const relationData = record.expand?.relation
  const operatorName = relationData?.name || relationData?.username || relationData?.email || record.relation
  const mappedRecord = {
    id: record.id,
    customer_id: record.customer_id,
    store_name: record.store_name || '',
    check_type: record.select,
    operator: operatorName,
    check_time: record.created
  }
  const p = normalizePhone(record.store_phone)
  const key = p ? p : ('cid:' + record.customer_id) // 老数据无 phone → 仍按单店聚合
  if (!recordsByPhone[key]) recordsByPhone[key] = []
  recordsByPhone[key].push(mappedRecord)
})
setCheckRecords(recordsByPhone)
```

`state` 名 `checkRecords` 保留不动（仍是按 key 索引的 map），只是 key 语义从 `customer_id` 变成 `phone` 或 `cid:customer_id`。

[ShopList.jsx:117](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L117) 的 `expand=relation`、`perPage=200` 保持不变（200 条上限是既有约束，out of scope）。

### Edit 4 — `handleCheck` 和 `handleCopyPhone` 改签名 + 写入新字段

把 [ShopList.jsx:223](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L223) `handleCheck(customerId, checkType)` 改为 `handleCheck(shop, checkType)`，[ShopList.jsx:262](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L262) `handleCopyPhone(customerId, phone)` 改为 `handleCopyPhone(shop)`。所有 `setChecking` / `setCheckFeedback` / `setCopiedId` 仍按 `shop.id` 索引。

[ShopList.jsx:239-244](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L239-L244) POST body 改为：

```js
{
  customer_id: shop.id,
  select: checkType,
  relation: currentUser?.id || currentUser?.name || currentUser?.username || currentUser?.email || '未知用户',
  store_phone: normalizePhone(shop.store_phone),
  store_name: shop.store_name
}
```

[ShopList.jsx:292-297](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L292-L297) 同理，`handleCopyPhone` 的 POST body 加 `store_phone` 和 `store_name`。

更新调用点：[ShopList.jsx:602](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L602) `handleCopyPhone(shop.id, shop.store_phone)` → `handleCopyPhone(shop)`；[ShopList.jsx:633,640](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L633-L640) `handleCheck(shop.id, ...)` → `handleCheck(shop, ...)`。

### Edit 5 — 卡片渲染：徽标 + 跨店记录 + 来源店名前缀

在 [ShopList.jsx:583](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L583) `shops.map` 回调里计算每张卡片的合并记录：

```js
const phoneKey = normalizePhone(shop.store_phone)
const cidKey = 'cid:' + shop.id
const mergedRecords = [
  ...(phoneKey ? (checkRecords[phoneKey] || []) : []),
  ...(checkRecords[cidKey] || [])
]
const sortedRecords = [...mergedRecords].sort((a, b) => new Date(b.check_time) - new Date(a.check_time))
const ownRecords = mergedRecords.filter(r => r.customer_id === shop.id)
const isBig = phoneKey && !!bigCustomerPhones[phoneKey]
const bigCount = isBig ? bigCustomerPhones[phoneKey] : 0
```

（记录要么在 phone 桶要么在 cid 桶，不会重复，无需去重。）

**绿色 ring 改为 ownRecords 判定**（保持"本店未检查"的信号）：[ShopList.jsx:590](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L590) 改 `sortedRecords.length === 0` 为 `ownRecords.length === 0`。

**徽标渲染**（替换 [ShopList.jsx:592-593](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L592-L593) 的标题行）：

```jsx
<div className="mb-3">
  <div className="flex items-center gap-2 mb-2">
    <h2 className="text-lg font-semibold text-gray-900 truncate">{shop.store_name}</h2>
    {isBig && (
      <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold whitespace-nowrap">
        大客户 · {bigCount}店
      </span>
    )}
  </div>
  <div className="flex items-center gap-2">
    {/* 原电话图标 + 号码 + 复制按钮块不动 */}
  </div>
</div>
```

**跨店记录前缀**（在 [ShopList.jsx:666-674](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L666-L674) 的记录行渲染里，operator 之前加）：

```jsx
{record.customer_id !== shop.id && (
  <span className="text-gray-400 mr-1">【其他店·{record.store_name || ''}】</span>
)}
<span className="text-gray-500">{record.operator}</span>
```

[ShopList.jsx:655-680](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx#L655-L680) 的 `slice(0, 2)` 和 "还有N条" 保持不变，现在反映的是合并后的跨店活动。

## 3. 边界 case

1. **号码归一化一致性**：view 按 DB 原值 GROUP BY，所以归一化必须在**写入时**做（Edit 1）。新数据规范；老数据若有混合写法不会合并（数据可弃，重新导入即可）。
2. **空/格式错的号码**：`fetchBigCustomerPhones` 跳过 `normalizePhone` 为空的项；卡片渲染用 `phoneKey && ...` 防止空 key 误命中；空号店铺仅落到 `cid:` 桶，不参与跨店合并。
3. **老 check_records 无 store_phone**：会落到 `cid:<customer_id>` 桶，仅在本店卡片显示，不跨店合并。删了老数据后 `cid:` 桶自动空，但 fallback 逻辑保留无害。
4. **分页影响**：`bigCustomerPhones` 仅启动时拉一次，新增店铺后需手动刷新页面才会更新大客户列表。可接受。
5. **`perPage=200` 限制**：跨店合并只看最近 200 条 check_records。既有约束，out of scope。

## 4. 验证步骤（手动端到端）

1. PB Admin UI → `customer_phone_counts` 集合 → Records 标签，确认有 `store_phone` + `shop_count` 行返回。
2. `npm run dev`，打开页面登录。
3. 用"批量导入"录入两条同号店铺：
   ```
   荣记本店,4001234567,地址A
   荣记分店,4001234567,地址B
   ```
   刷新页面（让 `bigCustomerPhones` 重新拉取）。
4. 期望：两张卡片标题旁都显示金色 `大客户 · 2店` 徽标。
5. 在荣记本店卡片点 **Good**。期望：本店记录区出现 Good 条目（operator + 相对时间）。
6. 翻到/刷新到荣记分店卡片。期望：分店卡片的记录区显示同一条 Good，但带灰色前缀 `【其他店·荣记本店】`，证明跨店合并生效。
7. 期望：分店卡片仍有绿色 ring（自己没有记录），点击 **Pass** 后 ring 消失。
8. 录入第三家**不同号码**的店。刷新。期望：无徽标，记录不互相串。
9. PB Admin UI → check_records → 看新写入的记录，确认 `store_phone` 和 `store_name` 已填且 `store_phone` 是规范化形式（无破折号）。

## 5. Out of scope（明确不做）

- 不在仓库加 `pb_hooks/` 或 `pb_migrations/`（PB 远程托管，schema 操作全走 Admin UI）。
- 不做迁移脚本或老数据回填（数据可弃）。
- 不做 `bigCustomerPhones` 的 realtime / 自动刷新（仅页面刷新）。
- 不在 `customers` 表加 `vip_level` / `boss_name` 等字段。
- 不改 `check_records` 的 `perPage=200`，不改 `customers` 的 20/页分页。
- 不引入 `pocketbase` SDK（保持 raw `fetch()`）。
- 不改 [vite.config.js](file:///Users/paul/Desktop/paul_code/1/pocket_customer/vite.config.js)（`/api` proxy 已指向 `http://149.88.75.117:8090`）。

## 关键文件

- [src/components/ShopList.jsx](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/components/ShopList.jsx) — 唯一需要修改的文件，全部 UI + API 逻辑在此
- [vite.config.js](file:///Users/paul/Desktop/paul_code/1/pocket_customer/vite.config.js) — 仅参考，确认 `/api` proxy 目标，无需改动
- [src/App.jsx](file:///Users/paul/Desktop/paul_code/1/pocket_customer/src/App.jsx) — 仅参考，确认 `ShopList` 是唯一挂载组件
