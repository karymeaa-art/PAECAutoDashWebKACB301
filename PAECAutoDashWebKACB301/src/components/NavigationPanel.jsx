import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { isMeaningfulPositionChange } from './gpsLogic'

const DEFAULT_DESTINATION = {
  name: 'Ubicación actual',
  latitude: -33.447487,
  longitude: -70.673676,
}

const vehicleIcon = L.divIcon({
  className: 'nav-map-pin nav-map-pin--vehicle',
  html: '<span />',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const destinationIcon = L.divIcon({
  className: 'nav-map-pin nav-map-pin--destination',
  html: '<span />',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const getBearing = (from, to) => {
  const lat1 = (from.latitude * Math.PI) / 180
  const lat2 = (to.latitude * Math.PI) / 180
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180

  const y = Math.sin(deltaLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)

  const bearing = (Math.atan2(y, x) * 180) / Math.PI
  return (bearing + 360) % 360
}

const getRouteDirectionFromPoints = (points) => {
  if (!Array.isArray(points) || points.length < 2) {
    return null
  }

  const from = { latitude: points[0][0], longitude: points[0][1] }
  const to = { latitude: points[1][0], longitude: points[1][1] }

  return getBearing(from, to)
}

const getCompassDirection = (degrees) => {
  if (degrees === null || Number.isNaN(degrees)) {
    return 'N'
  }

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(((degrees % 360) / 45)) % directions.length
  return directions[index]
}

const extractCoordinates = (value) => {
  if (!value || !value.trim()) {
    return null
  }

  const normalized = value.trim()
  const coordinateMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/)

  if (coordinateMatch) {
    const [, latitude, longitude] = coordinateMatch
    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
    }
  }

  return null
}

const formatDistance = (distanceKm) => {
  if (distanceKm === null || Number.isNaN(distanceKm)) {
    return 'Calculando...'
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`
  }

  return `${distanceKm.toFixed(1)} km`
}

const getDistanceBetweenPointsInMeters = (from, to) => {
  const earthRadius = 6371000
  const lat1 = (from.latitude * Math.PI) / 180
  const lat2 = (to.latitude * Math.PI) / 180
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

const buildDirectRoute = (from, to) => {
  if (!from || !to) {
    return []
  }

  return [
    [from.latitude, from.longitude],
    [to.latitude, to.longitude],
  ]
}

const buildRoadLikeFallbackRoute = (from, to) => {
  if (!from || !to) {
    return []
  }

  const startLat = from.latitude
  const startLng = from.longitude
  const endLat = to.latitude
  const endLng = to.longitude

  const angle = Math.atan2(endLat - startLat, endLng - startLng)
  const offset = 0.0045
  const offsetLat = Math.sin(angle + Math.PI / 2) * offset
  const offsetLng = Math.cos(angle + Math.PI / 2) * offset

  const midpointLat = (startLat + endLat) / 2 + offsetLat * 0.35
  const midpointLng = (startLng + endLng) / 2 + offsetLng * 0.35

  const bendLat = (startLat + endLat) / 2 + offsetLat * 0.9
  const bendLng = (startLng + endLng) / 2 + offsetLng * 0.9

  return [
    [startLat, startLng],
    [midpointLat, midpointLng],
    [bendLat, bendLng],
    [endLat, endLng],
  ]
}

const fetchDrivingRoute = async (from, to, signal) => {
  const endpoints = [
    `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&alternatives=false`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&alternatives=false`,
  ]

  let lastError = null

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        signal,
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const route = data?.routes?.[0]

      if (!route || !Array.isArray(route.geometry?.coordinates) || route.geometry.coordinates.length < 2) {
        throw new Error('Sin geometría de ruta válida')
      }

      return route
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('No se pudo calcular la ruta.')
}

const getDirectRouteEstimate = (from, to) => {
  const distanceKm = getDistanceBetweenPointsInMeters(from, to) / 1000
  const estimatedSpeed = 35
  const durationMinutes = Math.max(1, (distanceKm / estimatedSpeed) * 60)

  return {
    distanceKm,
    durationMinutes,
  }
}

const parseMaxSpeed = (value) => {
  if (!value || typeof value !== 'string') {
    return null
  }

  const normalized = value
    .toLowerCase()
    .replace(/kmh|kph|\s+/g, '')
    .replace(/[^0-9.;-]/g, '')

  if (!normalized) {
    return null
  }

  const candidates = normalized.split(';').map((part) => Number(part.trim())).filter((part) => Number.isFinite(part))

  if (candidates.length > 0) {
    return candidates[0]
  }

  return null
}

const getApproximateSpeedLimit = (maxspeedTag, highwayTag) => {
  const parsedValue = parseMaxSpeed(maxspeedTag)

  if (parsedValue) {
    return parsedValue
  }

  const defaultSpeeds = {
    motorway: 120,
    trunk: 100,
    primary: 80,
    secondary: 70,
    tertiary: 60,
    unclassified: 50,
    residential: 40,
    living_street: 20,
    service: 30,
    track: 20,
    road: 50,
  }

  if (!highwayTag) {
    return null
  }

  return defaultSpeeds[highwayTag.toLowerCase()] ?? null
}

const getFallbackSuggestedSpeed = (distanceKm, destinationName = '') => {
  const normalized = (destinationName || '').toLowerCase()
  const isHighwayTrip = /autopista|carretera|ruta|motorway|highway/i.test(normalized)

  if (distanceKm >= 35 || isHighwayTrip) {
    return 90
  }

  if (distanceKm >= 15) {
    return 75
  }

  if (distanceKm >= 6) {
    return 60
  }

  if (distanceKm >= 2) {
    return 45
  }

  return 35
}

const fetchSuggestedSpeedLimit = async ({ latitude, longitude }, destination, distanceKm = 0) => {
  if (!latitude || !longitude || !destination) {
    return getFallbackSuggestedSpeed(distanceKm, destination?.name || '')
  }

  const midpointLatitude = (latitude + destination.latitude) / 2
  const midpointLongitude = (longitude + destination.longitude) / 2
  const query = `[out:json][timeout:25];(way(around:250,${midpointLatitude},${midpointLongitude})["highway"];);out geom;`

  try {
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)

    if (!response.ok) {
      return getFallbackSuggestedSpeed(distanceKm, destination.name)
    }

    const data = await response.json()
    const elements = data?.elements || []

    for (const element of elements) {
      const tags = element.tags || {}
      const speedLimit = getApproximateSpeedLimit(tags.maxspeed, tags.highway)

      if (speedLimit) {
        return speedLimit
      }
    }
  } catch (error) {
    return getFallbackSuggestedSpeed(distanceKm, destination.name)
  }

  return getFallbackSuggestedSpeed(distanceKm, destination.name)
}

function MapFocus({ currentPosition, destinationPosition, routeCoordinates }) {
  const map = useMap()

  useEffect(() => {
    if (!currentPosition) {
      return
    }

    if (routeCoordinates.length > 1) {
      const bounds = routeCoordinates.length > 1 ? routeCoordinates : [[currentPosition.latitude, currentPosition.longitude]]
      if (destinationPosition) {
        bounds.push([destinationPosition.latitude, destinationPosition.longitude])
      }
      map.fitBounds(bounds, { padding: [30, 30] })
      return
    }

    map.setView([currentPosition.latitude, currentPosition.longitude], 14)
  }, [map, currentPosition, destinationPosition, routeCoordinates])

  return null
}

function MapDestinationPicker({ onSelect }) {
  useMapEvents({
    dblclick(event) {
      onSelect(event.latlng)
    },
  })

  return null
}

function NavigationPanel() {
  const fallbackCurrentPosition = {
    latitude: DEFAULT_DESTINATION.latitude,
    longitude: DEFAULT_DESTINATION.longitude,
    accuracy: 50,
    speed: 0,
    timestamp: Date.now(),
  }

  const [currentPosition, setCurrentPosition] = useState(fallbackCurrentPosition)
  const [destinationInput, setDestinationInput] = useState('Ubicación actual')
  const [destination, setDestination] = useState({
    name: 'Ubicación actual',
    latitude: DEFAULT_DESTINATION.latitude,
    longitude: DEFAULT_DESTINATION.longitude,
  })
  const [status, setStatus] = useState('Solicitando ubicación...')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [routeCoordinates, setRouteCoordinates] = useState([])
  const [distanceRemaining, setDistanceRemaining] = useState(null)
  const [etaMinutes, setEtaMinutes] = useState(null)
  const [bearing, setBearing] = useState(null)
  const [routeStatus, setRouteStatus] = useState('Calculando ruta...')
  const [liveSpeed, setLiveSpeed] = useState(0)
  const [accuracy, setAccuracy] = useState(null)
  const [suggestedSpeed, setSuggestedSpeed] = useState(42)
  const watchIdRef = useRef(null)
  const routeRequestIdRef = useRef(0)
  const lastRouteRequestRef = useRef(null)
  const hasManualDestinationRef = useRef(false)

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('Geolocalización no disponible')
      setError('El navegador no soporta geolocalización.')
      return undefined
    }

    const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost'

    if (!isSecureContext) {
      setStatus('HTTPS o localhost requerido')
      setError('La Geolocation API requiere HTTPS o localhost para funcionar correctamente.')
      return undefined
    }

    const handlePosition = (position) => {
      const nextPosition = {
        latitude: Number(position.coords.latitude),
        longitude: Number(position.coords.longitude),
        accuracy: Number(position.coords.accuracy) || 0,
        speed: Number(position.coords.speed) || 0,
        timestamp: position.timestamp,
      }

      setCurrentPosition(nextPosition)
      setDestination((previousDestination) => {
        if (previousDestination && previousDestination.name !== 'Ubicación actual') {
          return previousDestination
        }

        return {
          name: 'Ubicación actual',
          latitude: nextPosition.latitude,
          longitude: nextPosition.longitude,
        }
      })
      setDestinationInput((previousValue) => {
        if (hasManualDestinationRef.current) {
          return previousValue || 'Ubicación actual'
        }

        if (previousValue && previousValue.trim() && previousValue !== 'Ubicación actual') {
          return previousValue
        }

        return 'Ubicación actual'
      })
      setAccuracy(nextPosition.accuracy)
      setLiveSpeed(nextPosition.speed > 0 ? nextPosition.speed * 3.6 : 0)
      setStatus('GPS activo')
      setError('')
    }

    const handleError = (geoError) => {
      const messages = {
        1: 'Permiso de ubicación denegado. Activa la geolocalización para seguir la ruta.',
        2: 'GPS sin señal o servicio de ubicación no disponible.',
        3: 'Tiempo de espera agotado al obtener la ubicación.',
      }

      const fallbackPosition = {
        latitude: DEFAULT_DESTINATION.latitude,
        longitude: DEFAULT_DESTINATION.longitude,
        accuracy: 50,
        speed: 0,
        timestamp: Date.now(),
      }

      setCurrentPosition((previousPosition) => previousPosition || fallbackPosition)
      setDestination((previousDestination) => {
        if (previousDestination && previousDestination.name !== 'Ubicación actual') {
          return previousDestination
        }

        return {
          name: 'Ubicación actual',
          latitude: fallbackPosition.latitude,
          longitude: fallbackPosition.longitude,
        }
      })
      setStatus('Ubicación no disponible')
      setError(messages[geoError.code] || 'No se pudo obtener la ubicación actual.')
    }

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 10000,
    })

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  const routeCoordinatesForMap = useMemo(() => {
    if (!currentPosition || !destination) {
      return []
    }

    return routeCoordinates.length > 0 ? routeCoordinates : []
  }, [currentPosition, destination, routeCoordinates])

  const rhythmStatus =
    liveSpeed <= 2
      ? 'Detenido'
      : liveSpeed < suggestedSpeed * 0.8
        ? 'Reducir velocidad'
        : liveSpeed < suggestedSpeed * 1.25
          ? 'En ruta'
          : 'Flujo óptimo'

  const handleMapDestinationSelect = async (latlng) => {
    if (!latlng) {
      return
    }

    const latitude = Number(latlng.lat)
    const longitude = Number(latlng.lng)

    if (destination && currentPosition) {
      const distanceToSelectedDestination = getDistanceBetweenPointsInMeters(
        { latitude, longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
      )

      if (distanceToSelectedDestination < 25) {
        setDestination({
          name: 'Ubicación actual',
          latitude: currentPosition.latitude,
          longitude: currentPosition.longitude,
        })
        setDestinationInput('Ubicación actual')
        setSuggestions([])
        setError('')
        return
      }
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      )

      const placeData = response.ok ? await response.json() : null
      const placeName = placeData?.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`

      hasManualDestinationRef.current = true
      setDestination({
        name: placeName,
        latitude,
        longitude,
      })
      setDestinationInput(placeName)
      setSuggestions([])
      setError('')
    } catch (error) {
      setDestination({
        name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        latitude,
        longitude,
      })
      setDestinationInput(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
      setSuggestions([])
      setError('')
    }
  }

  const resolveDestination = async (query) => {
    const trimmed = (query || '').trim()

    if (!trimmed) {
      setError('Introduce un destino.')
      setSuggestions([])
      return
    }

    const parsedCoordinates = extractCoordinates(trimmed)

    if (parsedCoordinates) {
      hasManualDestinationRef.current = true
      setDestination({
        name: `${parsedCoordinates.latitude.toFixed(4)}, ${parsedCoordinates.longitude.toFixed(4)}`,
        latitude: parsedCoordinates.latitude,
        longitude: parsedCoordinates.longitude,
      })
      setDestinationInput(trimmed)
      setError('')
      setSuggestions([])
      return
    }

    try {
      setIsSearching(true)
      setError('')
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(trimmed)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      )

      if (!response.ok) {
        throw new Error('No se pudo buscar el destino.')
      }

      const data = await response.json()

      if (!data || data.length === 0) {
        setSuggestions([])
        throw new Error('Destino no encontrado. Intenta con otra dirección.')
      }

      const nextSuggestions = data.map((item) => ({
        label: item.display_name || item.name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      }))

      setSuggestions(nextSuggestions)

      const selected = nextSuggestions[0]
      hasManualDestinationRef.current = true
      setDestination({
        name: selected.label,
        latitude: selected.latitude,
        longitude: selected.longitude,
      })
      setDestinationInput(trimmed)
      setError('')
    } catch (searchError) {
      setError(searchError.message || 'No se pudo resolver el destino seleccionado.')
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    const trimmed = (destinationInput || '').trim()

    if (!trimmed || trimmed.length < 2) {
      setSuggestions([])
      return
    }

    const parsedCoordinates = extractCoordinates(trimmed)

    if (parsedCoordinates) {
      setSuggestions([])
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=4&q=${encodeURIComponent(trimmed)}`,
          {
            headers: {
              Accept: 'application/json',
            },
          },
        )

        if (!response.ok) {
          return
        }

        const data = await response.json()
        const nextSuggestions = (data || []).map((item) => ({
          label: item.display_name || item.name,
          latitude: Number(item.lat),
          longitude: Number(item.lon),
        }))

        setSuggestions(nextSuggestions)
      } catch (searchError) {
        setSuggestions([])
      }
    }, 350)

    return () => clearTimeout(timeoutId)
  }, [destinationInput])

  useEffect(() => {
    if (!currentPosition) {
      return
    }

    if (!destination) {
      return
    }

    if (
      Math.abs(currentPosition.latitude - destination.latitude) < 0.00001 &&
      Math.abs(currentPosition.longitude - destination.longitude) < 0.00001
    ) {
      setRouteCoordinates([
        [currentPosition.latitude, currentPosition.longitude],
        [destination.latitude + 0.0005, destination.longitude + 0.0005],
      ])
      setDistanceRemaining(0)
      setEtaMinutes(0)
      setBearing('N')
      setSuggestedSpeed(35)
      setRouteStatus('Destino actual')
      return
    }

    const hasMeaningfulChange =
      !lastRouteRequestRef.current ||
      lastRouteRequestRef.current.destination.latitude !== destination.latitude ||
      lastRouteRequestRef.current.destination.longitude !== destination.longitude ||
      isMeaningfulPositionChange(lastRouteRequestRef.current.position, currentPosition)

    if (!hasMeaningfulChange && routeCoordinates.length > 0) {
      return
    }

    const directRouteEstimate = getDirectRouteEstimate(currentPosition, destination)
    const directRoutePoints = buildDirectRoute(currentPosition, destination)

    setDistanceRemaining(directRouteEstimate.distanceKm)
    setEtaMinutes(directRouteEstimate.durationMinutes)
    setBearing(getCompassDirection(getBearing(currentPosition, destination)))
    setRouteCoordinates(directRoutePoints)
    setRouteStatus('Calculando ruta...')

    const requestId = routeRequestIdRef.current + 1
    routeRequestIdRef.current = requestId

    lastRouteRequestRef.current = {
      position: currentPosition,
      destination,
    }

    const fetchRoute = async () => {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 12000)

      try {
        const route = await fetchDrivingRoute(currentPosition, destination, controller.signal)
        const points = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        const remainingDistance = route.distance / 1000
        const remainingEta = route.duration / 60
        const routeHeading = getRouteDirectionFromPoints(points)
        const nextSuggestedSpeed = await fetchSuggestedSpeedLimit(currentPosition, destination, remainingDistance)

        if (routeRequestIdRef.current !== requestId) {
          return
        }

        setRouteCoordinates(points)
        setDistanceRemaining(remainingDistance)
        setEtaMinutes(remainingEta)
        setBearing(routeHeading !== null ? getCompassDirection(routeHeading) : null)
        setSuggestedSpeed(nextSuggestedSpeed)
        setRouteStatus('Ruta por carretera')
        setError('')
      } catch (routeError) {
        if (routeRequestIdRef.current !== requestId) {
          return
        }

        const fallbackRoute = getDirectRouteEstimate(currentPosition, destination)
        const fallbackPoints = buildRoadLikeFallbackRoute(currentPosition, destination)

        setRouteCoordinates(fallbackPoints.length > 0 ? fallbackPoints : buildDirectRoute(currentPosition, destination))
        setDistanceRemaining(fallbackRoute.distanceKm)
        setEtaMinutes(fallbackRoute.durationMinutes)
        setBearing(getCompassDirection(getBearing(currentPosition, destination)))
        setSuggestedSpeed(getFallbackSuggestedSpeed(fallbackRoute.distanceKm, destination?.name || ''))
        setRouteStatus('Ruta estimada por carretera')
        setError('La ruta principal no respondió; se muestra una aproximación viable para conducir.')
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    fetchRoute()
  }, [currentPosition, destination])

  const currentLocation = currentPosition
    ? {
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
      }
    : null

  const destinationPosition = destination
    ? {
        latitude: destination.latitude,
        longitude: destination.longitude,
      }
    : null

  const routeDistanceText = distanceRemaining === null ? 'Calculando...' : formatDistance(distanceRemaining)
  const routeEtaText = etaMinutes === null ? '—' : `${Math.max(1, Math.round(etaMinutes))} min`
  const routeHeadingText = bearing ? `${bearing} hacia ${destination?.name || 'Ubicación actual'}` : 'Calculando dirección...'
  const destinationLabel = destination?.name || 'Ubicación actual'

  return (
    <div className="section-mockup navigation-mockup">
      <div className="section-header">
        <span className="chip chip-cyan">Navegación</span>
      </div>

      <div className="navigation-controls">
        <label htmlFor="destination-input">Destino</label>
        <div className="navigation-input-row">
          <input
            id="destination-input"
            type="text"
            value={destinationInput}
            onChange={(event) => {
              hasManualDestinationRef.current = true
              setDestinationInput(event.target.value)
              setSuggestions([])
            }}
            placeholder="Ej. Campus Solar / Centro o -33.45, -70.67"
          />
          <button type="button" onClick={() => resolveDestination(destinationInput)}>
            {isSearching ? 'Buscando...' : 'Buscar destino'}
          </button>
        </div>

        {currentPosition && (
          <div className="navigation-suggestions" aria-label="Opción de destino actual">
            <button
              type="button"
              className="navigation-suggestion"
              onClick={() => {
                hasManualDestinationRef.current = false
                setDestinationInput('Ubicación actual')
                setDestination({
                  name: 'Ubicación actual',
                  latitude: currentPosition.latitude,
                  longitude: currentPosition.longitude,
                })
                setSuggestions([])
                setError('')
              }}
            >
              📍 Ubicación actual
            </button>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="navigation-suggestions" aria-label="Sugerencias de destino">
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
                type="button"
                className="navigation-suggestion"
                onClick={() => {
                  hasManualDestinationRef.current = true
                  setDestinationInput(suggestion.label)
                  setDestination({
                    name: suggestion.label,
                    latitude: suggestion.latitude,
                    longitude: suggestion.longitude,
                  })
                  setSuggestions([])
                  setError('')
                }}
              >
                📍 {suggestion.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="navigation-alert">{error}</div>}

      <div className="map-panel navigation-map-panel">
        {currentLocation ? (
          <MapContainer
            className="navigation-map"
            center={[currentLocation.latitude, currentLocation.longitude]}
            zoom={14}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapFocus
              currentPosition={currentLocation}
              destinationPosition={destinationPosition}
              routeCoordinates={routeCoordinatesForMap}
            />
            <MapDestinationPicker onSelect={handleMapDestinationSelect} />

            {currentLocation && (
              <Circle
                center={[currentLocation.latitude, currentLocation.longitude]}
                radius={accuracy || 20}
                pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.12 }}
              />
            )}

            {currentLocation && (
              <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={vehicleIcon}>
                <Popup>Ubicación actual</Popup>
              </Marker>
            )}

            {destinationPosition && (
              <Marker position={[destinationPosition.latitude, destinationPosition.longitude]} icon={destinationIcon}>
                <Popup>{destinationLabel}</Popup>
              </Marker>
            )}

            {routeCoordinatesForMap.length > 1 && (
              <>
                <Polyline pathOptions={{ color: '#020b16', weight: 10, opacity: 1 }} positions={routeCoordinatesForMap} />
                <Polyline pathOptions={{ color: '#2dd4bf', weight: 6, opacity: 1 }} positions={routeCoordinatesForMap} />
              </>
            )}
          </MapContainer>
        ) : (
          <div className="navigation-map placeholder-map">
            <p>{status}</p>
          </div>
        )}

        <div className="route-card">
          <p>Destino</p>
          <strong>{destinationLabel}</strong>
          <span>
            {routeDistanceText} · {routeEtaText}
          </span>
          <small>{routeStatus}</small>
        </div>
      </div>

      <div className="route-summary navigation-summary">
        <div>
          <small>Vel. sugerida</small>
          <strong>{suggestedSpeed} km/h</strong>
        </div>
        <div>
          <small>Ritmo</small>
          <strong>{rhythmStatus}</strong>
        </div>
      </div>

      <div className="navigation-meta">
        <div>
          <span>Distancia restante</span>
          <strong>{routeDistanceText}</strong>
        </div>
        <div>
          <span>Tiempo estimado</span>
          <strong>{routeEtaText}</strong>
        </div>
        <div>
          <span>Dirección</span>
          <strong>{routeHeadingText}</strong>
        </div>
      </div>
    </div>
  )
}

export default NavigationPanel
