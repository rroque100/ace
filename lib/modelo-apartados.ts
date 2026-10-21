/**
 * Que campos exige un PDF-modelo de requerimiento, leido de sus APARTADOS.
 *
 * POR QUE NO LA IA. Esto lo derivaba un modelo de lenguaje leyendo el documento
 * entero. Dentro de una misma tanda respondia igual, pero entre tandas la
 * respuesta cambiaba mucho: para el mismo modelo y el mismo objeto se han visto
 * listas de 12, 14 y 21 campos. Una ficha que enseña unos campos u otros segun
 * el dia no es utilizable, y encima el resultado quedaba cacheado sin que nadie
 * pudiera revisarlo.
 *
 * COMO. Los modelos del OECE comparten los nombres de sus apartados —modalidad
 * de pago, sistema de entrega, penalidades, subcontratacion…—, aunque cambian de
 * letra entre procedimientos: la subcontratacion es «g.» en unos y «h.» en
 * otros. Asi que se casa por NOMBRE normalizado y nunca por letra.
 *
 * El OCR ensucia los titulos («F Ó RMULAS DE REAJUSTES», «CONTRA C T UALE»), asi
 * que la normalizacion quita acentos y TODO lo que no sea letra. Por eso las
 * claves de la tabla van sin espacios: son el resultado de normalizar el titulo.
 *
 * Es reproducible, se puede leer, se prueba, no cuesta nada y sigue funcionando
 * cuando la IA no responde.
 */

/** Quita acentos y todo lo que no sea letra: absorbe el ruido del OCR. */
export function normalizarTitulo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/**
 * Apartado del modelo -> campos de la ficha que lo cubren.
 *
 * `clave` es el titulo ya normalizado, y basta con que sea un PREFIJO
 * distinguible: «FORMULADEREAJUST» vale para «fórmula» y «fórmulas», singular y
 * plural, que ambos aparecen en el corpus.
 */
export const APARTADOS_MODELO: ReadonlyArray<{
  clave: string;
  apartado: string;
  apis: readonly string[];
}> = [
  // Secciones numeradas del Capitulo III.
  { apartado: "3.1 Finalidad pública", apis: ["finalidadPublica"], clave: "FINALIDADPUBLICA" },
  { apartado: "3.2 Descripción general", apis: ["descripcionGeneral"], clave: "DESCRIPCIONGENERAL" },
  {
    apartado: "3.4 Términos de referencia / Especificaciones técnicas",
    apis: ["descripcionDetallada"],
    clave: "TERMINOSDEREFERENCIA",
  },
  {
    apartado: "3.4 Especificaciones técnicas",
    apis: ["descripcionDetallada"],
    clave: "ESPECIFICACIONESTECNICAS",
  },
  {
    apartado: "3.5 Requisitos de calificación",
    apis: ["requisitosCalificacion"],
    clave: "REQUISITOSDECALIFICACION",
  },

  // Apartados con letra dentro de «condiciones de contratación». El orden de la
  // letra cambia entre modelos; el nombre no.
  { apartado: "Modalidad de pago", apis: ["modalidadPago"], clave: "MODALIDADDEPAGO" },
  { apartado: "Sistema de entrega", apis: ["sistemaEntrega"], clave: "SISTEMADEENTREGA" },
  {
    // El computo del plazo acompaña siempre al plazo: un numero de dias sin
    // unidad no significa nada en un contrato (Art. 105.3).
    apartado: "Plazo de prestación",
    apis: ["plazoEjecucion", "plazoEjecucionUnidad"],
    clave: "PLAZODEPRESTACION",
  },
  {
    apartado: "Plazo de ejecución",
    apis: ["plazoEjecucion", "plazoEjecucionUnidad"],
    clave: "PLAZODEEJECUCION",
  },
  {
    // La ficha descompone el lugar en departamento/provincia/distrito ademas del
    // texto libre, porque la entidad tiene UNA ubicacion y se elige de catalogo.
    apartado: "Lugar de prestación o entrega",
    apis: ["lugarEntrega", "departamento", "provincia", "distrito"],
    clave: "LUGARDEPRESTACION",
  },
  {
    apartado: "Lugar de entrega",
    apis: ["lugarEntrega", "departamento", "provincia", "distrito"],
    clave: "LUGARDEENTREGA",
  },
  { apartado: "Adelanto directo", apis: ["adelantoDirecto"], clave: "ADELANTODIRECTO" },
  { apartado: "Adelantos", apis: ["adelantoDirecto"], clave: "ADELANTOS" },
  {
    // El apartado de penalidades trae la de mora SIEMPRE y abre el cuadro de
    // otras penalidades (Art. 119.1).
    apartado: "Penalidades",
    apis: ["penalidadMora", "otrasPenalidades"],
    clave: "PENALIDADES",
  },
  { apartado: "Subcontratación", apis: ["subcontratacion"], clave: "SUBCONTRATACION" },
  { apartado: "Fórmula de reajuste", apis: ["formulaReajuste"], clave: "FORMULADEREAJUST" },
  { apartado: "Fórmulas de reajustes", apis: ["formulaReajuste"], clave: "FORMULASDEREAJUST" },
  {
    apartado: "Solución de controversias contractuales",
    apis: ["solucionControversias"],
    clave: "SOLUCIONDECONTROVERSIAS",
  },
  // Los modelos de OBRAS y consultoria de obra no usan las letras a)-j): tienen
  // sus propias secciones. Se detectan por nombre igual que el resto.
  {
    apartado: "Metas físicas u objetivos funcionales (obras)",
    apis: ["metasFisicas"],
    clave: "METASFISICAS",
  },
  {
    apartado: "Plazos (obras)",
    apis: ["plazoEjecucion", "plazoEjecucionUnidad"],
    clave: "PLAZOS",
  },
  {
    apartado: "Plazo para respuestas entre las partes",
    apis: ["plazoRespuestas"],
    clave: "PLAZOPARARESPUESTAS",
  },
];

/**
 * Titulos candidatos del texto del modelo.
 *
 * Se buscan SOLO donde un titulo puede estar —letra o numero de seccion seguido
 * de una tirada en mayusculas— y no en cualquier parte del documento. Buscar la
 * palabra suelta daria falsos positivos: casi todos los modelos MENCIONAN los
 * adelantos en una nota aunque no tengan ese apartado.
 */
export function titulosDelModelo(texto: string): string[] {
  const patrones = [
    /(?:^|\n|\s)([a-j])\.\s{0,4}([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \t/]{4,60})/g,
    // Hasta tres niveles. Los modelos de OBRAS numeran «3.5.14. PENALIDADES
    // POR MORA»; con solo «3.\d» no casaba ni un titulo en esos documentos.
    /(?:^|\n|\s)(3(?:\.\d{1,2}){1,2})\.?\s{0,4}([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \t/]{4,60})/g,
  ];
  const salida: string[] = [];
  for (const re of patrones) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto))) salida.push(m[2].trim());
  }
  return salida;
}

/** Apartados que el modelo trae, con su nombre legible. Para poder revisarlo. */
export function apartadosDelModelo(texto: string): string[] {
  const titulos = titulosDelModelo(texto).map(normalizarTitulo);
  const vistos: string[] = [];
  for (const a of APARTADOS_MODELO) {
    if (titulos.some((t) => t.startsWith(a.clave)) && !vistos.includes(a.apartado)) {
      vistos.push(a.apartado);
    }
  }
  return vistos;
}

/**
 * Campos que exige el modelo, en orden estable.
 *
 * `disponibles` es el catalogo de la ficha: un campo que el catalogo no tiene no
 * se devuelve, porque no habria donde rellenarlo.
 */
export function camposExigidosDeterministas(
  texto: string,
  disponibles: ReadonlySet<string>,
): string[] {
  const titulos = titulosDelModelo(texto).map(normalizarTitulo);
  const apis = new Set<string>();
  for (const a of APARTADOS_MODELO) {
    if (!titulos.some((t) => t.startsWith(a.clave))) continue;
    for (const api of a.apis) if (disponibles.has(api)) apis.add(api);
  }
  return [...apis].sort();
}
