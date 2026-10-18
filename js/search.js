/* =========================================================
   Portafolio · Xiang Su Liu — Buscador local de proyectos
   Archivo: js/search.js  (se carga antes de assistant.js)

   Lógica PURA: no toca el DOM, no hace peticiones y no guarda nada.
   Recibe la lista de proyectos ya publicados (la que carga js/projects.js
   desde sources/projects/projects.json) y devuelve resultados ordenados.
   ========================================================= */
(function (root) {
  'use strict';

  /* ---------- Ajustes (se pueden tocar sin miedo) ---------- */
  const CONFIG = {
    maxResults: 8,
    // Peso de cada campo cuando la palabra coincide EXACTA / por PREFIJO
    weights: {
      name:     { exact: 10, prefix: 6 },
      tags:     { exact: 8,  prefix: 5 },
      category: { exact: 7,  prefix: 4 },
      files:    { exact: 3,  prefix: 2 },
      text:     { exact: 3,  prefix: 2 },   // descripción
      meta:     { exact: 2,  prefix: 1 },   // tipo de archivo, dominio del enlace, fecha
    },
    synonymFactor: 0.6,     // un sinónimo vale menos que la palabra escrita
    phraseBonus: 8,         // la consulta completa aparece tal cual en el título
    substringInName: 1.5,   // trozo de palabra dentro del título (≥ 4 letras)
  };

  /* ---------- Palabras que no aportan a la búsqueda ---------- */
  const STOP = new Set(('de del la las el los lo un una unos unas y e o u a al en con sin para por que como mi mis tu tus su sus ' +
    'sobre entre es son hay tiene tienes tengo quiero busco buscar busca buscame muestrame mostrar muestra ver dame ' +
    'algun alguna algunos algunas algo cosas cosa').split(' '));
  // «proyecto» o «trabajo» describen TODO el catálogo: no sirven para filtrar
  const GENERIC = new Set(['proyecto', 'proyectos', 'trabajo', 'trabajos', 'portfolio', 'portafolio']);
  const ALL_WORDS = new Set(['todo', 'todos', 'todas', 'lista', 'listado', 'catalogo', 'completo']);

  /* ---------- Sinónimos sencillos (grupos bidireccionales, ya sin tildes) ---------- */
  const SYNONYM_GROUPS = [
    ['web', 'pagina', 'paginas', 'sitio', 'sitios', 'website', 'portal'],
    ['juego', 'juegos', 'videojuego', 'videojuegos', 'game', 'games', 'gaming'],
    ['red', 'redes', 'network', 'networking', 'lan', 'wan'],
    ['servidor', 'servidores', 'server', 'servers'],
    ['bbdd', 'db', 'database', 'databases', 'basededatos'],
    ['seguridad', 'ciberseguridad', 'security', 'cybersecurity'],
    ['cortafuegos', 'firewall', 'iptables'],
    ['contenedor', 'contenedores', 'container', 'containers', 'docker'],
    ['virtualizacion', 'virtual', 'virtuales', 'vm', 'proxmox', 'vmware', 'virtualbox'],
    ['script', 'scripts', 'scripting', 'automatizacion', 'automatizar'],
    ['documentacion', 'documento', 'documentos', 'informe', 'memoria', 'manual', 'guia'],
    ['laboratorio', 'laboratorios', 'lab', 'labs', 'practica', 'practicas'],
    ['imagen', 'imagenes', 'foto', 'fotos', 'captura', 'capturas', 'screenshot'],
    ['linux', 'ubuntu', 'debian'],
    ['cisco', 'ccna', 'packet', 'tracer'],
  ];
  // Frases de varias palabras que cuentan como UN solo término de la consulta.
  //   words: palabras que deben aparecer en el mismo campo · syn: otras formas equivalentes
  const PHRASES = [
    { re: /\bbases? de datos\b/, label: 'base de datos', words: ['base', 'datos'], syn: ['bbdd', 'database', 'sql'] },
    { re: /\b(pagina|sitio) web\b/, label: 'web', words: ['web'], syn: ['pagina', 'sitio', 'website'] },
    { re: /\bmaquinas? virtuales?\b/, label: 'maquina virtual', words: ['maquina', 'virtual'], syn: ['virtualizacion', 'vm', 'proxmox', 'vmware', 'virtualbox'] },
  ];

  const SYN_INDEX = new Map();
  SYNONYM_GROUPS.forEach((g, gi) => g.forEach((w) => { SYN_INDEX.set(stem(w), (SYN_INDEX.get(stem(w)) || new Set()).add(gi)); }));

  /* ---------- Normalización ---------- */
  // minúsculas, sin tildes (ñ → n), espacios limpios. Conserva «+» y «#» (C++, C#).
  function normalize(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9+#]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Raíz muy ligera: quita plural y vocal final (redes→red, juegos→jueg, lenguaje/lenguajes→lenguaj)
  function stem(t) {
    if (t.length <= 3) return t;
    let w = t;
    if (w.length > 4 && /[^aeiou]es$/.test(w)) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    if (w.length > 3 && /[aeo]$/.test(w)) w = w.slice(0, -1);
    return w;
  }

  const tokenize = (s) => normalize(s).split(' ').filter(Boolean);

  /* ---------- Consulta ---------- */
  function parseQuery(raw) {
    const norm = normalize(raw);
    // Las frases conocidas se extraen primero y se convierten en un término propio
    let rest = norm;
    const phraseTerms = [];
    PHRASES.forEach((p) => {
      if (!p.re.test(rest)) return;
      rest = rest.replace(p.re, ' ').replace(/\s+/g, ' ').trim();
      phraseTerms.push({ word: p.label, stem: p.words.map(stem).join('+'), phrase: p.words.map(stem), syn: p.syn.map(stem) });
    });

    const all = norm ? norm.split(' ') : [];
    const meaningful = (rest ? rest.split(' ') : []).filter((t) => !STOP.has(t) && !GENERIC.has(t) && !ALL_WORDS.has(t));
    const wantsAll = all.length > 0 && !meaningful.length && !phraseTerms.length && all.some((t) => GENERIC.has(t) || ALL_WORDS.has(t));

    // Cada término = { word, stem, syn: [stems de sinónimos] }
    const seen = new Set();
    const terms = [];
    meaningful.forEach((w) => {
      const st = stem(w);
      if (!w || seen.has(st)) return;
      seen.add(st);
      const syn = new Set();
      (SYN_INDEX.get(st) || []).forEach((gi) => SYNONYM_GROUPS[gi].forEach((x) => { const sx = stem(x); if (sx !== st) syn.add(sx); }));
      terms.push({ word: w, stem: st, syn: [...syn] });
    });
    phraseTerms.forEach((t) => { if (!seen.has(t.stem)) { seen.add(t.stem); terms.push(t); } });
    // Búsqueda progresiva: una sola palabra, aunque sea corta o «vacía» (a, de, y…), se trata como prefijo
    if (!terms.length && !phraseTerms.length && !all.some((t) => GENERIC.has(t) || ALL_WORDS.has(t)) && all.length === 1) {
      terms.push({ word: all[0], stem: stem(all[0]), syn: [] });
    }
    return { raw: String(raw == null ? '' : raw).trim(), norm, terms, wantsAll, empty: !all.length, onlyNoise: all.length > 0 && !terms.length && !wantsAll };
  }

  /* ---------- Índice de un proyecto ---------- */
  const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

  const INDEX_CACHE = new WeakMap();   // array de proyectos → índice ya construido
  function indexAll(items) {
    let idx = INDEX_CACHE.get(items);
    if (!idx) { idx = items.map((it) => indexItem(it)); INDEX_CACHE.set(items, idx); }
    return idx;
  }

  function indexItem(it) {
    const tok = (arr) => arr.flatMap(tokenize).map((t) => ({ t, s: stem(t) }));
    const files = [it.fileName, ...(it.extraFiles || []).flatMap((f) => [f.name, f.fileName]), ...(it.extraLinks || []).map((l) => l.label)];
    const ext = it.fileName && it.fileName.includes('.') ? it.fileName.split('.').pop() : '';
    return {
      item: it,
      nameNorm: normalize(it.name),
      fields: {
        name: tok([it.name]),
        tags: tok(it.tags || []),
        category: tok([it.category]),
        files: tok(files.filter(Boolean)),
        text: tok([it.description]),
        meta: tok([ext, it.kind, it.date, hostOf(it.link), ...(it.extraLinks || []).map((l) => hostOf(l.url))]),
      },
    };
  }

  // ¿Cuánto vale esta raíz dentro de este campo? (0 = no aparece)
  function fieldScore(entries, st, w, allowPrefix, minPrefix) {
    let best = 0;
    for (const e of entries) {
      if (e.s === st || e.t === st) { best = Math.max(best, w.exact); continue; }
      if (allowPrefix && st.length >= minPrefix && (e.s.startsWith(st) || e.t.startsWith(st))) best = Math.max(best, w.prefix);
    }
    return best;
  }

  function scoreTerm(entry, term) {
    let best = 0, where = '';
    for (const [field, w] of Object.entries(CONFIG.weights)) {
      const minPrefix = 1;
      let v = 0;
      if (term.phrase) {
        // frase: todas sus palabras en el mismo campo
        const parts = term.phrase.map((st) => fieldScore(entry.fields[field], st, w, true, 3));
        if (parts.every(Boolean)) v = Math.min(...parts) * 0.9;
      } else {
        v = fieldScore(entry.fields[field], term.stem, w, true, minPrefix);
      }
      if (!v) {
        for (const sx of term.syn) { const sv = fieldScore(entry.fields[field], sx, w, false, 99) * CONFIG.synonymFactor; if (sv > v) v = sv; }
      }
      if (v > best) { best = v; where = field; }
    }
    // trozo de palabra dentro del título («racer» en «Packet Tracer»)
    if (!best && !term.phrase && term.word.length >= 4 && entry.nameNorm.includes(term.word)) { best = CONFIG.substringInName; where = 'name'; }
    return { v: best, where };
  }

  /* ---------- Búsqueda ---------- */
  /**
   * @param {Array} items  proyectos publicados normalizados (Projects.getCatalog().items)
   * @param {string} raw   texto escrito por la persona
   * @returns {{ query, mode, results: Array<{item, score, matched: string[]}> }}
   *   mode: 'empty' | 'noise' | 'all' | 'full' | 'partial' | 'none'
   */
  function search(items, raw) {
    const q = parseQuery(raw);
    const base = { query: q, results: [] };
    if (q.empty) return { ...base, mode: 'empty' };

    // Sin duplicados: mismo id, o mismo título + mismo archivo/enlace
    const seen = new Set();
    const unique = [];
    (items || []).forEach((it) => {
      const key = it.id || '';
      const sig = `${normalize(it.name)}|${it.url || it.link || ''}`;
      if (seen.has(`id:${key}`) || seen.has(`sig:${sig}`)) return;
      seen.add(`id:${key}`); seen.add(`sig:${sig}`);
      unique.push(it);
    });

    if (q.wantsAll) return { ...base, mode: 'all', results: unique.slice(0, CONFIG.maxResults).map((item) => ({ item, score: 0, matched: [] })), total: unique.length };
    if (q.onlyNoise) return { ...base, mode: 'noise' };

    // Índice (en caché si `items` es el mismo array que en la búsqueda anterior)
    const idxByItem = new Map();
    indexAll(items || []).forEach((e) => idxByItem.set(e.item, e));

    // Formas de la consulta completa para los niveles de título: texto escrito y palabras útiles
    const forms = [...new Set([q.norm, q.terms.filter((t) => !t.phrase).map((t) => t.word).join(' ')].filter(Boolean))];

    const rows = unique.map((item, order) => {
      const entry = idxByItem.get(item) || indexItem(item);
      let score = 0, hit = 0;
      const matched = [];
      const wheres = new Set();
      q.terms.forEach((term) => {
        const r = scoreTerm(entry, term);
        if (r.v > 0) { score += r.v; hit++; matched.push(term.word); wheres.add(r.where); }
      });

      // Nivel de relevancia (1 = mejor):
      //  1 el título EMPIEZA por la consulta · 2 una palabra del título empieza por ella · 3 el título la CONTIENE
      //  4 coincide en etiquetas / categoría · 5 coincide en descripción, archivos, enlaces u otros metadatos
      const nm = entry.nameNorm;
      let tier = 0;
      if (forms.some((f) => nm.startsWith(f))) tier = 1;
      else if (forms.some((f) => (' ' + nm).includes(' ' + f))) tier = 2;
      else if (forms.some((f) => f.length >= 3 && nm.includes(f))) tier = 3;
      if (tier && !hit) { hit = q.terms.length; matched.push(...q.terms.map((t) => t.word)); }   // el título contiene la consulta completa
      if (!tier && hit) tier = wheres.has('name') ? 3 : (wheres.has('tags') || wheres.has('category')) ? 4 : 5;
      if (hit && q.terms.length > 1 && forms.some((f) => nm.includes(f))) score += CONFIG.phraseBonus;
      return { item, score, hit, matched, order, tier };
    }).filter((r) => r.hit > 0);

    const sorter = (a, b) => a.tier - b.tier || b.score - a.score || a.order - b.order;
    const full = rows.filter((r) => r.hit === q.terms.length).sort(sorter);
    const pick = (list) => list.slice(0, CONFIG.maxResults).map(({ item, score, matched, tier }) => ({ item, score, matched, tier }));

    if (full.length) return { ...base, mode: 'full', results: pick(full), total: full.length };
    // Varias palabras y ninguna cumple todas: se muestran las que cumplen alguna (y se avisa)
    if (q.terms.length > 1 && rows.length) { const part = rows.sort((a, b) => b.hit - a.hit || sorter(a, b)); return { ...base, mode: 'partial', results: pick(part), total: part.length }; }
    return { ...base, mode: 'none' };
  }

  /* ---------- Sugerencias: las etiquetas/categorías más usadas DEL CATÁLOGO real ---------- */
  function suggestions(items, max = 5) {
    const count = new Map();
    (items || []).forEach((it) => {
      [it.category, ...(it.tags || [])].filter(Boolean).forEach((w) => {
        const k = normalize(w);
        if (!k) return;
        const cur = count.get(k) || { label: w, n: 0 };
        cur.n++;
        count.set(k, cur);
      });
    });
    return [...count.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es')).slice(0, max).map((x) => x.label);
  }

  const api = { search, suggestions, normalize, parseQuery, CONFIG };
  root.ProjectSearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
