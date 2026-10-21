# Levantar ACE en un Supabase nuevo (proyecto `djlhz…`)

Guía de arranque **limpio** (sin migrar datos): esquema, Storage, variables y
re-indexado. Pensado para estrenar Supabase + GitHub + Vercel a la vez.

> Si en el futuro quieres **conservar** los datos del proyecto viejo (13 usuarios,
> ~95 MB de PDFs, filas), eso es otra tarea (pg_dump/restore + copia de Storage +
> migración de Auth) y NO está cubierta aquí.

---

## 1. Esquema + bucket (una sola vez, en el SQL Editor)

En el proyecto nuevo → **SQL Editor** → pega **entero** y ejecuta:

- `docs/supabase/schema-completo.sql`

Crea las 53 tablas, 19 funciones, 15 triggers, 123 políticas RLS, índices,
CHECK, el índice único de DNI **y el bucket `documents`** (privado, 100 MB, solo
PDF). Es idempotente (`if not exists`), se puede reejecutar.

> El esquema `auth` y `storage` ya existen en cualquier proyecto Supabase nuevo;
> el script solo toca `public` + inserta el bucket y crea el trigger sobre
> `auth.users` (que hace admin al primer usuario que se registre).

## 2. Auth (panel)

- **Authentication → Providers**: deja **Email** activado (es lo que usa la app).
- Opcional: desactiva "Confirm email" si quieres registro directo en pruebas.
- El **primer** usuario que se registre nace `admin` (lo hace `handle_new_user`).

## 3. Credenciales del proyecto nuevo (panel → Settings → API)

Copia:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** (secreta) → `SUPABASE_SERVICE_ROLE_KEY`

## 4. Variables de entorno (local `.env.local` **y** Vercel)

Cambia estas al proyecto nuevo:

```
NEXT_PUBLIC_SUPABASE_URL=https://djlhzrkjgwkjeucmulqg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon del nuevo>
SUPABASE_SERVICE_ROLE_KEY=<service_role del nuevo>
SUPABASE_STORAGE_BUCKET=documents
```

El resto (OpenAI, Pinecone, Cohere, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`…) se
mantienen — pero revisa Pinecone en el paso 5. **Todas** deben estar también en
Vercel (Project → Settings → Environment Variables).

## 5. Pinecone (arranque limpio)

La BD nueva empieza vacía → sus documentos tendrán **UUIDs nuevos**, y los
vectores viejos de Pinecone quedarían huérfanos. Elige una:

- **A (recomendado):** usa **namespaces nuevos** en el mismo índice
  (`PINECONE_NAMESPACE`, `PINECONE_ARCHIVO_NAMESPACE`,
  `PINECONE_EXPEDIENTES_NAMESPACE` con sufijo, p. ej. `-v2`), o un índice nuevo.
- **B:** vacía los namespaces actuales en el panel de Pinecone.

Después, **re-sube y re-indexa** los PDFs desde la app (Documentos / Archivo);
el `after()` de cada subida los indexa, y el cron diario recoge lo atascado.

## 6. Verificación

1. `npm run build` en local con el `.env.local` nuevo → sin errores.
2. Regístrate (primer usuario = admin) y entra.
3. Configuración → Municipalidad: guarda algo → confirma que persiste (BD nueva).
4. Sube un PDF → aparece en Storage del proyecto nuevo y se indexa.

---

## Resumen de qué es SQL y qué es panel

| Paso | Dónde |
|---|---|
| Esquema `public` + bucket | SQL Editor (`schema-completo.sql`) |
| Auth (Email provider) | Panel → Authentication |
| Claves API | Panel → Settings → API |
| Variables de entorno | `.env.local` + Vercel |
| Pinecone (namespaces/limpieza) | Panel de Pinecone |
| Re-indexar | Desde la app |
