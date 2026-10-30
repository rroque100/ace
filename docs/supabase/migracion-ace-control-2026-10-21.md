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

- La versión actual se publicó en GitHub rroque100/ace, main, commit c52feaab0a52703504be275c2e2143f8b1b83f8d. El usuario eligió desplegar en ace-rormi, equipo rafaelroque02-gmailcoms-projects.
- Se importaron 18 variables de producción a ace-rormi con autorización explícita: 15 Secret y 3 Config públicas. NEXT_PUBLIC_APP_URL=https://ace-rormi.vercel.app. El redespliegue Pvdmkmi27HZ1aHmaUrmq2HHjV7hd finalizó Ready.
- Verificación pública completada el 22 de octubre: https://ace-rormi.vercel.app abre el formulario de acceso; /api/health devuelve ok=true. Pendiente únicamente probar una sesión real de usuario y funciones de IA desde esa sesión.
- No se borró ni se pausó el proyecto original. No se migraron sesiones activas de usuarios: deberán iniciar sesión de nuevo en el destino.

## Respaldos privados

Guardados fuera de la carpeta de compilación, en .env.local.migration-2026-10-21/, excluida por la regla existente .env.local.* de Git. Contienen datos privados y hashes; no deben publicarse ni adjuntarse a repositorios.
