export const MAX_GPS_SIGNAL_AGE_MS = 3000
export const MAX_VEHICLE_SIGNAL_AGE_MS = 1500

const SPOTIFY_CONTENT_TYPES = new Set(['track', 'album', 'playlist', 'episode', 'show'])
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

export const parseSpotifyContent = (value) => {
  const input = value.trim()
  const uriMatch = input.match(/^spotify:(track|album|playlist|episode|show):([A-Za-z0-9]+)$/)

  if (uriMatch && SPOTIFY_CONTENT_TYPES.has(uriMatch[1])) {
    const [, type, id] = uriMatch
    return {
      type,
      id,
      embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
      openUrl: `https://open.spotify.com/${type}/${id}`,
    }
  }

  try {
    const url = new URL(input)
    if (url.hostname !== 'open.spotify.com' && url.hostname !== 'www.open.spotify.com') {
      return null
    }

    const parts = url.pathname.split('/').filter(Boolean)
    const localizedParts = /^intl-[a-z]{2}(?:-[a-z]{2})?$/i.test(parts[0] || '') ? parts.slice(1) : parts
    const contentParts = localizedParts[0] === 'embed' ? localizedParts.slice(1) : localizedParts
    const [type, id] = contentParts

    if (!SPOTIFY_CONTENT_TYPES.has(type) || !/^[A-Za-z0-9]+$/.test(id || '')) {
      return null
    }

    return {
      type,
      id,
      embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
      openUrl: `https://open.spotify.com/${type}/${id}`,
    }
  } catch {
    return null
  }
}

export const getSpotifyEmbedUrl = (value) => parseSpotifyContent(value)?.embedUrl || null

export const getYouTubeVideoId = (value) => {
  const input = value.trim()
  if (YOUTUBE_VIDEO_ID_PATTERN.test(input)) {
    return input
  }

  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let id = null

    if (host === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0]
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (url.pathname === '/watch') {
        id = url.searchParams.get('v')
      } else if (['embed', 'shorts', 'live'].includes(parts[0])) {
        id = parts[1]
      }
    }

    return id && YOUTUBE_VIDEO_ID_PATTERN.test(id) ? id : null
  } catch {
    return null
  }
}

export const canPlayVideoSafely = (gpsReading, vehicleReading, now = Date.now()) =>
  Boolean(
    gpsReading &&
      Number.isFinite(gpsReading.speedKmh) &&
      gpsReading.speedKmh === 0 &&
      Number.isFinite(gpsReading.receivedAt) &&
      now >= gpsReading.receivedAt &&
      now - gpsReading.receivedAt <= MAX_GPS_SIGNAL_AGE_MS &&
      vehicleReading &&
      vehicleReading.source === 'vehicle-controller' &&
      vehicleReading.isSimulated === false &&
      vehicleReading.parkingBrakeEngaged === true &&
      Number.isFinite(vehicleReading.speedKmh) &&
      vehicleReading.speedKmh === 0 &&
      Number.isFinite(vehicleReading.receivedAt) &&
      now >= vehicleReading.receivedAt &&
      now - vehicleReading.receivedAt <= MAX_VEHICLE_SIGNAL_AGE_MS,
  )
