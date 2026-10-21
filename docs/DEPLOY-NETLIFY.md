# Deploy en Netlify

Guia paso a paso para desplegar **ACE 360°** en Netlify Free tier.

---

## Pre-requisitos

- Cuenta en [Netlify](https://app.netlify.com/) (sign up con GitHub)
- Repositorio en GitHub con el codigo (publico o privado)
- Variables de entorno listas (ver `/.env.example`)

---

## Configuracion inicial en Netlify

### 1. Crear el sitio

1. Ve a [app.netlify.com](https://app.netlify.com/)
2. Click en **"Add new site"** → **"Import an existing project"**
3. Selecciona **GitHub** como proveedor
4. Autoriza a Netlify a acceder a tu cuenta de GitHub
5. Busca y selecciona el repositorio `ace-360` (o el nombre que uses)
6. Click en **"Deploy site"** (aun no va a deployar bien sin las env vars)

### 2. Configurar build settings

En **Site settings** → **Build & deploy** → **Continuous deployment**:

| Campo | Valor |
|---|---|
| Base directory | (vacio) |
| Build command | `npm run build` |
| Publish directory | `.next` |
| Functions directory | `netlify/functions` |

**Node version:** Asegurate de que `NODE_VERSION=20` este configurado en las env vars (paso 3).

### 3. Configurar variables de entorno

En **Site settings** → **Environment variables**, agrega las siguientes variables:

```bash
# Obligatorias para build
NODE_VERSION=20
NPM_FLAGS=--legacy-peer-deps
NEXT_PUBLIC_APP_URL=https://TU-SITIO.netlify.app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[tu-proyecto].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[tu-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[tu-service-role-key]
SUPABASE_STORAGE_BUCKET=documents

# OpenAI
OPENAI_API_KEY=[sk-...]
OPENAI_LEGAL_MODEL=gpt-4.1-mini
OPENAI_PDF_OCR_MODEL=gpt-4o
OPENAI_PDF_OCR_ENABLED=true
OPENAI_OCR_MAX_PAGES=25
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Pinecone
PINECONE_API_KEY=[pcsk-...]
PINECONE_INDEX_NAME=ace-openai
PINECONE_NAMESPACE=legal-documents
PINECONE_ARCHIVO_NAMESPACE=archivo-municipal
PINECONE_EXPEDIENTES_NAMESPACE=expedientes-archivo

# Cohere (reranking)
RERANK_ENABLED=true
COHERE_API_KEY=[...]
COHERE_RERANK_MODEL=rerank-v3.5

# Cron (para Scheduled Function de Netlify)
CRON_SECRET=[genera-un-secreto-aleatorio-de-32-chars]
INDEXING_STALE_MINUTES=10
INDEXING_DRAIN_BATCH=3
```

**Tip:** Genera un `CRON_SECRET` seguro con:
```bash
openssl rand -hex 32
```

### 4. Activar el plugin de Next.js

El archivo `netlify.toml` ya incluye `[[plugins]] package = "@netlify/plugin-nextjs"`. Netlify lo instala automaticamente en cada build. No requiere configuracion manual.

### 5. Primer deploy

1. Ve a **Deploys** → Click en **"Trigger deploy"** → **"Deploy site"**
2. Espera ~5-10 minutos (Netlify es mas lento que Vercel en build)
3. Revisa los logs en **Deploys** → Click en el deploy activo → **"Deploy log"**

Si todo sale bien, veras un mensaje de exito y podras acceder al sitio en `https://TU-SITIO.netlify.app`.

---

## Cron job (reemplazo de Vercel Cron)

El archivo `vercel.json` original tenia un cron que llamaba a `/api/documents/drain` cada 5 minutos. Esto se reemplazo con **Netlify Scheduled Functions** en `netlify/functions/indexing-drain.mjs`.

### Como funciona

- Netlify ejecuta la funcion automaticamente cada 5 minutos
- La funcion hace un POST a `${URL}/api/documents/drain` con `Authorization: Bearer ${CRON_SECRET}`
- Los logs aparecen en **Functions** → **indexing-drain** → **Function log**

### Verificar que funciona

1. Ve a **Functions** → **indexing-drain**
2. Revisa los **Function logs** despues de unos minutos
3. Deberias ver lineas como:
   ```
   [2024-01-15T10:30:00.000Z] drain status=200 body={"scanned":3,"processed":2,"failed":0,"items":[...]}
   ```

### Cambiar la frecuencia

Edita `netlify.toml`:
```toml
[functions."indexing-drain"]
  schedule = "@every 5m"  # Cambiar a "@every 10m", "@hourly", etc.
```

Formatos validos: `@every 1m`, `@every 5m`, `@hourly`, `@daily`, cron expressions.

---

## Dominio personalizado (opcional)

Netlify asigna automaticamente un subdominio como `https://ace-360.netlify.app`. Para usar un dominio custom (ej. `ace.muni.gob.pe`):

1. **Site settings** → **Domain management** → **Add custom domain**
2. Ingresa tu dominio (ej. `ace.muni.gob.pe`)
3. Netlify te dara instrucciones de DNS (CNAME o A record)
4. Configura los DNS en tu proveedor
5. Espera la propagacion (puede tomar hasta 48h)
6. Netlify genera automaticamente un certificado SSL via Let's Encrypt

---

## Limites de Netlify Free tier

| Recurso | Limite | Notas |
|---|---|---|
| Bandwidth | 100 GB/mes | Suficiente para beta privada |
| Function requests | 125,000/mes | ~4,000/dia |
| Function duration (sync) | 26 segundos | Endpoints largos pueden fallar |
| Function duration (background) | 15 minutos | Usar `output: "standalone"` para alcanzar |
| Build minutes | 300 minutos/mes | Cada build toma ~5-10 min |
| Scheduled functions | Incluidas | Reemplazo de Vercel Cron |
| Edge functions | 1,000,000 requests/mes | Deno-based, no Vercel Edge Runtime |
| Sites | Ilimitados | Puedes tener multiples sitios |

**Si excedes los limites:** Upgrade a **Pro** ($19/mes) que incluye 1TB bandwidth, 2M function requests, y build minutes ilimitados.

---

## Troubleshooting

### Error: "Module not found" en build

**Causa:** Path aliases de TypeScript no se resuelven correctamente.
**Solucion:** Verifica que `tsconfig.json` tenga `"baseUrl": "."` y `"paths": { "@/*": ["./*"] }`. El archivo actual ya lo tiene.

### Error: "Build timeout" (>10 min)

**Causa:** Dependencias pesadas (ej. `pdf-parse`, `pdfjs-dist`).
**Solucion:** Agrega `NPM_FLAGS=--legacy-peer-deps` a las env vars de Netlify.

### Error: "Function timeout" (>26s)

**Causa:** Endpoints de API que procesan PDFs o hacen OCR.
**Solucion:** Verifica que `next.config.ts` tenga `output: "standalone"`. Si sigue fallando, considera mover el procesamiento a un background job.

### Error: "404 on /api/*"

**Causa:** El plugin de Next.js no esta instalado.
**Solucion:** Verifica que `netlify.toml` tenga:
```toml
[[plugins]]
  package = "@netlify/plugin-nextjs"
```
Y que `@netlify/plugin-nextjs` este en `devDependencies` de `package.json`.

### Error: "OpenAI 401"

**Causa:** `OPENAI_API_KEY` incorrecta o expirada.
**Solucion:** Verifica en Netlify **Environment variables** que el valor sea correcto (sin espacios al inicio/final).

### Error: "Supabase connection error"

**Causa:** `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` incorrectas.
**Solucion:** Verifica en el dashboard de Supabase → **Settings** → **API**.

### Cron no se ejecuta

**Causa:** El archivo `netlify/functions/indexing-drain.mjs` no se deployo o la sintaxis es incorrecta.
**Solucion:**
1. Ve a **Functions** y verifica que `indexing-drain` aparece
2. Si no aparece, revisa los logs de build
3. Si aparece pero no se ejecuta, verifica que `CRON_SECRET` este configurado

### Build falla con "ERESOLVE unable to resolve dependency tree"

**Causa:** Conflicto de versiones de dependencias.
**Solucion:** Asegurate de que `NPM_FLAGS=--legacy-peer-deps` este en las env vars de Netlify.

---

## Diferencias con Vercel

| Aspecto | Vercel | Netlify |
|---|---|---|
| **Cron jobs** | `vercel.json` con `crons` | Scheduled Functions |
| **Build time** | ~30 segundos | ~5-10 minutos |
| **Cold start** | ~100ms | ~500ms-2s |
| **Max function duration** | 300s (Pro) | 26s (sync) / 15min (background) |
| **Edge Runtime** | Vercel Edge (Node.js) | Deno-based |
| **Preview deploys** | Automatic en PRs | Automatic en PRs |
| **Free tier** | 100GB bandwidth | 100GB bandwidth |
| **Pro tier** | $20/mes | $19/mes |

---

## Monitoreo post-deploy

### Netlify Analytics (incluido en Pro)

- Ve a **Site settings** → **Analytics** → **Enable**
- Veras: visitas, bandwidth, top pages, etc.

### Sentry (recomendado, pendiente configurar)

Para configurar Sentry:
1. Crea cuenta en [sentry.io](https://sentry.io/)
2. Crea un nuevo proyecto Next.js
3. Agrega `SENTRY_DSN` a las env vars de Netlify
4. Instala `@sentry/nextjs` y configura `sentry.client.config.ts` y `sentry.server.config.ts`

### Uptime monitoring (gratis)

- [UptimeRobot](https://uptimerobot.com/) — 50 monitores gratis
- [Cronitor](https://cronitor.io/) — 5 monitores gratis
- [BetterStack](https://betterstack.com/uptime) — 10 monitores gratis

Configura uno para que verifique `https://TU-SITIO.netlify.app` cada 5 minutos.

---

## Rollback

Si un deploy rompe algo:

1. Ve a **Deploys**
2. Encuentra el ultimo deploy que funcionaba
3. Click en **"Publish deploy"**
4. Netlify restaura ese deploy en ~30 segundos

---

## Seguridad

### Headers de seguridad (ya configurados)

El archivo `netlify/_headers` configura:
- `X-Frame-Options: DENY` — Previene clickjacking
- `X-Content-Type-Options: nosniff` — Previene MIME sniffing
- `Strict-Transport-Security` — Fuerza HTTPS
- `Referrer-Policy` — Controla el referrer
- `Permissions-Policy` — Desactiva camara/microfono/geolocalizacion

### Content Security Policy (CSP)

Para agregar CSP estricto, edita `netlify/_headers` y agrega:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://*.pinecone.io https://api.cohere.ai;
```

**Importante:** Probar exhaustivamente despues de agregar CSP, ya que puede romper funcionalidades.

### Variables de entorno

- **Nunca** commitees `.env.local` al repositorio
- **Nunca** expongas `SUPABASE_SERVICE_ROLE_KEY` al cliente (solo `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Configura **Secret scanning** en GitHub (Settings → Code security → Secret scanning)

---

## Referencias

- [Netlify Next.js docs](https://docs.netlify.com/frameworks/next-js/overview/)
- [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- [Netlify Environment variables](https://docs.netlify.com/environment-variables/overview/)
- [Next.js Standalone output](https://nextjs.org/docs/app/api-reference/next-config-js/output)
