# Actualización documental diaria — plan

Objetivo: ejecutar el diseño aprobado en `../specs/2026-10-28-actualizacion-documental-diaria-design.md`.
Arquitectura: conectores oficiales existentes, cola institucional independiente, PostgreSQL/RLS, cron autenticado, interfaz administrativa Tailwind. Ejecución directa, sin delegación.

- [x] Persistencia: migración aditiva con configuración, trabajos por etapas, arrendamientos, cuotas diarias atómicas e historial; solo service_role puede ejecutar las funciones.
- [x] Conectores: admitir catálogos oficiales de normas por tipo y opiniones, conservar publicación, número y fecha; detectar cambios y límites parciales.
- [x] Servicio: detección idempotente, descarga sin sobrescribir, clasificación con evidencia, indexación comprobada; circuito por 402 y recuperación de arrendamientos.
- [x] API y cron: administración autenticada, secreto de cron, límites de tiempo, cron diario 11:00 UTC (06:00 Lima), sin tocar cron existentes.
- [x] UI: acceso administrativo dentro de Novedades, fuentes/tipos/regímenes, pausa, ejecutar/reanudar, cantidades por etapa e incidencias; permisos y estados accesibles.
- [x] Proteger el drenador genérico para que no indexe candidatos institucionales pendientes de clasificación.
- [x] Pruebas relevantes: permisos, deduplicación, cuota, arrendamientos, clasificación literal, circuito, fuente parcial y estados. Typecheck, compilación y verificación visual.
- [x] Aplicar migración, configurar cron autorizado, publicar y verificar. Documentar lo implementado, lo activo y lo pendiente por créditos de Google por separado.
