import * as THREE from 'three';

// Central palette
export const PALETTE = {
  stone:       0xd4b896,
  stoneDark:   0xa8896a,
  roof:        0xb85c38,
  roofDark:    0x8c3e22,
  wood:        0x7a5c3a,
  sand:        0xe8d5a3,
  water:       0x2a6b8a,
  copper:      0xb87333,
  shadow:      0x3a2a1a,
  guardRed:    0x8c2020,
  playerDark:  0x1a1a2e,
  accent:      0xe8c84a,
  foliage:     0x4a6a2a,
};

const cache = new Map<string, THREE.MeshStandardMaterial>();

function mat(key: string, params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  if (cache.has(key)) return cache.get(key)!;
  const m = new THREE.MeshStandardMaterial(params);
  cache.set(key, m);
  return m;
}

export const Materials = {
  stone: () => mat('stone', { color: PALETTE.stone, roughness: 0.85, metalness: 0.0 }),
  stoneDark: () => mat('stoneDark', { color: PALETTE.stoneDark, roughness: 0.9, metalness: 0.0 }),
  roof: () => mat('roof', { color: PALETTE.roof, roughness: 0.8, metalness: 0.1 }),
  roofDark: () => mat('roofDark', { color: PALETTE.roofDark, roughness: 0.85, metalness: 0.05 }),
  wood: () => mat('wood', { color: PALETTE.wood, roughness: 0.9, metalness: 0.0 }),
  sand: () => mat('sand', { color: PALETTE.sand, roughness: 1.0, metalness: 0.0 }),
  water: () => mat('water', { color: PALETTE.water, roughness: 0.1, metalness: 0.3 }),
  copper: () => mat('copper', { color: PALETTE.copper, roughness: 0.5, metalness: 0.7 }),
  guardBody: () => mat('guardBody', { color: PALETTE.guardRed, roughness: 0.8, metalness: 0.1 }),
  playerBody: () => mat('playerBody', { color: PALETTE.playerDark, roughness: 0.7, metalness: 0.05 }),
  cloak: () => mat('cloak', { color: 0x0d0d1a, roughness: 0.95, metalness: 0.0 }),
  glowing: () => mat('glowing', { color: PALETTE.accent, roughness: 0.3, metalness: 0.5, emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 0.4 }),
  foliage: () => mat('foliage', { color: PALETTE.foliage, roughness: 1.0, metalness: 0.0 }),
  objective: () => mat('objective', { color: 0x00ddff, roughness: 0.3, metalness: 0.5, emissive: new THREE.Color(0x00ddff), emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }),
};
