# Biblioteca e índice documental — diseño aprobado

24/10/2026. El usuario autorizó el segundo bloque: metadatos, versiones, extracción/pasajes, consultas escalables y ampliación desde fuentes oficiales.

Crear un índice institucional separado, con texto normalizado persistente y mantenimiento transaccional al cambiar documentos/fragmentos. La búsqueda literal y por palabras filtra, ordena y pagina en PostgreSQL; la aplicación recibe solo la página elegida y el conteo. Se conservan las reglas de clasificación y revisión y el acceso exclusivo del servidor. Selección de los mejores pasajes antes del límite y misma ordenación en coincidencias adicionales. La ruta anterior sigue disponible solo si la migración no existe; otros errores no se esconden.

Vincular versiones únicamente por identidad documental, preservar originales y separar publicación, actualización textual e incorporación. Limpiar vistas previas conservando texto íntegro y páginas originales. Incorporar bases PDF de publicación oficial con versión identificada; los DOCX y fuentes IVN no verificadas quedan pendientes y visibles, sin sustituciones por documentos que solo los citan. No se afirma vigencia o aplicabilidad por cargar un documento.

El bloque prepara el crecimiento de la recuperación literal; la recuperación semántica mantiene sus límites explícitos. Se verifican permisos SQL, coherencia con filtros actuales, equivalencia con consultas previas, paginación, datos privados excluidos e importaciones idempotentes. No se declaran pruebas de carga o validación jurídica especializada.
