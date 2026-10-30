const parseHistoryDate = (value) => {
  if (typeof value !== 'string') {
    return new Date(value)
  }

  const dayFirstMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dayFirstMatch) {
    return new Date(Number(dayFirstMatch[3]), Number(dayFirstMatch[2]) - 1, Number(dayFirstMatch[1]))
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
  }

  return new Date(value)
}

function HistorialConsumo({
  tripHistory = [],
  totalMileageKm = 0,
  tripCount = 0,
  currentTripDistanceKm = 0,
  onClearHistory,
  onResetMileage,
  onResetBoth,
}) {
  const totalDistanceDay = tripHistory
    .filter((entry) => {
      const date = parseHistoryDate(entry.date)
      const now = new Date()
      return date.toDateString() === now.toDateString()
    })
    .reduce((sum, entry) => sum + Number(entry.distanceKm || 0), 0)

  const totalDistanceWeek = tripHistory
    .filter((entry) => {
      const entryDate = parseHistoryDate(entry.date)
      const now = new Date()
      const diffDays = (now - entryDate) / (1000 * 60 * 60 * 24)
      return diffDays >= 0 && diffDays <= 7
    })
    .reduce((sum, entry) => sum + Number(entry.distanceKm || 0), 0)

  const totalDistanceMonth = tripHistory
    .filter((entry) => {
      const entryDate = parseHistoryDate(entry.date)
      const now = new Date()
      const diffMonths =
        (now.getFullYear() - entryDate.getFullYear()) * 12 +
        (now.getMonth() - entryDate.getMonth())
      return diffMonths >= 0 && diffMonths <= 1
    })
    .reduce((sum, entry) => sum + Number(entry.distanceKm || 0), 0)

  return (
    <div className="history-card">
      <div className="card-header history-header">
        <span className="chip chip-green">Historial</span>
      </div>

      <div className="mileage-summary-grid">
        <div className="mileage-stat">
          <span>Kilometraje total</span>
          <strong>{Number(totalMileageKm || 0).toFixed(2)} km</strong>
        </div>
        <div className="mileage-stat">
          <span>Recorridos</span>
          <strong>{tripCount}</strong>
        </div>
        <div className="mileage-stat">
          <span>Recorrido actual</span>
          <strong>{Number(currentTripDistanceKm || 0).toFixed(2)} km</strong>
        </div>
      </div>

      <div className="mileage-summary-grid compact">
        <div className="mileage-stat small">
          <span>Hoy</span>
          <strong>{totalDistanceDay.toFixed(2)} km</strong>
        </div>
        <div className="mileage-stat small">
          <span>Semana</span>
          <strong>{totalDistanceWeek.toFixed(2)} km</strong>
        </div>
        <div className="mileage-stat small">
          <span>Mes</span>
          <strong>{totalDistanceMonth.toFixed(2)} km</strong>
        </div>
      </div>

      <div className="history-list">
        {tripHistory.length === 0 ? (
          <p className="history-empty">Sin recorridos registrados aún.</p>
        ) : (
          tripHistory.slice(0, 6).map((entry) => (
            <div key={entry.id} className="history-item">
              <div className="history-item__meta">
                <span>#{entry.id}</span>
                <span>{entry.date}</span>
              </div>
              <div className="history-item__values">
                <strong>{Number(entry.distanceKm || 0).toFixed(2)} km</strong>
                <span>{Number(entry.consumedPercent || 0).toFixed(1)}% consumo</span>
                <span>{Number(entry.remainingPercent || 0).toFixed(1)}% restante</span>
              </div>
              <div className="history-item__meta">
                <span>Autonomía: {Number(entry.autonomyKm || 10).toFixed(2)} km</span>
                <span>{Number(entry.percentPerKm || 0).toFixed(2)}%/km</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="history-actions-row">
        <button type="button" className="ghost-button" onClick={onResetMileage}>
          Reiniciar kilometraje
        </button>
        <button type="button" className="ghost-button" onClick={onClearHistory}>
          Borrar historial
        </button>
        <button type="button" className="ghost-button danger" onClick={onResetBoth}>
          Reiniciar ambos
        </button>
      </div>
    </div>
  )
}

export default HistorialConsumo
