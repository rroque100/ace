/**
 * Topes numéricos que el modelo de requerimiento impone a los requisitos de
 * calificación, y que hasta ahora no comprobaba nadie.
 *
 * Son límites duros del formato oficial. Superarlos no es un matiz de estilo:
 * unas bases con una experiencia exigida por encima del tope se observan, y el
 * procedimiento se retrasa. La aplicación ya conoce la cuantía, así que puede
 * avisar mientras se redacta en vez de que aparezca al revisar.
 *
 * Se avisa, NO se bloquea: la ficha es una PROPUESTA del área usuaria y quien
 * establece los requisitos es la DEC en la estrategia (Art. 72.1). Impedir
 * escribir una cifra sería arrogarse esa decisión.
 */

/** Experiencia del postor: el monto facturado no puede superar 3 veces la cuantía. */
export const FACTOR_MAXIMO_EXPERIENCIA = 3;
/** Para MYPE, la experiencia exigida no supera el 25% de la cuantía del ítem. */
export const PORCENTAJE_MAXIMO_MYPE = 0.25;
/** La experiencia del postor se acredita con un máximo de 20 contrataciones. */
export const MAXIMO_CONTRATACIONES = 20;
/** La capacitación del personal clave no excede 120 horas. */
export const MAXIMO_HORAS_CAPACITACION = 120;
/** La experiencia del personal clave no cuenta más allá de 25 años de antigüedad. */
export const MAXIMO_ANIOS_EXPERIENCIA_PERSONAL = 25;

/**
 * Extrae importes en soles de un texto libre.
 *
 * Acepta lo que la gente escribe de verdad: «S/ 1 500 000.00», «1,500,000»,
 * «1500000 soles». Se descartan los números pequeños (menos de 1000) porque en
 * este contexto son plazos, cantidades de personal o porcentajes, no importes.
 */
export function importesDelTexto(texto: string): number[] {
  const salida: number[] = [];
  const re = /(?:S\/\.?\s*)?(\d[\d., \s]{3,})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const crudo = m[1].replace(/[ \s]/g, "");
    // Separador decimal: solo si son exactamente dos dígitos al final.
    const normalizado = /[.,]\d{2}$/.test(crudo)
      ? crudo.slice(0, -3).replace(/[.,]/g, "") + "." + crudo.slice(-2)
      : crudo.replace(/[.,]/g, "");
    const n = Number.parseFloat(normalizado);
    if (Number.isFinite(n) && n >= 1000) salida.push(n);
  }
  return salida;
}

export type AvisoTope = {
  /** Texto ya redactado para enseñar al usuario. */
  mensaje: string;
  /** Para agrupar o filtrar; no se muestra. */
  clave: "experiencia_monto" | "contrataciones" | "horas_capacitacion";
};

const soles = (n: number) =>
  `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

/**
 * Revisa el texto de un requisito contra los topes del modelo.
 *
 * `cuantia` puede ser null: sin ella no se puede calcular el tope de la
 * experiencia y ese aviso se omite en vez de inventarse una referencia. Los
 * topes que no dependen de la cuantía sí se comprueban igual.
 */
export function avisosDeTopes(
  texto: string,
  cuantia: number | null,
  tipo: "experiencia_postor" | "capacidad_tecnica",
): AvisoTope[] {
  const avisos: AvisoTope[] = [];
  if (!texto.trim()) return avisos;

  if (tipo === "experiencia_postor") {
    if (cuantia && cuantia > 0) {
      const tope = cuantia * FACTOR_MAXIMO_EXPERIENCIA;
      const excede = importesDelTexto(texto).filter((n) => n > tope);
      if (excede.length > 0) {
        avisos.push({
          clave: "experiencia_monto",
          mensaje:
            `El monto facturado exigido (${soles(Math.max(...excede))}) supera el tope del modelo: ` +
            `${FACTOR_MAXIMO_EXPERIENCIA} veces la cuantía, ${soles(tope)}.`,
        });
      }
    }
    const contrataciones = texto.match(/(\d{1,3})\s*(?:\(\d+\)\s*)?contratacion/i);
    if (contrataciones && Number.parseInt(contrataciones[1], 10) > MAXIMO_CONTRATACIONES) {
      avisos.push({
        clave: "contrataciones",
        mensaje: `La experiencia se acredita con un máximo de ${MAXIMO_CONTRATACIONES} contrataciones.`,
      });
    }
  }

  if (tipo === "capacidad_tecnica") {
    const horas = texto.match(/(\d{1,4})\s*horas/i);
    if (horas && Number.parseInt(horas[1], 10) > MAXIMO_HORAS_CAPACITACION) {
      avisos.push({
        clave: "horas_capacitacion",
        mensaje: `La capacitación del personal clave no excede ${MAXIMO_HORAS_CAPACITACION} horas.`,
      });
    }
  }

  return avisos;
}
