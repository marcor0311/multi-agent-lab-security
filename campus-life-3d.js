// Campus life for the 3D twin: cars entering and leaving PK01 through G01, a delivery van to P01,
// staff walking between buildings, and simulated face verification by K9 robots and drones
// against the authorised-staff list. Proposal-level simulation; identities are fictitious.
// Classic script: exposes window.createAlphaCampusLife(THREE, opts).
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const wrapAngle = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const NAMES = ['A. Rivera', 'M. Chen', 'L. Okafor', 'S. Müller', 'J. Pérez', 'K. Tanaka', 'R. Silva', 'D. Novak',
    'E. Haddad', 'T. Lindqvist', 'P. Moreau', 'N. Gupta', 'C. Ramos', 'I. Petrova', 'B. Mensah', 'F. Costa',
    'H. Kim', 'V. Rossi', 'G. Alvarez', 'O. Nwosu', 'Y. Sato', 'M. Duarte', 'A. Kowalski', 'L. Fischer'];
  const SHIRTS = ['#3f6f8f', '#b4553a', '#e3e1d8', '#5d7d4f', '#7b5c94', '#c79a3a', '#2f4f5f', '#9a3f4f', '#d9d4c3', '#486a7a'];
  const CAR_COLORS = ['#a8b4b5', '#edf0ec', '#597789', '#e1e5df', '#3b4348', '#8c2f2f', '#c9ccc7', '#2f4a63'];
  const DESTS = ['A01', 'A01', 'A01', 'L01', 'L02', 'L03', 'L04', 'H01', 'H01', 'P01'];

  window.createAlphaCampusLife = function createAlphaCampusLife(THREE, { D, campus, CSS2DObject, agents, onEvent = () => {} }) {
    const { Route, rng } = window.AlphaGeo;
    const { toWorld, nav, parking } = campus;
    const root = new THREE.Group(); root.name = 'life';
    const fx = new THREE.Group(); fx.name = 'recognition';
    const rnd = rng(77);
    const R = (a, b) => a + rnd() * (b - a);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, metalness: .1, ...o });
    const M = {
      tyre: mat('#1d2124', { roughness: .9 }), glass: mat('#2f3f48', { roughness: .15, metalness: .5 }),
      head: mat('#fff6dc', { emissive: '#fff1c8', emissiveIntensity: .2 }),
      tail: mat('#7a1515', { emissive: '#ff2a2a', emissiveIntensity: .3 }),
      pants: mat('#2c3338', { roughness: .85 }), shoe: mat('#1a1d1f', { roughness: .9 }),
      skin: ['#e0b48f', '#b98563', '#8a5a3c', '#f1cfb0'].map(c => mat(c, { roughness: .8 })),
      tactical: mat('#20262b', { roughness: .8 }), helmet: mat('#15191c', { roughness: .5, metalness: .3 }),
      red: new THREE.MeshBasicMaterial({ color: '#ff3030' }), blue: new THREE.MeshBasicMaterial({ color: '#2f6bff' }),
      off: new THREE.MeshBasicMaterial({ color: '#2a2f33' }), white: new THREE.MeshBasicMaterial({ color: '#f4f6f8' }),
      amber: new THREE.MeshBasicMaterial({ color: '#ffb020' })
    };
    const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z); mesh.castShadow = true; return mesh;
    };

    // ---------- doors (walk target just outside each main door)
    const doorPts = Object.fromEntries(Object.entries(campus.doors).map(([id, [x, y, face]]) => {
      const o = 1.3, p = face === 'S' ? [x, y - o] : face === 'N' ? [x, y + o] : face === 'W' ? [x - o, y] : [x + o, y];
      return [id, { id, x: p[0], y: p[1] }];
    }));
    delete doorPts.S01; // staff do not wander into the security station
    const nearestDoor = (x, y) => Object.values(doorPts).reduce((b, d) => (Math.hypot(d.x - x, d.y - y) < Math.hypot(b.x - x, b.y - y) ? d : b));

    // ---------- vehicles
    const makeVehicle = (kind, color) => {
      const g = new THREE.Group();
      const tall = !['car', 'hostile', 'police'].includes(kind), big = ['swat', 'eod'].includes(kind);
      const L = big ? 6.2 : tall ? 5.4 : 4.4, Wd = big ? 2.3 : tall ? 2.05 : 1.82;
      const LIGHTS = { swat: [M.red, M.blue], police: [M.red, M.blue], eod: [M.amber, M.amber] };
      const paint = mat(color, { roughness: .35, metalness: .45 });
      let lamps = null;
      if (tall) {
        g.add(box(L, 1.95, Wd, paint, 0, 1.42, 0));
        g.add(box(.06, .75, Wd * .86, M.glass, L / 2 + .01, 1.9, 0));
        g.add(box(L * .55, .55, .06, M.glass, L * .12, 1.9, Wd / 2 + .01));
        g.add(box(L * .55, .55, .06, M.glass, L * .12, 1.9, -Wd / 2 - .01));
        if (kind === 'swat') g.add(box(L * .7, .04, Wd * .9, mat('#c7a63a'), -.4, 2.41, 0)); // roof ID panel
      } else {
        g.add(box(L, .7, Wd, paint, 0, .75, 0));
        g.add(box(L * .52, .55, Wd * .9, M.glass, -.15, 1.37, 0));
        if (kind === 'police') g.add(box(L * .5, .2, Wd + .02, M.white, .3, .8, 0));
      }
      if (LIGHTS[kind]) {
        const y = tall ? 2.5 : 1.72, x = tall ? L / 2 - .7 : -.15;
        const r = box(.4, .16, .6, LIGHTS[kind][0], x, y, .38), b = box(.4, .16, .6, LIGHTS[kind][1], x, y, -.38);
        g.add(r, b); lamps = [r, b, LIGHTS[kind]];
      }
      const wheel = new THREE.CylinderGeometry(.36, .36, .26, 14).rotateX(Math.PI / 2);
      for (const sx of [1, -1]) for (const sz of [1, -1]) {
        const w = new THREE.Mesh(wheel, M.tyre); w.position.set(sx * L * .32, .36, sz * (Wd / 2 - .05)); g.add(w);
      }
      const lampY = tall ? .95 : .82;
      for (const sz of [1, -1]) {
        g.add(box(.05, .14, .34, M.head, L / 2 + .01, lampY, sz * Wd * .32));
        g.add(box(.05, .14, .34, M.tail, -L / 2 - .01, lampY, sz * Wd * .32));
      }
      return { group: g, lamps };
    };

    const vehicles = [];
    let lockdown = false, trafficHold = false, evac = null, simNow = 0;
    const FAR = -900, LANE_IN = 133.4, LANE_OUT = 128.6, AISLE = parking.aisleY;
    const say = (agent, text, kind = '') => onEvent({ agent, kind, text });
    const limitAt = (x, y) => y < -6 ? 12 : (x < 104 && y > 29 && y < 50) ? 2.6 : 6;

    const addVehicle = (kind, color, route, stops = [], opts = {}) => {
      const model = makeVehicle(kind, color);
      root.add(model.group);
      const v = {
        kind, model, g: model.group, route, s: opts.s ?? 0, v: opts.v ?? 0, vmax: opts.vmax, wait: 0, pull: 0,
        stops: stops.map(([x, y, t, label]) => ({ s: route.project(x, y), t, label, done: false })),
        reverseLen: opts.reverseLen || 0, onEnd: opts.onEnd, civilian: kind === 'car' || kind === 'van', parked: false, plate: plate()
      };
      vehicles.push(v); poseVehicle(v, 1);
      return v;
    };
    const removeVehicle = v => { root.remove(v.g); vehicles.splice(vehicles.indexOf(v), 1); };
    const setRoute = (v, route, stops = [], opts = {}) => {
      Object.assign(v, { route, s: 0, v: 0, parked: false, reverseLen: opts.reverseLen || 0, onEnd: opts.onEnd,
        stops: stops.map(([x, y, t, label]) => ({ s: route.project(x, y), t, label, done: false })) });
    };
    function plate() { const L = 'ABCDEFGHJKLMNPRSTVWXYZ'; return `${L[Math.floor(rnd() * 22)]}${L[Math.floor(rnd() * 22)]}${L[Math.floor(rnd() * 22)]}-${Math.floor(R(100, 999))}`; }

    const stepVehicle = (v, dt) => {
      if (v.parked) { v.v = 0; return; }
      if (v.wait > 0) { v.wait -= dt; v.v = 0; return; }
      const p = v.route.sample(v.s);
      const dir = [Math.cos(p.heading), Math.sin(p.heading)];
      let target = v.vmax ?? limitAt(p.x, p.y);
      if (trafficHold && v.civilian) target = 0;
      const st = v.stops.find(x => !x.done);
      if (st) {
        const d = st.s - v.s;
        target = Math.min(target, Math.sqrt(2 * 2.5 * Math.max(0, d - .2)) + .3);
        if (d < .35) {
          st.done = true; v.wait = st.t;
          if (st.label) { const cut = st.label.indexOf(' '); say(st.label.slice(0, cut), `${st.label.slice(cut + 1)} · placa ${v.plate}`); }
        }
      }
      const ahead = v.route.sample(v.s + 6);
      if (Math.abs(wrapAngle(ahead.heading - p.heading)) > .4) target = Math.min(target, v.civilian ? 3.2 : 6);
      if (v.civilian) {
        for (const o of vehicles) {
          if (o === v || o.parked || !o.pos) continue;
          const dx = o.pos.x - v.pos.x, dy = o.pos.y - v.pos.y;
          const ah = dx * dir[0] + dy * dir[1], lat = Math.abs(-dx * dir[1] + dy * dir[0]);
          if (ah > 0 && ah < 9 && lat < 1.8) target = Math.min(target, Math.max(0, (ah - 6) * 1.2));
        }
      }
      for (const h of v.kind === 'hostile' ? [] : people) {
        if (h.inside || h.removed) continue;
        const dx = h.x - v.pos.x, dy = h.y - v.pos.y;
        const ah = dx * dir[0] + dy * dir[1], lat = Math.abs(-dx * dir[1] + dy * dir[0]);
        if (ah > 0 && ah < 7 && lat < 1.6) target = Math.min(target, Math.max(0, (ah - 3) * 1.2));
      }
      const acc = target > v.v ? (v.civilian ? 2.8 : 5) : 7;
      v.v += Math.max(-acc * dt, Math.min(acc * dt, target - v.v));
      v.s += v.v * dt;
      if (v.s >= v.route.length) { v.s = v.route.length; v.v = 0; const cb = v.onEnd; v.onEnd = null; if (cb) cb(v); }
    };
    const poseVehicle = (v, dt) => {
      if (!vehicles.includes(v)) return;
      const p = v.route.sample(v.s);
      const hd = p.heading + (v.s < v.reverseLen ? Math.PI : 0);
      v.yaw = v.yaw === undefined ? hd : v.yaw + wrapAngle(hd - v.yaw) * Math.min(1, dt * 4);
      // Civilian cars on the approach road pull onto the shoulder during an alert.
      v.pull += ((trafficHold && v.civilian && p.y < -2 ? 1 : 0) - v.pull) * Math.min(1, dt * 1.5);
      const off = v.pull * 3.2;
      v.pos = { x: p.x + Math.sin(p.heading) * off, y: p.y - Math.cos(p.heading) * off };
      v.g.position.copy(toWorld(v.pos.x, v.pos.y, .02));
      v.g.rotation.y = v.yaw;
      if (v.model.lamps) {
        const on = Math.floor(clock * 5) % 2 === 0, [a, b, [ma, mb]] = v.model.lamps;
        a.material = on ? ma : M.off; b.material = on ? M.off : mb;
      }
      if (v.crash) { v.g.rotation.z = -.06; v.g.rotation.x = .04; }
    };

    // ---------- parking cycle: G01 → PK01 stall → driver walks to a building → returns → leaves
    const taken = new Set(parking.occupied);
    parking.stalls.forEach((st, k) => { st.k = k; });
    const stallCentre = st => [st.x + st.w / 2, st.y + parking.stallDepth / 2];
    const inRoute = st => {
      const [cx, cy] = stallCentre(st), up = st.row === 0 ? -1 : 1;
      return new Route([[LANE_IN, FAR], [LANE_IN, 16], [130, 26], [44, 26], [38.8, 31], [38.8, AISLE],
        [cx - 3, AISLE], [cx, AISLE + up * 2.6], [cx, cy - up * .3]]);
    };
    const outRoute = st => {
      const [cx, cy] = stallCentre(st);
      return new Route([[cx, cy], [cx, AISLE], [101.2, AISLE], [101.2, 30], [104.5, 22], [125, 22], [LANE_OUT, 17], [LANE_OUT, FAR]]);
    };
    const GATE_IN = [LANE_IN, 1], GATE_OUT = [LANE_OUT, 10];

    const people = [];
    let pscale = 1.7;
    const newIdentity = () => ({ name: pick(NAMES), id: `EMP-${Math.floor(R(1000, 9999))}`, authorized: true });

    const carArrives = (st, s = 0) => {
      taken.add(st.k);
      const v = addVehicle('car', pick(CAR_COLORS), inRoute(st), [[...GATE_IN, R(3, 5), 'G01 Acceso autorizado']], { s, onEnd: parkCar });
      v.stall = st;
      return v;
    };
    function parkCar(v) {
      v.parked = true;
      const [cx, cy] = stallCentre(v.stall);
      const dest = doorPts[pick(DESTS)];
      const p = addPerson({ identity: newIdentity(), at: [cx + 1.5, cy], role: 'driver' });
      p.car = v; p.phase = 'toOffice'; p.next = toCar;
      walkTo(p, dest.x, dest.y, q => { q.phase = 'office'; goInside(q, R(70, 220)); });
    }
    function toCar(p) {
      const [cx, cy] = stallCentre(p.car.stall);
      p.phase = 'toCar';
      walkTo(p, cx + 1.5, cy, q => { removePerson(q); carLeaves(q.car); });
    }
    function carLeaves(v) {
      const [, cy] = stallCentre(v.stall);
      setRoute(v, outRoute(v.stall), [[...GATE_OUT, 2, 'G01 Salida registrada']], {
        reverseLen: Math.abs(cy - AISLE), onEnd: () => { removeVehicle(v); }
      });
      taken.delete(v.stall.k);
    }
    const vanRoute = () => {
      const loop = D.roads[0];
      const ringPts = window.AlphaGeo.roundedRectPoints(loop.x - 2, loop.y - 2, loop.width + 4, loop.depth + 4, loop.radius + 2, 8);
      return new Route([[LANE_IN, FAR], [LANE_IN, 16], [137, 22], ...ringPts, [124, 22], [LANE_OUT, 17], [LANE_OUT, FAR]]);
    };
    const vanArrives = (s = 0) => addVehicle('van', '#e8ebe7', vanRoute(),
      [[...GATE_IN, 4, 'G01 Proveedor autorizado'], [185, 22, 22, 'P01 Entrega en muelle'], [...GATE_OUT, 2, 'G01 Salida registrada']],
      { s, onEnd: v => removeVehicle(v) });

    // ---------- people
    const GEAR = {
      swat: { top: '#20262b', legs: '#20262b', helmet: '#15191c' }, police: { top: '#22324f', legs: '#1c2533', helmet: '#22324f' },
      eod: { top: '#4d5a3a', legs: '#4d5a3a', helmet: '#3a4430' }
    };
    const gearMats = {};
    const gearMat = c => gearMats[c] || (gearMats[c] = mat(c, { roughness: .8 }));
    const makePerson = (shirt, gear) => {
      const root = new THREE.Group();
      const g = new THREE.Group(); root.add(g);
      const G = GEAR[gear];
      const top = G ? gearMat(G.top) : mat(shirt, { roughness: .85 }), legsM = G ? gearMat(G.legs) : M.pants;
      const skin = pick(M.skin);
      const legs = [], arms = [];
      for (const z of [.1, -.1]) {
        const hip = new THREE.Group(); hip.position.set(0, .9, z); g.add(hip);
        hip.add(box(.15, .84, .16, legsM, 0, -.42, 0));
        hip.add(box(.26, .08, .14, M.shoe, .05, -.86, 0));
        legs.push(hip);
      }
      g.add(box(.26, .62, .44, top, 0, 1.22, 0));
      if (gear === 'swat' || gear === 'eod') g.add(box(.34, .5, .5, gearMat(G.helmet), 0, 1.24, 0));
      for (const z of [.28, -.28]) {
        const sh = new THREE.Group(); sh.position.set(0, 1.5, z); g.add(sh);
        sh.add(box(.11, .6, .11, top, 0, -.3, 0));
        arms.push(sh);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), skin); head.position.y = 1.68; head.castShadow = true; g.add(head);
      if (G && G.helmet) { const h = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 8, 0, TAU, 0, Math.PI / 2), gearMat(G.helmet)); h.position.y = 1.7; g.add(h); }
      return { group: root, body: g, legs, arms };
    };
    function addPerson({ identity, shirt = pick(SHIRTS), at, speed = R(1.15, 1.45), kind = 'staff', role = 'ambient', gear = null }) {
      const model = makePerson(shirt, gear);
      model.group.scale.setScalar(pscale);
      root.add(model.group);
      const el = document.createElement('div'); el.className = 'face-tag';
      const tag = new CSS2DObject(el); tag.position.y = 2.25; tag.visible = false; model.group.add(tag);
      const p = { model, g: model.group, identity, kind, role, gear, x: at[0], y: at[1], heading: R(-3, 3), speed, path: null, ps: 0,
        inside: false, removed: false, gait: R(0, TAU), tagEl: el, tag, tagT: 0, lastScan: -1e9, onArrive: null, pose: null };
      people.push(p); posePerson(p, 0, 0);
      return p;
    }
    function removePerson(p) { p.removed = true; root.remove(p.g); people.splice(people.indexOf(p), 1); }
    function walkPath(p, pts, onArrive) { p.path = new Route([[p.x, p.y], ...pts]); p.ps = 0; p.onArrive = onArrive; }
    function walkTo(p, x, y, onArrive, direct = false) {
      const pts = nav.find([p.x, p.y], [x, y], { direct });
      p.path = new Route(pts.length > 1 ? pts : [[p.x, p.y], [x + .01, y]]); p.ps = 0; p.onArrive = onArrive;
    }
    function goInside(p, secs) { p.inside = true; p.insideFor = secs; p.path = null; p.tag.visible = false; p.doorId = nearestDoor(p.x, p.y).id; }
    const emerge = p => { p.inside = false; p.sheltered = false; if (p.next) p.next(p); };
    const ambientNext = p => {
      const here = nearestDoor(p.x, p.y);
      const d = pick(Object.values(doorPts).filter(x => x !== here && !(evac && evac.doors.has(x.id))));
      walkTo(p, d.x, d.y, q => goInside(q, R(20, 90)));
    };
    const stepPerson = (p, dt) => {
      if (p.inside) {
        if (!lockdown && !(evac && evac.doors.has(p.doorId)) && (p.insideFor -= dt) <= 0) emerge(p);
        return;
      }
      if (p.down) { p.moving = false; return; }
      if (!p.path) { p.moving = false; return; }
      if (p.wait > 0) { p.wait -= dt; p.moving = false; return; }
      const hurry = (lockdown || p.evacuating) && p.kind === 'staff' ? 1.9 : 1;
      p.ps += p.speed * hurry * dt;
      const q = p.path.sample(p.ps);
      p.x = q.x; p.y = q.y; p.heading = q.heading; p.moving = true;
      if (p.ps >= p.path.length) { p.moving = false; p.path = null; const cb = p.onArrive; p.onArrive = null; if (cb) cb(p); }
    };
    let clock = 0;
    function posePerson(p, simDt, realDt) {
      p.g.visible = !p.inside;
      p.g.position.copy(toWorld(p.x, p.y, p.z ?? .1));
      p.yaw = p.yaw === undefined ? p.heading : p.yaw + wrapAngle(p.heading - p.yaw) * Math.min(1, simDt * 8);
      p.g.rotation.y = p.yaw;
      const moving = p.moving && simDt > 0;
      if (moving) p.gait += realDt * TAU * 1.5 * (p.speed / 1.3) * Math.min(2.5, simDt / Math.max(realDt, 1e-4));
      const sw = moving ? Math.sin(p.gait) * .55 : 0;
      p.model.legs[0].rotation.z = sw; p.model.legs[1].rotation.z = -sw;
      const body = p.model.body;
      body.rotation.x = p.pose === 'down' ? Math.PI / 2 : p.pose === 'kneel' ? .35 : 0;
      body.position.y = p.pose === 'down' ? .18 : p.pose === 'kneel' ? -.35 : 0;
      if (p.pose === 'hands') { p.model.arms.forEach(a => { a.rotation.z = Math.PI - .25; }); }
      else if (p.pose === 'work') { p.model.arms.forEach((a, i) => { a.rotation.z = -1.2 + Math.sin(clock * 5 + i) * .2; }); }
      else { p.model.arms[0].rotation.z = -sw * .8; p.model.arms[1].rotation.z = sw * .8; }
      if (p.tagT > 0) { p.tagT -= realDt; if (p.tagT <= 0 && !p.tagSticky) p.tag.visible = false; }
    }

    // ---------- face verification (K9 head camera ±70°, drone gimbal footprint)
    const beams = [];
    const beamMat = { ok: new THREE.LineBasicMaterial({ color: '#3ee08f', transparent: true, depthWrite: false }),
      bad: new THREE.LineBasicMaterial({ color: '#ff4a3d', transparent: true, depthWrite: false }) };
    const tmp = new THREE.Vector3();
    const beam = (a, p, ok) => {
      a.group.getWorldPosition(tmp);
      if (a.kind === 'K9') tmp.y += .75 * a.group.scale.y;
      const geo = new THREE.BufferGeometry().setFromPoints([tmp.clone(), toWorld(p.x, p.y, 1.7 * pscale)]);
      const line = new THREE.Line(geo, (ok ? beamMat.ok : beamMat.bad).clone());
      fx.add(line); beams.push({ line, t: 1.4 });
    };
    let onUnknown = () => {};
    const scan = () => {
      for (const a of agents) {
        if (!a.plan) continue;
        let range;
        if (a.kind !== 'D') range = 11;
        else { if (a.phase === 'charging' || a.pos.z < 6) continue; range = Math.max(6, a.pos.z * Math.tan(24 * Math.PI / 180)) * 1.15; }
        for (const p of people) {
          if (p.inside || p.removed || p.kind === 'responder') continue;
          const dx = p.x - a.plan.x, dy = p.y - a.plan.y;
          if (Math.hypot(dx, dy) > range) continue;
          const ok = p.identity.authorized;
          if (simNow - p.lastScan < (ok ? 90 : 4)) continue;
          if (a.kind !== 'D' && Math.abs(wrapAngle(Math.atan2(dy, dx) - a.yaw)) > 1.2) continue;
          p.lastScan = simNow;
          const conf = ok ? (R(94, 99.6)).toFixed(1) : Math.round(R(6, 28));
          p.tagEl.className = `face-tag ${ok ? 'ok' : 'bad'}`;
          p.tagEl.textContent = ok ? `✓ ${p.identity.name} · ${conf} %` : `✕ NO REGISTRADO · ${conf} %`;
          p.tag.visible = true; p.tagT = 3;
          beam(a, p, ok);
          if (ok) onEvent({ agent: a.id, kind: a.kind, text: `Rostro verificado · ${p.identity.name} (${p.identity.id}) · ${conf} %` });
          else if (!p.flagged) {
            p.flagged = true; p.tagSticky = true;
            onEvent({ agent: a.id, kind: a.kind, alert: true, text: `Rostro NO registrado · coincidencia máx. ${conf} % · alerta a S01` });
            onUnknown(p, a);
          }
        }
      }
    };

    // ---------- initial population and spawner
    const free = () => parking.stalls.filter(st => !taken.has(st.k));
    for (let n = 0; n < 4; n++) { // cars already parked, drivers at work
      const st = pick(free()), v = carArrives(st);
      v.s = v.route.length; v.stops.forEach(x => { x.done = true; }); v.onEnd = null; v.parked = true; poseVehicle(v, 1);
      const p = addPerson({ identity: newIdentity(), at: [0, 0], role: 'driver' });
      const d = doorPts[pick(DESTS)]; p.x = d.x; p.y = d.y;
      p.car = v; p.phase = 'office'; p.next = toCar; goInside(p, R(15, 160));
    }
    for (let n = 0; n < 9; n++) { // staff moving between buildings
      const d = pick(Object.values(doorPts));
      const p = addPerson({ identity: newIdentity(), at: [d.x, d.y] });
      p.next = ambientNext;
      if (n < 6) ambientNext(p); else goInside(p, R(5, 40));
      if (p.path) { p.ps = R(0, p.path.length * .8); stepPerson(p, 0); }
    }
    carArrives(pick(free()), 640);
    vanArrives(820);
    let spawnT = 8;

    // Evacuation: people in (or heading to) the listed buildings go to an assembly point and wait.
    const resumeOf = p => {
      if (p.role === 'driver' && (p.phase === 'toOffice' || p.phase === 'office')) {
        const d = doorPts[p.doorId] || nearestDoor(p.x, p.y);
        return q => { q.phase = 'toOffice'; walkTo(q, d.x, d.y, r => { r.phase = 'office'; goInside(r, R(40, 140)); }); };
      }
      return p.next;
    };
    const evacuate = (doorIds, [ax, ay], { shelterOthers = false } = {}) => {
      evac = { doors: new Set(doorIds), ax, ay };
      trafficHold = true;
      let n = 0;
      for (const p of people) {
        if (p.kind !== 'staff' || p.down) continue;
        const heading = p.path && p.onArrive && !p.inside;
        const target = p.inside ? p.doorId : heading ? nearestDoor(p.path.pts[p.path.pts.length - 1][0], p.path.pts[p.path.pts.length - 1][1]).id : null;
        const near = !p.inside && Math.hypot(p.x - ax, p.y - ay) > 0 && evac.doors.has(nearestDoor(p.x, p.y).id);
        if (evac.doors.has(target) || near) {
          p.resume = resumeOf(p);
          const a = n++ * 2.399, r = 2 + Math.sqrt(n) * 1.6;
          const go = q => { q.evacuating = true; walkTo(q, ax + Math.cos(a) * r, ay + Math.sin(a) * r, z => { z.evacuating = false; z.atAssembly = true; z.heading = Math.atan2(ay - z.y, ax - z.x); }); };
          if (p.inside) { p.inside = false; p.wait = R(0, 6); go(p); } else go(p);
        } else if (shelterOthers && !p.inside) {
          const d = nearestDoor(p.x, p.y);
          p.resume = resumeOf(p);
          walkTo(p, d.x, d.y, q => { goInside(q, 0); q.sheltered = true; });
        }
      }
      if (shelterOthers) lockdown = true;
    };
    const endEvacuation = () => {
      if (!evac) return;
      for (const p of people) {
        if (p.kind !== 'staff') continue;
        if (p.atAssembly || p.evacuating) {
          p.atAssembly = p.evacuating = false;
          const fn = p.resume || ambientNext; p.resume = null;
          p.wait = R(0, 8); fn(p);
        } else if (p.sheltered) { p.insideFor = R(2, 14); }
      }
      evac = null; lockdown = false; trafficHold = false;
    };
    const setLockdown = on => {
      if (on === lockdown) return;
      lockdown = on; trafficHold = on;
      for (const p of people) {
        if (p.kind !== 'staff') continue;
        if (on && !p.inside) {
          const d = nearestDoor(p.x, p.y);
          walkTo(p, d.x, d.y, q => { goInside(q, 0); q.sheltered = true; });
        } else if (!on && p.sheltered) {
          p.insideFor = p.role === 'driver' && p.phase === 'toOffice' ? R(40, 120) : R(2, 14);
          if (p.phase === 'toOffice') p.phase = 'office';
        }
      }
    };

    return {
      root, fx, people, vehicles, doorPts, addPerson, removePerson, walkTo, walkPath, addVehicle, setRoute, removeVehicle,
      setLockdown, evacuate, endEvacuation, nearestDoor,
      holdTraffic(on) { trafficHold = on; },
      get lockdown() { return lockdown; },

      set onUnknown(fn) { onUnknown = fn; },
      get personScale() { return pscale; },
      setScale(s) { pscale = s === 3 ? 1.7 : 1; people.forEach(p => p.g.scale.setScalar(pscale)); },
      setNight(night) { M.head.emissiveIntensity = night ? 3 : .2; M.tail.emissiveIntensity = night ? 2.2 : .3; },
      update(simDt, realDt, simTime) {
        clock += realDt; simNow = simTime;
        let left = simDt;
        while (left > 1e-6) {
          const dt = Math.min(.1, left); left -= dt;
          for (const v of vehicles.slice()) stepVehicle(v, dt);
          for (const p of people.slice()) stepPerson(p, dt);
          if (!trafficHold && (spawnT -= dt) <= 0) {
            spawnT = R(16, 34);
            const moving = vehicles.filter(v => v.civilian && !v.parked).length;
            if (moving < 4) {
              const f = free();
              if (rnd() < .8 && f.length > 6) carArrives(pick(f)); else vanArrives();
            }
          }
        }
        if (simDt > 0) scan();
        vehicles.forEach(v => poseVehicle(v, simDt));
        people.forEach(p => posePerson(p, simDt, realDt));
        for (let i = beams.length - 1; i >= 0; i--) {
          const b = beams[i]; b.t -= realDt;
          b.line.material.opacity = Math.max(0, b.t / 1.4);
          if (b.t <= 0) { fx.remove(b.line); b.line.geometry.dispose(); beams.splice(i, 1); }
        }
      }
    };
  };
})();
