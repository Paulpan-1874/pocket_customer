import { describe, it, expect } from 'vitest'
import {
  normalizePhone,
  validatePhone,
  parseImportLine,
  parseImportText,
  formatImportResult
} from './importParser'

describe('normalizePhone', () => {
  it('去除空格和横线', () => {
    expect(normalizePhone('138 1234 5678')).toBe('13812345678')
    expect(normalizePhone('138-1234-5678')).toBe('13812345678')
    expect(normalizePhone('138 1234-5678')).toBe('13812345678')
  })

  it('去除 +86 前缀', () => {
    expect(normalizePhone('+8613812345678')).toBe('13812345678')
    expect(normalizePhone('8613812345678')).toBe('13812345678')
  })

  it('空值处理', () => {
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
  })

  it('非字符串输入转为字符串处理', () => {
    expect(normalizePhone(13812345678)).toBe('13812345678')
  })

  it('无变化的标准号码', () => {
    expect(normalizePhone('13812345678')).toBe('13812345678')
  })
})

describe('validatePhone', () => {
  it('合法手机号', () => {
    expect(validatePhone('13812345678')).toBe(true)
    expect(validatePhone('15912345678')).toBe(true)
    expect(validatePhone('18612345678')).toBe(true)
    expect(validatePhone('17012345678')).toBe(true)
  })

  it('非法手机号（第二位不在3-9）', () => {
    expect(validatePhone('12812345678')).toBe(false)
    expect(validatePhone('11812345678')).toBe(false)
  })

  it('非法手机号（位数不对）', () => {
    expect(validatePhone('1381234567')).toBe(false)
    expect(validatePhone('138123456789')).toBe(false)
  })

  it('合法400号码', () => {
    expect(validatePhone('4001234567')).toBe(true)
    expect(validatePhone('400-123-4567')).toBe(true)
  })

  it('合法固话（带横线）', () => {
    expect(validatePhone('010-12345678')).toBe(true)
    expect(validatePhone('0755-1234567')).toBe(true)
    expect(validatePhone('0755-12345678')).toBe(true)
  })

  it('合法固话（不带横线）', () => {
    expect(validatePhone('01012345678')).toBe(true)
    expect(validatePhone('075512345678')).toBe(true)
  })

  it('空或非法输入', () => {
    expect(validatePhone('')).toBe(false)
    expect(validatePhone('abc')).toBe(false)
    expect(validatePhone('123')).toBe(false)
  })
})

describe('parseImportLine', () => {
  it('逗号分隔解析成功', () => {
    const { record, error } = parseImportLine('荣记本草堂,13812345678,前进中路6号', 1)
    expect(error).toBeNull()
    expect(record).toEqual({
      store_name: '荣记本草堂',
      store_phone: '13812345678',
      store_address: '前进中路6号',
      tag: ''
    })
  })

  it('空格分隔解析成功（两个以上空格）', () => {
    const { record, error } = parseImportLine('荣记本草堂  13812345678  前进中路6号', 1)
    expect(error).toBeNull()
    expect(record.store_name).toBe('荣记本草堂')
    expect(record.store_phone).toBe('13812345678')
    expect(record.store_address).toBe('前进中路6号')
  })

  it('制表符分隔解析成功', () => {
    const { record, error } = parseImportLine('荣记本草堂\t13812345678\t前进中路6号', 1)
    expect(error).toBeNull()
    expect(record.store_name).toBe('荣记本草堂')
  })

  it('地址包含逗号时正确合并（逗号分隔模式）', () => {
    const { record, error } = parseImportLine('荣记本草堂,13812345678,前进中路6号,首层105', 1)
    expect(error).toBeNull()
    expect(record.store_address).toBe('前进中路6号,首层105')
  })

  it('带横线的手机号会被拒绝（验证发生在标准化之前）', () => {
    const { record, error } = parseImportLine('店铺,138-1234-5678,地址', 1)
    expect(record).toBeNull()
    expect(error).toBe('第1行: 电话号码格式不正确')
  })

  it('固话带横线可解析且标准化后去掉横线', () => {
    const { record, error } = parseImportLine('固话店铺,010-12345678,朝阳区', 1)
    expect(error).toBeNull()
    expect(record.store_phone).toBe('01012345678')
  })

  it('字段不足时报错', () => {
    const { record, error } = parseImportLine('只有店铺名 13812345678', 3)
    expect(record).toBeNull()
    expect(error).toBe('第3行: 格式不正确，缺少必要字段')
  })

  it('店铺名称为空报错', () => {
    const { record, error } = parseImportLine(',13812345678,地址', 2)
    expect(record).toBeNull()
    expect(error).toBe('第2行: 店铺名称不能为空')
  })

  it('电话号码为空报错', () => {
    const { record, error } = parseImportLine('店铺,,地址', 4)
    expect(record).toBeNull()
    expect(error).toBe('第4行: 电话号码不能为空')
  })

  it('电话号码格式不正确报错', () => {
    const { record, error } = parseImportLine('店铺,12345,地址', 5)
    expect(record).toBeNull()
    expect(error).toBe('第5行: 电话号码格式不正确')
  })

  it('地址为空报错', () => {
    const { record, error } = parseImportLine('店铺,13812345678,', 6)
    expect(record).toBeNull()
    expect(error).toBe('第6行: 地址不能为空')
  })

  it('空行报错', () => {
    const { record, error } = parseImportLine('   ', 7)
    expect(record).toBeNull()
    expect(error).toBe('第7行: 空行')
  })

  it('null 行报错', () => {
    const { record, error } = parseImportLine(null, 8)
    expect(record).toBeNull()
    expect(error).toBe('第8行: 空行')
  })

  it('400 号码可解析', () => {
    const { record, error } = parseImportLine('客服中心,4001234567,北京海淀区', 1)
    expect(error).toBeNull()
    expect(record.store_phone).toBe('4001234567')
  })
})

describe('parseImportText', () => {
  it('解析多条有效数据', () => {
    const text = [
      '店铺A,13812345678,地址A',
      '店铺B,13912345678,地址B',
      '店铺C,15012345678,地址C'
    ].join('\n')
    const { records, errors } = parseImportText(text)
    expect(records).toHaveLength(3)
    expect(errors).toHaveLength(0)
    expect(records[0].store_name).toBe('店铺A')
    expect(records[2].store_name).toBe('店铺C')
  })

  it('混合有效与无效数据', () => {
    const text = [
      '店铺A,13812345678,地址A',
      '错误店铺,12345,错误地址',
      '店铺C,15012345678,地址C'
    ].join('\n')
    const { records, errors } = parseImportText(text)
    expect(records).toHaveLength(2)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('第2行')
  })

  it('全部无效数据', () => {
    const text = [
      '错误1,12345,地址',
      '错误2,99999,地址'
    ].join('\n')
    const { records, errors } = parseImportText(text)
    expect(records).toHaveLength(0)
    expect(errors).toHaveLength(2)
  })

  it('传递标签到每条记录', () => {
    const text = '店铺A,13812345678,地址A'
    const { records } = parseImportText(text, 'VIP')
    expect(records[0].tag).toBe('VIP')
  })

  it('标签为空字符串时记录 tag 为空', () => {
    const text = '店铺A,13812345678,地址A'
    const { records } = parseImportText(text, '')
    expect(records[0].tag).toBe('')
  })

  it('标签为空白字符时被 trim 后视为空', () => {
    const text = '店铺A,13812345678,地址A'
    const { records } = parseImportText(text, '   ')
    expect(records[0].tag).toBe('')
  })

  it('自动过滤空行', () => {
    const text = [
      '店铺A,13812345678,地址A',
      '',
      '   ',
      '店铺B,13912345678,地址B'
    ].join('\n')
    const { records, errors } = parseImportText(text)
    expect(records).toHaveLength(2)
    // 空行被过滤掉，不产生错误
    expect(errors).toHaveLength(0)
  })

  it('文本前后空白被 trim', () => {
    const text = '  \n 店铺A,13812345678,地址A \n  '
    const { records } = parseImportText(text)
    expect(records).toHaveLength(1)
    expect(records[0].store_name).toBe('店铺A')
  })

  it('空文本返回空结果', () => {
    const { records, errors } = parseImportText('')
    expect(records).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it('混合逗号和空格分隔格式', () => {
    const text = [
      '店铺A,13812345678,地址A',
      '店铺B  13912345678  地址B'
    ].join('\n')
    const { records, errors } = parseImportText(text)
    expect(records).toHaveLength(2)
    expect(errors).toHaveLength(0)
  })

  it('行号从 1 开始递增', () => {
    const text = [
      '店铺A,13812345678,地址A',
      '错误,12345,地址',
      '店铺C,15012345678,地址C'
    ].join('\n')
    const { errors } = parseImportText(text)
    expect(errors[0]).toContain('第2行')
  })

  // P0: Windows 换行符兼容性
  it('兼容 Windows 换行符 \\r\\n', () => {
    const text = '店铺A,13812345678,地址A\r\n店铺B,13912345678,地址B'
    const { records, errors } = parseImportText(text)
    expect(records).toHaveLength(2)
    expect(errors).toHaveLength(0)
    // 关键：地址不能残留 \r 字符
    expect(records[0].store_address).toBe('地址A')
    expect(records[0].store_address).not.toContain('\r')
    expect(records[1].store_address).toBe('地址B')
    expect(records[1].store_address).not.toContain('\r')
  })

  it('兼容旧版 Mac 换行符 \\r', () => {
    const text = '店铺A,13812345678,地址A\r店铺B,13912345678,地址B'
    const { records } = parseImportText(text)
    expect(records).toHaveLength(2)
    expect(records[0].store_address).not.toContain('\r')
  })

  it('Windows 换行符与错误行混合时行号正确', () => {
    const text = '店铺A,13812345678,地址A\r\n错误,12345,地址\r\n店铺C,15012345678,地址C'
    const { records, errors } = parseImportText(text)
    expect(records).toHaveLength(2)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe('第2行: 电话号码格式不正确')
  })

  it('Windows 换行符末尾多余 \\r 不影响解析', () => {
    const text = '店铺A,13812345678,地址A\r\n'
    const { records } = parseImportText(text)
    expect(records).toHaveLength(1)
    expect(records[0].store_name).toBe('店铺A')
  })

  // P0: 全角空格分隔支持
  it('单个全角空格可作为分隔符', () => {
    const { record, error } = parseImportLine('荣记本草堂　13812345678　前进中路6号', 1)
    expect(error).toBeNull()
    expect(record.store_name).toBe('荣记本草堂')
    expect(record.store_phone).toBe('13812345678')
    expect(record.store_address).toBe('前进中路6号')
  })

  it('多个全角空格连续作为分隔符', () => {
    const { record, error } = parseImportLine('荣记本草堂　　　13812345678　　　前进中路6号', 1)
    expect(error).toBeNull()
    expect(record.store_name).toBe('荣记本草堂')
  })

  it('全角空格分隔的整段文本可正确解析', () => {
    const text = [
      '店铺A　13812345678　地址A',
      '店铺B　13912345678　地址B'
    ].join('\n')
    const { records, errors } = parseImportText(text)
    expect(records).toHaveLength(2)
    expect(errors).toHaveLength(0)
  })

  it('全角空格与半角空格混合分隔', () => {
    const { record, error } = parseImportLine('店铺A　 13812345678 　地址A', 1)
    expect(error).toBeNull()
    expect(record.store_name).toBe('店铺A')
    expect(record.store_phone).toBe('13812345678')
  })

  it('全角空格分隔的地址可包含多个部分（多部分用逗号重新拼接）', () => {
    const { record, error } = parseImportLine('店铺A　13812345678　前进中路6号　首层105', 1)
    expect(error).toBeNull()
    // 与逗号分隔模式一致，多部分地址用逗号合并
    expect(record.store_address).toBe('前进中路6号,首层105')
  })
})

describe('formatImportResult', () => {
  it('全部成功无错误', () => {
    const records = [
      { store_name: 'A', store_phone: '13812345678', store_address: '地址', tag: '' }
    ]
    const result = formatImportResult({ records, errors: [] })
    expect(result.success).toBe(true)
    expect(result.hasWarning).toBeUndefined()
    expect(result.message).toBeNull()
    expect(result.records).toHaveLength(1)
  })

  it('全部失败返回错误消息', () => {
    const errors = ['第1行: 格式不正确，缺少必要字段', '第2行: 电话号码格式不正确']
    const result = formatImportResult({ records: [], errors })
    expect(result.success).toBe(false)
    expect(result.message).toContain('数据验证失败')
    expect(result.message).toContain('第1行')
    expect(result.message).toContain('第2行')
  })

  it('无数据无错误时返回提示', () => {
    const result = formatImportResult({ records: [], errors: [] })
    expect(result.success).toBe(false)
    expect(result.message).toBe('未解析到有效数据，请检查格式')
  })

  it('部分成功返回警告', () => {
    const records = [
      { store_name: 'A', store_phone: '13812345678', store_address: '地址', tag: '' }
    ]
    const errors = ['第2行: 电话号码格式不正确']
    const result = formatImportResult({ records, errors })
    expect(result.success).toBe(true)
    expect(result.hasWarning).toBe(true)
    expect(result.message).toContain('发现1条无效数据已跳过')
    expect(result.records).toHaveLength(1)
  })

  it('错误超过5条时显示省略提示', () => {
    const errors = Array.from({ length: 7 }, (_, i) => `第${i + 1}行: 错误`)
    const result = formatImportResult({ records: [], errors })
    expect(result.message).toContain('...还有2条错误')
  })

  it('警告错误超过3条时显示省略提示', () => {
    const records = [
      { store_name: 'A', store_phone: '13812345678', store_address: '地址', tag: '' }
    ]
    const errors = Array.from({ length: 5 }, (_, i) => `第${i + 2}行: 错误`)
    const result = formatImportResult({ records, errors })
    expect(result.message).toContain('...还有2条错误')
  })
})
