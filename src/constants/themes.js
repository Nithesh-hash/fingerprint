import * as THREE from 'three';

// Light-Theme Biometric Topographic Filter / Color Definitions
export const THEMES = {
  CERAMIC: {
    id: 'ceramic',
    name: 'Ceramic Relief',
    description: 'Clean sculpted alabaster ceramic biometric relief',
    bg: 0xf8fafc,
    colors: [
      { stop: 0.0, color: new THREE.Color('#f1f5f9') },
      { stop: 0.35, color: new THREE.Color('#cbd5e1') },
      { stop: 0.7, color: new THREE.Color('#64748b') },
      { stop: 1.0, color: new THREE.Color('#0f172a') }
    ],
    material: { roughness: 0.35, metalness: 0.15 }
  },
  PRECISION_BLUE: {
    id: 'blue',
    name: 'Precision Blue',
    description: 'Engineering blue topographic elevation contour',
    bg: 0xf8fafc,
    colors: [
      { stop: 0.0, color: new THREE.Color('#e0f2fe') },
      { stop: 0.4, color: new THREE.Color('#38bdf8') },
      { stop: 0.75, color: new THREE.Color('#0284c7') },
      { stop: 1.0, color: new THREE.Color('#1e3a8a') }
    ],
    material: { roughness: 0.3, metalness: 0.25 }
  },
  EMERALD_LAB: {
    id: 'emerald',
    name: 'Emerald Lab',
    description: 'Clinical laboratory biometric green spectrum',
    bg: 0xf8fafc,
    colors: [
      { stop: 0.0, color: new THREE.Color('#ecfdf5') },
      { stop: 0.35, color: new THREE.Color('#6ee7b7') },
      { stop: 0.7, color: new THREE.Color('#10b981') },
      { stop: 1.0, color: new THREE.Color('#064e3b') }
    ],
    material: { roughness: 0.35, metalness: 0.2 }
  },
  THERMAL: {
    id: 'thermal',
    name: 'Thermal Spectrum',
    description: 'Full forensic thermal heat elevation mapping',
    bg: 0xf8fafc,
    colors: [
      { stop: 0.0, color: new THREE.Color('#0284c7') },
      { stop: 0.3, color: new THREE.Color('#22c55e') },
      { stop: 0.65, color: new THREE.Color('#eab308') },
      { stop: 1.0, color: new THREE.Color('#dc2626') }
    ],
    material: { roughness: 0.3, metalness: 0.15 }
  },
  GRAPHITE: {
    id: 'graphite',
    name: 'Graphite Matte',
    description: 'Monochrome high-contrast architectural shading',
    bg: 0xf8fafc,
    colors: [
      { stop: 0.0, color: new THREE.Color('#f8fafc') },
      { stop: 0.35, color: new THREE.Color('#94a3b8') },
      { stop: 0.75, color: new THREE.Color('#334155') },
      { stop: 1.0, color: new THREE.Color('#020617') }
    ],
    material: { roughness: 0.5, metalness: 0.1 }
  }
};

export const THEME_LIST = Object.values(THEMES);

// Safe theme getter with fallbacks
export function getTheme(themeKey) {
  if (!themeKey) return THEMES.CERAMIC;
  const k = themeKey.toUpperCase();
  if (THEMES[k]) return THEMES[k];

  // Check by id
  const byId = THEME_LIST.find(t => t.id.toLowerCase() === themeKey.toLowerCase());
  if (byId) return byId;

  // Fallback mappings
  if (k === 'NEON' || k === 'RELIEF') return THEMES.CERAMIC;
  if (k === 'PHOSPHOR') return THEMES.EMERALD_LAB;
  if (k === 'DARK' || k === 'ORIGINAL') return THEMES.GRAPHITE;

  return THEMES.CERAMIC;
}
