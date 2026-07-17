import * as THREE from 'three';

export interface NavNode {
  id: number;
  pos: THREE.Vector3;
  neighbors: number[];
}

export class NavigationGraph {
  private nodes: NavNode[] = [];

  addNode(pos: THREE.Vector3): number {
    const id = this.nodes.length;
    this.nodes.push({ id, pos: pos.clone(), neighbors: [] });
    return id;
  }

  connect(a: number, b: number): void {
    if (!this.nodes[a].neighbors.includes(b)) this.nodes[a].neighbors.push(b);
    if (!this.nodes[b].neighbors.includes(a)) this.nodes[b].neighbors.push(a);
  }

  nearest(pos: THREE.Vector3): NavNode | null {
    let best: NavNode | null = null;
    let bestD = Infinity;
    for (const n of this.nodes) {
      const d = n.pos.distanceToSquared(pos);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  // Simple BFS path
  pathBetween(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const startNode = this.nearest(from);
    const endNode = this.nearest(to);
    if (!startNode || !endNode) return [to];
    if (startNode.id === endNode.id) return [to];

    const visited = new Set<number>();
    const queue: { id: number; path: number[] }[] = [{ id: startNode.id, path: [startNode.id] }];
    visited.add(startNode.id);

    while (queue.length) {
      const { id, path } = queue.shift()!;
      if (id === endNode.id) {
        return path.map(nid => this.nodes[nid].pos.clone());
      }
      for (const nb of this.nodes[id].neighbors) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push({ id: nb, path: [...path, nb] });
        }
      }
    }
    return [to];
  }

  getNode(id: number): NavNode { return this.nodes[id]; }
  getAll(): NavNode[] { return this.nodes; }

  // Build a simple grid nav for the city ground level
  buildCityGrid(): void {
    const step = 8;
    const range = 40;
    const grid = new Map<string, number>();
    for (let x = -range; x <= range; x += step) {
      for (let z = -70; z <= 40; z += step) {
        const key = `${x},${z}`;
        const id = this.addNode(new THREE.Vector3(x, 0, z));
        grid.set(key, id);
      }
    }
    // Connect neighbors
    for (let x = -range; x <= range; x += step) {
      for (let z = -70; z <= 40; z += step) {
        const id = grid.get(`${x},${z}`)!;
        if (id === undefined) continue;
        const right = grid.get(`${x + step},${z}`);
        const down = grid.get(`${x},${z + step}`);
        if (right !== undefined) this.connect(id, right);
        if (down !== undefined) this.connect(id, down);
      }
    }
  }
}
