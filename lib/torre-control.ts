// Torre de control del expediente: lo que ninguna fase puede ver sola.
//
// Todo lo que salió mal en un expediente real cruzaba pasos. El valor estimado
// lo fija A5, la línea de corte la usa A2, la certificación la comprueba A7 y la
// fecha requerida vive en la Necesidad. Cada paso, por separado, estaba
// "correcto"; el expediente entero no.
//
// Por eso esto no es una lista de avisos, sino PAREJAS de datos que se
// contradicen. "S/ 285,924 frente a S/ 90,000" se entiende sin leer; "el valor
// estimado supera la certificación" hay que descifrarlo.
//
// Nada de aquí decide ni escribe: es un diagnóstico. Las cifras salen de donde
// ya estaban; lo único nuevo es mirarlas juntas.

import { clasificarSegmentacion, esProgramada, type ObjetoSegmentacion } from "./actuaciones-preparatorias";
import { montoA7 } from "./expediente-contenido";
import { avisoFechaRequerida } from "./cronograma-fechas";
import { type ActividadCronograma, leerFilas } from "./estrategia-formato";
import type { HitosMap } from "./procurement-fases";
import { calcularParametrosSegmentacion, soles } from "./segmentacion-parametros";

/** Gravedad de una tarjeta. `stop` = no debería aprobarse el expediente así. */
export type NivelControl = "ok" | "warn" | "stop" | "mute";

export type TarjetaControl = {
  clave: "origen" | "cuantia" | "presupuesto" | "entrega";
  /** Etiqueta con su artículo: el usuario aprende de dónde sale la exigencia. */
  etiqueta: string;
  /** La cifra o el dato, grande. Vacío si aún no se conoce. */
  valor: string;
  /** Qué significa y, si hay problema, cuál es la salida. */
  nota: string;
  nivel: NivelControl;
  /** Paso que hay que abrir para resolverlo. */
  paso?: string;
};

export type EntradaTorre = {
  hitos: HitosMap;
  /** Valor estimado del expediente: lo fija A5 con el mercado (Art. 47.1). */
  valorEstimado: number | null;
  /** Lo que el área usuaria estimó en su necesidad. */
  montoNecesidad: number | null;
  /** Fecha para la que el área usuaria pidió la contratación. */
  fechaRequerida: string | null;
  /** PAC de bienes y servicios registrado en Configuración. */
  pacBienesServicios: number | null;
  /** Necesidad de origen. `null` si el expediente no está vinculado. */
  necesidad: { codigo: string; status: string } | null;
  /** Campos donde la DEC se apartó de lo que propuso el área usuaria (Art. 44.7). */
  divergencias: string[];
};

/** Diferencia relativa a partir de la cual una brecha merece mirarse. */
const BRECHA_MINIMA = 0.1;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function tarjetaOrigen(e: EntradaTorre): TarjetaControl {
  if (!e.necesidad) {
    return {
      clave: "origen",
      etiqueta: "Origen · Necesidad",
      valor: "Sin vincular",
      nota: "Este expediente no apunta a ninguna necesidad, así que no puede traer lo que propuso el área usuaria (Art. 44.2) ni avisar si se aparta de ello.",
      nivel: "warn",
    };
  }
  if (e.divergencias.length > 0) {
    return {
      clave: "origen",
      etiqueta: "Origen · Necesidad",
      valor: e.necesidad.codigo,
      nota: `La estrategia se aparta de lo que propuso el área usuaria en ${e.divergencias.length === 1 ? "un punto" : `${e.divergencias.length} puntos`} (${e.divergencias.join(", ")}). El Art. 44.7 exige su no objeción.`,
      nivel: "warn",
      paso: "A3",
    };
  }
  return {
    clave: "origen",
    etiqueta: "Origen · Necesidad",
    valor: e.necesidad.codigo,
    nota: "La estrategia respeta lo que propuso el área usuaria.",
    nivel: "ok",
  };
}

/**
 * La cuantía que sale del mercado (Art. 47.1) es el dato del que cuelga todo lo
 * demás: la línea de corte de A2 (Art. 125.2) y la certificación de A7.
 */
function tarjetaCuantia(e: EntradaTorre): TarjetaControl {
  const base = { clave: "cuantia" as const, etiqueta: "Cuantía · Art. 47.1", paso: "A5" };
  if (e.valorEstimado == null) {
    return {
      ...base,
      valor: "Sin fijar",
      nota: "La interacción con el mercado (A5) todavía no ha fijado la cuantía. Sin ella, A2 no puede calcular su línea de corte y el expediente sale sin cuantía.",
      nivel: "warn",
    };
  }

  const partes: string[] = [];
  let nivel: NivelControl = "ok";

  // Lo que estimó el área usuaria frente a lo que dice el mercado.
  const estimado = num(e.montoNecesidad);
  if (estimado) {
    const ratio = e.valorEstimado / estimado;
    if (ratio > 1 + BRECHA_MINIMA || ratio < 1 - BRECHA_MINIMA) {
      partes.push(`El área usuaria estimó ${soles(estimado)} (${ratio.toFixed(1)}×).`);
      nivel = "warn";
    }
  }

  // ¿La cuantía real contradice la segmentación ya registrada en A2?
  const a2 = (e.hitos.A2?.data ?? {}) as Record<string, unknown>;
  const objeto = typeof a2.objeto === "string" ? (a2.objeto as ObjetoSegmentacion) : null;
  const a1 = (e.hitos.A1?.data ?? {}) as Record<string, unknown>;
  const programada = esProgramada(a1);
  const params = calcularParametrosSegmentacion({
    pacBienesServicios: e.pacBienesServicios,
    programada,
    valorEstimado: e.valorEstimado,
  });

  if (params && objeto === "bienes_servicios") {
    partes.push(
      `${params.porcentaje}% del PAC actualizado; la línea de corte es ${soles(params.lineaCorte)}.`,
    );
    const riesgo = Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [];
    const registrada = clasificarSegmentacion({ objeto, cuantiaAlta: a2.cuantiaAlta === true, condicionesRiesgo: riesgo });
    const real = clasificarSegmentacion({ objeto, cuantiaAlta: params.cuantiaAlta, condicionesRiesgo: riesgo });
    if (real.categoria !== registrada.categoria) {
      partes.push(
        `Con esta cuantía la segmentación pasa de ${registrada.categoriaLabel} a ${real.categoriaLabel}, que exige ${real.nivelLabel.toLowerCase()}. Revisa A2 y A5.`,
      );
      nivel = "stop";
    }
  }

  return {
    ...base,
    valor: soles(e.valorEstimado),
    nota: partes.join(" ") || "Fijada con la interacción con el mercado. De ella salen la línea de corte de A2 y la certificación de A7.",
    nivel,
  };
}

function tarjetaPresupuesto(e: EntradaTorre): TarjetaControl {
  // La cobertura (el monto cubre la cuantía) la fija el Art. 53.1; que su falta
  // impida aprobar el expediente, el Art. 54.2.f. El 14.2.j es solo la función
  // de la DEC de solicitar la CCP, así que no es la cita de este control.
  const base = { clave: "presupuesto" as const, etiqueta: "Presupuesto · Art. 53 / 54.2.f", paso: "A7" };
  const a7 = (e.hitos.A7?.data ?? {}) as Record<string, unknown>;
  const monto = num(montoA7(a7));
  if (!monto) {
    return {
      ...base,
      valor: "Sin registrar",
      nota: "Sin certificación de crédito presupuestario ni previsión no procede aprobar el expediente (A8).",
      nivel: "mute",
    };
  }
  if (e.valorEstimado != null && monto < e.valorEstimado) {
    return {
      ...base,
      valor: soles(monto),
      nota: `No cubre la cuantía de la contratación (${soles(e.valorEstimado)}). Sin cobertura no procede aprobar el expediente: amplía la certificación o replantea el requerimiento.`,
      nivel: "stop",
    };
  }
  return { ...base, valor: soles(monto), nota: "Cubre la cuantía de la contratación.", nivel: "ok" };
}

/**
 * La pregunta por la que existe la contratación: ¿llega cuando hace falta?
 * Nadie la miraba, porque la fecha requerida y el cronograma viven en pantallas
 * distintas.
 */
function tarjetaEntrega(e: EntradaTorre): TarjetaControl {
  const base = { clave: "entrega" as const, etiqueta: "Entrega estimada", paso: "A4" };
  const a4 = (e.hitos.A4?.data ?? {}) as Record<string, unknown>;
  const a3 = (e.hitos.A3?.data ?? {}) as Record<string, unknown>;
  const filas = leerFilas<ActividadCronograma>(a4.cronograma_items);
  const plazo = num(a3.plazo_dias);
  const aviso = avisoFechaRequerida(filas, e.fechaRequerida, plazo);
  if (aviso) {
    return {
      ...base,
      valor: aviso.entrega,
      nota: `${aviso.diasTarde} días después de la fecha que pidió el área usuaria (${aviso.requerida}). Ajusta el cronograma o deja constancia del motivo.`,
      nivel: "warn",
    };
  }
  if (filas.length === 0) {
    return {
      ...base,
      valor: "Sin cronograma",
      nota: "El cronograma de A4 o) todavía no tiene actividades, así que no se sabe cuándo llegaría.",
      nivel: "mute",
    };
  }
  return {
    ...base,
    valor: e.fechaRequerida ? "En plazo" : "Sin fecha requerida",
    nota: e.fechaRequerida
      ? "El cronograma llega a la fecha que pidió el área usuaria."
      : "La necesidad no registra para cuándo se pide, así que no se puede comprobar si el cronograma llega a tiempo.",
    nivel: e.fechaRequerida ? "ok" : "mute",
  };
}

/** Las cuatro parejas que ninguna fase ve por su cuenta. */
export function tarjetasDeControl(e: EntradaTorre): TarjetaControl[] {
  return [tarjetaOrigen(e), tarjetaCuantia(e), tarjetaPresupuesto(e), tarjetaEntrega(e)];
}

/** Cuántas tarjetas bloquean la aprobación del expediente. */
export function cuantasBloquean(tarjetas: readonly TarjetaControl[]): number {
  return tarjetas.filter((t) => t.nivel === "stop").length;
}
