# Navegación clara del simulador — Implementation Plan

**Goal:** Separar colecciones e historial y comunicar la revisión real de las preguntas.

**Architecture:** Mantener BalotariosOece y ExamWorkspace montados detrás de tres pestañas. Un módulo puro resuelve URL y conteos; el catálogo mantiene su revisión remota y una API autenticada del banco devuelve agregados, sin claves ni borradores individuales.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Supabase, Vitest.

## Restricciones

Mantener sesiones en curso, enlaces antiguos, fuentes de datos y paleta existente. No modificar claves ni reglas legales ni base de datos.

## Tareas

- [x] Añadir `lib/simulador-navegacion.ts` y `tests/simulador-navegacion.test.ts`: resolver seccion/vista/attempt y calcular conteos con retiros separados. Probar enlaces legados, enlaces al banco, historial y revisiones pendientes antes de implementar.
- [x] Añadir `app/api/exams/resumen/route.ts` y su prueba: `requireUser({usesAI:false})`, obtener disponibilidad sin borradores y cuentas exactas de estados; retornar solo `{total,reviewed,pending,retired}`, `no-store`; fallo sin ceros inventados.
- [x] Reorganizar `simulador-shell.tsx`: tres pestañas nombradas, enlaces persistentes y navegación por teclado. Mantener instancias al ocultarlas.
- [x] Ajustar `balotarios/modulo.tsx`: opciones internas de práctica/examen y resumen de revisión del catálogo con detalle por balotario. Eliminar acceso duplicado al banco. Añadir resumen del banco aislado y cambiar textos del historial de forma coherente.
- [x] Ejecutar pruebas dirigidas a navegación, API, balotarios, exámenes y Tailwind; revisión de tipos y lint de archivos cambiados; compilar en carpeta separada y verificar en preview escritorio/móvil con sesión del usuario.

## Comprobación de diseño

Los conteos de pendientes incluyen preguntas publicadas cuya fuente ya no es elegible; las retiradas no inflan pendientes. Una colección importada no se etiqueta como revisada hasta completar la consulta remota. La opción principal «Historial» conserva resultados de ambos bancos.
