# Usuarios externos: accesos por módulo y auditoría

Una persona externa (un asesor, un alumno) entra solo a una parte de ACE y su actividad queda registrada. Esto es
distinto de las cuentas del personal de la entidad, que siguen como siempre.

## Qué hay

| Módulo | Qué abre |
|---|---|
| **Centro Jurídico** (`centro_juridico`) | Chat jurídico, búsqueda documental y normativa, con la voz y el caso activo. |
| **Simulacro de examen** (`simulacro`) | Reservado: la pantalla existe y dice que viene; el simulacro en sí **aún no está construido**. |

Una cuenta externa puede tener uno, otro o los dos. No ve nada más: ni Necesidades, ni Expedientes, ni Configuración, ni el
asistente «Mi Yo». El menú solo muestra sus módulos, y **el proxy cierra todo lo demás** (páginas y APIs, con un 403):
ocultar enlaces no es seguridad.

## Puesta en marcha (una vez)

1. Ejecutar `docs/supabase/usuarios-externos.sql` en el SQL Editor de Supabase. Añade las columnas del perfil, las tablas
   `acceso_eventos` y `uso_ia`, y un disparador que deja **sin acceso** a las cuentas que se registren por su cuenta.
2. **Desactivar el registro abierto** en Supabase: *Authentication → Sign In / Providers → Allow new users to sign up =
   desactivado*. Hasta octubre de 2026 estaba activo (`disable_signup: false`): cualquiera con un correo podía crearse una
   cuenta. El formulario de entrada ya no ofrece «Registrarse», pero la API de Auth lo seguía aceptando.
3. Revisar la lista de usuarios en *Configuración → Usuarios* por si hay cuentas que nadie creó.

## Dar de alta una cuenta

*Configuración → Usuarios externos → Nueva cuenta externa*: usuario (DNI de 8 dígitos), módulos, fecha de fin (opcional) y
cuota mensual de IA en tokens (vacío = sin tope, 0 = sin IA). La contraseña temporal se muestra **una sola vez**.

- **Vigencia:** al llegar la fecha de fin la cuenta solo puede entrar y salir; todo lo demás da error o la lleva a un aviso.
- **Cuota de IA:** al agotarse, la persona puede seguir leyendo (su historial, las normas) pero no lanzar nada que gaste
  IA (preguntar al chat, grabar voz); recibe un mensaje claro. Se renueva el día 1 de cada mes (UTC).
- **Los cambios** de módulos, vigencia o cuota llegan a la persona en su próxima renovación de sesión (hasta 1 hora). Para
  cortar el acceso **al instante**, usar *Desactivar*.

## Auditoría

En la misma pestaña: desde qué **IP** entra cada cuenta (inicios y cierres de sesión incluidos), qué páginas abre y qué
acciones hace (todo lo que escribe: preguntar al chat, grabar voz…), y cuánta **IA** consume en cada módulo (tokens y costo
estimado). Se filtra por cuenta, módulo, IP y fechas, y se exporta a CSV.

- Solo se guarda la **ruta**, nunca la query (puede llevar el texto de una pregunta).
- El costo es una **estimación**: tokens × tarifa de lista (`lib/uso-ia-precios.ts`, sustituible con `AI_PRICING_JSON`). Los
  tokens son los del proveedor; cuando este no los informa (embeddings de Gemini, streaming) se estiman por la longitud y
  la pantalla lo marca con «≈».
- La IP sale de las cabeceras de la plataforma (`x-vercel-forwarded-for`, `x-real-ip`…) y solo en último lugar de
  `x-forwarded-for`, que puede escribir el cliente.
- **No se registran los intentos fallidos de contraseña**: ese paso ocurre en el navegador contra Supabase Auth y el
  servidor no lo ve. Los ve el panel de Supabase (*Authentication → Logs*).
- El consumo de IA se anota para **todas** las cuentas (el costo es de la entidad); la auditoría de IP y acciones, solo
  para las externas.

## Retención

La IP es un dato personal (Ley N.° 29733): los eventos se conservan **12 meses**. El login lo avisa. Para purgar:

```bash
npx tsx --env-file=.env.local scripts/purgar-auditoria-externos.mts            # simula
npx tsx --env-file=.env.local scripts/purgar-auditoria-externos.mts --aplicar  # borra
```

`uso_ia` no lleva IP y no se purga: es contabilidad de costos.

## Cómo funciona por dentro

- Las credenciales (`tipo`, `modulos`, `vigente_hasta`, `cuota_ia_mensual`) viven en `app_metadata` del token de Supabase,
  que solo escribe el servidor. `profiles` guarda un espejo para listar y filtrar.
- El proxy (`lib/supabase/middleware.ts`) decide con `lib/modulos-acceso.ts` y pasa al resto del servidor la identidad
  validada en cabeceras `x-ace-*` que **siempre sobrescribe** (el cliente no puede falsearlas).
- Todo el consumo de modelos pasa por un único cliente (`lib/openai-server.ts`): ahí se mide y se aplica la cuota.
- Una cuenta que llega sin `app_metadata.tipo` se trata como autoregistrada y no abre nada.
