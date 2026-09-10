const X_STATUS_HOSTS = new Set(['mobile.twitter.com', 'twitter.com', 'www.twitter.com', 'www.x.com', 'x.com'])
const X_STATUS_PATH = /^\/(?:[A-Za-z0-9_]{1,15}|i(?:\/web)?)\/status\/(\d+)\/?$/
const X_EMBED_HOST = 'platform.twitter.com'
const X_EMBED_PATH = '/embed/Tweet.html'

function xStatusId(value: string): string | null {
  try {
    const url = new URL(value)

    if (!/^https?:$/.test(url.protocol) || !X_STATUS_HOSTS.has(url.hostname.toLowerCase())) {
      return null
    }

    return X_STATUS_PATH.exec(url.pathname)?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * X currently rejects a clean embedded Chromium session with HTTP 403 and can
 * redirect it into account onboarding. The official Tweet embed is the
 * read-only, cookie-free representation intended for this exact use case.
 *
 * Keep the original address in a private-to-Hermes query field. X ignores the
 * extra parameter, while `visiblePreviewUrl` can retain the useful canonical
 * address in the Browser bar and persisted tab state.
 */
export function previewGuestUrl(value: string): string {
  const id = xStatusId(value)

  if (!id) {
    return value
  }

  const embed = new URL(`https://${X_EMBED_HOST}${X_EMBED_PATH}`)

  embed.searchParams.set('dnt', 'true')
  embed.searchParams.set('id', id)
  embed.searchParams.set('hermes_source', value)

  return embed.toString()
}

/** Map only embeds created by `previewGuestUrl` back to their original X URL. */
export function visiblePreviewUrl(value: string): string {
  try {
    const embed = new URL(value)

    if (embed.protocol !== 'https:' || embed.hostname !== X_EMBED_HOST || embed.pathname !== X_EMBED_PATH) {
      return value
    }

    const id = embed.searchParams.get('id')
    const source = embed.searchParams.get('hermes_source')

    return id && source && xStatusId(source) === id ? source : value
  } catch {
    return value
  }
}
