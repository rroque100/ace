# Prueba del menú Actualización documental — 29/10/2026

URL: https://ace-rormi.vercel.app/actualizacion-documental

## Pruebas realizadas en producción

- Carga con sesión administradora y datos contrastados con Supabase.
- Guardado de programación actual; pausa efectiva con ejecución deshabilitada y restauración de revisión diaria, límite 100.
- Expansión de criterios y guardado de fuente Opiniones sin alterar su configuración.
- Límite 101 rechazado por validación del formulario; campo restaurado a 100.
- Ejecución real desde «Revisar y continuar cola»: inicio 08:26:38 y final 08:29:01 de Lima.
- Resultado: 41 originales nuevos; 23 trabajos completados mediante originales ya almacenados; 12 casos enviados a revisión. Las reservas diarias pasaron de 14 a 90.
- Tres nuevos originales descargados de Storage y cotejados con su SHA-256: todos coinciden.
- El circuito de IA permaneció activo; las descargas no requirieron créditos de Google.
- Endpoints de configuración y cron rechazaron peticiones sin autenticación con HTTP 401.
- En el ancho observado de 618 px, no hubo desbordamiento horizontal ni avisos de error activos.
- 18 pruebas automatizadas relevantes pasaron. Comprobación de tipos y lint correctos tras la corrección.

## Fallo encontrado y corregido

La pantalla actualizaba datos durante 120 segundos y el lote real tardó 143 segundos. Esto dejaba un estado intermedio visible hasta recargar. Se amplió el seguimiento a cinco minutos, alineado con el máximo del proceso del servidor.

## Límites de la comprobación

La clasificación/indexación continúa pendiente de restablecer créditos de Google. No se pulsó «Reintentar tras restablecer IA», porque el servicio todavía informa créditos agotados. La ejecución diaria automática queda programada; esta prueba fue una ejecución manual. La integridad de PDF se comprobó en Storage; el navegador integrado no permitió confirmar visualmente el visor PDF nativo. La comprobación de ancho no sustituye una prueba en teléfono físico.
