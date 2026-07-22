import { describe, it, expect } from 'vitest'
import {
  getCheckRecordKey,
  buildCheckRecordBody,
  mapCheckRecord,
  queryCheckRecordsByPhone
} from './checkRecordKey'

describe('getCheckRecordKey', () => {
  it('返回标准化后的电话号码', () => {
    expect(getCheckRecordKey('13812345678')).toBe('13812345678')
    expect(getCheckRecordKey('138-1234-5678')).toBe('13812345678')
    expect(getCheckRecordKey('+8613812345678')).toBe('13812345678')
  })

  it('空电话号码抛出异常', () => {
    expect(() => getCheckRecordKey('')).toThrow('无法为检查记录生成键')
    expect(() => getCheckRecordKey(null)).toThrow('无法为检查记录生成键')
    expect(() => getCheckRecordKey(undefined)).toThrow('无法为检查记录生成键')
  })
})

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

describe('mapCheckRecord', () => {
  it('映射包含 expand 的完整记录', () => {
    const record = {
      id: 'record_1',
      store_phone: '13812345678',
      store_name: '店铺A',
      select: 'good',
      created: '2026-07-18T12:00:00Z',
      expand: {
        relation: {
          id: 'user_1',
          name: '张三'
        }
      }
    }

    const mapped = mapCheckRecord(record)
    expect(mapped).toEqual({
      id: 'record_1',
      store_phone: '13812345678',
      store_name: '店铺A',
      check_type: 'good',
      operator: '张三',
      check_time: '2026-07-18T12:00:00Z'
    })
  })

  it('映射不含 expand 的记录，回退到 record.relation', () => {
    const record = {
      id: 'record_2',
      store_phone: '13912345678',
      store_name: '',
      select: 'pass',
      created: '2026-07-18T11:00:00Z',
      relation: 'user_2'
    }

    const mapped = mapCheckRecord(record)
    expect(mapped.store_name).toBe('')
    expect(mapped.operator).toBe('user_2')
  })

  it('映射不含 expand 但提供 currentUser 且 relation 匹配时，使用用户名', () => {
    const record = {
      id: 'record_3',
      store_phone: '13812345678',
      store_name: '店铺C',
      select: 'pass',
      created: '2026-07-18T10:00:00Z',
      relation: 'user_99'
    }
    const currentUser = { id: 'user_99', name: '李四', email: 'lisi@example.com' }

    const mapped = mapCheckRecord(record, currentUser)
    expect(mapped.operator).toBe('李四')
  })

  it('映射不含 expand 但提供 currentUser 且 relation 不匹配时，使用 relation 值', () => {
    const record = {
      id: 'record_4',
      store_phone: '13812345678',
      store_name: '店铺D',
      select: 'pass',
      created: '2026-07-18T10:00:00Z',
      relation: 'other_user'
    }
    const currentUser = { id: 'user_99', name: '李四', email: 'lisi@example.com' }

    const mapped = mapCheckRecord(record, currentUser)
    expect(mapped.operator).toBe('other_user')
  })

  it('映射旧格式记录（不含 store_phone）', () => {
    const oldRecord = {
      id: 'old_record',
      select: 'copy',
      created: '2026-07-17T10:00:00Z',
      relation: 'admin'
    }

    const mapped = mapCheckRecord(oldRecord)
    expect(mapped.store_phone).toBe('')
    expect(mapped.check_type).toBe('copy')
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
