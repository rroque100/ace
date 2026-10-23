# Etapas 2 y 3: plan de ejecución

**Objetivo:** filtros coherentes, continuidad privada, documentos del caso y observabilidad.
**Arquitectura:** extender el recuperador compartido; reutilizar RLS de conversaciones para historial y adjuntos; bucket privado sin acceso público.

- [x] Crear legal-workspace-filters.ts y probar OR/AND, régimen revisado/desconocido y parámetros antiguos.
- [x] Integrar filtros en Chat/Búsqueda/Normativa y limitar recuperación institucional.
- [x] Crear API y panel plegable de historial de búsqueda usando sesiones owner_id con JWT; restaurar sin query en URL.
- [x] Crear servicio de adjuntos y rutas autenticadas: validar bytes/tamaño, verificar propietario antes de leer/escribir y descargar, almacenar original privado y extracción con estado explícito.
- [x] Integrar selección de adjuntos, referencias C# y contexto de generación; excluir registros de adjuntos del historial conversacional ordinario.
- [x] Registrar y mostrar telemetría efectiva sin claves/contenido privado en auditoría.
- [x] Ejecutar pruebas significativas, tipos/lint/compilación, publicar y comprobar interfaz y rutas en producción.

No cambiar proveedor/dimensiones de embeddings, no modificar permisos del corpus ni ampliar lectura privada mediante credenciales de servicio. Preservar cambios locales ajenos al alcance.

## Verificación de cierre · 23 de octubre de 2026

75 pruebas en 16 archivos aprobadas; tipos y lint aprobados. Compilación de producción y despliegue Vercel Ready del commit 574304dd628c177f0169618d4f4665f306e07e78.

En producción se comprobaron filtros combinados, recuperación de una búsqueda con sus filtros, carga de un PDF y una imagen sintéticos, respuesta con referencias C1/C2, recuperación de la conversación y telemetría persistida con Gemini 2.5 Flash. Se comprobó directamente que ambos originales están cifrados en un bucket privado y que su recuperación conserva exactamente los bytes originales. El evento de descarga del navegador integrado no pudo capturarse; la ruta autenticada y sus rechazos de acceso cruzado cuentan con pruebas automatizadas.

El lector PDF de adjuntos usa el motor moderno y un respaldo de transcripción acotado a diez páginas; no modifica el procesador del corpus. Las imágenes y lecturas parciales requieren revisión. Estas pruebas no miden exactitud jurídica. En la prueba sintética, la recuperación incorporó fuentes generales que la respuesta identificó como insuficientes para resolver el régimen del caso; la pertinencia de la recuperación y la evaluación jurídica con casos de referencia siguen siendo áreas de mejora.