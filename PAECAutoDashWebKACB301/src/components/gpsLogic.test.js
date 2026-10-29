import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateBatteryEstimate,
  calculateDistanceKm,
  isMeaningfulPositionChange,
  normalizeAutonomyKm,
  obtenerVelocidadGPS,
  resolverVelocidadDesdePosicion,
} from './gpsLogic.js'

test('ignora lecturas repetidas de la misma posición para no congelar la velocidad', () => {
  const previousPosition = { latitude: 19.4326, longitude: -99.1332 }
  const samePosition = { latitude: 19.4326, longitude: -99.1332 }

  assert.equal(isMeaningfulPositionChange(previousPosition, samePosition), false)
})

test('usa velocidad calculada cuando el GPS reporta 0 pero hubo desplazamiento', () => {
  const position = {
    timestamp: 2000,
    coords: {
      latitude: 19.4326,
      longitude: -99.1332,
      speed: 0,
    },
  }

  const previousPosition = {
    timestamp: 0,
    latitude: 19.43261,
    longitude: -99.1332,
  }

  const result = obtenerVelocidadGPS(position, previousPosition)

  assert.equal(result.source, 'GPS + cálculo')
  assert.ok(result.speedKmh > 0)
})

test('devuelve la velocidad directa del GPS cuando es válida', () => {
  const result = obtenerVelocidadGPS(
    {
      timestamp: 1000,
      coords: { latitude: 19.4326, longitude: -99.1332, speed: 10 },
    },
    {
      timestamp: 0,
      latitude: 19.4326,
      longitude: -99.1332,
    },
  )

  assert.equal(result.source, 'GPS')
  assert.equal(result.speedKmh, 36)
})

test('prioriza la velocidad calculada cuando el GPS reporta cero pero hubo desplazamiento real', () => {
  const position = {
    timestamp: 2000,
    coords: {
      latitude: 19.4327,
      longitude: -99.1332,
      speed: 0,
      accuracy: 15,
    },
  }

  const previousPosition = {
    timestamp: 0,
    latitude: 19.4326,
    longitude: -99.1332,
  }

  const result = resolverVelocidadDesdePosicion(position, previousPosition)

  assert.equal(result.source, 'GPS + cálculo')
  assert.ok(result.speedKmh > 0)
})

test('calcula la batería restante a partir de metros GPS recorridos', () => {
  const distanceKm = 3.2
  const result = calculateBatteryEstimate(distanceKm)

  assert.equal(result.consumedPercent, 32)
  assert.equal(result.remainingPercent, 68)
  assert.equal(result.remainingKm, 6.8)
})

test('ignora desplazamientos mínimos del GPS para evitar ruido', () => {
  const from = { latitude: 19.4326, longitude: -99.1332 }
  const to = { latitude: 19.4326004, longitude: -99.1332004 }

  assert.equal(calculateDistanceKm(from, to), 0)
})

test('usa la autonomía configurada en lugar de asumir 10 km fijos', () => {
  const result = calculateBatteryEstimate(4, 15)

  assert.equal(result.consumedPercent, 26.7)
  assert.equal(result.remainingPercent, 73.3)
  assert.equal(result.percentagePerKm, 6.67)
  assert.equal(normalizeAutonomyKm(15), 15)
})

test('calcula el consumo desde la carga inicial real de la batería', () => {
  const result = calculateBatteryEstimate(3, 10, 60)

  assert.equal(result.consumedPercent, 30)
  assert.equal(result.remainingPercent, 30)
  assert.equal(result.remainingKm, 3)
})
