// 相对时间格式化工具函数

// 将日期字符串格式化为相对时间
// 接受可选的 now 参数，便于测试时注入固定时间
export function formatRelativeTime(dateStr, now = new Date()) {
  const date = new Date(dateStr)
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
