# Plan: Centro Jurídico

Diseño aprobado por el usuario: Centro Jurídico, Chat jurídico, Búsqueda documental y Normativa y criterios. Ejecución en esta conversación, preservando cambios ajenos.

- [x] Crear utilidades `lib/legal-center.ts` para accesos con filtros públicos compatibles y clasificación visual de vigencia. Pruebas: enlaces antiguos, exclusión de hechos/pregunta/sesión, desconocida/no vigente/vigente y estados pendientes.
- [x] Crear navegación común accesible en `app/components/legal-center-nav.tsx`, integrarla con filtros actuales en los tres componentes y adaptar títulos y menú lateral. Conservar rutas y acceso separado a Archivo.
- [x] Aplicar etiquetas de vigencia consistentes y neutrales, corregir «solo vigentes» y evitar exigir artículos propios a criterios y guías. Facilitar PDF en página y tránsito de fuentes entre herramientas.
- [ ] Revisar enlaces y estados vacío/error/carga; comprobar tipos, pruebas pertinentes, compilación, navegación por teclado y presentación visual. Publicar únicamente los archivos de esta entrega y verificar producción.

No se cambian modelo, claves, datos normativos, tablas, permisos ni el módulo Contratos.

Comprobación previa a publicación: 33 pruebas correctas, tipos y compilación de producción correctos, revisión de código sin errores.
