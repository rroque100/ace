# Experiencia de acceso e inicio de ACE · 30 de octubre de 2026

## Entrega

- Inicio en servidor, centrado en tareas: comprender, encontrar, comprobar y aprender. Los accesos se derivan de la misma navegación y permisos del shell.
- Una cuenta externa con módulos vigentes puede abrir únicamente la página raíz personalizada; el acceso a datos y APIs internos permanece denegado. Vencimiento y cambio obligatorio de contraseña mantienen prioridad.
- Identidad mínima para el cliente: el Sidebar ya no recibe el objeto de sesión completo ni accessToken.
- Apariencia clara, oscura y del sistema, validación del valor persistido, sincronización entre controles y pestañas, y aplicación inicial antes de pintar.
- Inter autoalojada, jerarquía tipográfica, superficies con tokens compartidos, botones táctiles, foco visible y reducción de movimiento.
- Cabecera y navegación inferior para móvil, áreas seguras, menú con Escape, foco contenido y devolución del foco, sin desplazamiento de la página detrás.
- Asistentes de búsqueda y de trabajo cargados al abrirlos. La cuenta externa no consulta novedades internas. Consultas independientes del shell se ejecutan en paralelo.
- Lector PDF con worker de la versión instalada servido desde el mismo dominio y con sesión; no depende de un CDN. Recurso cargado solo al leer un documento. Se conserva la página PDF original sin invertir sus colores.
- Sin service worker ni caché offline de consultas o documentos privados. Se conservan autenticación, protección de rutas y cabeceras existentes.

## Comprobaciones

- 100 pruebas correctas en nueve archivos: navegación/identidad, rutas externas, estado/cuota, worker PDF, búsqueda y enlace a Chat/Normativa.
- TypeScript y ESLint de archivos modificados, sin errores.
- Cuenta externa real de prueba: inicio, accesos habilitados, apariencia y menú móvil. Menú interno y procesos verificados por pruebas de permisos; no se ha realizado una sesión visual completa con cada rol interno.
- Emulación móvil 390 x 844 y escritorio: sin desbordamiento horizontal del inicio. No sustituye una prueba en dispositivos físicos.
- Búsqueda filtrada por Ley correcta; apertura del PDF de la ley, página 1 de 36, correcta tras corregir la resolución del worker.
- Una primera búsqueda amplia devolvió 503; una consulta equivalente al índice sin filtro respondió posteriormente en unos 4,9 segundos. No se acredita una latencia general ni concurrencia. La carga de interfaz y el tiempo de recuperación del índice son mediciones diferentes.

## Límites

La entrega mejora el acceso, inicio y marco común. Las pantallas históricas comparten los nuevos tokens y ajustes de compatibilidad; no se ha reescrito cada formulario administrativo. No constituye una auditoría integral de seguridad ni una aplicación nativa instalada. Quedan por medir Core Web Vitals de producción, concurrencia y búsquedas amplias con el catálogo actual.
