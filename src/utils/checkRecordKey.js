// 检查记录键生成工具函数
// 将 check_records 从 customer_id 关联改为 store_phone 关联

import { normalizePhone } from './importParser'

// 生成检查记录的查询键（使用标准化后的电话号码）
export function getCheckRecordKey(storePhone) {
  const normalized = normalizePhone(storePhone)
  if (!normalized) {
    throw new Error('无法为检查记录生成键：电话号码为空或无效')
  }
  return normalized
}

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

// 映射后端返回的检查记录（兼容新旧格式）
export function mapCheckRecord(record, currentUser) {
  const relationData = record.expand?.relation
  const operatorName = relationData?.name || relationData?.username || relationData?.email
    || (currentUser && (currentUser.name || currentUser.username || currentUser.email))
    || record.relation

  return {
    id: record.id,
    store_phone: record.store_phone || '',
    store_name: record.store_name || '',
    check_type: record.select,
    operator: operatorName,
    check_time: record.created
  }
}

// 根据标准化电话号码查询检查记录
export function queryCheckRecordsByPhone(checkRecords, phoneKey) {
  const normalized = normalizePhone(phoneKey)
  return checkRecords[normalized] || []
}
