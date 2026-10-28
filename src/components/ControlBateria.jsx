import { useEffect, useState } from 'react'
import {
  DEFAULT_AUTONOMIA_KM,
  calculateBatteryEstimate,
  clampBatteryPercent,
} from './gpsLogic'

function ControlBateria({
  value = 100,
  onChange,
  tripDistanceKm = 0,
  onStartTrip,
  onEndTrip,
  tripActive = false,
  initialBattery = 100,
  autonomyKm = DEFAULT_AUTONOMIA_KM,
  onAutonomyChange,
}) {
  const [autonomyInput, setAutonomyInput] = useState(String(autonomyKm))

  useEffect(() => {
    setAutonomyInput(String(autonomyKm))
  }, [autonomyKm])

  const estimatedBattery = calculateBatteryEstimate(tripDistanceKm, autonomyKm, initialBattery)
  const safeValue = clampBatteryPercent(value ?? estimatedBattery.remainingPercent)
  const remainingPercent = clampBatteryPercent(estimatedBattery.remainingPercent)
  const batteryValue = Math.round(remainingPercent)

  let batteryMode = 'battery--high'
  if (batteryValue <= 20) {
    batteryMode = 'battery--low'
  } else if (batteryValue <= 50) {
    batteryMode = 'battery--medium'
  }

  const handleSaveAutonomy = () => {
    const parsedValue = Number(autonomyInput)

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setAutonomyInput(String(autonomyKm))
      return
    }

    onAutonomyChange?.(parsedValue)
  }

  return (
    <div className="battery-card">
      <div className="card-header">
        <span className="chip chip-green">Batería</span>
        <span key={batteryValue} className="battery-value" aria-live="polite" aria-atomic="true">
          {batteryValue}%
        </span>
      </div>

      <div className="battery-estimate-panel">
        <div className="battery-main-value">{batteryValue}%</div>
        <div className="battery-substats">
          <div>
            <span>Recorrido actual</span>
            <strong>{estimatedBattery.distanceKm.toFixed(2)} km</strong>
          </div>
          <div>
            <span>Consumo estimado</span>
            <strong>{estimatedBattery.consumedPercent.toFixed(1)}%</strong>
          </div>
          <div>
            <span>Autonomía restante</span>
            <strong>{estimatedBattery.remainingKm.toFixed(2)} km</strong>
          </div>
        </div>
      </div>

      <div className="autonomy-config-panel">
        <div className="autonomy-config-title">Configuración de autonomía</div>
        <div className="autonomy-config-row">
          <label htmlFor="autonomia-estimada">Autonomía estimada:</label>
          <div className="autonomy-config-input-wrap">
            <input
              id="autonomia-estimada"
              type="number"
              min="0.1"
              step="0.1"
              value={autonomyInput}
              onChange={(event) => setAutonomyInput(event.target.value)}
            />
            <span>km</span>
          </div>
        </div>
        <button type="button" className="primary-button" onClick={handleSaveAutonomy}>
          Guardar configuración
        </button>
      </div>

      <div className="autonomy-metric">
        <div>Autonomía configurada: <strong>{autonomyKm.toFixed(2)} km</strong></div>
        <div>Cada km representa aproximadamente <strong>{estimatedBattery.percentagePerKm}%</strong> de la autonomía configurada.</div>
      </div>

      <div className="battery-notice">
        El porcentaje de batería mostrado es una estimación basada en la autonomía configurada y la distancia recorrida. El consumo real puede variar dependiendo de la batería, motor, peso, velocidad, terreno y condiciones de conducción.
      </div>

      <div className={`battery-shell ${batteryMode}`}>
        <div className="battery-fill" style={{ width: `${batteryValue}%` }} />
      </div>

      <div className="battery-actions">
        <button type="button" className="primary-button" onClick={onStartTrip} disabled={tripActive}>
          {tripActive ? 'Recorrido activo' : 'Iniciar recorrido'}
        </button>
        <button type="button" className="ghost-button" onClick={onEndTrip} disabled={!tripActive}>
          Finalizar recorrido
        </button>
      </div>

      <label className="range-wrap" htmlFor="battery-range">
        <span>Carga de la celda</span>
        <input
          id="battery-range"
          type="range"
          min="0"
          max="100"
          step="1"
          value={safeValue}
          onChange={(event) => onChange?.(Number(event.target.value))}
        />
      </label>

      <div className="battery-meta">
        <span>Autonomía estimada actual: {autonomyKm.toFixed(2)} km</span>
      </div>
    </div>
  )
}

export default ControlBateria
