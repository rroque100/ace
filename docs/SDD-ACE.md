# SDD — ACE IA Jurídica (Plataforma completa)

> **Spec-Driven Development** · Documento maestro de la especificación funcional,
> técnica y de UX/UI de la aplicación **ACE IA Jurídica** para municipalidades
> peruanas (Ley 32069 — Ley General de Contrataciones Públicas, OECE, TUO de
> la Ley de Contrataciones y su Reglamento).
>
> **Estado:** ✅ MVP en producción · módulos `Fase 2` en desarrollo.
> **Versión:** 0.1.0 · **Stack:** Next.js 15 (App Router) · React 19 ·
> TypeScript estricto · Supabase · Pinecone · OpenAI.
> **Mantenedor:** Equipo ACE. Cualquier cambio en la implementación debe
> reflejarse en este documento en el mismo PR.

---

## Tabla de contenidos

0. [Resumen ejecutivo](#0-resumen-ejecutivo)
1. [Visión y objetivos](#1-visión-y-objetivos)
2. [Personas, roles y capacidades](#2-personas-roles-y-capacidades)
3. [Modelo de negocio: ciclo de contrataciones](#3-modelo-de-negocio-ciclo-de-contrataciones)
4. [Arquitectura técnica](#4-arquitectura-técnica)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Capa de IA: pipelines y anti-alucinación](#6-capa-de-ia-pipelines-y-anti-alucinación)
7. [Autenticación, navegación y shell](#7-autenticación-navegación-y-shell)
8. [Módulos del sistema](#8-módulos-del-sistema)
   - 8.1 [Chat jurídico con fuentes](#81-chat-jurídico-con-fuentes)
   - 8.2 [Búsqueda semántica sobre el corpus](#82-búsqueda-semántica-sobre-el-corpus)
   - 8.3 [Análisis de documentos](#83-análisis-de-documentos)
   - 8.4 [Validador de procedimientos (orquestador)](#84-validador-de-procedimientos-orquestador)
   - 8.5 [Comparación normativa A/B](#85-comparación-normativa-ab)
   - 8.6 [Navegador normativo](#86-navegador-normativo)
   - 8.7 [Necesidades (OECE) — Módulo 1](#87-necesidades-oece--módulo-1)
   - 8.8 [Expedientes de proceso — Módulos 2-10](#88-expedientes-de-proceso--módulos-2-10)
   - 8.9 [Contratos — Módulo 11](#89-contratos--módulo-11)
   - 8.10 [Archivo municipal](#810-archivo-municipal)
   - 8.11 [Biblioteca de expedientes archivados](#811-biblioteca-de-expedientes-archivados)
   - 8.12 [Documentos (biblioteca PDF)](#812-documentos-biblioteca-pdf)
   - 8.13 [Guardados, carpetas y seguimientos](#813-guardados-carpetas-y-seguimientos)
   - 8.14 [Alertas / Boletín de novedades](#814-alertas--boletín-de-novedades)
   - 8.15 [Historial de actividad](#815-historial-de-actividad)
   - 8.16 [Auditoría](#816-auditoría)
   - 8.17 [Métricas de uso](#817-métricas-de-uso)
   - 8.18 [Evaluación continua del RAG (corpus eval)](#818-evaluación-continua-del-rag-corpus-eval)
   - 8.19 [Configuración y matriz de roles](#819-configuración-y-matriz-de-roles)
9. [API REST consolidada](#9-api-rest-consolidada)
10. [Pipeline de indexación end-to-end](#10-pipeline-de-indexación-end-to-end)
11. [UX/UI — sistema de diseño](#11-uxui--sistema-de-diseño)
12. [Seguridad, RLS y permisos](#12-seguridad-rls-y-permisos)
13. [Auditoría central](#13-auditoría-central)
14. [Configuración (env vars)](#14-configuración-env-vars)
15. [Testing y calidad](#15-testing-y-calidad)
16. [Despliegue (Vercel + cron)](#16-despliegue-vercel--cron)
17. [Pendientes / roadmap](#17-pendientes--roadmap)
18. [Apéndice A — Glosario](#18-apéndice-a--glosario)
19. [Apéndice B — Historial del documento](#19-apéndice-b--historial-del-documento)

> **Documentos SDD específicos de módulo** (más profundos, viven en su propia
> carpeta):
>
> - [`docs/SDD-EXPEDIENTES-ARCHIVO.md`](SDD-EXPEDIENTES-ARCHIVO.md) — Biblioteca
>   de expedientes archivados (Ley 32069 + archivo histórico).
> - [`docs/MODULO-EXPEDIENTES.md`](MODULO-EXPEDIENTES.md) — intención original
>   del módulo (alto nivel, contraste con el estado actual).
> - [`docs/ARQUITECTURA.md`](ARQUITECTURA.md) — diagrama general de la
>   arquitectura monolítica modular.
> - [`docs/OPERACIONES.md`](OPERACIONES.md) — runbook operacional
>   (Vercel, Supabase, Pinecone, OpenAI).

---

## 0. Resumen ejecutivo

**ACE** es una plataforma de **IA jurídica para municipalidades peruanas** que
acompaña al funcionario a lo largo de todo el ciclo de contrataciones públicas
(**Ley 32069**, su Reglamento, directivas de la OECE y la jurisprudencia del
OSCE / Tribunal de Contrataciones). Combina:

- **Un corpus normativo indexado** (Pinecone + Supabase Postgres + Storage) con
  búsqueda semántica + léxica + reranking jerárquico.
- **Un asistente conversacional con RAG** (Retrieval-Augmented Generation) que
  cita fuentes `[F#]` y nunca alucina: cada cifra que aparece en una respuesta
  debe estar en el fragmento citado.
- **Un orquestador de procedimientos** que valida si un procedimiento de
  selección (LP, CP, SIE, CD, CON, AS, AM, SCI) es **procedente / no procede /
  requiere revisión**, citando el fundamento legal exacto.
- **Generación de documentos administrativos** (fichas técnicas, contratos .docx,
  borradores de respuesta a documentos entrantes) con cláusulas obligatorias
  pre-cargadas.
- **Evaluación continua del RAG** con un banco de preguntas curadas que mide
  fidelidad de citas, cobertura normativa y grounding violations.

> **Regla de oro:** la IA **propone**, el funcionario **valida**. Cada acción
> crítica tiene una pantalla de revisión humana antes de ejecutarse o persistirse.
> El sistema **cita fuentes** y **nunca inventa** números ni fechas.

---

## 1. Visión y objetivos

### 1.1 Propósito

- **Reducir el tiempo de respuesta jurídica**: que un funcionario municipal
  pueda obtener una respuesta fundamentada a una consulta sobre contrataciones
  públicas en segundos, en lugar de horas o días de búsqueda manual en textos
  dispersos.
- **Estandarizar el cumplimiento normativo**: asegurar que cada procedimiento
  de selección, cada contrato y cada respuesta institucional respete
  consistentemente los requisitos del art. 60 de la Ley 32069 y directivas
  OECE vigentes.
- **Digitalizar el archivo**: pasar de un archivo físico fragmentado a una
  biblioteca digital con OCR + búsqueda semántica, manteniendo la trazabilidad
  de la ubicación física (estante, archivador, color, folio).

### 1.2 Objetivos técnicos

- **Cero alucinaciones**: toda cifra, fecha o número citado en una respuesta
  debe aparecer literal en el fragmento. Validado por `citation-faithfulness`.
- **Citas trazables**: cada respuesta lleva marcadores `[F#]` que apuntan a
  fragmentos indexados en Pinecone. El usuario puede abrir el PDF original en la
  página exacta.
- **Aislamiento del corpus**: tres namespaces de Pinecone (normativa,
  archivo administrativo, expedientes archivados) más chunks separados en
  Supabase por documento. Borrar un documento borra sus vectores y chunks.
- **Idempotencia**: reindexar un documento es seguro. Borrar y volver a subir no
  deja vectores huérfanos.
- **Auditoría completa**: cada acción de escritura (upload, delete, update,
  chat, orquestación, evaluación) queda registrada en `audit_logs` con actor,
  timestamp y detalles JSONB.
- **UX para funcionarios no técnicos**: la IA oculta la complejidad técnica
  (jerarquías normativas, embeddings, namespaces). La UI es de alto nivel
  con placeholders, autocompletar, validación inline, atajos de teclado y
  command palette `⌘K`.

### 1.3 No-objetivos

- ❌ No es un sistema de firma digital ni certificación de Sello de Tiempo.
- ❌ No hace OCR de imágenes sueltas (JPG, PNG, TIFF) — solo PDF.
- ❌ No reemplaza al OSCE / Tribunal de Contrataciones (es fuente de información,
  no autoridad decisoria).
- ❌ No autogenera documentos finales sin revisión humana (la IA propone, el
  funcionario aprueba).

---

## 2. Personas, roles y capacidades

### 2.1 Los 11 roles del sistema

Definidos en `lib/permisos-contratacion.ts:11-22`.

| Rol | Slug | Descripción |
|---|---|---|
| **Consulta** | `consulta` | Ciudadano, abogado externo, auditoría externa. Solo lectura. |
| **Área Usuaria** | `area_usuaria` | Servidor del área que origina la necesidad pública. Crea necesidades, sube documentos de trabajo. |
| **ATE** | `ate` | Asistente Técnico de la Entidad. Asesora al área usuaria en la formulación. |
| **DEC** | `dec` | Dirección de Ejecutora de Contrataciones. Órgano instructor. Gestiona el ciclo completo. |
| **Oficial de Compra** | `oficial_compra` | Especialista en contratación pública. Ejecuta actos preparatorios. |
| **Comité** | `comite` | Comité de selección. Evalúa ofertas. |
| **Jurado** | `jurado` | Jurado de procesos especiales. |
| **Asesoría Jurídica** | `legal` | Revisa legalidad. Aprueba borradores. |
| **Titular** | `titular` | Titular de la entidad. Aprueba decisiones críticas. |
| **AGA** | `aga` | Área de Gestión Administrativa. Supervisa el ciclo. |
| **Administrador** | `admin` | Configura sistema, gestiona usuarios, ve auditoría. |

### 2.2 Las 8 capabilities

`lib/permisos-contratacion.ts:106-135`.

| Capability | Roles que la tienen | Significado |
|---|---|---|
| `necesidad.manage` | area_usuaria, ate, dec, aga, admin | Crear/editar Necesidades |
| `expediente.manage` | dec, aga, titular, admin | Crear/editar Expedientes |
| `expediente.upload` | area_usuaria, ate, dec, oficial_compra, comite, aga, admin | Subir documentos al expediente |
| `expediente.evaluate` | dec, oficial_compra, comite, jurado, admin | Evaluar ofertas |
| `expediente.risks` | dec, legal, admin | Analizar riesgos del expediente |
| `expediente.draft` | dec, oficial_compra, comite, legal, admin | Generar borradores (informe, acta, contrato, …) |
| `expediente.approve` | titular, legal, admin | Aprobar decisiones críticas |
| `expediente.execute` | area_usuaria, dec, admin | Ejecutar actos del proceso |

### 2.3 Personas del sistema

| Persona | Rol primario | Capacidades que usa | Casos de uso |
|---|---|---|---|
| **Funcionario de área usuaria** | `area_usuaria` | `necesidad.manage`, `expediente.upload`, `expediente.execute` | Crea necesidades, sube Términos de Referencia, ejecuta actos del proceso. |
| **Asistente de la entidad (ATE)** | `ate` | `necesidad.manage`, `expediente.upload` | Asesora al área usuaria en la formulación de la necesidad. |
| **DEC / instructor** | `dec` | Todas (excepto approve) | Motor del sistema. Crea expediente, sube documentos, evalúa, detecta riesgos, genera borradores. |
| **Oficial de compra** | `oficial_compra` | `expediente.upload`, `expediente.evaluate`, `expediente.draft` | Ejecuta actos preparatorios (estudio de mercado, cotizaciones, bases). |
| **Comité de selección** | `comite` | `expediente.upload`, `expediente.evaluate`, `expediente.draft` | Evalúa ofertas, genera actas e informes. |
| **Asesoría jurídica** | `legal` | `expediente.risks`, `expediente.draft`, `expediente.approve` | Revisa legalidad, aprueba borradores. |
| **Titular de la entidad** | `titular` | `expediente.manage`, `expediente.approve` | Aprueba decisiones críticas. |
| **Administrador** | `admin` | todas + config | Configura sistema, gestiona usuarios, ve auditoría y métricas. |
| **Ciudadano / abogado** | `consulta` | ninguna (solo lectura) | Busca en el corpus, consulta el archivo. |

### 2.4 Áreas de la sidebar

`lib/permisos-contratacion.ts:150-196` define `APP_AREAS` consumidas por el
sidebar:

1. **General** → `/` (panel)
2. **Consultar** → `/chat`, `/busqueda`, `/normas`, `/archivo`
3. **Revisar** → `/validar`, `/analizar`, `/comparar`
4. **Trabajo** → `/necesidades`, `/expedientes`, `/expedientes-archivo`, `/contratos`
5. **Organizar** → `/guardado`, `/historial`, `/alertas`
6. **Administrar** (admin) → `/documentos`, `/evaluacion`, `/metricas`, `/auditoria`, `/configuracion`

---

## 3. Modelo de negocio: ciclo de contrataciones

```
                ┌─────────────────────────────────────────┐
                │          CICLO DE CONTRATACIONES        │
                │              (Ley 32069)                │
                └─────────────────────────────────────────┘

   ┌────────┐    ┌──────────────┐    ┌─────────────────┐
   │ÁREA    │───▶│ NECESIDAD    │───▶│ ACTUACIONES     │
   │USUARIA │    │ (REQ-YYYY-   │    │ PREPARATORIAS   │
   │        │    │   NNNN)      │    │                 │
   └────────┘    └──────────────┘    └────────┬────────┘
                                            │
   ┌────────────────────────────────────────┘
   ▼
   ┌────────────────┐    ┌─────────────────┐
   │  CONVOCATORIA  │───▶│  REGISTRO DE     │
   │                │    │  PARTICIPANTES   │
   └────────────────┘    └────────┬────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────┐
   │  PRESENTACIÓN DE OFERTAS + EVALUACIÓN   │
   │  (matriz por postor, IA detecta riesgos)│
   └────────┬────────────────────────────────┘
            │
            ▼
   ┌─────────────────┐    ┌─────────────────┐
   │  CALIFICACIÓN   │───▶│  OTORGAMIENTO    │
   │  Y EVALUACIÓN   │    │  DE BUENA PRO    │
   └─────────────────┘    └────────┬────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────┐
   │  CONTRATO Y EJECUCIÓN (art. 60)         │
   │  (generado con IA, cláusulas obligatorias)│
   └────────┬────────────────────────────────┘
            │
            ▼
   ┌─────────────────┐
   │  ARCHIVO        │  ──▶  Módulo 8.11
   │  (expediente    │      "Biblioteca de
   │  archivado)     │       expedientes
   └─────────────────┘       archivados"
```

### 3.1 Etapas / status (Módulo 8.8)

`lib/process-status.ts` define el motor de avance `reconcileProcessStatus` que
infiere la nueva etapa del proceso a partir de la evidencia subida. Solo se
**avanza hacia adelante**.

| Etapa | Status (en `procurement_processes.status`) |
|---|---|
| Necesidad | `necesidad` (estado inicial, antes de derivar) |
| Actuaciones preparatorias | `actuaciones_preparatorias` |
| Convocatoria | `convocatoria` |
| Registro de participantes | `registro_participantes` |
| Presentación de ofertas | `presentacion_ofertas` |
| Evaluación | `evaluacion` |
| Calificación | `calificacion` |
| Otorgamiento | `buena_pro` |
| Contrato | `contrato` |
| Ejecución | `ejecucion` |
| Archivo | `archivado` (terminal) |
| Desierto | `desierto` (terminal) |

---

## 4. Arquitectura técnica

### 4.1 Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript estricto |
| Estilos | CSS modules en `app/styles.css` (un solo archivo, ~14k líneas) |
| Formularios | `react-hook-form` + `zod` (cliente) |
| Backend | Next.js API routes (`runtime: "nodejs"`, `dynamic: "force-dynamic"`) |
| Validación | `zod` (cliente y servidor) |
| Auth | Supabase Auth (JWT) con `getUser()` server-side |
| DB | Supabase (PostgreSQL + Storage) |
| Vector DB | Pinecone (REST API directo, 3 namespaces aislados) |
| LLM | OpenAI (`gpt-4.1-mini`, `gpt-4o`, `gpt-4o-mini`, `text-embedding-3-small`) |
| OCR | `pdf-parse` (texto) + `gpt-4o-mini`/`gpt-4o` Vision (escaneados) |
| Generadores de doc | `docx` (Word), `pdf-lib` (PDF) |
| Tests | Vitest (unit) + `scripts/operational-smoke-test.mjs` (smoke) |
| Deploy | Vercel (región `iad1`) + cron drainer |

### 4.2 Diagrama de capas

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router)                                       │
│  ┌────────────────────────┐  ┌────────────────────────────┐   │
│  │  Server Components     │  │  Client Components         │   │
│  │  - app/page.tsx        │  │  - legal-chat.tsx          │   │
│  │  - app/chat/page.tsx   │  │  - semantic-search.tsx     │   │
│  │  - app-shell.tsx       │  │  - sidebar.tsx             │   │
│  │  - ... (21 más)        │  │  - legal-activity.tsx      │   │
│  │                        │  │  - ... (30 más)            │   │
│  └──────────┬─────────────┘  └──────────┬─────────────────┘   │
│             │                          │                      │
│             │      fetch / form       │                      │
│             └────────────┬─────────────┘                      │
└─────────────────────────┼────────────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼────────────────────────────────────┐
│  API routes (app/api/**/route.ts) — 60+ endpoints              │
│  - requireUser / requireEditor / requireAdmin / requireCapability│
│  - zod validation                                              │
│  - writeAuditLog tras cada acción de escritura                │
└────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Supa-   │ │Pinecone│ │OpenAI  │ │Pinecone│ │scripts/│
│base    │ │legal- │ │chat    │ │archivo │ │work-  │
│DB+     │ │docs NS│ │legal-  │ │NS,     │ │ers/   │
│Storage │ │       │ │eval    │ │exp-    │ │index- │
│+Auth   │ │       │ │ocr     │ │archivo │ │ing-   │
│+RLS    │ │       │ │embedd. │ │NS      │ │worker │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

### 4.3 Estructura de directorios

```
D:\ace/
├── app/                              # Next.js App Router
│   ├── api/                          # 60+ endpoints REST
│   │   ├── analyze/ audit/ boletin/ chat/ compare/ configuracion/
│   │   ├── contracts/ corpus/ documents/ eval/ facets/ folders/
│   │   ├── health/ integrate/ metrics/ norms/ orchestrate/ processes/
│   │   ├── saved/ search/ seguimientos/ settings/ system/ usage/
│   │   ├── needs/ proceso/ archive/ expediente-archivo/
│   │   ├── chat/ (sessions, messages, sources, notes, export)
│   │   └── auth/signout/
│   ├── components/                   # 37 componentes
│   │   ├── app-shell.tsx, sidebar.tsx, login-form.tsx
│   │   ├── legal-chat.tsx, semantic-search.tsx, document-analyzer.tsx
│   │   ├── procedure-validator.tsx, process-list.tsx, process-detail.tsx
│   │   ├── necesidad-list.tsx, necesidad-detail.tsx
│   │   ├── normative-compare.tsx, normative-browser.tsx
│   │   ├── contract-form.tsx, eval-dashboard.tsx
│   │   ├── metrics-dashboard.tsx, audit-explorer.tsx, legal-activity.tsx
│   │   ├── chat-history.tsx, document-upload.tsx, pdf-cite-viewer.tsx
│   │   ├── archivo-workspace.tsx, saved-workspace.tsx
│   │   ├── news-feed.tsx, save-button.tsx, admin-settings.tsx
│   │   ├── use-settings-catalog.ts (hook)
│   │   ├── lifecycle-map.tsx, phase-tracker.tsx
│   │   └── expedientes-archivo/    # ← Módulo 8.11
│   │       ├── workspace maestro + sub-componentes
│   ├── page.tsx                      # Landing
│   ├── login/page.tsx
│   ├── chat/ busqueda/ normas/ archivo/ validar/ analizar/ comparar/
│   ├── contratos/ documentos/ expedientes/ expedientes-archivo/
│   ├── necesidades/ evaluacion/ auditoria/ historial/ guardado/
│   ├── alertas/ metricas/ configuracion/
│   └── layout.tsx, globals.css, error.tsx
│
├── lib/                              # 43 librerías
│   ├── auth.ts, supabase/, supabase-server.ts
│   ├── openai-server.ts, pinecone.ts
│   ├── upload-limits.ts
│   ├── legal-chat.ts, legal-eval.ts, legal-analysis.ts
│   ├── legal-citations.ts, legal-compare.ts, legal-taxonomy.ts
│   ├── citation-faithfulness.ts, text-normalization.ts
│   ├── agent-orchestrator.ts
│   ├── documents.ts, indexing-queue.ts, pdf-processing.ts
│   ├── processes.ts, process-agents.ts, process-status.ts
│   ├── expediente-instruccion.ts
│   ├── necesidades.ts, necesidad-ficha.ts
│   ├── contratacion-modulos.ts, permisos-contratacion.ts, actores-contratacion.ts
│   ├── procurement-rules.ts, procedure-catalog.ts
│   ├── contrato-generator.ts, respuesta-generator.ts
│   ├── archivo.ts, archivo-processing.ts, archivo-search.ts
│   ├── expedientes-archivo.ts, expedientes-archivo-actions.ts,
│   │   expedientes-archivo-processing.ts, expedientes-archivo-search.ts
│   ├── corpus-verification.ts, corpus-quality.ts
│   ├── settings-catalog.ts
│   └── operational-verification.ts
│
├── tests/                            # 13 archivos Vitest
│   ├── _manual-eval.test.ts (excluido de CI)
│   ├── citation-faithfulness.test.ts
│   ├── contratacion-modulos.test.ts
│   ├── expediente-instruccion.test.ts
│   ├── expedientes-archivo.test.ts
│   ├── legal-citations.test.ts
│   ├── legal-taxonomy.test.ts
│   ├── necesidades.test.ts
│   ├── permisos-contratacion.test.ts
│   ├── procurement-rules.test.ts
│   ├── text-normalization.test.ts
│   ├── documents.test.ts
│   └── archivo.test.ts
│
├── scripts/                          # Node workers
│   ├── indexing-worker.mjs           # cron drainer de indexación
│   ├── operational-smoke-test.mjs   # smoke tests pre-deploy
│   └── md_to_pdf.cjs                  # utilidad docs
│
├── docs/
│   ├── ARQUITECTURA.md
│   ├── OPERACIONES.md
│   ├── MODULO-EXPEDIENTES.md
│   ├── SDD-ACE.md                    # ← este documento
│   ├── SDD-EXPEDIENTES-ARCHIVO.md
│   └── supabase/
│       ├── schema.sql                 # DDL principal
│       ├── archivo.sql                # DDL archivo administrativo
│       └── expedientes-archivo.sql    # DDL expedientes archivados
│
├── normas/, documentos/             # artefactos
├── types/                            # typings (pdf-parse)
├── .claude/ .next/ node_modules/      # excluidos de git
│
├── .env.example, .env.local          # config
├── .gitignore
├── eslint.config.mjs                 # lint Next + TS
├── next.config.ts                    # config Next
├── tsconfig.json                     # strict + paths
├── vitest.config.ts                  # config tests
├── vercel.json                       # región + cron drain
├── package.json                      # scripts: dev, build, lint, test, ...
└── README.md, SDD_ACE_IA_JURIDICA.md, *.pdf
```

### 4.4 Scripts npm

```jsonc
{
  "dev":              "next dev",
  "build":            "next build",
  "start":            "next start",
  "lint":             "eslint app next.config.ts eslint.config.mjs",
  "typecheck":        "tsc --noEmit",
  "test":             "vitest run",
  "test:watch":       "vitest",
  "test:operational": "node scripts/operational-smoke-test.mjs",
  "worker:indexing":      "node scripts/indexing-worker.mjs",
  "worker:indexing:once": "node scripts/indexing-worker.mjs --once"
}
```

---

## 5. Modelo de datos

### 5.1 Diagrama lógico de tablas (35+ tablas)

| Tabla | Módulo | Fila típica | Volumen esperado |
|---|---|---|---|
| `profiles` | Auth | usuario con rol | 50-500 |
| `documents` | 8.12 Corpus | PDF del corpus normativo | 1k-10k |
| `document_chunks` | 8.12 | fragmento indexable | 100k-1M |
| `document_summaries` | 8.12 | resumen ejecutivo del documento | 1k-10k |
| `processing_jobs` | 8.12 | log de jobs de indexación | 1k-100k |
| `norma_articulos` | 8.12 | segmentación por artículo (estilo vLex) | 50k-500k |
| `norma_concordancias` | 8.12 | red de citas cruzadas | 10k-100k |
| `entity_settings` | 8.19 | singleton: RUC + datos entidad | 1 |
| `process_type_settings` | 8.19 | catálogo tipos de proceso | 5-20 |
| `chat_sessions` | 8.1 | sesión de chat privada | 1k-100k |
| `chat_messages` | 8.1 | mensaje (user/assistant/system) | 10k-1M |
| `chat_sources` | 8.1 | fragmento citado por mensaje | 100k-10M |
| `chat_response_notes` | 8.1 | nota + feedback (correct/incorrect) | 1k-50k |
| `ai_feedback_examples` | 8.1 | ejemplos de feedback humano | 100-5k |
| `normative_comparisons` | 8.5 | comparación A/B entre normas | 100-10k |
| `document_analyses` | 8.3 | análisis de documento (privado) | 1k-50k |
| `procurement_processes` | 8.8 | expediente de contratación | 100-5k |
| `process_documents` | 8.8 | documento del proceso | 1k-50k |
| `process_evaluations` | 8.8 | matriz de evaluación | 100-5k |
| `process_risks` | 8.8 | riesgos por proceso | 100-5k |
| `process_cotizaciones` | 8.8 | cotizaciones del estudio de mercado | 1k-50k |
| `necesidades` | 8.7 | necesidad pública | 1k-50k |
| `necesidad_documentos` | 8.7 | docs de la necesidad | 1k-50k |
| `riesgo_necesidad` | 8.7 | riesgos por necesidad | 100-10k |
| `archivo_documentos` | 8.10 | archivo administrativo | 1k-50k |
| `archivo_chunks` | 8.10 | chunks del archivo | 50k-500k |
| `expedientes_archivo` | 8.11 | biblioteca de expedientes físicos | 1k-50k |
| `expedientes_archivo_chunks` | 8.11 | chunks con OCR | 50k-500k |
| `audit_logs` | 13 | bitácora central | 100k-1M+ |
| `boletin_eventos` | 8.14 | feed de novedades | 1k-50k |
| `seguimientos` | 8.14 | tópicos seguidos por usuario | 100-10k |
| `carpetas` | 8.13 | carpetas privadas | 100-5k |
| `guardados` | 8.13 | items guardados | 1k-100k |
| `eval_preguntas` | 8.18 | banco de preguntas | 50-500 |
| `eval_corridas` | 8.18 | corrida de evaluación | 10-100 |
| `eval_resultados` | 8.18 | resultado por pregunta | 1k-50k |

### 5.2 Funciones y triggers SQL importantes (`docs/supabase/schema.sql`)

| Función/Trigger | Propósito |
|---|---|
| `set_updated_at()` + triggers `set_*_updated_at` | Mantener `updated_at` automático en todas las tablas |
| `handle_new_user()` (trigger `on_auth_user_created`) | Bootstrap: primer usuario `admin`, resto `consulta` |
| `is_admin() / is_editor() / is_dec() / is_legal() / is_expediente_colaborador()` | `SECURITY DEFINER` que evita recursión de RLS |
| `set_necesidad_codigo()` + `necesidad_codigo_seq` | Genera `REQ-YYYY-NNNN` automático |
| `admin_metrics()` RPC | JSON agregado para panel admin (counts por status, type, etc.) |
| `corpus_facets()` RPC | Conteos por dimensión (tipo, proceso, año) para `/api/facets` |
| `distinct_audit_actions()` RPC | Lista de `action` distintos en audit_logs |

### 5.3 Storage

- **Bucket**: `documents` (configurable vía `SUPABASE_STORAGE_BUCKET`).
- Límite 104 MB por archivo, MIME `application/pdf`.
- RLS: select para `authenticated`, write para `service_role`.
- Path: `${YYYY}/${MM}/${uuid}-${nombre-saneado}`.

### 5.4 Diagrama de relaciones (simplificado)

```
                 ┌────────────┐
                 │ auth.users │  (Supabase managed)
                 └─────┬──────┘
                       │ 1:1
                       ▼
                 ┌────────────┐
                 │  profiles  │
                 │ role, ofi- │
                 │ cina, etc. │
                 └─────┬──────┘
                       │ 1:N
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
 ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐
 │chat_     │  │saved     │  │procurement_  │  │carpetas  │
 │sessions  │  │(items)   │  │processes     │  │          │
 └────┬─────┘  └────┬─────┘  └────┬─────────┘  └────┬─────┘
      │             │             │               │
      ▼             ▼             ▼               ▼
chat_messages   guardados  process_documents  guardados.carpeta_id
   (1:N)        (1:N)        (1:N)            (N:1)
      │             │             │
      ▼             │             ▼
chat_sources       │       process_evaluations
chat_response_notes│       process_risks
                   │
                   ▼
              documents (corpus, compartido, lectura abierta)
                   │ 1:N
                   ▼
            document_chunks ──── pinecone_vector_id
                   │
                   ▼
              norma_articulos ──→ norma_concordancias (red)
                   │
                   ▼
              document_summaries, processing_jobs, boletin_eventos
```

---

## 6. Capa de IA: pipelines y anti-alucinación

### 6.1 Modelos OpenAI

Definidos en `lib/openai-server.ts` (env-driven).

| Variable | Default | Uso | Temp | Max tokens |
|---|---|---|---|---|
| `OPENAI_LEGAL_MODEL` (`legalAnswerModel`) | `gpt-4.1-mini` | Chat principal, análisis, comparaciones | 0.2 | 450-1800 según longitud |
| `OPENAI_PDF_OCR_MODEL` (`pdfOcrModel`) | `gpt-4o-mini` | OCR de PDFs escaneados (`responses.create` + `file_id`) | 0 | 12000 |
| `ocrFallbackModel` (constante) | `gpt-4o` | OCR fallback si mini rechaza el PDF | 0 | 12000 |
| `OPENAI_EMBEDDING_MODEL` (`embeddingModel`) | `text-embedding-3-small` | Embeddings 1536 dim para Pinecone (evita cuota mensual mayor) | — | — |
| `OPENAI_RERANK_MODEL` (`rerankModel`) | `gpt-4o-mini` | Declarado; el reranking real va por Cohere | — | — |
| `COHERE_RERANK_MODEL` | `rerank-v3.5` | Reranking real de búsqueda | — | — |

### 6.2 Pipelines principales

#### 6.2.1 Búsqueda híbrida (semántica + léxica)

```
                       query
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
   Pinecone (semántica)         Supabase (léxica)
   - embedding text-embed-3-    - tokenización + ilike
     small 1536 dim              - índice GIN trigrama
   - namespace `legal-`         - tabla document_chunks
     documents                   - columna `content`
   - filtros: year, process-    - BM25-like scoring
     type, article, etc.
            │                         │
            └────────────┬────────────┘
                         ▼
                 dedup por chunkId
                         │
                         ▼
                 Cohere rerank-v3.5
                 (top-30 max, query 4k,
                  doc 4k chars)
                         │
                         ▼
                 evidenceQualityScore
                 (jerarquía + BM25 +
                  semántica + boosts)
                         │
                         ▼
                   Top-K final
```

#### 6.2.2 Chat con RAG (`/api/chat`)

1. Validar query (Zod, 3-800 chars).
2. `searchLegalSources` con `topK=10` + filtros del chat.
3. Si la búsqueda no es semánticamente relevante → devolver respuesta fija de "fuera de tema" sin generar.
4. Cohere rerank → `LegalSource[]`.
5. Selección jerárquica: para cada tipo (ley→reglamento→directiva→opinion) tomar top-N (2/2/2/1).
6. Búsqueda anclada a proceso (query + aliases + anchors del `procedure-catalog`) — top-14.
7. Búsqueda amplia sin filtro `documentType` (broad normativa).
8. Pasadas forzadas por `documentType` crítico (reglamento/directiva del procedimiento).
9. Filtra por `sourceSupportsProcess`, rerankea, selecciona top-8 por jerarquía.
10. `prepareLegalAnswer` con prompt jerárquico (ley > reglamento > directiva > opinion), `temperature: 0.2`.
11. `citation-faithfulness`: cifra ↔ fragmento citado.
12. `groundingViolations`: detectar citas de la Ley 30225/344-2018 derogadas.
13. Si pasa, persistir `chat_messages` con metadata JSONB (`sources`, `assessment`, `groundingViolations`).
14. `writeAuditLog("chat.message", ...)`.

#### 6.2.3 Orquestador de procedimientos (`/api/orchestrate`)

1. `planAgents` infiere el intent (consulta_normativa, riesgos, contrato, etc.) y selecciona agentes.
2. **Inferencia determinista** (regex en texto) de: `amount`, `objectType`, `procedureType`, `standardized`, `validOffers`, `hasTechnicalFile`, `marketPlurality`.
3. `evaluateProcurementRules` ejecuta reglas por tipo de procedimiento (CP/SIE/CD/LP/CON/AS/AM/SCI).
4. Conclusión inicial: `procede | no_procede | requiere_revision`.
5. `searchLegalSources` + `assessCriticalSources`: si faltan críticas, degrada a `requiere_revision`.
6. Devuelve `plan + inferredContext + rules + legal + critical` al cliente.

#### 6.2.4 Indexación de PDFs (8.12 + 8.11)

1. `pdf-parse` (texto seleccionable, ≥120 chars).
2. Si < 120 chars, **OCR con Vision**:
   - 1er intento: `responses.create` + `file_id` (gpt-4o-mini).
   - 2do intento (fallback): `chat.completions` + data URL base64.
   - 3er intento (fallback): `gpt-4o` (más capaz para escaneados).
3. **Segmentación**:
   - Si los artículos cubren ≥50% del texto → `chunkByArticles` (cada artículo = 1 chunk).
   - Si no → `chunkPages` (2600 chars + 350 overlap).
4. `analyzeDocumentWithAi` extrae JSON: `documentType, number, year, topic, vigencia, status, summary, keyPoints, relatedArticles, practicalImpact, amends, confidence`.
5. `extractStructuredLegalMetadata`: regex sobre `artículos, numerales, disposiciones, señales de vigencia, relaciones (modifica/deroga/reglamenta/complementa/remite), emisor`.
6. INSERT chunks + artículos + concordancias.
7. Embeddings + upsert Pinecone.
8. `verifyDocumentIndexedInPinecone` con backoff.
9. PATCH status='indexed', INSERT `boletin_eventos` (documento_nuevo / modificatoria / vigencia).

### 6.3 Anti-alucinación (3 capas)

| Capa | Componente | Detecta | Acción |
|---|---|---|---|
| 1. **Capa prompt** | `lib/legal-chat.ts:1649-1698` | Normas derogadas (Ley 30225, 344-2018) | Prohibición explícita en el system prompt |
| 2. **Capa post-generación** | `citation-faithfulness.ts` | Cifras infieles (UIT, S/, %, fechas) que no aparecen en el excerpt | `score = 0` en eval; warning en UI |
| 3. **Capa cobertura** | `assessSources` + `scope check` | Fuentes trazables, derogadas, no-semánticas, fuera de tema | `sufficient: false` → `respuesta_requiere_revision` en audit log |

### 6.4 Jerarquía normativa

```
ley:           rank 4 (máxima autoridad)
reglamento:    rank 3
directiva:     rank 2
opinion:       rank 1
bases_integradas: rank 0
```

En el RAG, cuando la respuesta mezcla tipos, el prompt indica "siempre cita primero
la ley, luego el reglamento que la desarrolla, luego la directiva, y solo al
final una opinión si refuerza la interpretación". El retrieval ordena por
`priority desc` y `evidenceQuality desc`.

---

## 7. Autenticación, navegación y shell

### 7.1 Auth flow

```
[Request] → proxy.ts (matcher global)
                ↓
   lib/supabase/middleware.ts:updateSession
       ├─ createServerClient con cookies
       ├─ supabase.auth.getUser() (valida JWT, refresca cookies)
       └─ /api/* sin auth → 401 JSON
          otras sin auth → 302 /login?next=…

[Login] → app/login/page.tsx
                ↓
   <LoginForm> → signInWithPassword()
                ↓
   router.push(next) + router.refresh()

[Signout] → POST /auth/signout (form action del sidebar)
                ↓
   supabase.auth.signOut() → 303 /login
```

### 7.2 Server-side session (`lib/auth.ts`)

`getSessionUser()` (118-150):
- `supabase.auth.getUser()` + `getSession()` en paralelo.
- `fetchProfile()` carga `profiles` con tolerancia a columnas faltantes.
- `normalizeRole()` mapea `editor`→`dec` y `user`→`consulta`.
- `parsePermissions()` extrae `permissions[]` del `metadata` JSONB.
- Devuelve `SessionUser` con flags derivadas: `isAdmin, isDec, isEditor, isLegal`.

Guards de API:
- `requireUser()` → 401 si no auth.
- `requireAdmin()` → 403 si no admin.
- `requireDec()` / `requireEditor()` (alias) → 403 si no dec/admin.
- `requireLegal()` → 403 si no legal/admin.
- `requireCapability(cap)` → 403 vía `roleHasCapability`.

### 7.3 Sidebar (`app/components/sidebar.tsx`, 291 líneas)

Client component con:
- 6 secciones de navegación (General, Consultar, Revisar, Trabajo, Organizar, Administrar).
- Bloqueo por rol: items con `adminOnly` se muestran como `<span class="navLocked">` con el label del rol requerido en lugar del `<Link>`.
- Persistencia de colapsado en `localStorage` (`ace-sidebar-collapsed`).
- Atajos: `[` o `Ctrl/Cmd+\` alternan colapsado.
- User box inferior con email, etiqueta de rol localizada, contador de permisos, y `<form action="/auth/signout" method="post">`.
- Mobile: botón toggle + scrim.

### 7.4 App shell (`app/components/app-shell.tsx`, 44 líneas)

Server component que arma el layout principal:
- Carga en paralelo: `getSessionUser()` + `countRecentNews()` (últimos 14 días en `boletin_eventos`).
- Estructura: `<main class="shell">` con `<Sidebar>` y `<section class="content">` que incluye `header.topbar` y `{children}`.
- Consumido por 22 páginas.

### 7.5 Settings catalog (`lib/settings-catalog.ts`)

- `getSettingsCatalog(user)`: carga en paralelo `entity_settings` (singleton) + `process_type_settings` (activas, ordenadas).
- `permissionsForUser(user)`: si `user.permissions` vacío → `areasForRole(user.role)`.
- Endpoint: `GET /api/settings/catalog` con `requireUser()`.
- Hook cliente: `useSettingsCatalog()` con `useEffect` + cancelación.

---

## 8. Módulos del sistema

Cada módulo se documenta con: propósito, archivos clave, modelo de datos,
flujo, roles, endpoints, integraciones.

### 8.1 Chat jurídico con fuentes

- **Propósito:** Asistente conversacional RAG con respuesta fundamentada, citas
  `[F#]` y anti-alucinación.
- **Archivos clave:** `app/chat/page.tsx` · `app/components/legal-chat.tsx` ·
  `app/components/chat-history.tsx` · `lib/legal-chat.ts` (1251 líneas) ·
  `app/api/chat/route.ts` · `app/api/chat/sessions` · `app/api/chat/messages/[id]`.
- **Modelo de datos:** `chat_sessions`, `chat_messages`, `chat_sources`,
  `chat_response_notes` (todas con RLS por owner).
- **Flujo:** query → búsqueda híbrida → rerank Cohere → selección jerárquica →
  prompt OpenAI → faithfulness check → persistir.
- **Roles:** todos los autenticados.
- **Endpoints:** `POST /api/chat`, `GET /api/chat/sessions`, `PATCH /api/chat/messages/[id]`
  (acciones `save_note`, `mark_correct`, `mark_incorrect`),
  `GET /api/chat/messages/[id]/export` (docx).
- **Integraciones:** OpenAI (`gpt-4.1-mini`), Cohere, Pinecone `legal-documents`,
  `citation-faithfulness`.

### 8.2 Búsqueda semántica sobre el corpus

- **Propósito:** Búsqueda RAG explícita (top-K) sin generación, con citas,
  evaluación de cobertura y nivel de confianza.
- **Archivos clave:** `app/busqueda/page.tsx` · `app/components/semantic-search.tsx` ·
  `lib/legal-citations.ts` · `app/api/search/route.ts`.
- **Modelo:** mismos chunks que chat.
- **Flujo:** query → expansión con sinónimos legales + detección de artículo →
  búsqueda híbrida → rerank → `evidenceQualityScore` → sources + assessment.
- **Roles:** todos.
- **Endpoints:** `POST /api/search`, `POST /api/norms/[id]/semantic`.
- **Integraciones:** OpenAI (rerank), Pinecone, Supabase.

### 8.3 Análisis de documentos

- **Propósito:** Análisis jurídico de PDFs contra el corpus con checklist, cláusulas
  obligatorias (art. 60 Ley 32069) y findings.
- **Archivos clave:** `app/analizar/page.tsx` · `app/components/document-analyzer.tsx` ·
  `app/components/document-upload.tsx` · `app/components/pdf-cite-viewer.tsx` ·
  `lib/legal-analysis.ts` · `app/api/analyze/route.ts`.
- **Modelo:** `document_analyses` (result JSONB con checklist/clausulas/findings).
- **Flujo:** upload PDF → extractPdfPlainText → regex cláusulas art. 60 →
  `searchLegalSources` → OpenAI genera resumen + findings → persistir.
- **Roles:** todos.
- **Endpoints:** `GET /api/analyze` (historial), `POST /api/analyze`,
  `POST /api/analyze/export`.
- **Integraciones:** OpenAI, Pinecone, `pdf-processing`, `procedure-catalog`.

### 8.4 Validador de procedimientos (orquestador)

- **Propósito:** Agente que valida procedencia del procedimiento combinando
  motor de reglas + búsqueda legal + inferencia de contexto.
- **Archivos clave:** `app/validar/page.tsx` · `app/components/procedure-validator.tsx` ·
  `lib/procurement-rules.ts` (`evaluateProcurementRules`) · `lib/process-agents.ts` ·
  `lib/agent-orchestrator.ts` · `app/api/orchestrate/route.ts`.
- **Modelo:** `procurement_processes`, `process_evaluations`, `guardados`.
- **Flujo:** query → `planAgents` → inferencia regex de contexto →
  `evaluateProcurementRules` (CP/SIE/CD/LP/CON/AS/AM/SCI) → `searchLegalSources` +
  `assessCriticalSources` → conclusion (procede / no_procede / requiere_revision).
- **Roles:** todos.
- **Endpoints:** `POST /api/orchestrate`, `POST /api/orchestrate/save`,
  `POST /api/orchestrate/export`.
- **Integraciones:** OpenAI, Pinecone, `procedure-catalog`,
  `citation-faithfulness`.

### 8.5 Comparación normativa A/B

- **Propósito:** Comparar dos cuerpos normativos (Lado A vs Lado B) sobre un tema
  con análisis de coincidencias, diferencias, jerarquía y vigencia.
- **Archivos clave:** `app/comparar/page.tsx` · `app/components/normative-compare.tsx` ·
  `lib/legal-compare.ts` · `app/api/compare/route.ts`.
- **Modelo:** `normative_comparisons` (privadas por owner).
- **Flujo:** topic + sideA + sideB → validación distinta → 2 búsquedas Pinecone
  paralelas → si insuficientes `buildNotComparableAnswer` → OpenAI redacta con
  prompt jerárquico + marcadores `[A#][B#]` → persistir.
- **Roles:** todos.
- **Endpoints:** `POST /api/compare`.
- **Integraciones:** OpenAI, Pinecone, `legal-taxonomy`.

### 8.6 Navegador normativo

- **Propósito:** Explorador del corpus normativo: lista documentos por tipo,
  muestra artículos, concordancias, citaciones cruzadas y versionado.
- **Archivos clave:** `app/normas/page.tsx` · `app/components/normative-browser.tsx` ·
  `app/api/norms/route.ts` · `app/api/norms/[id]` · `app/api/norms/[id]/semantic` ·
  `app/api/norms/articles/[id]/citing` · `app/api/norms/versions`.
- **Modelo:** `documents`, `document_chunks`, `document_summaries`,
  `norma_articulos`, `norma_concordancias`, `processing_jobs`.
- **Flujo:** GET `/api/norms?category=` con joins a `norma_articulos(count)`;
  enriquecimiento con chunks, summaries, concordancias; `qualityStatus: lista|revisar`
  (artículos>0 + páginas>0 + verificado); versión agrupada por `documentNumber`/`title`.
- **Roles:** todos.
- **Endpoints:** `GET /api/norms`, `GET /api/norms/[id]`, `POST /api/norms/[id]/semantic`,
  `GET /api/norms/articles/[id]/citing`, `GET /api/norms/versions`.
- **Integraciones:** Supabase (joins), Pinecone. Sin OpenAI directo en UI.

### 8.7 Necesidades (OECE) — Módulo 1

- **Propósito:** Registrar necesidad pública del área usuaria, generar ficha
  técnica con código único `REQ-YYYY-NNNN`, y derivar al expediente.
- **Archivos clave:** `app/necesidades/page.tsx` · `app/necesidades/[id]` ·
  `app/components/necesidad-list.tsx` · `app/components/necesidad-detail.tsx` ·
  `lib/necesidades.ts` · `lib/necesidad-ficha.ts` · `app/api/necesidades/*`.
- **Modelo:** `necesidades` (~50 columnas: codigo, anio_fiscal, finalidad_publica,
  pei_*, tipo_objeto, monto_estimado, plazo_ejecucion, status enum, 11 estados),
  `necesidad_documentos`, `riesgo_necesidad`.
- **Flujo:** create necesidad (status `pendiente_revision`) → generar ficha .docx →
  derivar (crea `procurement_processes` con status `actuaciones_preparatorias`,
  marca `incorporado_cmn` con `process_id`) → subir docs.
- **Roles:** `area_usuaria`, `ate`, `dec` (manage); derivar: `dec`, `aga`, `admin`.
- **Endpoints:** `GET/POST /api/necesidades`, `GET/PATCH/DELETE /api/necesidades/[id]`,
  `GET /api/necesidades/[id]/ficha`, `POST /api/necesidades/[id]/derivar`,
  `POST /api/necesidades/[id]/documentos`.
- **Integraciones:** Supabase, `docx`. Sin OpenAI directo.

### 8.8 Expedientes de proceso — Módulos 2-10

- **Propósito:** Módulo central del ciclo de contrataciones (11 etapas).
  Crea, instruye, evalúa, declara desierto, archiva y muestra ciclo de vida.
- **Archivos clave:** `app/expedientes/page.tsx` · `app/expedientes/[id]` ·
  `app/components/process-list.tsx` · `app/components/process-detail.tsx` ·
  `app/components/lifecycle-map.tsx` · `app/components/phase-tracker.tsx` ·
  `lib/processes.ts` · `lib/expediente-instruccion.ts` (`instruirExpediente`) ·
  `lib/process-status.ts` (`reconcileProcessStatus`) · `app/api/processes/*`.
- **Modelo:** `procurement_processes` (~25 columnas Ley 32069: valor_estimado,
  sistema_contratacion, autoridad_aprobacion), `process_documents`,
  `process_evaluations`, `process_risks`, `process_cotizaciones`.
- **Flujo:** create proceso → subir PDFs o vincular desde biblioteca → `reconcileProcessStatus`
  infiere nueva etapa (avanza solo hacia adelante) → evaluate (matriz por postor)
  → risks → draft (.docx) → declarar_desierto (terminal) o archive_to_library
  (migra a `expedientes_archivo`).
- **Roles:** manage: `dec`, `aga`, `titular`, `admin`; upload: `area_usuaria`, `ate`, `dec`,
  `oficial_compra`, `comite`, `aga`, `admin`; evaluate: `dec`, `oficial_compra`, `comite`,
  `jurado`, `admin`; risks: `dec`, `legal`, `admin`; drafts: `dec`, `oficial_compra`,
  `comite`, `legal`, `admin`; execute: `area_usuaria`, `dec`, `admin`; approve:
  `titular`, `legal`, `admin`.
- **Endpoints:** `GET/POST /api/processes`, `GET/PATCH/DELETE /api/processes/[id]`,
  `GET/POST /api/processes/[id]/documents`, `POST /api/processes/[id]/evaluate|risks|draft|desierto|archive-to-library`.
- **Integraciones:** OpenAI, Pinecone, `docx`, `lib/contratacion-modulos.ts` (ciclo 11 etapas),
  `lib/actores-contratacion.ts` (responsables).

### 8.9 Contratos — Módulo 11

- **Propósito:** Generar borradores de contrato .docx con cláusulas obligatorias
  del art. 60 Ley 32069, referencias normativas del corpus y datos de la entidad.
- **Archivos clave:** `app/contratos/page.tsx` · `app/components/contract-form.tsx` ·
  `lib/contract-generator.ts` · `app/api/contracts/generate/route.ts`.
- **Modelo:** no persiste; solo genera docx. Lee de `norma_articulos` (art. 60, 61).
- **Flujo:** Zod validation → `getSettingsCatalog` (entity) → `buildContractDocx`
  con cláusulas (objeto, monto, plazo, garantías, anticorrupción, controversias,
  resolución, riesgos) y referencias normativas.
- **Roles:** todos.
- **Endpoints:** `POST /api/contracts/generate` (retorna blob).
- **Integraciones:** `docx`, Supabase, `settings-catalog`, `legal-taxonomy`. Sin OpenAI.

### 8.10 Archivo municipal

- **Propósito:** Repositorio de documentos administrativos propios de la entidad
  (resoluciones, acuerdos, ordenanzas, oficios, informes) con namespace Pinecone
  separado.
- **Archivos clave:** `app/archivo/page.tsx` · `app/components/archivo-workspace.tsx` ·
  `lib/archivo.ts` · `lib/archivo-search.ts` · `lib/archivo-processing.ts` ·
  `app/api/archivo/*`.
- **Modelo:** `archivo_documentos` (doc_kind enum, document_number, fecha, asunto,
  status), `archivo_chunks`.
- **Flujo:** upload PDF (editor) → `processArchivoDocument` (background): extrae texto,
  regex `documentNumber`/`fecha`, IA analiza (asunto/summary), fragmenta,
  upsert Pinecone namespace `archivo-municipal` → search + chat con citas [D#].
- **Roles:** lectura todos; escritura `editor` (dec/admin).
- **Endpoints:** `GET/POST /api/archivo`, `GET/POST/DELETE /api/archivo/[id]`,
  `POST /api/archivo/search`, `POST /api/archivo/chat`.
- **Integraciones:** OpenAI, Pinecone `archivo-municipal`, Supabase Storage.

### 8.11 Biblioteca de expedientes archivados

> **Documento SDD específico:** [`docs/SDD-EXPEDIENTES-ARCHIVO.md`](SDD-EXPEDIENTES-ARCHIVO.md)

- **Propósito:** Biblioteca de expedientes físicos escaneados (PDF) con
  ubicación física exacta (estante, archivador, color, folio) y búsqueda
  semántica + RAG + Mesa de Partes con respuesta asistida.
- **Archivos clave:** `app/expedientes-archivo/page.tsx` ·
  `app/components/expedientes-archivo-workspace.tsx` · carpeta
  `expedientes-archivo/` (chat-panel, bulk-move-modal, replace-file-modal,
  tabla-expedientes, tarjetas-expedientes, command-palette) ·
  `lib/expedientes-archivo*.ts` · `app/api/expedientes-archivo/*`.
- **Modelo:** `expedientes_archivo`, `expedientes_archivo_chunks` (con RLS
  por editor para escritura).
- **Flujo:** Ver documento completo (4 pasos, 6 sub-pestañas, ⌘K, drag-and-drop).
- **Roles:** lectura todos; escritura `editor`; admin total.
- **Endpoints:** 11 endpoints + 2 de respuesta.
- **Integraciones:** OpenAI, Pinecone `expedientes-archivo`, Supabase.

### 8.12 Documentos (biblioteca PDF)

- **Propósito:** Biblioteca del corpus normativo: subida, listado, indexado,
  reindex, eliminación masiva, importación desde Drive/S3.
- **Archivos clave:** `app/documentos/page.tsx` · `app/api/documents/*` ·
  `lib/documents.ts` (`resolveDocumentProcessType`) · `lib/indexing-queue.ts` ·
  `lib/pdf-processing.ts` (`processPdfForSearch`) ·
  `scripts/indexing-worker.mjs`.
- **Modelo:** `documents` (id, title, document_type, process_type, source_entity,
  status, storage_*, metadata: amends, changeCategory, originalLastModified,
  pinecone.verification), `document_chunks`, `document_summaries`,
  `processing_jobs`, `norma_articulos`, `norma_concordancias`.
- **Flujo:** upload (valida tipo + monto + dec/admin) → storage → INSERT con
  `status: 'uploaded'` → `after()` background descarga de Storage, llama
  `processPdfForSearch` (extrae texto, OCR si escaneado, detecta artículos,
  fragmenta, upsert Pinecone namespace `legal-documents`, escribe artículos y
  concordancias) → status `indexed` + boletin_eventos.
- **Roles:** lectura todos; escritura `editor`; drain con `Bearer CRON_SECRET`.
- **Endpoints:** `GET/POST/DELETE /api/documents`, `POST /api/documents/import`
  (plan, source: drive|s3), `POST /api/documents/reindex`,
  `GET/POST /api/documents/drain`.
- **Integraciones:** OpenAI (embeddings, OCR, análisis), Pinecone
  `legal-documents`, Supabase Storage/Postgres, `scripts/indexing-worker.mjs`.

### 8.13 Guardados, carpetas y seguimientos

- **Propósito:** Bandeja personal + organización + alertas.
- **Archivos:** `app/guardado/page.tsx` · `app/components/saved-workspace.tsx` ·
  `app/api/saved`, `app/api/folders`, `app/api/seguimientos`.
- **Modelo:** `guardados` (item_type: documento|articulo|mensaje|validacion|analisis;
  title, note, metadata JSONB, carpeta_id, owner_id con RLS) · `carpetas` ·
  `seguimientos` (kind: process|document_type|entity|topic; value; unique on
  (owner_id, kind, value)).
- **Roles:** todos (RLS por owner).
- **Endpoints:** `GET/POST/PATCH/DELETE /api/saved`, `GET/POST /api/folders`,
  `GET/POST/DELETE /api/seguimientos`.
- **Integraciones:** Supabase. Sin OpenAI.

### 8.14 Alertas / Boletín de novedades

- **Propósito:** Feed de eventos del corpus (documentos nuevos, modificatorias,
  indexaciones) con filtrado por seguimientos del usuario.
- **Archivos:** `app/alertas/page.tsx` · `app/components/news-feed.tsx` ·
  `app/api/boletin/route.ts`.
- **Modelo:** `boletin_eventos` (event_type, document_id, document_type,
  process_type, source_entity, topic, title, summary, created_at).
- **Flujo:** GET últimos 60 eventos + seguimientos del usuario → `isRelevant`
  marca cada evento si matchea un seguimiento → badge en sidebar (`newsCount`).
- **Roles:** todos.
- **Endpoints:** `GET /api/boletin`.
- **Integraciones:** Supabase. Sin OpenAI.

### 8.15 Historial de actividad

- **Propósito:** Línea de tiempo unificada de actividad del usuario.
- **Archivos:** `app/historial/page.tsx` · `app/components/legal-activity.tsx` ·
  `app/api/activity/route.ts`.
- **Modelo:** agrega `chat_sessions`, `guardados`, `document_analyses`,
  `process_evaluations`.
- **Flujo:** 4 queries en paralelo → mapea a `ActivityItem` con
  `origin/createdAt/title/detail/href/confidence/sourceCount/processType` →
  top 60 ordenado por fecha.
- **Roles:** todos.
- **Endpoints:** `GET /api/activity`.

### 8.16 Auditoría

- **Propósito:** Visor de logs de auditoría para admin.
- **Archivos:** `app/auditoria/page.tsx` · `app/components/audit-explorer.tsx` ·
  `app/api/audit/route.ts`.
- **Modelo:** `audit_logs` (action, entity_type, entity_id, details JSONB,
  created_at) + RPC `distinct_audit_actions`.
- **Roles:** solo admin.
- **Endpoints:** `GET /api/audit`.

### 8.17 Métricas de uso

- **Propósito:** Dashboard admin de monitoreo: métricas agregadas, errores
  recientes de indexación y actividad reciente.
- **Archivos:** `app/metricas/page.tsx` · `app/components/metrics-dashboard.tsx` ·
  `app/api/metrics/route.ts` · `app/api/usage/route.ts` · `app/api/eval/route.ts`.
- **Modelo:** RPC `admin_metrics`; `documents` filtrado `status=error`;
  `audit_logs` recientes; `chat_messages` (30 días).
- **Roles:** solo admin.

### 8.18 Evaluación continua del RAG (corpus eval)

- **Propósito:** Banco curado de preguntas, corridas de scoring, feedback y
  verificación de corpus.
- **Archivos:** `app/evaluacion/page.tsx` · `app/components/eval-dashboard.tsx` ·
  `lib/legal-eval.ts` (`runEvaluation`, `seedBaselineEvalQuestions`) ·
  `lib/corpus-quality.ts` · `lib/corpus-verification.ts` ·
  `app/api/eval/route.ts` · `app/api/corpus/quality` · `app/api/corpus/verify`.
- **Modelo:** `eval_preguntas` (question, expected_keywords[],
  expected_must_not_contain[], expected_sources[] JSONB, document_type,
  process_type), `eval_corridas` (summary JSONB), `eval_resultados`
  (por pregunta: score, feedback, source_feedback JSONB con grounding violations).
- **Flujo:** `seed` siembra baseline + matrix → `run` ejecuta serialmente cada
  pregunta contra `answerLegalQuestion(persist:false)` → score (keywordHitRatio +
  expectedSourceHitRatio + grounding checks + faithfulness) → si violation
  → score 0 → persistir.
- **Roles:** solo admin.

### 8.19 Configuración y matriz de roles

- **Propósito:** Panel admin: entidad, catálogo de tipos de proceso, usuarios
  y matriz de roles/permisos.
- **Archivos:** `app/configuracion/page.tsx` · `app/components/admin-settings.tsx` ·
  `app/api/configuracion` · `app/api/settings/catalog` · `lib/settings-catalog.ts` ·
  `lib/permisos-contratacion.ts`.
- **Modelo:** `entity_settings` (singleton: name, ruc 11d, executing_unit 6d,
  address, government_level) · `process_type_settings` (code, label, category,
  object, legal_basis, frequent_municipality, sort_order, active) · `profiles`
  (id, email, role, entity, metadata.permissions[]).
- **Flujo:** GET entity + processTypes + profiles (con `requireAdmin`) → PUT
  upsert entity + processTypes → POST `create_user` con `supabase.auth.admin.createUser` +
  `upsertProfile` → `seed_role_users` crea usuarios `{rol}@ace.local`.
- **Roles:** solo admin.
- **Endpoints:** `GET/PUT/POST/PATCH/DELETE /api/configuracion`,
  `GET /api/settings/catalog`.
- **Integraciones:** Supabase Admin, `lib/permisos-contratacion.ts`,
  `lib/legal-taxonomy`. Sin OpenAI.

---

## 9. API REST consolidada

> **60+ endpoints.** Lista exhaustiva con método, ruta, auth y propósito. Todas
> usan `runtime: "nodejs"`, `dynamic: "force-dynamic"`. Las acciones de escritura
> llaman `writeAuditLog`. Validación con Zod en cliente y servidor.

### 9.1 Por módulo

| Módulo | Endpoints |
|---|---|
| **Auth** | `POST /api/auth/signout` |
| **Chat (8.1)** | `POST /api/chat` · `GET /api/chat/sessions` · `PATCH /api/chat/messages/[id]` · `GET /api/chat/messages/[id]/export` |
| **Búsqueda (8.2)** | `POST /api/search` · `GET /api/facets` |
| **Análisis (8.3)** | `GET/POST /api/analyze` · `POST /api/analyze/export` |
| **Orquestador (8.4)** | `POST /api/orchestrate` · `POST /api/orchestrate/save` · `POST /api/orchestrate/export` |
| **Comparación (8.5)** | `POST /api/compare` |
| **Normativa (8.6)** | `GET /api/norms` · `GET /api/norms/[id]` · `POST /api/norms/[id]/semantic` · `GET /api/norms/articles/[id]/citing` · `GET /api/norms/versions` |
| **Necesidades (8.7)** | `GET/POST /api/necesidades` · `GET/PATCH/DELETE /api/necesidades/[id]` · `GET /api/necesidades/[id]/ficha` · `POST /api/necesidades/[id]/derivar` · `GET/POST/DELETE /api/necesidades/[id]/documentos` |
| **Procesos (8.8)** | `GET/POST /api/processes` · `GET/PATCH/DELETE /api/processes/[id]` · `GET/POST /api/processes/[id]/documents` · `POST /api/processes/[id]/evaluate` · `POST /api/processes/[id]/risks` · `POST /api/processes/[id]/draft` · `POST /api/processes/[id]/desierto` · `POST /api/processes/[id]/archive-to-library` |
| **Contratos (8.9)** | `POST /api/contracts/generate` |
| **Archivo (8.10)** | `GET/POST /api/archivo` · `GET/POST/DELETE /api/archivo/[id]` · `POST /api/archivo/search` · `POST /api/archivo/chat` |
| **Expedientes archivados (8.11)** | `GET/POST /api/expedientes-archivo` · `GET/POST/PUT/PATCH/DELETE /api/expedientes-archivo/[id]` · `POST /api/expedientes-archivo/bulk` · `GET /api/expedientes-archivo/export` · `GET /api/expedientes-archivo/duplicates` · `POST /api/expedientes-archivo/ai-search` · `POST /api/expedientes-archivo/search` · `POST /api/expedientes-archivo/extract` · `POST /api/expedientes-archivo/chat` · `POST /api/expedientes-archivo/respuesta/generate` · `POST /api/expedientes-archivo/respuesta/export` |
| **Documentos (8.12)** | `GET/POST/DELETE /api/documents` · `POST /api/documents/[id]` · `POST /api/documents/import` · `POST /api/documents/reindex` · `GET/POST /api/documents/drain` |
| **Guardados (8.13)** | `GET/POST/PATCH/DELETE /api/saved` · `GET/POST /api/folders` · `GET/POST/DELETE /api/seguimientos` |
| **Alertas (8.14)** | `GET /api/boletin` |
| **Historial (8.15)** | `GET /api/activity` |
| **Auditoría (8.16)** | `GET /api/audit` |
| **Métricas (8.17)** | `GET /api/metrics` · `GET /api/usage` · `GET/POST/DELETE /api/eval` |
| **Configuración (8.19)** | `GET/PUT/POST/PATCH/DELETE /api/configuracion` · `GET /api/settings/catalog` |
| **Calidad de corpus (8.18)** | `GET /api/corpus/quality` · `GET /api/corpus/verify` · `GET /api/system/verify` · `GET /api/health` · `GET /api/integrations/health` |

### 9.2 Códigos de error comunes

| Status | Cuándo |
|---|---|
| 400 | Zod validation fail · payload malformado |
| 401 | Sin sesión (excepto rutas públicas) |
| 403 | Sin rol/capability requerida |
| 404 | Recurso no existe |
| 409 | Conflicto (ej. duplicado) |
| 422 | PDF no procesable por OCR |
| 500 | Error interno |
| 503 | Servicio no configurado (`setupRequired: true`) |

### 9.3 Patrones transversales

- **Rate limiting**: por ahora ausente (considerar para Fase 2).
- **Idempotencia**: reindexar un documento es seguro; borrar y re-crear también.
- **Streaming**: usado en chat (responses streaming).
- **Background jobs**: `after()` para indexación; cron Vercel para drainer.
- **Audit log**: `writeAuditLog` post-acción en TODA escritura.

---

## 10. Pipeline de indexación end-to-end

```
┌────────────────────────────────────────────────────────────────────┐
│  PDF subido por editor (POST /api/documents o /api/expedientes-archivo)│
└─────────────────────────────────┬──────────────────────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
        ┌──────────────────────┐        ┌──────────────────────┐
        │  documents.corpus    │        │  expedientes_archivo │
        │  (8.12)              │        │  (8.11)               │
        │  ns: legal-documents │        │  ns: expedientes-     │
        │                      │        │       archivo         │
        └──────────┬───────────┘        └──────────┬───────────┘
                   │                                │
                   └────────────────┬───────────────┘
                                    ▼
                  ┌────────────────────────────────────┐
                  │  after() background processPdf...  │
                  │  descarga de Storage (PDF re-load) │
                  └────────────────┬───────────────────┘
                                   ▼
                  ┌────────────────────────────────────┐
                  │  extractPdfText                    │
                  │  - pdf-parse (≥120 chars)           │
                  │  - OCR gpt-4o-mini Vision           │
                  │  - fallback gpt-4o (responses)      │
                  │  - fallback gpt-4o (chat+base64)    │
                  └────────────────┬───────────────────┘
                                   ▼
                  ┌────────────────────────────────────┐
                  │  Segmentación                       │
                  │  - extractStructuredLegalMetadata  │
                  │  - segmentArticlesFromPages         │
                  │  - chunkByArticles si ≥50%          │
                  │  - chunkPages si no (2600+350)      │
                  └────────────────┬───────────────────┘
                                   ▼
                  ┌────────────────────────────────────┐
                  │  analyzeDocumentWithAi (OpenAI)     │
                  │  JSON: documentType, number, year, │
                  │  topic, vigencia, status, summary, │
                  │  keyPoints, relatedArticles, etc.   │
                  └────────────────┬───────────────────┘
                                   ▼
                  ┌────────────────────────────────────┐
                  │  Persistir (Supabase)               │
                  │  - document_chunks                  │
                  │  - norma_articulos                  │
                  │  - norma_concordancias (auto)        │
                  │  - document_summaries               │
                  │  - processing_jobs                  │
                  └────────────────┬───────────────────┘
                                   ▼
                  ┌────────────────────────────────────┐
                  │  Embeddings (OpenAI text-embed-3)   │
                  │  - batches de 96, trunc 8000 chars  │
                  │  - 1536 dim                         │
                  │  - upsert Pinecone (batch 25)       │
                  └────────────────┬───────────────────┘
                                   ▼
                  ┌────────────────────────────────────┐
                  │  verifyDocumentIndexedInPinecone    │
                  │  - 5 intentos, backoff exp          │
                  └────────────────┬───────────────────┘
                                   ▼
                  ┌────────────────────────────────────┐
                  │  Status: indexed                    │
                  │  - boletin_eventos (documento_nuevo)│
                  │  - audit_log: document.upload       │
                  └────────────────────────────────────┘

                    [en error → rollback completo:
                     delete vectors + chunks + articulos +
                     concordancias + summaries + PATCH status='error']
```

### 10.1 OCR con Vision

Activación: solo si `pdf-parse` extrae < 120 chars Y `OPENAI_PDF_OCR_ENABLED=true`.

| Modelo | Cuándo |
|---|---|
| `gpt-4o-mini` (default) | Primer intento (`responses.create` + `file_id`) |
| `gpt-4o-mini` (chat.completions + base64) | Si el primero falla o devuelve texto inutilizable |
| `gpt-4o` (constante `ocrFallbackModel`) | Último recurso (más capaz para escaneados) |

Cleanup: el archivo subido a OpenAI se borra en `finally`.

### 10.2 Drainer (`scripts/indexing-worker.mjs`)

- Worker externo polling cada 30s (default `INDEXING_WORKER_INTERVAL_MS`).
- POST a `/api/documents/drain` con `Bearer CRON_SECRET`.
- Auth dual: CRON secret o editor.
- `maxDuration: 300s`, batch 3 (`INDEXING_DRAIN_BATCH`).
- `findStuckDocuments`: `or=(status.eq.uploaded,and(status.eq.processing,updated_at.lt.threshold))`
  con `staleMinutes=10`.
- Cada doc se descarga de Storage, se re-procesa; un error no aborta el batch.

---

## 11. UX/UI — sistema de diseño

### 11.1 Design tokens (`app/styles.css`)

| Token | Valor | Uso |
|---|---|---|
| `--brand` | `#0f766e` (teal-700) | Acento principal, focus, hover |
| `--ink` | `#0f172a` (slate-900) | Texto principal |
| `--muted` | `#64748b` (slate-500) | Texto secundario, labels, placeholders |
| `--line` | `#e2e8f0` (slate-200) | Bordes, separadores |
| `--soft` | `#f0fdfa` (teal-50) | Fondo hover, fondo activo |
| `--bg` | `#f8fafc` (slate-50) | Fondo de inputs, chips |
| `--surface` | `#ffffff` | Fondo de cards, paneles |
| `--danger` | `#b42318` | Errores, validación negativa |
| `--warning` | `#ca8a04` (yellow-600) | Banner duplicados |
| `--focus` | `0 0 0 3px rgba(15,118,110,0.12)` | Anillo de focus |
| `--shadow-soft` | `0 4px 12px rgba(15,23,42,0.04)` | Sombras de cards |

### 11.2 Tipografía

- **Labels**: 11px, uppercase, letter-spacing 0.05em, weight 700, color ink
- **Inputs**: 14px, weight 500
- **Botones primarios**: 13px, weight 600
- **Placeholders**: color muted, opacity 0.7, weight 400
- **Help text**: 11px, color muted
- **Errores**: 11px, color danger, weight 600

### 11.3 Patrones de feedback

- **Éxito** (verde con ✓): mensajes de autocompletar, upload OK
- **Advertencia** (amarillo con ⚠): duplicados detectados, markForDisposal
- **Error** (rojo): validación fallida, OCR falló, servidor caído
- **Info** (brand con icono): autocompletar con IA, razonamiento de búsqueda

### 11.4 Atajos de teclado y command palette

| Atajo | Acción | Módulo |
|---|---|---|
| `/` | Enfoca buscador de la lista | varios |
| `?` | Muestra/oculta modal de ayuda | global |
| `Esc` | Cierra slide-over, modal, ayuda, command palette | global |
| `Ctrl+I` | Abre panel de chat con IA | 8.1 |
| `Ctrl+U` | Va a pestaña Subir | 8.11 |
| `Ctrl+B` | Va a pestaña Buscar | 8.11 |
| `Ctrl+\` | Colapsa/expande sidebar | 7.3 |
| `Ctrl+K` / `⌘K` | Abre command palette | 8.11 |
| `Ctrl+→` / `Ctrl+←` | Siguiente / anterior paso del wizard | 8.11 |
| `[` | Colapsa/expande sidebar | 7.3 |

### 11.5 Responsive

- **Desktop ≥ 720px**: formGrid 2 columnas, sidebar 280px
- **Tablet 480-720px**: formGrid 1 columna
- **Mobile < 480px**: tabs scroll horizontal, chips wrap, file picker full-width
- Sidebar colapsable con `Ctrl+\` (ancho 72px vs 280px)

### 11.6 Accesibilidad (WCAG 2.1 AA)

- Cumplimiento: `aria-pressed`, `aria-selected`, `aria-current="step"`, `role="tablist"`, `role="tab"`, `role="dialog"`, `aria-label`.
- Labels asociados con `<label>` o `for`+`id`.
- Focus visible: `outline: 2px solid var(--focus)`.
- Areas de mejora: `aria-invalid` en inputs con error, `aria-describedby` apuntando al hint/error.

---

## 12. Seguridad, RLS y permisos

### 12.1 4 clientes Supabase

| Cliente | Archivo | Credenciales | Uso |
|---|---|---|---|
| Browser | `lib/supabase/client.ts:4-13` | anon key | Formularios cliente |
| Server (cookie-bound) | `lib/supabase/server.ts:6-33` | anon + cookies | RLS con JWT del usuario |
| Middleware | `lib/supabase/middleware.ts:20-71` | anon key | Refresca JWT, protege rutas |
| Server admin (REST) | `lib/supabase-server.ts:49-72` `supabaseRest` | service_role | Bypase RLS para indexado, audit |
| Server user (REST con JWT) | `lib/supabase-server.ts:76-111` `supabaseUserRest` | anon + accessToken | Rutas API que respetan RLS |

### 12.2 RLS — Patrones

| Patrón | Aplicado a |
|---|---|
| **Lectura abierta + escritura editor** | `documents`, `document_chunks`, `document_summaries`, `processing_jobs` (corpus compartido) |
| **Privado por dueño** | `chat_sessions/messages/sources/notes`, `guardados`, `carpetas`, `seguimientos`, `necesidades`, `procurement_processes`, `document_analyses`, `normative_comparisons` |
| **Solo admin** (lectura y/o escritura) | `audit_logs`, `entity_settings`, `process_type_settings`, `ai_feedback_examples` SELECT, `eval_*`, `boletin_eventos` write, `profiles` UPDATE |
| **RLS colaborativo** (dueño o actor interno) | `procurement_processes`, `process_documents`, `necesidades` |

Funciones `SECURITY DEFINER` para evitar recursión: `is_admin()`, `is_editor()`,
`is_dec()`, `is_legal()`, `is_expediente_colaborador()`.

### 12.3 Storage

- Bucket `documents` con RLS select para `authenticated`, write para
  `service_role`. Límite 104 MB, MIME `application/pdf`.
- Path: `${YYYY}/${MM}/${uuid}-${nombre-saneado}`.

### 12.4 API key safety

- `OPENAI_API_KEY`, `PINECONE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`:
  **solo servidor** (route handlers, server components, scripts).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`:
  expuestas al cliente (deben ser seguras).

---

## 13. Auditoría central

### 13.1 `writeAuditLog` (`lib/supabase-server.ts:184-229`)

- Inserta en `audit_logs` con `service_role` (bypase RLS).
- Silencioso en error: la auditoría NUNCA debe romper el flujo del usuario.
- Payload: `action, actor_reference, entity_id, entity_type, details{action,module,processType,...}, created_at`.
- `module` se infiere de `action.split('.')[0]`.

### 13.2 Acciones auditadas (~60 invocaciones)

Ver §8 (cada módulo lista sus acciones). Resumen:

| Módulo | Acciones |
|---|---|
| **Documentos** | `document.upload`, `document.bulk_delete`, `document.delete`, `document.download`, `document.reindex`, `document.bulk_reindex`, `document.bulk_reindex.item`, `document.import.requested`, `document.analyze`, `document.analyze.export_docx`, `indexing.drain` |
| **Chat** | `chat.message`, `chat.response.export_docx`, `chat.response.feedback` |
| **Necesidades** | `necesidad.create`, `necesidad.delete`, `necesidad.derivar`, `necesidad.document.upload`, `necesidad.document.delete` |
| **Procesos** | `process.create`, `process.delete`, `process.draft_generate`, `process.evaluate_offer`, `process.declare_desierto`, `process.detect_risks`, `process.document.upload`, `process.document.link_library`, `process.archive_to_library`, `process.status.auto_advance` |
| **Comparación/Análisis/Orquestador** | `compare.run`, `agent.orchestrate`, `agent.validation.save`, `agent.validation.export_docx` |
| **Contratos** | `contract.generate` |
| **Archivo / Expedientes archivados** | `archivo.upload/delete/reindex/search/chat`, `expedientes.search/chat/update/delete/reindex/extract/bulk`, `respuesta.generate/export` |
| **Configuración** | `settings.update`, `settings.user.create/update/delete/seed_roles` |
| **Búsqueda / Sistema** | `search.hybrid`, `system.operational_verify`, `corpus.verify` |

### 13.3 Acceso

- **Lectura**: SOLO admin (policy `audit_logs_admin_select`).
- **Escritura**: exclusivamente vía `writeAuditLog` con `service_role`.

---

## 14. Configuración (env vars)

Archivo: `.env.example`.

### 14.1 Variables requeridas

| Variable | Default | Descripción |
|---|---|---|
| `OPENAI_API_KEY` | — | API key de OpenAI |
| `OPENAI_LEGAL_MODEL` | `gpt-4.1-mini` | Modelo para chat principal |
| `OPENAI_PDF_OCR_MODEL` | `gpt-4o-mini` | Modelo para OCR de PDFs escaneados |
| `OPENAI_PDF_OCR_ENABLED` | `true` | Activar OCR con Vision |
| `OPENAI_OCR_MAX_PAGES` | `25` | Máximo de páginas a OCR |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Modelo de embeddings |
| `PINECONE_API_KEY` | — | API key de Pinecone |
| `PINECONE_INDEX_NAME` | `ace-openai` | Nombre del índice |
| `PINECONE_NAMESPACE` | `legal-documents` | Namespace del corpus normativo |
| `PINECONE_ARCHIVO_NAMESPACE` | `archivo-municipal` | Namespace del archivo administrativo |
| `PINECONE_EXPEDIENTES_NAMESPACE` | `expedientes-archivo` | Namespace de biblioteca de expedientes |
| `NEXT_PUBLIC_SUPABASE_URL` | — | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Anon key (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service role key (server) |
| `SUPABASE_STORAGE_BUCKET` | `documents` | Bucket para PDFs |
| `CRON_SECRET` | — | Secreto para el drainer de indexación |
| `COHERE_API_KEY` | — | Requerido para reranking |

### 14.2 Variables opcionales

| Variable | Default | Descripción |
|---|---|---|
| `RERANK_ENABLED` | `true` | Re-ranking con Cohere |
| `COHERE_RERANK_MODEL` | `rerank-v3.5` | Modelo de Cohere |
| `INDEXING_STALE_MINUTES` | `10` | Minutos tras los que un `processing` se considera muerto |
| `INDEXING_DRAIN_BATCH` | `3` | Documentos atascados por corrida del drainer |
| `INDEXING_WORKER_INTERVAL_MS` | `30000` | Intervalo del worker en ms |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL pública de la app |

---

## 15. Testing y calidad

### 15.1 Suite actual

- **13 archivos de test**, **123 tests passing** (Vitest)
- `vitest.config.ts` excluye `_manual-eval.test.ts` de CI
- `scripts/operational-smoke-test.mjs` smoke tests pre-deploy

### 15.2 Cobertura por módulo

| Módulo | Tests |
|---|---|
| 8.1 Chat | `legal-citations.test.ts` (10), `citation-faithfulness.test.ts` (6) |
| 8.2 Búsqueda | `legal-citations.test.ts` |
| 8.3 Análisis | `legal-taxonomy.test.ts` |
| 8.4 Orquestador | `procurement-rules.test.ts` |
| 8.6 Normativa | `legal-taxonomy.test.ts` |
| 8.7 Necesidades | `necesidades.test.ts` |
| 8.8 Procesos | `procurement-rules.test.ts`, `contratacion-modulos.test.ts`, `permisos-contratacion.test.ts`, `expediente-instruccion.test.ts` |
| 8.10 Archivo | `archivo.test.ts` |
| 8.11 Exp archivados | `expedientes-archivo.test.ts` (24) |
| 8.12 Documentos | `documents.test.ts` |
| Shared | `text-normalization.test.ts` (6) |

### 15.3 Quality gates

```jsonc
{
  "typecheck":  "tsc --noEmit",          // 0 errores
  "lint":       "eslint app next.config.ts eslint.config.mjs",
  "test":       "vitest run",            // 123/123 passing
  "build":      "next build",            // 60+ rutas, ~30s
  "smoke":      "node scripts/operational-smoke-test.mjs"
}
```

### 15.4 Pendientes

- ❌ Tests de componentes React (no hay React Testing Library)
- ❌ Tests e2e (no hay Playwright/Cypress)
- ❌ Visual regression (no hay Chromatic/Percy)
- ❌ Coverage report (no hay `vitest --coverage`)

---

## 16. Despliegue (Vercel + cron)

### 16.1 Vercel config

- **Región**: `iad1` (US East, Virginia).
- **Cron**: `*/5 * * * *` ejecutando `GET /api/documents/drain` con
  `Authorization: Bearer ${CRON_SECRET}` (script `scripts/indexing-worker.mjs`
  hace polling cada 30s como alternativa in-app).
- **Body size limit**: `proxyClientMaxBodySize` desde `lib/upload-limits`.

### 16.2 Pre-deploy checklist

1. ✅ Ejecutar migraciones SQL en Supabase (`schema.sql`, `archivo.sql`, `expedientes-archivo.sql`).
2. ✅ Verificar env vars en Vercel.
3. ✅ Generar `CRON_SECRET` aleatorio.
4. ✅ `npm run typecheck` y `npm run lint` local.
5. ✅ `npm run test` local.
6. ✅ `npm run build` local.
7. ✅ `npm run test:operational` smoke.
8. ✅ Verificar `COHERE_API_KEY` para rerank (RAG degrada gracefully sin él).

---

## 17. Pendientes / roadmap

### 17.1 Alta prioridad

- [ ] **Tests de componentes** React Testing Library
- [ ] **Accesibilidad**: `aria-invalid`, `aria-describedby` en inputs con error
- [ ] **Migrar chat UI a React 19** (donde aún no esté)
- [ ] **Streaming de respuesta** del chat (ahora es JSON completo)
- [ ] **Integrar Mesa de Partes UI** (los endpoints existen pero no hay UI)

### 17.2 Media prioridad

- [ ] **Rate limiting** en endpoints públicos (chat, search)
- [ ] **Versiones de documento** (mantener todas las versiones del PDF al reindexar)
- [ ] **Métricas de uso por usuario** (no solo globales)
- [ ] **Notificaciones por email** (eventos del boletín)
- [ ] **SSE/WebSockets** en lugar de polling (8.11, 8.10, 8.12)
- [ ] **Workflow de aprobación** multi-usuario para respuesta oficial
- [ ] **OCR de imágenes** JPG/PNG/TIFF sueltas (8.10, 8.11, 8.12)
- [ ] **Recientes / favoritos** (8.10, 8.11)

### 17.3 Baja prioridad

- [ ] **Sincronización con sistema externo** de archivo físico
- [ ] **Vista de calendario** de expedientes por fecha
- [ ] **Bulk export** de múltiples expedientes a ZIP
- [ ] **Editor de DOCX** in-app (no solo descarga)
- [ ] **Búsqueda fuzzy** con tolerancia a typos
- [ ] **PWA** (offline básico)
- [ ] **Multi-tenancy** (varias municipalidades en una instalación)

---

## 18. Apéndice A — Glosario

| Término | Definición |
|---|---|
| **ACE** | Asistente de Contrataciones con IA. Nombre del producto. |
| **Ley 32069** | Ley General de Contrataciones Públicas del Perú (2024). Marco normativo principal. |
| **DS 009-2025-EF** | Decreto Supremo que aprueba el TUO de la Ley 32069. |
| **OECE** | Organismo Especializado en Contrataciones del Estado. Emite directivas. |
| **OSCE** | Organismo Supervisor de las Contrataciones del Estado. Emite opiniones y precedentes. |
| **Procedimiento de selección** | Licitación Pública (LP), Concurso Público (CP), Subasta Inversa Electrónica (SIE), Contratación Directa (CD), Comparación de Precios (CON), Asignación (AS), Adjudicación de Menor Cuantía (AM), Selección de Consultores Individuales (SCI). |
| **Necesidad** | Módulo 1 del ciclo. Requerimiento público del área usuaria, identificado por `REQ-YYYY-NNNN`. |
| **Expediente de proceso** | Módulos 2-10. Ciclo de 11 estados (necesidad → archivo). |
| **Contrato** | Módulo 11. Documento final con cláusulas obligatorias (art. 60). |
| **RAG** | Retrieval-Augmented Generation. Búsqueda + LLM. |
| **Chunk** | Fragmento de texto (2600 chars + 350 overlap) indexado en Pinecone. |
| **Namespace** | Aislamiento lógico en Pinecone. Tres: `legal-documents`, `archivo-municipal`, `expedientes-archivo`. |
| **TopK** | Número de resultados a recuperar. |
| **OCR** | Optical Character Recognition. Activa para PDFs escaneados. |
| **Rerank** | Re-ordenamiento de resultados (Cohere `rerank-v3.5`). |
| **Grounding violation** | Cita a una norma derogada o a un dato no presente en el fragmento. |
| **RLS** | Row Level Security en PostgreSQL. Aísla datos por usuario. |
| **Anti-alucinación** | Conjunto de 3 capas (prompt, faithfulness check, scope check) que evita inventar datos. |
| **Cron drainer** | Worker que reprocesa documentos atascados (status=processing > 10 min). |
| **Boletín de novedades** | Feed de eventos del corpus (documentos nuevos, modificatorias). |
| **Mesa de Partes** | Módulo 11.B (8.11 sub-funcionalidad): redactar respuesta oficial a documento entrante. |
| **Fase 2** | Módulos en desarrollo (Contratos, Comparación). |
| **MVP** | Mínimo Producto Viable: Chat, Carga, Búsqueda, Historial. |

## 19. Apéndice B — Historial del documento

| Fecha | Cambio | Autor |
|---|---|---|
| 2026-06-24 | Versión inicial. Documento maestro creado tras la implementación completa de los 19 módulos. | (auto-generado) |

---

> **Mantenimiento:** cualquier cambio en la implementación de cualquier módulo debe
> venir acompañado de un PR que actualice este documento en la misma sección.
>
> - Si añades un nuevo endpoint → complétalo en §9.
> - Si cambias un componente → actualiza §4.3 y la sección del módulo.
> - Si modificas el modelo de datos → refleja el cambio en §5.
> - Si añades un módulo → crea una nueva entrada §8.N siguiendo la plantilla.
> - Si añades un role o capability → actualiza §2.1, §2.2.
> - Si cambias un workflow de IA → actualiza §6.2.
