import { useState, useEffect } from 'react'

function ShopList() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [operator, setOperator] = useState(localStorage.getItem('operator') || '')
  const [checkRecords, setCheckRecords] = useState({})
  const [checking, setChecking] = useState({})
  const [checkFeedback, setCheckFeedback] = useState({})
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    fetchShops()
  }, [])

  async function fetchShops() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/collections/customers/records?page=1&perPage=50')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setShops(data.items)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCheckRecords() {
    try {
      const response = await fetch('/api/collections/check_records/records?page=1&perPage=200')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      const recordsByCustomer = {}
      data.items.forEach(record => {
        const mappedRecord = {
          id: record.id,
          customer_id: record.customer_id,
          check_type: record.select,
          operator: record.relation,
          check_time: record.created
        }
        if (!recordsByCustomer[record.customer_id]) {
          recordsByCustomer[record.customer_id] = []
        }
        recordsByCustomer[record.customer_id].push(mappedRecord)
      })
      setCheckRecords(recordsByCustomer)
    } catch (err) {
      console.log('获取检查记录失败:', err)
    }
  }

  useEffect(() => {
    fetchCheckRecords()
  }, [])

  async function handleCheck(customerId, checkType) {
    if (!operator.trim()) {
      setCheckFeedback(prev => ({ ...prev, [customerId]: { success: false, message: '请先输入操作人姓名' } }))
      return
    }

    setChecking(prev => ({ ...prev, [customerId]: true }))
    setCheckFeedback(prev => ({ ...prev, [customerId]: null }))

    try {
      const response = await fetch('/api/collections/check_records/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: customerId,
          select: checkType,
          relation: operator.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      setCheckFeedback(prev => ({ ...prev, [customerId]: { success: true, message: `${checkType === 'good' ? 'Good' : 'Pass'} 记录已保存` } }))
      await fetchCheckRecords()
    } catch (err) {
      setCheckFeedback(prev => ({ ...prev, [customerId]: { success: false, message: `保存失败：${err.message}` } }))
    } finally {
      setChecking(prev => ({ ...prev, [customerId]: false }))
      setTimeout(() => {
        setCheckFeedback(prev => ({ ...prev, [customerId]: null }))
      }, 3000)
    }
  }

  function handleOperatorChange(e) {
    const value = e.target.value
    setOperator(value)
    localStorage.setItem('operator', value)
  }

  async function handleImport() {
    if (!importText.trim()) {
      setImportResult({ success: false, message: '请输入导入数据' })
      return
    }

    const lines = importText.trim().split('\n').filter(line => line.trim())
    const records = []
    const validationErrors = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1
      
      let parts
      if (line.includes(',')) {
        parts = line.split(',')
      } else {
        parts = line.split(/\s{2,}|\t+/).filter(p => p.trim())
      }
      
      if (parts.length < 3) {
        validationErrors.push(`第${lineNum}行: 格式不正确，缺少必要字段`)
        continue
      }
      
      const store_name = parts[0].trim()
      const store_phone = parts[1].trim()
      const store_address = parts.slice(2).join(',').trim()
      
      if (!store_name) {
        validationErrors.push(`第${lineNum}行: 店铺名称不能为空`)
        continue
      }
      
      if (!store_phone) {
        validationErrors.push(`第${lineNum}行: 电话号码不能为空`)
        continue
      }
      
      const phoneRegex = /^(1[3-9]\d{9}|400\d{7}|400-\d{3}-\d{4}|0\d{2,3}-\d{7,8}|0\d{2,3}\d{7,8})$/
      if (!phoneRegex.test(store_phone)) {
        validationErrors.push(`第${lineNum}行: 电话号码格式不正确`)
        continue
      }
      
      if (!store_address) {
        validationErrors.push(`第${lineNum}行: 地址不能为空`)
        continue
      }
      
      records.push({ store_name, store_phone, store_address })
    }

    if (records.length === 0) {
      const errorMsg = validationErrors.length > 0 
        ? `数据验证失败：\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? `\n...还有${validationErrors.length - 5}条错误` : ''}`
        : '未解析到有效数据，请检查格式'
      setImportResult({ success: false, message: errorMsg })
      return
    }

    if (validationErrors.length > 0) {
      const warningMsg = `发现${validationErrors.length}条无效数据已跳过：\n${validationErrors.slice(0, 3).join('\n')}${validationErrors.length > 3 ? `\n...还有${validationErrors.length - 3}条错误` : ''}`
      setImportResult({ success: null, message: warningMsg })
    }

    try {
      setImporting(true)
      setImportResult(null)

      let successCount = 0
      let failCount = 0
      const errors = []

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        try {
          const response = await fetch('/api/collections/customers/records', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(record)
          })
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }))
            throw new Error(errorData.message || `HTTP ${response.status}`)
          }
          successCount++
        } catch (err) {
          failCount++
          errors.push({
            line: i + 1,
            name: record.store_name,
            message: err.message
          })
        }
      }

      if (failCount === 0) {
        setImportResult({ success: true, message: `成功导入 ${successCount} 条数据` })
        setImportText('')
      } else if (successCount === 0) {
        const errorDetails = errors.slice(0, 3).map(e => `第${e.line}行(${e.name}): ${e.message}`).join('\n')
        setImportResult({
          success: false,
          message: `全部导入失败！\n${errorDetails}${errors.length > 3 ? `\n...还有${errors.length - 3}条错误` : ''}`
        })
      } else {
        const errorDetails = errors.slice(0, 3).map(e => `第${e.line}行(${e.name}): ${e.message}`).join('\n')
        setImportResult({
          success: true,
          message: `部分导入成功：成功 ${successCount} 条，失败 ${failCount} 条\n${errorDetails}${errors.length > 3 ? `\n...还有${errors.length - 3}条错误` : ''}`
        })
      }
      await fetchShops()
    } catch (err) {
      setImportResult({ success: false, message: `导入失败：${err.message}` })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold text-gray-800">店铺列表</h1>
            <button
              onClick={() => setShowImport(!showImport)}
              className="flex items-center gap-1 text-blue-600 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              批量导入
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={operator}
              onChange={handleOperatorChange}
              placeholder="输入操作人姓名"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </header>
      
      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {showImport && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-medium text-gray-800 mb-3">批量导入店铺</h3>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="荣记本草堂餐饮店  13760020096  前进中路6号首层105.106商铺"
              className="w-full h-40 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-2 mb-3">
              每行一条数据，支持两种格式：<br/>
              逗号分隔：店铺名称,电话号码,地址<br/>
              空格/制表符分隔：店铺名称  电话号码  地址
            </p>
            {importResult && (
              <div className={`mb-3 p-3 rounded-lg text-sm whitespace-pre-wrap ${
                importResult.success === true ? 'bg-green-50 text-green-600' :
                importResult.success === false ? 'bg-red-50 text-red-600' :
                'bg-yellow-50 text-yellow-700'
              }`}>
                {importResult.message}
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? '导入中...' : '确认导入'}
            </button>
          </div>
        )}
        
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">加载失败：{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-blue-600 text-sm font-medium"
            >
              重试
            </button>
          </div>
        )}
        
        {!loading && !error && shops.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">暂无店铺数据</p>
          </div>
        )}
        
        {!loading && !error && shops.map((shop) => {
          const shopRecords = checkRecords[shop.id] || []
          const sortedRecords = [...shopRecords].sort((a, b) => new Date(b.check_time) - new Date(a.check_time))
          const feedback = checkFeedback[shop.id]
          
          return (
            <div
              key={shop.id}
              className="bg-white rounded-xl shadow-sm p-4 active:scale-[0.99] transition-transform duration-150"
            >
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-medium text-gray-900 flex-1">{shop.store_name}</h2>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-600 flex-shrink-0">{shop.store_phone}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shop.store_phone)
                    setCopiedId(shop.id)
                    setTimeout(() => setCopiedId(null), 1500)
                  }}
                  className="flex items-center gap-1 text-blue-600 text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={copiedId === shop.id ? 'M5 13l4 4L19 7' : 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'} />
                  </svg>
                  {copiedId === shop.id ? '已复制' : '复制号码'}
                </button>
              </div>
              
              <div className="flex items-start gap-3 text-gray-600 mb-4">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm leading-relaxed">{shop.store_address}</span>
              </div>
              
              {feedback && (
                <div className={`mb-3 p-2 rounded-lg text-xs whitespace-pre-wrap ${
                  feedback.success === true ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {feedback.message}
                </div>
              )}
              
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => handleCheck(shop.id, 'good')}
                  disabled={checking[shop.id]}
                  className="flex-1 py-2 px-3 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Good
                </button>
                <button
                  onClick={() => handleCheck(shop.id, 'pass')}
                  disabled={checking[shop.id]}
                  className="flex-1 py-2 px-3 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                  Pass
                </button>
              </div>
              
              {sortedRecords.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">检查记录</h4>
                  <div className="space-y-2">
                    {sortedRecords.slice(0, 3).map((record, index) => {
                      const date = new Date(record.check_time)
                      const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
                      
                      return (
                        <div key={record.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded ${
                              record.check_type === 'good' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {record.check_type === 'good' ? 'Good' : 'Pass'}
                            </span>
                            <span className="text-gray-600">{record.operator}</span>
                          </div>
                          <span className="text-gray-400">{timeStr}</span>
                        </div>
                      )
                    })}
                    {sortedRecords.length > 3 && (
                      <p className="text-xs text-gray-400 text-center">还有 {sortedRecords.length - 3} 条记录</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </main>
    </div>
  )
}

export default ShopList
