/* =========================================================
   Portafolio · Xiang Su Liu — Gato pixel art
   Archivo: js/cat.js  (se carga antes de app.js)

   · Dibuja el sprite del gato (SVG generado desde SPRITE, abajo).
   · Lo pinta dentro de #catSlot (ver index.html) y muestra, con discreción,
     un saludo la primera vez y algún mensaje corto de vez en cuando.
   · NO abre nada por sí mismo: el botón lleva data-open="assistant" y app.js
     abre la ventana con el mismo mecanismo que usan el resto de secciones.
   · No registra eventos de teclado globales.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Configuración ---------- */
  const CONFIG = {
    // Si algún día prefieres un PNG/GIF propio, pon aquí su ruta (p. ej. './sources/cat.png').
    // Vacío = se usa el sprite dibujado abajo.
    imageUrl: '',

    storageKey: 'portfolio-cat-greeted',   // para no repetir el saludo inicial
    greetingDelayMs: 1800,                 // espera antes del saludo de bienvenida
    bubbleMs: 6500,                        // cuánto se ve cada globo
    tipFirstAfterMs: 60000,                // primer mensaje ocasional (1 min después de entrar)
    tipEveryMs: 120000,                    // separación mínima entre mensajes (2 min)
    tipMax: 2,                             // máximo de mensajes ocasionales por visita
  };

  const GREETING = '¡Miau! Soy el gato del portfolio. Haz clic en mí si buscas algún proyecto.';
  const TIPS = [
    'Pregúntame por una tecnología y te enseño los proyectos que la usan.',
    'Prueba a buscar «redes», «Docker» o «Python».',
    'Todo lo que encuentro sale del catálogo de proyectos publicados.',
  ];

  /* ---------- Sprite (16 × 16 píxeles) ----------
     Cada letra es un píxel. Para cambiar el dibujo basta con editar estas filas
     (todas deben medir 16 caracteres) o los colores de PALETTE.
        .  transparente        o  contorno           f  pelaje
        s  sombra del pelaje   p  rosa (nariz/orejas) e  ojo
        c  collar              y  chapa del collar    t / u  cola (relleno / contorno; se mueve un píxel) */
  const SPRITE = [
    '................',
    '..oo........oo..',
    '.ofpo......opfo.',
    '.offfoooooofffo.',
    '.offffffffffffo.',
    '.offffffffffffo.',
    '.offeffffffeffo.',
    '.offeffffffeffo.',
    '.offfffppfffffo.',
    '..oooooooooooo..',
    '..occccyccccco..',
    '..offffffffffouu',
    '..offfssssfffotu',
    '..offffffffffotu',
    '..offffooffffouu',
    '..oooooooooooo..',
  ];
  const PALETTE = {
    o: '#0b1e3f',   // contorno (azul marino de la web)
    f: '#e8f2fc',   // pelaje
    s: '#b4d2ee',   // sombra
    p: '#f4a6c0',   // rosa
    e: '#0369a1',   // ojos
    c: '#38bdf8',   // collar (cian de la web)
    y: '#fde68a',   // chapa (amarillo de la nota adhesiva)
    t: '#e8f2fc',   // cola (relleno)
    u: '#0b1e3f',   // cola (contorno)
  };

  const W = SPRITE[0].length;
  const H = SPRITE.length;

  /* ---------- Fotogramas de animación ----------
     SPRITE es el gato en reposo (fotograma 0 de todas las piezas). Cada pieza animada es una zona rectangular
     del mismo sprite (x, y = esquina; las filas de cada fotograma miden exactamente `w` caracteres, '.' = transparente)
     que se sustituye por otro fotograma. Se pintan con la misma paleta; nada se escala ni se desplaza.
        eyes  ojo izquierdo (x3) y derecho (x10): abiertos = reposo · cerrados = rayita oscura de 3 píxeles
        earL  oreja izquierda (x0..4) · earR oreja derecha (x11..15): inclinadas hacia fuera */
  const PARTS = {
    eyes: [
      { x: 3,  y: 6, w: 3, frames: [null, ['fff', 'ooo']] },
      { x: 10, y: 6, w: 3, frames: [null, ['fff', 'ooo']] },
    ],
    earL: [{ x: 0,  y: 1, w: 5, frames: [null, ['ofo..', 'ofpfo']] }],
    earR: [{ x: 11, y: 1, w: 5, frames: [null, ['..ofo', 'ofpfo']] }],
  };

  // Píxeles de una zona (de SPRITE si el fotograma es null, o de las filas dadas)
  function regionRects(reg, f) {
    const rows = reg.frames[f] || SPRITE.slice(reg.y, reg.y + (reg.frames[1] || []).length).map((r) => r.slice(reg.x, reg.x + reg.w));
    let out = '';
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
      if (ch === '.' || !PALETTE[ch]) return;
      out += `<rect x="${reg.x + dx}" y="${reg.y + dy}" width="1" height="1" fill="${PALETTE[ch]}"/>`;
    }));
    return out;
  }

  /* ---------- Dibujo ---------- */
  // Devuelve el SVG del gato como texto. { animated: false } → gato quieto y plano (iconos, avatar).
  function svg({ animated = true } = {}) {
    const inPart = (x, y) => animated && Object.values(PARTS).some((regs) => regs.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.frames[1].length));
    let body = '', tail = '';
    SPRITE.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.' || !PALETTE[ch] || inPart(x, y)) return;
        const r = `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[ch]}"/>`;
        if (ch === 't' || ch === 'u') tail += r; else body += r;
      });
    });
    let parts = '';
    if (animated) {
      parts = Object.entries(PARTS).map(([name, regs]) =>
        `<g class="cat-part" data-part="${name}" data-f="0"><g class="fr fr0">${regs.map((r) => regionRects(r, 0)).join('')}</g><g class="fr fr1">${regs.map((r) => regionRects(r, 1)).join('')}</g></g>`).join('');
    }
    return `<svg viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"${animated ? ' class="cat-anim"' : ''}>` +
      `<g>${body}</g><g${animated ? ' class="cat-tail"' : ''}>${tail}</g>${parts}</svg>`;
  }

  /* ---------- Animación por fotogramas ----------
     Parpadeo y orejas son dos bucles INDEPENDIENTES con tiempos aleatorios: nunca se repite la misma secuencia.
     Solo se cambia data-f (0 = reposo, 1 = pose) de cada pieza; las reglas de css/cat.css muestran el fotograma.
     Con «reducir movimiento» (o pestaña oculta) no hay temporizadores y todo queda en reposo. */
  const ANIM = {
    blinkEveryMs: [2000, 4200],   // ojos abiertos entre parpadeos
    blinkClosedMs: [150, 220],    // ojos cerrados
    doubleBlinkChance: 0.22,      // probabilidad de parpadeo doble (segundo parpadeo 110-170 ms después)
    earEveryMs: [1800, 5200],     // espera entre movimientos de orejas
    earTiltMs: [260, 420],        // oreja inclinada
    earShakeChance: 0.35,         // probabilidad de sacudida de ambas orejas
  };
  const rnd = (r) => r[0] + Math.random() * (r[1] - r[0]);

  function animate(root) {
    const part = {};
    root.querySelectorAll('.cat-part').forEach((g) => { part[g.dataset.part] = g; });
    if (!part.eyes || !part.earL || !part.earR) return;
    const set = (name, f) => part[name].setAttribute('data-f', String(f));
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
    let running = false;

    // Parpadeo: ojos cerrados un instante y, de vez en cuando, dos seguidos
    const close = (ms, then) => { set('eyes', 1); later(() => { set('eyes', 0); then(); }, ms); };
    function blinkLoop() {
      later(() => close(rnd(ANIM.blinkClosedMs), () => {
        if (Math.random() < ANIM.doubleBlinkChance) later(() => close(rnd([150, 190]), blinkLoop), rnd([110, 170]));
        else blinkLoop();
      }), rnd(ANIM.blinkEveryMs));
    }

    // Orejas: una se inclina y vuelve (la otra a veces reacciona con retraso) o ambas se sacuden
    const tilt = (name, ms) => { set(name, 1); later(() => set(name, 0), ms); };
    const shake = (name, delay) => later(() => { let k = 0; const step = () => { set(name, k % 2 === 0 ? 1 : 0); k++; if (k < 5) later(step, 85); else set(name, 0); }; step(); }, delay);
    function earLoop() {
      later(() => {
        const first = Math.random() < 0.5 ? 'earL' : 'earR';
        const other = first === 'earL' ? 'earR' : 'earL';
        if (Math.random() < ANIM.earShakeChance) { shake(first, 0); shake(other, 40); }
        else {
          tilt(first, rnd(ANIM.earTiltMs));
          if (Math.random() < 0.6) later(() => tilt(other, rnd([220, 360])), rnd([120, 220]));
        }
        earLoop();
      }, rnd(ANIM.earEveryMs));
    }

    function start() { if (running) return; running = true; blinkLoop(); earLoop(); }
    function stop() { running = false; timers.forEach(clearTimeout); timers.clear(); Object.keys(part).forEach((n) => set(n, 0)); }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { if (mq.matches || document.hidden) stop(); else start(); };
    if (mq.addEventListener) mq.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  window.PixelCat = { svg };

  /* ---------- Almacenamiento que falla sin romper nada ---------- */
  const memory = {};
  const store = {
    get(k) { try { const v = window.localStorage.getItem(k); if (v !== null) return v; } catch { /* sin acceso */ } try { return window.sessionStorage.getItem(k); } catch { /* sin acceso */ } return memory[k] ?? null; },
    set(k, v) { memory[k] = v; try { window.localStorage.setItem(k, v); return; } catch { /* sin acceso */ } try { window.sessionStorage.setItem(k, v); } catch { /* sin acceso */ } },
  };

  /* ---------- Montaje ---------- */
  function mount() {
    const slot = document.getElementById('catSlot');
    if (!slot) return;
    const sprite = slot.querySelector('.cat-sprite');
    const bubble = slot.querySelector('.cat-bubble');
    const btn = slot.querySelector('.cat');
    if (!sprite || !bubble || !btn) return;

    sprite.innerHTML = CONFIG.imageUrl
      ? `<img src="${CONFIG.imageUrl}" alt="" width="${W}" height="${H}" decoding="async">`
      : svg();
    const animEl = sprite.querySelector('svg.cat-anim');
    if (animEl) animate(animEl);

    /* Globos de texto: breves, sin sonido, sin captar el foco ni bloquear clics */
    let hideTimer = null;
    const assistantOpen = () => !!document.querySelector('.window[data-id="assistant"]');
    const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Si el gato choca con la nota adhesiva (poca altura), se aparta: primero al margen derecho y, si no cabe, a la izquierda del título
    const MODES = [[], ['is-moved', 'is-side'], ['is-moved', 'is-left']];
    function fit() {
      const note = document.querySelector('.sticky-note');
      const noteShown = note && getComputedStyle(note).display !== 'none';
      const apply = (cls) => { slot.classList.remove('is-moved', 'is-side', 'is-left'); cls.forEach((c) => slot.classList.add(c)); };
      apply(MODES[0]);
      if (!noteShown) return;
      const desk = note.offsetParent ? note.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
      const n = { left: desk.left + note.offsetLeft, top: desk.top + note.offsetTop, right: desk.left + note.offsetLeft + note.offsetWidth, bottom: desk.top + note.offsetTop + note.offsetHeight };
      const pad = 8;   // la nota entra con una pequeña animación: se deja holgura
      const clash = () => { const c = btn.getBoundingClientRect(); return c.left < n.right + pad && c.right > n.left - pad && c.top < n.bottom + pad && c.bottom > n.top - pad; };
      for (const cls of MODES) { apply(cls); if (!clash()) return; }
    }
    fit();
    let raf = 0;
    const refit = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
    window.addEventListener('resize', refit);
    window.addEventListener('load', refit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit).catch(() => {});

    function say(text) {
      if (document.hidden || assistantOpen() || slot.classList.contains('is-moved')) return false;
      clearTimeout(hideTimer);
      bubble.textContent = text;
      bubble.hidden = false;
      requestAnimationFrame(() => bubble.classList.add('is-in'));
      hideTimer = setTimeout(hide, CONFIG.bubbleMs);
      return true;
    }
    function hide() {
      clearTimeout(hideTimer);
      bubble.classList.remove('is-in');
      setTimeout(() => { if (!bubble.classList.contains('is-in')) bubble.hidden = true; }, reduceMotion() ? 0 : 220);
    }
    btn.addEventListener('click', hide);

    // Saludo de bienvenida: solo la primera vez
    if (!store.get(CONFIG.storageKey)) {
      setTimeout(() => { if (say(GREETING)) store.set(CONFIG.storageKey, '1'); }, CONFIG.greetingDelayMs);
    }

    // Mensajes ocasionales: pocos, espaciados y nunca con el asistente abierto
    let tips = 0;
    const scheduleTip = (ms) => setTimeout(() => {
      if (tips >= CONFIG.tipMax) return;
      if (say(TIPS[tips % TIPS.length])) tips++;
      scheduleTip(CONFIG.tipEveryMs);
    }, ms);
    scheduleTip(CONFIG.tipFirstAfterMs);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
