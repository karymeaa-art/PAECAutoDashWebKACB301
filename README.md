# PAECAutoDashWebKACB301

AutoDash Web es un panel digital para vehículos eléctricos solares de dos plazas. La aplicación centraliza información clave del recorrido, autonomía, clima, consumo y estado de la batería para ofrecer una experiencia más intuitiva, segura y sostenible.

## Descripción general

El proyecto combina una interfaz moderna con componentes interativos para simular el funcionamiento de un tablero de control eléctrico:

- Velocímetro y seguimiento de distancia del viaje
- Control de batería y estimación de autonomía
- Historial de recorridos y kilometraje acumulado
- Información climática en tiempo real
- Personalización visual del panel
- Navegación entre secciones del dashboard

## Tecnologías

- React
- Vite
- Leaflet
- CSS personalizado

## Requisitos

- Node.js 18 o superior
- npm

## Instalación

```bash
npm install
```

## Ejecución en modo desarrollo

```bash
npm run dev
```

La aplicación quedará disponible en el puerto local de Vite, normalmente en `http://localhost:5173`.

## Compilación para producción

```bash
npm run build
```

## Estructura principal

```text
src/
├── components/
│   ├── ClimaApi.jsx
│   ├── ControlBateria.jsx
│   ├── HistorialConsumo.jsx
│   ├── NavigationPanel.jsx
│   ├── Velocimetro.jsx
│   └── gpsLogic.js
├── views/
│   └── Dashboard.jsx
├── App.jsx
├── App.css
├── main.jsx
└── index.css
```

## Funcionalidades destacadas

- Medición de velocidad con actualización visual
- Registro de distancia recorrida por viaje
- Cálculo de consumo y autonomía estimada
- Persistencia local con `localStorage` para historial y configuración
- Cambios de tema y tonos personalizados del tablero

## Documentación adicional

Consulta la documentación oficial de [Vite](https://vite.dev/) y [React](https://react.dev/) para ampliar la información del proyecto.
