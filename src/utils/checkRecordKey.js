// 检查记录工具函数

import { normalizePhone } from './importParser'

// 生成检查记录的 POST 数据体
export function buildCheckRecordBody(shop, checkType, currentUser) {
  const normalizedPhone = normalizePhone(shop.store_phone)
  const operator = currentUser?.id || currentUser?.name || currentUser?.username || currentUser?.email || '未知用户'
  
  return {
    store_phone: normalizedPhone,
    store_name: shop.store_name,
    select: checkType,
    relation: operator
  }
}

// 根据标准化电话号码查询检查记录
export function queryCheckRecordsByPhone(checkRecords, phoneKey) {
  const normalized = normalizePhone(phoneKey)
  return checkRecords[normalized] || []
}
