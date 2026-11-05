export const RADIO_BROWSER_API = 'https://de1.api.radio-browser.info/json'
export const RADIO_FAVORITES_KEY = 'autodash-radio-favorites'
export const RADIO_CHECK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const RADIO_PROBE_TIMEOUT_MS = 5000

export const RADIO_CATEGORIES = [
  { id: 'all', label: 'Todas', tags: [] },
  { id: 'pop', label: 'Música pop', tags: ['pop'] },
  { id: 'latin', label: 'Música latina', tags: ['latin', 'latino', 'latina'] },
  { id: 'reggaeton', label: 'Reggaetón', tags: ['reggaeton', 'reggaetón'] },
  { id: 'rock', label: 'Rock', tags: ['rock'] },
  { id: 'electronic', label: 'Electrónica', tags: ['electronic', 'electronica', 'electro', 'dance'] },
  { id: 'regional', label: 'Regional mexicana', tags: ['regional mexicano', 'banda', 'ranchera', 'grupera'] },
  { id: 'news', label: 'Noticias', tags: ['news', 'noticias'] },
  { id: 'sports', label: 'Deportes', tags: ['sports', 'sport', 'deportes'] },
  { id: 'variety', label: 'Música variada', tags: ['variety', 'various', 'variedades'] },
]

const isSafeStreamUrl = (value, { secureContext = true } = {}) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || (!secureContext && url.protocol === 'http:')
  } catch {
    return false
  }
}

export const normalizeRadioStation = (station, { now = Date.now(), secureContext = true } = {}) => {
  if (
    !station ||
    station.lastcheckok !== 1 ||
    !station.stationuuid ||
    !station.name?.trim() ||
    !isSafeStreamUrl(station.url_resolved, { secureContext })
  ) {
    return null
  }

  const checkedAt = Date.parse(station.lastcheckoktime_iso8601 || station.lastchecktime_iso8601 || '')
  if (!Number.isFinite(checkedAt) || checkedAt > now || now - checkedAt > RADIO_CHECK_MAX_AGE_MS) {
    return null
  }

  return {
    id: station.stationuuid,
    name: station.name.trim(),
    streamUrl: station.url_resolved,
    homepage: isSafeStreamUrl(station.homepage, { secureContext }) ? station.homepage : '',
    logo: isSafeStreamUrl(station.favicon, { secureContext }) ? station.favicon : '',
    country: station.country?.trim() || 'Ubicación no especificada',
    language: station.language?.trim() || '',
    tags: station.tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean) || [],
    codec: station.codec?.trim() || 'Formato no especificado',
    bitrate: Number(station.bitrate) || 0,
    checkedAt,
  }
}

export const filterRadioStations = (stations, { query = '', categoryId = 'all' } = {}) => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const category = RADIO_CATEGORIES.find((item) => item.id === categoryId)
  const categoryTags = category?.tags.map((tag) => tag.toLocaleLowerCase()) || []

  return stations.filter((station) => {
    const searchable = [
      station.name,
      station.country,
      station.language,
      ...station.tags,
    ].join(' ').toLocaleLowerCase()
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)
    const stationTags = station.tags.map((tag) => tag.toLocaleLowerCase())
    const matchesCategory =
      !categoryTags.length ||
      categoryTags.some((tag) => stationTags.some((stationTag) => stationTag.includes(tag)))

    return matchesQuery && matchesCategory
  })
}

export const buildRadioSearchUrls = (query, categoryId) => {
  const category = RADIO_CATEGORIES.find((item) => item.id === categoryId)
  const fields = []
  if (query.trim()) {
    fields.push(...['name', 'tag', 'country'].map((field) => [field, query.trim()]))
  }
  if (category?.tags.length) {
    fields.push(...category.tags.map((tag) => ['tag', tag]))
  }

  if (fields.length === 0) {
    fields.push(['name', 'radio'])
  }

  return Array.from(
    new Set(
      fields.map(([field, value]) => {
        const url = new URL(`${RADIO_BROWSER_API}/stations/search`)
        url.search = new URLSearchParams({
          [field]: value,
          hidebroken: 'true',
          order: 'clickcount',
          reverse: 'true',
          limit: '40',
        }).toString()
        return url.toString()
      }),
    ),
  )
}

export const readRadioFavorites = (value) => {
  try {
    const stored = JSON.parse(value || '[]')
    if (!Array.isArray(stored)) {
      return []
    }

    return stored.filter(
      (station) =>
        station &&
        typeof station.id === 'string' &&
        typeof station.name === 'string' &&
        typeof station.streamUrl === 'string' &&
        isSafeStreamUrl(station.streamUrl),
    )
  } catch {
    return []
  }
}

export const probeRadioStream = (
  station,
  { audioFactory = () => new Audio(), signal, timeoutMs = RADIO_PROBE_TIMEOUT_MS } = {},
) =>
  new Promise((resolve) => {
    const audio = audioFactory()
    let settled = false
    const timeoutId = setTimeout(() => finish(false), timeoutMs)

    const cleanup = () => {
      clearTimeout(timeoutId)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
      audio.pause()
      audio.removeAttribute('src')
      audio.muted = false
      audio.load()
    }

    const finish = (isPlayable) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resolve(isPlayable)
    }

    const onCanPlay = () => finish(true)
    const onError = () => finish(false)
    const onAbort = () => finish(false)
    const onPlaying = () => finish(true)

    if (signal?.aborted) {
      finish(false)
      return
    }

    audio.preload = 'auto'
    audio.muted = true
    audio.playsInline = true
    audio.addEventListener('canplay', onCanPlay, { once: true })
    audio.addEventListener('playing', onPlaying, { once: true })
    audio.addEventListener('error', onError, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
    audio.src = station.streamUrl
    audio.load()
    audio.play()?.catch(() => finish(false))
  })
