# Preparación OECE — plan de implementación

> Ejecución directa en esta sesión; sin delegación. Diseño aprobado: 2026-10-29-simulador-preparacion-oece-design.md.

**Goal:** convertir el motor existente en preparación estructurada, sin publicar revisión jurídica automática.
**Architecture:** catálogo de temario versionado compartido por UI y selección transaccional; banco con revisión por alternativa; informes agregados y repaso propietario.
**Tech Stack:** Next.js, TypeScript, Tailwind, Zod, Supabase/PostgreSQL y Vitest.

## Restricciones

- Conservar intentos históricos y cambios ajenos.
- Perfil fijo: 72 preguntas, 120 minutos, treinta cuotas y 25/22/25 por competencia.
- 360 es meta editorial; no equivalen borradores a preguntas revisadas.
- Claves y explicaciones solo se revelan al entregar o después de responder en práctica.
- Sin repetición para llenar cupos, ni certificación o predicción de aprobación.

## 1. Temario y política

Files: lib/exam-curriculum.ts, lib/exam-policy.ts, tests/exam-curriculum.test.ts, tests/exam-policy.test.ts.
Interfaces: EXAM_CURRICULUM, curriculumCoverage(rows), examQuestionSchema, examStartSchema.
- [x] Pruebas: treinta códigos únicos, suma 72, cuotas por competencia y rechazo de clasificación incoherente.
- [x] Catálogo de la fuente vigente y metas cinco veces las cuotas.
- [x] Validar perfil, razones por alternativa y comprobaciones editoriales antes de publicar.

## 2. Persistencia y servidor

Files: supabase/migrations/202610290002_exam_preparation.sql, lib/exam-preparation-server.ts, app/api/exams/{route,preparation/route,bank/route}.ts, app/api/exams/[id]/activity/route.ts.
Interfaces: ace_exam_start_prepared, ace_exam_preparation, ace_exam_question_report, ace_exam_activity, ace_exam_assemble.
- [x] Migración aditiva, funciones service_role, propietario y bloqueo por usuario.
- [x] Selección por las treinta cuotas; huecos bloquean todo el perfil y explican cuáles faltan.
- [x] Balotarios de edición con revisiones fijas, sin repetidos entre cinco conjuntos.
- [x] Registro de actividad, reportes de preguntas y consultas agregadas sin fuga de claves.
- [x] Repaso solo de errores propios, revisiones actuales elegibles y modo práctica.

## 3. Interfaz y revisión

Files: app/components/exam-preparation.tsx, exam-bank-fields.tsx, exam-question-tools.tsx, exam-workspace.tsx, exam-bank.tsx.
- [x] Entrada, cobertura y perfiles claros, filtros editoriales y faltantes por subcompetencia.
- [x] Publicación exige clasificación, demanda cognitiva, razones de cada opción y lista de revisión.
- [x] Mostrar progreso y repaso, reportes y estadísticas con muestras pequeñas identificadas.

## 4. Autoría y verificación

Files: lib/exam-authoring.ts, scripts/prepare-exam-bank.ts, scripts/verify-exam-preparation.sql, tests/exam-preparation-routes.test.ts.
- [x] Preparar lotes originales con texto real, razones por alternativa y trazabilidad de generación.
- [x] Validar fuentes exactas y duplicados; detener tareas si el proveedor o la evidencia fallan.
- [x] Ejecutar pruebas unitarias, rutas, SQL con rollback, tipos y build.
- [x] Aplicar migración, comprobar datos, desplegar y probar banco, perfil bloqueado, repaso y vista estrecha.
- [x] Informe de cantidades reales: borradores, aprobadas, faltantes y límites de revisión humana.

## Cierre de verificación

Funciones implementadas y desplegadas; 28 pruebas correctas, tipos y lint sin errores, build de producción y pruebas SQL con rollback correctas. Migraciones 002–008 aplicadas.

Banco editorial: 215 borradores clasificados, 0 publicados. La meta de 360 y la revisión humana siguen pendientes: la última generación se detuvo por un límite del proveedor de IA. Las casillas de autoría verifican el proceso y los lotes preparados, no la aprobación jurídica de 360 preguntas.
