import { useState, useEffect } from 'react'

function ShopList() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
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

    fetchShops()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-800">店铺列表</h1>
        </div>
      </header>
      
      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
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
        
        {!loading && !error && shops.map((shop) => (
          <div
            key={shop.id}
            className="bg-white rounded-xl shadow-sm p-4 active:scale-[0.99] transition-transform duration-150"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-medium text-gray-900">{shop.store_name}</h2>
              <a
                href={`tel:${shop.store_phone}`}
                className="flex items-center gap-1 text-blue-600 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                拨打电话
              </a>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <span className="text-sm">{shop.store_phone}</span>
              </div>
              
              <div className="flex items-start gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm leading-relaxed">{shop.store_address}</span>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

export default ShopList
