const toRadians = (degrees) => (degrees * Math.PI) / 180

export const haversineDistanceMeters = (from, to) => {
  const earthRadius = 6371000
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const startLatitude = toRadians(from.latitude)
  const endLatitude = toRadians(to.latitude)

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const isMeaningfulPositionChange = (previousPosition, nextPosition) => {
  if (!previousPosition || !nextPosition) {
    return true
  }

  const hasPreviousCoords =
    Number.isFinite(previousPosition.latitude) && Number.isFinite(previousPosition.longitude)
  const hasNextCoords = Number.isFinite(nextPosition.latitude) && Number.isFinite(nextPosition.longitude)

  if (!hasPreviousCoords || !hasNextCoords) {
    return true
  }

  return haversineDistanceMeters(previousPosition, nextPosition) > 1
}

export const resolverVelocidadDesdePosicion = (position, previousPosition) => {
  const rawSpeedMps = Number(position?.coords?.speed)
  const currentCoords = {
    latitude: Number(position?.coords?.latitude),
    longitude: Number(position?.coords?.longitude),
  }
  const hasCurrentCoords =
    Number.isFinite(currentCoords.latitude) && Number.isFinite(currentCoords.longitude)
  const hasPreviousCoords =
    previousPosition &&
    Number.isFinite(previousPosition.latitude) &&
    Number.isFinite(previousPosition.longitude)

  let calculatedSpeedKmh = 0

  if (hasPreviousCoords && hasCurrentCoords) {
    const elapsedMs = position.timestamp - previousPosition.timestamp

    if (elapsedMs > 0 && isMeaningfulPositionChange(previousPosition, currentCoords)) {
      const distanceMeters = haversineDistanceMeters(previousPosition, currentCoords)
      const elapsedSeconds = elapsedMs / 1000
      const speedMps = distanceMeters / elapsedSeconds

      if (Number.isFinite(speedMps) && speedMps >= 0) {
        calculatedSpeedKmh = speedMps * 3.6
      }
    }
  }

  if (Number.isFinite(rawSpeedMps) && rawSpeedMps > 0) {
    const speedKmh = rawSpeedMps * 3.6
    return {
      speedKmh: Number.isFinite(speedKmh) ? Math.max(0, Number(speedKmh.toFixed(1))) : 0,
      source: 'GPS',
    }
  }

  if (Number.isFinite(calculatedSpeedKmh) && calculatedSpeedKmh > 0) {
    return {
      speedKmh: Number.isFinite(calculatedSpeedKmh)
        ? Math.max(0, Number(calculatedSpeedKmh.toFixed(1)))
        : 0,
      source: 'GPS + cálculo',
    }
  }

  if (Number.isFinite(rawSpeedMps) && rawSpeedMps >= 0) {
    const speedKmh = rawSpeedMps * 3.6
    return {
      speedKmh: Number.isFinite(speedKmh) ? Math.max(0, Number(speedKmh.toFixed(1))) : 0,
      source: 'GPS',
    }
  }

  return { speedKmh: 0, source: 'GPS' }
}

export const obtenerVelocidadGPS = (position, previousPosition) =>
  resolverVelocidadDesdePosicion(position, previousPosition)

export const DEFAULT_AUTONOMIA_KM = 10
export const STORAGE_AUTONOMIA_KEY = 'autodash-autonomia-estimada'

export const normalizeAutonomyKm = (value, fallback = DEFAULT_AUTONOMIA_KM) => {
  const normalizedValue = Number(value)

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    return fallback
  }

  return normalizedValue
}

export const getStoredAutonomyKm = (fallback = DEFAULT_AUTONOMIA_KM) => {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const storedValue = localStorage.getItem(STORAGE_AUTONOMIA_KEY)

    if (!storedValue) {
      return fallback
    }

    const parsedValue = Number(JSON.parse(storedValue))
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
  } catch {
    return fallback
  }
}

export const saveStoredAutonomyKm = (value, fallback = DEFAULT_AUTONOMIA_KM) => {
  const safeValue = normalizeAutonomyKm(value, fallback)

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_AUTONOMIA_KEY, JSON.stringify(safeValue))
  }

  return safeValue
}

export const clampDistanceKm = (value) => {
  const numericValue = Number(value) || 0
  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.max(0, numericValue)
}

export const clampBatteryPercent = (value) => {
  const numericValue = Number(value) || 0
  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.max(0, Math.min(100, numericValue))
}

export const calculateDistanceKm = (from, to) => {
  if (!from || !to) {
    return 0
  }

  const fromLatitude = Number(from.latitude)
  const fromLongitude = Number(from.longitude)
  const toLatitude = Number(to.latitude)
  const toLongitude = Number(to.longitude)

  if (!Number.isFinite(fromLatitude) || !Number.isFinite(fromLongitude) || !Number.isFinite(toLatitude) || !Number.isFinite(toLongitude)) {
    return 0
  }

  const distanceMeters = haversineDistanceMeters(
    { latitude: fromLatitude, longitude: fromLongitude },
    { latitude: toLatitude, longitude: toLongitude },
  )

  const distanceKm = distanceMeters / 1000

  if (distanceKm <= 0.002) {
    return 0
  }

  return Number(Math.min(distanceKm, 3).toFixed(2))
}

export const calculateBatteryEstimate = (distanceKm, autonomyKm = DEFAULT_AUTONOMIA_KM, initialBattery = 100) => {
  const safeAutonomyKm = normalizeAutonomyKm(autonomyKm, DEFAULT_AUTONOMIA_KM)
  const safeDistanceKm = clampDistanceKm(distanceKm)
  const safeInitialBattery = clampBatteryPercent(initialBattery)
  const percentagePerKm = 100 / safeAutonomyKm
  const consumedPercent = (safeDistanceKm / safeAutonomyKm) * 100
  const safeConsumedPercent = Math.min(safeInitialBattery, consumedPercent)
  const remainingPercent = safeInitialBattery - safeConsumedPercent
  const remainingKm = (remainingPercent / 100) * safeAutonomyKm

  return {
    autonomyKm: Number(safeAutonomyKm.toFixed(2)),
    percentagePerKm: Number(percentagePerKm.toFixed(2)),
    distanceKm: Number(safeDistanceKm.toFixed(2)),
    consumedPercent: Number(safeConsumedPercent.toFixed(1)),
    remainingPercent: Number(remainingPercent.toFixed(1)),
    remainingKm: Number(remainingKm.toFixed(2)),
  }
}
