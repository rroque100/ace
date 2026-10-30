// Solicitud de acceso de una persona externa.
//
// Una persona sin cuenta deja sus datos y el módulo que necesita; NO se crea ninguna cuenta. El administrador revisa la
// solicitud y, si la aprueba, crea la cuenta con los módulos, la vigencia y la cuota que decida (ver
// app/api/configuracion/externos/solicitudes). Así el registro abierto de Supabase sigue desactivado: lo único público
// es este formulario, que solo escribe una fila «pendiente».
//
// Módulo puro (sin red ni base de datos): lo usan la ruta pública, el panel del administrador y los tests.

import { z } from "zod";
import { LISTA_MODULOS_EXTERNOS, MODULOS_EXTERNOS, esModuloExterno, type ModuloExterno } from "./modulos-acceso";
import { esUsuarioValido, USUARIO_LONGITUD } from "./usuario-credencial";

export const ESTADOS_SOLICITUD = ["pendiente", "aprobada", "rechazada"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

/**
 * Los topes que impiden que el formulario público sirva para llenar la base de basura o para hostigar al administrador.
 * No sustituyen a un anti-bots de verdad (captcha), pero con el registro abierto desactivado el daño máximo es una
 * bandeja de solicitudes sin aprobar: nadie obtiene acceso por enviar el formulario.
 */
export const LIMITES_SOLICITUD = {
  /** Solicitudes por IP en una hora. */
  porIpPorHora: 3,
  /** Pendientes en total: más allá se rechaza hasta que el administrador despeje la bandeja. */
  pendientesTotales: 300,
  /** Un formulario que se envía antes de esto no lo rellenó una persona. */
  tiempoMinimoMs: 2_000,
} as const;

const SOLO_LETRAS = /^[\p{L}][\p{L} .'’-]*$/u;
const CELULAR = /^\+?[\d ]{6,18}$/;

export const solicitudSchema = z.object({
  nombre: z.string().trim().min(5, "Escribe tu nombre completo").max(120, "El nombre es demasiado largo").regex(SOLO_LETRAS, "El nombre solo puede llevar letras y espacios"),
  dni: z.string().trim().refine(esUsuarioValido, `El DNI tiene ${USUARIO_LONGITUD} dígitos`),
  correo: z.string().trim().toLowerCase().max(120, "El correo es demasiado largo").pipe(z.email("Escribe un correo válido")),
  celular: z.string().trim().regex(CELULAR, "Escribe un celular válido, solo números").optional().or(z.literal("")),
  institucion: z.string().trim().max(120, "La institución es demasiado larga").optional().or(z.literal("")),
  modulos: z.array(z.enum(LISTA_MODULOS_EXTERNOS as [ModuloExterno, ...ModuloExterno[]])).min(1, "Elige al menos un módulo").max(LISTA_MODULOS_EXTERNOS.length),
  motivo: z.string().trim().min(10, "Cuéntanos en pocas palabras para qué lo necesitas").max(500, "El motivo es demasiado largo (máximo 500 caracteres)"),
  // Ley N.° 29733: se guardan datos personales y la IP; la persona lo acepta de forma expresa.
  consentimiento: z.boolean().refine((valor) => valor === true, "Debes aceptar el tratamiento de tus datos para enviar la solicitud"),
});
export type SolicitudAcceso = z.infer<typeof solicitudSchema>;

/** Campos que no son de la persona: los pone el formulario para frenar envíos automáticos. */
export type SenalesAntiBot = { sitioWeb?: unknown; tardoMs?: unknown };

export type DecisionSolicitud =
  | { tipo: "aceptar" }
  /** Se responde como si se hubiera recibido, pero no se guarda: no se le dice nada útil al bot. */
  | { tipo: "descartar"; motivo: "bot" | "duplicada" }
  | { tipo: "rechazar"; motivo: "muy_rapida" | "limite_ip" | "saturado"; estado: 429 | 503; mensaje: string };

/**
 * Qué hacer con una solicitud ya validada. La duplicada (mismo DNI ya pendiente) se descarta en silencio con la misma
 * respuesta de éxito: contestar «ya existe una solicitud» o «ya tienes cuenta» dejaría a cualquiera comprobar qué DNI
 * están registrados.
 */
export function decidirSolicitud(entrada: {
  senales: SenalesAntiBot;
  /** Solicitudes pendientes con el mismo DNI. */
  pendientesMismoDni: number;
  /** Solicitudes de esta IP en la última hora. */
  solicitudesIpUltimaHora: number;
  ipConocida: boolean;
  pendientesTotales: number;
}): DecisionSolicitud {
  if (typeof entrada.senales.sitioWeb === "string" && entrada.senales.sitioWeb.trim() !== "") return { tipo: "descartar", motivo: "bot" };
  const tardo = entrada.senales.tardoMs;
  if (typeof tardo === "number" && Number.isFinite(tardo) && tardo < LIMITES_SOLICITUD.tiempoMinimoMs) {
    return { tipo: "rechazar", motivo: "muy_rapida", estado: 429, mensaje: "Enviaste el formulario demasiado rápido. Espera un momento e inténtalo otra vez." };
  }
  if (entrada.pendientesMismoDni > 0) return { tipo: "descartar", motivo: "duplicada" };
  // Sin IP identificable no se limita por IP (bloquearía a todos los que comparten «desconocida»): quedan el tope global y la duplicada.
  if (entrada.ipConocida && entrada.solicitudesIpUltimaHora >= LIMITES_SOLICITUD.porIpPorHora) {
    return { tipo: "rechazar", motivo: "limite_ip", estado: 429, mensaje: "Ya enviaste varias solicitudes desde esta red. Inténtalo de nuevo más tarde." };
  }
  if (entrada.pendientesTotales >= LIMITES_SOLICITUD.pendientesTotales) {
    return { tipo: "rechazar", motivo: "saturado", estado: 503, mensaje: "En este momento no podemos recibir más solicitudes. Inténtalo de nuevo en unos días." };
  }
  return { tipo: "aceptar" };
}

/** Código corto que ve la persona al enviar y el administrador en su bandeja. No da acceso a nada. */
export const codigoDeSolicitud = (id: string): string => `SA-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" });

/**
 * El texto que el administrador le entrega a la persona (por correo o mensaje) tras aprobar. ACE no envía correos: no hay
 * servicio de correo detrás, y la cuenta usa un correo interno (`DNI@ace.local`) que no recibe nada.
 */
export function mensajeBienvenida(datos: {
  nombre: string | null;
  usuario: string;
  passwordTemporal: string;
  urlLogin: string;
  modulos: readonly string[];
  vigenteHasta?: string | null;
}): string {
  const modulos = datos.modulos.filter(esModuloExterno).map((modulo) => MODULOS_EXTERNOS[modulo].label);
  const saludo = datos.nombre?.trim() ? `Hola ${datos.nombre.trim().split(/\s+/)[0]},` : "Hola,";
  return [
    saludo,
    "",
    "Tu acceso a ACE IA Jurídica fue aprobado.",
    "",
    `Ingresa aquí: ${datos.urlLogin}`,
    `Usuario (tu DNI): ${datos.usuario}`,
    `Contraseña temporal: ${datos.passwordTemporal}`,
    modulos.length ? `Módulos habilitados: ${modulos.join(", ")}` : "",
    datos.vigenteHasta ? `Acceso vigente hasta el ${fechaLarga(datos.vigenteHasta)}.` : "",
    "",
    "Al entrar por primera vez, ACE te pedirá elegir tu propia contraseña. No compartas la temporal con nadie.",
  ].filter((linea, indice, lineas) => linea !== "" || (lineas[indice - 1] !== "" && indice !== lineas.length - 1)).join("\n");
}
