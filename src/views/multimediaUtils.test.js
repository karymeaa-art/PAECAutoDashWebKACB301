import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canPlayVideoSafely,
  getSpotifyEmbedUrl,
  getYouTubeVideoId,
  MAX_GPS_SIGNAL_AGE_MS,
  MAX_VEHICLE_SIGNAL_AGE_MS,
  parseSpotifyContent,
} from './multimediaUtils.js'
import {
  buildRadioSearchUrls,
  filterRadioStations,
  normalizeRadioStation,
  probeRadioStream,
  RADIO_CHECK_MAX_AGE_MS,
  readRadioFavorites,
} from './radioUtils.js'

test('converts supported Spotify links and URIs into official embeds', () => {
  assert.deepEqual(
    parseSpotifyContent('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=test'),
    {
      type: 'playlist',
      id: '37i9dQZF1DXcBWIGoYBM5M',
      embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
      openUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    },
  )
  assert.equal(
    getSpotifyEmbedUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=test'),
    'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
  )
  assert.equal(
    getSpotifyEmbedUrl('https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC'),
    'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
  )
  assert.equal(
    getSpotifyEmbedUrl('spotify:track:4uLU6hMCjMI75M1A2tKUQC'),
    'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
  )
  assert.equal(getSpotifyEmbedUrl('https://example.com/track/123'), null)
  assert.equal(getSpotifyEmbedUrl('https://open.spotify.com/user/name'), null)
  assert.equal(parseSpotifyContent('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M').type, 'playlist')
})

test('extracts YouTube IDs from direct IDs and supported link formats', () => {
  assert.equal(getYouTubeVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
  assert.equal(getYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=3'), 'dQw4w9WgXcQ')
  assert.equal(
    getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'dQw4w9WgXcQ',
  )
  assert.equal(getYouTubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
  assert.equal(getYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null)
  assert.equal(getYouTubeVideoId('https://youtu.be/not-a-valid-id'), null)
})

test('requires independent fresh GPS and vehicle interlock signals before video playback', () => {
  const now = 10000
  const gps = { speedKmh: 0, receivedAt: now - 1 }
  const vehicle = {
    source: 'vehicle-controller',
    isSimulated: false,
    parkingBrakeEngaged: true,
    speedKmh: 0,
    receivedAt: now - 1,
  }
  assert.equal(canPlayVideoSafely(gps, null, now), false)
  assert.equal(canPlayVideoSafely(null, vehicle, now), false)
  assert.equal(canPlayVideoSafely(gps, vehicle, now), true)
  assert.equal(canPlayVideoSafely({ ...gps, speedKmh: 1 }, vehicle, now), false)
  assert.equal(canPlayVideoSafely(gps, { ...vehicle, isSimulated: true }, now), false)
  assert.equal(canPlayVideoSafely(gps, { ...vehicle, parkingBrakeEngaged: false }, now), false)
  assert.equal(
    canPlayVideoSafely(
      { ...gps, receivedAt: now - MAX_GPS_SIGNAL_AGE_MS - 1 },
      vehicle,
      now,
    ),
    false,
  )
  assert.equal(
    canPlayVideoSafely(gps, { ...vehicle, receivedAt: now - MAX_VEHICLE_SIGNAL_AGE_MS - 1 }, now),
    false,
  )
})

const createRadioStation = (overrides = {}) => ({
  stationuuid: 'radio-uuid-1',
  name: 'Radio Prueba',
  url_resolved: 'https://radio.example/stream.mp3',
  homepage: 'https://radio.example/',
  favicon: 'https://radio.example/logo.png',
  country: 'Mexico',
  language: 'Spanish',
  tags: 'pop,latin',
  codec: 'MP3',
  bitrate: 128,
  lastcheckok: 1,
  lastcheckoktime_iso8601: '2026-11-04T20:00:00Z',
  ...overrides,
})

test('only normalizes recently checked, healthy, secure radio directory stations', () => {
  const now = Date.parse('2026-11-04T21:00:00Z')
  const station = normalizeRadioStation(createRadioStation(), { now, secureContext: true })
  assert.equal(station.name, 'Radio Prueba')
  assert.equal(station.country, 'Mexico')
  assert.equal(normalizeRadioStation(createRadioStation({ lastcheckok: 0 }), { now }), null)
  assert.equal(
    normalizeRadioStation(
      createRadioStation({ url_resolved: 'http://radio.example/stream.mp3' }),
      { now, secureContext: true },
    ),
    null,
  )
  assert.equal(
    normalizeRadioStation(
      createRadioStation({
        lastcheckoktime_iso8601: new Date(now - RADIO_CHECK_MAX_AGE_MS - 1).toISOString(),
      }),
      { now },
    ),
    null,
  )
  assert.equal(normalizeRadioStation(createRadioStation({ lastcheckoktime_iso8601: '' }), { now }), null)
})

test('radio search covers station name, country, genre and station categories', () => {
  const queryUrls = buildRadioSearchUrls('Mexico', 'all').map((url) => new URL(url))
  assert.deepEqual(
    queryUrls.map((url) => ['name', 'tag', 'country'].find((key) => url.searchParams.has(key))),
    ['name', 'tag', 'country'],
  )
  assert.ok(buildRadioSearchUrls('', 'rock').some((url) => new URL(url).searchParams.get('tag') === 'rock'))

  const stations = [
    { name: 'Pop Mexico', country: 'Mexico', language: 'Spanish', tags: ['pop', 'latin'] },
    { name: 'Rock UK', country: 'United Kingdom', language: 'English', tags: ['rock'] },
  ]
  assert.equal(filterRadioStations(stations, { query: 'mexico' }).length, 1)
  assert.equal(filterRadioStations(stations, { categoryId: 'rock' })[0].name, 'Rock UK')
})

test('radio favorites accept only saved HTTPS station URLs and tolerate invalid storage', () => {
  const station = { id: 'radio-uuid-1', name: 'Radio Prueba', streamUrl: 'https://radio.example/live' }
  assert.deepEqual(
    readRadioFavorites(JSON.stringify([station, { ...station, id: 'bad', streamUrl: 'javascript:alert(1)' }])),
    [station],
  )
  assert.deepEqual(readRadioFavorites('{bad json'), [])
  assert.deepEqual(readRadioFavorites(JSON.stringify({ station })), [])
})

test('radio stream probing confirms playback readiness and releases its audio resource', async () => {
  const listeners = new Map()
  let released = false
  const audio = {
    preload: '',
    src: '',
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
    removeAttribute: (name) => {
      if (name === 'src') {
        audio.src = ''
        released = true
      }
    },
    pause: () => {},
    play: () => {
      queueMicrotask(() => listeners.get('playing')?.())
      return Promise.resolve()
    },
    load: () => {
      if (audio.src) {
        queueMicrotask(() => listeners.get('canplay')?.())
      }
    },
  }
  const playable = await probeRadioStream(
    { streamUrl: 'https://radio.example/live' },
    { audioFactory: () => audio, timeoutMs: 100 },
  )
  assert.equal(playable, true)
  assert.equal(released, true)
})

test('radio stream probing rejects a failed stream and releases its audio resource', async () => {
  const listeners = new Map()
  let released = false
  const audio = {
    preload: '',
    src: '',
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
    removeAttribute: (name) => {
      if (name === 'src') {
        audio.src = ''
        released = true
      }
    },
    pause: () => {},
    play: () => Promise.resolve(),
    load: () => {
      if (audio.src) {
        queueMicrotask(() => listeners.get('error')?.())
      }
    },
  }
  const playable = await probeRadioStream(
    { streamUrl: 'https://radio.example/unavailable' },
    { audioFactory: () => audio, timeoutMs: 100 },
  )
  assert.equal(playable, false)
  assert.equal(released, true)
})
