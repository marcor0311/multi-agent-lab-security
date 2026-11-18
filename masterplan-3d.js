// 3D campus model built from the shared V09 plan data (masterplan-data.js).
// Classic script: exposes window.AlphaGeo and window.buildAlphaCampus3D(THREE, D).
// Plan coordinates are metres, origin SW corner, +x east, +y north.
// World mapping: x → x − W/2, height → +Y, north → −Z.
(() => {
  'use strict';

  // ---------- shared plan geometry helpers (also used by security-agents-3d.js)
  const roundedRectPoints = (x, y, w, h, r, seg = 8) => {
    const pts = [];
    const corners = [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]];
    for (const [cx, cy, a0] of corners) {
      for (let i = 0; i <= seg; i++) {
        const a = (a0 + 90 * i / seg) * Math.PI / 180;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    return pts; // counter-clockwise, implicitly closed
  };

  class Route {
    constructor(points, closed = false) {
      this.closed = closed;
      this.pts = closed ? points.concat([points[0]]) : points.slice();
      this.cum = [0];
      for (let i = 1; i < this.pts.length; i++) {
        const [ax, ay] = this.pts[i - 1], [bx, by] = this.pts[i];
        this.cum.push(this.cum[i - 1] + Math.hypot(bx - ax, by - ay));
      }
      this.length = this.cum[this.cum.length - 1];
    }
    wrap(s) {
      const L = this.length;
      return this.closed ? ((s % L) + L) % L : Math.min(Math.max(s, 0), L);
    }
    sample(s) {
      s = this.wrap(s);
      let lo = 0, hi = this.cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= s) lo = m; else hi = m; }
      const a = this.pts[lo], b = this.pts[hi];
      const t = (s - this.cum[lo]) / ((this.cum[hi] - this.cum[lo]) || 1);
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, heading: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    project(x, y) {
      let best = Infinity, bestS = 0;
      for (let i = 0; i < this.pts.length - 1; i++) {
        const [ax, ay] = this.pts[i], [bx, by] = this.pts[i + 1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
        const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2));
        const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
        if (d < best) { best = d; bestS = this.cum[i] + t * Math.sqrt(l2); }
      }
      return bestS;
    }
  }

  // Seeded PRNG keeps the forest identical between reloads.
  const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  // ---------- navigation grid (A* on a 1.5 m grid) for people, robots and responders.
  // Buildings, pools, planters and the wall strip are blocked. Walkers prefer paved routes
  // (weighted search); responders take the shortest free line (direct search + string pulling).
  const makeNav = (D, cell = 1.5) => {
    const W = D.site.width, H = D.site.depth;
    const nx = Math.ceil(W / cell), ny = Math.ceil(H / cell), N = nx * ny;
    const cost = new Float32Array(N);
    const inRect = (x, y, r, m = 0) => x > r.x - m && x < r.x + r.width + m && y > r.y - m && y < r.y + r.depth + m;
    const segDist = (px, py, [ax, ay], [bx, by]) => {
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / l2));
      return Math.hypot(ax + dx * t - px, ay + dy * t - py);
    };
    const blocks = [
      ...D.buildings.map(b => [b, 1]), ...D.plaza.reflecting_pools.map(r => [r, .9]),
      ...D.plaza.planters.map(r => [r, .6]), [D.plaza.sculpture, 1]
    ];
    const loop = D.roads[0];
    const ring = roundedRectPoints(loop.x, loop.y, loop.width, loop.depth, loop.radius, 6);
    const nearPolyline = (x, y, pts, tol, closed) => {
      for (let n = 1; n < pts.length + (closed ? 1 : 0); n++) if (segDist(x, y, pts[n - 1], pts[n % pts.length]) <= tol) return true;
      return false;
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = (i + .5) * cell, y = (j + .5) * cell, k = j * nx + i;
      if (x < 2.2 || x > W - 2.2 || y < 2.2 || y > H - 2.2 || blocks.some(([r, m]) => inRect(x, y, r, m))) { cost[k] = Infinity; continue; }
      if (inRect(x, y, D.plaza) || D.pedestrian_routes.some(w => nearPolyline(x, y, w.points, w.width / 2 + .6))) cost[k] = 1;
      else if (inRect(x, y, D.parking)) cost[k] = 1.6;
      else if (nearPolyline(x, y, ring, loop.road_width / 2, true)) cost[k] = 2.2;
      else cost[k] = 4; // lawn
    }
    const free = k => cost[k] !== Infinity;
    const clampI = (v, n) => Math.max(0, Math.min(n - 1, v));
    const idx = (x, y) => clampI(Math.floor(y / cell), ny) * nx + clampI(Math.floor(x / cell), nx);
    const centre = k => [(k % nx + .5) * cell, (Math.floor(k / nx) + .5) * cell];
    const snap = (x, y) => {
      const k0 = idx(x, y);
      if (free(k0)) return k0;
      let best = -1, bd = Infinity;
      const i0 = k0 % nx, j0 = Math.floor(k0 / nx);
      for (let r = 1; r < 30 && best < 0; r++) {
        for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
          if (i < 0 || j < 0 || i >= nx || j >= ny || (Math.abs(i - i0) !== r && Math.abs(j - j0) !== r)) continue;
          const k = j * nx + i;
          if (!free(k)) continue;
          const [cx, cy] = centre(k), d = Math.hypot(cx - x, cy - y);
          if (d < bd) { bd = d; best = k; }
        }
      }
      return best < 0 ? k0 : best;
    };
    const los = (ax, ay, bx, by) => {
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (cell * .4));
      for (let s = 1; s < n; s++) if (!free(idx(ax + (bx - ax) * s / n, ay + (by - ay) * s / n))) return false;
      return true;
    };
    const g = new Float32Array(N), came = new Int32Array(N), shut = new Uint8Array(N);
    const find = (from, to, { direct = false } = {}) => {
      const s = snap(from[0], from[1]), e = snap(to[0], to[1]);
      g.fill(Infinity); came.fill(-1); shut.fill(0);
      const heap = [];
      const push = (f, k) => {
        heap.push([f, k]);
        for (let c = heap.length - 1; c > 0;) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; }
      };
      const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          for (let c = 0; ;) {
            const l = 2 * c + 1, r = l + 1; let m = c;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
          }
        }
        return top;
      };
      const ei = e % nx, ej = Math.floor(e / nx);
      const h = k => { const dx = Math.abs(k % nx - ei), dy = Math.abs(Math.floor(k / nx) - ej); return Math.max(dx, dy) + .414 * Math.min(dx, dy); };
      g[s] = 0; push(h(s), s);
      while (heap.length) {
        const [, k] = pop();
        if (k === e) break;
        if (shut[k]) continue;
        shut[k] = 1;
        const i = k % nx, j = Math.floor(k / nx);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const n = jj * nx + ii;
          if (!free(n) || shut[n]) continue;
          if (di && dj && (!free(j * nx + ii) || !free(jj * nx + i))) continue; // no corner cutting
          const step = (di && dj ? 1.4142 : 1) * (direct ? 1 : (cost[k] + cost[n]) / 2);
          if (g[k] + step < g[n]) { g[n] = g[k] + step; came[n] = k; push(g[n] + h(n), n); }
        }
      }
      if (s !== e && came[e] < 0) return [from.slice(), to.slice()];
      const cells = [];
      for (let k = e; k !== -1 && k !== s; k = came[k]) cells.push(centre(k));
      cells.reverse();
      let pts = [from.slice(), ...cells.slice(0, -1), to.slice()];
      if (direct) { // string pulling
        const out = [pts[0]];
        let a = 0;
        while (a < pts.length - 1) {
          let b = pts.length - 1;
          while (b > a + 1 && !los(pts[a][0], pts[a][1], pts[b][0], pts[b][1])) b--;
          out.push(pts[b]); a = b;
        }
        pts = out;
      } else { // drop collinear points
        pts = pts.filter((p, n) => {
          if (n === 0 || n === pts.length - 1) return true;
          const [ax, ay] = pts[n - 1], [bx, by] = pts[n + 1];
          return Math.abs((p[0] - ax) * (by - ay) - (p[1] - ay) * (bx - ax)) > 1e-6;
        });
      }
      return pts;
    };
    return { find, cell, isFree: (x, y) => free(idx(x, y)) };
  };

  window.AlphaGeo = { roundedRectPoints, Route, rng, makeNav };

  // Approximate roof heights from architectural_briefs.json v03 (conceptual, not survey data).
  const HEIGHTS = { A01: 12.8, L01: 5.4, L02: 5.4, L03: 5.4, L04: 5.2, H01: 9.5, P01: 8.0, S01: 4.2 };
  const FLOOR_TO_FLOOR = { A01: 4.0, L01: 4.5, L02: 4.5, L03: 4.5, L04: 4.2, H01: 4.2, P01: 6.0, S01: 3.4 };
  // Main doors at the end of each pedestrian route in masterplan.json.
  const DOORS = {
    A01: [138.5, 82, 'S', 3.4], L01: [45, 79, 'S', 2.4], L02: [68, 79, 'S', 2.4], L03: [91, 79, 'S', 2.4],
    L04: [36, 62, 'W', 2.4], H01: [175, 92, 'W', 3], P01: [169, 52, 'N', 2.6], S01: [119, 17, 'N', 1.8]
  };

  window.buildAlphaCampus3D = function buildAlphaCampus3D(THREE, D = window.ALPHA_MASTERPLAN) {
    const W = D.site.width, Hs = D.site.depth, CX = W / 2, CY = Hs / 2;
    const toWorld = (x, y, z = 0) => new THREE.Vector3(x - CX, z, CY - y);
    const root = new THREE.Group(); root.name = 'campus';
    const layers = {};
    const group = (name, parent = root) => { const g = new THREE.Group(); g.name = name; parent.add(g); layers[name] = g; return g; };

    const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, ...o });
    const M = {
      forest: mat('#45583d'), clearing: mat('#6f8660'), lawn: mat('#93aa80'),
      road: mat('#5a646a', { roughness: .95 }), shoulder: mat('#8b8d80', { roughness: 1 }), asphalt: mat('#525b61', { roughness: .95 }),
      path: mat('#e1e1da'), edge: mat('#f7f8f4'), paving: mat('#cdd2ce'), line: mat('#f4f6f2', { roughness: .6 }),
      white: mat('#f1f3f2', { roughness: .5 }), concrete: mat('#c7cbc8'),
      glass: mat('#4a6371', { roughness: .15, metalness: .35, emissive: '#ffd59a', emissiveIntensity: 0 }),
      skylight: mat('#9cc3d0', { roughness: .1, metalness: .2, transparent: true, opacity: .35, depthWrite: false }),
      graphite: mat('#353f44', { roughness: .5, metalness: .4 }),
      water: mat('#3b6170', { roughness: .06, metalness: .6 }),
      hedge: mat('#4b6744'), trunk: mat('#5b4636'), pine: mat('#2d4731'), pine2: mat('#36553a'),
      mountain: mat('#7d8c97', { flatShading: true, roughness: 1 }), snow: mat('#eef2f4', { flatShading: true, roughness: 1 }),
      accessible: mat('#6d93a0'), hatch: mat('#c5d7d2'),
      lamp: mat('#fdf8e6', { emissive: '#fff3d0', emissiveIntensity: .15 })
    };

    const finish = (mesh, parent, cast = true) => { mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
    const box = (x, y, w, d, h, z0, m, parent, cast = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.copy(toWorld(x + w / 2, y + d / 2, z0 + h / 2));
      return finish(mesh, parent, cast);
    };
    const shapeFrom = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; };
    const pathFrom = pts => { const p = new THREE.Path(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; };
    const place = (geometry, z, m, parent, cast = false) => {
      geometry.rotateX(-Math.PI / 2); // plan +y → world −z, extrusion → +Y
      const mesh = new THREE.Mesh(geometry, m);
      mesh.position.set(-CX, z, CY);
      return finish(mesh, parent, cast);
    };
    const flat = (shape, z, m, parent) => place(new THREE.ShapeGeometry(shape, 12), z, m, parent);
    const extrude = (shape, depth, z0, m, parent, cast = true) =>
      place(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), z0, m, parent, cast);
    const strip = (points, width, thick, z0, m, parent, extend = 0, cast = false) => {
      for (let i = 0; i < points.length - 1; i++) {
        const [ax, ay] = points[i], [bx, by] = points[i + 1];
        const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(L + extend, thick, width), m);
        mesh.position.copy(toWorld((ax + bx) / 2, (ay + by) / 2, z0 + thick / 2));
        mesh.rotation.y = Math.atan2(dy, dx);
        finish(mesh, parent, cast);
      }
    };
    const instanced = (geometry, material, matrices, parent, cast = true) => {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((m4, i) => mesh.setMatrixAt(i, m4));
      mesh.instanceMatrix.needsUpdate = true;
      return finish(mesh, parent, cast);
    };
    const m4 = (x, y, z, sx = 1, sy = 1, sz = 1, rotY = 0) => new THREE.Matrix4().compose(
      toWorld(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(sx, sy, sz));

    // ---------- ground, site lawn and distant sierra
    const ground = group('ground');
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), M.forest);
    outside.rotation.x = -Math.PI / 2; outside.position.y = -.05; finish(outside, ground, false);
    flat(shapeFrom([[-6, -6], [W + 6, -6], [W + 6, Hs + 6], [-6, Hs + 6]]), -.03, M.clearing, ground);
    flat(shapeFrom([[0, 0], [W, 0], [W, Hs], [0, Hs]]), 0, M.lawn, ground);
    const sierra = group('sierra');
    const peaks = rng(91);
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + peaks() * .2, dist = 780 + peaks() * 380;
      const h = 110 + peaks() * 210, r = 170 + peaks() * 170;
      // Leave a valley open to the south so the access road R02 runs out to the horizon.
      if (Math.sin(a) * dist > 0 && Math.abs(Math.cos(a) * dist - (131 - CX)) < r + 70) continue;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6 + (i % 3)), M.mountain);
      cone.position.set(Math.cos(a) * dist, h / 2 - 4, Math.sin(a) * dist);
      cone.rotation.y = peaks() * 3;
      sierra.add(cone);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * .26, h * .26, 6 + (i % 3)), M.snow);
      cap.position.set(cone.position.x, h - h * .13 - 4 + .5, cone.position.z);
      cap.rotation.y = cone.rotation.y;
      sierra.add(cap);
    }

    // ---------- roads (ring loop R01 + connectors)
    const roads = group('roads');
    const loop = D.roads[0], hw = loop.road_width / 2;
    const outer = roundedRectPoints(loop.x - hw, loop.y - hw, loop.width + 2 * hw, loop.depth + 2 * hw, loop.radius + hw, 12);
    const inner = roundedRectPoints(loop.x + hw, loop.y + hw, loop.width - 2 * hw, loop.depth - 2 * hw, loop.radius - hw, 12);
    const ring = shapeFrom(outer); ring.holes.push(pathFrom(inner));
    flat(ring, .05, M.road, roads);
    // R02 is extended south beyond the plan edge, through the forest and out to the horizon.
    const ROAD_END = -1250;
    for (const road of D.roads.slice(1)) {
      const pts = road.id === 'R02' ? [[road.points[0][0], ROAD_END], road.points[1]] : road.points;
      strip(pts, road.road_width, .04, 0, M.road, roads);
    }
    const r02x = D.roads.find(r => r.id === 'R02').points[0][0];
    for (const side of [-1, 1]) strip([[r02x + side * 6, ROAD_END], [r02x + side * 6, -7]], 3, .03, 0, M.shoulder, roads);
    // Ring and approach-road centre-line dashes.
    const centre = new Route(roundedRectPoints(loop.x, loop.y, loop.width, loop.depth, loop.radius, 12), true);
    const dashes = [];
    for (let s = 0; s < centre.length; s += 6) {
      const p = centre.sample(s);
      dashes.push(m4(p.x, p.y, .06, 1, 1, 1, p.heading));
    }
    for (let y = ROAD_END + 4; y < -9; y += 6) dashes.push(m4(r02x, y, .05, 1, 1, 1, Math.PI / 2));
    instanced(new THREE.BoxGeometry(2.6, .02, .16), M.line, dashes, roads, false);

    // ---------- parking PK01
    const parking = group('parking');
    const pk = D.parking;
    box(pk.x, pk.y, pk.width, pk.depth, .06, 0, M.asphalt, parking, false);
    const stallLines = [], stalls = [];
    for (const [row, y] of pk.row_y.entries()) {
      for (let i = 0; i <= pk.standard_stalls_per_row; i++) {
        const accessible = i === pk.standard_stalls_per_row;
        const x = pk.stall_start_x + i * pk.stall.width;
        const w = accessible ? pk.accessible_stall_width : pk.stall.width;
        stalls.push({ x, y, w, row, i });
        stallLines.push(m4(x, y + pk.stall.depth / 2, .07, 1, 1, 1, Math.PI / 2));
        if (accessible) {
          box(x + .06, y, w - .12, pk.stall.depth, .025, .06, M.accessible, parking, false);
          box(x + w, y, pk.accessible_aisle_width, pk.stall.depth, .025, .06, M.hatch, parking, false);
          stallLines.push(m4(x + w, y + pk.stall.depth / 2, .07, 1, 1, 1, Math.PI / 2));
          stallLines.push(m4(x + w + pk.accessible_aisle_width, y + pk.stall.depth / 2, .07, 1, 1, 1, Math.PI / 2));
        }
      }
    }
    instanced(new THREE.BoxGeometry(pk.stall.depth, .02, .12), M.line, stallLines, parking, false);
    const carColors = ['#a8b4b5', '#edf0ec', '#597789', '#e1e5df', '#a3afb0'];
    [3, 9, 17, 25, 36].forEach((index, k) => {
      const s = stalls[index];
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, .75, 4.3), mat(carColors[k], { roughness: .35, metalness: .4 }));
      body.position.y = .62; car.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, .55, 2.3), M.glass);
      cabin.position.set(0, 1.25, -.15); car.add(cabin);
      car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      car.position.copy(toWorld(s.x + s.w / 2, s.y + pk.stall.depth / 2, .06));
      parking.add(car);
    });

    // ---------- plaza PL01
    const plaza = group('plaza');
    const pl = D.plaza;
    box(pl.x, pl.y, pl.width, pl.depth, .07, 0, M.paving, plaza, false);
    for (const b of pl.reflecting_pools) {
      box(b.x - .55, b.y - .55, b.width + 1.1, b.depth + 1.1, .45, 0, M.white, plaza);
      box(b.x, b.y, b.width, b.depth, .4, .07, M.water, plaza, false);
    }
    for (const b of pl.planters) {
      box(b.x - .25, b.y - .25, b.width + .5, b.depth + .5, .7, 0, M.white, plaza);
      box(b.x + .05, b.y + .05, b.width - .1, b.depth - .1, .55, .65, M.hedge, plaza);
    }
    for (const b of pl.benches) box(b.x, b.y, b.width, b.depth, .45, 0, M.white, plaza);
    const sc = pl.sculpture;
    box(sc.x - .5, sc.y - .5, sc.width + 1, sc.depth + 1, .3, 0, M.concrete, plaza);
    extrude(shapeFrom([[132, 52], [136, 53], [133, 56], [134, 53.5]]), 3.6, .3, M.white, plaza);

    // ---------- pedestrian routes and crossings
    const walks = group('walks');
    for (const w of D.pedestrian_routes) strip(w.points, w.width + .3, .1, 0, M.edge, walks, w.width + .3);
    for (const w of D.pedestrian_routes) strip(w.points, w.width, .12, 0, M.path, walks, w.width);
    const zebra = [];
    for (let y = 20.3; y < 28; y += 1.05) zebra.push(m4(153, y + .24, .13, 3, 1, .48));
    for (let x = 98.5; x < 104; x += .8) zebra.push(m4(x + .2, 28, .13, .4, 1, 2.4));
    instanced(new THREE.BoxGeometry(1, .03, 1), M.line, zebra, walks, false);

    // ---------- buildings
    const buildings = group('buildings');
    const pickables = [], labels = [], fins = [];
    const solids = b => {
      const r = { x: b.x, y: b.y, w: b.width, d: b.depth };
      if (!b.atrium) return [r];
      const a = { x: b.atrium.x, y: b.atrium.y, w: b.atrium.width, d: b.atrium.depth };
      return [
        { x: r.x, y: r.y, w: r.w, d: a.y - r.y },
        { x: r.x, y: a.y + a.d, w: r.w, d: r.y + r.d - (a.y + a.d) },
        { x: r.x, y: a.y, w: a.x - r.x, d: a.d },
        { x: a.x + a.w, y: a.y, w: r.x + r.w - (a.x + a.w), d: a.d }
      ];
    };
    // Four thin glazing slabs around a rectangle; inward=true faces into an atrium.
    const ribbon = (r, z0, h, parent, inward = false) => {
      const t = .1, o = .03;
      box(r.x, inward ? r.y + o : r.y - o - t, r.w, t, h, z0, M.glass, parent, false);
      box(r.x, inward ? r.y + r.d - o - t : r.y + r.d + o, r.w, t, h, z0, M.glass, parent, false);
      box(inward ? r.x + o : r.x - o - t, r.y, t, r.d, h, z0, M.glass, parent, false);
      box(inward ? r.x + r.w - o - t : r.x + r.w + o, r.y, t, r.d, h, z0, M.glass, parent, false);
    };
    for (const b of D.buildings) {
      const g = new THREE.Group(); g.name = b.id; g.userData.building = b; buildings.add(g); pickables.push(g);
      const H = HEIGHTS[b.id] ?? b.floors * 4, ff = FLOOR_TO_FLOOR[b.id] ?? 4;
      const top = b.id === 'P01' ? 6.0 : H - .45; // P01's raised monitor reaches the 8 m roof line
      box(b.x - .3, b.y - .3, b.width + .6, b.depth + .6, .6, 0, M.concrete, g);
      for (const r of solids(b)) {
        box(r.x, r.y, r.w, r.d, top - .6, .6, M.white, g);
        box(r.x - .15, r.y - .15, r.w + .3, r.d + .3, .45, top, M.white, g);
      }
      // Ribbon windows per floor; S01 gets taller observation glazing.
      for (let f = 0; f < b.floors; f++) {
        const z0 = .6 + f * ff + ff * (b.id === 'S01' ? .18 : .3);
        const h = ff * (b.id === 'S01' ? .62 : .42);
        ribbon({ x: b.x, y: b.y, w: b.width, d: b.depth }, z0, h, g);
        if (b.atrium) ribbon({ x: b.atrium.x, y: b.atrium.y, w: b.atrium.width, d: b.atrium.depth }, z0, h, g, true);
      }
      // Vertical white fins on the long facades.
      if (b.id !== 'S01') {
        const alongX = b.width >= b.depth, len = alongX ? b.width : b.depth;
        for (let k = 1.2; k <= len - 1.2; k += 2.4) {
          const fh = top - .6, zc = .6;
          if (alongX) {
            fins.push(m4(b.x + k, b.y - .25, zc, .14, fh, .5));
            fins.push(m4(b.x + k, b.y + b.depth + .25, zc, .14, fh, .5));
          } else {
            fins.push(m4(b.x - .25, b.y + k, zc, .5, fh, .14));
            fins.push(m4(b.x + b.width + .25, b.y + k, zc, .5, fh, .14));
          }
        }
      }
      // Screened roof plant.
      const eqW = Math.min(8, b.width * .3), eqD = Math.min(5, b.depth * .18);
      if (b.id !== 'S01') {
        box(b.x + 2, b.y + b.depth - 2 - eqD, eqW, eqD, 1.6, top + .45, M.graphite, g);
        box(b.x + 2 + eqW + 1.5, b.y + b.depth - 2 - eqD, eqW * .5, eqD, 1.1, top + .45, M.graphite, g);
      }
      if (b.atrium) {
        const a = b.atrium;
        box(a.x, a.y, a.width, a.depth, .25, .35, M.hedge, g, false);
        box(a.x + 3, a.y + 3, a.width - 6, a.depth - 6, .3, .35, M.paving, g, false);
        box(a.x, a.y, a.width, a.depth, .12, top + .3, M.skylight, g, false);
        // Entrance canopy on the plaza axis.
        box(132, 78.6, 13, 3.4, .35, 4.3, M.white, g);
        for (const cx of [133, 144]) box(cx - .15, 78.9, .3, .3, 4.3, 0, M.graphite, g);
      }
      if (b.core) { // H01 core expressed as a glazed roof lantern, plus deep eaves
        const c = b.core;
        box(c.x, c.y, c.width, c.depth, 1.6, top + .45, M.glass, g);
        box(c.x - .3, c.y - .3, c.width + .6, c.depth + .6, .3, top + 2.05, M.white, g);
        box(b.x - 1.2, b.y - 1.2, b.width + 2.4, b.depth + 2.4, .3, top + .15, M.white, g);
      }
      if (b.id === 'P01') {
        box(b.x + 4, b.y + b.depth / 2 - 3.5, b.width - 8, 7, 1.6, top + .45, M.glass, g);
        box(b.x + 3.7, b.y + b.depth / 2 - 3.8, b.width - 7.4, 7.6, .35, top + 2.05, M.white, g);
      }
      if (['L01', 'L02', 'L03'].includes(b.id)) { // clerestory daylight strip
        box(b.x + b.width / 2 - 1.5, b.y + 3, 3, b.depth - 6, .9, top + .45, M.glass, g);
        box(b.x + b.width / 2 - 1.8, b.y + 2.8, 3.6, b.depth - 5.6, .2, top + 1.35, M.white, g);
      }
      const door = DOORS[b.id];
      if (door) {
        const [dx, dy, face, dw] = door;
        if (face === 'S' || face === 'N') {
          const yy = face === 'S' ? dy - .35 : dy + .05;
          box(dx - dw / 2, yy, dw, .3, 2.8, 0, M.glass, g, false);
          if (!b.atrium) box(dx - dw / 2 - .6, face === 'S' ? dy - 1.9 : dy, dw + 1.2, 1.9, .25, 3.1, M.white, g);
        } else {
          const xx = face === 'W' ? dx - .35 : dx + .05;
          box(xx, dy - dw / 2, .3, dw, 2.8, 0, M.glass, g, false);
          box(face === 'W' ? dx - 1.9 : dx, dy - dw / 2 - .6, 1.9, dw + 1.2, .25, 3.1, M.white, g);
        }
      }
      labels.push({ id: b.id, name: b.name, position: toWorld(b.x + b.width / 2, b.y + b.depth / 2, H + 3), height: H });
    }
    instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), M.white, fins, buildings);

    // ---------- gate G01, canopy and pedestrian portal
    const gate = group('gate');
    const cn = D.gate.canopy;
    extrude(shapeFrom([[cn.x, cn.y], [cn.x + cn.width, cn.y], [cn.x + cn.width - 3, cn.y + cn.depth], [cn.x + 3, cn.y + cn.depth]]), .45, 5.4, M.white, gate);
    for (const [x, y] of [[125, 4], [146, 4], [126, 12], [143, 12]]) box(x - .2, y - .2, .4, .4, 5.4, 0, M.graphite, gate);
    box(130.6, -7, .8, 20, .18, 0, M.concrete, gate);
    for (const x of [125.9, 136.1]) {
      box(x - .3, 5.3, .6, .6, 1.1, 0, M.graphite, gate);
      const arm = box(x - .06, 5.55, .12, .12, 3.6, 1.1, M.white, gate); // raised barrier arm
      arm.rotation.z = x < 131 ? -.12 : .12;
    }
    box(120.5, .5, 3.4, .7, 2.6, 0, M.white, gate);
    box(135.8, .5, 4, .7, 2.6, 0, M.white, gate);
    const pp = D.gate.pedestrian_portal;
    box(pp.x, pp.y, .6, pp.depth, 3.2, 0, M.white, gate);
    box(pp.x + pp.width - .6, pp.y, .6, pp.depth, 3.2, 0, M.white, gate);
    box(pp.x, pp.y, pp.width, pp.depth, .35, 3.2, M.white, gate);
    box(pp.x + 2.7, pp.y + 3, .1, 5, 2.2, 0, M.glass, gate, false);
    box(pp.x + 5.2, pp.y + 3, .1, 5, 2.2, 0, M.glass, gate, false);

    // ---------- white perimeter wall
    const wall = group('wall');
    const outline = [[124, .6], [.6, .6], [.6, 149.4], [239.4, 149.4], [239.4, .6], [157, .6]];
    const t = D.perimeter_security.wall_plan_thickness;
    strip(outline, t, 3.2, 0, M.white, wall, t, true);
    strip(outline, t + .25, .14, 3.2, M.concrete, wall, t + .25, false);
    strip([[148, .6], [149, .6]], t, 3.2, 0, M.white, wall, 0, true);

    // ---------- lighting poles (bases in grass verges)
    const lights = group('lighting');
    const glows = [];
    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,240,205,.9)'); gr.addColorStop(.4, 'rgba(255,232,190,.35)'); gr.addColorStop(1, 'rgba(255,230,190,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
    })();
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const [x, y] of D.lighting.pole_locations) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 6, 8), M.graphite);
      pole.position.copy(toWorld(x, y, 3)); finish(pole, lights);
      box(x - .5, y - .15, 1, .3, .18, 6, M.lamp, lights, false);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), glowMat);
      glow.rotation.x = -Math.PI / 2; glow.position.copy(toWorld(x, y, .2)); glow.visible = false;
      lights.add(glow); glows.push(glow);
    }

    // ---------- pine forest outside the wall (no interior trees per landscape rule)
    const forest = group('forest');
    const rand = rng(2024), trunks = [], low = [], high = [];
    let placed = 0, tries = 0;
    while (placed < 1900 && tries < 20000) {
      tries++;
      const x = -340 + rand() * (W + 680), y = -300 + rand() * (Hs + 600);
      if (x > -9 && x < W + 9 && y > -9 && y < Hs + 9) continue;
      if (Math.abs(x - 131) < 16 && y < 0) continue; // keep R02 approach clear
      const dx = (x - CX) / 420, dy = (y - CY) / 340;
      if (dx * dx + dy * dy > 1) continue;
      const s = .75 + rand() * .7, rot = rand() * 6.28;
      trunks.push(m4(x, y, 1.2 * s, s, s, s, rot));
      low.push(m4(x, y, 5 * s, s, s, s, rot));
      high.push(m4(x, y, 8.6 * s, s, s, s, rot));
      placed++;
    }
    instanced(new THREE.CylinderGeometry(.22, .32, 2.4, 6), M.trunk, trunks, forest, false);
    instanced(new THREE.ConeGeometry(2.7, 7.2, 7), M.pine, low, forest);
    instanced(new THREE.ConeGeometry(1.8, 5.4, 7), M.pine2, high, forest);
    // Far forest: continues past the near ellipse to the sierra foothills with an irregular,
    // thinning edge so the woodland no longer stops at a hard line. No shadows (outside the shadow map).
    const farLow = [], farHigh = [];
    placed = 0; tries = 0;
    while (placed < 7500 && tries < 90000) {
      tries++;
      const x = -1150 + rand() * (W + 2300), y = -1050 + rand() * (Hs + 2100);
      const dx = (x - CX) / 420, dy = (y - CY) / 340;
      if (dx * dx + dy * dy <= 1) continue;
      if (Math.abs(x - r02x) < 16 && y < 0) continue;
      const ang = Math.atan2(y - CY, x - CX), dist = Math.hypot(x - CX, y - CY);
      const edge = 1000 + 110 * Math.sin(3 * ang + .7) + 70 * Math.sin(7 * ang + 2.1);
      if (dist > edge || rand() > 1 - (dist - 400) / edge * .55) continue;
      const s = .9 + rand() * .9, rot = rand() * 6.28;
      farLow.push(m4(x, y, 5 * s, s, s, s, rot));
      farHigh.push(m4(x, y, 8.6 * s, s, s, s, rot));
      placed++;
    }
    instanced(new THREE.ConeGeometry(2.7, 7.2, 6), M.pine, farLow, forest, false);
    instanced(new THREE.ConeGeometry(1.8, 5.4, 6), M.pine2, farHigh, forest, false);

    const S01 = D.buildings.find(b => b.id === 'S01');
    const pk0 = D.parking;
    return {
      root, layers, pickables, labels, toWorld, materials: M,
      heights: HEIGHTS,
      nav: makeNav(D),
      doors: DOORS,
      parking: { stalls, occupied: [3, 9, 17, 25, 36], aisleY: (pk0.row_y[0] + pk0.stall.depth + pk0.row_y[1]) / 2,stallDepth: pk0.stall.depth },
      s01Roof: { x: S01.x + S01.width / 2, y: S01.y + S01.depth / 2, z: HEIGHTS.S01 - .45 },
      setNight(night) {
        M.glass.emissiveIntensity = night ? .26 : 0;
        M.lamp.emissiveIntensity = night ? 3 : .15;
        glows.forEach(g => { g.visible = night; });
      }
    };
  };
})();
