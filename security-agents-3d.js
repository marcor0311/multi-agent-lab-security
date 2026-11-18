// Autonomous security agents for the 3D campus: quadruped robots (K9) and drones (D).
// Proposal-level simulation layered on the V09 plan; routes and behaviours need field validation.
// People in S01 authorise access and response — agents only patrol, observe and report.
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const wrapAngle = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

  window.createAlphaSecurityAgents = function createAlphaSecurityAgents(THREE, { D, campus, CSS2DObject, onEvent = () => {} }) {
    const { Route, roundedRectPoints } = window.AlphaGeo;
    const toWorld = campus.toWorld;
    const root = new THREE.Group(); root.name = 'agents';
    const sensors = new THREE.Group(); sensors.name = 'sensors';
    const routes = new THREE.Group(); routes.name = 'routes';
    const markers = new THREE.Group(); markers.name = 'markers';
    const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .2, ...o });
    const M = {
      shell: mat('#eef0ee', { roughness: .4 }), dark: mat('#2b3439', { roughness: .45, metalness: .5 }),
      orange: mat('#e0892f', { roughness: .45 }), cyan: mat('#2b8993', { roughness: .4 }),
      lens: mat('#0d1416', { emissive: '#56e0ee', emissiveIntensity: 1.4 }),
      ledG: mat('#20ff9a', { emissive: '#20ff9a', emissiveIntensity: 2 }),
      ledR: mat('#ff4040', { emissive: '#ff3030', emissiveIntensity: 2 }),
      ledW: mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.5 }),
      blade: mat('#1e2427', { roughness: .6 }),
      disc: new THREE.MeshBasicMaterial({ color: '#c9d6db', transparent: true, opacity: .16, depthWrite: false }),
      pad: mat('#3a4449', { roughness: .8 }), padLine: mat('#f2f5f3', { emissive: '#bff4f7', emissiveIntensity: .3 })
    };
    const shadowed = g => g.traverse(o => { if (o.isMesh && o.material !== M.disc) { o.castShadow = true; } });
    const meshBox = (w, h, d, m, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); return mesh;
    };
    const label = (text, cls) => {
      const el = document.createElement('div'); el.className = `agent-label ${cls}`; el.textContent = text;
      return new CSS2DObject(el);
    };

    // ---------- models (local +X is forward, origin at ground for K9 / body centre for drones)
    const makeDog = accent => {
      const g = new THREE.Group();
      const body = new THREE.Group(); body.position.y = .6; g.add(body);
      body.add(meshBox(1, .22, .42, M.shell));
      body.add(meshBox(.92, .08, .36, M.dark, 0, -.14, 0));
      body.add(meshBox(.7, .03, .44, accent, -.02, .03, 0));
      const head = new THREE.Group(); head.position.set(.56, .02, 0); body.add(head);
      head.add(meshBox(.2, .17, .34, M.dark));
      head.add(meshBox(.02, .06, .26, M.lens, .105, .01, 0));
      const lidar = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .09, 16), M.dark);
      lidar.position.set(.18, .155, 0); body.add(lidar);
      const lidarRing = new THREE.Mesh(new THREE.CylinderGeometry(.078, .078, .02, 16), M.lens);
      lidarRing.position.set(.18, .16, 0); body.add(lidarRing);
      const legs = [];
      for (const [fx, side, phase] of [[.38, .24, 0], [.38, -.24, Math.PI], [-.38, .24, Math.PI], [-.38, -.24, 0]]) {
        const hip = new THREE.Group(); hip.position.set(fx, -.08, side); body.add(hip);
        hip.add(meshBox(.1, .3, .1, M.shell, 0, -.15, 0));
        const knee = new THREE.Group(); knee.position.y = -.3; hip.add(knee);
        knee.add(meshBox(.065, .32, .065, M.dark, 0, -.16, 0));
        const foot = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), M.dark); foot.position.y = -.32; knee.add(foot);
        legs.push({ hip, knee, phase });
      }
      shadowed(g);
      return { group: g, body, head, legs };
    };

    const makeDrone = accent => {
      const g = new THREE.Group(); g.rotation.order = 'YZX';
      g.add(meshBox(.38, .12, .34, M.shell));
      g.add(meshBox(.26, .06, .22, accent, 0, .09, 0));
      const rotors = [];
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        const arm = meshBox(.84, .035, .05, M.dark); arm.rotation.y = a; g.add(arm);
      }
      for (const [x, z] of [[.3, .3], [.3, -.3], [-.3, .3], [-.3, -.3]]) {
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .07, 12), M.dark);
        motor.position.set(x, .03, z); g.add(motor);
        const rotor = new THREE.Group(); rotor.position.set(x, .075, z); g.add(rotor);
        rotor.add(meshBox(.36, .008, .04, M.blade));
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .004, 24), M.disc); rotor.add(disc);
        rotors.push(rotor);
      }
      const cam = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 10), M.dark); cam.position.set(.16, -.1, 0); g.add(cam);
      g.add(meshBox(.02, .03, .05, M.lens, .22, -.1, 0));
      for (const [x, z, m] of [[.2, .12, M.ledG], [.2, -.12, M.ledG], [-.2, .12, M.ledR], [-.2, -.12, M.ledR]]) {
        const led = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), m); led.position.set(x, -.04, z); g.add(led);
      }
      for (const z of [.13, -.13]) {
        g.add(meshBox(.34, .02, .02, M.dark, 0, -.17, z));
        g.add(meshBox(.02, .1, .02, M.dark, .1, -.12, z));
        g.add(meshBox(.02, .1, .02, M.dark, -.1, -.12, z));
      }
      shadowed(g);
      return { group: g, rotors };
    };

    // ---------- sensor visuals (kept outside the scaled agent groups)
    const coneGeo = new THREE.ConeGeometry(1, 1, 32, 1, true).translate(0, -.5, 0);
    const sensorMat = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const ringMat = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false });
    const groundRing = (r, color) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r * .93, r, 64), ringMat(color));
      ring.rotation.x = -Math.PI / 2; sensors.add(ring); return ring;
    };

    // ---------- dashed route lines
    const dashed = (pts, z, color, closed) => {
      const v = pts.map(([x, y]) => toWorld(x, y, z));
      if (closed) v.push(v[0].clone());
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v),
        new THREE.LineDashedMaterial({ color, dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: .85 }));
      line.computeLineDistances(); routes.add(line); return line;
    };

    // ---------- fixed markers: patrol checkpoints Q1–Q4 (security-plan.js S-02) and docks
    const CHECKPOINTS = [[30, 136, 'Q1'], [210, 136, 'Q2'], [222, 36, 'Q3'], [30, 24, 'Q4']];
    for (const [x, y, id] of CHECKPOINTS) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1.4, 10), M.dark);
      post.position.copy(toWorld(x, y, .7)); markers.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .12, 16), M.orange);
      cap.position.copy(toWorld(x, y, 1.45)); markers.add(cap);
      const l = label(id, 'mk-q'); l.position.copy(toWorld(x, y, 3.2)); markers.add(l);
    }
    const roof = campus.s01Roof;
    const droneDock = { x: roof.x - 3, y: roof.y };
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, .12, 32), M.pad);
    pad.position.copy(toWorld(droneDock.x, droneDock.y, roof.z + .06)); markers.add(pad);
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(1.6, .07, 6, 40), M.padLine);
    padRing.rotation.x = Math.PI / 2; padRing.position.copy(toWorld(droneDock.x, droneDock.y, roof.z + .14)); markers.add(padRing);
    const dogDock = { x: 119.5, y: 17 };
    const kennel = new THREE.Mesh(new THREE.BoxGeometry(1.8, .1, 1.8), M.pad);
    kennel.position.copy(toWorld(dogDock.x, dogDock.y, .17)); markers.add(kennel);
    const padTop = roof.z + .12;
    { const l = label('Base drones', 'mk-dock'); l.position.copy(toWorld(droneDock.x - 9, droneDock.y - 3, roof.z + 1)); markers.add(l); }

    // ---------- agents
    const agents = [];
    let scale = 3;

    const addDog = ({ id, name, route, speed, pingpong = false, stops = [], s = 0, dock = false }) => {
      const model = makeDog(M.orange);
      const tag = label(id, 'ag-dog'); tag.position.y = 1.35; model.group.add(tag);
      root.add(model.group);
      const ring = groundRing(7, '#f0a14c');
      const agent = {
        id, name, kind: 'K9', type: 'Robot cuadrúpedo', model, group: model.group, route, speed, pingpong, dock, mode: 'patrol', cur: null,
        s, dir: 1, pause: 0, pauseLabel: '', yaw: route.sample(s).heading, gait: 0, battery: 88 + Math.random() * 10,
        state: 'Patrullando', velocity: speed, ring, laps: 0,
        stops: stops.map(([x, y, n, t]) => ({ s: route.project(x, y), name: n, t }))
      };
      agents.push(agent);
      return agent;
    };

    const addDrone = cfg => {
      const model = makeDrone(M.cyan);
      const tag = label(cfg.id, 'ag-drone'); tag.position.y = .7; model.group.add(tag);
      root.add(model.group);
      const cone = new THREE.Mesh(coneGeo, sensorMat('#5fd6e2')); sensors.add(cone);
      const ring = groundRing(1, '#5fd6e2');
      const agent = { kind: 'D', type: 'Dron cuadricóptero', model, group: model.group, cone, ring, yaw: 0, roll: 0,
        battery: 100, velocity: 0, state: 'En base', pos: { x: 0, y: 0, z: 0 }, laps: 0, ...cfg };
      agents.push(agent);
      return agent;
    };

    // K9-1 — ring road, inner lane, verifying Q1–Q4.
    const loop = D.roads[0];
    const ringRoute = new Route(roundedRectPoints(loop.x + 2.2, loop.y + 2.2, loop.width - 4.4, loop.depth - 4.4, loop.radius - 2.2, 10), true);
    addDog({ id: 'K9-1', name: 'Ronda por anillo vial', route: ringRoute, speed: 1.6, s: 20,
      stops: CHECKPOINTS.map(([x, y, q]) => [x, y, `${q} verificado`, 3]) });
    dashed(ringRoute.pts, .3, '#e0892f', false);

    // K9-2 — interior strip along the white wall, detouring north of S01 and G01.
    const wallPts = [[104, 4], [4, 4], [4, 146], [236, 146], [236, 4], [161, 4], [161, 19.5], [104, 19.5]];
    const wallRoute = new Route(wallPts, true);
    addDog({ id: 'K9-2', name: 'Franja interior del muro', route: wallRoute, speed: 1.4, s: 180,
      stops: [[4, 4, 'Esquina SO · muro', 2.5], [4, 146, 'Esquina NO · muro', 2.5], [236, 146, 'Esquina NE · muro', 2.5], [236, 4, 'Esquina SE · muro', 2.5]] });
    dashed(wallPts, .3, '#c9772a', true);

    // K9-3 — pedestrian network from its S01 dock to the laboratory doors and back.
    const walkPts = [[dogDock.x, dogDock.y], [153, 17], [153, 29], [138.5, 29], [138.5, 74], [29, 74], [29, 62], [34.4, 62]];
    const walkRoute = new Route(walkPts, false);
    addDog({ id: 'K9-3', name: 'Red peatonal y laboratorios', route: walkRoute, speed: 1.2, pingpong: true, dock: true, s: 5,
      stops: [[138.5, 74, 'Eje plaza · A01', 3], [91, 74, 'Ingreso L03', 3], [68, 74, 'Ingreso L02', 3], [45, 74, 'Ingreso L01', 3]] });
    dashed(walkPts, .35, '#f0a14c', false);

    // D-1 — continuous perimeter flight above the wall line.
    const perimPts = roundedRectPoints(7, 7, 226, 136, 14, 10);
    const perimRoute = new Route(perimPts, true);
    addDrone({ id: 'D-1', name: 'Vuelo perimetral', mode: 'perimeter', route: perimRoute, s: 0, speed: 7, alt: 24, state: 'Vuelo perimetral' });
    dashed(perimPts, 24, '#2b8993', true);

    // D-2 — building inspection sorties launched from the S01 roof pad.
    const TASKS = [
      { name: 'A01 · atrio y cubierta', x: 138.5, y: 100.5, r: 22, alt: 30 },
      { name: 'H01 · pabellón científico', x: 191.5, y: 91, r: 22, alt: 26 },
      { name: 'P01 · prototipado', x: 184.5, y: 41.5, r: 19, alt: 22 },
      { name: 'L01–L03 · laboratorios', x: 68, y: 98.5, r: 26, alt: 22 },
      { name: 'PK01 · parqueo', x: 70, y: 39.5, r: 20, alt: 18 }
    ];
    for (const t of TASKS) {
      const pts = []; for (let i = 0; i < 48; i++) pts.push([t.x + t.r * Math.cos(i / 48 * TAU), t.y + t.r * Math.sin(i / 48 * TAU)]);
      dashed(pts, t.alt, '#5fb7c1', true);
    }
    const d2 = addDrone({ id: 'D-2', name: 'Inspección de edificios', mode: 'sortie', speed: 9, cruise: 30, state: 'Cargando en S01',
      phase: 'charging', battery: 74, queue: [], taskIndex: 0, task: null, angle: 0, swept: 0 });
    d2.landZ = padTop + .19;
    d2.pos = { x: droneDock.x, y: droneDock.y, z: d2.landZ };

    // ---------- behaviours
    const say = (agent, text) => onEvent({ agent: agent.id, kind: agent.kind, text });

    const stepDog = (a, dt) => {
      if (a.pause > 0) {
        a.pause -= dt;
        a.velocity = 0;
        if (a.charging) {
          a.battery = Math.min(100, a.battery + 2.2 * dt);
          if (a.battery < 95) a.pause = Math.max(a.pause, .1);
          else if (a.pause <= 0) { a.charging = false; say(a, 'Carga completa · reanuda ronda'); }
        }
        if (a.pause <= 0) a.state = 'Patrullando';
        return;
      }
      const prev = a.s;
      a.s += a.speed * dt * a.dir;
      a.velocity = a.speed;
      a.battery -= .035 * dt;
      if (a.battery < 20 && !a.dock) { say(a, 'Batería baja · cambio de batería en ruta'); a.battery = 100; }
      const L = a.route.length;
      // Stop detection, including wrap-around on closed routes.
      for (const st of a.stops) {
        let crossed;
        if (a.route.closed) {
          const p = ((prev % L) + L) % L, n = p + a.speed * dt;
          crossed = (st.s > p && st.s <= n) || (st.s + L > p && st.s + L <= n);
        } else {
          crossed = a.dir > 0 ? prev < st.s && a.s >= st.s : prev > st.s && a.s <= st.s;
        }
        if (crossed) { a.pause = st.t; a.state = `Inspección · ${st.name}`; say(a, st.name); break; }
      }
      if (a.route.closed && Math.floor(a.s / L) > Math.floor(prev / L)) { a.laps++; say(a, `Vuelta ${a.laps} completada`); }
      if (a.pingpong) {
        if (a.s >= L) { a.s = L; a.dir = -1; a.pause = 4; a.state = 'Inspección · ingreso L04'; say(a, 'Ingreso L04 verificado · regreso a S01'); }
        else if (a.s <= 0) {
          a.s = 0; a.dir = 1; a.pause = 4; a.charging = true; a.state = 'Cargando · base S01';
          say(a, `En base S01 · batería ${Math.round(a.battery)} %`);
        }
      }
    };

    const stepPerimeter = (a, dt) => {
      const prev = a.s;
      a.s += a.speed * dt;
      a.velocity = a.speed;
      a.battery -= .08 * dt;
      if (a.battery < 25) { say(a, 'Relevo de batería programado en S01'); a.battery = 100; }
      if (Math.floor(a.s / a.route.length) > Math.floor(prev / a.route.length)) { a.laps++; say(a, `Vuelta perimetral ${a.laps} · sin incidencias`); }
      const p = a.route.sample(a.s);
      a.pos = { x: p.x, y: p.y, z: a.alt + Math.sin(a.s * .05) * 1.2 };
      a.heading = p.heading;
    };

    const moveToward = (a, tx, ty, tz, dt) => {
      const dx = tx - a.pos.x, dy = ty - a.pos.y, dist = Math.hypot(dx, dy);
      const step = Math.min(dist, a.speed * dt);
      if (dist > .01) { a.pos.x += dx / dist * step; a.pos.y += dy / dist * step; a.heading = Math.atan2(dy, dx); }
      a.pos.z += (tz - a.pos.z) * Math.min(1, dt * 1.2);
      a.velocity = dist > .01 ? a.speed : 0;
      return dist;
    };

    const stepSortie = (a, dt) => {
      const flying = a.phase !== 'charging';
      if (flying) a.battery = Math.max(0, a.battery - .42 * dt);
      switch (a.phase) {
        case 'charging':
          a.velocity = 0; a.state = 'Cargando en S01';
          a.battery = Math.min(100, a.battery + 3.5 * dt);
          if (a.battery >= 100) {
            a.queue = [TASKS[a.taskIndex % TASKS.length], TASKS[(a.taskIndex + 1) % TASKS.length]];
            a.taskIndex += 2;
            a.phase = 'takeoff';
            say(a, `Despegue · misión ${a.queue.map(t => t.name.split(' · ')[0]).join(' + ')}`);
          }
          break;
        case 'takeoff':
          a.state = 'Despegue'; a.velocity = 3;
          a.pos.z += 3 * dt;
          if (a.pos.z >= 14) { a.phase = 'transit'; a.task = a.queue.shift(); }
          break;
        case 'transit': {
          const t = a.task;
          const ang = Math.atan2(a.pos.y - t.y, a.pos.x - t.x);
          a.state = `En tránsito → ${t.name}`;
          if (moveToward(a, t.x + t.r * Math.cos(ang), t.y + t.r * Math.sin(ang), t.alt, dt) < .5) {
            a.phase = 'orbit'; a.angle = ang; a.swept = 0; say(a, `Inspección orbital · ${t.name}`);
          }
          break;
        }
        case 'orbit': {
          const t = a.task, w = a.speed * .7 / t.r;
          a.angle += w * dt; a.swept += w * dt;
          a.pos.x = t.x + t.r * Math.cos(a.angle); a.pos.y = t.y + t.r * Math.sin(a.angle);
          a.pos.z += (t.alt - a.pos.z) * Math.min(1, dt);
          a.heading = a.angle + Math.PI / 2; a.velocity = a.speed * .7;
          a.state = `Inspección · ${t.name}`;
          if (a.swept >= TAU) {
            say(a, `${t.name} · imágenes enviadas a S01 para revisión`);
            if (a.queue.length) { a.task = a.queue.shift(); a.phase = 'transit'; }
            else { a.phase = 'return'; say(a, `Regreso a base · batería ${Math.round(a.battery)} %`); }
          }
          break;
        }
        case 'return':
          a.state = 'Regreso a S01';
          if (moveToward(a, droneDock.x, droneDock.y, a.cruise, dt) < .3) a.phase = 'landing';
          break;
        case 'landing':
          a.state = 'Aterrizaje'; a.velocity = 2;
          a.pos.z -= 2 * dt;
          if (a.pos.z <= a.landZ) { a.pos.z = a.landZ; a.phase = 'charging'; say(a, 'Aterrizaje en S01 · carga iniciada'); }
          break;
      }
    };

    // ---------- pose + visuals
    // ---------- humanoid field robots (HX): bipedal security units on standby at charging docks. They reach
    // an incident in seconds while SWAT or police are minutes away: block the gate, contain, inspect, carry a
    // suspicious object, and physically restrain a suspect only after the S01 operator authorises it.
    // Unarmed by design.
    M.violet = mat('#6b5bd6', { roughness: .45 });
    M.hx = mat('#c9ced1', { roughness: .32, metalness: .65 }); M.hxDark = mat('#262c30', { roughness: .4, metalness: .55 });
    M.visor = mat('#0b1114', { emissive: '#ff3b2f', emissiveIntensity: 1.6 });
    const makeHumanoid = () => {
      const g = new THREE.Group();
      const body = new THREE.Group(); g.add(body);
      const pelvis = new THREE.Group(); pelvis.position.y = .98; body.add(pelvis);
      pelvis.add(meshBox(.22, .18, .36, M.hxDark));
      const torso = new THREE.Group(); torso.position.y = .1; pelvis.add(torso);
      torso.add(meshBox(.28, .36, .44, M.hx, 0, .26, 0));                // abdomen + chest
      torso.add(meshBox(.34, .26, .54, M.hx, .01, .56, 0));
      torso.add(meshBox(.04, .14, .3, M.violet, .18, .56, 0));           // chest ID plate
      torso.add(meshBox(.18, .3, .34, M.hxDark, -.2, .5, 0));            // back battery pack
      const head = new THREE.Group(); head.position.y = .82; torso.add(head);
      head.add(meshBox(.06, .08, .08, M.hxDark, 0, -.05, 0));
      head.add(meshBox(.24, .24, .2, M.hx, .01, .1, 0));
      head.add(meshBox(.03, .05, .18, M.visor, .125, .12, 0));
      const limb = (parent, x, y, z, upper, lower, thick, mUp, mLow) => {
        const j1 = new THREE.Group(); j1.position.set(x, y, z); parent.add(j1);
        j1.add(meshBox(thick, upper, thick, mUp, 0, -upper / 2, 0));
        const j2 = new THREE.Group(); j2.position.y = -upper; j1.add(j2);
        j2.add(meshBox(thick * .85, lower, thick * .85, mLow, 0, -lower / 2, 0));
        return [j1, j2];
      };
      const arms = [.33, -.33].map(z => limb(torso, 0, .66, z, .32, .32, .11, M.hx, M.hxDark));
      const legs = [.11, -.11].map(z => limb(pelvis, 0, -.05, z, .45, .45, .14, M.hx, M.hxDark));
      legs.forEach(([, knee]) => knee.add(meshBox(.26, .06, .14, M.hxDark, .05, -.47, 0)));
      shadowed(g);
      return { group: g, body, pelvis, torso, head, arms, legs };
    };
    const addHumanoid = ({ id, name, dock }) => {
      const model = makeHumanoid();
      const tag = label(id, 'ag-hx'); tag.position.y = 2.3; model.group.add(tag);
      root.add(model.group);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .1, 24), M.pad);
      pad.position.copy(toWorld(dock.x, dock.y, .07)); markers.add(pad);
      const ring = groundRing(6, '#8f82ea');
      const a = { id, name, kind: 'HX', type: 'Robot humanoide de campo', model, group: model.group, dock, mode: 'standby',
        battery: 100, state: 'En espera · carga', velocity: 0, cur: { x: dock.x, y: dock.y, heading: dock.heading },
        yaw: dock.heading, ring, s: 0, gait: 0 };
      agents.push(a);
      return a;
    };
    addHumanoid({ id: 'HX-1', name: 'Humanoide de campo · garaje S01', dock: { x: 102, y: 12, heading: Math.PI / 2 } });
    addHumanoid({ id: 'HX-2', name: 'Humanoide de campo · puesto NE', dock: { x: 212, y: 126, heading: Math.PI } });

    // ---------- incident jobs: agents leave their routine for a job from S01, then return.
    // job = { kind: 'ring' | 'hold' | 'orbit', target: () => ({ x, y, z? }), label, radius, slot, dx, dy, alt, effect, face }
    const nav = campus.nav;
    const here = a => a.kind === 'D' ? a.pos : (a.cur || a.route.sample(a.s));
    const navTo = (a, x, y) => {
      const h = here(a);
      const pts = nav.find([h.x, h.y], [x, y], { direct: true });
      a.nav = pts.length > 1 ? new Route(pts) : null; a.navS = 0;
    };
    const SPEED = { K9: { run: 3.2, back: 1.8 }, HX: { run: 4.5, back: 1.6 } };
    const stepGroundJob = (a, dt) => {
      const h = here(a), sp = SPEED[a.kind];
      a.battery = Math.max(5, a.battery - .05 * dt);
      if (a.mode === 'job') {
        const j = a.job, t = j.target();
        const gx = j.kind === 'ring' ? t.x + Math.cos(j.slot) * j.radius : t.x + (j.dx || 0);
        const gy = j.kind === 'ring' ? t.y + Math.sin(j.slot) * j.radius : t.y + (j.dy || 0);
        if ((a.repath -= dt) <= 0 && (!a.goal || Math.hypot(gx - a.goal[0], gy - a.goal[1]) > 1.2)) {
          a.repath = 1.2; a.goal = [gx, gy]; navTo(a, gx, gy);
        }
        const dist = Math.hypot(t.x - h.x, t.y - h.y);
        if (!a.nav || a.navS >= a.nav.length - .05) {
          a.velocity = 0;
          const f = j.face ? j.face() : t;
          a.cur = { x: h.x, y: h.y, heading: Math.atan2(f.y - h.y, f.x - h.x) };
          if (!a.onSite) { a.onSite = true; onEvent({ agent: a.id, kind: a.kind, text: `En posición · ${j.label}`, onSite: true }); }
          a.state = j.label;
          return;
        }
        a.onSite = Math.hypot(gx - h.x, gy - h.y) < 2.5 && a.onSite;
        a.navS += sp.run * dt; a.velocity = sp.run;
        a.cur = a.nav.sample(a.navS);
        a.state = `En camino · ${j.label} · ${Math.round(dist)} m`;
      } else {
        if (!a.nav || a.navS >= a.nav.length) {
          if (a.kind === 'K9') { a.mode = 'patrol'; a.cur = null; a.state = 'Patrullando'; say(a, 'Ronda reanudada'); }
          else { a.mode = 'standby'; a.cur = { x: a.dock.x, y: a.dock.y, heading: a.dock.heading }; a.state = 'En espera · carga'; say(a, 'En base · en espera'); }
          a.velocity = 0;
          return;
        }
        a.navS += sp.back * dt; a.velocity = sp.back;
        a.cur = a.nav.sample(a.navS);
        a.state = a.kind === 'K9' ? 'Regreso a ronda' : 'Regreso a base';
      }
    };
    const stepHumanoid = (a, dt) => {
      if (a.mode === 'standby') { a.velocity = 0; a.battery = Math.min(100, a.battery + .5 * dt); return; }
      stepGroundJob(a, dt);
    };
    const stepDroneJob = (a, dt) => {
      const j = a.job, t = j.target();
      a.battery = Math.max(8, a.battery - .3 * dt);
      const r = j.radius ?? 10, alt = t.z !== undefined ? t.z + (j.alt ?? 3) : (j.alt ?? 20);
      if (a.orbitA === undefined) a.orbitA = Math.atan2(a.pos.y - t.y, a.pos.x - t.x);
      a.orbitA += (j.dir || 1) * Math.min(.9, 6 / Math.max(r, 1)) * dt;
      const save = a.speed; a.speed = 15;
      const d = moveToward(a, t.x + r * Math.cos(a.orbitA), t.y + r * Math.sin(a.orbitA), alt, dt);
      a.speed = save;
      const dist = Math.hypot(t.x - a.pos.x, t.y - a.pos.y);
      if (d < 3) {
        a.heading = Math.atan2(t.y - a.pos.y, t.x - a.pos.x); a.state = j.label;
        if (!a.onSite) { a.onSite = true; onEvent({ agent: a.id, kind: a.kind, text: `Sobre el objetivo · ${j.label}`, onSite: true }); }
      } else { a.onSite = false; a.state = `En camino · ${j.label} · ${Math.round(dist)} m`; }
    };
    const stepRejoin = (a, dt) => {
      const p = a.route.sample(a.s);
      const save = a.speed; a.speed = 12;
      const d = moveToward(a, p.x, p.y, a.alt, dt);
      a.speed = save; a.state = 'Regreso a vuelo perimetral';
      if (d < .8) { a.mode = 'perimeter'; say(a, 'Vuelo perimetral reanudado'); }
    };

    let clock = 0;
    const poseDog = (a, dt, realDt) => {
      const p = a.cur || a.route.sample(a.s);
      const target = a.cur ? a.cur.heading : p.heading + (a.dir < 0 ? Math.PI : 0);
      a.yaw += wrapAngle(target - a.yaw) * Math.min(1, dt * 5 + (a.pause > 0 ? dt * 2 : 0));
      a.group.position.copy(toWorld(p.x, p.y, .12));
      a.group.rotation.y = a.yaw;
      a.plan = p;
      const moving = a.velocity > 0;
      const freq = Math.min(5, Math.max(a.velocity, .8) / .55);
      // Legs follow simulation speed up to 2× so fast-forward does not turn into a blur.
      if (moving) a.gait += realDt * freq * TAU * Math.min(2, dt / Math.max(realDt, 1e-4));
      const amp = moving ? 1 : 0;
      for (const leg of a.model.legs) {
        const ph = a.gait + leg.phase;
        leg.hip.rotation.z = -.35 + .38 * amp * Math.sin(ph);
        leg.knee.rotation.z = .7 + .5 * amp * Math.max(0, Math.cos(ph));
      }
      a.model.body.position.y = .6 + (moving ? .018 * Math.abs(Math.sin(a.gait)) : 0);
      a.model.head.rotation.y = a.mode === 'job' && !moving ? .35 * Math.sin(clock * 2.4) : a.pause > 0 && !a.charging ? .7 * Math.sin(clock * 1.6) : a.model.head.rotation.y * .9;
      const pulse = (clock * .6 + a.s * .01) % 1;
      a.ring.position.copy(toWorld(p.x, p.y, .25));
      a.ring.scale.setScalar(.35 + pulse * .9);
      a.ring.material.opacity = .55 * (1 - pulse);
    };
    const poseDrone = (a, dt, realDt) => {
      const target = a.heading ?? a.yaw;
      const dYaw = wrapAngle(target - a.yaw);
      a.yaw += dYaw * Math.min(1, dt * 3);
      a.roll += ((-dYaw * .9) - a.roll) * Math.min(1, realDt * 3);
      const g = a.group;
      g.position.copy(toWorld(a.pos.x, a.pos.y, a.pos.z));
      g.rotation.y = a.yaw;
      g.rotation.z = a.velocity > 0 ? -.14 : 0;
      g.rotation.x = Math.max(-.35, Math.min(.35, a.roll));
      const spin = a.phase === 'charging' ? 0 : realDt * 55;
      a.model.rotors.forEach((r, i) => { r.rotation.y += spin * (i % 2 ? 1 : -1); });
      const airborne = a.pos.z > (a.landZ ?? 0) + .5;
      const h = Math.max(.1, a.pos.z), rad = h * Math.tan(24 * Math.PI / 180);
      a.cone.visible = airborne; a.ring.visible = airborne;
      a.cone.position.copy(g.position);
      a.cone.scale.set(rad, h, rad);
      a.ring.position.copy(toWorld(a.pos.x, a.pos.y, .3));
      a.ring.scale.setScalar(rad);
      a.plan = { x: a.pos.x, y: a.pos.y };
    };

    const poseHumanoid = (a, dt, realDt) => {
      const p = a.cur, m = a.model;
      a.yaw += wrapAngle(p.heading - a.yaw) * Math.min(1, dt * 5);
      a.group.position.copy(toWorld(p.x, p.y, .02));
      a.group.rotation.y = a.yaw;
      a.plan = p;
      const moving = a.velocity > 0, run = a.velocity > 3;
      if (moving) a.gait += realDt * TAU * (run ? 2.1 : 1.5) * Math.min(2, dt / Math.max(realDt, 1e-4));
      const sw = moving ? Math.sin(a.gait) * (run ? .75 : .45) : 0;
      const busy = a.mode === 'job', fx = busy && a.onSite ? a.job.effect : null;
      a.effect = fx;
      const k = Math.min(1, realDt * 6);
      const lerp = (o, v) => { o.rotation.z += (v - o.rotation.z) * k; };
      const crouch = fx === 'arm';
      // Legs: hip/knee swing; kneel on one knee for casualty care and inspection.
      lerp(m.legs[0][0], crouch ? .9 : sw); lerp(m.legs[1][0], crouch ? -.1 : -sw);
      lerp(m.legs[0][1], crouch ? -1.6 : -Math.max(0, -Math.sin(a.gait)) * (moving ? 1.1 : 0));
      lerp(m.legs[1][1], crouch ? -1.4 : -Math.max(0, Math.sin(a.gait)) * (moving ? 1.1 : 0));
      m.pelvis.position.y += ((crouch ? .62 : .98 + (moving ? Math.abs(Math.sin(a.gait)) * .03 : 0)) - m.pelvis.position.y) * k;
      m.torso.rotation.z += ((run ? -.18 : crouch ? -.25 : 0) - m.torso.rotation.z) * k;
      // Arms: swing while moving; forward for inspection, restraint or carrying.
      const reach = fx === 'arm' || fx === 'restrain' || fx === 'carry';
      lerp(m.arms[0][0], reach ? 1.35 : -sw * .9); lerp(m.arms[1][0], reach ? 1.35 : sw * .9);
      lerp(m.arms[0][1], reach ? .2 : .35); lerp(m.arms[1][1], reach ? .2 : .35);
      m.head.rotation.y = busy && !moving ? .3 * Math.sin(clock * 1.8) : m.head.rotation.y * .9;
      const pulse = (clock * .6) % 1;
      a.ring.visible = busy;
      a.ring.position.copy(toWorld(p.x, p.y, .25));
      a.ring.scale.setScalar(.35 + pulse * .9);
      a.ring.material.opacity = .55 * (1 - pulse);
    };

    // Seed initial poses.
    agents.forEach(a => {
      if (a.kind === 'D' && a.mode === 'perimeter') stepPerimeter(a, 0);
    });

    return {
      root, sensors, routes, markers, agents,
      setScale(s) {
        scale = s;
        // Humanoids are already person-sized, so they get a milder legibility boost.
        agents.forEach(a => a.group.scale.setScalar(a.kind === 'HX' ? (s === 3 ? 2 : 1) : s));
        // Skids sit 0.18 m below the drone origin, so the landing height follows the display scale.
        d2.landZ = padTop + .185 * s;
        if (d2.phase === 'charging') d2.pos.z = d2.landZ;
      },
      setNight(night) {
        M.lens.emissiveIntensity = night ? 3 : 1.4;
        [M.ledG, M.ledR, M.ledW].forEach(m => { m.emissiveIntensity = night ? 4 : 2; });
        M.padLine.emissiveIntensity = night ? 1.6 : .3;
        agents.forEach(a => { if (a.cone) a.cone.material.opacity = night ? .16 : .1; });
      },
      update(simDt, realDt) {
        clock += realDt;
        // Fixed sub-steps keep stop detection reliable at high simulation speeds.
        let left = simDt;
        while (left > 1e-6) {
          const dt = Math.min(.1, left); left -= dt;
          for (const a of agents) {
            if (a.kind === 'K9') (a.mode === 'patrol' ? stepDog : stepGroundJob)(a, dt);
            else if (a.kind === 'HX') stepHumanoid(a, dt);
            else if (a.mode === 'job') stepDroneJob(a, dt);
            else if (a.mode === 'rejoin') stepRejoin(a, dt);
            else if (a.mode === 'perimeter') stepPerimeter(a, dt);
            else stepSortie(a, dt);
          }
        }
        for (const a of agents) (a.kind === 'K9' ? poseDog : a.kind === 'HX' ? poseHumanoid : poseDrone)(a, simDt, realDt);
      },
      get scale() { return scale; },
      byId(id) { return agents.find(a => a.id === id); },
      // Give an agent an incident job (see stepGroundJob / stepDroneJob for the job shape).
      assign(id, job) {
        const a = agents.find(x => x.id === id); if (!a) return;
        if (a.kind === 'D') {
          a.baseMode = a.baseMode || a.mode;
          if (a.baseMode === 'sortie') { a.phase = 'respond'; a.queue = []; a.task = null; }
          a.orbitA = undefined;
        } else {
          if (a.mode === 'patrol') { a.cur = a.route.sample(a.s); if (a.dir < 0) a.cur.heading += Math.PI; }
          Object.assign(a, { pause: 0, charging: false, goal: null, repath: 0 });
        }
        Object.assign(a, { mode: 'job', job, onSite: false });
      },
      release(id) {
        const a = agents.find(x => x.id === id); if (!a || a.mode !== 'job') return;
        a.job = null; a.onSite = false;
        if (a.kind === 'K9') { a.mode = 'return'; const p = a.route.sample(a.s); navTo(a, p.x, p.y); }
        else if (a.kind === 'HX') { a.mode = 'return'; navTo(a, a.dock.x, a.dock.y); }
        else if (a.baseMode === 'perimeter') { a.mode = 'rejoin'; a.baseMode = null; }
        else { a.mode = 'sortie'; a.phase = 'return'; a.queue = []; a.baseMode = null; say(a, 'Regreso a S01'); }
      },
      releaseAll() { agents.forEach(a => this.release(a.id)); },
    };
  };
})();
