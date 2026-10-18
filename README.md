# Portfolio · Xiang Su Liu

Portafolio personal de **Xiang Su Liu**, estudiante de 2º de ASIR (Administración de Sistemas Informáticos en Red). La web simula un **escritorio de ordenador**: iconos, ventanas, menú Inicio, barra de tareas y una nota adhesiva de bienvenida. Además incluye un **gato de pixel art** que ayuda a buscar proyectos.

> ## Hecho con ayuda de la IA
> Este proyecto se ha desarrollado **con ayuda de inteligencia artificial** (Claude, de Anthropic). La IA ha colaborado en el código del escritorio, el catálogo de proyectos, el administrador local, el gato, el buscador, la compatibilidad con `file://` y las pruebas automáticas. El contenido personal (textos, datos, currículum y proyectos) es del autor, que revisa y decide qué se publica.

---

## Qué incluye

### Web pública
- **Escritorio con ventanas**: se abren con doble clic (o toque en móvil), se pueden mover, minimizar, maximizar y cerrar. Tiene menú Inicio, barra de tareas con reloj y adaptación a pantallas pequeñas.
- **Secciones**: Sobre mí, Habilidades técnicas, Contacto y perfil, Proyectos, Educación e idiomas, Experiencia laboral y currículum en PDF (abrir o descargar).
- **Proyectos**: ventana con tarjetas (título, descripción, categoría, etiquetas, portada). Cada proyecto puede tener archivos, imágenes y enlaces, con visor integrado para imágenes, PDF, vídeo y texto.
- **Sin servicios externos**: no usa backend, bases de datos, APIs ni IA en funcionamiento. Todo se ejecuta en el navegador. La única petición externa es la de las fuentes de Google Fonts (si no hay conexión se usa la fuente del sistema).

### Gato asistente
- Gato de **pixel art** sobre el título. Se abre con clic o con teclado (Tab + Enter).
- Abre una ventana del escritorio con un **buscador de proyectos**.
- **Búsqueda mientras escribes**, sin pulsar Enter. Funciona con una sola letra.
- Ignora mayúsculas, tildes y espacios; acepta varias palabras y sinónimos sencillos (web ↔ página ↔ sitio, juegos ↔ videojuegos, redes ↔ network…).
- Busca en título, etiquetas, categoría, descripción, nombres de archivos, enlaces y otros metadatos. Ordena por relevancia (primero los títulos que empiezan por lo escrito).
- Muestra **solo proyectos publicados** (nunca borradores) y usa el mismo catálogo que la ventana Proyectos: no hay una segunda lista.
- Distingue «sin resultados» de «no se pudo cargar el catálogo» (con botón Reintentar).
- Al elegir un resultado, abre la ventana Proyectos, resalta la tarjeta y abre el visor si el archivo tiene vista previa.
- **Animado**: parpadea y mueve las orejas con fotogramas del propio sprite. Se detiene si el usuario tiene activado «reducir movimiento».
- Saludo discreto la primera vez y algún mensaje ocasional (pocos, sin sonido). En pantallas de poca altura se aparta para no tapar la nota adhesiva.

### Administrador local (solo en tu ordenador)
Herramienta en `admin-local/` para gestionar los proyectos sin tocar JSON a mano. **No se sube a GitHub** (está en `.gitignore`).
- Crear y editar proyectos: título, descripción, categoría, etiquetas, archivos, imágenes, portada y enlaces. Los borradores se guardan solos en el navegador.
- Marcar proyectos como **Publicado** y ordenarlos.
- **«Guardar y publicar en local»**: escribe los archivos en `sources/projects/<proyecto>/` y después `projects.json`. Verifica todo releyéndolo y no deja el catálogo vacío por accidente.
- Nunca sobrescribe archivos que no haya creado él (si existe uno igual, guarda `nombre-2.ext`) y solo escribe dentro de `sources/projects/`.
- Copias de seguridad y **Exportar ZIP** como alternativa para navegadores sin la API de carpetas.

---

## Estructura

```
index.html              página principal (escritorio)
css/                    estilos (escritorio, proyectos, gato, asistente)
js/
  app.js                escritorio, ventanas, menú Inicio y barra de tareas
  projects.js           catálogo y ventana Proyectos
  search.js             lógica del buscador (sin tocar la pantalla)
  assistant.js          ventana del asistente
  cat.js                gato: sprite, animación y mensajes
sources/
  cv_xiang_su_liu.pdf   currículum
  projects/
    projects.json       catálogo público (lo escribe el administrador)
    projects.data.js    copia generada del catálogo, para abrir con file://
    <proyecto>/…        archivos de cada proyecto
tools/
  sync-catalog.cjs      regenera projects.data.js (opcional)
admin-local/            administrador local (NO se sube a GitHub)
```

---

## Cómo usarlo

### Ver la web
- **Con servidor** (recomendado): Live Server de VS Code, o GitHub Pages una vez desplegado.
- **Con doble clic** en `index.html` (`file://`): funciona gracias a `projects.data.js`. Ver «Limitaciones».

### Publicar proyectos
1. Abre `admin-local/admin.html` (con Live Server, o directamente en el navegador).
2. Pulsa **«Seleccionar carpeta del portfolio»** y elige la carpeta raíz (la que contiene `index.html`). Acepta el permiso del navegador.
3. Crea o edita proyectos y márcalos como **Publicado**.
4. Pulsa **«Guardar y publicar en local»**. Se actualizan `projects.json` y `projects.data.js`.
5. Comprueba la web en local y sube los cambios: `git add . && git commit -m "…" && git push`.

### Qué subir a GitHub
Todo lo de la raíz excepto `admin-local/` (ya ignorada). Sube `projects.json` **y** `projects.data.js` juntos.

### Si editas `projects.json` a mano
Ejecuta `node tools/sync-catalog.cjs` para regenerar la copia. Con `--check` solo comprueba si está al día.

---

## Cómo funciona el catálogo

`projects.json` es la **única fuente de datos**. Con un servidor, la web lo lee directamente. Si se abre con `file://`, los navegadores bloquean la lectura de archivos locales (`fetch`), así que la web usa `projects.data.js`, una copia **generada automáticamente** (no se edita a mano). Con servidor esa copia **no se usa**, para que una versión vieja nunca pueda mostrar datos antiguos.

Solo se muestran los proyectos marcados como publicados; los borradores no llegan a la web pública.

---

## Limitaciones

- **Administrador**: usa la *File System Access API*, disponible en Chrome, Edge y Brave de escritorio (en Brave hay que activarla en `brave://flags/#file-system-access-api`). En Firefox o Safari, usa **Exportar ZIP**.
- **Con `file://`**: no funcionan las vistas previas de texto o código (el navegador no permite leer esos archivos desde la página; queda la descarga). Imágenes, vídeo, descargas, enlaces y el visor de imágenes sí funcionan. Para todo lo demás, usa un servidor local.
- Despublicar o eliminar un proyecto lo quita del catálogo, pero **no borra** sus archivos del disco.
- La IA del proyecto no está «viva»: el gato no usa ningún modelo ni servicio externo, es un buscador local.

---

## Pruebas

Las pruebas automáticas (Playwright + Chromium) están en `admin-local/tests/` y no se publican. Se ejecutaron sobre Chromium; **no sustituyen** una prueba manual en tu navegador habitual (por ejemplo, Brave) ni en Firefox, Safari o dispositivos táctiles reales.

---

## Autoría

- **Autor y contenido**: Xiang Su Liu.
- **Desarrollo asistido por IA**: Claude (Anthropic), bajo la dirección y revisión del autor.
