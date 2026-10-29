import { useEffect, useMemo, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './App.css'
import Dashboard from './views/Dashboard'
import Maintenance from './views/Maintenance'
import NavigationPanel from './components/NavigationPanel'
import { getThemeVariables, themePresets } from './theme/themeConfig'

const tabs = [
  { label: 'Inicio', icon: '⌂' },
  { label: 'Navegación', icon: '✦' },
  { label: 'Mantenimiento', icon: '⚙' },
  { label: 'Multimedia', icon: '♫' },
  { label: 'Historial', icon: '◫' },
]

const themes = Object.values(themePresets)

function App() {
  const [activeTab, setActiveTab] = useState(0)
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'eco'
    }

    return localStorage.getItem('autodash-theme') || 'eco'
  })
  const [customColor, setCustomColor] = useState(() => {
    if (typeof window === 'undefined') {
      return '#8b5cf6'
    }

    return localStorage.getItem('autodash-custom-color') || '#8b5cf6'
  })
  const [customBackgroundColor, setCustomBackgroundColor] = useState(() => {
    if (typeof window === 'undefined') {
      return '#071a22'
    }

    return localStorage.getItem('autodash-custom-background-color') || '#071a22'
  })
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false)
  const [isHeaderCustomizerOpen, setIsHeaderCustomizerOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('autodash-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('autodash-custom-color', customColor)
  }, [customColor])

  useEffect(() => {
    localStorage.setItem('autodash-custom-background-color', customBackgroundColor)
  }, [customBackgroundColor])

  useEffect(() => {
    setIsCustomPickerOpen(theme === 'custom')
  }, [theme])

  const themeStyles = useMemo(
    () => getThemeVariables(theme, customColor, customBackgroundColor),
    [theme, customColor, customBackgroundColor],
  )

  const openCustomizer = () => {
    setTheme('custom')
    setIsCustomPickerOpen(true)
    setIsHeaderCustomizerOpen(true)
  }

  const handleThemeChange = (nextTheme) => {
    setTheme(nextTheme)
    if (nextTheme === 'custom') {
      setIsCustomPickerOpen(true)
    }
  }

  const handleHexInput = (event) => {
    const value = event.target.value.trim()
    const normalized = value.startsWith('#') ? value : `#${value}`

    if (/^#[0-9a-fA-F]{3}$/.test(normalized) || /^#[0-9a-fA-F]{6}$/.test(normalized)) {
      setCustomColor(normalized)
      setTheme('custom')
      setIsCustomPickerOpen(true)
    }
  }

  const handleBackgroundHexInput = (event) => {
    const value = event.target.value.trim()
    const normalized = value.startsWith('#') ? value : `#${value}`

    if (/^#[0-9a-fA-F]{3}$/.test(normalized) || /^#[0-9a-fA-F]{6}$/.test(normalized)) {
      setCustomBackgroundColor(normalized)
      setTheme('custom')
      setIsCustomPickerOpen(true)
    }
  }

  return (
    <div
      className={`app-shell autodash-app theme-${theme}`}
      data-theme={theme}
      style={themeStyles}
    >
      <aside className="side-rail">
        <div className="brand-block">
          <div className="brand-mark">⚡</div>
          <div>
            <div className="brand-title">AutoDash Web</div>
            <div className="brand-subtitle">PAEC</div>
          </div>
        </div>

        <nav className="side-nav" aria-label="Navegación lateral">
          {tabs.map((tab, index) => (
            <button
              key={tab.label}
              type="button"
              className={index === activeTab ? 'side-nav-button active' : 'side-nav-button'}
              onClick={() => setActiveTab(index)}
            >
              <span className="side-nav-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="main-panel">
        <header className="app-header">
          <div className="header-title-wrap">
            <p className="eyebrow">AutoDash Web</p>
            <h1>Movilidad sustentable, mejor futuro</h1>
          </div>

          <div className="header-actions">
            <span className="header-status">
              <span className="status-dot" />
              En línea
            </span>
            <div className="header-settings-wrap">
              <button
                type="button"
                className="header-button"
                aria-label="Abrir personalización visual"
                aria-expanded={isHeaderCustomizerOpen}
                onClick={() => setIsHeaderCustomizerOpen((prev) => !prev)}
              >
                ⚙
              </button>

              {isHeaderCustomizerOpen && (
                <div className="header-customizer-panel" role="dialog" aria-label="Personalización visual del tablero">
                  <div className="customizer-header">
                    <span>Color principal</span>
                    <span
                      className="color-preview"
                      style={{ background: customColor }}
                      aria-label={`Vista previa del color ${customColor}`}
                    />
                  </div>

                  <div className="customizer-controls compact">
                    <input
                      aria-label="Selector del color principal personalizado"
                      type="color"
                      className="color-input"
                      value={customColor}
                      onChange={(event) => {
                        setCustomColor(event.target.value)
                        setTheme('custom')
                        setIsHeaderCustomizerOpen(true)
                      }}
                    />

                    <input
                      aria-label="Código HEX del color principal personalizado"
                      type="text"
                      className="hex-input"
                      value={customColor}
                      onChange={handleHexInput}
                      inputMode="text"
                      pattern="#?[0-9A-Fa-f]{6}"
                    />
                  </div>

                  <div className="customizer-header">
                    <span>Fondo</span>
                    <span
                      className="color-preview"
                      style={{ background: customBackgroundColor }}
                      aria-label={`Vista previa del fondo ${customBackgroundColor}`}
                    />
                  </div>

                  <div className="customizer-controls compact">
                    <input
                      aria-label="Selector del color de fondo personalizado"
                      type="color"
                      className="color-input"
                      value={customBackgroundColor}
                      onChange={(event) => {
                        setCustomBackgroundColor(event.target.value)
                        setTheme('custom')
                        setIsHeaderCustomizerOpen(true)
                      }}
                    />

                    <input
                      aria-label="Código HEX del fondo personalizado"
                      type="text"
                      className="hex-input"
                      value={customBackgroundColor}
                      onChange={handleBackgroundHexInput}
                      inputMode="text"
                      pattern="#?[0-9A-Fa-f]{6}"
                    />
                  </div>

                  <button type="button" className="customizer-action" onClick={openCustomizer}>
                    Abrir tema completo
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="scene-band" aria-hidden="true" />

        <div className="tab-container">
          <div
            className="tab-slider"
            style={{ transform: `translateX(-${activeTab * 100}%)` }}
          >
            <section className="tab-panel dashboard-panel">
              <Dashboard />
            </section>

            <section className="tab-panel">
              <NavigationPanel />
            </section>

            <section className="tab-panel">
              <Maintenance />
            </section>

            <section className="tab-panel">
              <div className="section-mockup multimedia-mockup">
                <div className="section-header">
                  <span className="chip chip-cyan">Multimedia</span>
                </div>

                <div className="media-player">
                  <div className="album-art" />
                  <div className="track-meta">
                    <p>Reproduciendo</p>
                    <strong>Road Trip Solar</strong>
                    <span>Playlist de viaje</span>
                  </div>
                </div>

                <div className="player-controls">
                  <span>◀</span>
                  <span className="play-button">▶</span>
                  <span>▶▶</span>
                </div>

                <div className="progress-bar">
                  <span />
                </div>

                <div className="media-grid">
                  <div className="media-card">Podcast</div>
                  <div className="media-card">Audiolibro</div>
                  <div className="media-card">FM / Radio</div>
                  <div className="media-card">Spotify</div>
                </div>
              </div>
            </section>

            <section className="tab-panel">
              <div className="section-mockup">
                <div className="section-header">
                  <span className="chip chip-green">Historial</span>
                </div>
                <div className="history-extended">
                  <p>Visualización del historial general del vehículo.</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="bottom-bar">
          <div className="bottom-bar__content">
            <div className="theme-picker">
              <span>Personalizar tablero</span>
              <div className="theme-swatches">
                {themes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={theme === item.id ? 'theme-swatch active' : 'theme-swatch'}
                    style={{
                      background:
                        item.id === 'eco'
                          ? '#22c55e'
                          : item.id === 'noche'
                            ? '#60a5fa'
                            : item.id === 'oceano'
                              ? '#06b6d4'
                              : item.id === 'solar'
                                ? '#fbbf24'
                                : customColor,
                    }}
                    onClick={() => handleThemeChange(item.id)}
                    aria-label={`Tema ${item.label}`}
                    title={item.label}
                  />
                ))}
              </div>
              {isCustomPickerOpen && (
                <div className="customizer-panel" role="dialog" aria-label="Selector de color personalizado">
                  <div className="customizer-header">
                    <span>Color principal</span>
                    <span
                      className="color-preview"
                      style={{ background: customColor }}
                      aria-label={`Vista previa del color ${customColor}`}
                    />
                  </div>

                  <div className="customizer-controls">
                    <input
                      aria-label="Selector del color principal personalizado"
                      type="color"
                      className="color-input"
                      value={customColor}
                      onChange={(event) => {
                        setCustomColor(event.target.value)
                        setTheme('custom')
                      }}
                    />

                    <input
                      aria-label="Código HEX del color principal personalizado"
                      type="text"
                      className="hex-input"
                      value={customColor}
                      onChange={handleHexInput}
                      inputMode="text"
                      pattern="#?[0-9A-Fa-f]{6}"
                    />
                  </div>

                  <div className="customizer-header">
                    <span>Fondo</span>
                    <span
                      className="color-preview"
                      style={{ background: customBackgroundColor }}
                      aria-label={`Vista previa del fondo ${customBackgroundColor}`}
                    />
                  </div>

                  <div className="customizer-controls">
                    <input
                      aria-label="Selector del color de fondo personalizado"
                      type="color"
                      className="color-input"
                      value={customBackgroundColor}
                      onChange={(event) => {
                        setCustomBackgroundColor(event.target.value)
                        setTheme('custom')
                      }}
                    />

                    <input
                      aria-label="Código HEX del fondo personalizado"
                      type="text"
                      className="hex-input"
                      value={customBackgroundColor}
                      onChange={handleBackgroundHexInput}
                      inputMode="text"
                      pattern="#?[0-9A-Fa-f]{6}"
                    />
                  </div>
                </div>
              )}
            </div>

            <nav className="app-navbar" aria-label="Navegación principal">
              {tabs.map((tab, index) => (
                <button
                  key={tab.label}
                  type="button"
                  className={index === activeTab ? 'nav-button active' : 'nav-button'}
                  onClick={() => setActiveTab(index)}
                >
                  <span>{tab.icon}</span>
                  <small>{tab.label}</small>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
