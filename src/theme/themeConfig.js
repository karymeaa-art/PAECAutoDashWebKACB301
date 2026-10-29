const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const normalizeHex = (hex) => {
  const value = (hex || '#22c55e').trim()
  const sanitized = value.startsWith('#') ? value : `#${value}`

  if (/^#[0-9a-fA-F]{3}$/.test(sanitized)) {
    const [r, g, b] = sanitized.slice(1)
    return `#${r}${r}${g}${g}${b}${b}`
  }

  if (/^#[0-9a-fA-F]{6}$/.test(sanitized)) {
    return sanitized.toLowerCase()
  }

  return '#22c55e'
}

const hexToRgb = (hex) => {
  const normalized = normalizeHex(hex)
  const value = normalized.slice(1)

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

const componentToHex = (value) => Math.round(value).toString(16).padStart(2, '0')

const rgbToHex = ({ r, g, b }) => `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`

const rgbToHsl = (r, g, b) => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta !== 0) {
    switch (max) {
      case red:
        h = ((green - blue) / delta) % 6
        break
      case green:
        h = (blue - red) / delta + 2
        break
      default:
        h = (red - green) / delta + 4
        break
    }
    h *= 60
  }

  return {
    h: Math.round(h < 0 ? h + 360 : h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

const hslToHex = (h, s, l) => {
  const hue = ((h % 360) + 360) % 360
  const saturation = clamp(s, 0, 100) / 100
  const lightness = clamp(l, 0, 100) / 100

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const match = lightness - chroma / 2

  let red = 0
  let green = 0
  let blue = 0

  if (hue >= 0 && hue < 60) {
    red = chroma
    green = x
  } else if (hue < 120) {
    red = x
    green = chroma
  } else if (hue < 180) {
    green = chroma
    blue = x
  } else if (hue < 240) {
    green = x
    blue = chroma
  } else if (hue < 300) {
    red = x
    blue = chroma
  } else {
    red = chroma
    blue = x
  }

  return rgbToHex({
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255),
  })
}

const rgbaFromHex = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const themePresets = {
  eco: { id: 'eco', label: 'Verde', color: '#22c55e' },
  noche: { id: 'noche', label: 'Azul', color: '#60a5fa' },
  oceano: { id: 'oceano', label: 'Azul/cian', color: '#06b6d4' },
  solar: { id: 'solar', label: 'Amarillo', color: '#fbbf24' },
  custom: { id: 'custom', label: 'Personalizado', color: '#8b5cf6' },
}

export const getThemeVariables = (
  themeId = 'eco',
  customColor = '#8b5cf6',
  customBackgroundColor = '#071a22',
) => {
  const theme = themePresets[themeId] || themePresets.eco
  const baseHex = themeId === 'custom' ? normalizeHex(customColor) : theme.color
  const base = normalizeHex(baseHex)
  const backgroundPreset = normalizeHex(customBackgroundColor || '#071a22')
  const { r, g, b } = hexToRgb(base)
  const { h, s, l } = rgbToHsl(r, g, b)

  const primary = base
  const primaryLight = hslToHex(h, clamp(s + 14, 18, 96), clamp(l + 18, 52, 88))
  const primaryDark = hslToHex(h, clamp(s - 14, 20, 92), clamp(l - 18, 10, 52))
  const secondary = hslToHex((h + 26) % 360, clamp(s, 48, 90), clamp(l + 10, 38, 70))
  const accent = hslToHex((h + 42) % 360, clamp(s + 8, 45, 95), clamp(l + 8, 42, 78))
  const background = themeId === 'custom' ? backgroundPreset : hslToHex(h, 25, 10)
  const backgroundRgb = hexToRgb(background)
  const backgroundHsl = rgbToHsl(backgroundRgb.r, backgroundRgb.g, backgroundRgb.b)
  const backgroundDeep = themeId === 'custom'
    ? hslToHex(
        backgroundHsl.h,
        clamp(backgroundHsl.s + 6, 18, 92),
        clamp(backgroundHsl.l - 25, 4, 30),
      )
    : '#06141d'
  const surface = themeId === 'custom'
    ? hslToHex(
        backgroundHsl.h,
        clamp(backgroundHsl.s + 12, 20, 90),
        clamp(backgroundHsl.l + 18, 16, 44),
      )
    : hslToHex(h, 22, 14)
  const surfaceAlt = themeId === 'custom'
    ? hslToHex(
        backgroundHsl.h,
        clamp(backgroundHsl.s + 18, 16, 90),
        clamp(backgroundHsl.l + 28, 20, 52),
      )
    : hslToHex(h, 18, 18)
  const border = rgbaFromHex(primaryLight, 0.32)
  const shadow = rgbaFromHex(primary, 0.32)
  const textPrimary = '#edf9ff'
  const textSecondary = '#a7bfd0'
  const success = '#4ade80'
  const warning = '#fbbf24'
  const danger = '#f87171'

  return {
    '--primary-color': primary,
    '--primary-color-light': primaryLight,
    '--primary-color-dark': primaryDark,
    '--primary-color-soft': rgbaFromHex(primary, 0.16),
    '--secondary-color': secondary,
    '--accent-color': accent,
    '--background-color': background,
    '--background-deep': backgroundDeep,
    '--surface-color': surface,
    '--surface-color-alt': surfaceAlt,
    '--surface-strong': hslToHex(h, 22, 22),
    '--border-color': border,
    '--shadow-color': shadow,
    '--shadow-cyan': `0 0 18px ${rgbaFromHex(primary, 0.32)}`,
    '--shadow-green': `0 0 18px ${rgbaFromHex(secondary, 0.28)}`,
    '--shadow-red': `0 0 18px ${rgbaFromHex(danger, 0.25)}`,
    '--text-primary': textPrimary,
    '--text-secondary': textSecondary,
    '--cyan': primary,
    '--green': secondary,
    '--amber': accent,
    '--accent': primary,
    '--accent-soft': rgbaFromHex(primary, 0.16),
    '--success-color': success,
    '--warning-color': warning,
    '--danger-color': danger,
    '--bg-deep': backgroundDeep,
    '--bg-panel': surface,
    '--bg-panel-alt': surfaceAlt,
    '--bg-elevated': hslToHex(h, 18, 24),
    '--color-glow': rgbaFromHex(primary, 0.22),
    '--theme-primary-rgb': `${r}, ${g}, ${b}`,
  }
}
