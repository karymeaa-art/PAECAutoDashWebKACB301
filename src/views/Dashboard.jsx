import { useCallback, useEffect, useRef, useState } from 'react'
import Velocimetro from '../components/Velocimetro'
import ClimaApi from '../components/ClimaApi'
import ControlBateria from '../components/ControlBateria'
import HistorialConsumo from '../components/HistorialConsumo'
import {
  DEFAULT_AUTONOMIA_KM,
  calculateBatteryEstimate,
  clampBatteryPercent,
  getStoredAutonomyKm,
  saveStoredAutonomyKm,
} from '../components/gpsLogic'

const TRIP_HISTORY_KEY = 'autodash-trip-history'
const TOTAL_MILEAGE_KEY = 'autodash-total-mileage'
const TRIP_STATE_KEY = 'autodash-trip-state'
const BATTERY_LEVEL_KEY = 'autodash-battery-level'

const readJson = (key, fallback) => {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch {
    return fallback
  }
}

const formatDateLabel = (date) =>
  new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)

function Dashboard() {
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [batteryLevel, setBatteryLevel] = useState(() =>
    clampBatteryPercent(readJson(BATTERY_LEVEL_KEY, 100)),
  )
  const [tripHistory, setTripHistory] = useState(() => {
    const storedHistory = readJson(TRIP_HISTORY_KEY, [])
    if (!Array.isArray(storedHistory)) {
      return []
    }

    const seenIds = new Set()
    return storedHistory.filter((entry) => {
      const distanceKm = Number(entry?.distanceKm)
      if (!entry || !Number.isFinite(distanceKm) || distanceKm <= 0) {
        return false
      }

      if (entry.id !== undefined && seenIds.has(entry.id)) {
        return false
      }

      if (entry.id !== undefined) {
        seenIds.add(entry.id)
      }
      return true
    })
  })
  const [totalMileageKm, setTotalMileageKm] = useState(() => {
    const storedMileage = Number(readJson(TOTAL_MILEAGE_KEY, 0))
    return Number.isFinite(storedMileage) ? Math.max(0, storedMileage) : 0
  })
  const [storedTripState] = useState(() => readJson(TRIP_STATE_KEY, null))
  const [currentTripDistanceKm, setCurrentTripDistanceKm] = useState(() => {
    const storedDistance = Number(storedTripState?.distanceKm || 0)
    return Number.isFinite(storedDistance) ? Math.max(0, storedDistance) : 0
  })
  const [tripActive, setTripActive] = useState(() => Boolean(storedTripState?.active))
  const [tripStartAt, setTripStartAt] = useState(() => {
    const storedStartAt = Date.parse(storedTripState?.startAt)
    return Number.isFinite(storedStartAt) ? new Date(storedStartAt).toISOString() : null
  })
  const [tripInitialBattery, setTripInitialBattery] = useState(() =>
    clampBatteryPercent(storedTripState?.initialBattery ?? batteryLevel),
  )
  const [estimatedAutonomyKm, setEstimatedAutonomyKm] = useState(() => getStoredAutonomyKm())
  const tripActiveRef = useRef(Boolean(storedTripState?.active))

  useEffect(() => {
    saveStoredAutonomyKm(estimatedAutonomyKm, DEFAULT_AUTONOMIA_KM)
  }, [estimatedAutonomyKm])

  useEffect(() => {
    localStorage.setItem(BATTERY_LEVEL_KEY, JSON.stringify(clampBatteryPercent(batteryLevel)))
  }, [batteryLevel])

  useEffect(() => {
    localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(tripHistory))
  }, [tripHistory])

  useEffect(() => {
    localStorage.setItem(TOTAL_MILEAGE_KEY, JSON.stringify(Number(totalMileageKm || 0).toFixed(6)))
  }, [totalMileageKm])

  useEffect(() => {
    localStorage.setItem(
      TRIP_STATE_KEY,
      JSON.stringify({
        active: tripActive,
        startAt: tripStartAt,
        initialBattery: tripInitialBattery,
        distanceKm: Number(currentTripDistanceKm || 0).toFixed(6),
      }),
    )
  }, [tripActive, tripStartAt, tripInitialBattery, currentTripDistanceKm])

  const handleDistanceSample = useCallback(({ distanceKm }) => {
    if (!tripActiveRef.current || !Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm >= 3) {
      return
    }

    setCurrentTripDistanceKm((previousDistance) => Number((previousDistance + distanceKm).toFixed(6)))
  }, [])

  const startTrip = () => {
    if (tripActiveRef.current) {
      return
    }

    const startDate = new Date()
    tripActiveRef.current = true
    setTripActive(true)
    setTripStartAt(startDate.toISOString())
    setTripInitialBattery(batteryLevel)
    setCurrentTripDistanceKm(0)
  }

  const finishTrip = () => {
    if (!tripActiveRef.current) {
      return
    }

    tripActiveRef.current = false
    const endDate = new Date()
    const startDate = tripStartAt ? new Date(tripStartAt) : endDate
    const distanceKm = Number.isFinite(currentTripDistanceKm) ? Math.max(0, currentTripDistanceKm) : 0
    const batteryEstimate = calculateBatteryEstimate(distanceKm, estimatedAutonomyKm, tripInitialBattery)
    const todayLabel = formatDateLabel(endDate)
    const durationMs = Math.max(0, endDate.getTime() - startDate.getTime())
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000))

    if (distanceKm > 0) {
      const record = {
        id: Date.now(),
        date: `${todayLabel}`,
        startTime: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        endTime: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        durationMinutes,
        distanceKm: Number(distanceKm.toFixed(6)),
        initialBattery: Number(tripInitialBattery || 100),
        autonomyKm: Number(estimatedAutonomyKm || DEFAULT_AUTONOMIA_KM),
        percentPerKm: Number(batteryEstimate.percentagePerKm.toFixed(2)),
        consumedPercent: Number(batteryEstimate.consumedPercent.toFixed(1)),
        remainingPercent: Number(batteryEstimate.remainingPercent.toFixed(1)),
      }

      setTripHistory((history) => [record, ...history.filter((entry) => entry.id !== record.id)])
      setTotalMileageKm((mileage) => Number((mileage + distanceKm).toFixed(6)))
    }

    setCurrentTripDistanceKm(0)
    setTripActive(false)
    setTripStartAt(null)
    setTripInitialBattery(batteryEstimate.remainingPercent)
    setBatteryLevel(batteryEstimate.remainingPercent)
  }

  const handleResetMileage = () => {
    if (!window.confirm('¿Estás seguro de que deseas reiniciar el kilometraje? Esta acción eliminará el kilometraje acumulado.')) {
      return
    }

    setTotalMileageKm(0)
  }

  const handleClearHistory = () => {
    if (!window.confirm('¿Estás seguro de que deseas borrar el historial de recorridos?')) {
      return
    }

    setTripHistory([])
  }

  const handleResetBoth = () => {
    if (!window.confirm('¿Estás seguro de que deseas reiniciar el kilometraje y borrar el historial?')) {
      return
    }

    setTotalMileageKm(0)
    setTripHistory([])
  }

  return (
    <div className="dashboard-grid">
      <article className="card speed-panel">
        <Velocimetro onSpeedChange={setCurrentSpeed} onDistanceSample={handleDistanceSample} />
      </article>

      <article className="card climate-panel">
        <ClimaApi />
      </article>

      <article className="card battery-panel">
        <ControlBateria
          value={batteryLevel}
          onChange={setBatteryLevel}
          tripDistanceKm={currentTripDistanceKm}
          tripActive={tripActive}
          initialBattery={tripInitialBattery}
          onStartTrip={startTrip}
          onEndTrip={finishTrip}
          autonomyKm={estimatedAutonomyKm}
          onAutonomyChange={setEstimatedAutonomyKm}
        />
      </article>

      <article className="card history-panel">
        <HistorialConsumo
          tripHistory={tripHistory}
          totalMileageKm={totalMileageKm}
          tripCount={tripHistory.length}
          currentTripDistanceKm={currentTripDistanceKm}
          onClearHistory={handleClearHistory}
          onResetMileage={handleResetMileage}
          onResetBoth={handleResetBoth}
        />
      </article>
    </div>
  )
}

export default Dashboard
