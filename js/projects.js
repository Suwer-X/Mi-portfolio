/* =========================================================
   Portafolio · Xiang Su Liu — Sección «Proyectos» (SOLO LECTURA)
   Archivo: js/projects.js  (se carga ANTES de app.js)

   La web pública solo muestra los proyectos publicados en
   sources/projects/projects.json (+ archivos en sources/projects/).
   Ese JSON lo genera el administrador local (admin-local/admin.html),
   que NO forma parte de la web desplegada.
   Aquí no hay edición, borradores ni almacenamiento en el navegador.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Configuración ---------- */
  const CONFIG = {
    manifestUrl: './sources/projects/projects.json',
    // Copia GENERADA del catálogo (admin-local / tools/sync-catalog.cjs). Solo se usa abriendo la web con file://,
    // donde el navegador bloquea fetch(). Con servidor (Live Server, GitHub Pages) NO se carga: manda projects.json.
    dataScriptUrl: './sources/projects/projects.data.js',
    filesBase: './sources/projects/',
    textPreviewChars: 120000,
    toastMs: 4500,
  };

  /* ---------- Tipos de archivo admitidos ---------- */
  const KINDS = {
    image:   { label: 'Imagen',            tone: '#0ea5e9', preview: true,  ext: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg'] },
    pdf:     { label: 'PDF',               tone: '#0891b2', preview: true,  ext: ['pdf'] },
    video:   { label: 'Vídeo',             tone: '#1e40af', preview: true,  ext: ['mp4', 'webm', 'mov', 'm4v', 'ogv'] },
    audio:   { label: 'Audio',             tone: '#0e7490', preview: true,  ext: ['mp3', 'wav', 'ogg', 'm4a'] },
    text:    { label: 'Texto',             tone: '#475569', preview: true,  ext: ['txt', 'md', 'log', 'csv', 'tsv'] },
    code:    { label: 'Código',            tone: '#334155', preview: true,  ext: ['json', 'js', 'ts', 'py', 'html', 'css', 'sql', 'sh', 'ps1', 'yml', 'yaml', 'xml', 'ini', 'conf', 'php', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'tf', 'toml'] },
    doc:     { label: 'Documento',         tone: '#1d4ed8', preview: false, ext: ['doc', 'docx', 'odt', 'rtf'] },
    sheet:   { label: 'Hoja de cálculo',   tone: '#0d9488', preview: false, ext: ['xls', 'xlsx', 'ods'] },
    slides:  { label: 'Presentación',      tone: '#4f46e5', preview: false, ext: ['ppt', 'pptx', 'odp'] },
    network: { label: 'Red / Laboratorio', tone: '#0369a1', preview: false, ext: ['pkt', 'pka', 'drawio', 'vsdx', 'gns3project'] },
    archive: { label: 'Comprimido',        tone: '#64748b', preview: false, ext: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz'] },
    link:    { label: 'Enlace',            tone: '#0ea5e9', preview: false, ext: [] },
    other:   { label: 'Archivo',           tone: '#64748b', preview: false, ext: [] },
  };


  const EXT_KIND = {};
  Object.entries(KINDS).forEach(([kind, def]) => def.ext.forEach((e) => { EXT_KIND[e] = kind; }));

  /* ---------- Utilidades ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const getExt = (name) => {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  };

  function classify(name) {
    const ext = getExt(name);
    if (ext && EXT_KIND[ext]) return EXT_KIND[ext];
    const base = name.toLowerCase();
    if (['dockerfile', 'makefile', 'vagrantfile'].includes(base)) return 'code';
    if (['readme', 'license'].includes(base)) return 'text';
    return null;
  }

  function prettyName(fileName) {
    const ext = getExt(fileName);
    let base = ext ? fileName.slice(0, -(ext.length + 1)) : fileName;
    base = base.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : fileName;
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
  }

  const isoDate = (ts) => new Date(ts).toISOString().slice(0, 10);

  function safeName(name) {
    const ext = getExt(name);
    const base = ext ? name.slice(0, -(ext.length + 1)) : name;
    const clean = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'archivo';
    return ext ? `${clean}.${ext}` : clean;
  }

  function uniqueName(name, used) {
    if (!used.has(name)) return name;
    const ext = getExt(name);
    const base = ext ? name.slice(0, -(ext.length + 1)) : name;
    let n = 2;
    while (used.has(ext ? `${base}-${n}.${ext}` : `${base}-${n}`)) n++;
    return ext ? `${base}-${n}.${ext}` : `${base}-${n}`;
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const canInlinePdf = () => navigator.pdfViewerEnabled !== false;
  const isCoarse = () => window.matchMedia('(pointer: coarse)').matches;

  /* ---------- Iconos ---------- */
  const ic = (d) => `<svg class="pj-i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const I = {
    upload: ic('<path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"/>'),
    download: ic('<path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14"/>'),
    eye: ic('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    edit: ic('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    trash: ic('<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    close: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7"/></svg>',
    check: ic('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    alert: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'),
    info: ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>'),
    external: ic('<path d="M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    globe: ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>'),
    copy: ic('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>'),
    play: '<svg class="pj-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5Z" fill="currentColor"/></svg>',
    briefcase: ic('<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3 13h18"/>'),
    page: '<svg class="pj-ph-svg" viewBox="0 0 48 48" aria-hidden="true"><path d="M12 4h17l9 9v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M29 4v7a2 2 0 0 0 2 2h7"/></svg>',
  };

  /* ---------- Estado ---------- */
  const state = {
    published: [],        // elementos normalizados del manifiesto
    publishedError: null,
    loading: null,
  };
  let ui = null;          // referencias al DOM de la ventana montada
  let pendingReveal = null; // id de un proyecto que el asistente quiere mostrar cuando la ventana esté pintada

  /* ---------- Carga de datos ---------- */
  function normalizePublished(p, i) {
    if (!p || typeof p !== 'object') return null;
    if (p.published === false || p.status === 'draft') return null;   // nunca se muestra un borrador
    const bad = (s) => !s || s.includes('..') || s.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(s);
    const toUrl = (s) => CONFIG.filesBase + s.split('/').map(encodeURIComponent).join('/');

    const file = typeof p.file === 'string' ? p.file.trim() : '';
    const link = typeof p.link === 'string' && /^https?:\/\//i.test(p.link.trim()) ? p.link.trim() : '';
    if (file && bad(file)) return null;
    if (!file && !link) return null;

    const cover = typeof p.cover === 'string' && p.cover.trim() && !bad(p.cover.trim()) ? toUrl(p.cover.trim()) : '';
    const fileName = file ? file.split('/').pop() : '';
    const kind = file ? (classify(fileName) || 'other') : 'link';

    const category = typeof p.category === 'string' ? p.category.trim().slice(0, 40) : '';
    const tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 8) : [];
    const extraFiles = (Array.isArray(p.files) ? p.files : []).map((f) => {
      const path = f && typeof f.file === 'string' ? f.file.trim() : '';
      if (!path || bad(path)) return null;
      const fn = path.split('/').pop();
      return { name: String(f.name || prettyName(fn)).slice(0, 120), fileName: fn, url: toUrl(path), size: Number(f.size) || 0 };
    }).filter(Boolean).slice(0, 20);
    const extraLinks = (Array.isArray(p.links) ? p.links : []).map((l) => (
      l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url.trim())
        ? { label: String(l.label || 'Enlace').slice(0, 60), url: l.url.trim() } : null
    )).filter(Boolean).slice(0, 10);

    return {
      id: `pub-${i}`,
      category,
      tags,
      extraFiles,
      extraLinks,
      name: String(p.name || (fileName ? prettyName(fileName) : 'Proyecto')).slice(0, 120),
      description: String(p.description || '').slice(0, 400),
      fileName,
      kind,
      mime: '',
      size: Number(p.size) || 0,
      date: typeof p.date === 'string' ? p.date : '',
      url: file ? toUrl(file) : '',
      cover,
      link,
    };
  }

  const loadError = (kind, detail, cause) => Object.assign(new Error(detail), { kind, detail, cause });

  const isFileProtocol = () => location.protocol === 'file:';

  // file://: el catálogo llega como script (window.__PORTFOLIO_CATALOG__); un <script src> sí está permitido
  function loadFromScript() {
    const url = CONFIG.dataScriptUrl;
    return new Promise((resolve, reject) => {
      try { delete window.__PORTFOLIO_CATALOG__; } catch { window.__PORTFOLIO_CATALOG__ = undefined; }
      const el = document.createElement('script');
      el.src = `${url}?t=${Date.now()}`;
      el.onload = () => {
        el.remove();
        const data = window.__PORTFOLIO_CATALOG__;
        if (data === undefined) return reject(loadError('format', `${url} no define el catálogo (¿se ha editado a mano? vuelve a generarlo: «Guardar y publicar en local» o «node tools/sync-catalog.cjs»)`));
        resolve(data);
      };
      el.onerror = () => { el.remove(); reject(loadError('missing', `La web está abierta con file:// y no se encuentra ${url}. Se genera al publicar desde el administrador o con «node tools/sync-catalog.cjs»; o abre la web con Live Server`)); };
      document.head.append(el);
    });
  }

  async function loadPublished() {
    const url = CONFIG.manifestUrl;
    try {
      let data;
      if (isFileProtocol()) {
        data = await loadFromScript();
      } else {
        let res;
        try { res = await fetch(url, { cache: 'no-cache' }); }
        catch (netErr) { throw loadError('network', `No se pudo pedir ${url}`, netErr); }
        if (!res.ok) throw loadError('http', `${url} respondió HTTP ${res.status}${res.status === 404 ? ' (el archivo no existe: ¿se ha publicado ya el catálogo?)' : ''}`);
        try { data = await res.json(); } catch (jsonErr) { throw loadError('json', `${url} no es JSON válido (${jsonErr.message})`, jsonErr); }
      }
      const list = Array.isArray(data) ? data : data && data.projects;
      if (!Array.isArray(list)) throw loadError('format', `${isFileProtocol() ? CONFIG.dataScriptUrl : url} no tiene el formato esperado: { "projects": [ … ] }`);
      const items = list.map(normalizePublished);
      state.published = items.filter(Boolean);
      const skipped = items.length - state.published.length;
      if (skipped) console.warn(`[Proyectos] ${skipped} de ${items.length} entradas del catálogo se han ignorado (borrador o datos no válidos: sin archivo ni enlace, ruta con «..», etc.).`);
    } catch (err) {
      state.publishedError = err;
      console.error('[Proyectos] No se pudo cargar el catálogo →', err.detail || err.message, err.cause || '');
    }
  }

  function ensureLoaded() {
    if (!state.loading) state.loading = loadPublished();
    return state.loading;
  }

  const urlOf = (it) => it.url;
  const extLabel = (it) => (it.kind === 'link' ? 'WEB' : (getExt(it.fileName) || KINDS[it.kind].label).slice(0, 6).toUpperCase());

  /* ---------- API para otros módulos (asistente del gato) ----------
     Comparten el MISMO catálogo ya cargado y normalizado: no hay una segunda lista ni una segunda petición.
     Los borradores ya se han descartado en normalizePublished(). */
  const isLocalDebug = () => location.protocol === 'file:' || /^(localhost|127\.|\[?::1)/.test(location.hostname) || /[?&]debug=1\b/.test(location.search);

  async function getCatalog({ retry = false } = {}) {
    // Solo se vuelve a pedir si la carga anterior falló (así no cambian los ids de las tarjetas ya pintadas)
    if (retry && state.publishedError) { state.publishedError = null; state.loading = null; }
    const wasEmpty = !state.published.length;
    await ensureLoaded();
    if (retry && wasEmpty && !state.publishedError && ui?.pj?.isConnected) renderAll();
    const err = state.publishedError;
    return {
      items: state.published.map((it) => ({ ...it, tags: it.tags.slice(), extraFiles: it.extraFiles.slice(), extraLinks: it.extraLinks.slice() })),
      error: err ? { kind: err.kind || 'unknown', detail: isLocalDebug() ? (err.detail || err.message || '') : '' } : null,
    };
  }

  const canPreview = (id) => { const it = allItems().find((i) => i.id === id); return !!it && KINDS[it.kind].preview; };

  // Marca la tarjeta, la lleva a la vista y, si el archivo tiene vista previa, abre el visor existente
  function revealNow(id) {
    const el = cardEl(id);
    const it = allItems().find((i) => i.id === id);
    if (!el || !it) return false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    ui.grid.querySelectorAll('.pj-card.is-found').forEach((x) => x.classList.remove('is-found'));
    el.classList.add('is-found');
    setTimeout(() => el.classList.remove('is-found'), 2600);
    if (KINDS[it.kind].preview) openViewer(it);
    return true;
  }

  // Si la ventana de Proyectos ya está pintada actúa al momento; si no, lo hará renderAll() al terminar de montarla
  function reveal(id) {
    pendingReveal = id;
    if (ui?.pj?.isConnected && ui.grid.querySelector('.pj-card')) { pendingReveal = null; return revealNow(id); }
    return true;
  }

  /* ---------- Avisos (toasts) ---------- */
  let toastBox = null;
  function toast(message, type = 'info', ms = CONFIG.toastMs) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'pj-toasts';
      toastBox.setAttribute('aria-live', 'polite');
      document.body.append(toastBox);
    }
    while (toastBox.children.length >= 4) toastBox.firstElementChild.remove();

    const el = document.createElement('div');
    el.className = `pj-toast is-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${type === 'ok' ? I.check : type === 'error' ? I.alert : I.info}<span class="pj-toast-msg">${esc(message)}</span><button class="pj-toast-x" aria-label="Cerrar aviso">${I.close}</button>`;
    toastBox.append(el);

    const dismiss = () => {
      if (!el.isConnected) return;
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.pj-toast-x').addEventListener('click', dismiss);
    setTimeout(dismiss, ms);
  }

  /* ---------- Diálogo (visor / publicar) ---------- */
  let dialog = null;
  function openDialog({ title, label, content, className = '' }) {
    closeDialog();
    const prevFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'pj-viewer';
    overlay.innerHTML = `
      <div class="pj-viewer-win ${className}" role="dialog" aria-modal="true" aria-label="${esc(label || title)}" tabindex="-1">
        <div class="pj-viewer-bar">
          <span class="pj-viewer-title">${esc(title)}</span>
          <button class="tb-btn tb-close" data-dlg-close aria-label="Cerrar">${I.close}</button>
        </div>
        <div class="pj-viewer-main"></div>
      </div>`;
    const win = overlay.querySelector('.pj-viewer-win');
    overlay.querySelector('.pj-viewer-main').append(content);
    document.body.append(overlay);

    const close = () => {
      if (dialog?.overlay !== overlay) return;
      document.removeEventListener('keydown', onKey, true);
      dialog = null;
      overlay.classList.add('is-closing');
      setTimeout(() => overlay.remove(), 160);
      if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
    };

    // En fase de captura para que Escape cierre solo el diálogo y no la ventana de debajo
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Tab') {
        const f = [...win.querySelectorAll('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === win)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-dlg-close]').addEventListener('click', close);

    dialog = { overlay, close };
    win.focus({ preventScroll: true });
    return dialog;
  }
  const closeDialog = () => dialog?.close();

  /* ---------- Visor de archivos ---------- */
  function openViewer(item) {
    const url = urlOf(item);
    const stage = document.createElement('div');
    stage.className = `pj-stage is-${item.kind}`;

    switch (item.kind) {
      case 'image':
        stage.innerHTML = `<img src="${esc(url)}" alt="${esc(item.name)}">`;
        break;
      case 'pdf':
        stage.innerHTML = canInlinePdf()
          ? `<iframe class="pj-pdf" src="${esc(url)}#view=FitH" title="${esc(item.name)}"></iframe>`
          : `<div class="pj-fallback">${I.page}<p>Tu navegador no puede mostrar PDF dentro de la página.</p><a class="btn btn-primary btn-sm" href="${esc(url)}" target="_blank" rel="noopener">${I.external} Abrir en una pestaña nueva</a></div>`;
        break;
      case 'video':
        stage.innerHTML = `<video src="${esc(url)}" controls playsinline preload="metadata"></video>`;
        break;
      case 'audio':
        stage.innerHTML = `<div class="pj-audio">${I.page}<audio src="${esc(url)}" controls preload="metadata"></audio></div>`;
        break;
      case 'text':
      case 'code': {
        stage.innerHTML = '<pre class="pj-code">Cargando…</pre>';
        fillText(stage.querySelector('pre'), item);
        break;
      }
      default:
        stage.innerHTML = `<div class="pj-fallback">${I.page}<p>Este tipo de archivo (${esc(extLabel(item))}) no tiene vista previa en el navegador. Descárgalo para abrirlo.</p></div>`;
    }

    const foot = document.createElement('div');
    foot.className = 'pj-viewer-foot';
    const canTab = item.kind === 'pdf' || (item.kind === 'image' && getExt(item.fileName) !== 'svg');
    foot.innerHTML = `
      <div class="pj-foot-info">
        <strong>${esc(item.name)}</strong>
        <span>${esc([item.fileName, formatSize(item.size)].filter(Boolean).join(' · '))}</span>
        ${item.description ? `<span class="pj-foot-desc">${esc(item.description)}</span>` : ''}
      </div>
      <div class="pj-foot-actions">
        ${canTab ? `<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">${I.external} Pestaña nueva</a>` : ''}
        <a class="btn btn-primary btn-sm" href="${esc(url)}" download="${esc(item.fileName)}">${I.download} Descargar</a>
      </div>`;

    const wrap = document.createElement('div');
    wrap.className = 'pj-viewer-col';
    wrap.append(stage, foot);
    openDialog({ title: item.fileName, label: `Vista previa: ${item.name}`, content: wrap, className: item.kind === 'pdf' ? 'is-tall' : '' });
  }

  async function fillText(pre, item) {
    if (isFileProtocol()) { pre.textContent = 'La vista previa de texto no está disponible con la web abierta como archivo (file://): el navegador no permite leer archivos locales desde la página. Descarga el archivo o abre la web con Live Server.'; return; }
    try {
      let text;
      let truncated = false;
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(res.status);
      text = await res.text();
      if (text.length > CONFIG.textPreviewChars) { text = text.slice(0, CONFIG.textPreviewChars); truncated = true; }
      pre.textContent = text + (truncated ? '\n\n… (vista previa recortada; descarga el archivo para verlo completo)' : '');
    } catch {
      pre.textContent = 'No se pudo cargar la vista previa. Puedes descargar el archivo.';
    }
  }

  /* ---------- Tarjetas ---------- */
  function thumbHTML(item, url) {
    const k = KINDS[item.kind];
    const placeholder = `<div class="pj-ph">${I.page}<span class="pj-ph-ext">${esc(extLabel(item))}</span></div>`;
    let media = placeholder;

    if (item.cover) media = `<img src="${esc(item.cover)}" alt="" loading="lazy" decoding="async">`;
    else if (item.kind === 'image') media = `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">`;
    else if (item.kind === 'pdf' && canInlinePdf() && !isCoarse()) media = `<iframe src="${esc(url)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>`;
    else if (item.kind === 'video') media = `<video src="${esc(url)}#t=0.6" preload="metadata" muted playsinline tabindex="-1" aria-hidden="true"></video><span class="pj-play">${I.play}</span>`;
    else if (item.kind === 'text' || item.kind === 'code') media = `${placeholder}<pre class="pj-snippet" data-snippet hidden></pre>`;

    const hit = k.preview ? `<button class="pj-thumb-hit" data-action="open" aria-label="Abrir vista previa de ${esc(item.name)}"></button>` : '';
    return `<div class="pj-thumb">${media}<span class="pj-kind">${esc(k.label)}</span>${hit}</div>`;
  }

  function viewBodyHTML(item, url) {
    const k = KINDS[item.kind];
    const meta = [item.fileName, formatSize(item.size), fmtDate(item.date)].filter(Boolean);

    const open = k.preview ? `<button class="btn btn-primary btn-sm" data-action="open">${I.eye} Abrir</button>` : '';
    const dl = item.url
      ? `<a class="btn ${k.preview ? 'btn-ghost' : 'btn-primary'} btn-sm" href="${esc(url)}" download="${esc(item.fileName)}">${I.download} Descargar</a>`
      : '';
    const link = item.link ? `<a class="btn ${dl || open ? 'btn-ghost' : 'btn-primary'} btn-sm" href="${esc(item.link)}" target="_blank" rel="noopener">${I.external} Ver enlace</a>` : '';

    const chips = [item.category ? `<span class="pj-tag is-cat">${esc(item.category)}</span>` : '', ...item.tags.map((t) => `<span class="pj-tag">${esc(t)}</span>`)].join('');
    const extras = [
      ...item.extraFiles.map((f) => `<li><a href="${esc(f.url)}" download="${esc(f.fileName)}">${I.download}<span>${esc(f.name)}</span>${f.size ? `<small>${esc(formatSize(f.size))}</small>` : ''}</a></li>`),
      ...item.extraLinks.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${I.external}<span>${esc(l.label)}</span></a></li>`),
    ].join('');

    return `
      <div class="pj-body">
        <h4 class="pj-title">${esc(item.name)}</h4>
        <div class="pj-desc${item.description ? '' : ' is-empty'}">${esc(item.description || 'Sin descripción')}</div>
        ${chips ? `<div class="pj-tags">${chips}</div>` : ''}
        ${extras ? `<ul class="pj-extras">${extras}</ul>` : ''}
        <div class="pj-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>
      </div>
      <div class="pj-actions">${open}${dl}${link}</div>`;
  }

  function buildCard(item, delay = 0) {
    const el = document.createElement('article');
    el.className = 'pj-card';
    el.dataset.id = item.id;
    el.style.setProperty('--pj-tone', KINDS[item.kind].tone);
    if (delay) el.style.animationDelay = `${delay}ms`;
    const url = item.url || '';
    el.innerHTML = thumbHTML(item, url) + viewBodyHTML(item, url);
    hydrateSnippet(el, item);
    return el;
  }

  async function hydrateSnippet(el, item) {
    const pre = el.querySelector('[data-snippet]');
    if (!pre || isFileProtocol()) return;   // con file:// no hay fetch(): se queda el marcador de posición
    try {
      let text;
      const res = await fetch(item.url, { headers: { Range: 'bytes=0-1999' } });
      if (!res.ok) throw new Error(res.status);
      text = (await res.text()).slice(0, 2000);
      pre.textContent = text.split(/\r?\n/).slice(0, 14).join('\n');
      pre.hidden = false;
      el.querySelector('.pj-thumb').classList.add('has-snippet');
    } catch { /* se queda el marcador de posición */ }
  }

  const cardEl = (id) => ui?.grid.querySelector(`.pj-card[data-id="${CSS.escape(id)}"]`);
  const allItems = () => state.published;

  /* ---------- Render de la ventana ---------- */
  function body() {
    return `
      <div class="pj">
        <p class="kicker">Proyectos</p>
        <h2>Mis trabajos</h2>
        <p class="lead">Laboratorios, documentación y proyectos que he ido realizando durante mi formación.</p>
        <div class="pj-toolbar"><div class="pj-count" data-count></div></div>
        <div class="pj-grid" data-slot="grid"></div>
        <div data-slot="empty"></div>
      </div>`;
  }

  function updateCount() {
    const el = ui?.pj.querySelector('[data-count]');
    if (el) el.textContent = plural(state.published.length, 'trabajo', 'trabajos');
  }

  function updateEmpty() {
    const slot = ui?.pj.querySelector('[data-slot=empty]');
    if (!slot) return;
    if (allItems().length) { slot.innerHTML = ''; return; }

    let title = 'Aún no hay trabajos publicados';
    let text = 'Estoy preparando esta sección. Vuelve pronto para ver mis proyectos y laboratorios.';
    if (state.publishedError) {
      title = 'No se ha podido cargar la lista';
      text = 'Inténtalo de nuevo más tarde.';
      const local = location.protocol === 'file:' || /^(localhost|127\.|\[?::1)/.test(location.hostname) || /[?&]debug=1\b/.test(location.search);
      if (local) text += ` Detalle técnico: ${state.publishedError.detail || state.publishedError.message}.`;
    }
    slot.innerHTML = `<div class="pj-empty"><div class="pj-empty-icon">${I.briefcase}</div><div class="pj-empty-title">${esc(title)}</div><div class="pj-empty-text">${esc(text)}</div></div>`;
  }

  function renderAll() {
    ui.grid.innerHTML = '';
    allItems().forEach((item, i) => ui.grid.append(buildCard(item, Math.min(i, 8) * 45)));
    updateCount();
    updateEmpty();
    if (pendingReveal) { const id = pendingReveal; pendingReveal = null; requestAnimationFrame(() => revealNow(id)); }
  }

  /* ---------- Eventos de la ventana ---------- */
  function bindEvents() {
    ui.pj.addEventListener('error', (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.closest('.pj-thumb')) return;
      console.warn('[Proyectos] No se pudo cargar la imagen:', img.currentSrc || img.src);
      const item = allItems().find((i) => i.id === img.closest('.pj-card')?.dataset.id);
      const ph = document.createElement('div');
      ph.className = 'pj-ph';
      ph.innerHTML = `${I.page}<span class="pj-ph-ext">${esc(item ? extLabel(item) : '')}</span>`;
      img.replaceWith(ph);
    }, true);
    ui.pj.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="open"]');
      if (!btn) return;
      const id = btn.closest('.pj-card')?.dataset.id;
      const it = allItems().find((i) => i.id === id);
      if (it) openViewer(it);
    });
  }

  /* ---------- Montaje (lo llama app.js al abrir la ventana) ---------- */
  async function mount(root) {
    const pj = root.querySelector('.pj');
    if (!pj) return;
    ui = { pj, grid: pj.querySelector('[data-slot=grid]') };

    bindEvents();
    ui.grid.innerHTML = '<div class="pj-skel"></div><div class="pj-skel"></div><div class="pj-skel"></div>';

    await ensureLoaded();
    if (!pj.isConnected || ui?.pj !== pj) return;   // la ventana se cerró mientras cargaba
    renderAll();
  }

  window.Projects = { body, mount, getCatalog, reveal, canPreview };
})();
