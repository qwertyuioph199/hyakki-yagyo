/**
 * Fixed "ink & lantern" palette — the whole game draws from these named
 * roles so 40+ procedural sprites cohere. (P4 art pass may tune values,
 * never add one-off colors in painters.)
 */
export const PAL = {
  ink: '#0b0b12',
  inkSoft: '#16161f',
  ground: '#101018',
  groundDot: '#1d1d2a',
  bone: '#f2ead8',
  paper: '#e8e2d0',
  lantern: '#e8a33d',
  lanternDeep: '#c97b2d',
  ember: '#e0562e',
  blood: '#b03a3a',
  spirit: '#5fd3c4',
  spiritDeep: '#3a9b95',
  ghost: '#9fb8c9',
  fox: '#7fda89',
  gold: '#f5c542',
  violet: '#8a6fc9',
  white: '#ffffff',
  hpRed: '#d84545',
  xpBlue: '#4aa3d8',
} as const;
