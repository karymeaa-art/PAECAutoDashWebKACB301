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

## Centro multimedia

En **Multimedia > Spotify**, pega un enlace o URI `spotify:...` de canción, álbum, playlist, episodio o programa y selecciona **Cargar Spotify**. AutoDash usa Spotify Embed como reproductor principal. En playlists y álbumes, el reproductor oficial incluye la lista interactiva: desplázate dentro del Embed para recorrerla y selecciona canciones desde sus controles. La vista amplia permite ver más canciones a la vez; playlists extensas mantienen su propio desplazamiento. El botón **Abrir playlist completa en Spotify** abre la URL canónica de la playlist.

Spotify Embed muestra las portadas e información que Spotify decide exponer en su reproductor. No ofrece a AutoDash los datos estructurados de cada canción (por ejemplo, todos los álbumes y portadas por pista) para crear una lista paralela. La integración no raspa el reproductor ni usa endpoints privados. Mostrar ese catálogo como datos propios requeriría la Web API oficial y su autenticación/configuración, que no forma parte de este Embed sin backend.

Una cuenta gratuita puede usar el Embed, pero la reproducción de cada tema depende de Spotify, la cuenta, el contenido y la región; Spotify puede aplicar anuncios, reproducción aleatoria, vistas previas o pedir autenticación. Si una pista solo ofrece una vista previa, el reproductor oficial indica esa modalidad. AutoDash no simula reproducción ni elimina restricciones. Si Spotify pide iniciar sesión o el contenido no está disponible, usa **Abrir playlist completa en Spotify**. Se admiten enlaces regionales como `/intl-es/` y URI `spotify:...`; se normalizan a URLs oficiales. Se necesita internet y un navegador que permita contenido incrustado.

### YouTube y seguridad de video

YouTube admite enlaces completos, cortos e IDs, y carga el reproductor oficial sin GPS ni API Key. La búsqueda es opcional y requiere `VITE_YOUTUBE_API_KEY` (aplica la cuota y las políticas de Google). Cargar o preparar un video no lo reproduce. Para reproducirlo, el módulo exige ambas señales recientes: velocidad GPS directa de 0 km/h y un reporte independiente del controlador del vehículo que confirme 0 km/h, freno de estacionamiento activado y `isSimulated: false`. Si falta una señal, el video permanece pausado y bloqueado.

La app web por sí sola no tiene acceso a un sensor certificado del vehículo. El host nativo debe integrar el evento `autodash:vehicle-safety` con un reporte que incluya `source: "vehicle-controller"`, `isSimulated: false`, `parkingBrakeEngaged: true`, `speedKmh: 0` y `receivedAt` en milisegundos Unix. No envíes este evento desde un control de la página, desde el velocímetro simulado ni desde la consola: un evento JavaScript no autentica por sí mismo el hardware. Sin una integración nativa confiable, la reproducción de videos queda bloqueada. Esta función no reemplaza un sistema de seguridad vehicular certificado.

### Radio en internet

En **Multimedia > Radio**, busca por nombre, género o país o elige una categoría. Los resultados proceden del directorio comunitario gratuito [Radio Browser](https://www.radio-browser.info/); no se inventan emisoras ni URLs. AutoDash solo admite estaciones que el directorio marca como activas y revisadas en los últimos siete días, exige enlaces HTTPS en contextos seguros y prueba la transmisión con audio HTML5 silenciado antes de mostrarla. Al reproducir, el audio se vuelve audible; una emisión puede desconectarse o dejar de funcionar después de la prueba.

Los favoritos se guardan en `localStorage` del dispositivo. Pausar transmisiones en directo depende de la emisora y del formato. Algunas URLs, codecs, HLS, CORS o restricciones del emisor pueden impedir la reproducción; si el navegador no consigue iniciar el flujo, muestra un error en lugar de anunciar la estación como disponible. Radio Browser es un servicio comunitario sin garantía de disponibilidad; la programación y los derechos de cada emisora pertenecen a su emisor.

Durante la verificación de desarrollo, el directorio informó como activas emisoras HTTPS de Radio Armisa, SWR3, Heart 80s y Christmas FM. Se recibieron bytes de audio en las URLs de Radio Armisa (HTTP 206, `audio/mpeg`), SWR3 (HTTP 200, `audio/mpeg`), Heart 80s (HTTP 200, `audio/mpeg`) y Christmas FM (HTTP 206, `audio/aac`). Es una comprobación puntual de red; no garantiza disponibilidad futura ni confirma reproducción en todos los navegadores.

### Archivos locales

Los archivos de audio se reproducen con los controles HTML5 y una lista local; los videos locales conservan el mismo bloqueo de seguridad que YouTube. El navegador determina los formatos de audio/video que puede decodificar. Spotify y la radio son funciones de audio y no se bloquean por movimiento.

Pruebas automatizadas de parsing de enlaces, reglas de seguridad, datos del directorio, favoritos y verificación del reproductor:

```sh
node --test src/views/multimediaUtils.test.js
```

Las pruebas automatizadas no sustituyen una prueba de reproducción dentro del navegador ni la integración de un controlador físico del vehículo.
