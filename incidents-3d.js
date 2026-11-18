// Incident engine for the 3D twin: seven threat scenarios, rule-based tasking with optional local-AI
// refinement and agent radio, field humanoids (HX) bridging the minutes until external units arrive.
// Conceptual training scenarios only; real protocols come from the site security plan and local law.
// Classic script: exposes window.createAlphaIncidents(THREE, opts).
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const fmt = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const BREACHES = [
    { x: 62, y: 146.6, sector: 'D-N', wall: 'N' }, { x: 188, y: 146.6, sector: 'D-N', wall: 'N' },
    { x: 236.6, y: 118, sector: 'D-E', wall: 'E' }, { x: 236.6, y: 50, sector: 'D-E', wall: 'E' },
    { x: 3.4, y: 104, sector: 'D-O', wall: 'O' }, { x: 3.4, y: 40, sector: 'D-O', wall: 'O' }
  ];
  const UNITS = {
    SWAT: { label: 'SWAT', vehicle: 'swat', color: '#1c2125', crew: 6, gear: 'swat', eta: [240, 300] },
    EOD: { label: 'Antibombas', vehicle: 'eod', color: '#4d5a3a', crew: 2, gear: 'eod', eta: [420, 500] },
    POLICIA: { label: 'Policía', vehicle: 'police', color: '#f1f3f4', crew: 2, gear: 'police', eta: [270, 350] }
  };
  const HELI_ETA = [150, 210];
  // Which agent kinds can take each action, and which objective kinds it applies to (null = any objective or place).
  const ACTIONS = {
    contain: { kinds: ['K9', 'HX'], on: ['intruder'], verb: 'contén a' },
    restrain: { kinds: ['HX'], on: ['intruder'], verb: 'retén (autorizado) a' },
    block: { kinds: ['HX'], on: null, verb: 'bloquea' },
    guard: { kinds: ['K9', 'HX'], on: null, verb: 'custodia' },
    cordon: { kinds: ['K9'], on: ['package', 'drone_down', 'vehicle'], verb: 'cierra perímetro en' },
    guide: { kinds: ['K9'], on: null, verb: 'guía al personal en' },
    inspect: { kinds: ['HX'], on: ['package', 'vehicle'], verb: 'inspecciona' },
    carry: { kinds: ['HX'], on: null, verb: 'traslada' },
    recover: { kinds: ['HX'], on: ['drone_down'], verb: 'recupera' },
    track: { kinds: ['D'], on: null, verb: 'sigue desde el aire a' },
    overwatch: { kinds: ['D'], on: null, verb: 'vigila desde arriba' },
    intercept: { kinds: ['D'], on: ['drone'], verb: 'intercepta' },
    search: { kinds: ['D'], on: null, verb: 'haz barrido de búsqueda en' },
    patrol: { kinds: ['K9', 'D'], on: null, verb: 'vuelve a rutina' },
    standby: { kinds: ['HX'], on: null, verb: 'regresa a base' }
  };
  const PERSONA = {
    K9: 'robot cuadrúpedo de patrulla con cámara térmica, altavoz y verificación facial',
    D: 'dron de vigilancia con cámara EO/IR y red de captura',
    HX: 'robot humanoide de seguridad sin armas, con altavoz, escáner, capacidad de carga y retención física solo autorizada por S01'
  };

  window.createAlphaIncidents = function createAlphaIncidents(THREE, { D, campus, CSS2DObject, sec, life, comms, onEvent = () => {}, onRadio = () => {}, onState = () => {} }) {
    const { Route, roundedRectPoints } = window.AlphaGeo;
    const toWorld = campus.toWorld;
    const root = new THREE.Group(); root.name = 'incidents';
    const R = (a, b) => a + Math.random() * (b - a);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: .2, ...o });
    const label = (text, cls) => { const el = document.createElement('div'); el.className = `agent-label ${cls}`; el.textContent = text; return new CSS2DObject(el); };
    let I = null; // active incident

    // ---------- places (doors, gate, assembly points, campus centre for search sweeps)
    const PLACES = { G01: { id: 'G01', x: 131, y: 9, label: 'G01' }, CAMPUS: { id: 'CAMPUS', x: 120, y: 75, label: 'campus' },
      AP_PLAZA: { id: 'AP_PLAZA', x: 134, y: 40, label: 'punto de reunión plaza' },
      AP_OESTE: { id: 'AP_OESTE', x: 27, y: 100, label: 'punto de reunión oeste' },
      AP_ESTE: { id: 'AP_ESTE', x: 213, y: 45, label: 'punto de reunión este' } };
    for (const d of Object.values(life.doorPts)) PLACES[d.id] = { id: d.id, x: d.x, y: d.y, label: `acceso ${d.id}` };
    const farthestAP = p => ['AP_PLAZA', 'AP_OESTE', 'AP_ESTE'].map(k => PLACES[k]).sort((a, b) => dist(b, p) - dist(a, p))[0];

    // ---------- visual effects
    const redMat = new THREE.MeshBasicMaterial({ color: '#ff2b2b', transparent: true, opacity: .5, depthWrite: false });
    const OBJ_COLORS = { intruder: '#ff2b2b', vehicle: '#ff2b2b', drone: '#ff2b2b', drone_down: '#ffb020', package: '#ffd21a' };
    const wallFlash = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ff3a2e', transparent: true, opacity: .5, depthWrite: false }));
    wallFlash.visible = false; root.add(wallFlash);
    const cordon = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 96), new THREE.MeshBasicMaterial({ color: '#ffd21a', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    cordon.rotation.x = -Math.PI / 2; cordon.visible = false; root.add(cordon);
    const soft = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    // Particle pool: smoke (grey, rising) for the gate crash.
    const pool = (n, color, additive, size) => {
      const items = [];
      for (let i = 0; i < n; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color, transparent: true, depthWrite: false, opacity: 0, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
        s.visible = false; s.scale.setScalar(size); root.add(s); items.push({ s, life: 0, max: 1, v: new THREE.Vector3(), a: null, b: null, size });
      }
      return items;
    };
    const smoke = pool(40, '#5d6166', false, 4);
    const emit = (items, init) => { const p = items.find(q => q.life <= 0); if (p) { p.s.visible = true; init(p); } };
    const stepParticles = dt => {
      for (const p of smoke) if (p.life > 0) {
        p.life -= dt; const k = 1 - p.life / p.max;
        p.s.position.addScaledVector(p.v, dt); p.s.scale.setScalar(p.size * (1 + k * 2.5)); p.s.material.opacity = .55 * (1 - k);
        if (p.life <= 0) p.s.visible = false;
      }
    };

    // ---------- helicopter (police, with searchlight)
    const makeHeli = () => {
      const g = new THREE.Group(); g.rotation.order = 'YXZ';
      const navy = mat('#1f2f4a', { roughness: .35, metalness: .4 }), white = mat('#eef1f2'), dark = mat('#202528');
      const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
      add(new THREE.SphereGeometry(1.4, 16, 12).scale(1.9, 1, 1), navy, 0, 0, 0);
      add(new THREE.SphereGeometry(1.1, 14, 10).scale(1.2, .8, .95), mat('#1d2a33', { roughness: .1, metalness: .6 }), 1.6, .25, 0);
      add(new THREE.BoxGeometry(5.6, .08, 2.82), white, -.2, -.1, 0);
      add(new THREE.CylinderGeometry(.35, .2, 6, 10).rotateZ(Math.PI / 2), navy, -5, .35, 0);
      add(new THREE.BoxGeometry(1.2, 1.6, .14), navy, -7.8, 1, 0);
      for (const z of [.95, -.95]) add(new THREE.BoxGeometry(4.2, .1, .12), dark, 0, -1.55, z);
      add(new THREE.SphereGeometry(.3, 10, 8), mat('#fff8d6', { emissive: '#fff3c4', emissiveIntensity: 2 }), 2.3, -1.1, 0);
      const rotor = new THREE.Group(); rotor.position.set(0, 1.55, 0); g.add(rotor);
      rotor.add(new THREE.Mesh(new THREE.BoxGeometry(11.5, .06, .32), dark));
      rotor.add(new THREE.Mesh(new THREE.BoxGeometry(.32, .06, 11.5), dark));
      rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, .02, 32), new THREE.MeshBasicMaterial({ color: '#c9d6db', transparent: true, opacity: .14, depthWrite: false })));
      const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, .04, .16), dark); tail.position.set(-7.9, 1, .2); g.add(tail);
      const strobe = add(new THREE.SphereGeometry(.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3030' }), -2.5, .9, 0);
      const tag = label('H-1 · helicóptero policial', 'ag-heli'); tag.position.y = 4.5; g.add(tag);
      return { group: g, rotor, tail, strobe };
    };
    const coneGeo = new THREE.ConeGeometry(1, 1, 28, 1, true).translate(0, -.5, 0);
    const searchlight = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: .1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    searchlight.visible = false; root.add(searchlight);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(8, 40), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: .16, depthWrite: false }));
    spot.rotation.x = -Math.PI / 2; spot.visible = false; root.add(spot);
    let heli = null, heliScale = 1.6;

    // ---------- hostile drone, package, wrecked car props
    const makeHostileDrone = () => {
      const g = new THREE.Group(); const dark = mat('#26292c');
      g.add(new THREE.Mesh(new THREE.BoxGeometry(.5, .16, .5), dark));
      for (const a of [Math.PI / 4, -Math.PI / 4]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, .05, .06), dark); arm.rotation.y = a; g.add(arm); }
      const led = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3030' })); led.position.set(.26, -.05, 0); g.add(led);
      const net = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: '#e8f2f4', wireframe: true, transparent: true, opacity: .8 }));
      net.visible = false; g.add(net);
      const chute = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 8, 0, TAU, 0, Math.PI / 2), mat('#ff8c1a', { side: THREE.DoubleSide }));
      chute.position.y = 2.6; chute.visible = false; g.add(chute);
      const tag = label('Dron NO autorizado', 'ag-hostile'); tag.position.y = 1.4; g.add(tag);
      return { group: g, net, chute };
    };

    // ---------- objectives
    const objectives = new Map();
    const addObjective = o => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.4, 5, 56), redMat.clone());
      ring.material.color.set(OBJ_COLORS[o.kind] || '#ff2b2b'); ring.rotation.x = -Math.PI / 2; root.add(ring);
      Object.assign(o, { ring, status: o.status || 'activo' });
      objectives.set(o.id, o); return o;
    };
    const removeObjective = id => { const o = objectives.get(id); if (!o) return; root.remove(o.ring); objectives.delete(id); };
    const targetOf = id => { const o = objectives.get(id); if (o) return o.at(); return PLACES[id] || null; };
    const mainTarget = () => { const o = [...objectives.values()][0]; return o ? o.at() : PLACES.G01; };

    // ---------- radio and reports
    const say = (agent, kind, text, alert = false) => onEvent({ agent, kind, text, alert });
    const radio = (from, to, text, source = 'reglas') => onRadio({ from, to, text, source, alert: false });
    const posOf = a => a.plan || a.cur || a.pos || (a.route && a.route.sample(a.s));
    const peersOf = a => sec.agents.filter(b => b !== a).map(b => ({ b, d: dist(posOf(a), posOf(b)) }))
      .sort((x, y) => x.d - y.d).slice(0, 3)
      .map(({ b, d }) => ({ id: b.id, tarea: I && I.assign.get(b.id) ? `${I.assign.get(b.id).action} ${I.assign.get(b.id).obj}` : 'rutina', distancia_m: Math.round(d) }));
    const unitIds = () => (I ? I.units.filter(u => u.state !== 'enroute').map(u => u.def.label) : []);
    // Agent speaks: local-AI voice when available, rule template otherwise. Requests feed back into tasking.
    const speak = (agentId, to, fallback, ctxExtra = {}) => {
      const a = sec.byId(agentId);
      if (!a || !comms.enabled) { radio(agentId, to, fallback); return; }
      const as = I && I.assign.get(agentId), o = as && objectives.get(as.obj);
      const context = { t: I ? fmt(I.t) : '', ...ctxExtra,
        tu_estado: { tarea: as ? `${as.action} ${as.obj}` : 'rutina', bateria: Math.round(a.battery), en_posicion: !!a.onSite, estado: a.state },
        objetivo: o ? { id: o.id, tipo: o.kind, estado: o.status, distancia_m: Math.round(dist(posOf(a), o.at())) } : null,
        cerca: peersOf(a), externos: I ? I.units.map(u => ({ unidad: u.def.label, estado: unitText(u) })) : [] };
      const toList = ['S01', 'TODOS', ...sec.agents.map(x => x.id).filter(id => id !== agentId), ...unitIds()];
      const inc = I;
      comms.voice({ agent: agentId, persona: PERSONA[a.kind], context, to: toList }).then(out => {
        if (!out || typeof out.text !== 'string' || !out.text.trim()) { radio(agentId, to, fallback); return; }
        radio(agentId, toList.includes(out.to) ? out.to : to, out.text.trim().slice(0, 140), 'IA local');
        if (inc === I && I) handleRequest(a, out.request);
      });
    };
    const handleRequest = (a, req) => {
      if (!req || req === 'ninguna' || !I) return;
      if (req === 'refuerzo' && a.battery < 30) req = 'relevo'; // small models mix these up; battery decides
      const last = I.reqAt.get(a.id) || -1e9;
      if (I.t - last < 60) return;
      I.reqAt.set(a.id, I.t);
      const as = I.assign.get(a.id);
      if (req === 'relevo' && a.battery < 35 && as) {
        const sub = freeAgents(ACTIONS[as.action].kinds).sort((x, y) => dist(posOf(x), targetOf(as.obj)) - dist(posOf(y), targetOf(as.obj)))[0];
        if (!sub) { radio('S01', a.id, 'Negativo, sin unidades libres para relevo. Mantén posición.'); return; }
        say('S01', '', `Relevo por batería: ${sub.id} sustituye a ${a.id} (${as.action} ${as.obj})`);
        assignAgent(sub.id, as.action, as.obj, 'IA local', `relevo de ${a.id}`); unassign(a.id);
      } else if (req === 'refuerzo' && as && objectives.has(as.obj)) {
        const o = objectives.get(as.obj);
        if (['contained', 'restrained', 'detained', 'escort', 'controlled'].includes(o.status)) { radio('S01', a.id, `Negativo, ${o.id} ya está bajo control.`); return; }
        const sub = freeAgents(ACTIONS[as.action].kinds).sort((x, y) => dist(posOf(x), o.at()) - dist(posOf(y), o.at()))[0];
        if (!sub) { radio('S01', a.id, 'Sin unidades libres. Refuerzo externo en camino.'); return; }
        say('S01', '', `Refuerzo solicitado por ${a.id}: ${sub.id} → ${as.action} ${o.id}`);
        assignAgent(sub.id, as.action, as.obj, 'IA local', `refuerzo para ${a.id}`);
      }
    };
    // Facts are logged immediately; the radio line is voiced by the agent (AI) or by template.
    const report = (agentId, kind, fact, { alert = false, to = 'S01', replan = false } = {}) => {
      say(agentId, kind, fact, alert);
      if (sec.byId(agentId)) speak(agentId, to, fact, { evento: fact });
      else radio(agentId, to, fact);
      if (replan) { ruleFill(); requestPlan(fact); }
    };

    // ---------- tasking
    const jobFor = (a, action, objId) => {
      const o = objectives.get(objId), t = () => targetOf(objId) || PLACES.G01;
      const same = [...I.assign].filter(([id, x]) => id !== a.id && x.action === action && x.obj === objId).length;
      const slot = same * TAU / 3 + (a.kind === 'HX' ? 1 : .4);
      const face = () => (o ? o.at() : mainTarget());
      const tag = o ? o.id : (PLACES[objId] ? PLACES[objId].label : objId);
      switch (action) {
        case 'contain': return { kind: 'ring', target: t, radius: a.kind === 'HX' ? 3 : 4.5, slot, label: `Contención · ${tag}` };
        case 'restrain': return { kind: 'ring', target: t, radius: .9, slot: 0, label: `Retención autorizada · ${tag}`, effect: 'restrain' };
        case 'block': return { kind: 'hold', target: () => PLACES.G01, label: 'Bloqueo de G01', face: () => ({ x: 131, y: -30 }) };
        case 'guard': return { kind: o ? 'ring' : 'hold', target: t, radius: 3, slot, label: `Custodia · ${tag}`, face };
        case 'cordon': return { kind: 'ring', target: t, radius: (o && o.cordon) || 22, slot: same * TAU / 3 + .9, label: `Perímetro · ${tag}`, face };
        case 'guide': return { kind: 'hold', target: t, dx: 3, label: `Guía · ${tag}`, face: () => mainTarget() };
        case 'inspect': return { kind: 'ring', target: t, radius: 1.5, slot: 3.6, label: `Inspección · ${tag}`, effect: 'arm' };
        case 'carry': return { kind: 'hold', target: () => (o && o.carryTo) || PLACES.G01, label: `Traslado · ${tag}`, effect: 'carry', face: () => ({ x: 131, y: 0 }) };
        // Spiral sweep: the orbit breathes between 50 m and 100 m so the camera footprint reaches the wall strip.
        case 'search': return { kind: 'orbit', target: () => PLACES.CAMPUS, get radius() { return I ? 75 - 25 * Math.cos(I.t / 30) : 55; }, alt: 42, label: 'Barrido de búsqueda · campus' };
        case 'recover': return { kind: 'ring', target: t, radius: 1.3, slot: 2.4, label: `Recuperación · ${tag}`, effect: 'arm' };
        case 'track': return { kind: 'orbit', target: t, radius: 10, alt: o && o.at().z !== undefined ? 4 : 18, label: `Seguimiento aéreo · ${tag}` };
        case 'overwatch': return { kind: 'orbit', target: t, radius: 32, alt: o && o.at().z !== undefined ? 12 : 34, dir: -1, label: `Vigilancia aérea · ${tag}` };
        case 'intercept': return { kind: 'orbit', target: t, radius: 4, alt: 1, dir: same ? -1 : 1, label: `Intercepción · ${tag}` };
        default: return null;
      }
    };
    const valid = (a, action, objId) => {
      const A = ACTIONS[action];
      if (!A || !A.kinds.includes(a.kind)) return false;
      if (action === 'patrol' || action === 'standby') return true;
      const o = objectives.get(objId);
      if (!o && !PLACES[objId]) return false;
      if (A.on && (!o || !A.on.includes(o.kind))) return false;
      if (I.sc.actions && !I.sc.actions.includes(action)) return false;
      return true;
    };
    const unassign = id => { if (!I.assign.has(id)) return; I.assign.delete(id); sec.release(id); };
    const assignAgent = (id, action, objId, source, why = '') => {
      const a = sec.byId(id); if (!a || !valid(a, action, objId)) return false;
      const cur = I.assign.get(id);
      if (cur && cur.action === action && cur.obj === objId) return false;
      if (action === 'patrol' || action === 'standby') { unassign(id); radio('S01', id, `${id}, ${ACTIONS[action].verb}.`, source); return true; }
      const job = jobFor(a, action, objId);
      sec.assign(id, job);
      I.assign.set(id, { action, obj: objId, source, since: I.t });
      const tgt = targetOf(objId), far = tgt ? Math.round(dist(posOf(a), tgt)) : 0;
      const tag = objectives.has(objId) ? objId : PLACES[objId].label;
      radio('S01', id, `${id}, ${ACTIONS[action].verb} ${tag}${why ? ` (${why})` : ''}.`, source);
      speak(id, 'S01', `Recibido, ${ACTIONS[action].verb} ${tag}. ${far} m, ETA ${Math.max(1, Math.round(far / (a.kind === 'D' ? 12 : a.kind === 'HX' ? 4.5 : 3.2)))} s.`, { orden: `${ACTIONS[action].verb} ${tag}` });
      return true;
    };
    const freeAgents = kinds => sec.agents.filter(a => kinds.includes(a.kind) && !I.assign.has(a.id) && a.battery > 12);
    // Rules: keep valid assignments, fill each requirement (priority order) with the nearest free or
    // lower-priority agent. Also the safety net after every AI plan.
    const ruleFill = () => {
      if (!I) return [];
      const reqs = I.sc.requirements(ctx).filter(r => targetOf(r.obj));
      const pri = new Map();
      for (const [id, as] of [...I.assign]) {
        const idx = reqs.findIndex(r => r.action === as.action && r.obj === as.obj);
        const stillValid = valid(sec.byId(id), as.action, as.obj);
        if (!stillValid || (idx < 0 && as.source !== 'IA local')) unassign(id);
        else pri.set(id, idx < 0 ? 900 : idx);
      }
      const changed = [];
      reqs.forEach((r, idx) => {
        let have = [...I.assign.values()].filter(a => a.action === r.action && a.obj === r.obj).length;
        while (have < r.count) {
          const t = targetOf(r.obj);
          // Nearest candidate; agents already busy on a lower-priority job pay a 60 m penalty.
          const score = a => dist(posOf(a), t) + (pri.has(a.id) ? 60 : 0);
          const c = sec.agents.filter(a => ACTIONS[r.action].kinds.includes(a.kind) && (pri.get(a.id) ?? 1000) > idx && a.battery > 12)
            .sort((a, b) => score(a) - score(b))[0];
          if (!c) break;
          if (assignAgent(c.id, r.action, r.obj, 'reglas')) changed.push(c.id);
          pri.set(c.id, idx); have++;
        }
      });
      return changed;
    };
    const snapshot = why => ({
      t: fmt(I.t), incidente: I.sc.title, motivo: why,
      objetivos: [...objectives.values()].map(o => { const p = o.at(); return { id: o.id, tipo: o.kind, estado: o.status, pos: [Math.round(p.x), Math.round(p.y)], ...(p.z !== undefined ? { alt_m: Math.round(p.z) } : {}) }; }),
      agentes: sec.agents.map(a => { const p = posOf(a), as = I.assign.get(a.id);
        return { id: a.id, tipo: a.kind, pos: [Math.round(p.x), Math.round(p.y)], bateria: Math.round(a.battery), tarea: as ? `${as.action} ${as.obj}` : 'rutina',
          dist_m: Object.fromEntries([...objectives.values()].map(o => [o.id, Math.round(dist(p, o.at()))])) }; }),
      PLAN_ACTUAL: [...I.assign].map(([id, x]) => [id, x.action, x.obj]),
      requisitos: I.sc.requirements(ctx).map(r => `${r.action} ${r.obj} ×${r.count} (${ACTIONS[r.action].kinds.join('/')})`),
      acciones_por_tipo: Object.fromEntries(['K9', 'HX', 'D'].map(k => [k, (I.sc.actions || Object.keys(ACTIONS)).filter(x => ACTIONS[x].kinds.includes(k))])),
      externos: I.units.map(u => ({ unidad: u.def.label, estado: unitText(u) }))
    });
    const requestPlan = why => {
      if (!I || !comms.enabled) return;
      if (I.planBusy) { I.planPending = why; return; }
      I.planBusy = true;
      const inc = I;
      const ids = sec.agents.map(a => a.id);
      const objs = [...objectives.keys(), ...Object.keys(PLACES)];
      const acts = I.sc.actions || Object.keys(ACTIONS);
      comms.plan({ snapshot: snapshot(why), ids, actions: acts, objectives: objs }).then(res => {
        if (inc !== I) return;
        I.planBusy = false;
        if (res && Array.isArray(res.assignments)) {
          const changes = [];
          for (const x of res.assignments.slice(0, 8)) {
            if (!x || !ids.includes(x.agent)) continue;
            const cur = I.assign.get(x.agent);
            // Do not let the AI pull an agent that is already on site at its current job.
            if (cur && sec.byId(x.agent).onSite && !(cur.action === x.action && cur.obj === x.objective) && I.t - cur.since < 45) continue;
            if (assignAgent(x.agent, x.action, x.objective, 'IA local')) changes.push(`${x.agent}→${x.action} ${x.objective}`);
          }
          if (changes.length) say('IA', 'AI', `Plan refinado por IA local: ${changes.join(', ')}`);
          else say('IA', 'AI', 'IA local confirma el plan de reglas');
          for (const r of (res.radio || []).slice(0, 6)) {
            if (r && typeof r.text === 'string' && r.text.trim()) radio(r.from || 'S01', r.to || 'TODOS', r.text.trim().slice(0, 140), 'IA local');
          }
          const fixed = ruleFill();
          if (fixed.length) say('S01', '', `Reglas restauran cobertura mínima: ${fixed.join(', ')}`);
        }
        if (I.planPending) { const w = I.planPending; I.planPending = null; requestPlan(w); }
      });
    };

    // ---------- external units: ETA of minutes, then drive in from the end of the approach road
    const loop = D.roads[0];
    const ringRoute = new Route(roundedRectPoints(loop.x, loop.y, loop.width, loop.depth, loop.radius, 12), true);
    const roadPoints = (tx, ty, fromY = -1240) => {
      const s0 = ringRoute.project(131, loop.y), s1 = ringRoute.project(tx, ty), L = ringRoute.length;
      const fwd = ((s1 - s0) % L + L) % L, dirn = fwd <= L / 2 ? 1 : -1, span = dirn > 0 ? fwd : L - fwd;
      const pts = [[131, fromY], [131, 14]];
      for (let s = 0; s <= span; s += 4) { const p = ringRoute.sample(s0 + dirn * s); pts.push([p.x, p.y]); }
      const e = ringRoute.sample(s1); pts.push([e.x, e.y]);
      return pts;
    };
    const unitText = u => u.state === 'enroute' ? `ETA ${fmt(Math.max(0, u.eta - (I.t - u.t0)))}`
      : u.state === 'driving' ? `En el sitio en ${Math.max(0, Math.round((u.vehicle.route.length - u.vehicle.s) / 15))} s`
      : u.state === 'onsite' ? (u.statusText || 'En sitio') : 'Retirándose';
    const dispatch = (type, { target, onArrive }) => {
      const def = UNITS[type];
      const u = { type, def, eta: Math.round(R(...def.eta)), t0: I.t, state: 'enroute', vehicle: null, crew: [], target, onArrive };
      I.units.push(u);
      say('S01', '', `${def.label} solicitado · ETA ${fmt(u.eta)}`, true);
      return u;
    };
    const stepUnit = u => {
      if (u.state === 'enroute' && u.eta - (I.t - u.t0) <= 75) {
        const t = u.target(), pts = roadPoints(t.x, t.y);
        u.pts = pts;
        u.vehicle = life.addVehicle(def(u).vehicle, def(u).color, new Route(pts), [], { vmax: 19, v: 19, s: 160, onEnd: v => arrive(u, v) });
        const tag = label(def(u).label, `ag-unit ag-${u.type.toLowerCase()}`); tag.position.y = 3.6; u.vehicle.g.add(tag);
        u.state = 'driving';
        say(def(u).label, 'EXT', 'En la vía de acceso · entrando al campus');
      }
    };
    const def = u => u.def;
    const arrive = (u, v) => {
      if (!I) return;
      v.parked = true; u.state = 'onsite';
      for (let i = 0; i < u.def.crew; i++) {
        const a = i / u.def.crew * TAU;
        const p = life.addPerson({ identity: { name: `${u.def.label}-${i + 1}`, id: u.type, authorized: true },
          at: [v.pos.x + Math.cos(a) * 1.8, v.pos.y + Math.sin(a) * 1.8], speed: 3.2, kind: 'responder', gear: u.def.gear });
        p.slot = a + .3; p.repath = i * .15; u.crew.push(p);
      }
      radio(u.def.label, 'S01', `${u.def.label} en sitio con ${u.def.crew} efectivos. Asumimos el mando de nuestra parte.`);
      say(u.def.label, 'EXT', `Llegada al punto de despliegue · ${fmt(I.t)} desde la alerta`, true);
      if (u.onArrive) u.onArrive(u);
    };
    const reverseOut = (v, pts) => {
      const back = pts.slice().reverse(); back[back.length - 1] = [131, -1240];
      life.setRoute(v, new Route([[v.pos.x, v.pos.y], ...back.slice(1)]), [], { onEnd: x => life.removeVehicle(x) });
      v.vmax = 16;
    };
    const unitLeave = u => {
      if (u.state === 'enroute') { u.state = 'gone'; return; }
      if (!u.vehicle || !life.vehicles.includes(u.vehicle)) { u.state = 'gone'; return; }
      const v = u.vehicle;
      const crew = u.crew.filter(p => !p.removed);
      if (u.state === 'driving' || !crew.length) { reverseOut(v, u.pts); u.state = 'gone'; return; }
      u.state = 'leaving';
      let left = crew.length;
      crew.forEach(p => { p.speed = 1.6; life.walkTo(p, v.pos.x, v.pos.y, q => { life.removePerson(q); if (--left === 0) reverseOut(v, u.pts); }, true); });
      setTimeout(() => { if (life.vehicles.includes(v) && left > 0) { crew.forEach(p => { if (!p.removed) life.removePerson(p); }); left = 0; reverseOut(v, u.pts); } }, 60000);
    };

    // ---------- helicopter
    const dispatchHeli = () => {
      I.heli = { eta: Math.round(R(...HELI_ETA)), t0: I.t, state: 'enroute' };
      say('S01', '', `Helicóptero H-1 solicitado · ETA ${fmt(I.heli.eta)}`, true);
    };
    const stepHeli = (dt, clock) => {
      if (I && I.heli && I.heli.state === 'enroute' && I.heli.eta - (I.t - I.heli.t0) <= 25) {
        const t = mainTarget(), model = makeHeli(); model.group.scale.setScalar(heliScale); root.add(model.group);
        heli = { model, x: t.x - 1100, y: t.y - 1100, z: 140, heading: Math.PI / 4, mode: 'inbound', life: 40 };
        I.heli.state = 'flying';
        say('H-1', 'EXT', 'Contacto visual con el campus · aproximación');
      }
      if (!heli) { searchlight.visible = spot.visible = false; return; }
      const H = heli, t = I ? mainTarget() : null;
      if (H.mode === 'inbound' && t) {
        const want = Math.atan2(t.y - H.y, t.x - H.x), dd = Math.hypot(t.x - H.x, t.y - H.y);
        H.heading += Math.max(-.8 * dt, Math.min(.8 * dt, ((want - H.heading + Math.PI) % TAU + TAU) % TAU - Math.PI));
        H.x += Math.cos(H.heading) * 62 * dt; H.y += Math.sin(H.heading) * 62 * dt; H.z += (80 - H.z) * Math.min(1, dt * .5);
        if (dd < 80) { H.mode = 'orbit'; H.ang = Math.atan2(H.y - t.y, H.x - t.x); if (I) { I.heli.state = 'orbit'; report('H-1', 'EXT', 'H-1 en órbita a 75 m · reflector y cámara térmica sobre el objetivo'); } }
      } else if (H.mode === 'orbit' && t) {
        H.ang += 22 / 70 * dt;
        const ox = t.x + 70 * Math.cos(H.ang), oy = t.y + 70 * Math.sin(H.ang);
        H.x += (ox - H.x) * Math.min(1, dt * 1.5); H.y += (oy - H.y) * Math.min(1, dt * 1.5); H.z += (75 - H.z) * Math.min(1, dt);
        H.heading = Math.atan2(t.y - H.y, t.x - H.x);
      } else {
        H.mode = 'outbound'; H.x += Math.cos(H.heading) * 55 * dt; H.y += Math.sin(H.heading) * 55 * dt; H.z += 6 * dt; H.life -= dt;
        if (H.life <= 0) { root.remove(H.model.group); heli = null; searchlight.visible = spot.visible = false; return; }
      }
      H.model.group.position.copy(toWorld(H.x, H.y, H.z));
      H.model.group.rotation.y = H.heading; H.model.group.rotation.x = H.mode === 'orbit' ? -.12 : 0; H.model.group.rotation.z = -.08;
      H.model.rotor.rotation.y += .9; H.model.tail.rotation.z += 1.2;
      H.model.strobe.visible = Math.floor(clock * 2) % 2 === 0;
      const lit = H.mode === 'orbit' && t;
      searchlight.visible = spot.visible = !!lit;
      if (lit) {
        const from = H.model.group.position.clone(), to = toWorld(t.x, t.y, .3), dir = to.clone().sub(from), len = dir.length();
        searchlight.position.copy(from); searchlight.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
        searchlight.scale.set(8, len, 8); spot.position.copy(toWorld(t.x, t.y, .35));
      }
    };

    // ---------- detection by patrol
    // Ground robots (K9/HX) see 360° (lidar + cameras) within groundR; drones see their camera footprint.
    // Faces are checked by campus-life (onUnknown); vehicles and objects are checked here.
    const seenBy = (pos, groundR) => {
      for (const a of sec.agents) {
        if (!a.plan) continue;
        if (a.kind === 'D') {
          if (a.phase === 'charging' || !a.pos || a.pos.z < 6) continue;
          if (dist(a.plan, pos) < a.pos.z * Math.tan(24 * Math.PI / 180) * 1.1) return a;
        } else if (dist(a.plan, pos) < groundR) return a;
      }
      return null;
    };
    // First detection turns a covert scenario into an alert: dispatch, lockdown, tasking.
    const detect = (by, how) => {
      if (I.detected) return;
      I.detected = true; I.detectT = I.t; I.detectBy = by; I.detectHow = how;
      if (I.sc.onDetect) I.sc.onDetect(ctx);
      onState('alert', { key: I.key, title: I.sc.title, icon: I.sc.icon });
      ruleFill(); requestPlan(`detección (${how})`);
    };

    // ---------- intruders: hidden until a patrol sees their face, then tracked as objectives
    const GOAL_IDS = ['A01', 'H01', 'L02', 'L03', 'P01', 'L04'];
    const intruderGoals = from => GOAL_IDS.filter(id => dist(PLACES[id], from) > 45);
    const markIntruder = (id, p, goal) => addObjective({ id, kind: 'intruder', label: `intruso ${id}`, person: p, goal, at: () => ({ x: p.x, y: p.y }), status: 'advancing', near: 0 });
    // Undetected intruders try locked doors quietly and move on; no alarm is raised by the attempt.
    const spawnIntruder = (id, b, { entry = null, visible = false, goal = null } = {}) => {
      const p = life.addPerson({ identity: { name: 'Desconocido', id: '—', authorized: false }, shirt: '#22272b', at: [b.x, b.y], speed: visible ? 1.7 : 1.35, kind: 'intruder' });
      const h = { id, person: p, goal: goal || pick(intruderGoals(b)), tried: new Set() };
      p.hiddenId = id; I.hidden.set(id, h);
      const wander = () => {
        const g = PLACES[h.goal];
        life.walkTo(p, g.x, g.y, () => {
          const o = objectives.get(id);
          if (o) { if (o.status === 'advancing') { o.status = 'atDoor'; report('S01', '', `${id} intenta entrar en ${h.goal} · puerta en bloqueo, acceso denegado`, { alert: true, replan: true }); } return; }
          h.tried.add(h.goal);
          h.goal = pick(GOAL_IDS.filter(x => !h.tried.has(x)).concat(h.tried.size >= GOAL_IDS.length ? GOAL_IDS : []));
          p.wait = R(4, 9); wander();
        }, true);
      };
      if (entry) life.walkPath(p, entry, wander); else wander();
      if (visible) markIntruder(id, p, h.goal);
      return h;
    };
    const reveal = (p, agent) => {
      const h = I.hidden.get(p.hiddenId);
      if (!h || objectives.has(h.id)) return;
      const o = markIntruder(h.id, p, h.goal);
      report(agent.id, agent.kind, `Persona NO registrada detectada en patrulla · ${o.id} cerca de ${life.nearestDoor(p.x, p.y).id}`, { alert: true });
      if (!I.detected) detect(agent.id, 'patrulla'); else { ruleFill(); requestPlan(`${o.id} detectado`); }
    };
    const stepIntruders = dt => {
      const ground = sec.agents.filter(a => a.kind !== 'D' && a.plan);
      for (const o of objectives.values()) {
        if (o.kind !== 'intruder') continue;
        const p = o.person, pos = o.at();
        const near = ground.map(a => ({ a, d: dist(a.plan, pos) })).sort((x, y) => x.d - y.d);
        if (o.status === 'advancing' || o.status === 'atDoor') {
          // First close contact: the intruder changes course once to avoid the nearest robot.
          if (!o.fled && near[0] && near[0].d < 10 && o.status === 'advancing') {
            o.fled = true;
            const alt = intruderGoals(near[0].a.plan).filter(id => id !== o.goal).sort((x, y) => dist(PLACES[x], pos) - dist(PLACES[y], pos))[0];
            if (alt) { o.goal = alt; I.hidden.get(o.id).goal = alt;
              life.walkTo(p, PLACES[alt].x, PLACES[alt].y, () => { if (o.status === 'advancing') o.status = 'atDoor'; }, true);
              report(near[0].a.id, near[0].a.kind, `${o.id} cambia de rumbo hacia ${alt} al ver a ${near[0].a.id}`, { alert: true, replan: true }); }
          }
          const n7 = near.filter(x => x.d < 7).length;
          o.near = near[0] && near[0].d < 5 ? o.near + dt : 0;
          if (n7 >= 2 || o.near > 12) {
            o.status = 'contained'; p.path = null; p.pose = 'hands'; p.tagEl.textContent = `✕ ${o.id} · CONTENIDO`; p.tag.visible = true; p.tagSticky = true;
            report(near[0].a.id, near[0].a.kind, `${o.id} contenido · manos visibles · ${fmt(I.t - I.detectT)} desde la detección`, { alert: true, replan: true });
          }
        } else if (o.status === 'contained') {
          const hx = sec.agents.find(a => a.kind === 'HX' && I.assign.get(a.id)?.action === 'restrain' && I.assign.get(a.id)?.obj === o.id && a.onSite);
          if (hx && !o.authorized) {
            o.authorized = true;
            radio(hx.id, 'S01', `Junto a ${o.id}. Solicito autorización para retención física.`);
            I.timers.push({ at: I.t + 4, fn: () => {
              if (!objectives.has(o.id) || o.status !== 'contained') return;
              say('S01', '', `Operador humano de S01 AUTORIZA retención de ${o.id} por ${hx.id} (simulado)`, true);
              radio('S01', hx.id, `Autorizado. Retén a ${o.id} sin lesionar, hasta la llegada de SWAT.`);
              o.status = 'restrained'; p.pose = 'kneel'; p.tagEl.textContent = `✕ ${o.id} · RETENIDO`;
              report(hx.id, 'HX', `${o.id} retenido de forma segura · esperando custodia de SWAT`, { replan: true });
            } });
          }
        }
      }
      // SWAT crew close in (2 per active intruder) and take custody.
      const swat = I.units.find(u => u.type === 'SWAT' && u.state === 'onsite');
      if (!swat) return;
      const active = [...objectives.values()].filter(o => o.kind === 'intruder' && !['detained', 'escort'].includes(o.status));
      swat.crew.forEach((op, i) => {
        if (op.removed || op.escort) return;
        const o = active[Math.floor(i / 2) % Math.max(1, active.length)];
        if (!o) return;
        op.obj = o.id;
        if ((op.repath -= dt) > 0) return;
        op.repath = 1.2;
        life.walkTo(op, o.at().x + Math.cos(op.slot) * 1.8, o.at().y + Math.sin(op.slot) * 1.8, null, true);
      });
      for (const o of active) {
        if (swat.crew.filter(op => !op.removed && dist(op, o.at()) < 3.2).length < 2) continue;
        o.status = 'detained'; o.detT = I.t; o.person.path = null; o.person.pose = 'hands';
        o.person.tagEl.textContent = `✕ ${o.id} · DETENIDO`;
        say('SWAT', 'EXT', `${o.id} bajo custodia de SWAT · ${fmt(I.t - I.detectT)} desde la detección`, true);
        radio('SWAT', 'TODOS', `${o.id} asegurado. Robots, liberen la zona.`);
        ruleFill(); requestPlan(`${o.id} detenido`);
      }
      for (const o of [...objectives.values()]) {
        if (o.kind !== 'intruder' || o.status !== 'detained' || I.t - o.detT < 6) continue;
        o.status = 'escort';
        const v = swat.vehicle, ops = swat.crew.filter(op => !op.removed && op.obj === o.id);
        o.person.pose = null; o.person.speed = 1.4;
        life.walkTo(o.person, v.pos.x, v.pos.y, q => { life.removePerson(q); removeObjective(o.id); }, true);
        ops.forEach(op => { op.escort = true; op.speed = 1.45; life.walkTo(op, v.pos.x + Math.cos(op.slot), v.pos.y + Math.sin(op.slot), null, true); });
      }
    };
    // Rules only use what S01 knows: detected intruders. A drone keeps sweeping in case there are more.
    const intruderReqs = (search = true) => {
      const os = [...objectives.values()].filter(o => o.kind === 'intruder' && !['detained', 'escort'].includes(o.status));
      const r = [];
      for (const o of os) r.push({ obj: o.id, action: o.status === 'advancing' || o.status === 'atDoor' ? 'contain' : 'restrain', count: 1 });
      for (const o of os) r.push({ obj: o.id, action: 'track', count: 1 });
      for (const o of os) if (o.status === 'advancing' || o.status === 'atDoor') r.push({ obj: o.id, action: 'contain', count: 2 });
      for (const o of os) if (o.status === 'contained' || o.status === 'restrained') r.push({ obj: o.id, action: 'contain', count: 1 });
      for (const o of os) if (o.status === 'advancing') r.push({ obj: o.goal, action: 'guard', count: 1 });
      if (search && I.detected) r.push({ obj: 'CAMPUS', action: 'search', count: 1 });
      return r;
    };
    const intrudersDone = () => I.hidden.size > 0 && [...I.hidden.values()].every(h => h.person.removed);
    const securityResponse = () => {
      life.setLockdown(true);
      say('S01', '', 'Bloqueo de edificios · personal a resguardo · tráfico detenido', true);
      dispatch('SWAT', { target: () => mainTarget() }); dispatchHeli();
    };
    const covertLine = () => (I.detected
      ? ['Detección', `${I.detectBy} · ${I.detectHow} · a los ${fmt(I.detectT)}`]
      : ['Detección', `Sin detectar · la patrulla sigue su ronda · ${fmt(I.t)}`]);

    // ---------- scenarios (security only)
    const SCENARIOS = {
      intrusion: {
        title: 'Intrusión por el muro', icon: '⚠', detection: 'Patrullaje',
        desc: 'Una persona salta el muro en un punto sin vigilancia y busca un acceso.',
        actions: ['contain', 'restrain', 'guard', 'block', 'track', 'overwatch', 'search', 'patrol', 'standby'],
        start(c) { const b = pick(BREACHES); c.where = 'ubicación desconocida'; spawnIntruder('I1', b); c.breach = b; },
        onDetect(c) { c.where = `cerca de ${life.nearestDoor(mainTarget().x, mainTarget().y).id}`; securityResponse(); },
        requirements: () => intruderReqs(),
        step: dt => stepIntruders(dt),
        done: () => intrudersDone(),
        status: () => [covertLine(), ...[...objectives.values()].filter(o => o.kind === 'intruder').map(o => [o.id, intruderText(o)])]
      },
      multi: {
        title: 'Intrusión coordinada', icon: '⚠', detection: 'Patrullaje',
        desc: 'Tres personas entran por sectores distintos; S01 no sabe cuántas son hasta encontrarlas.',
        actions: ['contain', 'restrain', 'guard', 'block', 'track', 'overwatch', 'search', 'patrol', 'standby'],
        start(c) {
          const bs = [...BREACHES].sort(() => Math.random() - .5).filter((b, i, arr) => arr.findIndex(x => x.sector === b.sector) === i).slice(0, 3);
          bs.forEach((b, i) => spawnIntruder(`I${i + 1}`, b));
          c.where = 'ubicación desconocida';
        },
        onDetect(c) { c.where = 'varios sectores'; securityResponse(); },
        requirements: () => intruderReqs(),
        step: dt => stepIntruders(dt),
        done: () => intrudersDone(),
        status: () => [covertLine(), ['Encontrados', `${[...objectives.values()].filter(o => o.kind === 'intruder').length + [...I.hidden.values()].filter(h => h.person.removed).length} (total desconocido)`],
          ...[...objectives.values()].filter(o => o.kind === 'intruder').map(o => [o.id, intruderText(o)])]
      },
      suspicious: {
        title: 'Vehículo sospechoso', icon: '🚙', detection: 'Patrullaje',
        desc: 'Un auto entra con credencial clonada, se estaciona fuera de zona y el conductor se escabulle.',
        actions: ['contain', 'restrain', 'guard', 'block', 'inspect', 'cordon', 'track', 'overwatch', 'search', 'patrol', 'standby'],
        start(c) {
          const east = Math.random() < .5;
          const pts = east
            ? [[133.4, -900], [133.4, 16], [137, 22], [210, 22], [224, 36], [224, 86], [229.5, 92]]
            : [[133.4, -900], [133.4, 16], [130, 26], [30, 26], [20, 36], [20, 70], [10.5, 76]];
          // Gate stop without a log line: the cloned credential looks valid to the reader.
          const v = life.addVehicle('car', '#3b4348', new Route(pts), [[133.4, 1, 3, null]], { s: 640, onEnd: car => {
            car.parked = true;
            const at = { x: car.pos.x + (east ? -1.6 : 1.6), y: car.pos.y };
            spawnIntruder('I1', at, { goal: east ? pick(['H01', 'P01']) : pick(['L01', 'L04']) });
          } });
          c.car = v; c.where = 'ubicación desconocida';
        },
        onDetect(c) { c.where = c.carSeen ? 'vehículo fuera de zona' : 'persona no registrada'; life.setLockdown(true); say('S01', '', 'Bloqueo de edificios · personal a resguardo', true); },
        requirements(c) {
          const r = [];
          const v = objectives.get('V1');
          r.push(...intruderReqs(false));
          if (v) {
            if (v.status !== 'inspeccionado') r.push({ obj: 'V1', action: 'inspect', count: 1 });
            r.push({ obj: 'V1', action: 'cordon', count: 1 });
            if (!objectives.has('I1') && !I.hidden.get('I1')?.person.removed) r.push({ obj: 'CAMPUS', action: 'search', count: 1 });
            r.push({ obj: 'V1', action: 'overwatch', count: 1 });
          } else if (I.detected) r.push({ obj: 'CAMPUS', action: 'search', count: 1 });
          return r;
        },
        step(dt, c) {
          const car = c.car;
          if (!c.carSeen && car.parked) {
            const a = seenBy(car.pos, 15);
            if (a) {
              c.carSeen = true;
              addObjective({ id: 'V1', kind: 'vehicle', label: 'vehículo sospechoso', at: () => car.pos, status: 'estacionado', cordon: 10 });
              report(a.id, a.kind, `Vehículo estacionado fuera de zona · placa ${car.plate} no registrada · sin conductor`, { alert: true });
              dispatch('POLICIA', { target: () => car.pos, onArrive: u => {
                u.statusText = 'Revisión del vehículo';
                u.crew.forEach((p, i) => life.walkTo(p, car.pos.x + (i ? 2 : -2), car.pos.y - 2, q => { q.pose = 'work'; }, true));
                I.timers.push({ at: I.t + 30, fn: () => { c.towed = true; life.removeVehicle(car); removeObjective('V1'); say('Policía', 'EXT', 'Vehículo asegurado y retirado con grúa', true); } });
              } });
              if (!I.detected) detect(a.id, 'patrulla'); else { ruleFill(); requestPlan('vehículo localizado'); }
            }
          }
          const v = objectives.get('V1');
          const hx = sec.agents.find(a => a.kind === 'HX' && a.effect === 'arm' && I.assign.get(a.id)?.obj === 'V1');
          if (v && hx && v.status !== 'inspeccionado') {
            c.inspT = (c.inspT || 0) + dt;
            if (c.inspT > 18) { v.status = 'inspeccionado'; report(hx.id, 'HX', 'Inspección exterior y bajo chasis: sin ocupantes ni objetos visibles · conductor ausente', { replan: true }); }
          }
          // The driver becomes a SWAT matter once found.
          if (objectives.has('I1') && !c.swat) { c.swat = true; dispatch('SWAT', { target: () => mainTarget() }); dispatchHeli(); }
          stepIntruders(dt);
        },
        done: c => c.towed && intrudersDone(),
        cleanup: c => { if (life.vehicles.includes(c.car)) life.removeVehicle(c.car); removeObjective('V1'); },
        status: c => [covertLine(), ['Vehículo', c.carSeen ? (objectives.get('V1')?.status || 'retirado') : 'No localizado'],
          ...[...objectives.values()].filter(o => o.kind === 'intruder').map(o => [o.id, intruderText(o)])]
      },
      ram: {
        title: 'Vehículo forzando G01', icon: '🚗', detection: 'Inmediata (destruye la entrada)',
        desc: 'Un auto a alta velocidad rompe la barrera de G01; el conductor huye a pie.',
        actions: ['contain', 'restrain', 'guard', 'block', 'cordon', 'track', 'overwatch', 'search', 'patrol', 'standby'],
        start(c) {
          c.where = 'R02'; c.ids = [];
          c.car = life.addVehicle('hostile', '#2b2b2b', new Route([[133.4, -1240], [133.4, 15]]), [], { vmax: 33, v: 33, s: 640, onEnd: car => {
            car.crash = true; car.parked = true;
            for (let i = 0; i < 18; i++) emit(smoke, p => { p.life = p.max = R(2, 4); p.s.position.copy(toWorld(car.pos.x + R(-1, 1), car.pos.y + 2, 1)); p.v.set(R(-.5, .5), R(1, 2), R(-.5, .5)); });
            I.timers.push({ at: I.t + 2.5, fn: () => {
              spawnIntruder('I1', { x: car.pos.x + 1.6, y: car.pos.y }, { visible: true, goal: 'A01' });
              report('S01', '', 'Conductor huye a pie hacia el interior · cámaras de G01 lo siguen', { alert: true, replan: true });
            } });
          } });
        },
        onDetect(c) {
          c.where = 'G01';
          addObjective({ id: 'V1', kind: 'vehicle', label: 'vehículo hostil', at: () => c.car.pos, status: 'impacto', cordon: 12 });
          securityResponse();
        },
        requirements: c => [{ obj: 'G01', action: 'block', count: 1 }, ...intruderReqs(false), { obj: 'V1', action: 'overwatch', count: objectives.has('I1') ? 0 : 1 }].filter(r => r.count > 0),
        step(dt, c) {
          if (!I.detected && c.car.pos && c.car.pos.y > 3) {
            say('G01', '', `IMPACTO en G01 · barrera destruida por vehículo a ${Math.round(c.car.v * 3.6)} km/h`, true);
            detect('G01', 'sensor de impacto');
          }
          stepIntruders(dt);
        },
        done: () => intrudersDone(),
        cleanup: c => { if (life.vehicles.includes(c.car)) life.removeVehicle(c.car); removeObjective('V1'); },
        status: c => [covertLine(), ['Vehículo', c.car.crash ? 'Detenido tras la barrera' : 'Acelerando por R02'],
          ...[...objectives.values()].filter(o => o.kind === 'intruder').map(o => [o.id, intruderText(o)])]
      },
      package: {
        title: 'Objeto abandonado', icon: '📦', detection: 'Patrullaje',
        desc: 'Alguien deja una mochila en un punto concurrido; la patrulla debe encontrarla.',
        actions: ['inspect', 'carry', 'cordon', 'guide', 'guard', 'block', 'overwatch', 'track', 'patrol', 'standby'],
        start(c) {
          const spot = pick([{ x: 116.5, y: 38.3, where: 'banca de la plaza' }, { x: 141, y: 77.4, where: 'acceso A01' }, { x: 33.4, y: 66, where: 'acceso L04' }, { x: 166.5, y: 56, where: 'acceso P01' }]);
          const box = new THREE.Group();
          box.add(new THREE.Mesh(new THREE.BoxGeometry(.6, .4, .45), mat('#3d4a3a', { roughness: .9 })));
          const strap = new THREE.Mesh(new THREE.BoxGeometry(.62, .06, .47), mat('#2b2b2b')); strap.position.y = .05; box.add(strap);
          box.children.forEach(m => { m.position.y += .2; m.castShadow = true; });
          box.scale.setScalar(sec.scale === 3 ? 2 : 1);
          root.add(box);
          c.pkg = { x: spot.x, y: spot.y, box, phase: 'hidden', inspectT: 0, where: spot.where };
          c.where = 'ubicación desconocida';
        },
        onDetect(c) {
          const spot = c.pkg;
          c.where = spot.where; spot.phase = 'found';
          addObjective({ id: 'P1', kind: 'package', label: `objeto en ${spot.where}`, at: () => ({ x: spot.x, y: spot.y }), status: 'sin inspeccionar', cordon: 24, carryTo: null });
          cordon.visible = true; cordon.scale.setScalar(30); cordon.position.copy(toWorld(spot.x, spot.y, .4));
          const ap = farthestAP(spot); c.ap = ap.id;
          c.doors = Object.values(life.doorPts).filter(d => dist(d, spot) < 50).map(d => d.id);
          life.evacuate(c.doors, [ap.x, ap.y], { shelterOthers: true });
          say('S01', '', `Perímetro de 30 m · evacuación de ${c.doors.join(', ') || 'la zona'} hacia ${ap.label}`, true);
          dispatch('EOD', { target: () => ({ x: spot.x, y: spot.y }), onArrive: u => {
            u.statusText = 'Evaluación a distancia';
            u.crew.forEach((p, i) => life.walkTo(p, spot.x + (i ? 1 : -1) * 3, spot.y - 22, q => { q.pose = 'work'; }, true));
            I.timers.push({ at: I.t + 25, fn: () => {
              const o = objectives.get('P1'); if (!o) return;
              spot.phase = 'transfer'; o.status = 'traslado';
              o.carryTo = { x: u.vehicle.pos.x, y: u.vehicle.pos.y + (u.vehicle.pos.y < 30 ? 6 : -6) };
              say('Antibombas', 'EXT', 'Autorizado traslado robotizado al contenedor de contención', true);
              ruleFill(); requestPlan('traslado del objeto');
            } });
          } });
        },
        requirements(c) {
          const k = c.pkg.phase;
          if (k === 'hidden' || k === 'done') return [];
          if (k === 'transfer') return [{ obj: 'P1', action: 'carry', count: 1 }, { obj: 'P1', action: 'cordon', count: 2 }, { obj: 'P1', action: 'overwatch', count: 1 }];
          return [{ obj: 'P1', action: 'inspect', count: 1 }, { obj: 'P1', action: 'cordon', count: 2 }, { obj: c.ap, action: 'guide', count: 1 }, { obj: 'P1', action: 'overwatch', count: 1 }];
        },
        step(dt, c) {
          const p = c.pkg, o = objectives.get('P1');
          if (p.phase === 'hidden') {
            const a = seenBy(p, 9);
            if (a) { report(a.id, a.kind, `Objeto abandonado detectado en patrulla · ${p.where} · sin dueño a la vista`, { alert: true }); detect(a.id, 'patrulla'); }
          }
          const hx = sec.agents.find(a => a.kind === 'HX' && a.effect === 'arm');
          if (p.phase === 'found' && hx) {
            p.inspectT += dt;
            if (p.inspectT > 25) { p.phase = 'inspected'; o.status = 'sospechoso confirmado'; report(hx.id, 'HX', 'Rayos X portátil: cables y batería en el interior · se mantiene perímetro hasta antibombas', { alert: true, replan: true }); }
          }
          if (p.phase === 'transfer') {
            const carrier = sec.agents.find(a => a.kind === 'HX' && I.assign.get(a.id)?.action === 'carry');
            if (carrier && !p.lifted && dist(carrier.cur, p) < 3) p.lifted = carrier.id;
            if (p.lifted) {
              const a = sec.byId(p.lifted); p.x = a.cur.x + Math.cos(a.cur.heading) * .5; p.y = a.cur.y + Math.sin(a.cur.heading) * .5;
              p.box.position.copy(toWorld(p.x, p.y, 1.1 * (sec.scale === 3 ? 2 : 1)));
              cordon.position.copy(toWorld(p.x, p.y, .4));
              if (a.onSite) {
                p.phase = 'done'; root.remove(p.box); o.status = 'contenido';
                say('Antibombas', 'EXT', 'Objeto en contenedor de contención · amenaza neutralizada', true);
                I.timers.push({ at: I.t + 6, fn: () => removeObjective('P1') });
              }
              return;
            }
          }
          p.box.position.copy(toWorld(p.x, p.y, 0));
        },
        done: c => c.pkg.phase === 'done' && !objectives.has('P1'),
        cleanup: c => { root.remove(c.pkg.box); cordon.visible = false; removeObjective('P1'); },
        status: c => [covertLine(), ['Objeto', { hidden: 'No localizado', found: 'Sin inspeccionar', inspected: 'Sospechoso · esperando antibombas', transfer: 'Traslado al contenedor', done: 'Neutralizado' }[c.pkg.phase]],
          ...(c.ap ? [['Perímetro', `30 m · evacuación hacia ${PLACES[c.ap].label}`]] : [])]
      },
      drone: {
        title: 'Dron no autorizado', icon: '✈', detection: 'Inmediata (sensor RF)', immediate: 'sensor RF',
        desc: 'Un dron entra por el norte y se queda en estacionario sobre un edificio.',
        actions: ['intercept', 'track', 'overwatch', 'guard', 'recover', 'cordon', 'patrol', 'standby'],
        start(c) {
          const goal = pick(['A01', 'H01', 'L02']), b = D.buildings.find(x => x.id === goal);
          const target = { x: b.x + b.width / 2, y: b.y + b.depth / 2 };
          const m = makeHostileDrone(); m.group.scale.setScalar(sec.scale === 3 ? 2.5 : 1); root.add(m.group);
          c.hd = { m, x: R(40, 200), y: 330, z: 45, target, goal, phase: 'inbound', hold: 0 };
          c.where = `espacio aéreo · ${goal}`; c.ids = [];
          addObjective({ id: 'HD1', kind: 'drone', label: 'dron no autorizado', at: () => ({ x: c.hd.x, y: c.hd.y, z: c.hd.z }), status: 'inbound', cordon: 10 });
          say('S01', '', 'Detección RF: dron no autorizado entrando por el norte a 45 m de altura', true);
          life.setLockdown(true); say('S01', '', 'Resguardo preventivo en edificios', true);
          dispatch('POLICIA', { target: () => mainTarget(), onArrive: u => { u.statusText = 'Recogiendo evidencia'; } });
        },
        requirements(c) {
          const o = objectives.get('HD1'); if (!o) return [];
          if (o.kind === 'drone') return [{ obj: 'HD1', action: 'intercept', count: 2 }, { obj: c.hd.goal, action: 'guard', count: 1 }];
          return [{ obj: 'HD1', action: 'recover', count: 1 }, { obj: 'HD1', action: 'cordon', count: 1 }, { obj: 'HD1', action: 'overwatch', count: 1 }];
        },
        step(dt, c) {
          const h = c.hd, o = objectives.get('HD1');
          if (h.phase === 'inbound' || h.phase === 'loiter') {
            const dx = h.target.x - h.x, dy = h.target.y - h.y, dd = Math.hypot(dx, dy);
            if (dd > 2 && h.phase === 'inbound') { h.x += dx / dd * 9 * dt; h.y += dy / dd * 9 * dt; h.z += (30 - h.z) * dt * .3; }
            else { if (h.phase === 'inbound') { h.phase = 'loiter'; o.status = 'loitering'; report('S01', '', `Dron hostil en estacionario sobre ${h.goal} a ${Math.round(h.z)} m`, { alert: true }); }
              h.ang = (h.ang || 0) + dt * .5; h.x = h.target.x + Math.cos(h.ang) * 8; h.y = h.target.y + Math.sin(h.ang) * 8; h.z += (26 - h.z) * dt * .5; }
            const close = sec.agents.filter(a => a.kind === 'D' && a.onSite && I.assign.get(a.id)?.action === 'intercept').length;
            h.hold = close >= 2 ? h.hold + dt : Math.max(0, h.hold - dt);
            if (close >= 1 && !h.locked) { h.locked = true; report(sec.agents.find(a => a.kind === 'D' && a.onSite)?.id || 'D-1', 'D', 'Dron hostil fijado · esperando segundo dron para red de captura', { replan: true }); }
            if (h.hold > 6) {
              h.phase = 'netted'; h.m.net.visible = true; h.m.chute.visible = true;
              const land = [h.x, h.y];
              if (!campus.nav.isFree(h.x, h.y)) { const d = life.nearestDoor(h.x, h.y); land[0] = d.x; land[1] = d.y; }
              h.land = land;
              report('D-2', 'D', 'Red de captura desplegada · dron hostil neutralizado, desciende con paracaídas', { alert: true });
            }
          } else if (h.phase === 'netted') {
            h.x += (h.land[0] - h.x) * dt * .6; h.y += (h.land[1] - h.y) * dt * .6; h.z = Math.max(.3, h.z - 2.4 * dt);
            if (h.z <= .3) {
              h.phase = 'down'; o.kind = 'drone_down'; o.status = 'on ground'; o.ring.material.color.set(OBJ_COLORS.drone_down);
              h.m.chute.visible = false;
              life.setLockdown(false); life.holdTraffic(true);
              report('S01', '', 'Dron en tierra · fin del resguardo · cordón de 10 m hasta que llegue la policía', { replan: true });
            }
          } else if (h.phase === 'down') {
            const hx = sec.agents.find(a => a.kind === 'HX' && I.assign.get(a.id)?.action === 'recover' && a.onSite);
            if (hx && !h.secured) { h.secured = true; report(hx.id, 'HX', 'Dron asegurado en bolsa de evidencia · batería desconectada'); }
            const pol = I.units.find(u => u.type === 'POLICIA' && u.state === 'onsite');
            if (pol && !pol.walking) {
              pol.walking = true;
              pol.crew.forEach((p, i) => life.walkTo(p, h.x + (i ? 1.5 : -1.5), h.y - 1.5, q => { q.pose = 'work'; }, true));
              I.timers.push({ at: I.t + 40, fn: () => { h.phase = 'collected'; root.remove(h.m.group); removeObjective('HD1'); say('Policía', 'EXT', 'Evidencia recogida · cadena de custodia iniciada', true); } });
            }
          }
          h.m.group.position.copy(toWorld(h.x, h.y, h.z));
          h.m.group.rotation.y += h.phase === 'down' || h.phase === 'collected' ? 0 : dt * 2;
        },
        done: c => c.hd.phase === 'collected',
        cleanup: c => { root.remove(c.hd.m.group); removeObjective('HD1'); },
        status: c => [['Dron', { inbound: 'Aproximación', loiter: `Estacionario sobre ${c.hd.goal}`, netted: 'Capturado · descendiendo', down: 'En tierra · asegurado', collected: 'Entregado a policía' }[c.hd.phase]],
          ['Altura', `${Math.round(c.hd.z)} m`]]
      },
    };
    const intruderText = o => ({ advancing: `Avanzando hacia ${o.goal}`, atDoor: `En ${o.goal} (puerta bloqueada)`, contained: 'Contenido', restrained: 'Retenido por HX', detained: 'Detenido por SWAT', escort: 'Traslado al vehículo' }[o.status]);

    // ---------- lifecycle
    let ctx = null, lastFill = 0;
    const start = id => {
      if (I) return null;
      const key = id === 'random' || !SCENARIOS[id] ? pick(Object.keys(SCENARIOS)) : id;
      const sc = SCENARIOS[key];
      I = { key, sc, t: 0, assign: new Map(), units: [], timers: [], reqAt: new Map(), planBusy: false, planPending: null, heli: null,
        hidden: new Map(), detected: false, detectT: 0 };
      ctx = { ids: [] }; I.ctx = ctx;
      // The operator only sees the scenario start in the simulator log; S01 learns of it on detection.
      say('SIM', '', `Escenario iniciado · ${sc.title} · detección: ${sc.detection}`);
      sc.start(ctx);
      if (sc.immediate) detect('S01', sc.immediate);
      else onState('covert', { key, title: sc.title, icon: sc.icon });
      return simTarget();
    };
    const finish = (reason = 'manual') => {
      if (!I) return;
      const inc = I;
      for (const o of [...objectives.values()]) { if (o.person && !o.person.removed) life.removePerson(o.person); }
      for (const h of inc.hidden.values()) { if (!h.person.removed) life.removePerson(h.person); }
      if (inc.sc.cleanup) inc.sc.cleanup(ctx);
      for (const id of [...objectives.keys()]) removeObjective(id);
      inc.units.forEach(unitLeave);
      if (heli) { heli.mode = 'outbound'; heli.life = 30; }
      wallFlash.visible = cordon.visible = false;
      sec.releaseAll();
      life.endEvacuation(); life.setLockdown(false); life.holdTraffic(false);
      say('S01', '', reason === 'resolved' ? `Incidente cerrado · ${inc.sc.title} resuelto en ${fmt(inc.t)} · operación normal` : `Incidente finalizado por el operador en ${fmt(inc.t)}`, reason !== 'resolved');
      radio('S01', 'TODOS', 'Fin del incidente. Todas las unidades a rutina.');
      I = null; ctx = null;
      onState('normal');
    };

    const status = () => {
      if (!I) return null;
      const lines = [...I.sc.status(ctx)];
      const by = k => sec.agents.filter(a => a.kind === k);
      const busy = k => by(k).filter(a => I.assign.has(a.id));
      lines.push(['Robots', `K9 ${busy('K9').length}/3 · HX ${busy('HX').length}/2 · drones ${busy('D').length}/2 asignados`]);
      for (const u of I.units) if (u.state !== 'gone') lines.push([u.def.label, unitText(u)]);
      if (I.heli) lines.push(['H-1', I.heli.state === 'enroute' ? `ETA ${fmt(Math.max(0, I.heli.eta - (I.t - I.heli.t0)))}` : I.heli.state === 'orbit' ? 'Orbitando · reflector' : 'Aproximación']);
      const t = mainTarget();
      return { title: I.sc.title, icon: I.sc.icon, where: ctx.where, elapsed: fmt(I.t), detected: I.detected, lines, x: t.x, y: t.y };
    };
    // Simulator view (not S01's knowledge): where the threat really is, detected or not.
    const simTarget = () => {
      if (objectives.size) return mainTarget();
      const h = [...I.hidden.values()].find(x => !x.person.removed);
      if (h) return { x: h.person.x, y: h.person.y };
      if (ctx.car && ctx.car.pos) return ctx.car.pos;
      if (ctx.pkg) return ctx.pkg;
      return PLACES.CAMPUS;
    };
    life.onUnknown = (p, agent) => { if (I && p.hiddenId) reveal(p, agent); };

    let clock = 0;
    return {
      root, start, finish, status,
      scenarios: Object.entries(SCENARIOS).map(([key, v]) => ({ key, title: v.title, icon: v.icon, detection: v.detection, desc: v.desc })),
      get active() { return !!I; },
      target() { return I ? simTarget() : null; },
      followTarget() {
        if (!I) return null;
        const o = [...objectives.values()].find(x => x.person); if (o) return o.person.g;
        const h = [...I.hidden.values()].find(x => !x.person.removed); return h ? h.person.g : null;
      },
      setScale(s) { heliScale = s === 3 ? 1.6 : 1; if (heli) heli.model.group.scale.setScalar(heliScale); },
      update(simDt, realDt) {
        clock += realDt;
        let left = simDt;
        while (left > 1e-6) {
          const dt = Math.min(.1, left); left -= dt;
          if (I) {
            I.t += dt;
            for (const tm of I.timers.filter(x => x.at <= I.t)) { I.timers.splice(I.timers.indexOf(tm), 1); tm.fn(); if (!I) break; }
            if (!I) break;
            I.sc.step(dt, ctx);
            I.units.forEach(stepUnit);
            if (I.t - lastFill > 2 || I.t < lastFill) { lastFill = I.t; ruleFill(); }
            if (I.sc.done(ctx)) finish('resolved');
          }
          stepHeli(dt, clock);
          stepParticles(dt);
        }
        if (!simDt) stepParticles(0);
        for (const o of objectives.values()) {
          const p = o.at(), pulse = (clock * .9) % 1;
          o.ring.position.copy(toWorld(p.x, p.y, .32));
          o.ring.scale.setScalar(.6 + pulse * 1.6); o.ring.material.opacity = .7 * (1 - pulse);
        }
        if (wallFlash.visible) wallFlash.material.opacity = .25 + .35 * (Math.sin(clock * 8) > 0 ? 1 : 0);
      }
    };
  };
})();
