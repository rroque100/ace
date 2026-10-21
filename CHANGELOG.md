# Changelog

Todos los cambios notables en este proyecto seran documentados en este archivo.

El formato esta basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-XX-XX

### Agregado
- Configuracion completa para deploy en Netlify
- `netlify.toml` con plugin de Next.js y configuracion de build
- GitHub Actions para CI (lint, typecheck, test, build)
- GitHub Actions para deploy automatico a Netlify
- Netlify Scheduled Functions para reemplazar Vercel Cron (drain de indexacion cada 5 min)
- Headers de seguridad (HSTS, X-Frame-Options, CSP, etc.)
- Archivo `.nvmrc` fijando Node.js 20 LTS
- Documentacion completa en `docs/DEPLOY-NETLIFY.md`

### Cambiado
- `next.config.ts`: agregado `output: "standalone"` para mejor performance en serverless
- `package.json`: agregado `engines.node: ">=20.0.0"` y `@netlify/plugin-nextjs` como devDependency
- `.gitignore`: agregado `.netlify/`, `.netlify-cache/`, artefactos de Playwright

### Eliminado
- `vercel.json` (migracion completa a Netlify)
- Configuracion de regiones Vercel-specific
- Cron jobs de Vercel (reemplazados por Netlify Scheduled Functions)

### Seguridad
- Headers de seguridad estrictos en `netlify/_headers`
- HSTS con `includeSubDomains; preload`
- `X-Frame-Options: DENY` para prevenir clickjacking
- `Permissions-Policy` desactiva camara, microfono y geolocalizacion

## [0.0.x] - Pre-Netlify

### Estado anterior
- Aplicacion ACE funcional con Next.js 15 + React 19
- Modulo de expedientes con IA (RAG + OCR + busqueda semantica)
- 19 modulos documentados en SDD
- 123 tests passing
- Anti-alucinacion de 3 capas
- Compliance integrado (Ley 32069, OECE)
- Deploy original en Vercel con cron jobs
