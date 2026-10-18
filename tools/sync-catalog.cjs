#!/usr/bin/env node
/* Portafolio · Xiang Su Liu — sincroniza la copia JS del catálogo
   Uso (desde la raíz del repo):
     node tools/sync-catalog.cjs            genera/actualiza sources/projects/projects.data.js
     node tools/sync-catalog.cjs --check    no escribe: sale con error si la copia falta o no coincide con projects.json

   projects.json es la ÚNICA fuente. projects.data.js es una copia generada (solo para abrir la web con file://,
   donde el navegador no permite fetch()). «Guardar y publicar en local» del administrador ya la regenera; esta
   herramienta sirve cuando editas projects.json a mano o publicas con «Exportar ZIP». Sin dependencias. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'sources/projects/projects.json');
const JS_PATH = path.join(ROOT, 'sources/projects/projects.data.js');
const MARK = 'GENERADO AUTOMÁTICAMENTE';
const check = process.argv.includes('--check');
const fail = (msg) => { console.error(`✘ ${msg}`); process.exit(1); };

if (!fs.existsSync(JSON_PATH)) fail(`No existe ${path.relative(ROOT, JSON_PATH)}. Publica algún proyecto desde el administrador primero.`);
const text = fs.readFileSync(JSON_PATH, 'utf8');
let data;
try { data = JSON.parse(text); } catch (e) { fail(`projects.json no es JSON válido (${e.message}). No se ha tocado nada.`); }
const list = Array.isArray(data) ? data : data && data.projects;
if (!Array.isArray(list)) fail('projects.json no tiene el formato esperado: { "projects": [ … ] }. No se ha tocado nada.');

// Misma cabecera y formato que admin-local/admin.js (serializeCatalogJs)
const js = `/* ${MARK} desde sources/projects/projects.json — NO EDITAR A MANO.
   Copia de solo lectura para abrir la web con file:// (el navegador no permite fetch() de archivos locales).
   Con un servidor (Live Server, GitHub Pages) la web lee projects.json y NO usa este archivo.
   Se regenera al pulsar «Guardar y publicar en local» o con: node tools/sync-catalog.cjs */
window.__PORTFOLIO_CATALOG__ = ${text.trim().replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};
`;

const current = fs.existsSync(JS_PATH) ? fs.readFileSync(JS_PATH, 'utf8') : null;
if (check) {
  if (current === null) fail('Falta sources/projects/projects.data.js (la web abierta con file:// no mostrará proyectos). Ejecuta: node tools/sync-catalog.cjs');
  if (current !== js) fail('projects.data.js NO coincide con projects.json (la web abierta con file:// mostraría datos antiguos). Ejecuta: node tools/sync-catalog.cjs');
  console.log(`✔ projects.data.js coincide con projects.json (${list.length} proyectos).`);
  process.exit(0);
}
if (current !== null && current.trim() && !current.includes(MARK)) {
  const bak = `${JS_PATH}.bak`;
  fs.copyFileSync(JS_PATH, bak);
  console.warn(`! El projects.data.js existente no estaba generado por esta herramienta: copia de seguridad en ${path.relative(ROOT, bak)}`);
}
if (current === js) { console.log(`✔ Ya estaba al día (${list.length} proyectos).`); process.exit(0); }
fs.writeFileSync(JS_PATH, js);
console.log(`✔ Escrito ${path.relative(ROOT, JS_PATH)} (${list.length} proyectos).`);
