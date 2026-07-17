import * as THREE from 'three';

export interface ColliderBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
  climbable?: boolean;
  ledge?: boolean;       // top face is a ledge
  ledgeY?: number;       // exact Y of ledge top
}

export class CollisionWorld {
  private boxes: ColliderBox[] = [];
  private raycaster = new THREE.Raycaster();

  addBox(min: THREE.Vector3, max: THREE.Vector3, opts?: { climbable?: boolean; ledge?: boolean }): void {
    const ledgeY = opts?.ledge ? max.y : undefined;
    this.boxes.push({ min: min.clone(), max: max.clone(), ...opts, ledgeY });
  }

  // Returns ground Y at (x,z), or null if nothing below
  groundAt(x: number, z: number, fromY: number): number | null {
    let best: number | null = null;
    for (const b of this.boxes) {
      if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
      if (b.max.y <= fromY + 0.05) {
        if (best === null || b.max.y > best) best = b.max.y;
      }
    }
    return best;
  }

  // Broad AABB check — is sphere overlapping any box?
  sphereOverlap(cx: number, cy: number, cz: number, r: number): boolean {
    for (const b of this.boxes) {
      const dx = Math.max(b.min.x - cx, 0, cx - b.max.x);
      const dy = Math.max(b.min.y - cy, 0, cy - b.max.y);
      const dz = Math.max(b.min.z - cz, 0, cz - b.max.z);
      if (dx * dx + dy * dy + dz * dz < r * r) return true;
    }
    return false;
  }

  // Simple XYZR capsule-box push-out
  resolveCapsule(pos: THREE.Vector3, radius: number, halfHeight: number): THREE.Vector3 {
    const out = pos.clone();
    for (const b of this.boxes) {
      const cx = Math.max(b.min.x, Math.min(out.x, b.max.x));
      const cy = Math.max(b.min.y, Math.min(out.y, b.max.y));
      const cz = Math.max(b.min.z, Math.min(out.z, b.max.z));
      const dx = out.x - cx;
      const dy = out.y - cy;
      const dz = out.z - cz;
      const dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 < radius * radius && dist2 > 0) {
        const dist = Math.sqrt(dist2);
        const pen = radius - dist;
        out.x += (dx / dist) * pen;
        out.y += (dy / dist) * pen;
        out.z += (dz / dist) * pen;
      }
    }
    return out;
  }

  // Raycast returning hit distance or Infinity
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number {
    let best = maxDist;
    for (const b of this.boxes) {
      const t = rayBoxIntersect(origin, dir, b.min, b.max);
      if (t !== null && t > 0 && t < best) best = t;
    }
    return best;
  }

  getBoxes(): ColliderBox[] { return this.boxes; }

  // Find ledges within reach
  findLedgeInRange(pos: THREE.Vector3, reach: number): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    for (const b of this.boxes) {
      if (!b.ledge) continue;
      // Check if ledge top is above player hand height
      const ledgeY = b.ledgeY ?? b.max.y;
      if (ledgeY < pos.y - 0.5 || ledgeY > pos.y + reach) continue;
      // Closest point on ledge top edge
      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < reach * reach) {
        return {
          point: new THREE.Vector3(cx, ledgeY, cz),
          normal: new THREE.Vector3(dx, 0, dz).normalize(),
        };
      }
    }
    return null;
  }
}

function rayBoxIntersect(o: THREE.Vector3, d: THREE.Vector3, mn: THREE.Vector3, mx: THREE.Vector3): number | null {
  let tmin = -Infinity, tmax = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    const da = d[axis];
    if (Math.abs(da) < 1e-8) {
      if (o[axis] < mn[axis] || o[axis] > mx[axis]) return null;
    } else {
      const t1 = (mn[axis] - o[axis]) / da;
      const t2 = (mx[axis] - o[axis]) / da;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmin > tmax) return null;
    }
  }
  return tmin > 0 ? tmin : tmax > 0 ? 0 : null;
}
