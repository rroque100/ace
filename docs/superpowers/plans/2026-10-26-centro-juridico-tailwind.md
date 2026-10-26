# Centro Jurídico con Tailwind: implementación

**Objetivo:** aplicar el diseño aprobado a Chat, Búsqueda y Normativa manteniendo consultas, permisos y fuentes.
**Arquitectura:** contenedor visual acotado a las tres rutas, navegación compartida con utilidades y estilos de compatibilidad escritos con Tailwind `@apply`. No activar Preflight global. Reutilizar los tokens de ACE y la fuente Inter instalada.
**Stack:** Next.js 16, React 19, Tailwind CSS 4.

## Trabajo
- [ ] Registrar las fuentes Tailwind del Centro Jurídico y añadir su hoja compartida. Mantener el alcance `.legalWorkspace` para impedir cambios en otros módulos.
- [ ] Migrar las tres envolturas de página y la navegación común: destinos con icono, descripción de tarea y estado activo accesible. Conservar `legalCenterHref` y sus filtros.
- [ ] Ordenar Chat: cabecera, conversación, fuentes y compositor. Mantener los controles secundarios plegados y la lectura sin altura fija.
- [ ] Ordenar Búsqueda: entrada, intención, filtros, resultados, selección y estados vacíos. Mantener formularios y acciones actuales.
- [ ] Ordenar Normativa: filtros, catálogo, ficha y lector con índice; resolver columnas por espacio disponible y evitar recortes.
- [ ] Ejecutar tipos, lint, pruebas de navegación/filtros/handoff y compilación. Revisar las tres pantallas en navegador; inspeccionar foco y desbordamiento en anchuras disponibles.
- [ ] Registrar evidencia y limitaciones; publicar los archivos del alcance sin incluir cambios ajenos.

## Criterios visuales
Títulos azul oscuro, acción principal verde petróleo, superficies claras. Texto de lectura 16px con interlineado amplio, controles táctiles de 44px, foco visible y movimiento reducido. Las alertas mantienen su significado; no ocultar fallos ni límites jurídicos. Sin nuevas llamadas de IA por cambios visuales.
