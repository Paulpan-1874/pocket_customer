// 批量导入解析与验证工具函数

// 标准化电话号码：去除空格、横线，去除 +86 前缀
export function normalizePhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/[\s\-]/g, '').replace(/^\+?86/, '')
}

// 验证电话号码格式：支持手机号、400、固话
export function validatePhone(phone) {
  const phoneRegex = /^(1[3-9]\d{9}|400\d{7}|400-\d{3}-\d{4}|0\d{2,3}-\d{7,8}|0\d{2,3}\d{7,8})$/
  return phoneRegex.test(phone)
}

// 解析单行导入数据
// 返回 { record, error } —— record 存在则成功，error 存在则失败
export function parseImportLine(line, lineNumber) {
  if (!line || !line.trim()) {
    return { record: null, error: `第${lineNumber}行: 空行` }
  }

  let parts
  if (line.includes(',')) {
    parts = line.split(',')
  } else {
    parts = line.split(/\s{2,}|\t+/).filter(p => p.trim())
  }

  if (parts.length < 3) {
    return { record: null, error: `第${lineNumber}行: 格式不正确，缺少必要字段` }
  }

  const store_name = parts[0].trim()
  const store_phone = parts[1].trim()
  const store_address = parts.slice(2).join(',').trim()

  if (!store_name) {
    return { record: null, error: `第${lineNumber}行: 店铺名称不能为空` }
  }

  if (!store_phone) {
    return { record: null, error: `第${lineNumber}行: 电话号码不能为空` }
  }

  if (!validatePhone(store_phone)) {
    return { record: null, error: `第${lineNumber}行: 电话号码格式不正确` }
  }

  if (!store_address) {
    return { record: null, error: `第${lineNumber}行: 地址不能为空` }
  }

  return {
    record: {
      store_name,
      store_phone: normalizePhone(store_phone),
      store_address,
      tag: ''
    },
    error: null
  }
}

// 解析整段导入文本
// 返回 { records, errors }
export function parseImportText(text, importTag = '') {
  const lines = text.trim().split('\n').filter(line => line.trim())
  const records = []
  const errors = []

  lines.forEach((line, index) => {
    const { record, error } = parseImportLine(line, index + 1)
    if (record) {
      records.push({ ...record, tag: importTag.trim() || '' })
    } else if (error) {
      errors.push(error)
    }
  })

  return { records, errors }
}

// 格式化导入结果消息
export function formatImportResult({ records, errors }) {
  if (records.length === 0) {
    const errorMsg = errors.length > 0
      ? `数据验证失败：\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...还有${errors.length - 5}条错误` : ''}`
      : '未解析到有效数据，请检查格式'
    return { success: false, message: errorMsg, records, errors }
  }

  // 有有效记录但也有错误
  if (errors.length > 0) {
    return {
      success: true,
      hasWarning: true,
      message: `发现${errors.length}条无效数据已跳过：\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...还有${errors.length - 3}条错误` : ''}`,
      records,
      errors
    }
  }

  return { success: true, message: null, records, errors }
}
