# Centro Jurídico compacto y responsive

Diseño aprobado por el usuario tras la revisión UX de Chat, Búsqueda y Normativa.

## Alcance
Reutilizar Tailwind 4 y los tokens de ACE. Mantener reglas jurídicas, permisos, búsqueda, versiones e identificadores documentales.

- [x] Compactar cabeceras y navegación, escalar tipografía auxiliar a 13px y reducir recuadros secundarios.
- [x] Búsqueda: modos compactos, filtros principales inmediatamente después del campo; detalles de coincidencia y fechas avanzadas plegados.
- [x] Normativa: separar catálogo y lectura, volver al catálogo conservando filtros y selección, índice plegable y ficha secundaria. Al abrir un documento enfocar la vista de lectura.
- [x] Chat: compositor adherente solo con conversación, sin fijar su altura; evitar cubrir contenido o controles en pantallas pequeñas.
- [x] Agrupar administración en el menú del Centro Jurídico mediante un apartado plegable.
- [x] Adaptar por ancho disponible y pantallas pequeñas; comprobar navegación, foco, fuentes, filtros y ausencia de recortes. Ejecutar tipos, lint, pruebas pertinentes y compilación.
- [x] Publicar únicamente archivos del alcance y verificar producción. Separar la comprobación de escritorio de las pruebas pendientes de teléfono real y lector de pantalla.

## Validación funcional
Abrir un documento y artículo por URL; volver al catálogo y reabrir conservando filtros. Alternar modos de búsqueda y comprobar respuesta y paginación. Verificar teclado y que los apartados plegados sigan accesibles. Los avisos de recuperación fallida o parcial permanecen visibles, incluso cuando la ficha documental esté plegada.

## Resultado
Implementación, comprobaciones de código y revisión de escritorio completadas. La prueba móvil efectiva y el lector de pantalla siguen pendientes; el navegador no aplicó el override de tamaño solicitado, según el informe de evaluación.
