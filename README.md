# Portfolio · Xiang Su Liu — web pública + administrador local (fase 1.6: parpadeo y orejas animados)

## Estructura
```
index.html, css/, js/, sources/   ← WEB PÚBLICA (incluye el gato: js/cat.js, js/assistant.js, js/search.js, css/cat.css, css/assistant.css) (lo que se despliega en GitHub Pages)
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

## Gato asistente (fase 1.4)
Un gato pixel art sobre el título «Xiang Su Liu». Al hacer clic (o Tab + Enter) abre una ventana del escritorio con un buscador de proyectos.

**Archivos**
- `js/cat.js` + `css/cat.css`: sprite, posición, parpadeo, saludo y mensajes ocasionales.
- `js/assistant.js` + `css/assistant.css`: ventana del asistente (se registra en `app.js` como sección oculta `assistant`, con el sistema de ventanas de siempre).
- `js/search.js`: lógica de búsqueda pura (sin DOM, sin red).
- Pequeños cambios en `index.html` (gato + enlaces), `js/app.js` (sección oculta, icono, `height` opcional) y `js/projects.js` (`Projects.getCatalog / reveal / canPreview`). El administrador y `css/styles.css`/`css/projects.css` no se han tocado.

**Cómo busca**: usa el mismo catálogo ya cargado por `projects.js` (solo publicados). Ignora mayúsculas, tildes y espacios; admite varias palabras (deben cumplirse todas; si ninguno las cumple todas, enseña los parciales y lo avisa); prefijos («servidor dh» → DHCP); plurales sencillos; sinónimos (web↔página↔sitio, juegos↔videojuegos, redes↔network…, en `SYNONYM_GROUPS`). Campos y pesos: título > etiquetas > categoría > descripción/archivos/enlaces/tipo/fecha (`CONFIG.weights`). El esquema real no tiene un campo «tecnologías»: se buscan en las etiquetas.

**Abrir un proyecto**: abre/restaura la ventana «Proyectos», resalta la tarjeta y, si el archivo tiene vista previa (imagen, PDF, texto…), abre el visor existente.

**Cambiar el gato**
- Dibujo/colores: `SPRITE` y `PALETTE` en `js/cat.js` (16×16, una letra por píxel). Para un PNG propio: `CONFIG.imageUrl`.
- Tamaño: `--cat-size` en `.cat-slot` de `css/cat.css` (múltiplos de 16: 48, 64, 80).
- Posición: `--cat-right` (distancia al borde derecho del título) y `--cat-gap` (separación con el título).
- Mensajes y frecuencia: `GREETING`, `TIPS` y `CONFIG` en `js/cat.js`.

**Pantallas de poca altura**: la nota adhesiva original ocupa ese sitio. Si el gato chocaría con ella, `cat.js` lo reduce a 48 px y lo aparta (margen derecho; en ≤1180 px, extremo izquierdo del título) y no muestra globos. La nota no se mueve.

**Pruebas del gato**: `admin-local/tests/gato/` (`suite.cjs`, `grid.cjs`; `BASELINE=<copia sin gato>` activa la comparación de posiciones). Requieren Playwright + Chromium.

## Fase 1.5 — búsqueda progresiva y apertura sin Live Server

### Búsqueda mientras escribes
Los resultados se actualizan en cada pulsación (una búsqueda por fotograma como máximo), también al borrar; Enter y el botón siguen funcionando. Cada resultado tiene un **nivel**: 1 el título empieza por la consulta · 2 una palabra del título empieza por ella · 3 el título la contiene · 4 etiquetas/categoría · 5 descripción, archivos, enlaces y otros metadatos (dentro de cada nivel manda la puntuación por campos). Una letra ya basta (`p`). Se mantienen tildes/mayúsculas/espacios, sinónimos y «todas las palabras en cualquier campo». La ventana no se reconstruye: se reutilizan el campo, la lista y las tarjetas que no cambian.

### Abrir `index.html` con doble clic (file://)
Chromium, Firefox y Safari **bloquean `fetch()` de archivos locales**, así que `projects.json` no se puede leer con `file://`. Solución: `projects.json` sigue siendo la ÚNICA fuente y de él se genera una copia de solo lectura, `sources/projects/projects.data.js` (`window.__PORTFOLIO_CATALOG__ = {…}`), que un `<script>` sí puede cargar.
- **Con servidor** (Live Server, GitHub Pages): la web lee `projects.json` como siempre y **nunca** carga la copia (así una copia vieja no puede mostrar datos antiguos).
- **Con `file://`**: `projects.js` carga la copia inyectando el `<script>` solo en ese caso.
- **Se actualiza sola** al pulsar «Guardar y publicar en local» (se escribe tras `projects.json`, se relee y se compara; si falla, `projects.json` queda bien guardado y se avisa) y viene dentro del ZIP de «Exportar ZIP». Nunca sobrescribe un `projects.data.js` que no lleve la marca «GENERADO AUTOMÁTICAMENTE».
- **Paso manual** (solo si editas `projects.json` a mano o publicas por otra vía): `node tools/sync-catalog.cjs` regenera la copia; `node tools/sync-catalog.cjs --check` sale con error si falta o está desactualizada. Haz `git add sources/projects/projects.data.js` junto con `projects.json` (ambos se suben).
- Si la copia falta o está mal formada, el asistente y la ventana Proyectos muestran un error de carga específico (no «sin resultados»).

### Qué NO funciona con file:// (limitación del navegador, no simulada)
- **Vista previa de texto/código** (`.txt`, `.py`, `.sql`…) y las miniaturas de código: requieren `fetch()`; se muestra un mensaje y queda la descarga.
- **Administrador**: `admin-local/admin.html` abre con `file://`, pero no puede importar el catálogo actual por HTTP ni hacer la comprobación «servidor ve lo mismo»; el guardado directo en carpeta depende del permiso del navegador (la API de carpetas) y no se ha podido probar con `file://` en un navegador real.
- Las fuentes de Google Fonts de la web original siguen pidiéndose a Google si hay conexión (ya era así; sin conexión se usa la fuente del sistema).
- Imágenes, portadas, vídeo, descargas, enlaces y el visor de imágenes sí funcionan con `file://`.

### Pruebas
`admin-local/tests/gato/`: `suite.cjs` (gato/asistente), `suite2.cjs` (búsqueda progresiva, file://, herramienta), `admin-datajs.cjs` (administrador ↔ copia JS), `grid.cjs`. Requieren Playwright + Chromium.

## Fase 1.6 — animación del gato (parpadeo y orejas)
El gato sigue siendo el mismo sprite (`SPRITE` y `PALETTE` de `js/cat.js`, sin tocar). Ahora tiene **fotogramas reales** de las piezas que se mueven (`PARTS` en `js/cat.js`): ojos abiertos/cerrados, oreja izquierda y oreja derecha (en reposo = el sprite original; inclinada = otro fotograma del mismo sprite). Un temporizador cambia `data-f` (0 reposo / 1 pose) y `css/cat.css` muestra solo el fotograma activo; nada se escala ni se desplaza y el contenedor del gato no se toca.
- **Parpadeo:** ojos abiertos 2–4,2 s (aleatorio), cerrados 150–220 ms (rayita oscura de 3 píxeles), y un 22 % de las veces parpadea dos veces seguidas. Ajustable en `ANIM` (`js/cat.js`).
- **Orejas** (bucle independiente del parpadeo): cada 1,8–5,2 s una oreja se inclina 260–420 ms y vuelve; la otra reacciona con retraso (120–220 ms) el 60 % de las veces; el 35 % de las veces ambas se sacuden (2 vaivenes rápidos).
- **Reducir movimiento / pestaña oculta:** no hay temporizadores y todo queda en reposo (la cola también se detiene).
- Para cambiar una pose, edita las filas de `PARTS`. El contorno es del mismo azul que el fondo del escritorio, por lo que una inclinación solo se aprecia por el pelaje y el rosa que se desplazan.
- Pruebas: `admin-local/tests/gato/suite3.cjs`.
