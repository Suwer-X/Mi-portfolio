/* =========================================================
   Administrador local del portfolio — admin-local/admin.js
   Sin servidor ni servicios externos. Los datos viven en IndexedDB
   (este navegador) y se publican exportando un ZIP (o escribiendo
   directamente en la carpeta del repo si el navegador lo permite).
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Configuración ---------- */
  const CONFIG = {
    repoBase: '../',                              // raíz del repo respecto a admin-local/
    manifestPath: 'sources/projects/projects.json',
    filesDir: 'sources/projects/',
    maxFileMB: 25,
    maxTags: 8,
    saveDelayMs: 500,
    backupWarnDays: 7,
    dbName: 'portfolio-admin',
  };
  const BLOCKED = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'dll', 'jar', 'apk', 'app', 'vbs', 'vbe', 'jse', 'wsf', 'lnk', 'pif', 'reg', 'cpl']);
  const IMG_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg']);

  /* ---------- Utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
  const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const getExt = (n) => { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; };
  const isImage = (n) => IMG_EXT.has(getExt(n));
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const fmtSize = (b) => (!b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(b < 10485760 ? 1 : 0)} MB`);
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const slugify = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'proyecto';
  function safeName(name) {
    const ext = getExt(name);
    const base = ext ? name.slice(0, -(ext.length + 1)) : name;
    const clean = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'archivo';
    return ext ? `${clean}.${ext}` : clean;
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  let toastTimer = 0;
  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    const box = $('#toasts');
    const host = $('#dlg').open ? $('#dlg') : document.body;   // dentro del diálogo modal para que no quede tapado
    if (box.parentElement !== host) host.append(box);
    while (box.children.length >= 3) box.firstElementChild.remove();
    box.append(el);
    clearTimeout(toastTimer);
    setTimeout(() => el.remove(), type === 'err' ? 8000 : 4000);
  }

  /* ---------- ZIP (sin compresión, sin dependencias) ---------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  async function zipBuild(entries) {
    const enc = new TextEncoder();
    const parts = []; const central = []; let offset = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const e of entries) {
      const nameBytes = enc.encode(e.name);
      const bytes = e.data instanceof Blob ? new Uint8Array(await e.data.arrayBuffer()) : typeof e.data === 'string' ? enc.encode(e.data) : e.data;
      const crc = crc32(bytes);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, bytes.length, true); lh.setUint32(22, bytes.length, true); lh.setUint16(26, nameBytes.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, nameBytes, bytes);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, bytes.length, true); ch.setUint32(24, bytes.length, true); ch.setUint16(28, nameBytes.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, nameBytes);
      offset += 30 + nameBytes.length + bytes.length;
    }
    let cdSize = 0; for (const c of central) cdSize += c.byteLength;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }
  async function zipRead(blob) {
    const buf = await blob.arrayBuffer();
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('No es un ZIP válido.');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder(); const out = [];
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP dañado.');
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
      if (method !== 0) throw new Error('Solo se admiten copias creadas por este administrador (ZIP sin compresión).');
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      out.push({ name, blob: new Blob([buf.slice(start, start + size)]) });
      p += 46 + nlen + elen + clen;
    }
    return out;
  }

  /* ---------- IndexedDB ---------- */
  const db = {
    _p: null,
    open() {
      if (!this._p) {
        this._p = new Promise((res, rej) => {
          if (!('indexedDB' in window)) return rej(new Error('IndexedDB no disponible'));
          const r = indexedDB.open(CONFIG.dbName, 1);
          r.onupgradeneeded = () => { r.result.createObjectStore('projects', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      return this._p;
    },
    async run(store, mode, fn) {
      const d = await this.open();
      return new Promise((res, rej) => {
        const t = d.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req.result);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    },
    all: () => db.run('projects', 'readonly', (s) => s.getAll()),
    put: (p) => db.run('projects', 'readwrite', (s) => s.put(p)),
    del: (id) => db.run('projects', 'readwrite', (s) => s.delete(id)),
    getMeta: (k) => db.run('meta', 'readonly', (s) => s.get(k)),
    setMeta: (k, v) => db.run('meta', 'readwrite', (s) => s.put(v, k)),
  };

  /* ---------- Estado ---------- */
  const state = { projects: [], selectedId: null, filter: 'all', query: '', repo: { handle: null, status: 'none', msg: '', savedAt: 0, warn: '', verified: false }, lastPublishedJson: null, lastBackup: null, tombstones: [], manifestNote: '', persistent: true };
  const urlCache = new Map();
  const current = () => state.projects.find((p) => p.id === state.selectedId) || null;

  const newProject = () => ({
    id: uid(), name: 'Nuevo proyecto', description: '', category: '', tags: [], status: 'draft',
    date: todayISO(), createdAt: Date.now(), updatedAt: Date.now(), dir: '', files: [], links: [], imported: false, order: null,
  });
  function uniqueDir(name, selfId) {
    const used = new Set(state.projects.filter((p) => p.id !== selfId).map((p) => p.dir));
    const base = slugify(name); let d = base, n = 2;
    while (used.has(d)) d = `${base}-${n++}`;
    return d;
  }
  const repoUrl = (path) => CONFIG.repoBase + CONFIG.filesDir + path.split('/').map(encodeURIComponent).join('/');
  function fileUrl(f) {
    if (f.blob) { if (!urlCache.has(f.id)) urlCache.set(f.id, URL.createObjectURL(f.blob)); return urlCache.get(f.id); }
    return repoUrl(f.path);
  }
  const dropUrl = (id) => { if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); } };

  /* ---------- Guardado en el navegador (IndexedDB) ----------
     Un temporizador POR proyecto y una cola que serializa las escrituras: guardar el proyecto B
     ya no cancela el guardado pendiente del proyecto A (antes había un único temporizador global). */
  const saveTimers = new Map();          // id de proyecto → temporizador
  let dbChain = Promise.resolve();       // cola de escrituras
  const BROWSER_SAVED = 'Guardado en este navegador ✓ (aún no publicado en la carpeta)';
  function setSaveState(t) { const el = $('#savestate'); if (el) el.textContent = t; }
  function reportSaveError(err) {
    const quota = err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''));
    setSaveState('Error al guardar');
    toast(quota ? 'No queda espacio en el navegador. Haz una copia de seguridad y elimina archivos.' : 'No se pudo guardar el proyecto en este navegador.', 'err');
  }
  // Guarda ya y devuelve una promesa que termina cuando IndexedDB confirma la escritura (rechaza si falla)
  function persist(p) {
    clearTimeout(saveTimers.get(p.id)); saveTimers.delete(p.id);
    if (!state.persistent) return Promise.resolve();
    const job = dbChain.then(() => db.put(p));
    dbChain = job.catch(() => {});
    return job.catch((err) => { reportSaveError(err); throw err; });
  }
  function scheduleSave(p) {
    p.updatedAt = Date.now();
    setSaveState('Guardando…');
    clearTimeout(saveTimers.get(p.id));
    saveTimers.set(p.id, setTimeout(() => { persist(p).then(() => setSaveState(state.persistent ? BROWSER_SAVED : 'Sin almacenamiento persistente')).catch(() => {}); }, CONFIG.saveDelayMs));
  }
  async function saveNow(p) {
    try {
      await persist(p);
      setSaveState(state.persistent ? BROWSER_SAVED : 'Sin almacenamiento persistente');
      renderRepoStatus();
    } catch { /* ya notificado en persist() */ }
  }
  // Fuerza el guardado de todo lo pendiente (se llama antes de publicar, exportar o hacer copia)
  async function flushSaves() {
    for (const id of [...saveTimers.keys()]) { const p = state.projects.find((x) => x.id === id); if (p) { try { await persist(p); } catch { /* notificado */ } } else { clearTimeout(saveTimers.get(id)); saveTimers.delete(id); } }
    await dbChain;
  }
  // Si se cierra o recarga la página, lo pendiente se envía a IndexedDB en ese momento
  window.addEventListener('pagehide', () => {
    saveTimers.forEach((t, id) => { clearTimeout(t); const p = state.projects.find((x) => x.id === id); if (p && state.persistent) db.put(p).catch(() => {}); });
    saveTimers.clear();
  });
  // Protección frente a recargas (p. ej. Live Server) mientras se escribe en la carpeta
  const reloadGuard = window.__reloadGuard || { busy: false, deferred: 0 };
  let guardSeq = 0;
  window.addEventListener('beforeunload', (e) => { if (reloadGuard.busy) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Carga inicial e importación del catálogo publicado ---------- */
  function projectFromManifest(e, i) {
    const name = String(e.name || 'Proyecto').slice(0, 120);
    const key = e.file || e.link || String(i);
    const p = newProject();
    Object.assign(p, {
      id: typeof e.id === 'string' && e.id ? e.id : `imp-${slugify(name)}-${hash(key)}`,
      name, description: String(e.description || ''), category: String(e.category || ''),
      tags: Array.isArray(e.tags) ? e.tags.map(String) : [], status: 'published', imported: true,
      date: typeof e.date === 'string' && e.date ? e.date : todayISO(),
      dir: slugify(name) + '-' + hash(key).slice(0, 3), order: i,
    });
    const addFile = (path, size, name2, cover) => {
      if (typeof path !== 'string' || !path) return;
      const ex = p.files.find((f) => f.path === path);
      if (ex) { if (cover) ex.cover = true; return; }
      const fileName = path.split('/').pop();
      p.files.push({ id: uid(), fileName, path, size: Number(size) || 0, mime: '', blob: null, cover: !!cover, label: name2 || '' });
    };
    addFile(e.file, e.size);
    (Array.isArray(e.files) ? e.files : []).forEach((f) => f && addFile(f.file, f.size, f.name));
    if (e.cover) addFile(e.cover, 0, '', true);
    if (typeof e.link === 'string' && e.link) p.links.push({ label: 'Enlace', url: e.link });
    (Array.isArray(e.links) ? e.links : []).forEach((l) => l && l.url && p.links.push({ label: String(l.label || 'Enlace'), url: String(l.url) }));
    return p;
  }

  // source: undefined → leer por HTTP (Live Server); null → no hay catálogo; string → texto del JSON
  async function importManifest(source) {
    let list = null;
    try {
      let text;
      if (source === undefined) {
        const res = await fetch(CONFIG.repoBase + CONFIG.manifestPath, { cache: 'no-store' });
        if (res.status === 404) { state.manifestNote = ''; return 0; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      } else if (source === null) { return 0; } else text = source;
      const data = JSON.parse(text);
      list = Array.isArray(data) ? data : data.projects;
      if (!Array.isArray(list)) throw new Error('formato no válido');
      state.manifestNote = '';
    } catch (err) {
      state.manifestNote = `No se pudo leer ${CONFIG.manifestPath} (${err.message}). Es normal si abres el archivo con doble clic (file://): usa Live Server desde la raíz del repo o selecciona la carpeta del portfolio.`;
      return 0;
    }
    const known = new Set(state.projects.map((p) => p.id));
    const ids = [];
    let added = 0;
    list.forEach((e, i) => {
      if (!e || typeof e !== 'object') return;
      const p = projectFromManifest(e, i);
      ids.push(p.id);
      if (known.has(p.id) || state.tombstones.includes(p.id)) return;
      state.projects.push(p); known.add(p.id); added++;
      persist(p).catch(() => {});
    });
    // limpia lápidas de proyectos que ya no están en el catálogo del repo
    const keep = state.tombstones.filter((id) => ids.includes(id));
    if (keep.length !== state.tombstones.length) { state.tombstones = keep; db.setMeta('tombstones', keep).catch(() => {}); }
    if (added) toast(`${plural(added, 'proyecto publicado importado', 'proyectos publicados importados')} desde el repo.`, 'ok');
    return added;
  }

  /* ---------- Manifiesto público ---------- */
  const pubSorted = () => state.projects.filter((p) => p.status === 'published')
    .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name));
  function normalizeOrders() {
    pubSorted().forEach((p, i) => { if (p.order !== i) { p.order = i; persist(p).catch(() => {}); } });
  }
  function validateProject(p) {
    const issues = [];
    if (!p.name.trim()) issues.push('no tiene nombre');
    if (!p.files.length && !p.links.some((l) => /^https?:\/\//i.test(l.url.trim()))) issues.push('no tiene ningún archivo ni enlace válido (la web lo ocultaría)');
    p.links.forEach((l) => { if (l.url.trim() && !/^https?:\/\//i.test(l.url.trim())) issues.push(`enlace no válido: ${l.url}`); });
    return issues;
  }
  // ÚNICA fuente del catálogo: la usan «Exportar ZIP», «Solo projects.json», «Copiar JSON» y «Guardar y publicar en local»
  const serializeCatalog = (entries) => JSON.stringify({ projects: entries }, null, 2) + '\n';
  // Rutas (relativas a sources/projects/) que el catálogo referencia: archivo principal, portada y adjuntos
  const refPaths = (entries) => [...new Set(entries.flatMap((e) => [e.file, e.cover, ...(e.files || []).map((x) => x.file)]).filter(Boolean))];
  function buildManifest() {
    const pub = pubSorted();
    const entries = []; const problems = []; const toCopy = [];
    for (const p of pub) {
      const issues = validateProject(p);
      if (issues.length) { problems.push({ p, issues }); }
      const pathOf = (f) => f.path || `${p.dir}/${f.fileName}`;
      const e = { id: p.id, name: p.name.trim(), description: p.description.trim().slice(0, 400), category: p.category.trim(), tags: p.tags, date: p.date };
      const cover = p.files.find((f) => f.cover);
      const primary = p.files[0];
      if (cover) e.cover = pathOf(cover);
      if (primary) { e.file = pathOf(primary); if (primary.size) e.size = primary.size; }
      const extras = p.files.filter((f) => f !== primary && f !== cover);
      if (extras.length) e.files = extras.map((f) => ({ name: f.label || f.fileName, file: pathOf(f), size: f.size || 0 }));
      const links = p.links.filter((l) => /^https?:\/\//i.test(l.url.trim())).map((l) => ({ label: l.label.trim() || 'Enlace', url: l.url.trim() }));
      if (links.length) { e.link = links[0].url; if (links.length > 1) e.links = links.slice(1); }
      if (!e.file && !e.link) continue;
      entries.push(e);
      p.files.forEach((f) => { if (f.blob) toCopy.push({ path: CONFIG.filesDir + pathOf(f), blob: f.blob, project: p }); });
    }
    return { json: serializeCatalog(entries), entries, problems, toCopy, published: pub.length };
  }

  /* ---------- Exportar / publicar ---------- */
  function openDialog(html) {
    const dlg = $('#dlg');
    document.body.append($('#toasts'));
    dlg.innerHTML = `<div class="dlg">${html}</div>`;
    if (!dlg.open) dlg.showModal();
    return dlg;
  }
  const closeDialog = () => { const d = $('#dlg'); if (d.open) d.close(); };
  $('#dlg').addEventListener('click', (e) => { if (e.target.id === 'dlg' || e.target.closest('[data-close]')) closeDialog(); });

  function openExport() {
    const m = buildManifest();
    const totalSize = m.toCopy.reduce((n, f) => n + f.blob.size, 0);
    const issues = m.problems.length ? `<div class="issues"><b>Revisa estos proyectos publicados:</b><ul>${m.problems.map((x) => `<li><b>${esc(x.p.name)}</b>: ${esc(x.issues.join('; '))}</li>`).join('')}</ul></div>` : '';
    openDialog(`
      <h2>Exportar ZIP (alternativa)</h2>
      <p>Para el uso habitual selecciona la carpeta del portfolio y pulsa «Guardar y publicar en local». Este ZIP sirve como alternativa o respaldo. Se exportarán <b>solo los proyectos marcados como «Publicado»</b>. Los borradores nunca salen del administrador.</p>
      <div class="stats">
        <div class="stat"><b>${m.entries.length}</b>proyectos en la web</div>
        <div class="stat"><b>${m.toCopy.length}</b>archivos nuevos (${esc(fmtSize(totalSize)) || '0 B'})</div>
        <div class="stat"><b>${state.projects.length - m.published}</b>borradores (no se exportan)</div>
      </div>
      ${issues}
      <div class="dlg-actions">
        <button class="btn btn-primary" data-x="zip" type="button">Descargar ZIP de publicación</button>
        <button class="btn" data-x="json" type="button">Solo projects.json</button>
        <button class="btn" data-x="copy" type="button">Copiar JSON</button>
      </div>
      <ol>
        <li>Descomprime el ZIP <b>sobre la raíz de tu copia local del repo</b> (crea/actualiza <code>sources/projects/</code>).</li>
        <li>Revisa los cambios y súbelos: <code>git add . &amp;&amp; git commit -m "Actualizar proyectos" &amp;&amp; git push</code>.</li>
      </ol>
      <p class="hint">Si despublicas o borras un proyecto, sus archivos antiguos quedan en el repo hasta que los elimines tú.</p>
      <div class="dlg-foot"><button class="btn" data-close type="button">Cerrar</button></div>`);
    $('#dlg .dlg').onclick = async (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      const mm = buildManifest();
      if (b.dataset.x === 'json') { saveBlob(new Blob([mm.json], { type: 'application/json' }), 'projects.json'); toast('projects.json descargado.', 'ok'); }
      else if (b.dataset.x === 'copy') { try { await navigator.clipboard.writeText(mm.json); toast('JSON copiado.', 'ok'); } catch { toast('No se pudo copiar.', 'err'); } }
      else if (b.dataset.x === 'zip') {
        b.disabled = true;
        try {
          const entries = [{ name: CONFIG.manifestPath, data: mm.json }, ...mm.toCopy.map((f) => ({ name: f.path, data: f.blob }))];
          saveBlob(await zipBuild(entries), `portfolio-publicacion-${todayISO()}.zip`);
          toast('ZIP generado. Descomprímelo sobre la raíz del repo.', 'ok');
        } catch (err) { toast(`No se pudo crear el ZIP: ${err.message}`, 'err'); }
        b.disabled = false;
      }
    };
  }

  /* ---------- Carpeta del portfolio (File System Access API) ---------- */
  const FSA = typeof window.showDirectoryPicker === 'function';
  const NEEDED = ['index.html', 'js/projects.js'];     // archivos que debe tener la raíz del portfolio
  const NEEDED_DIRS = ['js', 'sources'];               // carpetas que debe tener la raíz del portfolio
  // Motivo por el que no se puede guardar directamente (cadena vacía si se puede)
  function fsaProblem() {
    if (FSA) return '';
    if (!window.isSecureContext) return 'Esta página no está en un contexto seguro: ábrela con Live Server (http://127.0.0.1 o localhost). Mientras tanto usa «Exportar ZIP».';
    if (navigator.brave) return 'Brave desactiva por defecto la API de carpetas (File System Access). Actívala en brave://flags/#file-system-access-api, reinicia Brave y recarga esta página. Mientras tanto usa «Exportar ZIP».';
    return 'Este navegador no permite guardar en carpetas (solo Chrome, Edge o Brave con la API activada). Usa «Exportar ZIP».';
  }

  function checkRel(rel) {
    const parts = String(rel).split('/');
    if (!rel || rel.startsWith('/') || rel.includes('\\') || parts.some((x) => !x || x === '.' || x === '..' || /[:*?"<>|\u0000-\u001f]/.test(x))) throw new Error(`Ruta no válida: «${rel}»`);
    if (!rel.startsWith(CONFIG.filesDir)) throw new Error(`Ruta fuera de ${CONFIG.filesDir}: «${rel}»`);
    return parts;
  }
  async function dirAt(root, parts, create) { let d = root; for (const x of parts) d = await d.getDirectoryHandle(x, { create }); return d; }
  async function statFile(root, rel) {
    const parts = checkRel(rel).slice(); const name = parts.pop();
    try { const d = await dirAt(root, parts, false); return await (await d.getFileHandle(name)).getFile(); }
    catch (e) { if (e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) return null; throw e; }
  }
  async function writeFileAt(root, rel, data) {
    const parts = checkRel(rel).slice(); const name = parts.pop();
    const d = await dirAt(root, parts, true);
    let existed = true;
    try { await d.getFileHandle(name); } catch { existed = false; }
    let w;
    try {
      w = await (await d.getFileHandle(name, { create: true })).createWritable();   // escribe en un temporal y confirma al cerrar
      await w.write(data); await w.close();
    } catch (e) {
      try { await w?.abort(); } catch { /* ya cerrado */ }
      if (!existed) { try { await d.removeEntry(name); } catch { /* nada que limpiar */ } }   // no dejar un archivo vacío
      throw e;
    }
  }
  async function readTextAt(root, rel) { const f = await statFile(root, rel); return f ? f.text() : null; }
  async function hasPerm(h, ask) {
    const o = { mode: 'readwrite' };
    if ((await h.queryPermission(o)) === 'granted') return true;
    return ask ? (await h.requestPermission(o)) === 'granted' : false;
  }
  async function missingInFolder(h) {
    const missing = [];
    for (const d of NEEDED_DIRS) { try { await dirAt(h, [d], false); } catch { missing.push(`${d}/`); } }
    for (const rel of NEEDED) {
      try { const parts = rel.split('/'); const name = parts.pop(); await (await dirAt(h, parts, false)).getFileHandle(name); } catch { missing.push(rel); }
    }
    return missing;
  }
  // Si la carpeta elegida no es la raíz pero una subcarpeta directa sí lo es, devuelve su nombre
  async function nestedRoot(h) {
    try { for await (const e of h.values()) if (e.kind === 'directory' && !(await missingInFolder(e)).length) return e.name; } catch { /* sin listado */ }
    return '';
  }
  const normNl = (t) => String(t).replace(/\r\n/g, '\n');
  const bytesOf = async (b) => new Uint8Array(await b.arrayBuffer());
  async function sameBytes(a, b) { return a.size === b.size && crc32(await bytesOf(a)) === crc32(await bytesOf(b)); }
  const isHttp = () => /^https?:$/.test(location.protocol);

  // ¿Sirve este servidor el mismo catálogo que hay en la carpeta seleccionada? (aviso, no error)
  async function servedWarning() {
    if (!isHttp()) return '';
    try {
      const res = await fetch(`${CONFIG.repoBase}${CONFIG.manifestPath}?_=${Date.now()}`, { cache: 'no-store' });
      const disk = state.lastPublishedJson;
      if (!res.ok) return disk === null ? '' : `El servidor desde el que abres esta página no encuentra ${CONFIG.manifestPath} (HTTP ${res.status}), pero la carpeta «${state.repo.handle.name}» sí lo tiene: probablemente no es la misma carpeta que sirve Live Server.`;
      const served = await res.text();
      if (disk === null) return `La carpeta «${state.repo.handle.name}» no tiene ${CONFIG.manifestPath} pero el servidor sí: probablemente no es la misma carpeta que sirve Live Server.`;
      if (canonJson(served) !== canonJson(disk)) return `El catálogo que sirve este servidor no coincide con el de la carpeta «${state.repo.handle.name}». Comprueba que es la misma carpeta que tienes abierta en VS Code / Live Server.`;
    } catch { /* servidor no accesible: no se puede comprobar */ }
    return '';
  }
  // Tras escribir: comprueba por HTTP que la web servida ve el catálogo nuevo y sus archivos
  async function checkServed(m) {
    if (!isHttp()) return { state: 'unavailable', detail: 'esta página no se abrió por HTTP (ábrela con Live Server para poder comprobarlo)' };
    try {
      const res = await fetch(`${CONFIG.repoBase}${CONFIG.manifestPath}?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return { state: 'mismatch', detail: `el servidor responde HTTP ${res.status} para ${CONFIG.manifestPath}` };
      if (canonJson(await res.text()) !== canonJson(m.json)) return { state: 'mismatch', detail: 'el servidor sirve un projects.json distinto del que se acaba de escribir' };
      const bad = [];
      for (const rel of refPaths(m.entries).slice(0, 80)) {
        const rr = await fetch(repoUrl(rel), { method: 'HEAD', cache: 'no-store' });
        if (!rr.ok) bad.push(rel);
      }
      if (bad.length) return { state: 'mismatch', detail: `el servidor no encuentra ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}` };
      return { state: 'ok' };
    } catch (err) { return { state: 'unavailable', detail: `no se pudo contactar con el servidor (${err.message})` }; }
  }
  // Diálogo de confirmación con promesa (true = aceptado)
  function confirmDialog(html, okLabel) {
    return new Promise((resolve) => {
      const dlg = openDialog(`${html}<div class="dlg-foot"><button class="btn" data-close type="button">Cancelar</button><button class="btn btn-primary" id="cfOk" type="button">${esc(okLabel)}</button></div>`);
      let done = false;
      const fin = (v) => { if (done) return; done = true; dlg.removeEventListener('close', onClose); resolve(v); };
      const onClose = () => fin(false);
      dlg.addEventListener('close', onClose);
      $('#cfOk').onclick = () => { fin(true); closeDialog(); };
    });
  }
  function friendlyError(err) {
    const n = err && err.name;
    if (n === 'SecurityError') return 'El navegador ha bloqueado esta operación por seguridad (en Brave, activa brave://flags/#file-system-access-api; si no, usa «Exportar ZIP»)';
    if (n === 'NotAllowedError') return 'El navegador no tiene permiso de escritura en la carpeta. Pulsa «Reconectar carpeta» y acepta el permiso';
    if (n === 'NotFoundError') return 'La carpeta (o un archivo) ya no existe. Vuelve a seleccionar la carpeta del portfolio';
    if (n === 'NoModificationAllowedError' || n === 'InvalidStateError') return 'No se puede escribir en ese archivo (¿abierto en otro programa o de solo lectura?)';
    if (n === 'QuotaExceededError') return 'No hay espacio suficiente en el disco';
    return err && err.message ? err.message : 'Error desconocido';
  }
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const withSuffix = (name, n) => { const e = getExt(name); return e ? `${name.slice(0, -(e.length + 1))}-${n}.${e}` : `${name}-${n}`; };
  const canonJson = (t) => { try { return JSON.stringify(JSON.parse(t)); } catch { return null; } };

  function pendingInfo() {
    const m = buildManifest();
    const unwritten = state.projects.filter((p) => p.status === 'published').reduce((n, p) => n + p.files.filter((f) => f.blob && !f.written).length, 0);
    const jsonChanged = canonJson(m.json) !== canonJson(state.lastPublishedJson || '{"projects":[]}');
    return { unwritten, jsonChanged, count: unwritten + (jsonChanged ? 1 : 0) };
  }
  function renderRepoStatus() {
    const el = $('#statusbar'); if (!el) return;
    const r = state.repo; let cls = '', text = '', btns = '';
    const pick = `<button class="btn btn-sm" id="btnPickDir" type="button">${r.handle ? 'Cambiar carpeta' : 'Seleccionar carpeta del portfolio'}</button>`;
    if (!FSA) { text = fsaProblem(); cls = 'warn'; btns = '<button class="btn btn-sm btn-primary" id="btnExportZip" type="button">Exportar ZIP</button>'; }
    else if (!r.handle) { text = 'Carpeta no conectada. Selecciona la carpeta raíz de tu portfolio para guardar directamente en ella.'; btns = pick; }
    else if (r.status === 'ask') { cls = 'warn'; text = `Carpeta «${r.handle.name}»: hace falta volver a dar permiso al navegador.`; btns = `<button class="btn btn-sm btn-primary" id="btnReconnect" type="button">Reconectar carpeta</button>${pick}`; }
    else if (r.status === 'saving') { cls = 'busy'; text = 'Guardando en la carpeta…'; }
    else if (r.status === 'error') { cls = 'err'; text = r.msg; btns = `<button class="btn btn-sm" id="btnReconnect" type="button">Reconectar carpeta</button>${pick}<button class="btn btn-sm btn-primary" id="btnPublishLocal" type="button">Reintentar</button>`; }
    else {
      const info = pendingInfo();
      cls = info.count || r.warn ? 'warn' : 'ok';
      text = `Carpeta «${r.handle.name}» conectada · ` + (info.count ? plural(info.count, 'cambio pendiente de guardar', 'cambios pendientes de guardar') : 'todo guardado' + (r.savedAt ? ` (${new Date(r.savedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}${r.verified ? ', verificado' : ''})` : '')) + (r.warn ? ' · ⚠ revisa el aviso' : '');
      btns = `${pick}<button class="btn btn-sm btn-primary" id="btnPublishLocal" type="button">Guardar y publicar en local</button>`;
    }
    el.className = `statusbar ${cls}`;
    el.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="stext" role="status">${esc(text)}</span><span class="sbtns">${btns}</span>`;
  }
  function setRepo(status, msg = '') { state.repo.status = status; state.repo.msg = msg; renderRepoStatus(); }

  async function loadFromFolder() {
    const text = await readTextAt(state.repo.handle, CONFIG.manifestPath);
    state.lastPublishedJson = text;
    await importManifest(text);
    normalizeOrders();
  }
  async function pickFolder() {
    if (!FSA) return toast('Tu navegador no permite escribir en carpetas. Usa Chrome/Edge o el ZIP.', 'err');
    let h;
    try { h = await window.showDirectoryPicker({ id: 'portfolio-repo', mode: 'readwrite' }); }
    catch (e) { if (e && e.name !== 'AbortError') toast(friendlyError(e), 'err'); return; }
    try {
      if (!(await hasPerm(h, true))) throw Object.assign(new Error('permiso denegado'), { name: 'NotAllowedError' });
      const missing = await missingInFolder(h);
      if (missing.length) {
        const inner = await nestedRoot(h);
        return toast(`«${h.name}» no parece la raíz del portfolio: falta ${missing.join(', ')}.` + (inner ? ` Has elegido la carpeta que contiene «${inner}»: entra y selecciona «${inner}».` : ''), 'err');
      }
      state.repo.handle = h; state.repo.savedAt = 0; state.repo.verified = false;
      db.setMeta('repoHandle', h).catch(() => {});
      await loadFromFolder();
      state.repo.warn = await servedWarning();
      setRepo('ready'); renderAll();
      toast(`Carpeta «${h.name}» conectada.`, 'ok');
    } catch (err) { toast(`No se pudo conectar la carpeta: ${friendlyError(err)}.`, 'err'); }
  }
  async function reconnect() {
    const h = state.repo.handle; if (!h) return pickFolder();
    try {
      if (!(await hasPerm(h, true))) return setRepo('ask');
      const missing = await missingInFolder(h);
      if (missing.length) { state.repo.handle = null; setRepo('none'); return toast('La carpeta ya no tiene los archivos del portfolio. Vuelve a seleccionarla.', 'err'); }
      await loadFromFolder(); state.repo.warn = await servedWarning(); setRepo('ready'); renderAll(); toast('Carpeta reconectada.', 'ok');
    } catch (err) { setRepo('error', `No se pudo reconectar: ${friendlyError(err)}.`); }
  }

  /* Publicación directa. Orden y garantías:
       0) se guarda lo pendiente en IndexedDB y se relee el catálogo REAL de la carpeta
       1) archivos nuevos: se escriben, se releen y se comparan byte a byte; la marca `written` se guarda en
          IndexedDB al instante (si la página se recarga a medias, el siguiente intento continúa donde se quedó
          y no duplica archivos)
       2) se comprueba que todo lo que referencia el catálogo existe en disco
       3) projects.json se escribe AL FINAL, se relee y se valida
       4) se comprueba por HTTP que la web servida ve lo mismo
     Solo entonces se muestra el mensaje de éxito. Cualquier fallo anterior deja projects.json intacto. */
  async function publishLocal() {
    const r = state.repo;
    if (r.status === 'saving') return;
    if (!r.handle) return toast('Selecciona primero la carpeta del portfolio.', 'err');
    await flushSaves();
    const pre = buildManifest();
    if (pre.problems.length) {
      openDialog(`<h2>No se puede publicar todavía</h2><div class="issues"><b>Corrige estos proyectos publicados (o pásalos a borrador):</b><ul>${pre.problems.map((x) => `<li><b>${esc(x.p.name)}</b>: ${esc(x.issues.join('; '))}</li>`).join('')}</ul></div><div class="dlg-foot"><button class="btn" data-close type="button">Cerrar</button></div>`);
      return;
    }
    setRepo('saving'); r.warn = ''; r.verified = false;
    const guardId = ++guardSeq; reloadGuard.busy = true; reloadGuard.deferred = 0;
    let stage = 'permisos', jsonTouched = false; let written = 0, reused = 0; let cancelled = false;
    let m = null, http = null;
    try {
      if (!(await hasPerm(r.handle, true))) throw Object.assign(new Error('permiso denegado'), { name: 'NotAllowedError' });
      if ((await missingInFolder(r.handle)).length) throw Object.assign(new Error('La carpeta ya no contiene el portfolio'), { name: 'NotFoundError' });
      const root = r.handle;

      // 0) catálogo real de la carpeta: nunca se sobrescribe a ciegas
      stage = 'lectura del projects.json actual';
      const diskText = await readTextAt(root, CONFIG.manifestPath);
      let diskList = [];
      if (diskText !== null && diskText.trim()) {
        let data; try { data = JSON.parse(diskText); } catch { throw new Error('el projects.json actual de la carpeta no es JSON válido y no se sobrescribe para no perder datos (corrígelo o renómbralo y vuelve a intentarlo)'); }
        diskList = Array.isArray(data) ? data : (data && data.projects);
        if (!Array.isArray(diskList)) throw new Error('el projects.json actual tiene un formato desconocido y no se sobrescribe');
      }
      state.lastPublishedJson = diskText;
      const newOnes = await importManifest(diskText && diskText.trim() ? diskText : null);   // proyectos del catálogo que este administrador desconoce
      if (newOnes) { normalizeOrders(); throw new Error(`el catálogo de la carpeta contenía ${plural(newOnes, 'proyecto', 'proyectos')} que este administrador no tenía; se han importado como publicados. Revisa la lista y vuelve a pulsar «Guardar y publicar en local»`); }
      m = buildManifest();
      if (!m.entries.length && diskList.length) {
        const ok = await confirmDialog(`<h2>Vas a dejar la web sin proyectos</h2><p>El catálogo actual de la carpeta tiene <b>${plural(diskList.length, 'proyecto', 'proyectos')}</b> y el nuevo estaría <b>vacío</b>. Los archivos no se borran, pero la web dejaría de mostrarlos.</p><p class="hint">Si no era lo que querías, cancela y revisa qué proyectos están marcados como «Publicado».</p>`, 'Sí, dejar el catálogo vacío');
        if (!ok) { cancelled = true; throw Object.assign(new Error('cancelado'), { name: 'Cancelled' }); }
      }

      // 1) archivos nuevos
      for (const p of state.projects.filter((x) => x.status === 'published')) {
        for (const f of p.files) {
          if (!f.blob) continue;
          stage = `archivo «${f.fileName}»`;
          let rel = CONFIG.filesDir + (f.path || `${p.dir}/${f.fileName}`);
          let ex = await statFile(root, rel);
          let same = ex ? await sameBytes(ex, f.blob) : false;
          if (ex && !same && !f.written) {                       // archivo ajeno con el mismo nombre: nunca se sobrescribe
            const base = f.fileName; let k = 2, name = base;
            while (ex && !same) { name = withSuffix(base, k++); rel = `${CONFIG.filesDir}${p.dir}/${name}`; ex = await statFile(root, rel); same = ex ? await sameBytes(ex, f.blob) : false; }
            f.fileName = name; f.path = `${p.dir}/${name}`;
          }
          if (same) {                                            // ya está en disco y es idéntico (p. ej. reintento tras una recarga)
            if (!f.written) { f.written = true; await persist(p); }
            reused++; continue;
          }
          await writeFileAt(root, rel, f.blob);
          const chk = await statFile(root, rel);
          if (!chk || !(await sameBytes(chk, f.blob))) throw new Error(`no se pudo verificar «${f.fileName}» tras escribirlo`);
          f.written = true; await persist(p); written++;       // marca durable al instante
        }
      }

      // 2) todo lo que referencia el catálogo existe en disco
      stage = 'comprobación de las referencias del catálogo';
      m = buildManifest();
      const missingRefs = [];
      for (const rel of refPaths(m.entries)) { const x = await statFile(root, CONFIG.filesDir + rel); if (!x || !x.size) missingRefs.push(rel); }
      if (missingRefs.length) throw new Error(`el catálogo apuntaría a archivos que no existen en la carpeta (${missingRefs.slice(0, 4).join(', ')}${missingRefs.length > 4 ? '…' : ''}); projects.json no se ha tocado`);

      // 3) catálogo al final
      stage = 'projects.json';
      JSON.parse(m.json);
      if (diskText !== null) db.setMeta('prevManifest', diskText).catch(() => {});   // copia del catálogo anterior (en el navegador)
      jsonTouched = true;
      await writeFileAt(root, CONFIG.manifestPath, m.json);
      const back = await readTextAt(root, CONFIG.manifestPath);
      if (back !== m.json) throw new Error('projects.json no coincide con lo esperado tras escribirlo');
      const backIds = JSON.parse(back).projects.map((e) => e.id);
      const wantIds = state.projects.filter((p) => p.status === 'published' && m.entries.some((e) => e.id === p.id)).map((p) => p.id);
      if (backIds.length !== wantIds.length || backIds.some((id) => !wantIds.includes(id))) throw new Error('los proyectos de projects.json no coinciden con los marcados como «Publicado»');
      state.lastPublishedJson = back; r.savedAt = Date.now();

      // 4) comprobación por HTTP
      stage = 'comprobación por HTTP';
      http = await checkServed(m);
      r.status = 'ready'; r.msg = '';
      r.verified = http.state === 'ok';
      const counts = `${plural(m.entries.length, 'proyecto', 'proyectos')} en el catálogo, ${plural(written, 'archivo nuevo', 'archivos nuevos')}${reused ? ` (${reused} ya estaban)` : ''}`;
      if (http.state === 'ok') toast(`Publicado y verificado (disco y servidor): ${counts}.`, 'ok');
      else if (http.state === 'mismatch') { r.warn = `Se guardó en la carpeta «${root.name}» y se verificó en disco, pero el servidor desde el que abres esta página NO lo ve: ${http.detail}. Lo más probable es que la carpeta seleccionada no sea la que tienes abierta en VS Code / Live Server. Pulsa «Cambiar carpeta» y elige la correcta.`; toast(r.warn, 'err'); }
      else toast(`Guardado en la carpeta y verificado en disco: ${counts}. No se pudo comprobar por HTTP: ${http.detail}.`, 'ok');
    } catch (err) {
      if (cancelled) { r.status = 'ready'; r.msg = ''; }
      else {
        r.status = 'error';
        r.msg = `La publicación NO se ha completado (paso: ${stage}). ${cap(friendlyError(err))}. ` + (jsonTouched ? 'No se pudo confirmar projects.json: pulsa «Reintentar» (los archivos ya guardados no se duplican).' : 'projects.json no se ha modificado' + (written || reused ? '; los archivos ya guardados se conservan y no se duplicarán al reintentar.' : '.'));
        toast(r.msg, 'err');
      }
    } finally {
      renderAll();
      // Margen de gracia: Live Server avisa unos instantes DESPUÉS de cada cambio en disco; se absorbe la última recarga
      // para que el resultado de la publicación no desaparezca de la pantalla.
      setTimeout(() => {
        if (guardId !== guardSeq) return;
        reloadGuard.busy = false;
        if (reloadGuard.deferred) { reloadGuard.deferred = 0; toast('Live Server intentó recargar esta página mientras se guardaba; se ha evitado para no interrumpir la publicación.'); }
      }, 2500);
    }
  }

  async function removeProjectFiles(p) {
    const root = state.repo.handle; let n = 0;
    for (const f of p.files) {
      if (!f.written || !f.path) continue;
      try { const parts = checkRel(CONFIG.filesDir + f.path).slice(); const name = parts.pop(); await (await dirAt(root, parts, false)).removeEntry(name); n++; } catch { /* ya no existe */ }
    }
    try { const parts = checkRel(CONFIG.filesDir + p.dir).slice(); const name = parts.pop(); await (await dirAt(root, parts, false)).removeEntry(name); } catch { /* no vacía o inexistente: se deja */ }
    return n;
  }
  async function fetchRepoBlob(f) {
    try {
      if (state.repo.handle && state.repo.status === 'ready') { const x = await statFile(state.repo.handle, CONFIG.filesDir + f.path); if (x) return new Blob([await x.arrayBuffer()], { type: x.type }); }
    } catch { /* se prueba por HTTP */ }
    try { const res = await fetch(repoUrl(f.path)); if (res.ok) return await res.blob(); } catch { /* sin acceso */ }
    return null;
  }

  /* ---------- Copia de seguridad ---------- */
  function openBackup() {
    const withBlobs = state.projects.reduce((n, p) => n + p.files.filter((f) => f.blob).length, 0);
    openDialog(`
      <h2>Copia de seguridad</h2>
      <p>Los proyectos y archivos del administrador solo existen en <b>este navegador</b> (IndexedDB). Si borras los datos del sitio, cambias de navegador o de puerto de Live Server, se pierden. Guarda copias con frecuencia.</p>
      <div class="stats">
        <div class="stat"><b>${state.projects.length}</b>proyectos</div>
        <div class="stat"><b>${withBlobs}</b>archivos locales</div>
        <div class="stat"><b>${esc(state.lastBackup ? new Date(state.lastBackup).toLocaleDateString('es-ES') : '—')}</b>última copia</div>
      </div>
      <div class="dlg-actions">
        <button class="btn btn-primary" data-b="save" type="button">Descargar copia (ZIP)</button>
        <button class="btn" data-b="restore" type="button">Restaurar desde copia…</button>
        <input type="file" id="restoreInput" accept=".zip" hidden>
      </div>
      <p class="hint">Restaurar <b>fusiona</b> la copia con lo que ya tienes: los proyectos con el mismo identificador se sustituyen por los de la copia; los demás se conservan.</p>
      <div class="dlg-foot"><button class="btn" data-close type="button">Cerrar</button></div>`);
    $('#restoreInput').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await restoreBackup(f); };
    $('#dlg .dlg').onclick = async (e) => {
      const b = e.target.closest('[data-b]'); if (!b) return;
      if (b.dataset.b === 'restore') $('#restoreInput').click();
      else { b.disabled = true; await saveBackup(); b.disabled = false; }
    };
  }
  async function saveBackup() {
    try {
      const entries = []; const meta = [];
      for (const p of state.projects) {
        const q = { ...p, files: p.files.map((f) => {
          const { blob, ...rest } = f;
          if (blob) { const bp = `files/${p.id}/${f.id}-${safeName(f.fileName)}`; entries.push({ name: bp, data: blob }); return { ...rest, blobPath: bp }; }
          return rest;
        }) };
        meta.push(q);
      }
      entries.unshift({ name: 'backup.json', data: JSON.stringify({ version: 1, created: new Date().toISOString(), projects: meta }, null, 2) });
      saveBlob(await zipBuild(entries), `portfolio-admin-backup-${todayISO()}.zip`);
      state.lastBackup = Date.now(); db.setMeta('lastBackup', state.lastBackup).catch(() => {});
      renderBanners();
      toast('Copia de seguridad descargada. Guárdala fuera del navegador.', 'ok');
    } catch (err) { toast(`No se pudo crear la copia: ${err.message}`, 'err'); }
  }
  async function restoreBackup(file) {
    let plan;
    try {
      const entries = await zipRead(file);
      const bj = entries.find((e) => e.name === 'backup.json');
      if (!bj) throw new Error('No parece una copia de este administrador (falta backup.json).');
      let data; try { data = JSON.parse(await bj.blob.text()); } catch { throw new Error('backup.json está dañado.'); }
      if (!data || data.version !== 1 || !Array.isArray(data.projects)) throw new Error('backup.json no tiene un formato válido.');
      const byName = new Map(entries.map((e) => [e.name, e.blob]));
      const items = []; let lost = 0;
      for (const q of data.projects) {
        if (!q || typeof q.id !== 'string' || typeof q.name !== 'string' || !Array.isArray(q.files)) throw new Error('La copia contiene proyectos con formato no válido.');
        const files = [];
        for (const f of q.files) {
          if (!f || typeof f.fileName !== 'string') throw new Error('La copia contiene archivos con formato no válido.');
          const { blobPath, ...rest } = f;
          if (blobPath) { const b = byName.get(blobPath); if (!b) { lost++; continue; } files.push({ ...rest, blob: b }); }
          else files.push({ ...rest, blob: null });
        }
        items.push({ ...newProject(), ...q, tags: Array.isArray(q.tags) ? q.tags : [], links: Array.isArray(q.links) ? q.links : [], files });
      }
      plan = { items, lost };
    } catch (err) {
      openDialog(`<h2>No se pudo restaurar</h2><div class="issues">${esc(err.message)}</div><p class="hint">No se ha cambiado nada.</p><div class="dlg-foot"><button class="btn" data-close type="button">Cerrar</button></div>`);
      return;
    }

    const replace = plan.items.filter((p) => state.projects.some((x) => x.id === p.id));
    openDialog(`<h2>Restaurar copia de seguridad</h2>
      <p>La copia contiene <b>${plural(plan.items.length, 'proyecto', 'proyectos')}</b>.</p>
      ${replace.length ? `<div class="issues"><b>Se sustituirán ${plural(replace.length, 'proyecto actual', 'proyectos actuales')} por la versión de la copia:</b><ul>${replace.slice(0, 8).map((p) => `<li>${esc(p.name)}</li>`).join('')}${replace.length > 8 ? `<li>…y ${replace.length - 8} más</li>` : ''}</ul>Los cambios actuales de esos proyectos se perderán.</div>` : '<p>No sustituye ningún proyecto actual: solo se añadirán.</p>'}
      ${plan.lost ? `<div class="issues">La copia está incompleta: faltan ${plural(plan.lost, 'archivo', 'archivos')}; se restaurará el resto.</div>` : ''}
      <p class="hint">Los proyectos que no estén en la copia se conservan.</p>
      <div class="dlg-foot"><button class="btn" data-close type="button">Cancelar</button><button class="btn btn-primary" id="doRestore" type="button">Restaurar</button></div>`);
    $('#doRestore').onclick = async () => {
      try {
        for (const p of plan.items) {
          const i = state.projects.findIndex((x) => x.id === p.id);
          if (i >= 0) { state.projects[i].files.forEach((f) => dropUrl(f.id)); state.projects[i] = p; } else state.projects.push(p);
          state.tombstones = state.tombstones.filter((id) => id !== p.id);
          if (state.persistent) await db.put(p);
        }
        db.setMeta('tombstones', state.tombstones).catch(() => {});
        normalizeOrders(); closeDialog(); state.selectedId = state.selectedId && current() ? state.selectedId : (plan.items[0]?.id || null); renderAll();
        toast(`${plural(plan.items.length, 'proyecto restaurado', 'proyectos restaurados')}.`, 'ok');
      } catch (err) { toast(`No se pudo restaurar: ${friendlyError(err)}.`, 'err'); }
    };
  }

  /* ---------- Render: banners y lista ---------- */
  function renderBanners() {
    const box = $('#banners'); const parts = [];
    if (state.repo.warn) parts.push(`<div class="banner is-warn"><span>${esc(state.repo.warn)}</span></div>`);
    if (state.manifestNote) parts.push(`<div class="banner is-warn">${esc(state.manifestNote)}</div>`);
    if (!state.persistent) parts.push('<div class="banner is-warn"><span><b>Almacenamiento no disponible.</b> El navegador no permite guardar datos (¿modo privado?). Lo que hagas se perderá al recargar: exporta o haz copia antes de cerrar.</span></div>');
    const hasLocal = state.projects.some((p) => p.status === 'draft' || p.files.some((f) => f.blob));
    const old = !state.lastBackup || (Date.now() - state.lastBackup) > CONFIG.backupWarnDays * 86400000;
    if (hasLocal && old) parts.push(`<div class="banner"><span>${state.lastBackup ? 'Hace más de una semana que no haces una copia de seguridad.' : 'Aún no has hecho ninguna copia de seguridad.'} Tus borradores solo existen en este navegador.</span><button class="btn btn-sm" id="bnBackup" type="button">Hacer copia ahora</button></div>`);
    box.innerHTML = parts.join('');
    $('#bnBackup')?.addEventListener('click', openBackup);
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    const list = state.projects.filter((p) => (state.filter === 'all' || p.status === state.filter)
      && (!q || [p.name, p.description, p.category, ...p.tags].join(' ').toLowerCase().includes(q)));
    if (state.filter === 'published') { const ord = new Map(pubSorted().map((p, i) => [p.id, i])); return list.sort((a, b) => ord.get(a.id) - ord.get(b.id)); }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  function renderList() {
    const list = filtered();
    const pub = state.projects.filter((p) => p.status === 'published').length;
    const canMove = state.filter === 'published' && !state.query.trim();
    $('#count').textContent = `${plural(state.projects.length, 'proyecto', 'proyectos')} · ${plural(pub, 'publicado', 'publicados')}${canMove ? ' · orden de la web' : ''}`;
    $('#list').innerHTML = list.length ? list.map((p, i) => `
      <li class="${p.id === state.selectedId ? 'is-sel' : ''}" data-id="${esc(p.id)}">
        ${canMove ? `<span class="mv"><button type="button" data-mv="-1" aria-label="Subir ${esc(p.name)}" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-mv="1" aria-label="Bajar ${esc(p.name)}" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></span>` : ''}
        <button class="pick" type="button" data-pick>
          <span class="pname">${esc(p.name || 'Sin nombre')}</span>
          <span class="pmeta"><span class="badge ${p.status === 'published' ? 'pub' : 'draft'}">${p.status === 'published' ? 'Publicado' : 'Borrador'}</span> ${esc(p.category || 'Sin categoría')}</span>
        </button>
        <label class="pubwrap" title="Publicar en la web"><input type="checkbox" data-pub ${p.status === 'published' ? 'checked' : ''} aria-label="Publicar ${esc(p.name)}"></label>
      </li>`).join('') : '<li class="plist-empty">No hay proyectos que coincidan.</li>';
  }
  function moveProject(id, delta) {
    const l = pubSorted(); const i = l.findIndex((p) => p.id === id); const j = i + delta;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    l.forEach((p, k) => { p.order = k; persist(p).catch(() => {}); });
    renderList(); renderRepoStatus();
  }

  /* ---------- Render: editor ---------- */
  function renderEditor() {
    const p = current(); const box = $('#editor');
    if (!p) {
      box.innerHTML = `<div class="empty"><h2>${state.projects.length ? 'Selecciona un proyecto' : 'Aún no hay proyectos'}</h2><p>${state.projects.length ? 'Elige uno de la lista o crea uno nuevo.' : 'Pulsa «+ Nuevo proyecto» para empezar.'}</p></div>`;
      return;
    }
    const cats = [...new Set(state.projects.map((x) => x.category).filter(Boolean))];
    box.innerHTML = `
      <div class="ed-head">
        <div><h2>Editar proyecto</h2><span class="savestate" id="savestate"></span></div>
        <label class="switch ${p.status === 'published' ? 'is-on' : ''}" id="swWrap"><input type="checkbox" id="fPub" ${p.status === 'published' ? 'checked' : ''}> <span id="swText">${p.status === 'published' ? 'Publicado' : 'Borrador'}</span></label>
      </div>
      <div class="field"><label for="fName">Título</label><input class="input" id="fName" maxlength="120" value="${esc(p.name)}"></div>
      <div class="field"><label for="fDesc">Descripción</label><textarea class="input" id="fDesc" maxlength="400" rows="4" placeholder="¿De qué trata este trabajo?">${esc(p.description)}</textarea><span class="hint">Máx. 400 caracteres (es lo que muestra la web).</span></div>
      <div class="grid2">
        <div class="field"><label for="fCat">Categoría</label><input class="input" id="fCat" list="catList" maxlength="40" value="${esc(p.category)}" placeholder="Redes, Sistemas, Docker…"><datalist id="catList">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="field"><label for="fDate">Fecha</label><input class="input" id="fDate" type="date" value="${esc(p.date)}"></div>
      </div>
      <div class="field"><label for="fTags">Etiquetas</label><input class="input" id="fTags" value="${esc(p.tags.join(', '))}" placeholder="VLAN, Packet Tracer, CCNA"><span class="hint">Separadas por comas (máx. ${CONFIG.maxTags}).</span></div>

      <div class="section">
        <h3>Archivos e imágenes</h3>
        <div class="drop" id="drop"><div><b>Arrastra archivos aquí</b><div class="hint">PDF, imágenes, documentos, código, Packet Tracer… · Máx. ${CONFIG.maxFileMB} MB por archivo. El primero es el archivo principal de la tarjeta.</div></div><button class="btn" id="btnPick" type="button">Seleccionar archivos</button><input type="file" id="fileInput" multiple hidden></div>
        <div class="coverprev" id="coverprev"></div>
        <ul class="flist" id="flist"></ul>
      </div>

      <div class="section">
        <h3>Enlaces</h3>
        <div id="llist"></div>
        <button class="btn btn-sm" id="btnAddLink" type="button">+ Añadir enlace</button>
      </div>

      <div class="sticky-actions">
        <span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="btnDup" type="button">Duplicar proyecto</button><button class="btn btn-danger" id="btnDelete" type="button">Eliminar proyecto</button></span>
        <span class="hint">Carpeta en el repo: <code>${esc(CONFIG.filesDir + p.dir)}/</code></span>
      </div>`;
    renderFiles(); renderLinks();
    setSaveState(state.persistent ? BROWSER_SAVED : 'Sin almacenamiento persistente');
  }

  function renderFiles() {
    const p = current(); const ul = $('#flist'); if (!p || !ul) return;
    ul.innerHTML = p.files.length ? p.files.map((f, i) => {
      const img = isImage(f.fileName);
      const th = img ? `<button class="thumbbtn ${f.cover ? 'is-cover' : ''}" type="button" data-a="preview" aria-label="Vista previa de ${esc(f.fileName)}"><img src="${esc(fileUrl(f))}" alt=""></button>` : `<div class="thumb">${esc((getExt(f.fileName) || 'FILE').slice(0, 5).toUpperCase())}</div>`;
      const where = f.blob ? (f.written ? '<span class="badge repo">Guardado en la carpeta</span>' : '<span class="badge new">Pendiente de guardar</span>') : '<span class="badge repo">Ya en el repo</span>';
      return `<li data-fid="${esc(f.id)}">${th}
        <div><div class="fname">${esc(f.fileName)}</div>
          <div class="fmeta">${esc(fmtSize(f.size))} ${where} ${i === 0 ? '<span class="badge pub">Principal</span>' : ''} ${f.cover ? '<span class="badge new">Portada</span>' : ''}</div></div>
        <div class="factions">
          ${img ? `<button class="btn btn-sm ${f.cover ? 'is-on' : ''}" data-a="cover" type="button">${f.cover ? 'Quitar portada' : 'Usar de portada'}</button>` : ''}
          ${i > 0 ? '<button class="btn btn-sm" data-a="primary" type="button">Hacer principal</button>' : ''}
          <a class="btn btn-sm" href="${esc(fileUrl(f))}" target="_blank" rel="noopener">Abrir</a>
          <button class="btn btn-sm btn-danger" data-a="remove" type="button">Quitar</button>
        </div></li>`;
    }).join('') : '<li style="display:block;border:0;color:var(--mute);font-size:14px">Todavía no hay archivos.</li>';
    const cv = p.files.find((f) => f.cover);
    const cp = $('#coverprev');
    if (cp) cp.innerHTML = cv ? `<img src="${esc(fileUrl(cv))}" alt="Portada"><span>Así se verá la portada en la tarjeta de la web.</span>` : (p.files.some((f) => isImage(f.fileName)) ? '<span>Elige una imagen como portada con «Usar de portada».</span>' : '');
    renderRepoStatus();
  }
  function openImagePreview(p, f) {
    openDialog(`<h2>${esc(f.fileName)}</h2><img class="bigimg" src="${esc(fileUrl(f))}" alt="${esc(f.fileName)}"><p class="hint" id="imgMsg">${esc(fmtSize(f.size))}</p>
      <div class="dlg-foot"><button class="btn ${f.cover ? 'is-on' : ''}" id="imgCover" type="button">${f.cover ? 'Quitar portada' : 'Usar de portada'}</button><button class="btn" data-close type="button">Cerrar</button></div>`);
    $('#dlg .bigimg').addEventListener('error', () => { $('#imgMsg').textContent = 'No se puede mostrar esta imagen: el archivo puede estar dañado o no ser una imagen válida.'; $('#dlg .bigimg').hidden = true; });
    $('#imgCover').onclick = async () => { const on = !f.cover; p.files.forEach((x) => { x.cover = false; }); f.cover = on; await saveNow(p); renderFiles(); closeDialog(); };
  }
  function renderLinks() {
    const p = current(); const box = $('#llist'); if (!p || !box) return;
    box.innerHTML = p.links.map((l, i) => `
      <div class="lrow" data-i="${i}">
        <input class="input" data-l="label" placeholder="Texto (p. ej. Repositorio)" maxlength="60" value="${esc(l.label)}" aria-label="Texto del enlace">
        <input class="input ${l.url && !/^https?:\/\//i.test(l.url.trim()) ? 'is-bad' : ''}" data-l="url" placeholder="https://…" value="${esc(l.url)}" aria-label="URL del enlace">
        <button class="btn btn-sm btn-danger" data-a="rmlink" type="button">Quitar</button>
      </div>`).join('') || '<p class="hint" style="margin-bottom:8px">Sin enlaces.</p>';
  }

  function renderAll() { renderBanners(); renderList(); renderEditor(); renderRepoStatus(); }

  /* ---------- Acciones ---------- */
  function select(id) { state.selectedId = id; renderList(); renderEditor(); }
  function createProject() {
    const p = newProject(); p.dir = uniqueDir(p.name);
    state.projects.unshift(p); state.selectedId = p.id;
    state.filter = 'all'; state.query = ''; $('#search').value = '';
    document.querySelectorAll('#filters button').forEach((b) => b.classList.toggle('is-on', b.dataset.filter === 'all'));
    saveNow(p); renderAll();
    const n = $('#fName'); n.focus(); n.select();
  }
  function setStatus(p, published) {
    p.status = published ? 'published' : 'draft';
    if (published) p.order = -1;
    normalizeOrders();
    p.updatedAt = Date.now(); saveNow(p); renderList();
    if (p.id === state.selectedId) {
      $('#fPub').checked = published; $('#swWrap').classList.toggle('is-on', published); $('#swText').textContent = published ? 'Publicado' : 'Borrador';
    }
    if (!published) toast(`«${p.name}» saldrá de la web al pulsar «Guardar y publicar en local». Sus archivos siguen en tu carpeta: no se borran.`);
    if (published) { const issues = validateProject(p); if (issues.length) toast(`Aviso: «${p.name}» ${issues[0]}.`, 'err'); }
  }

  async function addFiles(fileList) {
    const p = current(); if (!p) return;
    const added = []; const errors = [];
    // Mientras el proyecto no tenga archivos, la carpeta sigue al título actual
    if (!p.files.length && !p.imported) p.dir = uniqueDir(p.name, p.id);
    const used = new Set(p.files.map((f) => f.path || `${p.dir}/${f.fileName}`));
    for (const file of [...fileList]) {
      const ext = getExt(file.name);
      if (BLOCKED.has(ext)) { errors.push(`${file.name}: tipo no permitido por seguridad.`); continue; }
      if (!file.size) { errors.push(`${file.name}: está vacío.`); continue; }
      if (file.size > CONFIG.maxFileMB * 1048576) { errors.push(`${file.name}: supera ${CONFIG.maxFileMB} MB (${fmtSize(file.size)}).`); continue; }
      if (p.files.some((f) => f.fileName === file.name && f.size === file.size)) { errors.push(`${file.name}: ya está añadido.`); continue; }
      let name = safeName(file.name), n = 2; const base = name;
      while (used.has(`${p.dir}/${name}`)) name = withSuffix(base, n++);
      const path = `${p.dir}/${name}`; used.add(path);
      const f = { id: uid(), fileName: name, path, size: file.size, mime: file.type || '', blob: file, cover: false, label: '', written: false };
      p.files.push(f); added.push(f);
    }
    if (added.length) {
      if (!p.files.some((f) => f.cover)) { const img = added.find((f) => isImage(f.fileName)); if (img && p.files.length > 1) img.cover = true; }
      await saveNow(p); renderFiles(); renderList();
      toast(plural(added.length, 'archivo añadido', 'archivos añadidos') + '.', 'ok');
      try { navigator.storage?.persist?.(); } catch { /* opcional */ }
    }
    if (errors.length) toast(errors.slice(0, 4).join('\n') + (errors.length > 4 ? `\n…y ${errors.length - 4} más.` : ''), 'err');
  }

  function confirmDelete(p) {
    const diskFiles = state.repo.status === 'ready' ? p.files.filter((f) => f.written).length : 0;
    openDialog(`<h2>Eliminar «${esc(p.name)}»</h2><p>Se borrará de este navegador${p.status === 'published' || p.imported ? ' y saldrá del catálogo público la próxima vez que pulses «Guardar y publicar en local»' : ''}. <b>Sus archivos del disco no se borran automáticamente.</b> Esta acción no se puede deshacer (salvo desde una copia de seguridad).</p>
      ${diskFiles ? `<label class="checkrow"><input type="checkbox" id="delDisk"> <span>Borrar también del disco los ${plural(diskFiles, 'archivo', 'archivos')} que guardó este administrador en <code>${esc(CONFIG.filesDir + p.dir)}/</code> (no se toca nada más).</span></label>` : ''}
      <div class="dlg-foot"><button class="btn" data-close type="button">Cancelar</button><button class="btn btn-primary" id="doDel" type="button" style="background:var(--err);border-color:var(--err)">Eliminar</button></div>`);
    $('#doDel').onclick = async () => {
      let removed = 0;
      if ($('#delDisk')?.checked) { try { removed = await removeProjectFiles(p); } catch (err) { toast(`No se pudieron borrar los archivos del disco: ${friendlyError(err)}.`, 'err'); } }
      try { if (state.persistent) await db.del(p.id); } catch { toast('No se pudo eliminar.', 'err'); return; }
      p.files.forEach((f) => dropUrl(f.id));
      state.projects = state.projects.filter((x) => x.id !== p.id);
      if (p.imported || p.status === 'published') { state.tombstones.push(p.id); db.setMeta('tombstones', state.tombstones).catch(() => {}); }
      state.selectedId = null; normalizeOrders(); closeDialog(); renderAll();
      toast(removed ? `Proyecto eliminado y ${plural(removed, 'archivo borrado', 'archivos borrados')} del disco.` : 'Proyecto eliminado (sus archivos del disco se conservan).');
    };
  }

  async function duplicateProject(src) {
    const c = newProject();
    Object.assign(c, { name: `${src.name} (copia)`, description: src.description, category: src.category, tags: [...src.tags], links: src.links.map((l) => ({ ...l })) });
    c.dir = uniqueDir(c.name, c.id);
    const used = new Set(); let missing = 0;
    for (const f of src.files) {
      let blob = f.blob;
      if (!blob) blob = await fetchRepoBlob(f);
      if (!blob) { missing++; continue; }
      let name = safeName(f.fileName), n = 2; const base = name;
      while (used.has(name)) name = withSuffix(base, n++);
      used.add(name);
      c.files.push({ id: uid(), fileName: name, path: `${c.dir}/${name}`, size: blob.size, mime: f.mime || blob.type || '', blob, cover: f.cover, label: f.label || '', written: false });
    }
    state.projects.unshift(c); state.selectedId = c.id; state.filter = 'all'; state.query = ''; $('#search').value = '';
    document.querySelectorAll('#filters button').forEach((b) => b.classList.toggle('is-on', b.dataset.filter === 'all'));
    await saveNow(c); renderAll();
    toast(missing ? `Proyecto duplicado como borrador, pero ${plural(missing, 'archivo no se pudo copiar', 'archivos no se pudieron copiar')}.` : 'Proyecto duplicado como borrador, con carpeta y archivos propios.', missing ? 'err' : 'ok');
  }

  /* ---------- Eventos ---------- */
  $('#btnNew').onclick = createProject;
  $('#statusbar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'btnPickDir') pickFolder(); else if (b.id === 'btnReconnect') reconnect(); else if (b.id === 'btnPublishLocal') publishLocal(); else if (b.id === 'btnExportZip') exportClick();
  });
  const exportClick = async () => { await flushSaves(); openExport(); };
  $('#btnExport').onclick = exportClick;
  $('#btnBackup').onclick = async () => { await flushSaves(); openBackup(); };
  $('#search').oninput = (e) => { state.query = e.target.value; renderList(); };
  $('#filters').onclick = (e) => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    state.filter = b.dataset.filter;
    document.querySelectorAll('#filters button').forEach((x) => x.classList.toggle('is-on', x === b));
    renderList();
  };
  $('#list').onclick = (e) => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    if (e.target.closest('[data-pub]')) return;
    const mv = e.target.closest('[data-mv]');
    if (mv) return moveProject(li.dataset.id, Number(mv.dataset.mv));
    select(li.dataset.id);
  };
  $('#list').onchange = (e) => {
    const cb = e.target.closest('[data-pub]'); if (!cb) return;
    const p = state.projects.find((x) => x.id === cb.closest('li').dataset.id);
    if (p) setStatus(p, cb.checked);
  };

  const ed = $('#editor');
  ed.addEventListener('input', (e) => {
    const p = current(); if (!p) return;
    const t = e.target;
    if (t.id === 'fName') { p.name = t.value; renderListSoft(p); }
    else if (t.id === 'fDesc') p.description = t.value;
    else if (t.id === 'fCat') { p.category = t.value.trim(); renderListSoft(p); }
    else if (t.id === 'fDate') p.date = t.value;
    else if (t.id === 'fTags') { p.tags = [...new Set(t.value.split(',').map((s) => s.trim().slice(0, 30)).filter(Boolean))].slice(0, CONFIG.maxTags); }
    else if (t.dataset.l) {
      const i = Number(t.closest('.lrow').dataset.i);
      p.links[i][t.dataset.l] = t.value;
      if (t.dataset.l === 'url') t.classList.toggle('is-bad', !!t.value && !/^https?:\/\//i.test(t.value.trim()));
    } else return;
    scheduleSave(p);
  });
  function renderListSoft(p) {
    const li = $(`#list li[data-id="${CSS.escape(p.id)}"]`);
    if (li) { li.querySelector('.pname').textContent = p.name || 'Sin nombre'; }
  }
  ed.addEventListener('change', (e) => {
    const p = current(); if (!p) return;
    if (e.target.id === 'fPub') setStatus(p, e.target.checked);
    else if (e.target.id === 'fileInput') { addFiles(e.target.files); e.target.value = ''; }
    else if (e.target.id === 'fCat') renderList();
  });
  ed.addEventListener('click', async (e) => {
    const p = current(); if (!p) return;
    const t = e.target;
    if (t.id === 'btnPick') return $('#fileInput').click();
    if (t.id === 'btnAddLink') { p.links.push({ label: '', url: '' }); await saveNow(p); renderLinks(); $('#llist .lrow:last-child input')?.focus(); return; }
    if (t.id === 'btnDelete') return confirmDelete(p);
    if (t.id === 'btnDup') return duplicateProject(p);
    const a = t.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'rmlink') { p.links.splice(Number(a.closest('.lrow').dataset.i), 1); await saveNow(p); renderLinks(); return; }
    const f = p.files.find((x) => x.id === a.closest('li')?.dataset.fid); if (!f) return;
    if (a.dataset.a === 'preview') return openImagePreview(p, f);
    if (a.dataset.a === 'cover') { const on = !f.cover; p.files.forEach((x) => { x.cover = false; }); f.cover = on; }
    else if (a.dataset.a === 'primary') { p.files.splice(p.files.indexOf(f), 1); p.files.unshift(f); }
    else if (a.dataset.a === 'remove') { p.files.splice(p.files.indexOf(f), 1); dropUrl(f.id); }
    await saveNow(p); renderFiles();
  });
  ed.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('#flist')) {
      const d = document.createElement('div'); d.className = 'thumb is-broken'; d.textContent = '¿Rota?'; d.title = 'No se puede mostrar la imagen';
      e.target.closest('.thumbbtn')?.replaceWith(d);
    }
  }, true);
  ed.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); $('#drop')?.classList.add('is-over'); } });
  ed.addEventListener('dragleave', (e) => { if (!ed.contains(e.relatedTarget)) $('#drop')?.classList.remove('is-over'); });
  ed.addEventListener('drop', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    e.preventDefault(); $('#drop')?.classList.remove('is-over'); addFiles(e.dataTransfer.files);
  });
  // Evita que soltar un archivo fuera de la zona abra el archivo en la pestaña
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); const p = current(); if (p) saveNow(p); } });

  /* ---------- Inicio ---------- */
  async function init() {
    try {
      state.projects = (await db.all()).map((p) => ({ ...newProject(), ...p }));
      state.lastBackup = (await db.getMeta('lastBackup')) || null;
      state.tombstones = (await db.getMeta('tombstones')) || [];
      state.repo.handle = FSA ? ((await db.getMeta('repoHandle')) || null) : null;
    } catch { state.persistent = false; }
    let fromFolder = false;
    if (state.repo.handle) {
      try {
        if (await hasPerm(state.repo.handle, false) && !(await missingInFolder(state.repo.handle)).length) { await loadFromFolder(); state.repo.warn = await servedWarning(); state.repo.status = 'ready'; fromFolder = true; }
        else state.repo.status = 'ask';
      } catch { state.repo.status = 'ask'; }
    }
    if (!fromFolder) await importManifest();
    normalizeOrders();
    if (state.projects.length) state.selectedId = filtered()[0]?.id || null;
    renderAll();
  }
  init();

  // Expuesto solo para pruebas
  window.__admin = { zipBuild, zipRead, buildManifest, state, publishLocal, pickFolder };
})();
