const shops = [
  {
    id: 1,
    name: '优鲜超市',
    phone: '138-1234-5678',
    address: '北京市朝阳区建国路88号SOHO现代城A座1层'
  },
  {
    id: 2,
    name: '星巴克咖啡',
    phone: '139-8765-4321',
    address: '上海市黄浦区南京东路100号恒基名人购物中心B1层'
  },
  {
    id: 3,
    name: '麦当劳餐厅',
    phone: '136-5555-6666',
    address: '广州市天河区天河路385号太古汇商场M层'
  },
  {
    id: 4,
    name: '海底捞火锅',
    phone: '137-9999-8888',
    address: '深圳市南山区海岸城购物中心3层'
  },
  {
    id: 5,
    name: '京东便利店',
    phone: '135-1111-2222',
    address: '杭州市西湖区文三路478号华星创业大厦1层'
  },
  {
    id: 6,
    name: '奈雪的茶',
    phone: '134-3333-4444',
    address: '成都市锦江区春熙路步行街188号'
  }
]

function ShopList() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-800">店铺列表</h1>
        </div>
      </header>
      
      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {shops.map((shop) => (
          <div
            key={shop.id}
            className="bg-white rounded-xl shadow-sm p-4 active:scale-[0.99] transition-transform duration-150"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-medium text-gray-900">{shop.name}</h2>
              <a
                href={`tel:${shop.phone}`}
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
                <span className="text-sm">{shop.phone}</span>
              </div>
              
              <div className="flex items-start gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm leading-relaxed">{shop.address}</span>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

export default ShopList
