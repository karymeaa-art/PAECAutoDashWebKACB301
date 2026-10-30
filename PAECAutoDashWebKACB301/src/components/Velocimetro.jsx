import { useEffect, useRef, useState } from 'react'

import { resolverVelocidadDesdePosicion } from './gpsLogic'

const MIN_SPEED = 0
const MAX_SPEED = 120
const DEFAULT_STEP = 5
const GAUGE_START_ANGLE = 180
const GAUGE_END_ANGLE = 0
const GAUGE_RANGE = GAUGE_START_ANGLE - GAUGE_END_ANGLE

const clampSpeed = (value) => {
  if (!Number.isFinite(value)) {
    return MIN_SPEED
  }

  return Math.max(MIN_SPEED, Math.min(value, MAX_SPEED))
}

const clampGaugeAngle = (angle) => {
  const minAngle = Math.min(GAUGE_START_ANGLE, GAUGE_END_ANGLE)
  const maxAngle = Math.max(GAUGE_START_ANGLE, GAUGE_END_ANGLE)

  return Math.max(minAngle, Math.min(angle, maxAngle))
}

const normalizeSpeed = (value) => clampSpeed(Number(value) || 0)

const toRadians = (degrees) => (degrees * Math.PI) / 180

const haversineDistanceMeters = (from, to) => {
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

function Velocimetro({ onSpeedChange, onDistanceSample }) {
  const [speed, setSpeed] = useState(0)
  const [stepValue, setStepValue] = useState(DEFAULT_STEP)
  const [geoStatus, setGeoStatus] = useState('Buscando GPS...')
  const [gpsAccuracy, setGpsAccuracy] = useState(null)
  const [gpsSource, setGpsSource] = useState('GPS')
  const [gpsCoords, setGpsCoords] = useState({ latitude: null, longitude: null })
  const [speedHistory, setSpeedHistory] = useState([8, 12, 15, 18, 22, 26, 24, 20, 18, 15, 12, 10])
  const previousPositionRef = useRef(null)
  const distancePositionRef = useRef(null)
  const smoothedSamplesRef = useRef([])

  useEffect(() => {
    const isSecure = typeof window !== 'undefined' && window.isSecureContext

    if (!isSecure) {
      setGeoStatus('HTTPS requerido')
      setGpsSource('N/A')
      setGpsAccuracy(null)
      previousPositionRef.current = null
      distancePositionRef.current = null
      smoothedSamplesRef.current = []
      return undefined
    }

    if (!navigator.geolocation) {
      setGeoStatus('Geolocalización no disponible')
      setGpsSource('N/A')
      setGpsAccuracy(null)
      previousPositionRef.current = null
      distancePositionRef.current = null
      smoothedSamplesRef.current = []
      return undefined
    }

    const handlePosition = (position) => {
      const accuracy = Number(position?.coords?.accuracy)
      const coords = {
        latitude: Number(position?.coords?.latitude),
        longitude: Number(position?.coords?.longitude),
      }
      const previousPosition = previousPositionRef.current
      const nextVelocity = resolverVelocidadDesdePosicion(position, previousPosition)

      setGpsCoords(coords)
      setGpsAccuracy(Number.isFinite(accuracy) ? accuracy : null)

      if (accuracy > 50) {
        setGeoStatus('GPS baja precisión')
        return
      }

      let nextSpeedKmh = nextVelocity.speedKmh
      const source = nextVelocity.source

      if (!Number.isFinite(nextSpeedKmh) || nextSpeedKmh < 0) {
        nextSpeedKmh = 0
      }

      if (nextSpeedKmh < 1) {
        nextSpeedKmh = 0
      }

      let distanceSampleKm = 0
      const distancePosition = distancePositionRef.current

      if (
        distancePosition &&
        Number.isFinite(distancePosition.latitude) &&
        Number.isFinite(distancePosition.longitude) &&
        Number.isFinite(coords.latitude) &&
        Number.isFinite(coords.longitude)
      ) {
        const deltaMeters = haversineDistanceMeters(distancePosition, coords)
        const deltaKm = deltaMeters / 1000

        if (deltaKm > 0.002 && deltaKm < 3) {
          distanceSampleKm = deltaKm
          distancePositionRef.current = coords
        } else if (deltaKm >= 3) {
          distancePositionRef.current = coords
        }
      } else {
        distancePositionRef.current = coords
      }

      smoothedSamplesRef.current = [...smoothedSamplesRef.current, nextSpeedKmh].slice(-5)
      const averagedSpeed =
        smoothedSamplesRef.current.reduce((sum, value) => sum + value, 0) / smoothedSamplesRef.current.length
      const finalSpeed = clampSpeed(averagedSpeed)

      setSpeed(finalSpeed)
      setSpeedHistory((previous) => [...previous, finalSpeed].slice(-12))
      setGpsSource(source)
      setGeoStatus('GPS conectado')
      previousPositionRef.current = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp: position.timestamp,
      }
      onSpeedChange?.(finalSpeed)
      onDistanceSample?.({ distanceKm: distanceSampleKm, timestamp: position.timestamp, coords })
    }

    const handleError = (error) => {
      const message =
        error?.code === 1
          ? 'Permiso de ubicación requerido'
          : error?.code === 2
            ? 'GPS sin señal'
            : error?.code === 3
              ? 'Tiempo de espera GPS agotado'
              : 'GPS sin señal'

      setGeoStatus(message)
      setGpsSource('GPS')
      setGpsAccuracy(null)
      previousPositionRef.current = null
      distancePositionRef.current = null
      smoothedSamplesRef.current = []
    }

    const watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 5000,
    })

    return () => navigator.geolocation.clearWatch(watchId)
  }, [onSpeedChange])

  const updateSpeed = (nextValue) => {
    const parsed = Number(nextValue)
    const safeValue = normalizeSpeed(parsed)
    setSpeed(safeValue)
    setSpeedHistory((previous) => [...previous, safeValue].slice(-12))
    onSpeedChange?.(safeValue)
  }

  const adjustSpeed = (delta) => {
    updateSpeed(speed + delta)
  }

  const handleStepChange = (nextValue) => {
    const parsed = Number(nextValue)

    if (!Number.isFinite(parsed) || parsed < 1) {
      setStepValue(1)
      return
    }

    setStepValue(Math.min(parsed, 20))
  }

  const gaugeRadius = 150
  const gaugeCenterX = 180
  const gaugeCenterY = 190

  const polarToCartesian = (cx, cy, radius, angleInDegrees) => {
    const radians = (angleInDegrees * Math.PI) / 180

    return {
      x: cx + radius * Math.cos(radians),
      y: cy - radius * Math.sin(radians),
    }
  }

  const tickValues = Array.from({ length: 25 }, (_, index) => {
    const value = (MAX_SPEED / 24) * index
    const normalized = clampSpeed(value)
    const angle = 180 - (normalized / MAX_SPEED) * 180
    const radius = gaugeRadius
    const tickStart = polarToCartesian(gaugeCenterX, gaugeCenterY, radius - 4, angle)
    const tickEnd = polarToCartesian(gaugeCenterX, gaugeCenterY, radius - 22, angle)

    return {
      value: normalized,
      angle,
      tickStart,
      tickEnd,
      isMajor: normalized % 20 === 0,
    }
  })

  const majorLabelValues = [0, 20, 40, 60, 80, 100, 120]
  const clampedSpeed = clampSpeed(speed)
  const progress = (clampedSpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)
  const angle = 180 - progress * 180
  const gaugeRotation = clampGaugeAngle(angle)

  const needleLength = 108
  const needleRadians = (gaugeRotation * Math.PI) / 180
  const needleX = gaugeCenterX + needleLength * Math.cos(needleRadians)
  const needleY = gaugeCenterY - needleLength * Math.sin(needleRadians)
  const gaugeProgressValue = Math.max(0, Math.min(1000, progress * 1000))
  const chartPaddingX = 14
  const chartPaddingY = 10
  const chartWidth = 280
  const chartHeight = 110
  const chartInnerWidth = chartWidth - chartPaddingX * 2
  const chartInnerHeight = chartHeight - chartPaddingY * 2

  const chartPoints = speedHistory
    .map((value, index) => {
      const x = chartPaddingX + index * (chartInnerWidth / Math.max(speedHistory.length - 1, 1))
      const safeValue = Math.max(value, 8)
      const y = chartHeight - chartPaddingY - (safeValue / MAX_SPEED) * (chartInnerHeight - 6)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="speed-card">
      <div className="card-header">
        <span className="chip">Velocímetro</span>
        <span className="status-indicator">{geoStatus}</span>
      </div>

      <div className="speed-gauge-shell" aria-label={`Velocidad actual de ${Math.round(speed)} kilómetros por hora`}>
        <svg className="speed-gauge-svg" viewBox="0 0 360 240" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="gauge-progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="40%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          <path className="speed-gauge-track" d="M 30 190 A 150 150 0 0 1 330 190" pathLength="1000" />
          <path
            className="speed-gauge-progress"
            d="M 30 190 A 150 150 0 0 1 330 190"
            pathLength="1000"
            strokeDasharray={`${gaugeProgressValue} 1000`}
          />

          {tickValues.map(({ value, tickStart, tickEnd, isMajor }) => (
            <line
              key={`tick-${value}`}
              className={`speed-gauge-tick ${isMajor ? 'is-major' : ''}`}
              x1={tickStart.x}
              y1={tickStart.y}
              x2={tickEnd.x}
              y2={tickEnd.y}
            />
          ))}

          {majorLabelValues.map((value) => {
            const labelAngle = 180 - (value / MAX_SPEED) * 180
            const labelPoint = polarToCartesian(gaugeCenterX, gaugeCenterY, gaugeRadius + 12, labelAngle)

            return (
              <text
                key={`label-${value}`}
                className="speed-gauge-label"
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {value}
              </text>
            )
          })}

          <line className="speed-gauge-needle" x1={gaugeCenterX} y1={gaugeCenterY} x2={needleX} y2={needleY} />
          <circle className="speed-gauge-center" cx={gaugeCenterX} cy={gaugeCenterY} r="11" />
          <circle className="speed-gauge-center-glow" cx={gaugeCenterX} cy={gaugeCenterY} r="18" />
        </svg>

        <div className="speed-readout-overlay">
          <span className="speed-value">{Math.round(clampedSpeed)}</span>
          <span className="speed-unit">km/h</span>
        </div>
      </div>

      {geoStatus === 'HTTPS requerido' && (
        <div className="speed-gps-debug">
          <div>
            <span>Contexto seguro:</span>
            <strong>HTTPS requerido</strong>
          </div>
          <div>
            <span>Solución:</span>
            <strong>Abre la versión HTTPS de AutoDash Web</strong>
          </div>
        </div>
      )}
    </div>
  )
}

export default Velocimetro
