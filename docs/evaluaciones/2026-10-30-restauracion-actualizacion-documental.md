# Recuperación de Actualización documental · 30 de octubre de 2026

La rama publicada carecía de /actualizacion-documental, de la API /api/library/sync y del enlace de navegación. Se recuperó la implementación registrada en f673e90 de forma selectiva, sin sustituir los cambios actuales de autenticación, diseño ni simulador.

- Enlace exclusivo del administrador en Administrar → Actualización documental, y acceso Actualizar biblioteca en el inicio.
- Recuperados panel, política, parser OECE/IVN, servicio, API y programación diaria a las 06:00 de Lima (11:00 UTC).
- Cron autenticado solo con CRON_SECRET, para GET y la ruta exacta; el resto mantiene la comprobación de sesión. La API verifica de nuevo el secreto.
- Consulta de configuración sin consumo de cuota IA; acceso denegado a usuarios comunes y externos.
- Migraciones históricas recuperadas para reproducibilidad. No se ejecutaron nuevamente ni se reemplazó información de producción.
- Lectura de producción: siete fuentes oficiales registradas, seis reglas activadas y límite de cien descargas diarias. CRON_SECRET ya está configurado en Vercel.
- 92 pruebas correctas en ocho archivos, TypeScript y ESLint sin errores. Las pruebas de cron usan dobles de prueba; no se disparó un lote real como comprobación del menú.
- Para comprobar visualmente la página protegida se solicitó una sesión administradora en el navegador integrado. Se conservaron sus controles de permisos.
