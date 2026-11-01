# Migración completa de interfaz a Tailwind CSS

Fecha: 31/10/2026. Estado: base compartida implementada; migración integral pendiente.

## Resultado solicitado

Una sola tecnología de estilos para la interfaz: utilidades Tailwind CSS, componentes reutilizables y configuración de tema. Sin hojas CSS particulares de pantallas ni propiedades visuales estáticas en `style`. Las variables CSS para valores dinámicos, el tema y el formato de PDF/documentos exportados se tratan de forma explícita; no se reescribe el contenido de los documentos.

## Base que ya se puede revisar

- AppShell: jerarquía, anchura de contenido, navegación por teclado y enlace para saltar el menú.
- Sidebar: menú por permisos, modo compacto en escritorio, panel móvil con cierre/Escape y retorno de foco, navegación inferior y áreas seguras.
- Inicio: tareas por permisos, tarjetas, lectura y acceso principal.
- Apariencia claro/oscuro, año fiscal y pantalla de carga.
- Acceso: superficies, contraste, formularios y controles compartidos.
- Primitivos Button/Input/Select/Badge: tamaños táctiles, foco, estados y contraste oscuro.

Estos componentes usan clases Tailwind. Los estilos antiguos que todavía necesitan otros módulos permanecen temporalmente; `styles.css` está en una capa `legacy` separada para que no imponga su aspecto a las utilidades nuevas. **Esta base no convierte todavía toda ACE a Tailwind puro.**

## Continuación propuesta

| Grupo | Pantallas y componentes | Condición para darlo por terminado |
| --- | --- | --- |
| Centro Jurídico | Chat, búsqueda, normativa, lector, PDF, voz, comparación | Respuestas, filtros, fuentes, selección y lector conservados; sin CSS específico activo |
| Formación y biblioteca | Simulador, banco, archivo, documentos, guardados e historial | Intentos, revisión, descarga y navegación probados; tablas y formularios solo Tailwind |
| Trabajo de contratación | Necesidades, expedientes, fases, contratos y archivo de expedientes | Formularios, guardado y vistas de documentos conservados; controles y estados uniformes |
| Administración y cierre | Configuración, usuarios, alertas, métricas, auditoría y actualización documental | Permisos y acciones conservados; cero importaciones de hojas CSS de interfaz excepto configuración Tailwind |

Cada grupo se revisa antes de integrar. No se ejecutan descargas, cambios de usuarios, generación de preguntas ni escrituras de documentos para verificar un cambio visual.

## Criterios de diseño y aceptación

- Inter autoalojada; cuerpo de interfaz de 14–16 px y lector jurídico independiente a 18 px ajustables.
- Escala consistente de espaciado, superficies, radios y jerarquía; color de estado acompañado de texto.
- Acciones primarias claras; opciones técnicas secundarias plegadas; estados vacío/carga/error diferenciados.
- Contraste comprobado en claro y oscuro; foco visible y movimiento reducido.
- Escritorio, tableta y celular sin desbordamiento horizontal; controles táctiles de aproximadamente 44 px.
- Mismos permisos y límites de uso; no introducir autenticación de prueba ni claves en el navegador.
- Pruebas de tipos y análisis de código; recorridos visuales por módulo. La auditoría no sustituye la comprobación funcional.

## Control del cambio

La revisión automática de aprobación rechazó la conversión masiva de componentes y eliminación de hojas CSS en una sola pasada por su riesgo de romper pantallas. Para la continuación se propone una sustitución coordinada por los grupos anteriores, manteniendo la versión publicada recuperable y retirando cada hoja solo después de verificar sus consumidores.

Inventario: `docs/interface-style-inventory-2026-10-31.json`. Auditoría de solo lectura: `node scripts/audit-interface-styles.mjs`; comprobación de la base migrada: `node scripts/audit-interface-styles.mjs --check`.
