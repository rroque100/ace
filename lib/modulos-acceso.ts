// Acceso de usuarios EXTERNOS por módulo.
//
// Hasta ahora toda cuenta era personal de la entidad, con un rol de la Ley 32069. Una persona externa (un
// asesor, un alumno) necesita entrar solo a una parte —el Centro Jurídico, el simulacro de examen o ambos— y no
// ver nada más. Con roles no se puede: `consulta` abre chat, búsqueda, normas, historial, guardados y validación
// a la vez, y cada ruta se protege por separado (no había «denegar por omisión»).
//
// Aquí el criterio se invierte para los externos: cada módulo lista las páginas y APIs que abre, y TODO lo demás
// está cerrado. Se aplica en el proxy, el único punto por el que pasan todas las rutas.
//
// Las credenciales del externo viven en `app_metadata` del token de Supabase (solo el servidor puede escribirlas;
// la persona no puede cambiarlas, a diferencia de `user_metadata`), así que el proxy las lee sin ir a la base.
// Módulo puro: sin red ni base de datos.

export const MODULOS_EXTERNOS = {
  centro_juridico: {
    label: "Centro Jurídico",
    descripcion: "Chat jurídico, búsqueda documental y normativa.",
    inicio: "/chat",
    paginas: ["/chat", "/busqueda", "/normas"],
    // El chat, la búsqueda (incluida la voz) y el lector de normas. Un externo tiene rol `consulta`, de modo que las
    // rutas de gestión de documentos (subir, borrar, reindexar) siguen cerradas por sus propios guards.
    apis: ["/api/chat", "/api/search", "/api/norms", "/api/normativa", "/api/facets", "/api/documents"],
  },
  simulacro: {
    label: "Simulacro de examen",
    descripcion: "Práctica del examen de certificación con corrección y cita de la norma.",
    inicio: "/simulacro",
    paginas: ["/simulacro", "/simulador"],
    apis: ["/api/simulacro", "/api/exams"],
  },
} as const;

export type ModuloExterno = keyof typeof MODULOS_EXTERNOS;
export const LISTA_MODULOS_EXTERNOS = Object.keys(MODULOS_EXTERNOS) as ModuloExterno[];

export const esModuloExterno = (valor: unknown): valor is ModuloExterno =>
  typeof valor === "string" && Object.hasOwn(MODULOS_EXTERNOS, valor);

// Abiertas para cualquier cuenta, externa o no: entrar, salir y la comprobación de salud.
const COMUNES = ["/login", "/auth", "/api/health", "/api/auth"];

const coincide = (pathname: string, prefijo: string) => pathname === prefijo || pathname.startsWith(`${prefijo}/`);

/** ¿Puede una cuenta externa con estos módulos abrir esta ruta? Todo lo que no figura está cerrado. */
export function rutaPermitidaExterno(modulos: readonly ModuloExterno[], pathname: string): boolean {
  if (COMUNES.some((prefijo) => coincide(pathname, prefijo))) return true;
  return modulos.some((modulo) => {
    const definicion = MODULOS_EXTERNOS[modulo];
    return [...definicion.paginas, ...definicion.apis].some((prefijo) => coincide(pathname, prefijo));
  });
}

/** El módulo al que pertenece una ruta, para anotar la auditoría; `null` si no es de ninguno. */
export function moduloDeRuta(pathname: string): ModuloExterno | null {
  for (const modulo of LISTA_MODULOS_EXTERNOS) {
    const definicion = MODULOS_EXTERNOS[modulo];
    if ([...definicion.paginas, ...definicion.apis].some((prefijo) => coincide(pathname, prefijo))) return modulo;
  }
  return null;
}

/** Dónde aterriza la persona al entrar: el inicio de su primer módulo (el inicio general es del personal de la entidad). */
export function inicioExterno(modulos: readonly ModuloExterno[]): string {
  return modulos.length ? MODULOS_EXTERNOS[modulos[0]].inicio : "/login";
}

export type CredencialExterna = {
  externo: boolean;
  modulos: ModuloExterno[];
  /** Fin del acceso (ms desde 1970), o null si no caduca. */
  vigenteHasta: number | null;
  vencido: boolean;
  /** Tokens de IA permitidos por mes, o null si no hay tope. */
  cuotaIAMensual: number | null;
};

const NO_EXTERNO: CredencialExterna = { externo: false, modulos: [], vigenteHasta: null, vencido: false, cuotaIAMensual: null };

/**
 * Lee las credenciales del `app_metadata` del token. Lo que no sea una cuenta externa bien formada se trata como
 * sin acceso, nunca como acceso total: una cuenta externa con módulos ilegibles no puede abrir nada.
 */
export function leerCredencialExterna(appMetadata: unknown, ahora: number): CredencialExterna {
  if (!appMetadata || typeof appMetadata !== "object") return NO_EXTERNO;
  const datos = appMetadata as Record<string, unknown>;
  if (datos.tipo !== "externo") return NO_EXTERNO;
  const modulos = Array.isArray(datos.modulos) ? [...new Set(datos.modulos.filter(esModuloExterno))] : [];
  const hasta = typeof datos.vigente_hasta === "string" ? Date.parse(datos.vigente_hasta) : NaN;
  const cuota = typeof datos.cuota_ia_mensual === "number" && Number.isFinite(datos.cuota_ia_mensual) && datos.cuota_ia_mensual >= 0 ? Math.floor(datos.cuota_ia_mensual) : null;
  return {
    externo: true,
    modulos,
    vigenteHasta: Number.isFinite(hasta) ? hasta : null,
    // Una fecha de fin ilegible no se interpreta como «para siempre»: si viene un texto pero no es una fecha, vence.
    vencido: typeof datos.vigente_hasta === "string" && datos.vigente_hasta.trim() !== "" ? !Number.isFinite(hasta) || hasta <= ahora : false,
    cuotaIAMensual: cuota,
  };
}

/** Lo que se guarda en `app_metadata` al dar de alta o editar a un externo. */
export function credencialParaGuardar(entrada: { modulos: readonly string[]; vigenteHasta?: string | null; cuotaIAMensual?: number | null }) {
  return {
    tipo: "externo" as const,
    modulos: [...new Set(entrada.modulos.filter(esModuloExterno))],
    vigente_hasta: entrada.vigenteHasta || null,
    cuota_ia_mensual: entrada.cuotaIAMensual ?? null,
  };
}

// ── IP del cliente ──────────────────────────────────────────────────────────────────────────────────────

const IP_VALIDA = /^[0-9a-fA-F:.]{3,45}$/;

/**
 * IP del cliente según las cabeceras que pone la plataforma. Se prefieren las que fija la propia plataforma
 * (Vercel, Netlify) y solo en último lugar `x-forwarded-for`, cuyo primer valor puede venir escrito por el cliente
 * si no hay un proxy de confianza delante. Devuelve «desconocida» si nada tiene forma de IP.
 */
export function ipDeSolicitud(cabecera: (nombre: string) => string | null): string {
  for (const nombre of ["x-vercel-forwarded-for", "x-nf-client-connection-ip", "cf-connecting-ip", "x-real-ip", "x-forwarded-for"]) {
    const valor = cabecera(nombre)?.split(",")[0]?.trim();
    if (valor && IP_VALIDA.test(valor)) return valor;
  }
  return "desconocida";
}

// ── Qué se registra ─────────────────────────────────────────────────────────────────────────────────────

export type SolicitudAuditable = { metodo: string; pathname: string; esDocumento: boolean; esPrecarga: boolean };

/**
 * Qué acción registrar para una solicitud de una cuenta externa, o `null` si no merece una fila. Se registran las
 * páginas que abre y todo lo que ESCRIBE (POST/PUT/PATCH/DELETE: preguntar al chat, grabar voz, enviar un examen).
 * No se registran las lecturas de API ni las precargas del navegador: son ruido que dispararía el volumen sin decir
 * qué hizo la persona.
 */
export function accionAuditable(solicitud: SolicitudAuditable): string | null {
  if (solicitud.esPrecarga) return null;
  // Entrar y salir se registran aparte, con sus propias acciones («login», «logout»): aquí serían un duplicado sin información.
  if (COMUNES.some((prefijo) => coincide(solicitud.pathname, prefijo) && prefijo !== "/login")) return null;
  const metodo = solicitud.metodo.toUpperCase();
  if (solicitud.pathname.startsWith("/api/")) return metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS" ? null : `api ${metodo} ${solicitud.pathname}`;
  return metodo === "GET" && solicitud.esDocumento ? `ver ${solicitud.pathname}` : null;
}

// ── Decisión del proxy ──────────────────────────────────────────────────────────────────────────────────

export type DecisionExterno =
  | { tipo: "permitir" }
  | {
      tipo: "denegar";
      motivo: "vencido" | "sin_modulos" | "ruta";
      /** Adónde llevar a una PÁGINA denegada; una API recibe un 403 sin redirección. */
      destino: string;
      /** «/» es donde cae toda persona al entrar: llevarla a su inicio no es un intento de acceso indebido. */
      esperado: boolean;
    };

/**
 * Qué hacer con una solicitud de una cuenta externa. Se evalúa en orden de gravedad: un acceso vencido o sin módulos
 * solo puede entrar, salir y comprobar la salud; con módulos vigentes, solo lo que esos módulos abren.
 */
export function decidirAccesoExterno(credencial: CredencialExterna, pathname: string): DecisionExterno {
  const soloComunes = credencial.vencido || credencial.modulos.length === 0;
  if (soloComunes) {
    if (rutaPermitidaExterno([], pathname)) return { tipo: "permitir" };
    return { tipo: "denegar", motivo: credencial.vencido ? "vencido" : "sin_modulos", destino: `/login?acceso=${credencial.vencido ? "vencido" : "sin_modulos"}`, esperado: false };
  }
  if (rutaPermitidaExterno(credencial.modulos, pathname)) return { tipo: "permitir" };
  return { tipo: "denegar", motivo: "ruta", destino: inicioExterno(credencial.modulos), esperado: pathname === "/" };
}
