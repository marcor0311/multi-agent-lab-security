// Local-AI radio for the 3D twin. Two roles, both optional and always backed by rules:
//  · plan(): the S01 coordinator reviews the rule plan and may re-assign agents (validated by the caller).
//  · voice(): each agent answers on the radio in first person from its own state, and may ask
//    for "refuerzo" (backup) or "relevo" (relief), which the incident engine then acts on.
// Runs against Ollama on this machine (http://localhost:11434). Nothing leaves the computer.
// The page must be served from http://localhost (see serve.sh): Ollama rejects file:// pages.
(() => {
  'use strict';
  const KEY = 'alpha-ai-';
  const load = (k, d) => { try { return localStorage.getItem(KEY + k) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(KEY + k, v); } catch { /* storage unavailable */ } };
  const PREFERRED = ['qwen3:1.7b', 'qwen3:4b', 'qwen3', 'llama3.2', 'qwen2.5', 'gemma3', 'phi4-mini'];

  window.createAlphaComms = function createAlphaComms({ onStatus = () => {} } = {}) {
    const cfg = { engine: load('engine', 'ollama'), endpoint: load('endpoint', 'http://localhost:11434'), model: load('model', '') };
    const st = { ok: false, text: 'Sin comprobar', models: [], calls: 0, fails: 0, avg: 0, busy: false, queue: 0 };
    const emit = () => onStatus({ ...st, engine: cfg.engine, model: cfg.model });

    const enabled = () => cfg.engine === 'ollama' && st.ok;

    async function probe() {
      if (cfg.engine !== 'ollama') { Object.assign(st, { ok: false, text: 'Solo reglas · IA desactivada' }); emit(); return st; }
      if (location.protocol === 'file:') {
        Object.assign(st, { ok: false, text: 'Abre la página con ./serve.sh (http://localhost) para usar Ollama' }); emit(); return st;
      }
      try {
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 3500);
        const r = await fetch(`${cfg.endpoint}/api/tags`, { signal: ctl.signal }); clearTimeout(tm);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const names = ((await r.json()).models || []).map(m => m.name);
        st.models = names;
        if (!names.length) { Object.assign(st, { ok: false, text: 'Ollama sin modelos · ejecuta: ollama pull qwen3:1.7b' }); emit(); return st; }
        if (!names.includes(cfg.model)) {
          cfg.model = PREFERRED.map(p => names.find(n => n.startsWith(p))).find(Boolean) || names[0];
          save('model', cfg.model);
        }
        Object.assign(st, { ok: true, text: `Ollama local · ${cfg.model}` });
      } catch (e) {
        Object.assign(st, { ok: false, text: `Ollama no responde (${e.name === 'AbortError' ? 'tiempo agotado' : e.message}) · usando reglas` });
      }
      emit(); return st;
    }

    // ---------- single-worker queue: plans first, stale voice lines dropped
    const queue = [];
    const pump = async () => {
      if (st.busy || !queue.length) return;
      queue.sort((a, b) => a.prio - b.prio || a.at - b.at);
      const job = queue.shift();
      st.queue = queue.length;
      if (performance.now() - job.at > job.ttl) { job.resolve(null); pump(); return; }
      st.busy = true; emit();
      const t0 = performance.now();
      try {
        const out = await chat(job.messages, job.schema, job.timeout, job.maxTokens);
        st.calls++; st.avg = st.avg ? st.avg * .8 + (performance.now() - t0) / 1000 * .2 : (performance.now() - t0) / 1000;
        job.resolve(out);
      } catch (e) {
        st.fails++; job.resolve(null);
        if (st.fails > 4 && st.fails > st.calls) { st.ok = false; st.text = 'Ollama con errores repetidos · usando reglas'; }
      }
      st.busy = false; st.queue = queue.length; emit();
      pump();
    };
    const enqueue = (job) => new Promise(resolve => { queue.push({ ...job, resolve, at: performance.now() }); st.queue = queue.length; pump(); });

    async function chat(messages, schema, timeout, maxTokens) {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
      try {
        const r = await fetch(`${cfg.endpoint}/api/chat`, {
          method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: cfg.model, messages, stream: false, think: false, format: schema, keep_alive: '30m',
            options: { temperature: .3, num_predict: maxTokens } })
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        // Some models (e.g. qwen3-vl) return the JSON in the thinking field when thinking is off.
        let txt = (d.message && (d.message.content || d.message.thinking)) || '';
        txt = txt.replace(/^```(?:json)?|```$/g, '').trim();
        const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
        return JSON.parse(a >= 0 ? txt.slice(a, b + 1) : txt);
      } finally { clearTimeout(tm); }
    }

    const RULES = `Reglas: K9 y drones (D) observan, siguen y contienen a distancia. Los humanoides HX bloquean accesos, inspeccionan y trasladan objetos, y solo retienen físicamente a un sospechoso si S01 lo autorizó; no portan armas. La detención formal es de SWAT/policía. Las personas de S01 autorizan. Usa solo hechos del contexto; no inventes unidades, nombres ni distancias.`;

    // ---------- coordinator
    function plan({ snapshot, ids, actions, objectives }) {
      if (!enabled()) return Promise.resolve(null);
      const schema = { type: 'object', required: ['assignments', 'radio'], properties: {
        assignments: { type: 'array', items: { type: 'object', required: ['agent', 'action', 'objective'], properties: {
          agent: { type: 'string', enum: ids }, action: { type: 'string', enum: actions }, objective: { type: 'string', enum: objectives } } } },
        radio: { type: 'array', maxItems: 6, items: { type: 'object', required: ['from', 'to', 'text'], properties: {
          from: { type: 'string', enum: ['S01', ...ids] }, to: { type: 'string', enum: ['S01', 'TODOS', ...ids] }, text: { type: 'string' } } } } } };
      const system = `Eres la IA local de coordinación de la estación S01 del campus Alpha Site. Recibes la situación y PLAN_ACTUAL (calculado por reglas: cubre cada objetivo con el agente libre más cercano).
1) Devuelve en "assignments" SOLO los cambios que mejoren claramente PLAN_ACTUAL (agente más cercano, batería < 25 %, objetivo sin cubrir, acción incompatible). Si está bien, devuelve una lista vacía.
2) En "radio" escribe 3 a 6 mensajes cortos en español (máx. 100 caracteres), estilo radio, entre S01 y los agentes y ENTRE agentes, para coordinar quién cubre qué y relevos. Usa distancias y ETA del contexto.
${RULES} Responde solo JSON.`;
      return enqueue({ prio: 0, ttl: 30000, timeout: 30000, maxTokens: 500, schema,
        messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(snapshot) }] });
    }

    // ---------- agent voice (first person, may address a peer and raise a request)
    function voice({ agent, persona, context, to }) {
      if (!enabled()) return Promise.resolve(null);
      if (queue.filter(j => j.prio > 0).length >= 3) return Promise.resolve(null); // radio backlog: use templates
      const schema = { type: 'object', required: ['to', 'text', 'request'], properties: {
        to: { type: 'string', enum: to }, text: { type: 'string' }, request: { type: 'string', enum: ['ninguna', 'refuerzo', 'relevo'] } } };
      const system = `Eres ${agent}, ${persona}, en el campus Alpha Site. Hablas por radio en primera persona, en español, máx. 90 caracteres, estilo radio.
Responde al mensaje o reporta el evento del CONTEXTO. Puedes dirigirte a S01 o a un compañero de "cerca" para coordinar (p. ej. quién cubre cada flanco).
"request": "refuerzo" solo si tu objetivo sigue activo y estás solo; "relevo" solo si tu batería < 30 %; si no, "ninguna".
${RULES} Responde solo JSON.`;
      return enqueue({ prio: 1, ttl: 9000, timeout: 15000, maxTokens: 120, schema,
        messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(context) }] });
    }

    return {
      probe, plan, voice,
      get enabled() { return enabled(); },
      get status() { return { ...st, engine: cfg.engine, model: cfg.model }; },
      setEngine(e) { cfg.engine = e; save('engine', e); return probe(); },
      setModel(m) { cfg.model = m; save('model', m); return probe(); }
    };
  };
})();
