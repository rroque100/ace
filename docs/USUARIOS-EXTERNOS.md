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
4. Ejecutar `docs/supabase/solicitudes-acceso.sql` (la tabla del formulario público de solicitud, ver más abajo). Sin él,
   `/acceso` responde que las solicitudes no están disponibles y la bandeja del administrador avisa de que falta.

## Cómo entra una persona externa

```
/acceso  →  solicitud pendiente  →  el administrador la aprueba  →  recibe usuario y contraseña temporal
        →  /login  →  /cambiar-password (primer ingreso)  →  su módulo
```

- **Pedir acceso — `/acceso` (pública).** Nombre, DNI (será su usuario), correo, celular y entidad opcionales, módulos que
  necesita, para qué los necesita y la aceptación del tratamiento de datos (Ley 29733). **No crea ninguna cuenta**: deja una
  fila *pendiente* en `solicitudes_acceso`. El registro abierto de Supabase sigue desactivado.
- **Aprobar — *Configuración → Usuarios externos → Solicitudes de acceso*.** El administrador decide los módulos (no tienen
  que ser los que se pidieron), la vigencia y la cuota de IA. Al aprobar se crea la cuenta y se muestra **una sola vez** la
  contraseña temporal junto con un mensaje listo para entregar (copiar o abrir el correo). **ACE no envía correos**: no hay
  servicio de correo detrás, y la cuenta usa un correo interno (`DNI@ace.local`) que no recibe nada. Rechazar admite un motivo.
- **Primer ingreso — `/cambiar-password`.** Toda cuenta creada por el administrador nace con el aviso `cambiar_password`: el
  proxy no la deja abrir nada más hasta que elige su propia contraseña (mínimo 8, una letra y un número, sin su DNI, ni una
  de las habituales, y distinta de la temporal). Lo guarda el servidor, que es quien puede quitar el aviso de `app_metadata`.
- **Olvidó su contraseña.** No hay recuperación por correo: el administrador le asigna otra temporal y la persona vuelve a
  elegir la suya.

### Qué impide que `/acceso` se abuse

Es lo único público. No concede nada, pero podría llenar la base o hostigar al administrador, así que la ruta
(`app/api/acceso/solicitud`) valida con el mismo esquema que la pantalla y aplica: una trampa invisible para bots, un tiempo
mínimo de relleno, **3 solicitudes por IP y hora**, **una pendiente por DNI** (la repetida responde igual que la nueva, para
no revelar qué DNI están registrados) y un tope de **300 pendientes** en total. No sustituye a un captcha: si algún día el
volumen lo pide, se añade ahí.

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

`uso_ia` no lleva IP y no se purga: es contabilidad de costos. El mismo script purga las **solicitudes de acceso ya
resueltas** (guardan nombre, DNI, correo e IP) pasados 12 meses; las pendientes no se tocan.

## Cómo funciona por dentro

- Las credenciales (`tipo`, `modulos`, `vigente_hasta`, `cuota_ia_mensual`) viven en `app_metadata` del token de Supabase,
  que solo escribe el servidor. `profiles` guarda un espejo para listar y filtrar.
- El proxy (`lib/supabase/middleware.ts`) decide con `lib/modulos-acceso.ts` y pasa al resto del servidor la identidad
  validada en cabeceras `x-ace-*` que **siempre sobrescribe** (el cliente no puede falsearlas).
- Todo el consumo de modelos pasa por un único cliente (`lib/openai-server.ts`): ahí se mide y se aplica la cuota.
- Una cuenta que llega sin `app_metadata.tipo` se trata como autoregistrada y no abre nada.
- `app_metadata.cambiar_password: true` marca la contraseña temporal. Solo cuenta si es exactamente `true`, y solo lo apaga
  `/api/auth/cambiar-password` con la clave de servicio.
- Las pantallas de acceso (`/login`, `/acceso`, `/cambiar-password`) comparten `app/components/auth/auth-ui.tsx` y van con
  Tailwind acotado a `.tw`. Ojo: `styles.css` fija `h1`/`h2` y `p { margin-top: 0 }` sin capa y le gana a las utilidades:
  los títulos llevan `!` (`text-2xl!`) y un `<p>` con margen superior, `mt-*!`.
