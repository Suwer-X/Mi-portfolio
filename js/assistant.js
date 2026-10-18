/* =========================================================
   Portafolio · Xiang Su Liu — Asistente del gato (ventana de búsqueda)
   Archivo: js/assistant.js  (se carga después de projects.js y search.js)

   · La ventana la crea app.js con su sistema de ventanas de siempre
     (sección «assistant»): este archivo solo rellena el contenido.
   · El catálogo viene de Projects.getCatalog(): la MISMA lista de proyectos
     publicados que muestra la web (sources/projects/projects.json). Aquí no
     hay ninguna copia, ni se escribe nada, ni se tocan los borradores.
   · Para abrir un proyecto se usa el mecanismo existente: se abre la ventana
     «Proyectos» y Projects.reveal() resalta la tarjeta y abre el visor.
   ========================================================= */
(function () {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clip = (s, n) => { const t = String(s || '').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
  const ICON_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

  /* ---------- Estructura ---------- */
  function body() {
    const avatar = window.PixelCat ? window.PixelCat.svg({ animated: false }) : '';
    return `
      <div class="as" data-as>
        <div class="as-head">
          <div class="as-avatar" aria-hidden="true">${avatar}</div>
          <div>
            <p class="as-hello">¡Miau! Soy el gato del portfolio.</p>
            <p class="as-sub">¿Qué proyecto buscas? Escribe una tecnología, una categoría o una parte del título.</p>
          </div>
        </div>
        <form class="as-form" role="search" data-form>
          <label class="sr-only" for="asQuery">Buscar proyectos</label>
          <input class="as-input" id="asQuery" name="q" type="search" maxlength="120" autocomplete="off" spellcheck="false"
                 placeholder="Por ejemplo: redes, Python, Docker…" data-input>
          <button class="btn btn-primary as-go" type="submit" aria-label="Buscar">${ICON_SEARCH}</button>
        </form>
        <div class="as-chips" data-chips hidden></div>
        <p class="as-status" role="status" aria-live="polite" data-status></p>
        <div data-out></div>
      </div>`;
  }

  /* ---------- Montaje (lo llama app.js al abrir la ventana) ---------- */
  function mount(winBody) {
    winBody.classList.add('as-body');
    const root = winBody.querySelector('[data-as]');
    if (!root) return;

    const input = root.querySelector('[data-input]');
    const form = root.querySelector('[data-form]');
    const chipsEl = root.querySelector('[data-chips]');
    const statusEl = root.querySelector('[data-status]');
    const out = root.querySelector('[data-out]');

    let seq = 0;                 // descarta respuestas antiguas (carga del catálogo, reintentos)
    let lastQuery = '';
    let cat = null;              // catálogo ya cargado { items, error }; el MISMO array se reutiliza → índice de búsqueda en caché
    let loading = null;

    const setStatus = (t) => { if (statusEl.textContent !== (t || '')) statusEl.textContent = t || ''; };
    const chipsHTML = (labels) => labels.map((l) => `<button type="button" class="as-chip" data-q="${esc(l)}">${esc(l)}</button>`).join('');

    /* --- Catálogo (compartido con la sección Proyectos) --- */
    async function fetchCatalog(retry = false) {
      if (!window.Projects || typeof window.Projects.getCatalog !== 'function') return { items: [], error: { kind: 'missing', detail: '' } };
      try { return await window.Projects.getCatalog({ retry }); }
      catch (err) { console.error('[Asistente] Error inesperado al leer el catálogo →', err); return { items: [], error: { kind: 'unknown', detail: '' } }; }
    }
    function ensureCatalog(retry = false) {
      if (cat && !retry) return Promise.resolve(cat);
      if (!loading || retry) {
        const mine = ++seq;
        loading = fetchCatalog(retry).then((c) => { if (mine === seq || !cat) cat = c; loading = null; return c; });
      }
      return loading;
    }

    /* --- Vista: se reutilizan los mismos nodos (lista y tarjetas) en lugar de reconstruir la ventana --- */
    const listEl = document.createElement('ul');
    listEl.className = 'as-results';
    const cards = new Map();          // id → { li, sig }
    let showing = 'none';             // 'list' | 'msg' | 'none'

    function setMessage(html) {
      cards.clear(); listEl.replaceChildren();
      showing = 'msg';
      const box = document.createElement('div');
      box.innerHTML = html;
      out.replaceChildren(...box.childNodes);
    }
    function clearOut() { if (showing !== 'none') { out.replaceChildren(); showing = 'none'; } cards.clear(); listEl.replaceChildren(); }

    function tagsHTML(it, matched) {
      const hit = (label) => {
        const n = window.ProjectSearch.normalize(label);
        return !!n && matched.some((m) => n.includes(m) || m.includes(n));
      };
      const parts = [];
      if (it.category) parts.push(`<span class="as-tag is-cat${hit(it.category) ? ' is-hit' : ''}">${esc(it.category)}</span>`);
      it.tags.slice(0, 5).forEach((t) => parts.push(`<span class="as-tag${hit(t) ? ' is-hit' : ''}">${esc(t)}</span>`));
      return parts.length ? `<div class="as-tags">${parts.join('')}</div>` : '';
    }

    function cardHTML({ item, matched }) {
      const preview = !!window.Projects?.canPreview?.(item.id);
      const label = preview ? 'Abrir' : 'Ver en Proyectos';
      return `
          <div>
            <h3 class="as-title">${esc(item.name)}</h3>
            ${item.description ? `<p class="as-desc">${esc(clip(item.description, 150))}</p>` : ''}
            ${tagsHTML(item, matched)}
          </div>
          <button type="button" class="btn btn-primary btn-sm as-open" data-open-project="${esc(item.id)}" aria-label="${label}: ${esc(item.name)}">${ICON_OPEN} ${label}</button>`;
    }

    function renderList(list) {
      if (showing !== 'list') { out.replaceChildren(listEl); showing = 'list'; }
      const want = new Set(list.map((r) => r.item.id));
      cards.forEach((c, id) => { if (!want.has(id)) { c.li.remove(); cards.delete(id); } });
      let prev = null;
      list.forEach((r) => {
        const html = cardHTML(r);
        let c = cards.get(r.item.id);
        if (!c || c.html !== html) {                     // solo se recrea la tarjeta si cambia lo que se pinta
          const li = document.createElement('li');
          li.className = 'as-result';
          li.innerHTML = html;
          if (c) c.li.replaceWith(li);
          c = { li, html };
          cards.set(r.item.id, c);
        }
        const should = prev ? prev.nextSibling : listEl.firstChild;
        if (c.li !== should) listEl.insertBefore(c.li, should);   // solo se mueve si está en otra posición
        prev = c.li;
      });
    }

    function showLoadError(c) {
      setStatus('');
      setMessage(`
        <div class="as-msg is-error" role="alert">
          <p><strong>No he podido cargar el catálogo de proyectos.</strong></p>
          <p>Esto no significa que no haya resultados: simplemente no he podido consultarlos. Inténtalo de nuevo en un momento.</p>
          ${c.error.detail ? `<p class="as-detail">Detalle técnico: ${esc(c.error.detail)}</p>` : ''}
          <button type="button" class="btn btn-ghost btn-sm" data-retry>Reintentar</button>
        </div>`);
    }

    /* --- Búsqueda (síncrona cuando el catálogo ya está cargado) --- */
    function render(raw, explicit) {
      const q = String(raw || '').trim();
      if (!q) {                                           // texto borrado: se limpia sin ruido
        clearOut();
        setStatus(explicit ? 'Escribe una o varias palabras para buscar.' : '');
        if (explicit) input.focus();
        return;
      }
      if (cat.error) return showLoadError(cat);
      if (!cat.items.length) {
        setStatus('');
        setMessage('<div class="as-msg"><p>Todavía no hay proyectos publicados en el catálogo. Vuelve a probar más adelante.</p></div>');
        return;
      }

      const r = window.ProjectSearch.search(cat.items, q);
      switch (r.mode) {
        case 'empty':
        case 'noise':
          clearOut();
          setStatus('Escribe alguna palabra más concreta: una tecnología, una categoría o parte del título.');
          return;
        case 'all':
          setStatus(`Estos son los proyectos publicados (${r.total}${r.total > r.results.length ? `, te enseño ${r.results.length}` : ''}).`);
          renderList(r.results);
          return;
        case 'full':
          setStatus(`${plural(r.total, 'resultado', 'resultados')} para «${r.query.raw}»${r.total > r.results.length ? ` (te enseño los ${r.results.length} más relevantes)` : ''}.`);
          renderList(r.results);
          return;
        case 'partial':
          setStatus(`Ningún proyecto contiene todas las palabras de «${r.query.raw}». Estos coinciden con alguna de ellas:`);
          renderList(r.results);
          return;
        default: {  // 'none'
          setStatus('');
          const sugg = window.ProjectSearch.suggestions(cat.items, 5);
          setMessage(`
            <div class="as-msg">
              <p>No he encontrado ningún proyecto para «${esc(r.query.raw)}». Prueba con otra palabra o con menos letras.</p>
              ${sugg.length ? `<p>Por ejemplo, puedes buscar:</p><div class="as-chips">${chipsHTML(sugg)}</div>` : ''}
            </div>`);
        }
      }
    }

    function run(raw, explicit = false) {
      lastQuery = raw;
      if (cat) return render(raw, explicit);
      if (!String(raw || '').trim()) return render('', explicit) || undefined;
      setStatus('Buscando…');
      ensureCatalog().then(() => { if (lastQuery === raw) render(raw, explicit); });
    }

    // Una pulsación = como mucho una búsqueda por fotograma (se agrupan pegados y borrados rápidos).
    // El temporizador de respaldo evita que una pestaña en segundo plano (sin fotogramas) deje la búsqueda sin actualizar.
    let pending = 0, timer = 0;
    const flush = () => {
      if (!pending) return;
      cancelAnimationFrame(pending); clearTimeout(timer); pending = 0; timer = 0;
      run(input.value);
    };
    const schedule = () => {
      if (pending) return;
      pending = requestAnimationFrame(flush);
      timer = setTimeout(flush, 40);
    };

    /* --- Eventos (solo dentro de esta ventana; nada global de teclado) --- */
    input.addEventListener('input', schedule);                                           // búsqueda progresiva
    form.addEventListener('submit', (e) => { e.preventDefault(); cancelAnimationFrame(pending); clearTimeout(timer); pending = 0; timer = 0; run(input.value, true); });   // Enter / botón: al instante

    root.addEventListener('click', async (e) => {
      const chip = e.target.closest('[data-q]');
      if (chip) { input.value = chip.dataset.q; run(chip.dataset.q, true); return; }

      if (e.target.closest('[data-retry]')) {
        setStatus('Cargando el catálogo…');
        cat = null;
        const c = await ensureCatalog(true);
        if (c.error) return showLoadError(c);
        setStatus('');
        clearOut();
        fillSuggestions(c);
        if (lastQuery.trim()) run(lastQuery);
        return;
      }

      const open = e.target.closest('[data-open-project]');
      if (open) openProject(open.dataset.openProject);
    });

    // Reutiliza el sistema existente: primero la ventana «Proyectos» (app.js), después se resalta/abre el proyecto
    function openProject(id) {
      if (typeof window.openWindow === 'function') window.openWindow('projects');
      window.Projects.reveal(id);
    }

    /* --- Sugerencias sacadas del catálogo real (nada escrito a mano) --- */
    function fillSuggestions(cat) {
      if (cat.error || !cat.items.length) { chipsEl.hidden = true; return; }
      const sugg = window.ProjectSearch.suggestions(cat.items, 5);
      chipsEl.innerHTML = chipsHTML(sugg);
      chipsEl.hidden = !sugg.length;
    }

    (async () => {
      const c = await ensureCatalog();
      if (!root.isConnected) return;
      if (c.error) showLoadError(c);
      else fillSuggestions(c);
      if (input.value.trim()) run(input.value);          // si ya se había escrito algo mientras cargaba
    })();

    // Foco en el campo (en pantallas táctiles no, para no abrir el teclado sin que se pida)
    if (!window.matchMedia('(pointer: coarse)').matches) input.focus({ preventScroll: true });
  }

  window.Assistant = { body, mount };
})();
