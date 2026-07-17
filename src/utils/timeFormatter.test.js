import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './timeFormatter'

// 固定 now 为 2026-07-18 12:00:00 (UTC+0) 便于测试
const NOW = new Date('2026-07-18T12:00:00Z')
// 辅助：以毫秒偏移生成 ISO 时间字符串
function dateBefore(ms) {
  return new Date(NOW.getTime() - ms).toISOString()
}

describe('formatRelativeTime', () => {
  describe('刚刚（< 1 分钟）', () => {
    it('0 秒前显示刚刚', () => {
      expect(formatRelativeTime(dateBefore(0), NOW)).toBe('刚刚')
    })

    it('30 秒前显示刚刚', () => {
      expect(formatRelativeTime(dateBefore(30 * 1000), NOW)).toBe('刚刚')
    })

    it('59.999 秒前显示刚刚（边界）', () => {
      expect(formatRelativeTime(dateBefore(60 * 1000 - 1), NOW)).toBe('刚刚')
    })
  })

  describe('X分钟前（1-59 分钟）', () => {
    it('1 分钟前', () => {
      expect(formatRelativeTime(dateBefore(60 * 1000), NOW)).toBe('1分钟前')
    })

    it('30 分钟前', () => {
      expect(formatRelativeTime(dateBefore(30 * 60 * 1000), NOW)).toBe('30分钟前')
    })

    it('59 分钟前（边界）', () => {
      expect(formatRelativeTime(dateBefore(59 * 60 * 1000), NOW)).toBe('59分钟前')
    })

    it('59分59秒前仍为 59 分钟前（边界）', () => {
      expect(formatRelativeTime(dateBefore(60 * 60 * 1000 - 1), NOW)).toBe('59分钟前')
    })
  })

  describe('X小时前（1-23 小时）', () => {
    it('1 小时前', () => {
      expect(formatRelativeTime(dateBefore(60 * 60 * 1000), NOW)).toBe('1小时前')
    })

    it('12 小时前', () => {
      expect(formatRelativeTime(dateBefore(12 * 60 * 60 * 1000), NOW)).toBe('12小时前')
    })

    it('23 小时前（边界）', () => {
      expect(formatRelativeTime(dateBefore(23 * 60 * 60 * 1000), NOW)).toBe('23小时前')
    })

    it('23小时59分59秒前仍为 23 小时前（边界）', () => {
      expect(formatRelativeTime(dateBefore(24 * 60 * 60 * 1000 - 1), NOW)).toBe('23小时前')
    })
  })

  describe('X天前（1-6 天）', () => {
    it('1 天前', () => {
      expect(formatRelativeTime(dateBefore(24 * 60 * 60 * 1000), NOW)).toBe('1天前')
    })

    it('3 天前', () => {
      expect(formatRelativeTime(dateBefore(3 * 24 * 60 * 60 * 1000), NOW)).toBe('3天前')
    })

    it('6 天前（边界）', () => {
      expect(formatRelativeTime(dateBefore(6 * 24 * 60 * 60 * 1000), NOW)).toBe('6天前')
    })

    it('6天23小时59分前仍为 6 天前（边界）', () => {
      expect(formatRelativeTime(dateBefore(7 * 24 * 60 * 60 * 1000 - 1), NOW)).toBe('6天前')
    })
  })

  describe('X周前（1-3 周）', () => {
    it('1 周前', () => {
      expect(formatRelativeTime(dateBefore(7 * 24 * 60 * 60 * 1000), NOW)).toBe('1周前')
    })

    it('2 周前', () => {
      expect(formatRelativeTime(dateBefore(14 * 24 * 60 * 60 * 1000), NOW)).toBe('2周前')
    })

    it('3 周前（边界）', () => {
      expect(formatRelativeTime(dateBefore(21 * 24 * 60 * 60 * 1000), NOW)).toBe('3周前')
    })

    it('3周6天23小时前仍为 3 周前（边界）', () => {
      expect(formatRelativeTime(dateBefore(28 * 24 * 60 * 60 * 1000 - 1), NOW)).toBe('3周前')
    })
  })

  describe('超过 4 周显示日期', () => {
    it('4 周后显示月/日格式', () => {
      // 4 周前 = 2026-06-20 12:00:00 UTC
      const result = formatRelativeTime(dateBefore(28 * 24 * 60 * 60 * 1000), NOW)
      expect(result).toBe('6/20')
    })

    it('一年前显示月/日格式', () => {
      // 365 天前 ≈ 2025-07-18
      const result = formatRelativeTime(dateBefore(365 * 24 * 60 * 60 * 1000), NOW)
      expect(result).toMatch(/^\d{1,2}\/\d{1,2}$/)
    })

    it('月初和月末日期显示正确', () => {
      // 2026-05-31 12:00:00 UTC
      const result = formatRelativeTime(new Date('2026-05-31T12:00:00Z').toISOString(), NOW)
      expect(result).toBe('5/31')
    })
  })

  describe('不传 now 参数（使用真实当前时间）', () => {
    it('不传 now 时使用 new Date() 作为默认值', () => {
      // 刚刚的时间一定显示为"刚刚"
      const result = formatRelativeTime(new Date().toISOString())
      expect(result).toBe('刚刚')
    })
  })

  describe('时区与日期字符串格式', () => {
    it('支持 ISO 8601 字符串', () => {
      expect(formatRelativeTime('2026-07-18T11:30:00Z', NOW)).toBe('30分钟前')
    })

    it('支持带时区偏移的字符串', () => {
      // 2026-07-18T20:00:00+08:00 等于 2026-07-18T12:00:00Z，即 now 本身
      expect(formatRelativeTime('2026-07-18T20:00:00+08:00', NOW)).toBe('刚刚')
    })
  })
})
