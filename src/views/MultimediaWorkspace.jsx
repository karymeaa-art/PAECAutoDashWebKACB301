import { useEffect, useRef, useState } from 'react'
import {
  canPlayVideoSafely,
  parseSpotifyContent,
  getYouTubeVideoId,
  MAX_GPS_SIGNAL_AGE_MS,
} from './multimediaUtils'
import RadioWorkspace from './RadioWorkspace'
import './MultimediaWorkspace.css'

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY?.trim() || ''
let youtubeApiPromise

const loadYouTubeApi = () => {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReadyCallback = window.onYouTubeIframeAPIReady
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('No se pudo cargar YouTube IFrame Player API.'))
    window.onYouTubeIframeAPIReady = () => {
      previousReadyCallback?.()
      if (window.YT?.Player) {
        resolve(window.YT)
      } else {
        reject(new Error('YouTube IFrame Player API no está disponible.'))
      }
    }
    document.head.appendChild(script)
  }).catch((error) => {
    youtubeApiPromise = null
    throw error
  })

  return youtubeApiPromise
}

const getYouTubeErrorMessage = (code) => {
  const messages = {
    2: 'El identificador del video no es válido.',
    5: 'Este video no se puede reproducir en el reproductor HTML5.',
    100: 'El video no existe o ya no está disponible.',
    101: 'El propietario no permite reproducir este video en sitios externos.',
    150: 'El propietario no permite reproducir este video en sitios externos.',
    153: 'YouTube requiere información del cliente para reproducir este video.',
  }

  return messages[code] || `YouTube no pudo reproducir este video (código ${code}).`
}

function YouTubePlayer({ videoId, blocked, onError, onStatus }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const onErrorRef = useRef(onError)
  const onStatusRef = useRef(onStatus)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    onStatusRef.current = onStatus
  }, [onStatus])

  useEffect(() => {
    let active = true
    const host = hostRef.current

    if (!videoId || !host) {
      return undefined
    }

    onStatusRef.current('Cargando reproductor oficial...')
    loadYouTubeApi()
      .then((YT) => {
        if (!active) {
          return
        }

        const playerMount = document.createElement('div')
        host.appendChild(playerMount)
        playerRef.current = new YT.Player(playerMount, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: blocked ? 0 : 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (blocked) {
                event.target.cueVideoById(videoId)
                onStatusRef.current('Video cargado. La reproducción está bloqueada por seguridad.')
              } else {
                onStatusRef.current('Reproductor listo.')
              }
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING && blocked) {
                event.target.pauseVideo()
                onStatusRef.current('Bloqueado por seguridad.')
                return
              }

              const status = {
                [YT.PlayerState.PLAYING]: 'Reproduciendo',
                [YT.PlayerState.PAUSED]: 'En pausa',
                [YT.PlayerState.ENDED]: 'Video finalizado',
                [YT.PlayerState.BUFFERING]: 'Cargando video...',
              }[event.data]
              if (status) {
                onStatusRef.current(status)
              }
            },
            onError: (event) => {
              onErrorRef.current(getYouTubeErrorMessage(event.data))
              onStatusRef.current('Error de reproducción.')
            },
          },
        })
      })
      .catch((error) => {
        if (active) {
          onErrorRef.current(error.message)
        }
      })

    return () => {
      active = false
      playerRef.current?.destroy()
      playerRef.current = null
      host.replaceChildren()
    }
  }, [blocked, videoId])

  return (
    <div className="media-youtube-shell">
      <div className="media-youtube-player" ref={hostRef} />
      {blocked && (
        <div className="media-video-blocked media-video-blocked-overlay" role="status">
          <strong>Video bloqueado por seguridad. El vehículo está en movimiento</strong>
          <span>
            Se necesita GPS reciente y una señal independiente del controlador del vehículo con freno de estacionamiento.
            Sin ambas señales confiables, el video no se reproduce.
          </span>
        </div>
      )}
    </div>
  )
}

function MultimediaWorkspace() {
  const [activePlatform, setActivePlatform] = useState('spotify')
  const [spotifyInput, setSpotifyInput] = useState('')
  const [spotifyContent, setSpotifyContent] = useState(null)
  const [spotifyError, setSpotifyError] = useState('')
  const [spotifyStatus, setSpotifyStatus] = useState('')
  const [youtubeInput, setYoutubeInput] = useState('')
  const [youtubeVideo, setYoutubeVideo] = useState(null)
  const [youtubeError, setYoutubeError] = useState('')
  const [youtubeResults, setYoutubeResults] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchError, setSearchError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [gpsReading, setGpsReading] = useState(null)
  const [vehicleReading, setVehicleReading] = useState(null)
  const [gpsMessage, setGpsMessage] = useState(() => {
    if (typeof window === 'undefined' || !window.isSecureContext) {
      return 'La señal GPS requiere HTTPS.'
    }
    if (!navigator.geolocation) {
      return 'La geolocalización no está disponible en este navegador.'
    }
    return 'Esperando velocidad GPS directa...'
  })
  const [clock, setClock] = useState(() => Date.now())
  const [audioFiles, setAudioFiles] = useState([])
  const [activeAudioIndex, setActiveAudioIndex] = useState(0)
  const [videoFile, setVideoFile] = useState(null)
  const [localError, setLocalError] = useState('')
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [youtubePlayerStatus, setYoutubePlayerStatus] = useState('')
  const audioRef = useRef(null)
  const localVideoRef = useRef(null)
  const shouldResumeAudioRef = useRef(false)
  const searchControllerRef = useRef(null)

  const canPlayVideo = canPlayVideoSafely(gpsReading, vehicleReading, clock)
  const isVideoBlocked = !canPlayVideo

  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const handleVehicleSafety = (event) => {
      const signal = event.detail
      const receivedAt = Number(signal?.receivedAt)
      const speedKmh = Number(signal?.speedKmh)

      if (
        signal?.source !== 'vehicle-controller' ||
        signal?.isSimulated !== false ||
        signal?.parkingBrakeEngaged !== true ||
        !Number.isFinite(speedKmh) ||
        !Number.isFinite(receivedAt) ||
        Date.now() < receivedAt ||
        Date.now() - receivedAt > 1500
      ) {
        setVehicleReading(null)
        return
      }

      setVehicleReading({
        source: signal.source,
        isSimulated: signal.isSimulated,
        parkingBrakeEngaged: signal.parkingBrakeEngaged,
        speedKmh,
        receivedAt,
      })
    }

    window.addEventListener('autodash:vehicle-safety', handleVehicleSafety)
    return () => window.removeEventListener('autodash:vehicle-safety', handleVehicleSafety)
  }, [])

  useEffect(() => {
    if (!window.isSecureContext) {
      return undefined
    }

    if (!navigator.geolocation) {
      return undefined
    }

    const onPosition = (position) => {
      const accuracy = Number(position.coords?.accuracy)
      const speedMps = position.coords?.speed
      const receivedAt = Number(position.timestamp)

      if (
        !Number.isFinite(accuracy) ||
        accuracy > 50 ||
        !Number.isFinite(speedMps) ||
        speedMps < 0 ||
        !Number.isFinite(receivedAt) ||
        Date.now() - receivedAt > MAX_GPS_SIGNAL_AGE_MS
      ) {
        setGpsReading(null)
        setGpsMessage('Velocidad GPS directa desconocida o de baja precisión.')
        return
      }

      const speedKmh = speedMps * 3.6
      setGpsReading({ speedKmh, receivedAt })
      setGpsMessage(`Velocidad GPS directa: ${speedKmh.toFixed(1)} km/h`)
    }

    const onPositionError = (error) => {
      setGpsReading(null)
      setGpsMessage(
        error.code === 1
          ? 'Permiso de ubicación denegado; el video seguirá bloqueado.'
          : 'Señal GPS no disponible; el video seguirá bloqueado.',
      )
    }

    let watchId
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) {
        return
      }

      try {
        watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 5000,
        })
      } catch (error) {
        if (!cancelled) {
          setGpsMessage(`No se pudo iniciar el GPS: ${error.message}`)
        }
      }
    })

    return () => {
      cancelled = true
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [])

  useEffect(() => {
    if (isVideoBlocked) {
      localVideoRef.current?.pause()
    }
  }, [isVideoBlocked])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = volume
      if (shouldResumeAudioRef.current) {
        shouldResumeAudioRef.current = false
        audio.play().catch((error) => {
          setLocalError(`No se pudo continuar el audio: ${error.message}`)
        })
      }
    }
  }, [volume, activeAudioIndex])

  useEffect(
    () => () => {
      audioFiles.forEach((file) => URL.revokeObjectURL(file.url))
    },
    [audioFiles],
  )

  useEffect(
    () => () => {
      if (videoFile) {
        URL.revokeObjectURL(videoFile.url)
      }
    },
    [videoFile],
  )

  useEffect(
    () => () => {
      searchControllerRef.current?.abort()
    },
    [],
  )

  const handleSpotifyLoad = () => {
    const content = parseSpotifyContent(spotifyInput)
    if (!content) {
      setSpotifyContent(null)
      setSpotifyStatus('')
      setSpotifyError('Pega un enlace o URI válido de canción, álbum, playlist, episodio o programa de Spotify.')
      return
    }

    setSpotifyError('')
    setSpotifyStatus('Enlace válido. Cargando el reproductor oficial de Spotify…')
    setSpotifyContent(content)
  }

  const handleYouTubeSubmit = async (event) => {
    event.preventDefault()
    const videoId = getYouTubeVideoId(youtubeInput)
    if (!videoId) {
      setYoutubeVideo(null)
      setYoutubeError('Pega un enlace de YouTube compatible o un identificador de video de 11 caracteres.')
      return
    }

    setYoutubeError('')
    setYoutubePlayerStatus('')
    setYoutubeVideo({
      id: videoId,
      title: 'Video de YouTube',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    })

    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      )
      if (response.ok) {
        const metadata = await response.json()
        setYoutubeVideo((current) =>
          current?.id === videoId
            ? { ...current, title: metadata.title || current.title, thumbnail: metadata.thumbnail_url || current.thumbnail }
            : current,
        )
      }
    } catch {
      setYoutubeError('No se pudo cargar la información del video; se intentará reproducir el enlace directo.')
    }
  }

  const handleYouTubeSearch = async (event) => {
    event.preventDefault()
    if (!YOUTUBE_API_KEY) {
      setSearchError('La búsqueda requiere VITE_YOUTUBE_API_KEY. Puedes reproducir videos pegando un enlace o ID.')
      return
    }

    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setIsSearching(true)
    setSearchError('')

    try {
      const endpoint = new URL('https://www.googleapis.com/youtube/v3/search')
      endpoint.search = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: '8',
        q: searchQuery,
        key: YOUTUBE_API_KEY,
      }).toString()
      const response = await fetch(endpoint, { signal: controller.signal })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message || `YouTube Data API respondió HTTP ${response.status}.`)
      }

      setYoutubeResults(
        (data.items || [])
          .filter((item) => item.id?.videoId)
          .map((item) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          })),
      )
    } catch (error) {
      if (error.name !== 'AbortError') {
        setSearchError(`No se pudo buscar en YouTube: ${error.message}`)
      }
    } finally {
      if (searchControllerRef.current === controller) {
        searchControllerRef.current = null
        setIsSearching(false)
      }
    }
  }

  const selectYouTubeVideo = (video) => {
    setYoutubeVideo(video)
    setYoutubeInput(`https://www.youtube.com/watch?v=${video.id}`)
    setYoutubeError('')
    setYoutubePlayerStatus('')
    setActivePlatform('youtube')
  }

  const handleAudioSelection = (event) => {
    const selectedFiles = Array.from(event.target.files || []).filter(
      (file) => file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name),
    )
    setAudioFiles(selectedFiles.map((file) => ({ file, url: URL.createObjectURL(file) })))
    setActiveAudioIndex(0)
    shouldResumeAudioRef.current = false
    setLocalError(selectedFiles.length ? '' : 'No se seleccionaron archivos de audio compatibles.')
    setIsAudioPlaying(false)
    event.target.value = ''
  }

  const handleVideoSelection = (event) => {
    const file = event.target.files?.[0]
    if (!file || (!file.type.startsWith('video/') && !/\.(mp4|webm|ogv|mov|m4v|mkv)$/i.test(file.name))) {
      setVideoFile(null)
      setLocalError('Selecciona un archivo de video compatible.')
      return
    }

    setVideoFile({ file, url: URL.createObjectURL(file) })
    setLocalError('')
    event.target.value = ''
  }

  const handleAudioToggle = async () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (audio.paused) {
      try {
        await audio.play()
      } catch (error) {
        setLocalError(`No se pudo reproducir el audio: ${error.message}`)
      }
    } else {
      audio.pause()
    }
  }

  const skipAudio = (direction, resume = isAudioPlaying) => {
    if (!audioFiles.length) {
      return
    }

    shouldResumeAudioRef.current = resume
    setActiveAudioIndex((current) => (current + direction + audioFiles.length) % audioFiles.length)
    setLocalError('')
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const handleLocalVideoPlay = (event) => {
    if (isVideoBlocked) {
      event.currentTarget.pause()
      setLocalError('Video bloqueado por seguridad. El vehículo está en movimiento')
    }
  }

  return (
    <section className="multimedia-workspace">
      <header className="multimedia-heading">
        <div>
          <span className="chip chip-cyan">Centro multimedia</span>
          <h2>Entretenimiento a tu manera</h2>
          <p>Spotify y YouTube funcionan con sus reproductores oficiales. Los archivos locales no requieren cuenta.</p>
        </div>
        <div className={`media-gps-status ${canPlayVideo ? 'is-stopped' : 'is-locked'}`} role="status">
          <span className="media-gps-dot" />
          <span>{canPlayVideo ? 'Dos señales confiables confirman el vehículo detenido.' : gpsMessage}</span>
          {isVideoBlocked && (
            <small>
              Video bloqueado: requiere GPS reciente y una señal independiente del controlador del vehículo (0 km/h y freno activado).
            </small>
          )}
        </div>
      </header>

      <nav className="media-platform-tabs" aria-label="Plataformas multimedia">
        {[
          { id: 'spotify', label: 'Spotify', icon: '●' },
          { id: 'youtube', label: 'YouTube', icon: '▶' },
          { id: 'radio', label: 'Radio', icon: '◉' },
          { id: 'local', label: 'Archivos locales', icon: '♫' },
        ].map((platform) => (
          <button
            key={platform.id}
            type="button"
            className={activePlatform === platform.id ? 'media-platform-tab active' : 'media-platform-tab'}
            aria-pressed={activePlatform === platform.id}
            onClick={() => setActivePlatform(platform.id)}
          >
            <span aria-hidden="true">{platform.icon}</span>
            {platform.label}
          </button>
        ))}
      </nav>

      {activePlatform === 'spotify' && (
        <section className="media-platform-panel" aria-labelledby="spotify-title">
          <div className="media-panel-heading">
            <div>
              <span className="media-brand media-brand-spotify">Spotify</span>
              <h3 id="spotify-title">Escucha canciones, álbumes y playlists</h3>
              <p>Spotify Embed es el reproductor principal. Las playlists y álbumes conservan la lista oficial de canciones y sus controles.</p>
            </div>
          </div>
          <div className="media-link-form">
            <label className="media-field">
              <span>Enlace o URI de Spotify</span>
              <input
                type="text"
                value={spotifyInput}
                onChange={(event) => {
                  setSpotifyInput(event.target.value)
                  setSpotifyError('')
                  setSpotifyStatus('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSpotifyLoad()
                  }
                }}
                placeholder="Pega aquí el enlace compartido de Spotify"
                aria-label="Enlace o URI de Spotify"
                autoComplete="url"
              />
            </label>
            <button type="button" className="media-action-button" onClick={handleSpotifyLoad}>
              Cargar Spotify
            </button>
          </div>
          {spotifyError && <p className="media-error" role="alert">{spotifyError}</p>}
          {spotifyStatus && <p className="media-notice" role="status">{spotifyStatus}</p>}
          {spotifyContent ? (
            <>
              <div className={`media-embed-frame spotify-frame ${['playlist', 'album'].includes(spotifyContent.type) ? 'is-collection' : ''}`}>
                <iframe
                  key={spotifyContent.embedUrl}
                  title={`Reproductor oficial de Spotify: ${spotifyContent.type}`}
                  src={spotifyContent.embedUrl}
                  height={['playlist', 'album'].includes(spotifyContent.type) ? 560 : 352}
                  loading="eager"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <a
                className="media-spotify-link"
                href={spotifyContent.openUrl}
                target="_blank"
                rel="noreferrer"
              >
                {spotifyContent.type === 'playlist'
                  ? 'Abrir playlist completa en Spotify ↗'
                  : 'Abrir contenido completo en Spotify ↗'}
              </a>
              <div className="media-spotify-help">
                <span>
                  En playlists y álbumes, desplázate dentro del reproductor oficial para recorrer la lista y selecciona canciones desde allí. Spotify Free puede aplicar anuncios, reproducción aleatoria, vistas previas o pedir inicio de sesión según el contenido y la región.
                  {spotifyContent.type === 'playlist' && ' Spotify no expone en Embed los datos estructurados de cada álbum ni todas las portadas por separado; la lista y la portada disponibles se muestran en el reproductor oficial.'}
                  {' '}AutoDash no simula reproducción ni elimina estas restricciones.
                </span>
              </div>
            </>
          ) : (
            <div className="media-empty-state">
              <span className="media-empty-icon" aria-hidden="true">♫</span>
              <strong>Tu reproductor de Spotify aparecerá aquí</strong>
              <span>El acceso a la app es gratuito; Spotify puede limitar la reproducción según la cuenta, el contenido y la región.</span>
            </div>
          )}
        </section>
      )}

      {activePlatform === 'youtube' && (
        <section className="media-platform-panel" aria-labelledby="youtube-title">
          <div className="media-panel-heading">
            <div>
              <span className="media-brand media-brand-youtube">YouTube</span>
              <h3 id="youtube-title">Videos mediante el reproductor oficial</h3>
              <p>Puedes cargar cualquier enlace sin GPS ni API Key. La reproducción necesita las dos señales de seguridad.</p>
            </div>
          </div>
          <form className="media-link-form" onSubmit={handleYouTubeSubmit}>
            <label className="media-field">
              <span>Enlace o ID de video</span>
              <input
                type="text"
                value={youtubeInput}
                onChange={(event) => setYoutubeInput(event.target.value)}
                placeholder="https://youtu.be/... o ID de 11 caracteres"
                aria-label="Enlace o ID de video de YouTube"
              />
            </label>
            <button type="submit" className="media-action-button">Cargar video</button>
          </form>
          {youtubeError && <p className="media-error" role="alert">{youtubeError}</p>}

          <form className="media-search-form" onSubmit={handleYouTubeSearch}>
            <label className="media-field">
              <span>Buscar en YouTube {YOUTUBE_API_KEY ? '' : '(requiere API Key)'}</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Busca videos"
                disabled={!YOUTUBE_API_KEY || isSearching}
                aria-label="Buscar videos en YouTube"
              />
            </label>
            <button type="submit" className="media-secondary-button" disabled={!YOUTUBE_API_KEY || isSearching || !searchQuery.trim()}>
              {isSearching ? 'Buscando…' : 'Buscar'}
            </button>
          </form>
          {!YOUTUBE_API_KEY && (
            <p className="media-notice">
              Sin API Key, la búsqueda no está disponible; puedes cargar cualquier video pegando su enlace o ID.
              Una clave VITE_ se publica en el navegador; para producción, protégela con restricciones de Google o usa un backend.
            </p>
          )}
          {searchError && <p className="media-error" role="alert">{searchError}</p>}

          {youtubeResults.length > 0 && (
            <div className="media-youtube-results" aria-label="Resultados de búsqueda">
              {youtubeResults.map((video) => (
                <button key={video.id} type="button" className="media-result-card" onClick={() => selectYouTubeVideo(video)}>
                  {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" />}
                  <span>{video.title}</span>
                </button>
              ))}
            </div>
          )}

          {youtubeVideo ? (
            <div className="media-video-content">
              <div className="media-video-meta">
                {youtubeVideo.thumbnail && <img src={youtubeVideo.thumbnail} alt="" />}
                <div>
                  <strong>{youtubeVideo.title}</strong>
                  <span>YouTube · {youtubeVideo.id}{youtubePlayerStatus ? ` · ${youtubePlayerStatus}` : ''}</span>
                </div>
              </div>
              <YouTubePlayer
                key={youtubeVideo.id}
                videoId={youtubeVideo.id}
                blocked={isVideoBlocked}
                onError={setYoutubeError}
                onStatus={setYoutubePlayerStatus}
              />
            </div>
          ) : (
            <div className="media-empty-state">
              <span className="media-empty-icon" aria-hidden="true">▶</span>
              <strong>Elige un video para empezar</strong>
              <span>Algunos videos no permiten reproducción integrada; YouTube mostrará el motivo cuando esté disponible.</span>
            </div>
          )}
        </section>
      )}

      {activePlatform === 'radio' && <RadioWorkspace />}

      {activePlatform === 'local' && (
        <section className="media-platform-panel" aria-labelledby="local-title">
          <div className="media-panel-heading">
            <div>
              <span className="media-brand media-brand-local">En este dispositivo</span>
              <h3 id="local-title">Tus archivos, sin cuentas ni conexión</h3>
              <p>El audio puede seguir reproduciéndose durante el movimiento. Los videos requieren el vehículo detenido.</p>
            </div>
          </div>
          <div className="media-local-grid">
            <section className="media-local-card" aria-labelledby="local-audio-title">
              <div className="media-local-card-heading">
                <div><span className="media-local-icon" aria-hidden="true">♫</span><h4 id="local-audio-title">Música local</h4></div>
                <label className="media-file-button">
                  Añadir canciones
                  <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus" multiple onChange={handleAudioSelection} />
                </label>
              </div>
              {audioFiles.length > 0 ? (
                <>
                  <div className="media-audio-now-playing">
                    <strong>{audioFiles[activeAudioIndex]?.file.name}</strong>
                    <span>{audioFiles.length} {audioFiles.length === 1 ? 'canción' : 'canciones'} en la lista</span>
                  </div>
                  <audio
                    ref={audioRef}
                    src={audioFiles[activeAudioIndex]?.url}
                    controls
                    preload="metadata"
                    onPlay={() => setIsAudioPlaying(true)}
                    onPause={() => setIsAudioPlaying(false)}
                    onEnded={() => skipAudio(1, true)}
                    onError={() => setLocalError('No se pudo reproducir este archivo de audio; prueba otro formato compatible.')}
                  >
                    Tu navegador no admite audio HTML5.
                  </audio>
                  <div className="media-audio-actions">
                    <button type="button" className="media-secondary-button" onClick={() => skipAudio(-1)}>Anterior</button>
                    <button type="button" className="media-action-button" onClick={handleAudioToggle}>
                      {isAudioPlaying ? 'Pausar' : 'Reproducir'}
                    </button>
                    <button type="button" className="media-secondary-button" onClick={stopAudio}>Detener</button>
                    <button type="button" className="media-secondary-button" onClick={() => skipAudio(1)}>Siguiente</button>
                  </div>
                  <label className="media-volume-control">
                    Volumen
                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
                  </label>
                  <ol className="media-playlist">
                    {audioFiles.map((entry, index) => (
                      <li key={`${entry.file.name}-${entry.file.lastModified}-${index}`}>
                        <button
                          type="button"
                          className={activeAudioIndex === index ? 'active' : ''}
                          onClick={() => {
                            shouldResumeAudioRef.current = isAudioPlaying
                            setActiveAudioIndex(index)
                            setLocalError('')
                          }}
                        >
                          <span>{String(index + 1).padStart(2, '0')}</span>{entry.file.name}
                        </button>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <div className="media-empty-state media-empty-compact">
                  <strong>Selecciona canciones para crear una lista</strong>
                  <span>MP3, WAV, OGG, M4A y otros formatos que admita tu navegador.</span>
                </div>
              )}
            </section>

            <section className="media-local-card" aria-labelledby="local-video-title">
              <div className="media-local-card-heading">
                <div><span className="media-local-icon" aria-hidden="true">▣</span><h4 id="local-video-title">Video local</h4></div>
                <label className="media-file-button">
                  Elegir video
                  <input type="file" accept="video/*" onChange={handleVideoSelection} />
                </label>
              </div>
              {videoFile ? (
                <>
                  <div className="media-local-video-wrap">
                    <video
                      ref={localVideoRef}
                      src={videoFile.url}
                      controls={!isVideoBlocked}
                      playsInline
                      preload="metadata"
                      onPlay={handleLocalVideoPlay}
                      onError={() => setLocalError('No se pudo reproducir el video local; comprueba el formato del archivo.')}
                    />
                    {isVideoBlocked && (
                      <div className="media-video-blocked media-video-blocked-overlay" role="status">
                        <strong>Video bloqueado por seguridad. El vehículo está en movimiento</strong>
                        <span>Se requiere una señal GPS directa, reciente y de 0 km/h.</span>
                      </div>
                    )}
                  </div>
                  <p className="media-local-filename">{videoFile.file.name}</p>
                </>
              ) : (
                <div className="media-empty-state media-empty-compact">
                  <strong>Selecciona un video almacenado en el dispositivo</strong>
                  <span>El video se pausa y se bloquea si la velocidad no es cero o la señal GPS se pierde.</span>
                </div>
              )}
            </section>
          </div>
          {localError && <p className="media-error" role="alert">{localError}</p>}
        </section>
      )}
    </section>
  )
}

export default MultimediaWorkspace
