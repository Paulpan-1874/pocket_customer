import { useState, useEffect, useRef } from 'react'
import { Phone, Copy, Check, MapPin, Crown } from 'lucide-react'

function normalizePhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/[\s\-]/g, '').replace(/^\+?86/, '')
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  const weeks = Math.floor(diff / 604800000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  if (weeks < 4) return `${weeks}周前`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function ShopList() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [checkRecords, setCheckRecords] = useState({})
  const [checking, setChecking] = useState({})
  const [checkFeedback, setCheckFeedback] = useState({})
  const [copiedId, setCopiedId] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [authToken, setAuthToken] = useState(localStorage.getItem('pb_auth_token') || '')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [bigCustomerPhones, setBigCustomerPhones] = useState({})
  const [expandedShops, setExpandedShops] = useState({})
  const [relatedShops, setRelatedShops] = useState({})
  const [loadingRelated, setLoadingRelated] = useState({})

  const PAGE_SIZE = 20
  const loadingRef = useRef(false)

  function shuffleArray(array) {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  useEffect(() => {
    fetchShops(1)
    fetchBigCustomerPhones()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (loadingRef.current || !hasMore) return
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
      const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight
      const clientHeight = document.documentElement.clientHeight || window.innerHeight
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        fetchShops(currentPage + 1)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMore, currentPage])

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

  async function fetchShops(page = 1) {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      if (page === 1) {
        setLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      setError(null)
      const headers = {}
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }
      const response = await fetch(`/api/collections/customers/records?page=${page}&perPage=${PAGE_SIZE}`, { headers })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      const shuffledItems = shuffleArray(data.items)
      if (page === 1) {
        setShops(shuffledItems)
      } else {
        setShops(prev => [...prev, ...shuffledItems])
      }
      setHasMore(data.page < data.totalPages)
      setCurrentPage(page)
      await fetchCheckRecords()
    } catch (err) {
      setError(err.message)
    } finally {
      loadingRef.current = false
      setLoading(false)
      setIsLoadingMore(false)
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
        const key = p ? p : ('cid:' + record.customer_id)
        if (!recordsByPhone[key]) {
          recordsByPhone[key] = []
        }
        recordsByPhone[key].push(mappedRecord)
      })
      setCheckRecords(recordsByPhone)
    } catch (err) {
      console.log('获取检查记录失败:', err)
    }
  }

  useEffect(() => {
    fetchCheckRecords()
  }, [])

  useEffect(() => {
    if (authToken) {
      fetchUserInfo()
    }
  }, [authToken])

  async function fetchUserInfo() {
    try {
      const response = await fetch('/api/collections/users/records', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      if (!response.ok) {
        throw new Error('Token invalid')
      }
      const data = await response.json()
      if (data.items.length > 0) {
        setCurrentUser(data.items[0])
        setIsLoggedIn(true)
      }
    } catch (err) {
      console.log('获取用户信息失败:', err)
      setIsLoggedIn(false)
      setCurrentUser(null)
      localStorage.removeItem('pb_auth_token')
      setAuthToken('')
    }
  }

  async function handleLogin() {
    if (!loginForm.email || !loginForm.password) {
      setLoginError('请输入邮箱和密码')
      return
    }

    setLoginLoading(true)
    setLoginError('')

    try {
      const response = await fetch('/api/collections/users/auth-with-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identity: loginForm.email,
          password: loginForm.password
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '登录失败' }))
        throw new Error(errorData.message || '登录失败')
      }

      const data = await response.json()
      setAuthToken(data.token)
      localStorage.setItem('pb_auth_token', data.token)
      setCurrentUser(data.record)
      setIsLoggedIn(true)
      setLoginForm({ email: '', password: '' })
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoginLoading(false)
    }
  }

  function handleLogout() {
    setIsLoggedIn(false)
    setCurrentUser(null)
    setAuthToken('')
    localStorage.removeItem('pb_auth_token')
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
        body: JSON.stringify({
          customer_id: shop.id,
          select: checkType,
          relation: currentUser?.id || currentUser?.name || currentUser?.username || currentUser?.email || '未知用户',
          store_phone: normalizePhone(shop.store_phone),
          store_name: shop.store_name
        })
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
        body: JSON.stringify({
          customer_id: shop.id,
          select: 'copy',
          relation: currentUser?.id || currentUser?.name || currentUser?.username || currentUser?.email || '未知用户',
          store_phone: normalizePhone(shop.store_phone),
          store_name: shop.store_name
        })
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
      
      records.push({ store_name, store_phone: normalizePhone(store_phone), store_address })
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
          const headers = {
            'Content-Type': 'application/json'
          }
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`
          }
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
      setCurrentPage(1)
      setHasMore(true)
      await fetchShops(1)
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
                <h1 className="text-xl font-semibold text-gray-800">店铺列表</h1>
                <div className="flex items-center gap-2">
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
          const phoneKey = normalizePhone(shop.store_phone)
          const cidKey = 'cid:' + shop.id
          const mergedRecords = [
            ...(phoneKey ? (checkRecords[phoneKey] || []) : []),
            ...(checkRecords[cidKey] || [])
          ]
          const sortedRecords = [...mergedRecords].sort((a, b) => new Date(b.check_time) - new Date(a.check_time))
          const isBig = phoneKey && !!bigCustomerPhones[phoneKey]
          const bigCount = isBig ? bigCustomerPhones[phoneKey] : 0
          const feedback = checkFeedback[shop.id]

          return (
            <div
              key={shop.id}
              className={`bg-white rounded-xl shadow-sm p-4 transition-all duration-150 hover:shadow-md ${sortedRecords.length === 0 ? 'ring-4 ring-green-500' : ''}`}
            >
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{shop.store_name}</h2>
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
        
        {isLoadingMore && (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {!loading && !error && shops.length > 0 && !hasMore && !isLoadingMore && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">已加载全部店铺</p>
          </div>
        )}
      </main>
        </div>
      )}
    </div>
  )
}

export default ShopList
