// Shared SVG drawing for the brochure and the standalone 2D plan.
window.renderAlphaPlan = function renderAlphaPlan(svg, D = window.ALPHA_MASTERPLAN) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = { lawn: '#dce6d7', hedge: '#71846c', road: '#637078', path: '#e4e5e0',
    ink: '#29434c', muted: '#60777e', white: '#fcfdfb', water: '#719da7' };
  svg.replaceChildren();
  svg.setAttribute('viewBox', '-10 -12 260 188');
  const E = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value);
    parent.append(n);
    return n;
  };
  const Y = y => D.site.depth - y;
  const R = (x, y, w, h, fill, stroke = 'none', sw = .25, rx = 0, parent = svg) =>
    E('rect', { x, y: Y(y) - h, width: w, height: h, fill, stroke, 'stroke-width': sw, rx }, parent);
  const L = (points, width, color, parent = svg, extra = {}) => E('polyline', {
    points: points.map(([x, y]) => `${x},${Y(y)}`).join(' '), fill: 'none',
    stroke: color, 'stroke-width': width, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round', ...extra
  }, parent);
  const T = (x, y, text, size = 2, color = C.ink, parent = svg) => {
    const n = E('text', { x, y: Y(y), 'text-anchor': 'middle', 'font-size': size,
      fill: color, 'font-family': 'Inter,system-ui,sans-serif' }, parent);
    n.textContent = text;
    return n;
  };
  const group = (id, title) => {
    const g = E('g', { id });
    E('title', {}, g).textContent = title;
    return g;
  };
  const ground = group('ground', 'Césped uniforme y paisaje ordenado');
  R(0, 0, 240, 150, C.lawn, '#a8b9b3', .35, 0, ground);
  const roads = group('roads', 'Anillo vial y conexiones de acceso y parqueo');
  const loop = D.roads[0];
  R(loop.x, loop.y, loop.width, loop.depth, 'none', C.road, loop.road_width, loop.radius, roads);
  R(loop.x, loop.y, loop.width, loop.depth, 'none', '#aebfc0', .18, loop.radius, roads);
  for (const road of D.roads.slice(1)) L(road.points, road.road_width, C.road, roads);
  L([[131, -12], [131, 1]], .15, '#e5e9e7', roads, { 'stroke-dasharray': '2 2' });

  const parking = group('parking', '42 plazas independientes: dos filas, pasillo central de 6,4 metros y dos conexiones');
  const pk = D.parking;
  R(pk.x, pk.y, pk.width, pk.depth, C.road, '#d2d9d5', .3, .5, parking);
  // Both driveway mouths meet the full-width clear central aisle.
  for (const road of D.roads.slice(2)) L(road.points, road.road_width, C.road, parking);
  const stalls = [];
  for (const [row, y] of pk.row_y.entries()) {
    for (let i = 0; i < 21; i++) {
      const accessible = i === 20;
      const x = pk.stall_start_x + i * pk.stall.width;
      const width = accessible ? pk.accessible_stall_width : pk.stall.width;
      R(x, y, width, pk.stall.depth, accessible ? '#7e9b9e' : C.road, '#f1f5ee', .16, 0, parking);
      if (accessible) {
        const cx = x + width / 2, cy = y + 2.6;
        E('circle', { cx:cx-.15, cy:Y(cy-.4), r:.7, fill:'none', stroke:'#fff', 'stroke-width':.18 }, parking);
        E('circle', { cx:cx-.1, cy:Y(cy+1), r:.22, fill:'#fff' }, parking);
        L([[cx-.1,cy+.6],[cx-.1,cy-.1],[cx+.65,cy-.1],[cx+.95,cy-.8]],.18,'#fff',parking);
        L([[cx-.1,cy+.3],[cx+.65,cy+.3]],.18,'#fff',parking);
        const ax = x + width;
        R(ax, y, pk.accessible_aisle_width, pk.stall.depth, '#c5d7d2', '#f1f5ee', .1, 0, parking);
        for (let dy = .4; dy < pk.stall.depth; dy += .7)
          L([[ax, y + dy], [ax + pk.accessible_aisle_width, y + dy + .5]], .1, '#fff', parking);
      }
      stalls.push({ x, y, width, row, i });
    }
  }
  // A few parked vehicles make it clear that no car blocks the driving aisle.
  for (const [index, color] of [[3, '#a8b4b5'], [9, '#edf0ec'], [17, '#597789'], [25, '#e1e5df'], [36, '#a3afb0']]) {
    const bay = stalls[index];
    R(bay.x + .4, bay.y + .5, 1.8, 4.2, color, '#263e47', .15, .4, parking);
    R(bay.x + .55, bay.y + 1.6, 1.5, 1.4, '#415a66', 'none', 0, .2, parking);
  }
  T(70, pk.aisle_y + 2.5, '↔  PASILLO LIBRE · 6,4 m  ↔', 1.35, '#f6f8f4', parking);
  T(70, 49.1, 'PK01 · 42 PLAZAS / 2 ACCESIBLES', 1.25, '#f6f8f4', parking);

  const plaza = group('plaza', 'Plaza decorativa: dos láminas de agua, escultura, bancos y jardineras');
  const pl = D.plaza;
  R(pl.x, pl.y, pl.width, pl.depth, '#d9ddda', '#b1bfba', .25, .5, plaza);
  for (let x = pl.x + 3; x < pl.x + pl.width; x += 3)
    L([[x, pl.y], [x, pl.y + pl.depth]], .07, '#c5cfca', plaza);
  for (let y = pl.y + 3; y < pl.y + pl.depth; y += 3)
    L([[pl.x, y], [pl.x + pl.width, y]], .07, '#c5cfca', plaza);
  const walks = group('walks', 'Rutas peatonales continuas y pasos de cruce');
  for (const w of D.pedestrian_routes) L(w.points, w.width + .3, '#f9fbf7', walks);
  for (const w of D.pedestrian_routes) L(w.points, w.width, C.path, walks);
  // Crossings remain flush; all stripe geometry stays within the road widths.
  for (let y = 20.3; y < 28; y += 1.05) R(151.5, y, 3, .48, C.white, 'none', 0, 0, walks);
  for (let x = 98.5; x < 104; x += .8) R(x, 26.8, .4, 2.4, C.white, 'none', 0, 0, walks);
  for (const b of pl.reflecting_pools) {
    R(b.x - .55, b.y - .55, b.width + 1.1, b.depth + 1.1, C.white, '#a2b6b9', .2, .3, plaza);
    R(b.x, b.y, b.width, b.depth, C.water, '#577e8b', .2, .15, plaza);
    for (let y = b.y + 2; y < b.y + b.depth; y += 3)
      L([[b.x + 1, y], [b.x + b.width - 1, y]], .12, '#b4cdd0', plaza);
  }
  for (const b of pl.planters) {
    R(b.x - .25, b.y - .25, b.width + .5, b.depth + .5, C.white, '#a7b7ac', .15, .2, plaza);
    R(b.x, b.y, b.width, b.depth, C.hedge, 'none', 0, .15, plaza);
  }
  for (const b of pl.benches) {
    R(b.x, b.y, b.width, b.depth, C.white, '#a6b3af', .2, .25, plaza);
    L([[b.x + .3, b.y + .2], [b.x + b.width - .3, b.y + .2]], .16, '#a5c7cc', plaza);
  }
  const sc = pl.sculpture;
  R(sc.x - .5, sc.y - .5, sc.width + 1, sc.depth + 1, '#eef1ed', '#b9c4bf', .2, .2, plaza);
  E('polygon', { points: [[132,52],[136,53],[133,56],[134,53.5]].map(([x,y])=>`${x},${Y(y)}`).join(' '),
    fill: C.white, stroke: '#7e979f', 'stroke-width': .25 }, plaza);

  const buildings = group('buildings', 'Edificios blancos de geometría modular con ventanales privados');
  for (const b of D.buildings) {
    R(b.x + .6, b.y - .6, b.width, b.depth, '#bcc9c3', 'none', 0, .5, buildings);
    R(b.x, b.y, b.width, b.depth, C.white, '#607e89', .35, .4, buildings);
    // Angular white roof bands, dark glazing strips and screened plant in plan.
    if (b.id !== 'S01') {
      E('polygon', { points: [[b.x+1,b.y+1],[b.x+b.width-1,b.y+1],[b.x+b.width-3,b.y+4],[b.x+3,b.y+3]].map(([x,y])=>`${x},${Y(y)}`).join(' '),
        fill: '#e5ecea', stroke: '#a2b7bd', 'stroke-width': .15 }, buildings);
      R(b.x + 3, b.y + 1.2, b.width - 6, .65, '#587784', 'none', 0, 0, buildings);
    }
    if (['L01','L02','L03','H01'].includes(b.id)) {
      for (let k = 1; k < 6; k++)
        R(b.x + k * b.width / 7, b.y + 5, .3, b.depth - 8, '#bdcdd1', 'none', 0, 0, buildings);
    }
    if (b.atrium) {
      const a = b.atrium;
      R(a.x, a.y, a.width, a.depth, '#d4e1d1', '#7f9d9e', .3, .6, buildings);
      T(a.x + a.width / 2, a.y + a.depth / 2, 'ATRIO', 1.5, '#5d7a78', buildings);
    }
    if (b.id === 'S01') {
      R(b.x + 1.2, b.y + 1, b.width - 2.4, 1, '#496775', 'none', 0, 0, buildings);
      R(b.x + 3, b.y + 8, b.width - 6, 4, '#d8e1df', '#95a9ac', .2, .3, buildings);
    }
    T(b.x + b.width / 2, b.y + b.depth / 2 + (b.atrium ? -12 : 0), b.id, 2.35, C.ink, buildings);
    if (b.id !== 'S01') T(b.x + b.width / 2, b.y + b.depth - 4, `${b.floors} ${b.floors === 1 ? 'NIVEL' : 'NIVELES'}`, 1.15, C.muted, buildings);
  }

  const wall = group('white-wall', 'Muro perimetral blanco continuo, sin vallas negras');
  const outline = [[124, .6],[.6,.6],[.6,149.4],[239.4,149.4],[239.4,.6],[157,.6]];
  L(outline, 1.8, '#8ca0a1', wall);
  L(outline, 1.2, C.white, wall);
  L([[148,.6],[149,.6]], 1.8, '#8ca0a1', wall);
  L([[148,.6],[149,.6]], 1.2, C.white, wall);

  const gate = group('gate', 'Estación integrada, marquesina, portones recogidos y portal peatonal');
  const canopy = D.gate.canopy;
  E('polygon', { points: [[canopy.x,canopy.y],[canopy.x+canopy.width,canopy.y],[canopy.x+canopy.width-3,canopy.y+canopy.depth],[canopy.x+3,canopy.y+canopy.depth]].map(([x,y])=>`${x},${Y(y)}`).join(' '),
    fill: '#f7faf5', 'fill-opacity': .55, stroke: '#6d8b94', 'stroke-width': .3, 'stroke-dasharray': '1.2 .7' }, gate);
  // Gate panels slide along the white wall, not across the approach.
  R(120.5, .5, 3.4, .7, '#e6ecea', '#7b969e', .2, 0, gate);
  R(135.8, .5, 4, .7, '#e6ecea', '#7b969e', .2, 0, gate);
  R(130.6, -7, .8, 20, '#dce6d7', '#e6ece5', .2, .4, gate);
  for (const x of [125.9, 136.1]) {
    R(x - .4, 5, .8, 1.2, '#80969c', 'none', 0, .1, gate);
    E('circle', { cx: x, cy: Y(5.6), r: .25, fill: '#fff' }, gate);
  }
  T(128.6, -3, '↓', 3, C.white, gate);
  T(133.4, -3, '↑', 3, C.white, gate);
  T(131, 17, 'G01 · 2 CARRILES', 1.25, C.ink, gate);
  const ped = D.gate.pedestrian_portal;
  R(ped.x, ped.y, ped.width, ped.depth, C.white, '#6b8893', .3, .25, gate);
  R(ped.x + 2.7, ped.y, 2.6, ped.depth, '#e1e9e5', '#9aaeb0', .18, 0, gate);
  R(ped.x + 3.9, ped.y + 1, .3, 2, '#51707d', 'none', 0, 0, gate);
  T(153, 9, 'PEAT.', 1.2, C.ink, gate);

  const lights = group('lighting', 'Luminarias en franjas verdes, fuera de caminos; sin cámaras');
  for (const [x,y] of D.lighting.pole_locations) {
    E('circle', { cx:x, cy:Y(y), r:.65, fill:'#f9f7dc', stroke:'#b2b58e', 'stroke-width':.15 }, lights);
    R(x-.45,y-.12,.9,.24,'#6f8c94','none',0,0,lights);
  }
  const notes = group('orientation', 'Orientación, escala y referencia conceptual');
  T(134, 71, 'PL01 · PLAZA DECORATIVA', 1.65, C.ink, notes);
  T(134, 37, 'AGUA · ESCULTURA · DESCANSO', 1.1, C.muted, notes);
  T(232, 142, 'N ↑', 2.4, C.ink, notes);
  T(120, 155, '240 m · MURO BLANCO CONTINUO', 1.75, C.muted, notes);
  const depth = T(-5,75,'150 m',1.7,C.muted,notes);
  depth.setAttribute('transform', `rotate(-90 -5 ${Y(75)})`);
  for (let i=0; i<4; i++) R(4+i*10,-18,10,1,i%2?'#d7e1dc':'#58737e','none',0,0,notes);
  T(4,-21,'0',1.3,C.muted,notes); T(44,-21,'40 m',1.3,C.muted,notes);
  T(155,-19,'V09 / CONCEPTO 02A · ESQUEMA CONCEPTUAL',1.6,C.muted,notes);
};
