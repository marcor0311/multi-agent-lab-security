/* Initial security overlay. Keeps the V09 architectural source unchanged. */
(() => {
  'use strict';
  const D = window.ALPHA_MASTERPLAN;
  if (!D || typeof window.renderAlphaPlan !== 'function') return;
  const NS = 'http://www.w3.org/2000/svg';
  const colors = { perimeter: '#245b59', access: '#ae6921', campus: '#476eaa', sensor: '#775e9c' };
  const y = value => D.site.depth - value;
  const node = (tag, attrs, parent, text) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== undefined) el.textContent = text;
    parent.append(el);
    return el;
  };
  const text = (parent, x, north, value, attrs = {}) => node('text', {
    x, y: y(north), fill: '#29434c', 'font-size': 2.5, 'text-anchor': 'middle',
    'font-family': 'Inter,system-ui,sans-serif',
    'paint-order': 'stroke', stroke: '#f6f9f5', 'stroke-width': .9,
    'stroke-linejoin': 'round', ...attrs
  }, parent, value);
  const line = (parent, points, color, width = 1, attrs = {}) => node('polyline', {
    points: points.map(([x, north]) => `${x},${y(north)}`).join(' '),
    fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linejoin': 'round', ...attrs
  }, parent);
  const base = (svg, prefix, title) => {
    window.renderAlphaPlan(svg, D);
    // The shared architectural renderer uses local IDs, so scope each copy.
    svg.querySelectorAll('[id]').forEach(el => { el.id = `${prefix}-${el.id}`; });
    Array.from(svg.children).forEach(el => el.setAttribute('opacity', '.62'));
    node('title', {}, svg, title);
    node('desc', {}, svg, 'Base arquitectónica V09, norte arriba y coordenadas métricas. Equipos y recorridos de seguridad propuestos; requieren validación en campo.');
  };
  const cameras = [];
  const add = (group, x, north, angle, location, purpose, installation, label = {}) => {
    cameras.push({ id: `C${String(cameras.length + 1).padStart(2, '0')}`, group, x, north, angle, location, purpose, installation, label });
  };
  const perimeterMount = 'Poste interior dedicado; estudiar 4–6 m de altura. Confirmar visibilidad del muro, óptica, anclaje y acceso de mantenimiento.';
  [
    [8,8,0,'Suroeste'], [76,8,180,'Sur · tramo oeste'], [164,8,0,'Sur · tramo este'], [232,8,180,'Sureste'],
    [232,52,90,'Este · tramo sur'], [232,100,90,'Este · tramo norte'],
    [232,142,180,'Noreste'], [156,142,180,'Norte · centro este'], [84,142,180,'Norte · centro oeste'], [8,142,0,'Noroeste'],
    [8,100,90,'Oeste · tramo norte'], [8,52,-90,'Oeste · tramo sur']
  ].forEach(([x,north,angle,name]) => add('perimeter',x,north,angle,name,'Verificar alarmas del límite y detectar actividad en la franja interior. Solape y puntos ciegos pendientes de prueba.',perimeterMount));
  add('access',126,11,-90,'G01 · carril de entrada','Obtener vista de placa en el carril de entrada, con velocidad controlada. Validar carril y sentido definitivo de circulación.','Óptica y soporte específicos para placa; estudiar altura y ángulo con un vehículo real.',{dx:-2,dy:9});
  add('access',134,11,-90,'G01 · carril de salida','Obtener vista de placa en el carril de salida. Su función no sustituye la verificación del guardia.','Montaje dedicado de carril; confirmar WDR, luz, movimiento y reflejos.',{dx:4,dy:-6});
  add('access',156,12,-90,'G01 · portal peatonal','Verificar persona y uso de credencial en el ingreso peatonal; revisar paso no autorizado junto a otra persona.','Montaje próximo al portal para vista de rostro, sin reconocimiento facial.',{dx:8,dy:7});
  add('campus',33,39,0,'PK01 · extremo oeste','Vista general del pasillo y fila oeste de estacionamiento.','Soporte fuera del área de giro; validar oclusión por vehículos.',{dx:-7,dy:5});
  add('campus',107,49,180,'PK01 · extremo este','Vista complementaria del parqueo y conexión peatonal.','Soporte en franja libre; conservar ancho accesible y evitar jardineras.',{dx:2,dy:5});
  const entranceMount = 'Fachada o soporte junto al ingreso, fuera del paso libre. Altura y lente según verificación de personas en esa puerta.';
  add('campus',141,80,-90,'A01 · ingreso desde plaza','Verificar ingreso principal y aproximación por el eje de plaza. No presupone cubrir todas las puertas de A01.',entranceMount,{dx:7,dy:0});
  add('campus',45,77,-90,'L01 · ingreso principal','Verificar la puerta principal de L01 y asociar su alarma de acceso.',entranceMount);
  add('campus',68,77,-90,'L02 · ingreso principal','Verificar la puerta principal de L02 y asociar su alarma de acceso.',entranceMount);
  add('campus',91,77,-90,'L03 · ingreso principal','Verificar la puerta principal de L03 y asociar su alarma de acceso.',entranceMount);
  add('campus',34,62,180,'L04 · ingreso oeste','Verificar la llegada por W09 al laboratorio de apoyo.',entranceMount,{dx:-4,dy:5});
  add('campus',173,92,180,'H01 · ingreso oeste','Verificar llegada por W06 y puerta del pabellón científico.',entranceMount,{dx:-5,dy:5});
  add('campus',169,54,90,'P01 · ingreso norte','Verificar llegada por W07 y entrada del área de prototipado.',entranceMount,{dx:8,dy:2});

  const cameraMap = document.querySelector('#security-camera-map');
  const patrolMap = document.querySelector('#security-patrol-map');
  if (!cameraMap || !patrolMap) return;
  base(cameraMap, 's01', 'S-01 · Cámaras y detección perimetral');
  const sensors = node('g', { 'data-layer': 'sensors' }, cameraMap);
  node('title', {}, sensors, 'Cuatro sectores propuestos de detección de intrusión sobre muro, con aperturas excluidas');
  // Four sectors, with the two real south access openings excluded.
  line(sensors,[[3,3],[3,147]],colors.sensor,.8,{'stroke-dasharray':'2 1.4'});
  line(sensors,[[3,147],[237,147]],colors.sensor,.8,{'stroke-dasharray':'2 1.4'});
  line(sensors,[[237,147],[237,3]],colors.sensor,.8,{'stroke-dasharray':'2 1.4'});
  line(sensors,[[3,3],[107,3]],colors.sensor,.8,{'stroke-dasharray':'2 1.4'});
  line(sensors,[[158,3],[237,3]],colors.sensor,.8,{'stroke-dasharray':'2 1.4'});
  text(sensors,48,149.5,'D-N · MURO',{'font-size':2,fill:colors.sensor});
  text(sensors,48,.5,'D-S · MURO',{'font-size':2,fill:colors.sensor});
  // The south sensor route behind S01 needs a site-specific detail.
  text(sensors,111,-5,'D-S: detalle S01 / portones por validar',{'font-size':1.9,fill:colors.sensor});
  const defs = node('defs', {}, cameraMap);
  const clip = node('clipPath', {id:'s01-site-clip'}, defs);
  node('rect', {x:1,y:1,width:D.site.width-2,height:D.site.depth-2}, clip);
  const sectors = node('g', { 'data-layer': 'sectors', 'aria-hidden':'true', 'clip-path':'url(#s01-site-clip)' }, cameraMap);
  const groups = Object.fromEntries(['perimeter','access','campus'].map(key => [key,node('g',{'data-layer':key},cameraMap)]));
  const controls = [...document.querySelectorAll('[data-security-layer]')];
  const cameraNodes = new Map();
  const detail = document.querySelector('#security-camera-detail');
  const setDetail = camera => {
    cameraNodes.forEach((el,id) => el.setAttribute('aria-pressed',String(id === camera.id)));
    detail.replaceChildren();
    const id = document.createElement('div'); id.className='camera-id'; id.textContent=camera.id;
    const heading = document.createElement('h4'); heading.textContent=camera.location;
    const purpose = document.createElement('p');
    purpose.textContent = camera.group === 'perimeter' ? 'Verificar alarmas y actividad junto al muro.'
      : camera.id === 'C13' ? 'Ver la placa del vehículo que entra.'
      : camera.id === 'C14' ? 'Ver la placa del vehículo que sale.'
      : camera.id === 'C15' ? 'Verificar el acceso peatonal.'
      : ['C16','C17'].includes(camera.id) ? 'Observar el parqueo y su circulación.'
      : 'Verificar la entrada y las alarmas de esta puerta.';
    const position = document.createElement('small');
    position.textContent = `Ubicación: X ${camera.x} m / Y ${camera.north} m.`;
    detail.append(id, heading, purpose, position);
  };
  cameras.forEach(camera => {
    const color = colors[camera.group];
    const length = camera.group === 'perimeter' ? 25 : camera.group === 'access' ? 11 : ['C19','C20','C21'].includes(camera.id) ? 9 : 15;
    const angle = camera.angle * Math.PI / 180;
    const half = (camera.group === 'access' ? 16 : 26) * Math.PI / 180;
    const fanPoints = [[camera.x,camera.north]];
    for (let step=0;step<=8;step++) { const a=angle-half+step*(2*half/8);fanPoints.push([camera.x+Math.cos(a)*length,camera.north+Math.sin(a)*length]); }
    node('polygon',{
      points:fanPoints.map(([x,north])=>`${x},${y(north)}`).join(' '),
      fill:color,'fill-opacity':.09,stroke:color,'stroke-width':.3,
      'stroke-dasharray':'1 .7','data-sector-group':camera.group
    },sectors);
    const g=node('g',{'data-camera':camera.id,role:'button',tabindex:'0','aria-label':`${camera.id}: ${camera.location}`,'aria-pressed':'false'},groups[camera.group]);
    node('title',{},g,`${camera.id} · ${camera.location}. ${camera.purpose}`);
    // A larger transparent target supports pointer use without enlarging the symbol.
    node('circle',{cx:camera.x,cy:y(camera.north),r:4.5,fill:'transparent'},g);
    node('circle',{cx:camera.x,cy:y(camera.north),r:2.1,fill:color,stroke:'#fff','stroke-width':.55,class:'camera-dot'},g);
    const direction=[[camera.x,camera.north],[camera.x+Math.cos(angle)*3.7,camera.north+Math.sin(angle)*3.7]];
    line(g,direction,color,.7);
    text(g,camera.x+(camera.label.dx || 0),camera.north+(camera.label.dy ?? 4.3),camera.id,{'font-size':2.7,'font-weight':700,fill:color,'pointer-events':'none'});
    g.addEventListener('click',()=>setDetail(camera));
    g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setDetail(camera);}});
    cameraNodes.set(camera.id,g);
  });
  const updateLayers = () => {
    const enabled=Object.fromEntries(controls.map(input=>[input.dataset.securityLayer,input.checked]));
    cameraMap.querySelectorAll('[data-layer]').forEach(group=>{ group.toggleAttribute('hidden',!enabled[group.dataset.layer]); });
    sectors.querySelectorAll('[data-sector-group]').forEach(fan=>fan.toggleAttribute('hidden',!enabled[fan.dataset.sectorGroup]));
    const selected=cameras.find(camera=>cameraNodes.get(camera.id).getAttribute('aria-pressed')==='true');
    if(selected && !enabled[selected.group]){
      const next=cameras.find(camera=>enabled[camera.group]);
      if(next) setDetail(next);
      else {cameraNodes.forEach(el=>el.setAttribute('aria-pressed','false'));detail.replaceChildren();const p=document.createElement('p');p.textContent='Activa una capa de cámaras para consultar sus puntos.';detail.append(p);}
    } else if (!selected) {
      const next=cameras.find(camera=>enabled[camera.group]); if(next) setDetail(next);
    }
  };
  controls.forEach(input=>input.addEventListener('change',updateLayers));
  setDetail(cameras[12]);
  updateLayers();

  base(patrolMap,'s02','S-02 · Patrullaje autónomo, centro de control y egreso de estudio');
  // Mirrors security-agents-3d.js (gemelo 3D): K9-1/K9-2/K9-3 robots, D-1/D-2 drones, docks at S01.
  const agentColors = { k1:'#e0892f', k2:'#c9772a', k3:'#f0a14c', d1:'#2b8993', d2:'#5fb7c1' };
  const operation=node('g',{},patrolMap);
  const loop=D.roads[0];
  const s01=D.buildings.find(b=>b.id==='S01');
  // D-2 inspection orbits (drawn first, underneath).
  [[138.5,100.5,22,'A01'],[191.5,91,22,'H01'],[184.5,41.5,19,'P01'],[68,98.5,26,'L01–L03'],[70,39.5,20,'PK01']].forEach(([x,north,r])=>{
    node('circle',{cx:x,cy:y(north),r,fill:agentColors.d2,'fill-opacity':.05,stroke:agentColors.d2,'stroke-width':.6,'stroke-dasharray':'1.6 1.2'},operation);
  });
  // D-1 perimeter flight (24 m).
  node('rect',{x:7,y:y(143),width:226,height:136,rx:14,fill:'none',stroke:agentColors.d1,'stroke-width':.8,'stroke-dasharray':'3 1.6'},operation);
  // K9-2 interior wall strip, detouring north of S01 and G01.
  line(operation,[[104,4],[4,4],[4,146],[236,146],[236,4],[161,4],[161,19.5],[104,19.5],[104,4]],agentColors.k2,1.1,{'stroke-dasharray':'2.4 1.4'});
  // K9-1 inner lane of the ring road.
  node('rect',{x:loop.x+2.2,y:y(loop.y+loop.depth-2.2),width:loop.width-4.4,height:loop.depth-4.4,rx:loop.radius-2.2,fill:'none',stroke:agentColors.k1,'stroke-width':1.4,'stroke-dasharray':'3 1.5'},operation);
  // K9-3 pedestrian network, S01 dock ↔ L04.
  line(operation,[[119.5,17],[153,17],[153,29],[138.5,29],[138.5,74],[29,74],[29,62],[34.4,62]],agentColors.k3,1.2,{'stroke-dasharray':'1.6 1'});
  node('title',{},operation,'Rutas del gemelo 3D: K9-1 anillo ≈ 598 m, K9-2 franja del muro ≈ 779 m, K9-3 red peatonal ≈ 232 m por sentido, D-1 vuelo perimetral ≈ 700 m a 24 m, D-2 inspección orbital de 5 zonas.');
  [[30,136],[210,136],[222,36],[30,24]].forEach(([x,north],index)=>{
    node('circle',{cx:x,cy:y(north),r:3.5,fill:colors.access,stroke:'#fff','stroke-width':.6},operation);
    text(operation,x,north-.85,`Q${index+1}`,{'font-size':2.7,'font-weight':700,fill:'#fff',stroke:'none'});
  });
  node('rect',{x:s01.x-1,y:y(s01.y+s01.depth+1),width:s01.width+2,height:s01.depth+2,rx:1,fill:colors.perimeter,'fill-opacity':.15,stroke:colors.perimeter,'stroke-width':.7},operation);
  // Docks: drone pad on S01 roof, K9 kennel next to S01.
  node('circle',{cx:s01.x+s01.width/2-3,cy:y(s01.y+s01.depth/2),r:2,fill:'#3a4449',stroke:agentColors.d1,'stroke-width':.5},operation);
  node('rect',{x:118.6,y:y(17.9),width:1.8,height:1.8,fill:'#3a4449',stroke:agentColors.k3,'stroke-width':.4},operation);
  text(operation,88,13,'S01 · CONTROL 24/7',{'font-size':2.5,fill:colors.perimeter});
  text(operation,88,9.6,'base drones + K9-3',{'font-size':2,fill:colors.perimeter});
  // An explicit study reservation, not a new approved opening in the source plan.
  line(operation,[[124,136],[124,149]],colors.sensor,1,{'stroke-dasharray':'1.8 1.3'});
  node('rect',{x:121,y:y(150),width:6,height:3,fill:'#f4f0f8',stroke:colors.sensor,'stroke-width':.7,'stroke-dasharray':'1 .7'},operation);
  text(operation,141,141,'E? · POR ESTUDIAR',{'font-size':2.5,fill:colors.sensor});
  const tag=(x,north,value,color)=>text(operation,x,north,value,{'font-size':2.6,'font-weight':700,fill:color});
  tag(120,128,'K9-1 · ANILLO',agentColors.k1);
  tag(20,120,'K9-2',agentColors.k2);
  tag(70,70.5,'K9-3',agentColors.k3);
  tag(200,147.5,'D-1 · 24 m',agentColors.d1);
  tag(191.5,116,'D-2',agentColors.d2);
})();
