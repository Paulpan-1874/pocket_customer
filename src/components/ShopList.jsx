import { useState, useEffect, useRef } from 'react'
import { Phone, Copy, Check, MapPin, Crown, Tag } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { normalizePhone, parseImportText } from '../utils/importParser'
import { formatRelativeTime } from '../utils/timeFormatter'
import { buildCheckRecordBody, mapCheckRecord, queryCheckRecordsByPhone } from '../utils/checkRecordKey'

function ShopList() {
  const {
    authToken,
    currentUser,
    isLoggedIn,
    loginForm,
    loginError,
    loginLoading,
    setLoginForm,
    handleLogin,
    handleLogout
  } = useAuth()

  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [checkRecords, setCheckRecords] = useState({})
  const [checking, setChecking] = useState({})
  const [checkFeedback, setCheckFeedback] = useState({})
  const [copiedId, setCopiedId] = useState(null)
  const [bigCustomerPhones, setBigCustomerPhones] = useState({})
  const [expandedShops, setExpandedShops] = useState({})
  const [relatedShops, setRelatedShops] = useState({})
  const [loadingRelated, setLoadingRelated] = useState({})
  const [importTag, setImportTag] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneFilter, setPhoneFilter] = useState('')

  useEffect(() => {
    fetchShops()
    fetchBigCustomerPhones()
  }, [])

  async function fetchShops({ tag: tagFilterParam, phone: phoneFilterParam } = {}) {
    try {
      setLoading(true)
      setError(null)

      const headers = {}
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      let url = `/api/collections/customers/records?perPage=100&sort=@random`
      const tagValue = tagFilterParam !== undefined ? tagFilterParam : tagFilter
      const phoneValue = phoneFilterParam !== undefined ? phoneFilterParam : phoneFilter
      
      const filters = []
      if (tagValue) {
        filters.push(`tag~"${tagValue}"`)
      }
      if (phoneValue) {
        filters.push(`store_phone~"${phoneValue}"`)
      }
      
      if (filters.length > 0) {
        const encodedFilter = encodeURIComponent(filters.join(' && '))
        url += `&filter=${encodedFilter}`
      }

      const response = await fetch(url, { headers })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      
      setShops(data.items)
      
      await fetchCheckRecords()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCheckRecords() {
    try {
      const headers = {}
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }
      const response = await fetch('/api/collections/check_records/records?page=1&perPage=200&expand=relation', { headers })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      const recordsByPhone = {}
      data.items.forEach(record => {
        const mappedRecord = mapCheckRecord(record)
        const p = normalizePhone(mappedRecord.store_phone)
        if (!p) return
        if (!recordsByPhone[p]) {
          recordsByPhone[p] = []
        }
        recordsByPhone[p].push(mappedRecord)
      })
      setCheckRecords(recordsByPhone)
    } catch (err) {
      console.log('获取检查记录失败:', err)
    }
  }

  async function fetchBigCustomerPhones() {
    try {
      const headers = {}
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }
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

  async function fetchRelatedShops(phoneKey) {
    if (relatedShops[phoneKey] || loadingRelated[phoneKey]) return
    setLoadingRelated(prev => ({ ...prev, [phoneKey]: true }))
    try {
      const headers = {}
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }
      const filter = encodeURIComponent(`store_phone="${phoneKey}"`)
      const res = await fetch(`/api/collections/customers/records?filter=${filter}&perPage=100`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRelatedShops(prev => ({ ...prev, [phoneKey]: data.items }))
    } catch (err) {
      console.log('获取同号店铺失败:', err)
    } finally {
      setLoadingRelated(prev => ({ ...prev, [phoneKey]: false }))
    }
  }

  function toggleExpandShop(shop) {
    const phoneKey = normalizePhone(shop.store_phone)
    if (!phoneKey) return
    setExpandedShops(prev => {
      const next = { ...prev }
      if (next[shop.id]) {
        delete next[shop.id]
      } else {
        next[shop.id] = true
        fetchRelatedShops(phoneKey)
      }
      return next
    })
  }

  async function handleCheck(shop, checkType) {
    if (!isLoggedIn) {
      setCheckFeedback(prev => ({ ...prev, [shop.id]: { success: false, message: '请先登录' } }))
      return
    }

    setChecking(prev => ({ ...prev, [shop.id]: true }))
    setCheckFeedback(prev => ({ ...prev, [shop.id]: null }))

    try {
      const response = await fetch('/api/collections/check_records/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(buildCheckRecordBody(shop, checkType, currentUser))
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      await fetchCheckRecords()
    } catch (err) {
      setCheckFeedback(prev => ({ ...prev, [shop.id]: { success: false, message: `保存失败：${err.message}` } }))
    } finally {
      setChecking(prev => ({ ...prev, [shop.id]: false }))
      setTimeout(() => {
        setCheckFeedback(prev => ({ ...prev, [shop.id]: null }))
      }, 3000)
    }
  }

  async function handleCopyPhone(shop) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shop.store_phone)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = shop.store_phone
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedId(shop.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (err) {
      console.log('复制失败:', err)
      return
    }

    if (!isLoggedIn) return

    try {
      await fetch('/api/collections/check_records/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(buildCheckRecordBody(shop, 'copy', currentUser))
      })
      await fetchCheckRecords()
    } catch (err) {
      console.log('保存复制记录失败:', err)
    }
  }

  async function handleImport() {
    if (!importText.trim()) {
      setImportResult({ success: false, message: '请输入导入数据' })
      return
    }

    const { records, errors: validationErrors } = parseImportText(importText, importTag)

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

      const BATCH_SIZE = 10
      let successCount = 0
      let failCount = 0
      const errors = []

      const headers = {
        'Content-Type': 'application/json'
      }
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      for (let batchStart = 0; batchStart < records.length; batchStart += BATCH_SIZE) {
        const batchRecords = records.slice(batchStart, batchStart + BATCH_SIZE)

        const requests = batchRecords.map(record => ({
          method: 'POST',
          url: '/api/collections/customers/records',
          body: record
        }))

        let batchResults
        try {
          const response = await fetch('/api/batch', {
            method: 'POST',
            headers,
            body: JSON.stringify({ requests })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }))
            throw new Error(errorData.message || `HTTP ${response.status}`)
          }

          batchResults = await response.json()
        } catch (batchErr) {
          batchResults = null
        }

        if (batchResults) {
          batchResults.forEach((result, index) => {
            const originalIndex = batchStart + index
            const record = records[originalIndex]
            if (result.code === 200 || result.code === 201) {
              successCount++
            } else {
              failCount++
              errors.push({
                line: originalIndex + 1,
                name: record.store_name,
                message: result.message || `HTTP ${result.code}` || '导入失败'
              })
            }
          })
        } else {
          for (let i = 0; i < batchRecords.length; i++) {
            const originalIndex = batchStart + i
            const record = records[originalIndex]
            try {
              const response = await fetch('/api/collections/customers/records', {
                method: 'POST',
                headers,
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
                line: originalIndex + 1,
                name: record.store_name,
                message: err.message
              })
            }
          }
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
      await fetchShops({ tag: tagFilter, phone: phoneFilter })
    } catch (err) {
      setImportResult({ success: false, message: `导入失败：${err.message}` })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!isLoggedIn ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">欢迎登录</h1>
              <p className="text-sm text-gray-500 mt-1">请输入您的账号信息</p>
            </div>
            
            {loginError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {loginError}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="请输入邮箱"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="请输入密码"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loginLoading ? '登录中...' : '登录'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <header className="bg-white shadow-sm sticky top-0 z-10">
            <div className="max-w-lg mx-auto px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-xl font-semibold text-gray-800">店铺列表</h1>
                  <div className="text-xs text-gray-400 mt-0.5">
                    共 {shops.length} 条
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const currentTagFilter = tagInput.trim() || tagFilter
                      const currentPhoneFilter = phoneInput.trim() || phoneFilter
                      setTagFilter(currentTagFilter)
                      setPhoneFilter(currentPhoneFilter)
                      fetchShops({ tag: currentTagFilter, phone: currentPhoneFilter })
                    }}
                    className="flex items-center gap-1 text-blue-600 text-sm font-medium hover:text-blue-700"
                    title="换一批"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    换一批
                  </button>
                  <button
                    onClick={() => setShowImport(!showImport)}
                    className="flex items-center gap-1 text-blue-600 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    批量导入
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-gray-500 text-sm font-medium hover:text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    退出
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm text-gray-600">{currentUser?.name || currentUser?.username || currentUser?.email}</span>
                </div>
              </div>
            </div>
          </header>
          
          <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
            {showImport && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-medium text-gray-800 mb-3">批量导入店铺</h3>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">标签（可选）</label>
                  <input
                    type="text"
                    value={importTag}
                    onChange={(e) => setImportTag(e.target.value)}
                    placeholder="例如：新客户、VIP"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
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
                  onClick={() => fetchShops()}
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
            
            {/* 标签筛选 */}
            {!error && (
              <div className="flex flex-col gap-2 mb-4">
                {(tagFilter || phoneFilter) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {tagFilter && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                        <Tag className="w-3 h-3" strokeWidth={2} />
                        标签：{tagFilter}
                        <button
                          type="button"
                          onClick={() => {
                            setTagInput('')
                            setTagFilter('')
                            fetchShops({ tag: '', phone: phoneFilter })
                          }}
                          disabled={loading}
                          className="ml-1 w-3.5 h-3.5 flex items-center justify-center text-blue-400 hover:text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {phoneFilter && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-medium">
                        <Phone className="w-3 h-3" strokeWidth={2} />
                        电话：{phoneFilter}
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneInput('')
                            setPhoneFilter('')
                            fetchShops({ tag: tagFilter, phone: '' })
                          }}
                          disabled={loading}
                          className="ml-1 w-3.5 h-3.5 flex items-center justify-center text-green-400 hover:text-green-600 rounded-full hover:bg-green-100 transition-colors"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setTagInput('')
                        setTagFilter('')
                        setPhoneInput('')
                        setPhoneFilter('')
                        fetchShops({ tag: '', phone: '' })
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1 text-red-500 text-xs font-medium hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      清除全部筛选
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-400" strokeWidth={2} />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="输入标签筛选"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newFilter = tagInput.trim()
                      setTagFilter(newFilter)
                      fetchShops({ tag: newFilter, phone: phoneFilter })
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    确认
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" strokeWidth={2} />
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="输入电话号码筛选"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newFilter = phoneInput.trim()
                      setPhoneFilter(newFilter)
                      fetchShops({ tag: tagFilter, phone: newFilter })
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    确认
                  </button>
                </div>
              </div>
            )}
            
            {!loading && !error && shops
              .filter(shop => 
                (!tagFilter || (shop.tag && shop.tag.includes(tagFilter))) &&
                (!phoneFilter || (shop.store_phone && shop.store_phone.includes(phoneFilter)))
              )
              .map((shop) => {
              const phoneKey = normalizePhone(shop.store_phone)
              const sortedRecords = [...queryCheckRecordsByPhone(checkRecords, phoneKey)].sort((a, b) => new Date(b.check_time) - new Date(a.check_time))
              const isBig = phoneKey && !!bigCustomerPhones[phoneKey]
              const bigCount = isBig ? bigCustomerPhones[phoneKey] : 0
              const feedback = checkFeedback[shop.id]

              return (
                <div
                  key={shop.id}
                  className={`bg-white rounded-xl shadow-sm p-4 transition-all duration-150 hover:shadow-md ${sortedRecords.length === 0 ? 'ring-4 ring-green-500' : ''}`}
                >
                  <div className="mb-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h2 className="text-lg font-semibold text-gray-900 flex-1 leading-tight">{shop.store_name}</h2>
                      {isBig && (
                        <button
                          onClick={() => toggleExpandShop(shop)}
                          className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shadow-sm ring-1 ring-amber-500/30 ${
                            expandedShops[shop.id]
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-amber-500 text-white hover:bg-amber-600'
                          }`}
                          title={expandedShops[shop.id] ? '收起同号店铺' : '展开同号店铺'}
                        >
                          <Crown className="w-3 h-3" strokeWidth={2.5} />
                          大客户 · {bigCount}店
                          <svg className={`w-2.5 h-2.5 transition-transform ${expandedShops[shop.id] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {shop.tag && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700 whitespace-nowrap">
                        <Tag className="w-3 h-3" strokeWidth={2} />
                        {shop.tag}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-3.5 h-3.5 text-blue-600" strokeWidth={2} />
                      </div>
                      <span className="text-sm text-gray-600 flex-shrink-0 font-mono">{shop.store_phone}</span>
                      <button
                        onClick={() => handleCopyPhone(shop)}
                        className="-mr-1 p-1 flex items-center justify-center text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                        title={copiedId === shop.id ? '已复制' : '复制号码'}
                      >
                        {copiedId === shop.id
                          ? <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          : <Copy className="w-3.5 h-3.5" strokeWidth={2} />}
                      </button>
                    </div>
                  </div>

                  {expandedShops[shop.id] && (
                    <div className="mb-3 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-medium text-amber-700">同号店铺（{bigCount}家）</h4>
                        {loadingRelated[phoneKey] && (
                          <span className="text-[10px] text-amber-600">加载中...</span>
                        )}
                      </div>
                      {relatedShops[phoneKey] ? (
                        <div className="space-y-1.5">
                          {relatedShops[phoneKey].map(s => (
                            <div
                              key={s.id}
                              className={`flex items-start gap-2 text-xs p-1.5 rounded ${
                                s.id === shop.id ? 'bg-amber-100/60' : 'hover:bg-amber-100/40'
                              }`}
                            >
                              <MapPin className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-gray-700 truncate">{s.store_name}</span>
                                  {s.id === shop.id && (
                                    <span className="text-[10px] text-amber-600 flex-shrink-0">本店</span>
                                  )}
                                </div>
                                <div className="text-gray-500 truncate">{s.store_address}</div>
                              </div>
                              {s.id !== shop.id && (
                                <button
                                  onClick={() => handleCopyPhone(s)}
                                  className="p-1 flex items-center justify-center text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded transition-colors flex-shrink-0"
                                  title="复制号码"
                                >
                                  <Copy className="w-3 h-3" strokeWidth={2} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : !loadingRelated[phoneKey] ? (
                        <p className="text-[11px] text-gray-400">点击徽标重新加载</p>
                      ) : null}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-gray-600 mb-4">
                    <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-green-600" strokeWidth={2} />
                    </div>
                    <span className="text-sm leading-relaxed flex-1">{shop.store_address}</span>
                  </div>
                  
                  {feedback && (
                    <div className={`mb-3 p-2.5 rounded-lg text-sm font-medium whitespace-pre-wrap ${
                      feedback.success === true ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
                    }`}>
                      {feedback.message}
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-2 flex-1">
                      <button
                        onClick={() => handleCheck(shop, 'pass')}
                        disabled={checking[shop.id]}
                        className="flex-1 py-2 px-3 border border-gray-300 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                      >
                        Pass
                      </button>
                      <button
                        onClick={() => handleCheck(shop, 'good')}
                        disabled={checking[shop.id]}
                        className="flex-1 py-2 px-3 border border-green-200 bg-green-50 text-green-600 rounded-lg text-sm font-semibold hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                      >
                        Good
                      </button>
                    </div>
                    <button
                      onClick={() => handleCopyPhone(shop)}
                      className="flex-1 py-2 px-3 border border-blue-200 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center"
                    >
                      {copiedId === shop.id ? '已复制' : 'Copy'}
                    </button>
                  </div>
                  
                  {sortedRecords.length > 0 && (
                    <div className="border-t border-gray-100 pt-3 mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-medium text-gray-500">检查记录</h4>
                        <span className="text-xs text-gray-400">{sortedRecords.length}条</span>
                      </div>
                      <div className="space-y-1.5">
                        {sortedRecords.slice(0, 2).map((record, index) => {
                          const date = new Date(record.check_time)
                          const relativeTime = formatRelativeTime(record.check_time)
                          const exactTime = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
                          
                          return (
                            <div key={record.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium w-12 text-center ${
                                  record.check_type === 'good' ? 'bg-green-100 text-green-700' :
                                  record.check_type === 'copy' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                                }`}>
                                  {record.check_type === 'good' ? 'Good' : record.check_type === 'copy' ? 'Copy' : 'Pass'}
                                </span>
                                <span className="text-gray-500">{record.operator}</span>
                                <span className="text-gray-400">{relativeTime}</span>
                              </div>
                              <span className="text-gray-300 text-[10px]">{exactTime}</span>
                            </div>
                          )
                        })}
                        {sortedRecords.length > 2 && (
                          <p className="text-xs text-gray-400 text-center mt-1">还有{sortedRecords.length - 2}条</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </main>
        </div>
      )}
    </div>
  )
}

export default ShopList
