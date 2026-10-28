import { useEffect, useState } from 'react'

const API_KEY = 'bfdd8362aa363a66e622500e40863ea5'

function ClimaApi() {
  const [weather, setWeather] = useState({
    city: 'Localizando clima...',
    temp: null,
    description: 'Esperando ubicación',
    icon: '',
    conditionId: 800,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeather((previous) => ({
        ...previous,
        city: 'GPS no disponible',
        temp: null,
        description: 'No se pudo obtener ubicación',
      }))
      return undefined
    }

    const getWeather = async (latitude, longitude) => {
      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&lang=es&appid=${API_KEY}`,
        )

        if (!response.ok) {
          throw new Error('Respuesta no válida de OpenWeatherMap')
        }

        const data = await response.json()
        const parsedTemp = Number(data.main?.temp)

        setWeather({
          city: data.name || 'Ubicación actual',
          temp: Number.isFinite(parsedTemp) ? parsedTemp : null,
          description: data.weather?.[0]?.description ?? 'Sin descripción',
          icon: data.weather?.[0]?.icon || '01d',
          conditionId: data.weather?.[0]?.id ?? 800,
        })
      } catch (error) {
        setWeather((previous) => ({
          ...previous,
          city: 'Clima fuera de línea',
          temp: null,
          description: 'Sin datos meteorológicos',
        }))
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        getWeather(latitude, longitude)
      },
      () => {
        setWeather((previous) => ({
          ...previous,
          city: 'GPS sin señal',
          temp: null,
          description: 'No se pudo acceder a la ubicación',
        }))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      },
    )

    return undefined
  }, [])

  const isOptimalSolar = weather.conditionId >= 800 && weather.conditionId <= 802
  const bannerText = isOptimalSolar
    ? '☀️ Condición Óptima para Carga Solar'
    : '☁️ Radiación Reducida (Carga Limitada)'

  return (
    <div className="climate-card">
      <div className="card-header">
        <span className="chip chip-cyan">Clima + GPS</span>
      </div>

      <div className="weather-row">
        <div>
          <p className="weather-city">{weather.city}</p>
          <p className="weather-temp">
            {weather.temp === null ? 'Sin datos' : `${Math.round(weather.temp)}°C`}
          </p>
        </div>

        {weather.icon ? (
          <img
            className="weather-icon"
            src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
            alt={weather.description}
          />
        ) : (
          <div className="weather-icon placeholder">☀️</div>
        )}
      </div>

      <p className="weather-description">{weather.description}</p>

      <div className={`weather-banner ${isOptimalSolar ? 'weather-banner--good' : 'weather-banner--warning'}`}>
        {bannerText}
      </div>
    </div>
  )
}

export default ClimaApi
