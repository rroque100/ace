# Migración de ACE a Control — 21 de octubre de 2026

Origen: uxpitcawohjnpkzeexiz, organización prxwycbkfntsriytgies.
Destino: medmcaiskvtbckpakseo (ace), organización Control fsdsccipfgsjfthtdsoo, plan Pro.

## Completado

- Reactivación del origen con autorización explícita del usuario. Se conserva para recuperación.
- Destino comprobado vacío antes de la restauración: 0 tablas públicas, 0 usuarios, 0 archivos.
- Respaldo actual del origen y del estado inicial del destino.
- 57 tablas públicas restauradas con sus registros, funciones, índices, restricciones y disparadores.
- 16 usuarios y sus 16 identidades de correo conservados, incluidos UUID y hashes de contraseña. No se probaron contraseñas de usuarios.
- Conteos y huellas de contenido de las 57 tablas públicas y de auth.users/auth.identities coinciden entre origen y destino.
- 57 tablas con RLS y 130 políticas públicas conservadas.
- 73 entradas del historial supabase_migrations restauradas.
- 105 archivos del bucket privado documents copiados: 372833993 bytes. Cada archivo verificado mediante descarga del destino y SHA-256 frente al origen.
- Propietarios, metadatos de usuario y fechas de archivos conservados. Se mantienen las versiones físicas propias del nuevo Storage.
- Límite global de archivo y del bucket: 100 MB; tipos MIME del bucket: application/pdf.
- No hay funciones Edge desplegadas, tablas en publicación Realtime ni políticas personalizadas de Storage en el origen.
- Ajustes públicos de autenticación consultados y URLs de autenticación coinciden entre ambos proyectos.
- Actualizadas únicamente NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY de .env.local al destino.
- ACE local: /login responde HTTP 200; /api/health devuelve ok=true.
- Conexión de Control y configuración de Pinecone no modificadas. Se preservaron los IDs del corpus; no se ejecutó reindexación.

## Pendiente

- Actualizar esas tres variables en el proyecto Vercel que sirve ace-two-roan.vercel.app y volver a desplegar, ya autorizado por el usuario.
- La sesión abierta como rafaelroque02@gmail.com no tiene acceso a la ruta documentada rafaelroque412-7737s-projects/ace (404). Se solicitó acceso a la cuenta/equipo correctos.
- Verificar acceso real en la aplicación publicada después del despliegue.
- No se borró ni se pausó el proyecto original. No se migraron sesiones activas de usuarios: deberán iniciar sesión de nuevo en el destino.

## Respaldos privados

Guardados fuera de la carpeta de compilación, en .env.local.migration-2026-10-21/, excluida por la regla existente .env.local.* de Git. Contienen datos privados y hashes; no deben publicarse ni adjuntarse a repositorios.
