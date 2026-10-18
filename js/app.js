/* =========================================================
   Portafolio · Xiang Su Liu
   Escritorio estilo Windows en Vanilla JS
   ========================================================= */

// Enlaces de perfil. Sustituye por las URLs reales de tus perfiles.
const PROFILE_LINKS = {
  linkedin: 'https://www.linkedin.com/in/xiang-su-liu-0b979a443/',
  github: 'https://github.com/Suwer-X',
};

/* ---------- Iconos (SVG) ---------- */
const ICONS = {
  txt: `<svg viewBox="0 0 48 48" aria-hidden="true"><path class="i-page" d="M12 4h17l9 9v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path class="i-fold" d="M29 4v7a2 2 0 0 0 2 2h7"/><path class="i-line" d="M16 22h16M16 28h16M16 34h10"/></svg>`,
  exe: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="i-app" x="5" y="8" width="38" height="32" rx="4"/><path class="i-bar" d="M5 15h38"/><circle class="i-dot" cx="24" cy="26" r="5"/><path class="i-dot" d="M15 36c1.5-4 5-6 9-6s7.5 2 9 6"/></svg>`,
  folder: `<svg viewBox="0 0 48 48" aria-hidden="true"><path class="i-folder-back" d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z"/><path class="i-folder-front" d="M4 19h40v19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z"/><path class="i-cap" d="m24 24-8 3.5 8 3.5 8-3.5Z M19 29.5v3c0 1 2.2 2 5 2s5-1 5-2v-3"/></svg>`,
  doc: `<svg viewBox="0 0 48 48" aria-hidden="true"><path class="i-page" d="M12 4h17l9 9v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path class="i-fold" d="M29 4v7a2 2 0 0 0 2 2h7"/><rect class="i-badge" x="6" y="22" width="22" height="14" rx="2.5"/><path class="i-badge-txt" d="m10 26 2 6 2-5 2 5 2-6"/></svg>`,
  sys: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="i-app" x="6" y="6" width="36" height="36" rx="5"/><path class="i-gear" d="M24 16.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm0-5v4m0 17v4m12.5-12.5h-4m-17 0h-4m20.3-8.8-2.8 2.8m-12 12-2.8 2.8m17.6 0-2.8-2.8m-12-12-2.8-2.8"/></svg>`,
  pdf: `<svg viewBox="0 0 48 48" aria-hidden="true"><path class="i-page" d="M12 4h17l9 9v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path class="i-fold" d="M29 4v7a2 2 0 0 0 2 2h7"/><path class="i-down" d="M24 19v13m0 0-5-5m5 5 5-5M17 37h14"/></svg>`,
  work: `<svg viewBox="0 0 48 48" aria-hidden="true"><path class="i-down" d="M18 13v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/><rect class="i-app" x="4" y="13" width="40" height="27" rx="4"/><path class="i-bar" d="M4 26h40"/><rect class="i-dot" x="21" y="23" width="6" height="7" rx="1.5"/></svg>`,  // Gato del asistente: se dibuja con el mismo sprite que el gato del escritorio (js/cat.js)
  cat: (window.PixelCat ? window.PixelCat.svg({ animated: false }) : ''),
};

const UI = {
  min: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8"/></svg>',
  max: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1"/></svg>',
  restore: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="4" width="6" height="6" rx="1"/><path d="M4 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H8"/></svg>',
  close: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V17M8 7.5v.01M12 17v-6.5m0 2.5c0-1.7 1.2-2.7 2.6-2.7S17 11.5 17 13v4"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 19c-4 1.3-4-2-6-2.5m12 4.5v-3.4a3 3 0 0 0-.8-2.3c2.8-.3 5.8-1.4 5.8-6.3a4.9 4.9 0 0 0-1.3-3.4 4.6 4.6 0 0 0-.1-3.4s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.9 5.4 3.2 5.4 3.2a4.6 4.6 0 0 0-.1 3.4A4.9 4.9 0 0 0 4 10c0 4.9 3 6 5.8 6.3a3 3 0 0 0-.8 2.3V21"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
};

/* ---------- Contenido ---------- *//* =========================================================
   Portafolio · Xiang Su Liu
   Escritorio estilo Windows en Vanilla JS
   ========================================================= */

// Enlaces de perfil. Sustituye por las URLs reales de tus perfiles.

/* ---------- Iconos (SVG) ---------- */
// ... (El bloque de código de ICONS y UI se mantiene igual) ...

/* ---------- Contenido ---------- */
const SECTIONS = [
  {
    id: 'about',
    file: 'Sobre_Mi.txt',
    label: 'Sobre mí',
    icon: 'txt',
    width: 640,
    body: () => `
      <p class="kicker">Sobre mí</p>
      <h2>Hola, soy Xiang Su Liu</h2>
      <p class="lead">Estudiante de 2º año de ASIR apasionado por las infraestructuras de red y la administración de sistemas.</p>
      <p>En continua formación, preparándome para la certificación <strong>Cisco CCNA</strong> y explorando tecnologías como <strong>Docker</strong>.</p>
      <p>Busco una oportunidad para realizar mis <strong>prácticas en el sector IT</strong>, donde pueda aportar mi capacidad analítica para la resolución de incidencias, mi actitud proactiva y mi experiencia previa en atención al cliente y trabajo en equipo.</p>
      <div class="tags">
        <span>Redes</span><span>Sistemas</span><span>CCNA</span><span>Docker</span>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-open="contact">Contactar</button>
        <a class="btn btn-ghost" href="./sources/cv_xiang_su_liu.pdf" download>Descargar CV</a>
      </div>`,
  },
  {
    id: 'contact',
    file: 'Contacto_y_Perfil.exe',
    label: 'Contacto y perfil',
    icon: 'exe',
    width: 620,
    body: () => `
      <p class="kicker">Contacto y perfil</p>
      <h2>Hablemos</h2>
      <ul class="contact-list">
        <li>
          <span class="c-icon">${UI.mail}</span>
          <div><p class="c-label">Email</p><a href="mailto:xiangsuliu@outlook.com">xiangsuliu@outlook.com</a></div>
        </li>
        <li>
          <span class="c-icon">${UI.phone}</span>
          <div><p class="c-label">Teléfono</p><a href="tel:+34688001568">(+34) 688 001 568</a></div>
        </li>
        <li>
          <span class="c-icon">${UI.pin}</span>
          <div><p class="c-label">Ubicación</p><p>Málaga</p></div>
        </li>
      </ul>
      <h3>Redes</h3>
      <div class="actions">
        <a class="btn btn-ghost" href="${PROFILE_LINKS.linkedin}" target="_blank" rel="noopener">${UI.linkedin} LinkedIn</a>
        <a class="btn btn-ghost" href="${PROFILE_LINKS.github}" target="_blank" rel="noopener">${UI.github} GitHub</a>
      </div>
      <h3>Otros</h3>
      <ul class="checks">
        <li>${UI.check} Carné de conducir</li>
        <li>${UI.check} Vehículo propio</li>
        <li>${UI.check} Disponibilidad total</li>
      </ul>`,
  },
  {
    id: 'education',
    file: 'Educacion_e_Idiomas.folder',
    label: 'Educación e idiomas',
    icon: 'folder',
    width: 660,
    body: () => `
      <p class="kicker">Educación e idiomas</p>
      <h2>Formación</h2>
      <ol class="timeline">
        <li>
          <p class="t-title">Grado Superior · ASIR</p>
          <p class="t-meta">DIGITECH FP</p>
          <span class="pill pill-live">Cursando 2º año</span>
        </li>
        <li>
          <p class="t-title">Bachillerato</p>
          <p class="t-meta">Los Manantiales</p>
        </li>
        <li>
          <p class="t-title">Educación Secundaria</p>
          <p class="t-meta">Attendis El Romeral</p>
        </li>
      </ol>
      <h3>Idiomas</h3>
      <div class="cards">
        <div class="card"><p class="card-big">B2</p><p>Inglés</p></div>
        <div class="card"><p class="card-big">HSK6</p><p>Chino · Nativo</p></div>
      </div>
      <h3>Cursos extra</h3>
      <ul class="rows">
        <li><span>Cisco CCNA</span><span class="pill pill-live">Cursando</span></li>
        <li><span>Introducción a Ciberseguridad e Inteligencia Artificial</span><span class="pill pill-live">Cursando</span></li>
      </ul>`,
  },
  {
    id: 'experience',
    file: 'Experiencia_Laboral.doc',
    label: 'Experiencia laboral',
    icon: 'doc',
    width: 680,
    body: () => `
      <p class="kicker">Experiencia laboral</p>
      <h2>Trayectoria</h2>
      <article class="job">
        <header>
          <h3>Auxiliar de Logística y Soporte en Obra</h3>
          <p class="t-meta">Gibralaire S.L · Veranos 2021–2026</p>
        </header>
        <ul>
          <li>Gestión integral de la logística y transporte diario de personal a obras.</li>
          <li>Compra y aprovisionamiento de materiales cumpliendo los plazos operativos.</li>
          <li>Soporte activo como peón de obra y asistencia general al equipo de trabajo.</li>
        </ul>
      </article>
      <article class="job">
        <header>
          <h3>Cobrador y Reponedor</h3>
          <p class="t-meta">Supermercado Chino LuCheng · 2015–2021</p>
        </header>
        <ul>
          <li>Apoyo operativo en el negocio familiar con gran sentido de la responsabilidad.</li>
          <li>Atención al cliente bilingüe y gestión eficiente de cobros en caja.</li>
          <li>Control de inventario, organización de almacén y reposición.</li>
        </ul>
      </article>`,
  },
  {
    id: 'skills',
    file: 'Habilidades_Tecnicas.sys',
    label: 'Habilidades técnicas',
    icon: 'sys',
    width: 700,
    body: () => `
      <p class="kicker">Habilidades técnicas</p>
      <h2>Lo que sé hacer</h2>
      <dl class="skills">
        <div><dt>Sistemas operativos</dt><dd>Administración de entornos Windows Server (Active Directory, GPO) y distribuciones Linux (gestión de usuarios, permisos y servicios).</dd></div>
        <div><dt>Redes e infraestructura</dt><dd>Diseño LAN/WAN, enrutamiento, VLANs, simulaciones con Cisco Packet Tracer (conceptos CCNA), almacenamiento NAS y RAID.</dd></div>
        <div><dt>Servicios web y seguridad</dt><dd>Despliegue de infraestructura LAMP (Linux, Apache, MySQL, PHP) y control de tráfico con cortafuegos (iptables).</dd></div>
        <div><dt>Bases de datos</dt><dd>Diseño, administración y consultas SQL en bases de datos relacionales con PostgreSQL.</dd></div>
        <div><dt>Virtualización y Contenedores</dt><dd>Gestión con Microsoft Hyper-V y Proxmox VE, e implementación de contenedores con Docker <span class="pill pill-live">En aprendizaje activo</span></dd></div>
        <div><dt>Programación y Scripting</dt><dd>Automatización de tareas con Python, maquetación web estática (HTML/CSS) y fundamentos básicos de JavaScript.</dd></div>
      </dl>
      <h3>Soft skills</h3>
      <div class="tags">
        <span>Resolución de problemas</span><span>Aprendizaje autónomo</span><span>Atención al usuario</span><span>Trabajo en equipo</span><span>Adaptabilidad</span>
      </div>`,
  },
  {
    id: 'projects',
    file: 'Proyectos.folder',
    label: 'Proyectos',
    icon: 'work',
    width: 860,
    body: () => Projects.body(),
    onMount: (el) => Projects.mount(el),
  },
  {
    // Ventana del gato asistente (js/assistant.js). `hidden`: no tiene icono de escritorio ni entrada en Inicio;
    // se abre con data-open="assistant" desde el gato, y reutiliza este mismo sistema de ventanas.
    id: 'assistant',
    file: 'Asistente_Gato.exe',
    label: 'Asistente de búsqueda',
    icon: 'cat',
    width: 540,
    height: 600,
    hidden: true,
    body: () => Assistant.body(),
    onMount: (el) => Assistant.mount(el),
  },
];

// ... (El resto del código JS (Animaciones, ventanas, etc.) se mantiene igual) ...
const DOWNLOAD_ICON = { file: 'cv_xiang_su_liu.pdf', href: './sources/cv_xiang_su_liu.pdf', icon: 'pdf' };

/* ---------- Estado ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const iconsEl = $('#icons');
const windowsEl = $('#windows');
const taskItemsEl = $('#taskItems');
const startMenu = $('#startMenu');
const startBtn = $('#startBtn');
const startList = $('#startList');

const openWindows = new Map(); // id -> { el, task, minimized, maximized }
let zTop = 10;
let cascade = 0;
const isCompact = () => window.matchMedia('(max-width: 760px)').matches;
const isCoarse = () => window.matchMedia('(pointer: coarse)').matches;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Iconos del escritorio ---------- */
function renderDesktopIcons() {
  const frag = document.createDocumentFragment();

  SECTIONS.filter((s) => !s.hidden).forEach((s) => {
    const btn = document.createElement('button');
    btn.className = `desk-icon icon-${s.icon}`;
    btn.dataset.id = s.id;
    btn.setAttribute('aria-label', `Abrir ${s.label}`);
    btn.innerHTML = `<span class="desk-glyph">${ICONS[s.icon]}</span><span class="desk-name">${s.file}</span>`;
    frag.appendChild(btn);

    const li = document.createElement('li');
    li.innerHTML = `<button data-open="${s.id}"><span class="start-glyph icon-${s.icon}">${ICONS[s.icon]}</span><span><span class="start-item-title">${s.label}</span><span class="start-item-file">${s.file}</span></span></button>`;
    startList.appendChild(li);
  });

  const cv = document.createElement('a');
  cv.className = 'desk-icon icon-pdf';
  cv.href = DOWNLOAD_ICON.href;
  cv.setAttribute('download', '');
  cv.setAttribute('aria-label', 'Descargar CV en PDF');
  cv.innerHTML = `<span class="desk-glyph">${ICONS.pdf}</span><span class="desk-name">${DOWNLOAD_ICON.file}</span>`;
  frag.appendChild(cv);

  iconsEl.appendChild(frag);
}

function selectIcon(btn) {
  iconsEl.querySelectorAll('.desk-icon.is-selected').forEach((b) => b.classList.remove('is-selected'));
  if (btn) btn.classList.add('is-selected');
}

iconsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button.desk-icon');
  if (!btn) return;
  selectIcon(btn);
  // Táctil o teclado (detail === 0): un toque abre. Ratón: doble clic, como en Windows.
  if (isCoarse() || e.detail === 0) openWindow(btn.dataset.id);
});
iconsEl.addEventListener('dblclick', (e) => {
  const btn = e.target.closest('button.desk-icon');
  if (btn) openWindow(btn.dataset.id);
});
$('#desktop').addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.desk-icon')) selectIcon(null);
});

/* ---------- Ventanas ---------- */
function openWindow(id) {
  closeStart();
  const existing = openWindows.get(id);
  if (existing) {
    if (existing.minimized) restoreWindow(id);
    else focusWindow(id);
    return;
  }

  const section = SECTIONS.find((s) => s.id === id);
  if (!section) return;

  const win = document.createElement('section');
  win.className = 'window is-opening';
  win.dataset.id = id;
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', section.label);
  win.tabIndex = -1;
  win.innerHTML = `
    <div class="titlebar">
      <span class="title-icon icon-${section.icon}">${ICONS[section.icon]}</span>
      <span class="title-text">${section.file}</span>
      <div class="title-actions">
        <button class="tb-btn" data-action="min" aria-label="Minimizar">${UI.min}</button>
        <button class="tb-btn tb-max" data-action="max" aria-label="Maximizar">${UI.max}</button>
        <button class="tb-btn tb-close" data-action="close" aria-label="Cerrar">${UI.close}</button>
      </div>
    </div>
    <div class="window-body">${section.body()}</div>`;

  // Posición inicial en cascada, centrada en el área útil
  if (!isCompact()) {
    const area = windowsEl.getBoundingClientRect();
    const w = Math.min(section.width, area.width - 48);
    const h = section.height ? Math.min(section.height, area.height - 32) : Math.min(area.height * 0.78, 720);
    const offset = (cascade++ % 5) * 32;
    win.style.width = `${w}px`;
    win.style.height = `${h}px`;
    win.style.left = `${Math.max(16, (area.width - w) / 2 + offset - 64)}px`;
    win.style.top = `${Math.max(16, (area.height - h) / 2 + offset - 48)}px`;
  }

  windowsEl.appendChild(win);
  section.onMount?.(win.querySelector('.window-body'));

  const task = document.createElement('button');
  task.className = 'task-item';
  task.dataset.id = id;
  task.setAttribute('aria-label', section.label);
  task.title = section.file;
  task.innerHTML = `<span class="task-glyph icon-${section.icon}">${ICONS[section.icon]}</span><span class="task-name">${section.label}</span>`;
  taskItemsEl.appendChild(task);
  requestAnimationFrame(() => task.classList.add('is-in'));

  openWindows.set(id, { el: win, task, minimized: false, maximized: false });
  focusWindow(id);

  win.addEventListener('animationend', () => win.classList.remove('is-opening'), { once: true });
  if (reduceMotion()) win.classList.remove('is-opening');

  win.addEventListener('pointerdown', () => focusWindow(id));
  win.querySelector('.title-actions').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') closeWindow(id);
    if (action === 'min') minimizeWindow(id);
    if (action === 'max') toggleMaximize(id);
  });
  win.querySelector('.titlebar').addEventListener('dblclick', (e) => {
    if (!e.target.closest('.title-actions')) toggleMaximize(id);
  });
  enableDrag(win, id);
}

function focusWindow(id) {
  const w = openWindows.get(id);
  if (!w) return;
  openWindows.forEach((o) => {
    o.el.classList.remove('is-active');
    o.task.classList.remove('is-active');
  });
  w.el.style.zIndex = ++zTop;
  w.el.classList.add('is-active');
  w.task.classList.add('is-active');
  if (!w.el.contains(document.activeElement)) w.el.focus({ preventScroll: true });
}

function topmostVisible() {
  let best = null;
  openWindows.forEach((o, id) => {
    if (o.minimized) return;
    if (!best || Number(o.el.style.zIndex) > Number(best.o.el.style.zIndex)) best = { id, o };
  });
  return best?.id ?? null;
}

function closeWindow(id) {
  const w = openWindows.get(id);
  if (!w) return;
  openWindows.delete(id);
  w.task.classList.remove('is-in');
  w.task.addEventListener('transitionend', () => w.task.remove(), { once: true });
  setTimeout(() => w.task.remove(), 400);

  const finish = () => {
    w.el.remove();
    const next = topmostVisible();
    if (next) focusWindow(next);
  };
  if (reduceMotion() || w.minimized) return finish();
  w.el.classList.add('is-closing');
  w.el.addEventListener('animationend', finish, { once: true });
}

function minimizeWindow(id) {
  const w = openWindows.get(id);
  if (!w || w.minimized) return;
  w.minimized = true;
  w.task.classList.remove('is-active');
  w.task.classList.add('is-minimized');

  // Animación hacia el botón de la barra de tareas
  const wr = w.el.getBoundingClientRect();
  const tr = w.task.getBoundingClientRect();
  const dx = tr.left + tr.width / 2 - (wr.left + wr.width / 2);
  const dy = tr.top - (wr.top + wr.height / 2);
  w.el.style.setProperty('--min-x', `${dx}px`);
  w.el.style.setProperty('--min-y', `${dy}px`);
  w.el.classList.add('is-minimizing');

  const done = () => {
    w.el.classList.remove('is-minimizing', 'is-active');
    w.el.hidden = true;
    const next = topmostVisible();
    if (next) focusWindow(next);
  };
  if (reduceMotion()) return done();
  w.el.addEventListener('animationend', done, { once: true });
}

function restoreWindow(id) {
  const w = openWindows.get(id);
  if (!w) return;
  w.minimized = false;
  w.el.hidden = false;
  w.task.classList.remove('is-minimized');
  w.el.classList.add('is-restoring');
  w.el.addEventListener('animationend', () => w.el.classList.remove('is-restoring'), { once: true });
  if (reduceMotion()) w.el.classList.remove('is-restoring');
  focusWindow(id);
}

function toggleMaximize(id) {
  const w = openWindows.get(id);
  if (!w || isCompact()) return;
  w.maximized = !w.maximized;
  w.el.classList.toggle('is-maximized', w.maximized);
  const btn = w.el.querySelector('.tb-max');
  btn.innerHTML = w.maximized ? UI.restore : UI.max;
  btn.setAttribute('aria-label', w.maximized ? 'Restaurar' : 'Maximizar');
}

function enableDrag(win, id) {
  const bar = win.querySelector('.titlebar');
  let start = null;

  bar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.title-actions') || isCompact()) return;
    if (openWindows.get(id)?.maximized) return;
    start = { x: e.clientX, y: e.clientY, left: win.offsetLeft, top: win.offsetTop };
    bar.setPointerCapture(e.pointerId);
    win.classList.add('is-dragging');
  });

  bar.addEventListener('pointermove', (e) => {
    if (!start) return;
    const area = windowsEl.getBoundingClientRect();
    const left = Math.min(Math.max(start.left + e.clientX - start.x, -win.offsetWidth + 120), area.width - 120);
    const top = Math.min(Math.max(start.top + e.clientY - start.y, 0), area.height - 48);
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  });

  const end = () => {
    start = null;
    win.classList.remove('is-dragging');
  };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
}

/* ---------- Barra de tareas ---------- */
taskItemsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.task-item');
  if (!btn) return;
  const id = btn.dataset.id;
  const w = openWindows.get(id);
  if (!w) return;
  if (w.minimized) restoreWindow(id);
  else if (w.el.classList.contains('is-active')) minimizeWindow(id);
  else focusWindow(id);
});

/* ---------- Menú Inicio ---------- */
function openStart() {
  startMenu.hidden = false;
  requestAnimationFrame(() => startMenu.classList.add('is-open'));
  startBtn.setAttribute('aria-expanded', 'true');
  startBtn.classList.add('is-active');
}
function closeStart() {
  if (startMenu.hidden) return;
  startMenu.classList.remove('is-open');
  startBtn.setAttribute('aria-expanded', 'false');
  startBtn.classList.remove('is-active');
  setTimeout(() => {
    if (!startMenu.classList.contains('is-open')) startMenu.hidden = true;
  }, 220);
}
startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startMenu.hidden ? openStart() : closeStart();
});
document.addEventListener('pointerdown', (e) => {
  if (!startMenu.hidden && !startMenu.contains(e.target) && !startBtn.contains(e.target)) closeStart();
});

// Cualquier elemento con data-open abre una sección (menú Inicio, botones internos)
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-open]');
  if (trigger) openWindow(trigger.dataset.open);
});

/* ---------- Teclado ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!startMenu.hidden) return closeStart();
    const active = [...openWindows.entries()].find(([, o]) => o.el.classList.contains('is-active') && !o.minimized);
    if (active) closeWindow(active[0]);
  }
});

/* ---------- Reloj ---------- */
const clockEl = $('#clock');
function tick() {
  const now = new Date();
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  clockEl.dateTime = now.toISOString();
  clockEl.innerHTML = `<span>${time}</span><span>${date}</span>`;
}
tick();
setInterval(tick, 15000);

/* ---------- Inicio ---------- */
renderDesktopIcons();
// En escritorio se abre la presentación para dar contexto al visitante
if (!isCompact()) setTimeout(() => openWindow('about'), 450);
