# Portfolio · Xiang Su Liu — web pública + administrador local (fase 1.3: guardado directo reparado)

## Estructura
```
index.html, css/, js/, sources/   ← WEB PÚBLICA (lo que se despliega en GitHub Pages)
sources/projects/projects.json    ← catálogo público (lo escribe el administrador)
sources/projects/<proyecto>/…     ← archivos de cada proyecto publicado
admin-local/                      ← ADMINISTRADOR LOCAL (ignorado por Git, nunca se sube)
```

## Uso habitual (Chrome, Edge o Brave con la API activada)
1. Abre `admin-local/admin.html` (con Live Server, o directamente en el navegador; con Live Server además se importa el catálogo actual por HTTP).
2. Pulsa **«Seleccionar carpeta del portfolio»** y elige la **raíz** del repo (la que contiene `index.html` y `js/projects.js`). El navegador te pedirá permiso: acéptalo. Si la carpeta no es la correcta, el administrador la rechaza.
3. Crea o edita proyectos: título, descripción, categoría, etiquetas, archivos, imágenes (portada) y enlaces. Los borradores se guardan solos en el navegador.
4. Marca como **Publicado** los que quieras mostrar (interruptor del proyecto o casilla de la lista). En la pestaña «Publicados» puedes cambiar el orden con ▲▼.
5. Pulsa **«Guardar y publicar en local»**. Se escriben los archivos nuevos en `sources/projects/<proyecto>/` y después `sources/projects/projects.json`. La barra superior indica: carpeta conectada, cambios pendientes, guardando, guardado correcto o error. El mensaje verde «Publicado y verificado (disco y servidor)» solo aparece cuando todo se ha releído y comprobado.
6. Abre el portfolio con un servidor local (Live Server) y verás los proyectos. Para subirlo a GitHub: `git add . && git commit && git push` (manual).

El navegador recuerda la carpeta; tras reiniciar puede pedir de nuevo permiso («Reconectar carpeta»).

## Live Server y Brave (importante)
- **Live Server recarga todas las páginas cuando cambia cualquier archivo de la carpeta**, también `admin.html`. Antes eso interrumpía «Guardar y publicar» tras el primer archivo (quedaba 1 de 3 archivos y `projects.json` vacío). Ahora `admin.html` ignora esa recarga mientras guarda, y si la página se recarga igualmente, el siguiente intento continúa sin duplicar archivos. La web pública sí se recarga sola (o pulsa F5).
- Opcional: en `.vscode/settings.json` puedes añadir `"liveServer.settings.ignoreFiles": ["admin-local/**"]` para que Live Server ni siquiera recargue el administrador.
- **Brave desactiva por defecto la API de carpetas.** Si ves el aviso en la barra de estado: abre `brave://flags/#file-system-access-api`, ponla en *Enabled*, reinicia Brave y recarga el administrador. Si no quieres tocarlo, usa **Exportar ZIP**.
- Tras guardar, el administrador comprueba por HTTP que el servidor desde el que abriste la página sirve el mismo `projects.json` y los mismos archivos. Si no coinciden, te avisa: casi siempre significa que elegiste otra copia de la carpeta distinta de la que tienes abierta en VS Code.

## Seguridad al guardar
- Primero se escriben y verifican los archivos (se releen y se comparan byte a byte); después se comprueba que todo lo que referencia el catálogo existe; **`projects.json` se escribe al final**, se relee y se valida. Si algo falla, se muestra el error, la publicación NO se da por completada y `projects.json` no se toca.
- Nunca se deja el catálogo vacío por accidente: si el nuevo catálogo estaría vacío y el actual no, pide confirmación; si el `projects.json` actual no es JSON válido, no se sobrescribe; si la carpeta tiene proyectos que el administrador no conocía, los importa antes de publicar.
- Nunca se sobrescribe un archivo que no haya creado el administrador: si ya existe uno con el mismo nombre, el nuevo se guarda como `nombre-2.ext`.
- Solo se escribe dentro de `sources/projects/`; se rechazan rutas con `..`, barras invertidas o caracteres no válidos.
- Despublicar o eliminar un proyecto lo quita del catálogo, pero **no borra archivos del disco**. Al eliminar, hay una casilla opcional para borrar los archivos que guardó este administrador (con confirmación).

## Limitaciones del navegador (File System Access API)
- Solo **Chrome, Edge y derivados de Chromium** (en ordenador). Firefox y Safari no la incluyen: allí usa **Exportar ZIP** (se conserva como alternativa) y descomprímelo sobre la raíz del repo.
- Hay que elegir la carpeta tú mismo y conceder permiso; el navegador puede bloquear carpetas del sistema (Escritorio entero, Documentos, etc.): elige la carpeta del proyecto.
- El permiso puede caducar al cerrar el navegador; se vuelve a conceder con un clic.
- Los borradores y archivos del administrador viven en IndexedDB del navegador, ligados a la dirección exacta (p. ej. `127.0.0.1:5500`). Haz **copias de seguridad** (botón «Copia de seguridad»); la restauración avisa antes de sustituir proyectos.

## Pruebas
`admin-local/tests/` (no se publica) contiene la batería usada para reparar el guardado: `NODE_PATH=$(npm root -g) node run-tests.cjs` (requiere Playwright + Chromium). Usa una carpeta real de disco detrás de la API de carpetas y simula la recarga de Live Server. No sustituye una prueba manual con el selector de carpetas real de tu navegador.

## Cambios de esta fase
- `admin-local/admin.js`: guardado por proyecto (sin pérdidas), publicación reanudable y verificada, comprobación de carpeta y de servidor, avisos de Brave/API no disponible.
- `admin-local/admin.html`: protección frente a la recarga de Live Server mientras se guarda.
- `js/projects.js`: errores de carga distinguibles (404, JSON inválido, red) con detalle en consola; imágenes rotas con marcador; ignora borradores.
- Sin cambios: `index.html`, `js/app.js`, `css/*`, CV, `admin.css`.
