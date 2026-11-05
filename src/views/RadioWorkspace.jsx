import { useEffect, useRef, useState } from 'react'
import {
  buildRadioSearchUrls,
  filterRadioStations,
  normalizeRadioStation,
  probeRadioStream,
  RADIO_BROWSER_API,
  RADIO_CATEGORIES,
  RADIO_FAVORITES_KEY,
  readRadioFavorites,
} from './radioUtils'

const RADIO_SEARCH_LIMIT = 12
const RADIO_PROBE_BATCH_SIZE = 4

function readSavedFavorites() {
  try {
    return readRadioFavorites(window.localStorage.getItem(RADIO_FAVORITES_KEY))
  } catch (error) {
    console.error('No se pudieron leer los favoritos de radio.', error)
    return []
  }
}

function RadioWorkspace() {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [stations, setStations] = useState([])
  const [favorites, setFavorites] = useState(readSavedFavorites)
  const [currentStation, setCurrentStation] = useState(null)
  const [connectionState, setConnectionState] = useState('idle')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [radioError, setRadioError] = useState('')
  const [volume, setVolume] = useState(0.75)
  const [brokenLogos, setBrokenLogos] = useState([])
  const audioRef = useRef(null)
  const searchControllerRef = useRef(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  useEffect(
    () => () => {
      searchControllerRef.current?.abort()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
      }
    },
    [],
  )

  const searchStations = async (event, nextCategory = categoryId) => {
    event?.preventDefault()
    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setIsSearching(true)
    setSearchError('')
    setRadioError('')
    setStations([])

    try {
      const endpoints = buildRadioSearchUrls(query, nextCategory)
      const responses = await Promise.all(
        endpoints.map((url) => fetch(url, { signal: controller.signal })),
      )
      const stationLists = await Promise.all(
        responses.map((response) => {
          if (!response.ok) {
            throw new Error(`El directorio de radio respondió HTTP ${response.status}.`)
          }
          return response.json()
        }),
      )
      const seen = new Set()
      const candidates = stationLists
        .flat()
        .map((station) => normalizeRadioStation(station, { secureContext: window.isSecureContext }))
        .filter((station) => {
          if (!station || seen.has(station.id)) {
            return false
          }
          seen.add(station.id)
          return true
        })
      const filtered = filterRadioStations(candidates, { query, categoryId: nextCategory }).slice(0, 12)

      if (!filtered.length) {
        setSearchError('No se encontraron emisoras con una comprobación reciente y un enlace de audio seguro.')
        return
      }

      const verified = []
      for (let offset = 0; offset < filtered.length && verified.length < RADIO_SEARCH_LIMIT; offset += RADIO_PROBE_BATCH_SIZE) {
        const batch = filtered.slice(offset, offset + RADIO_PROBE_BATCH_SIZE)
        const results = await Promise.all(
          batch.map(async (station) => ({
            station,
            playable: await probeRadioStream(station, { signal: controller.signal }),
          })),
        )

        if (controller.signal.aborted) {
          return
        }

        verified.push(...results.filter((result) => result.playable).map((result) => result.station))
      }

      if (!controller.signal.aborted) {
        setStations(verified)
        if (!verified.length) {
          setSearchError('El directorio encontró emisoras, pero ninguna transmisión pudo confirmarse como reproducible ahora.')
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setSearchError(`No se pudo buscar emisoras: ${error.message}`)
      }
    } finally {
      if (searchControllerRef.current === controller) {
        searchControllerRef.current = null
        setIsSearching(false)
      }
    }
  }

  const toggleFavorite = (station) => {
    const exists = favorites.some((favorite) => favorite.id === station.id)
    const nextFavorites = exists
      ? favorites.filter((favorite) => favorite.id !== station.id)
      : [station, ...favorites]

    try {
      window.localStorage.setItem(RADIO_FAVORITES_KEY, JSON.stringify(nextFavorites))
      setFavorites(nextFavorites)
      setRadioError('')
    } catch (error) {
      setRadioError(`No se pudo guardar el favorito en este dispositivo: ${error.message}`)
    }
  }

  const playStation = async (station) => {
    const audio = audioRef.current
    if (!audio) {
      setRadioError('El reproductor de radio no está disponible en este navegador.')
      return
    }

    setRadioError('')
    if (currentStation?.id === station.id && !audio.paused) {
      audio.pause()
      return
    }

    if (currentStation?.id !== station.id) {
      audio.pause()
      audio.src = station.streamUrl
      audio.load()
      setCurrentStation(station)
      setConnectionState('connecting')
    }

    try {
      await audio.play()
    } catch (error) {
      setConnectionState('error')
      setRadioError(
        `No se pudo reproducir ${station.name}: ${error.message}. Prueba otra emisora o revisa tu conexión.`,
      )
    }
  }

  const stopRadio = () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    setCurrentStation(null)
    setConnectionState('idle')
    setRadioError('')
  }

  const matchingFavorites = filterRadioStations(favorites, { query, categoryId })
  const isPlaying = connectionState === 'playing'

  return (
    <section className="media-platform-panel radio-panel" aria-labelledby="radio-title">
      <div className="media-panel-heading">
        <div>
          <span className="media-brand media-brand-radio">Radio en directo</span>
          <h3 id="radio-title">Emisoras de internet</h3>
          <p>Directorio Radio Browser. Solo mostramos enlaces seguros revisados recientemente y transmisiones que el navegador logra abrir.</p>
        </div>
      </div>

      <form className="media-link-form" onSubmit={(event) => searchStations(event)}>
        <label className="media-field">
          <span>Buscar por emisora, género o país</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. pop, rock, México, noticias"
            aria-label="Buscar emisoras por nombre, género o país"
          />
        </label>
        <button type="submit" className="media-action-button" disabled={isSearching}>
          {isSearching ? 'Verificando…' : 'Buscar emisoras'}
        </button>
      </form>

      <div className="radio-category-list" aria-label="Categorías de radio">
        {RADIO_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={categoryId === category.id ? 'radio-category active' : 'radio-category'}
            aria-pressed={categoryId === category.id}
            onClick={() => {
              setCategoryId(category.id)
              searchStations(undefined, category.id)
            }}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className={`radio-now-playing ${isPlaying ? 'is-playing' : ''}`} role="status" aria-live="polite">
        <div className="radio-now-icon" aria-hidden="true">{isPlaying ? '◖))' : '◉'}</div>
        <div className="radio-now-meta">
          <strong>{currentStation?.name || 'Ninguna emisora seleccionada'}</strong>
          <span>
            {connectionState === 'playing'
              ? 'En directo'
              : connectionState === 'connecting'
                ? 'Conectando a la transmisión…'
                : connectionState === 'error'
                  ? 'Transmisión no disponible'
                  : 'Radio lista'}
            {currentStation ? ` · ${currentStation.country}` : ''}
          </span>
        </div>
        <button
          type="button"
          className="media-secondary-button"
          onClick={stopRadio}
          disabled={!currentStation}
        >
          Detener
        </button>
      </div>
      <audio
        ref={audioRef}
        preload="none"
        onCanPlay={() => setConnectionState((state) => state === 'error' ? state : 'connected')}
        onPlaying={() => {
          setConnectionState('playing')
          setRadioError('')
        }}
        onPause={() =>
          setConnectionState((state) =>
            state === 'playing' || state === 'connected' ? 'paused' : state,
          )
        }
        onWaiting={() => setConnectionState((state) => state === 'error' ? state : 'connecting')}
        onError={() => {
          setConnectionState('error')
          setRadioError('La transmisión se desconectó o su formato no es compatible. Prueba otra emisora.')
        }}
      >
        Tu navegador no admite audio HTML5.
      </audio>

      <label className="media-volume-control radio-volume">
        Volumen
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-label="Volumen de la radio"
        />
      </label>

      {searchError && <p className="media-error" role="alert">{searchError}</p>}
      {radioError && <p className="media-error" role="alert">{radioError}</p>}

      <section className="radio-station-section" aria-labelledby="radio-results-title">
        <div className="radio-section-heading">
          <h4 id="radio-results-title">Emisoras disponibles</h4>
          {stations.length > 0 && <span>{stations.length} transmisiones verificadas</span>}
        </div>
        {isSearching ? (
          <div className="media-empty-state media-empty-compact" role="status">
            <strong>Buscando y comprobando transmisiones…</strong>
            <span>El listado espera tanto la verificación reciente del directorio como la respuesta de audio del navegador.</span>
          </div>
        ) : stations.length > 0 ? (
          <div className="radio-station-grid">
            {stations.map((station) => {
              const isFavorite = favorites.some((favorite) => favorite.id === station.id)
              const hasLogo = station.logo && !brokenLogos.includes(station.id)
              const active = currentStation?.id === station.id
              return (
                <article key={station.id} className={`radio-station-card ${active ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="radio-station-play"
                    onClick={() => playStation(station)}
                    aria-label={`${active && isPlaying ? 'Pausar' : 'Reproducir'} ${station.name}`}
                  >
                    {hasLogo ? (
                      <img
                        src={station.logo}
                        alt=""
                        loading="lazy"
                        onError={() => setBrokenLogos((previous) => [...previous, station.id])}
                      />
                    ) : (
                      <span className="radio-station-placeholder" aria-hidden="true">◉</span>
                    )}
                    <span className="radio-station-details">
                      <strong>{station.name}</strong>
                      <span>{station.tags.slice(0, 3).join(' · ') || station.codec}</span>
                      <span>{station.country}{station.bitrate ? ` · ${station.bitrate} kbps` : ''}</span>
                    </span>
                    <span className="radio-station-play-icon" aria-hidden="true">
                      {active && isPlaying ? 'Ⅱ' : '▶'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`radio-favorite-button ${isFavorite ? 'active' : ''}`}
                    onClick={() => toggleFavorite(station)}
                    aria-label={`${isFavorite ? 'Quitar de' : 'Agregar a'} favoritos: ${station.name}`}
                    aria-pressed={isFavorite}
                  >
                    {isFavorite ? '♥' : '♡'}
                  </button>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="media-empty-state media-empty-compact">
            <strong>Busca emisoras para escuchar radio en directo</strong>
            <span>Filtramos transmisiones caídas, sin HTTPS o que el navegador no puede abrir.</span>
          </div>
        )}
      </section>

      {matchingFavorites.length > 0 && (
        <section className="radio-station-section" aria-labelledby="radio-favorites-title">
          <div className="radio-section-heading">
            <h4 id="radio-favorites-title">Tus favoritos</h4>
            <span>Guardados en este dispositivo</span>
          </div>
          <div className="radio-favorites-list">
            {matchingFavorites.map((station) => (
              <div key={station.id} className="radio-favorite-row">
                <span>♥</span>
                <strong>{station.name}</strong>
                <small>{station.country}</small>
                <button type="button" className="media-secondary-button" onClick={() => playStation(station)}>
                  Reproducir
                </button>
                <button
                  type="button"
                  className="radio-favorite-remove"
                  onClick={() => toggleFavorite(station)}
                  aria-label={`Quitar ${station.name} de favoritos`}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="radio-attribution">
        Directorio comunitario: <a href="https://www.radio-browser.info/" target="_blank" rel="noreferrer">Radio Browser</a>.
        Cada emisora conserva sus propios derechos y condiciones. La disponibilidad puede cambiar y depende de la conexión, el formato y las restricciones del emisor.
      </p>
      <p className="radio-attribution">
        <span className={`radio-connection-dot ${connectionState}`} />
        {connectionState === 'playing'
          ? 'Conectado y reproduciendo'
          : connectionState === 'connecting'
            ? 'Intentando conectar'
            : connectionState === 'error'
              ? 'Emisora desconectada'
              : connectionState === 'paused'
                ? 'En pausa'
                : `Directorio: ${RADIO_BROWSER_API}`}
      </p>
    </section>
  )
}

export default RadioWorkspace
