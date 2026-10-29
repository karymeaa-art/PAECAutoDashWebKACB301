import { useEffect, useState } from 'react'
import Velocimetro from '../components/Velocimetro'
import ClimaApi from '../components/ClimaApi'
import ControlBateria from '../components/ControlBateria'
import HistorialConsumo from '../components/HistorialConsumo'
import {
  DEFAULT_AUTONOMIA_KM,
  calculateBatteryEstimate,
  getStoredAutonomyKm,
  saveStoredAutonomyKm,
} from '../components/gpsLogic'

const TRIP_HISTORY_KEY = 'autodash-trip-history'
const TOTAL_MILEAGE_KEY = 'autodash-total-mileage'
const TRIP_STATE_KEY = 'autodash-trip-state'

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
  const [batteryLevel, setBatteryLevel] = useState(100)
  const [tripHistory, setTripHistory] = useState([])
  const [totalMileageKm, setTotalMileageKm] = useState(0)
  const [currentTripDistanceKm, setCurrentTripDistanceKm] = useState(0)
  const [tripActive, setTripActive] = useState(false)
  const [tripStartAt, setTripStartAt] = useState(null)
  const [tripInitialBattery, setTripInitialBattery] = useState(100)
  const [estimatedAutonomyKm, setEstimatedAutonomyKm] = useState(() => getStoredAutonomyKm())

  useEffect(() => {
    setTripHistory(readJson(TRIP_HISTORY_KEY, []))
    setTotalMileageKm(Number(readJson(TOTAL_MILEAGE_KEY, 0) || 0))
    setEstimatedAutonomyKm(getStoredAutonomyKm(DEFAULT_AUTONOMIA_KM))

    const storedTripState = readJson(TRIP_STATE_KEY, null)
    if (storedTripState?.active) {
      setTripActive(true)
      setTripStartAt(storedTripState.startAt || null)
      setTripInitialBattery(Number(storedTripState.initialBattery ?? 100))
      setCurrentTripDistanceKm(Number(storedTripState.distanceKm || 0))
    }
  }, [])

  useEffect(() => {
    saveStoredAutonomyKm(estimatedAutonomyKm, DEFAULT_AUTONOMIA_KM)
  }, [estimatedAutonomyKm])

  useEffect(() => {
    localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(tripHistory))
  }, [tripHistory])

  useEffect(() => {
    localStorage.setItem(TOTAL_MILEAGE_KEY, JSON.stringify(Number(totalMileageKm || 0).toFixed(2)))
  }, [totalMileageKm])

  useEffect(() => {
    localStorage.setItem(
      TRIP_STATE_KEY,
      JSON.stringify({
        active: tripActive,
        startAt: tripStartAt,
        initialBattery: tripInitialBattery,
        distanceKm: Number(currentTripDistanceKm || 0).toFixed(2),
      }),
    )
  }, [tripActive, tripStartAt, tripInitialBattery, currentTripDistanceKm])

  const handleDistanceSample = ({ distanceKm }) => {
    if (!tripActive || !Number.isFinite(distanceKm) || distanceKm <= 0) {
      return
    }

    setCurrentTripDistanceKm((previousDistance) => Number((previousDistance + distanceKm).toFixed(6)))
  }

  const startTrip = () => {
    const startDate = new Date()
    setTripActive(true)
    setTripStartAt(startDate.toISOString())
    setTripInitialBattery(batteryLevel)
    setCurrentTripDistanceKm(0)
  }

  const finishTrip = () => {
    if (!tripActive) {
      return
    }

    const endDate = new Date()
    const startDate = tripStartAt ? new Date(tripStartAt) : endDate
    const distanceKm = Number(currentTripDistanceKm || 0)
    const batteryEstimate = calculateBatteryEstimate(distanceKm, estimatedAutonomyKm, tripInitialBattery)
    const todayLabel = formatDateLabel(endDate)
    const durationMs = Math.max(0, endDate.getTime() - startDate.getTime())
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000))

    const record = {
      id: Date.now(),
      date: `${todayLabel}`,
      startTime: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      durationMinutes,
      distanceKm: Number(distanceKm.toFixed(2)),
      initialBattery: Number(tripInitialBattery || 100),
      autonomyKm: Number(estimatedAutonomyKm || DEFAULT_AUTONOMIA_KM),
      percentPerKm: Number(batteryEstimate.percentagePerKm.toFixed(2)),
      consumedPercent: Number(batteryEstimate.consumedPercent.toFixed(1)),
      remainingPercent: Number(batteryEstimate.remainingPercent.toFixed(1)),
    }

    const updatedHistory = [record, ...tripHistory]
    const newTotalMileage = Number((totalMileageKm + distanceKm).toFixed(2))

    setTripHistory(updatedHistory)
    setTotalMileageKm(newTotalMileage)
    setCurrentTripDistanceKm(0)
    setTripActive(false)
    setTripStartAt(null)
    setTripInitialBattery(100)
    setBatteryLevel(record.remainingPercent)
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
