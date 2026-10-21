# ACE IA Juridica

Aplicacion web para gestion documental juridica, busqueda semantica y asistencia con IA sobre Ley 32069, su reglamento y documentos OECE.

![CI](https://github.com/rafaelroque412-cell/iag/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/rafaelroque412-cell/iag/actions/workflows/deploy.yml/badge.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.0.5-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)
![License](https://img.shields.io/badge/license-Private-red)

**Deployment:** [ace-360.netlify.app](https://ace-360.netlify.app) (Netlify)

## Stack tecnologico

- **Frontend:** Next.js 16 + React 19 + TypeScript estricto
- **Backend:** Next.js API Routes + Supabase (PostgreSQL + Auth + Storage)
- **IA:** OpenAI (gpt-4.1-mini, gpt-4o para OCR) + Pinecone (vector DB) + Cohere (reranking)
- **Deploy:** Netlify con Scheduled Functions
- **CI/CD:** GitHub Actions
- **Tests:** Vitest (123 tests passing)

## Modulos MVP

- Chat juridico con fuentes verificables (RAG + anti-alucinacion de 3 capas)
- Carga e indexacion de documentos PDF con OCR
- Clasificacion automatica de documentos
- Resumen automatico
- Busqueda semantica con reranking
- Historial de consultas
- Biblioteca de expedientes archivados
- Mesa de partes digital
- Generacion de documentos (contratos, resoluciones, oficios)

## Desarrollo local

### Pre-requisitos

- Node.js 20 LTS (usar `nvm` con `nvm use`)
- npm 10+

### Setup

1. Clonar el repositorio:

```bash
git clone https://github.com/rafaelroque412-cell/iag.git
cd iag
```

2. Instalar dependencias:

```bash
npm install --legacy-peer-deps
```

3. Crear archivo de entorno:

```bash
cp .env.example .env.local
```

4. Completar claves privadas en `.env.local` (ver [Variables de entorno](#variables-de-entorno)).

5. Ejecutar en modo desarrollo:

```bash
npm run dev
```

La aplicacion abrira en `http://localhost:3000`.

### Scripts disponibles

```bash
npm run dev              # Servidor de desarrollo
npm run build            # Build de produccion
npm run start            # Servidor de produccion
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking
npm run test             # Ejecutar tests (Vitest)
npm run test:watch       # Tests en modo watch
npm run test:operational # Smoke test operacional
npm run worker:indexing  # Worker de indexacion (drain de PDFs)
```

## Configurar base de datos Supabase

Antes de subir PDFs, ejecuta el esquema inicial:

1. Abre Supabase Dashboard.
2. Entra al proyecto.
3. Ve a `SQL Editor`.
4. Copia y ejecuta el contenido de `docs/supabase/schema.sql`.

Ese script crea:

- Tabla `documents`
- Tabla `document_chunks`
- Tabla `document_summaries`
- Tabla `chat_sessions`
- Tabla `chat_messages`
- Tabla `audit_logs`
- Bucket privado `documents` para PDFs

Para el modulo de expedientes, ejecuta ademas:
- `docs/supabase/expedientes-archivo.sql`

## Variables de entorno

Las API keys privadas nunca deben exponerse en el navegador.

### OpenAI

- `OPENAI_API_KEY`: clave para modelos, embeddings y generacion
- `OPENAI_LEGAL_MODEL`: modelo para chat juridico (default: `gpt-4.1-mini`)
- `OPENAI_PDF_OCR_MODEL`: modelo para OCR de PDFs (default: `gpt-4o`)
- `OPENAI_PDF_OCR_ENABLED`: activar OCR (default: `true`)
- `OPENAI_OCR_MAX_PAGES`: maximo de paginas para OCR (default: `25`)
- `OPENAI_EMBEDDING_MODEL`: modelo de embeddings (default: `text-embedding-3-small`)

### Pinecone

- `PINECONE_API_KEY`: clave para busqueda vectorial
- `PINECONE_INDEX_NAME`: indice de Pinecone (default: `ace-openai`)
- `PINECONE_NAMESPACE`: namespace de documentos juridicos (default: `legal-documents`)
- `PINECONE_ARCHIVO_NAMESPACE`: namespace de archivo municipal (default: `archivo-municipal`)
- `PINECONE_EXPEDIENTES_NAMESPACE`: namespace de expedientes (default: `expedientes-archivo`)

### Cohere (reranking)

- `RERANK_ENABLED`: activar reranking (default: `true`)
- `COHERE_API_KEY`: clave de Cohere
- `COHERE_RERANK_MODEL`: modelo de reranking (default: `rerank-v3.5`)

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`: URL publica de Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key para cliente
- `SUPABASE_SERVICE_ROLE_KEY`: service role para operaciones servidor
- `SUPABASE_STORAGE_BUCKET`: bucket privado de documentos (default: `documents`)

### App

- `NEXT_PUBLIC_APP_URL`: URL publica de la aplicacion
- `CRON_SECRET`: secreto para el cron de Netlify (generar con `openssl rand -hex 32`)
- `INDEXING_STALE_MINUTES`: minutos tras los que un documento se considera muerto (default: `10`)
- `INDEXING_DRAIN_BATCH`: documentos procesados por corrida del drainer (default: `3`)

## Despliegue en Netlify

Ver **[docs/DEPLOY-NETLIFY.md](docs/DEPLOY-NETLIFY.md)** para la guia completa.

### Resumen rapido

1. Fork/clone este repositorio
2. Crear sitio en [Netlify](https://app.netlify.com/) → "Import an existing project"
3. Conectar con GitHub
4. Configurar build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Configurar variables de entorno (ver `docs/DEPLOY-NETLIFY.md`)
6. Deploy automatico en cada push a `main`

### Cron job

El drain de indexacion (que procesa PDFs pendientes) se ejecuta automaticamente cada 5 minutos via **Netlify Scheduled Functions** (`netlify/functions/indexing-drain.mjs`).

## CI/CD

### GitHub Actions

- **CI** (`.github/workflows/ci.yml`): lint, typecheck, test, build en cada PR y push
- **Deploy** (`.github/workflows/deploy.yml`): deploy automatico a Netlify en cada push a `main`

### Secrets requeridos en GitHub

Configurar en **Settings → Secrets and variables → Actions**:

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `COHERE_API_KEY`
- `CRON_SECRET`

## Arquitectura

```
ace-360/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── documents/            # CRUD de documentos
│   │   ├── expedientes-archivo/  # Modulo de expedientes
│   │   ├── processes/            # Procesos de contratacion
│   │   └── chat/                 # Chat juridico
│   ├── components/               # Componentes React
│   ├── styles.css                # Estilos globales
│   └── ...
├── lib/                          # Logica de negocio
│   ├── auth.ts                   # Autenticacion
│   ├── supabase/                 # Clientes Supabase
│   ├── openai-server.ts          # Cliente OpenAI
│   ├── pinecone.ts               # Cliente Pinecone
│   └── pdf-processing.ts         # OCR de PDFs
├── tests/                        # Tests (Vitest)
├── scripts/                      # Scripts auxiliares
│   └── indexing-worker.mjs       # Worker de indexacion (fallback)
├── docs/                         # Documentacion
│   ├── SDD-ACE.md                # Spec-Driven Development (master)
│   ├── SDD-EXPEDIENTES-ARCHIVO.md
│   ├── DEPLOY-NETLIFY.md         # Guia de deploy
│   └── supabase/                 # SQL migrations
├── netlify/                      # Configuracion Netlify
│   ├── _headers                  # Security headers
│   └── functions/                # Netlify Functions
│       └── indexing-drain.mjs    # Scheduled function (cron)
├── .github/workflows/            # GitHub Actions
│   ├── ci.yml                    # CI pipeline
│   └── deploy.yml                # Deploy pipeline
├── netlify.toml                  # Config de Netlify
├── next.config.ts                # Config de Next.js
├── package.json
└── tsconfig.json
```

## Documentacion del proyecto

- **[SDD-ACE.md](docs/SDD-ACE.md)**: Spec-Driven Development master (19 modulos, AI pipelines, anti-alucinacion, security, deployment)
- **[SDD-EXPEDIENTES-ARCHIVO.md](docs/SDD-EXPEDIENTES-ARCHIVO.md)**: SDD del modulo de expedientes
- **[DEPLOY-NETLIFY.md](docs/DEPLOY-NETLIFY.md)**: Guia de deployment en Netlify
- **[CHANGELOG.md](CHANGELOG.md)**: Historial de versiones

## Contribuir

1. Fork el repositorio
2. Crear una rama para tu feature (`git checkout -b feature/mi-feature`)
3. Commit tus cambios (`git commit -m 'feat: agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/mi-feature`)
5. Abrir un Pull Request

### Convenciones de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nueva funcionalidad
- `fix:` correccion de bug
- `docs:` cambios en documentacion
- `style:` cambios de formato (no afectan logica)
- `refactor:` refactorizacion de codigo
- `test:` agregar o modificar tests
- `chore:` cambios en build, CI, dependencias

## Licencia

Privado. Todos los derechos reservados.
