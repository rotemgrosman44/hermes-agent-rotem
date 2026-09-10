import { describe, expect, it } from 'vitest'

import { previewGuestUrl, visiblePreviewUrl } from './x-status-preview'

describe('X status preview routing', () => {
  it('uses the official cookie-free embed for an X status URL', () => {
    const source = 'https://x.com/Taltalit/status/2097947431107285200'
    const guest = previewGuestUrl(source)

    expect(guest).toBe(
      'https://platform.twitter.com/embed/Tweet.html?dnt=true&id=2097947431107285200&hermes_source=https%3A%2F%2Fx.com%2FTaltalit%2Fstatus%2F2097947431107285200'
    )
    expect(visiblePreviewUrl(guest)).toBe(source)
  })

  it('supports legacy Twitter status links and i/web status links', () => {
    expect(previewGuestUrl('https://twitter.com/NousResearch/status/123')).toContain('id=123')
    expect(previewGuestUrl('https://x.com/i/web/status/456')).toContain('id=456')
  })

  it('leaves profiles, intents, unrelated hosts, and malformed values alone', () => {
    for (const value of [
      'https://x.com/home',
      'https://x.com/intent/tweet?text=hello',
      'https://example.com/user/status/123',
      'not a url'
    ]) {
      expect(previewGuestUrl(value)).toBe(value)
    }
  })

  it('does not trust a forged source or an arbitrary official embed', () => {
    expect(
      visiblePreviewUrl(
        'https://platform.twitter.com/embed/Tweet.html?id=123&hermes_source=https%3A%2F%2Fevil.example%2Fstatus%2F123'
      )
    ).toContain('platform.twitter.com')
    expect(visiblePreviewUrl('https://platform.twitter.com/embed/Tweet.html?id=123')).toContain(
      'platform.twitter.com'
    )
  })
})
