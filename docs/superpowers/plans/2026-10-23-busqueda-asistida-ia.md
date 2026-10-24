# Búsqueda asistida en ACE Implementation Plan

**Goal:** Implementar el diseño aprobado conservando búsqueda, privacidad y rutas autorizadas.

**Architecture:** Propuestas estructuradas en un endpoint autenticado, diálogo cliente reutilizable y sugerencias locales del catálogo. Se reutilizan proveedor de IA, componentes accesibles y transferencia privada al chat.

**Tech Stack:** Next.js, React, Zod, Radix, proveedor de IA existente y Vitest.

## Global Constraints

No inferir régimen ni vigencia. No incluir consultas privadas en URLs. No alterar archivos originales. No publicar cambios locales ajenos.

### Task 1: Interpretación verificable
- [x] Crear `lib/search-assistant.ts` y `app/api/search/assistant/route.ts`: validar rutas, criterios y límites; conservar comillas; limitar solicitudes y tiempo del proveedor.
- [x] Probar rutas inválidas, ampliación indebida y eliminación de restricciones inferidas en `tests/search-assistant.test.ts`.

### Task 2: Interfaz y continuidad
- [x] Crear `app/components/search-assistant.tsx`, integrar en AppShell y DocumentSearchWorkspace. Confirmación editable previa, enlaces permitidos, transferencia privada al chat y estado de búsqueda por usuario.
- [x] Añadir títulos al catálogo y sugerencias locales; compactar cabecera, aclarar etiquetas y limpiar vista previa sin tocar PDF.

### Task 3: Fecha y publicación
- [x] Filtrar por fecha original conocida con validación de intervalo y prueba de exclusión de fechas de carga.
- [x] Ejecutar tipos, lint, 158 pruebas de regresión y compilación.
- [ ] Revisar diff selectivo, publicar y comprobar despliegue y pantalla real.
