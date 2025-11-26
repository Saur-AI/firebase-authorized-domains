import {isUrl} from '../src/utils'

describe('utils', () => {
  describe('isUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isUrl('https://example.com')).toBe(true)
      expect(isUrl('http://example.com')).toBe(true)
      expect(isUrl('https://subdomain.example.com')).toBe(true)
      expect(isUrl('https://example.com:8080')).toBe(true)
      expect(isUrl('https://example.com/path')).toBe(true)
    })

    it('should return false for invalid URLs', () => {
      expect(isUrl('example.com')).toBe(false)
      expect(isUrl('not a url')).toBe(false)
      expect(isUrl('')).toBe(false)
      expect(isUrl('ftp://example.com')).toBe(true) // FTP is still a valid URL
    })
  })
})
