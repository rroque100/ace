# Simulador ACE — entrega verificada, 2026-10-29

## Disponible

- Producción: https://ace-rormi.vercel.app/simulador
- Banco editorial administrativo: https://ace-rormi.vercel.app/simulador/banco
- Despliegue verificado: dpl_GA8EkbvQ74tKcEQGgKXp71VGykR7 (READY).
- Modalidades de práctica y examen con plazo del servidor, guardado, marcado de dudas, historial, explicación y vínculos a la fuente, Normativa y Chat.
- Banco con revisiones trazables. Las claves quedan ocultas durante el examen; cada intento conserva la versión usada.

## Banco inicial

10 preguntas originales sobre Ley 32069, contrastadas con pasajes reales del corpus. No se copiaron preguntas, claves ni explicaciones de LEX. Las 10 siguen en borrador y requieren revisión humana explícita antes de publicarse para usuarios. La administración puede activar «Probar borradores del banco». No hay banco de 72 preguntas ni contenido inicial de Ley 30225; esas selecciones no se completan repitiendo preguntas.

## Comprobaciones

- 13 pruebas unitarias y de rutas correctas.
- TypeScript y lint correctos; compilación de producción READY.
- Migración aplicada; prueba SQL transaccional con ROLLBACK: Success, no rows returned. Comprueba permisos, propiedad de intentos, conflictos, entrega, vencimiento y cambios de fuente.
- Diez fuentes verificadas; SHA erróneo y acceso a un intento ajeno rechazados. Rutas sin sesión devuelven 401.
- Recorrido real: práctica administrativa de tres preguntas, respuesta, marcado, cambio de pregunta, recarga y entrega; resultado persistido de una correcta y dos omitidas.
- Banco observado con diez borradores, fuente y página visibles; publicación deshabilitada hasta confirmar revisión.
- Pantalla final observada en el dominio principal. Captura: C:/Users/USER/.codex/visualizations/2026/10/21/01a15fc4-5111-7a21-b166-65f394aa2be9/ace-simulador-2026-10-29.png.

Estas comprobaciones no certifican precisión jurídica general, revisión experta, accesibilidad integral ni funcionamiento en un teléfono real. No se publicó ninguna pregunta como revisada por una persona. La calificación no usa IA; el Chat constituye una acción de estudio adicional.

## Operación

Un despliegue Git posterior había vuelto a una versión sin simulador. Se publicó de nuevo la copia actual y se comprobó el dominio principal. El módulo se conserva en un commit selectivo con su migración, pruebas y documentación; los cambios ajenos permanecen fuera de ese commit. Para desplegar desde otra rama, esta debe contener también el módulo.
