/* Banco de pruebas del administrador (Playwright + Chromium).
   - Sirve una carpeta real por HTTP (como Live Server).
   - Sustituye showDirectoryPicker por un "handle" con la misma API que
     FileSystemDirectoryHandle pero respaldado por una carpeta REAL del disco
     (el selector nativo de carpetas no se puede automatizar).
   - Puede simular el script de recarga automática que Live Server inyecta en las páginas. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.txt': 'text/plain' };

// Fragmento que inyecta Live Server (live-server / ritwickdey.LiveServer) antes de </body>
const LIVE_SNIPPET = `<!-- Code injected by live-server -->
<script>
if ('WebSocket' in window) { (function () {
  var protocol = window.location.protocol === 'http:' ? 'ws://' : 'wss://';
  var address = protocol + window.location.host + window.location.pathname + '/ws';
  var socket = new WebSocket(address);
  socket.onmessage = function (msg) { if (msg.data == 'reload') window.location.reload(); };
})(); }
</script>`;

function startServer(root, { liveSnippet = false } = {}) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let p = path.join(root, u);
    if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
    let body = fs.readFileSync(p);
    if (liveSnippet && p.endsWith('.html')) body = Buffer.from(body.toString().replace('</body>', LIVE_SNIPPET + '</body>'));
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port })));
}

// Copia un proyecto a una carpeta temporal
function cloneProject(src) {
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
  fs.cpSync(src, dst, { recursive: true });
  return dst;
}

const SHIM = `(() => {
  const call = (...a) => window.__fs(...a);
  const err = (name, msg) => new DOMException(msg || name, name);
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  class FileH {
    constructor(root, rel, name) { this.kind = 'file'; this.root = root; this.rel = rel; this.name = name; }
    async getFile() { const r = await call('read', this.root, this.rel); if (!r) throw err('NotFoundError'); return new File([Uint8Array.from(atob(r.b64), (c) => c.charCodeAt(0))], this.name); }
    async createWritable() {
      await call('hook', 'create', this.root, this.rel);
      const chunks = []; const self = this;
      return {
        async write(d) { chunks.push(typeof d === 'string' ? new TextEncoder().encode(d) : new Uint8Array(await d.arrayBuffer())); },
        async close() { await call('hook', 'close', self.root, self.rel); let n = 0; chunks.forEach((c) => n += c.length); const all = new Uint8Array(n); let o = 0; chunks.forEach((c) => { all.set(c, o); o += c.length; }); await call('write', self.root, self.rel, b64(all)); },
        async abort() {},
      };
    }
  }
  class DirH {
    constructor(root, rel, name) { this.kind = 'directory'; this.root = root; this.rel = rel; this.name = name; }
    #j(n) { return this.rel ? this.rel + '/' + n : n; }
    async getDirectoryHandle(n, o) { const t = await call('type', this.root, this.#j(n)); if (t === 'file') throw err('TypeMismatchError'); if (!t) { if (o && o.create) await call('mkdir', this.root, this.#j(n)); else throw err('NotFoundError'); } return new DirH(this.root, this.#j(n), n); }
    async getFileHandle(n, o) { const t = await call('type', this.root, this.#j(n)); if (t === 'dir') throw err('TypeMismatchError'); if (!t) { if (o && o.create) await call('write', this.root, this.#j(n), ''); else throw err('NotFoundError'); } return new FileH(this.root, this.#j(n), n); }
    async removeEntry(n) { const ok = await call('rm', this.root, this.#j(n)); if (!ok) throw err('NotFoundError'); }
    async *values() { const l = await call('ls', this.root, this.rel); for (const e of l) yield e.kind === 'dir' ? new DirH(this.root, this.#j(e.name), e.name) : new FileH(this.root, this.#j(e.name), e.name); }
    async queryPermission() { return window.__perm || 'granted'; }
    async requestPermission() { return window.__perm || 'granted'; }
  }
  window.__DirH = DirH;
  window.__pickTarget = null;
  window.showDirectoryPicker = async () => { if (!window.__pickTarget) throw err('AbortError'); return new DirH(window.__pickTarget, '', window.__pickTarget.split(/[\\\\/]/).pop()); };
})();`;

async function openAdmin({ projectDir, serveDir, liveReload = false, noFSA = false, hooks = {} }) {
  const { srv, port } = await startServer(serveDir || projectDir, { liveSnippet: liveReload });
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true });
  const wsClients = [];
  const log = { writes: [], reloads: 0 };
  const onFs = async (_s, op, a, b, c) => {
    if (op === 'hook') { // a = 'create'|'close', b = raíz, c = ruta relativa
      if (hooks.failOn && hooks.failOn(a, c)) throw Object.assign(new Error('fallo simulado de escritura'), { name: 'NoModificationAllowedError' });
      return true;
    }
    const root = a, rel = b, data = c;
    const abs = path.join(root, rel || '');
    switch (op) {
      case 'type': return fs.existsSync(abs) ? (fs.statSync(abs).isDirectory() ? 'dir' : 'file') : null;
      case 'mkdir': fs.mkdirSync(abs, { recursive: true }); return true;
      case 'read': return fs.existsSync(abs) && fs.statSync(abs).isFile() ? { b64: fs.readFileSync(abs).toString('base64') } : null;
      case 'write': {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, Buffer.from(data || '', 'base64'));
        log.writes.push(rel);
        if (hooks.afterWrite) await hooks.afterWrite(rel, { wsClients, log });
        return true;
      }
      case 'rm': if (!fs.existsSync(abs)) return false; fs.rmSync(abs, { recursive: true }); return true;
      case 'ls': return fs.readdirSync(abs, { withFileTypes: true }).map((d) => ({ name: d.name, kind: d.isDirectory() ? 'dir' : 'file' }));
    }
  };
  await context.exposeBinding('__fsRaw', onFs);
  await context.addInitScript('window.__fs = (...a) => window.__fsRaw(...a);');
  if (!noFSA) await context.addInitScript(SHIM); else await context.addInitScript('delete window.showDirectoryPicker;');
  await context.addInitScript(`window.__perm = 'granted';`);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.routeWebSocket(/\/ws$/, (ws) => { wsClients.push(ws); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) log.reloads++; });
  const base = `http://127.0.0.1:${port}`;
  await page.goto(`${base}/admin-local/admin.html`);
  await page.waitForSelector('#statusbar .stext');
  return { page, browser, context, srv, port, base, log, errors, wsClients, close: async () => { await browser.close(); srv.close(); } };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'sources/projects/projects.json'), 'utf8'));
const exists = (dir, rel) => fs.existsSync(path.join(dir, rel));

// Crea archivos de prueba
function makeFiles(n = 3) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'up-'));
  // PNG 1x1 válido
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const out = [];
  for (let i = 1; i <= n; i++) {
    const f = path.join(d, i === 1 ? `memoria ${i}.txt` : i === 2 ? `captura ${i}.png` : `datos ${i}.csv`);
    fs.writeFileSync(f, i === 2 ? png : `contenido de prueba número ${i}\n`.repeat(10 * i));
    out.push(f);
  }
  return out;
}

module.exports = { openAdmin, cloneProject, startServer, sleep, readJson, exists, makeFiles, chromium };
