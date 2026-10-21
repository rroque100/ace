// Régimen del procedimiento de selección: competitivo o no competitivo.
//
// El Art. 101.1 del Reglamento es explícito sobre qué cambia en las actuaciones
// preparatorias cuando el procedimiento NO es competitivo:
//
//   "El proceso de contratación se inicia con la elaboración del requerimiento
//    […] siendo aplicables las disposiciones generales de las actuaciones
//    preparatorias contempladas en el Reglamento, CON EXCEPCIÓN DE LA
//    INTERACCIÓN CON EL MERCADO. No corresponde realizar la segmentación de
//    contrataciones."
//
// Es decir: la fase se hace igual, MENOS la segmentación (A2) y la interacción
// (A5). No es que la fase sea "solo para competitivos".
//
// Ojo con las exclusiones de la segmentación, que vienen de DOS sitios y antes
// se atribuían a un "Art. 42.5" que NO EXISTE (el Art. 42 termina en 42.3), con
// una cita entrecomillada que tampoco está en la norma:
//   · Contratos menores → Art. 42.1, literal: la segmentación clasifica las
//     contrataciones del PAC del CMN "con excepción de aquellas que correspondan
//     a contratos menores".
//   · Procedimientos no competitivos → Art. 101.1, literal: "No corresponde
//     realizar la segmentación de contrataciones".

import { PROCEDIMIENTOS_COMPETITIVOS } from "./estrategia-formato";
import { esNoCompetitivo } from "./procesos-seleccion";
import type { HitosMap } from "./procurement-fases";

export type RegimenSeleccion = "competitivo" | "no_competitivo";

export const OPCIONES_REGIMEN = [
  { value: "competitivo", label: "Competitivo (licitación pública o concurso público, y sus modalidades)" },
  { value: "no_competitivo", label: "No competitivo (Art. 55 de la Ley: causal de excepción)" },
];

/**
 * Causales del Art. 55.1 de la Ley 32069 — la lista es CERRADA.
 *
 * El régimen no se "elige": se comprueba. El Art. 54.3 fija la regla general
 * ("las entidades contratantes realizan procedimientos de selección
 * competitivos, SALVO LAS EXCEPCIONES ESTABLECIDAS EN LA PRESENTE LEY") y el
 * 55.1 enumera esas excepciones. Si no encaja en ninguna, es competitivo.
 *
 * Literales verificados uno a uno contra el texto de la Ley.
 */
export const CAUSALES_ART_55 = [
  { value: "a", label: "a) Contratación con otra entidad contratante" },
  { value: "b", label: "b) Situación de emergencia (ocurrencia o inminencia)" },
  { value: "c", label: "c) Situación de desabastecimiento" },
  { value: "d", label: "d) Proveedor único o con derechos exclusivos" },
  { value: "e", label: "e) Servicios personalísimos de personas naturales" },
  { value: "f", label: "f) Medios de comunicación para publicidad estatal" },
  { value: "g", label: "g) Bienes y servicios para investigación, desarrollo e innovación (Sinacti/Concytec)" },
  { value: "h", label: "h) Adquisición o arrendamiento de inmuebles de propiedad privada" },
  { value: "i", label: "i) Asesoría legal, contable o económica para la defensa de funcionarios, exfuncionarios y servidores (incl. FFAA/PNP)" },
  { value: "j", label: "j) Asesoría legal o técnica en la defensa de la entidad (arbitrajes o juicios)" },
  { value: "k", label: "k) Continuar prestaciones de un contrato resuelto o declarado nulo" },
  { value: "l", label: "l) Servicios de capacitación de interés de la entidad" },
  { value: "m", label: "m) Contrataciones secretas o de orden interno de las FFAA, PNP y SINA (D.S. + opinión de la Contraloría)" },
];

/**
 * Régimen DEDUCIDO de la programación (A1).
 *
 * No es un campo de A4: cuando A4 se ejecuta ya se hicieron A2 y A3, y el
 * Art. 101.1 dice que en los no competitivos "no corresponde realizar la
 * segmentación de contrataciones" y que las actuaciones preparatorias se
 * aplican "con excepción de la interacción con el mercado" — o sea, hay que
 * saberlo ANTES de A2. (Antes esto citaba un "Art. 42.5" inexistente: el
 * Art. 42 termina en 42.3.) Lo que determina el régimen es la causal del Art. 55, y
 * esa la acredita el área usuaria con un documento (así lo pide el propio
 * formato: "Documento del área usuaria […] que sustenta el Procedimiento de
 * Selección No Competitivo"). Se registra en A1, junto al PAC.
 *
 * Por defecto competitivo: es la regla general del Art. 54.3.
 */
export function regimenDe(hitos: HitosMap, tipoProcesoNecesidad?: string | null): RegimenSeleccion {
  const causal = hitos.A1?.data?.causal_art_55;
  if (typeof causal === "string" && causal.trim()) return "no_competitivo";
  // Si el área usuaria ya lo anticipó en la ficha, el efecto del Art. 101.1 se
  // aplica desde que se abre el expediente y no desde que A1 registra la causal:
  // A2 se redacta antes que A1 en la práctica, y esperar a A1 haría trabajar la
  // segmentación que el 101.1 dice que no corresponde.
  if (esNoCompetitivo(tipoProcesoNecesidad)) return "no_competitivo";
  return "competitivo";
}

/**
 * Quién aprueba una contratación por procedimiento NO competitivo (Art. 102).
 *
 * No siempre es la misma autoridad, y el informe de aprobación se dirige a quien
 * corresponda:
 *
 *   · 102.1 — la AGA en las causales a), d), e), f), g), h), i), j), l) y m).
 *   · 102.2 — el TITULAR de la entidad en las causales b), c) y k).
 *
 * Las tres del titular son las graves: emergencia, desabastecimiento y continuar
 * un contrato resuelto o nulo. Mandarle a la AGA la aprobación de una emergencia
 * la haría firmar algo que no le compete.
 */
const CAUSALES_DEL_TITULAR = ["b", "c", "k"];

export function aprobadorNoCompetitivo(causal: string | null | undefined): {
  actor: "aga" | "titular";
  label: string;
  articulo: string;
} {
  const c = (causal ?? "").trim().toLowerCase();
  return CAUSALES_DEL_TITULAR.includes(c)
    ? { actor: "titular", articulo: "Art. 102.2", label: "Titular de la entidad" }
    : { actor: "aga", articulo: "Art. 102.1", label: "Autoridad de la gestión administrativa" };
}

/** Texto de la causal del Art. 55.1, para citarla en un documento. */
export function textoCausalArt55(causal: string | null | undefined): string {
  const c = (causal ?? "").trim().toLowerCase();
  return CAUSALES_ART_55.find((x) => x.value === c)?.label ?? "";
}

/**
 * Procedimientos competitivos que corresponden al objeto (Art. 54.1).
 *
 *   "a) La licitación pública para la contratación de bienes y obras.
 *    b) El concurso público para la contratación de servicios."
 *
 * Lo que NO se puede deducir es la MODALIDAD (abreviada o no): depende de la
 * cuantía, y los Arts. 93-95 del Reglamento no la traen — remiten a un "Enlace
 * Web" con la tabla de umbrales que no está en la norma publicada en PDF. Así
 * que se ofrece la familia correcta y la DEC elige la modalidad.
 */
export function procedimientosParaObjeto(objeto: string | null | undefined) {
  const o = (objeto ?? "").toLowerCase();
  const familia =
    o.startsWith("servicio") || o.startsWith("consultoria")
      ? "servicios"
      : o.startsWith("bien") || o.startsWith("obra")
        ? "bienes y obras"
        : null;
  if (!familia) return PROCEDIMIENTOS_COMPETITIVOS;
  return PROCEDIMIENTOS_COMPETITIVOS.filter(
    (p) => p.objeto === familia || p.objeto === "modalidad diferenciada",
  );
}

/**
 * Procedimiento SUGERIDO a partir de lo que ya se sabe.
 *
 * El Art. 54.1 determina la FAMILIA sin ambigüedad (licitación pública para
 * bienes y obras, concurso público para servicios), así que eso se puede
 * afirmar. Lo que NO se puede es la MODALIDAD —abreviada o no—: depende de la
 * cuantía y los Arts. 93-95 del Reglamento no traen los umbrales, remiten a un
 * "Enlace Web" que no está en la norma publicada.
 *
 * Por eso devuelve una SUGERENCIA con su motivo y no preselecciona el campo:
 * dejar puesto "licitación pública" cuando la correcta era la abreviada sería
 * afirmar una decisión que nadie tomó, en un documento que se firma.
 */
export function procedimientoSugerido(
  objeto: string | null | undefined,
  fichaTecnica: boolean,
): { value: string; motivo: string } | null {
  const o = (objeto ?? "").toLowerCase();

  // Art. 96.1: por subasta inversa electrónica se contratan bienes y servicios
  // COMUNES QUE CUENTEN CON FICHA TÉCNICA, y Perú Compras determina en la
  // propia ficha si su uso es opcional u obligatorio. Con ficha técnica, es el
  // primer candidato.
  if (fichaTecnica && (o.startsWith("bien") || o.startsWith("servicio"))) {
    return {
      value: "subasta_inversa_electronica",
      motivo:
        "El requerimiento está estandarizado con ficha técnica: el Art. 96.1 contrata por subasta inversa electrónica los bienes y servicios comunes con ficha, y Perú Compras determina en ella si su uso es obligatorio.",
    };
  }
  if (o.startsWith("servicio") || o.startsWith("consultoria")) {
    return {
      value: "concurso_publico",
      motivo: "El Art. 54.1.b asigna el concurso público a la contratación de servicios.",
    };
  }
  if (o.startsWith("bien") || o.startsWith("obra")) {
    return {
      value: "licitacion_publica",
      motivo: "El Art. 54.1.a asigna la licitación pública a la contratación de bienes y obras.",
    };
  }
  return null;
}
