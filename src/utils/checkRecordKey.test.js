import { describe, it, expect } from 'vitest'
import {
  buildCheckRecordBody,
  queryCheckRecordsByPhone
} from './checkRecordKey'

describe('buildCheckRecordBody', () => {
  const shop = {
    store_name: '荣记本草堂',
    store_phone: '138-1234-5678'
  }

  const user = {
    id: 'user_123',
    name: '张三'
  }

  it('生成正确的检查记录 POST 数据', () => {
    const body = buildCheckRecordBody(shop, 'pass', user)
    expect(body).toEqual({
      store_phone: '13812345678',
      store_name: '荣记本草堂',
      select: 'pass',
      relation: 'user_123'
    })
  })

  it('生成 copy 类型的 POST 数据', () => {
    const body = buildCheckRecordBody(shop, 'copy', user)
    expect(body.select).toBe('copy')
    expect(body.store_phone).toBe('13812345678')
  })

  it('电话号码被标准化', () => {
    const shopWithDash = { store_name: '店铺', store_phone: '010-12345678' }
    const body = buildCheckRecordBody(shopWithDash, 'good', user)
    expect(body.store_phone).toBe('01012345678')
  })

  it('user 为 null 时使用默认操作者', () => {
    const body = buildCheckRecordBody(shop, 'pass', null)
    expect(body.relation).toBe('未知用户')
  })

  it('user 只有 email 时使用 email', () => {
    const emailOnlyUser = { email: 'test@example.com' }
    const body = buildCheckRecordBody(shop, 'pass', emailOnlyUser)
    expect(body.relation).toBe('test@example.com')
  })
})

describe('queryCheckRecordsByPhone', () => {
  const checkRecords = {
    '13812345678': [
      { id: 'r1', check_type: 'pass' },
      { id: 'r2', check_type: 'good' }
    ],
    '13912345678': [
      { id: 'r3', check_type: 'copy' }
    ]
  }

  it('根据电话号码查询记录', () => {
    const result = queryCheckRecordsByPhone(checkRecords, '13812345678')
    expect(result).toHaveLength(2)
    expect(result[0].check_type).toBe('pass')
  })

  it('支持带格式的电话号码查询', () => {
    const result = queryCheckRecordsByPhone(checkRecords, '138-1234-5678')
    expect(result).toHaveLength(2)
  })

  it('不存在的电话号码返回空数组', () => {
    const result = queryCheckRecordsByPhone(checkRecords, '13712345678')
    expect(result).toEqual([])
  })

  it('空电话号码返回空数组', () => {
    const result = queryCheckRecordsByPhone(checkRecords, '')
    expect(result).toEqual([])
  })
})
