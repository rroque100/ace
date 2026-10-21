// Verificación de calidad antes de dar un paso por HECHO.
//
// Por qué existe: en un expediente real llegaron a la base un objetivo que decía
// "NOLOSE", tres sustentos de factores que decían "1", "1" y "11", y una fila de
// cronograma con la fecha en blanco — todo con el paso marcado como "hecho". Eso
// se firma y se publica.
//
// Dos límites deliberados:
//
//   1. NO bloquea escribir ni guardar. Un borrador a medias es trabajo legítimo:
//      quien redacta necesita poder salir y volver. Lo que se bloquea es
//      DECLARAR que el paso está hecho, que es una afirmación.
//   2. NO juzga el contenido, solo detecta el relleno. "Es un mal sustento" es
//      una opinión y no la tiene un programa; "esto tiene dos caracteres y son
//      dígitos" es un hecho. Ante la duda, callar: un aviso que salta sin motivo
//      se ignora a las dos semanas y entonces ya no sirve para nada.

import {
  cronogramaCoincideConProcedimiento,
  leerFilas,
  procedimientoGenerico,
  type ActividadCronograma,
  type FactorEvaluacion,
  type PuntoNoNegociable,
} from "./estrategia-formato";
import { validarCronograma } from "./cronograma-fechas";
import { problemasComposicionPanel, todosLosIntegrantes } from "./designacion-evaluadores";
import { cuantiaDeA5, FUENTES_ANEXO1, HERRAMIENTAS_ANEXO1, leerProveedores } from "./anexo1-interaccion";
import { facultativosExcluidos, requisitosDeProcedimiento } from "./requisitos-por-procedimiento";
import { evaluadoresAdmisibles, OBJETOS_POR_PROCEDIMIENTO, tienePrecalificacion, type TipoEvaluador } from "./procesos-seleccion";
import { labelTipoArt72, parseRequisitos, repartirRequisitos, TIPOS_REQUISITO_ART72 } from "./requisitos-calificacion";

/** Longitud mínima de un texto que pretende sustentar algo. */
const MIN_SUSTENTO = 15;

/**
 * ¿Este texto es relleno? Solo se afirma en lo evidente: vacío, puros dígitos o
 * signos, o demasiado corto para sustentar nada. "11" y "NOLOSE" caen aquí; una
 * frase corta pero real, no.
 */
export function esRelleno(texto: unknown): boolean {
  const t = typeof texto === "string" ? texto.trim() : "";
  if (!t) return true;
  if (!/[a-záéíóúüñ]/i.test(t)) return true; // "11", "-", "..."
  return t.length < MIN_SUSTENTO;
}

export type ProblemaCalidad = { campo: string; mensaje: string };

/**
 * Lo que impide dar un paso por hecho. Lista vacía = nada que objetar.
 *
 * Se comprueba sobre los datos del BORRADOR, que es lo que se va a guardar.
 *
 * `contexto` trae datos de OTROS pasos para las comprobaciones que cruzan hitos
 * (p. ej. la causal del Art. 55 de A1 frente a la variable b) de A4). Si no se
 * pasa, esas comprobaciones se callan: sin el dato del otro paso no se puede
 * juzgar la coherencia, y un aviso sin fundamento se ignora.
 */
export function problemasDelPaso(
  code: string,
  data: Record<string, unknown>,
  contexto?: {
    a1?: Record<string, unknown> | null;
    a3?: Record<string, unknown> | null;
    a4?: Record<string, unknown> | null;
    // Para el gate del cronograma (Arts. 64.1/66.1/68.1): los feriados hacen que el
    // conteo de días hábiles del gate coincida con el del editor. Sin ellos, el gate
    // cuenta los feriados como hábiles y podría NO bloquear un plazo que el editor sí
    // marca (queda del lado seguro, nunca al revés).
    feriados?: ReadonlySet<string>;
    // Objeto de la contratación (de A3), para la coherencia procedimiento ↔ objeto.
    // Vocabulario singular del formulario: "bien" | "servicio" | "obra" | "consultoria_obra".
    objeto?: string;
  },
): ProblemaCalidad[] {
  const problemas: ProblemaCalidad[] = [];
  const push = (campo: string, mensaje: string) => problemas.push({ campo, mensaje });

  if (code === "A1") {
    // El CMN es la Programación MULTIANUAL de Bienes, Servicios y Obras: su
    // horizonte debe cubrir al menos 3 años fiscales. `periodo_programacion` es
    // un rango ("2026-2028"); se extraen los años y se mide el tramo (máx − mín
    // + 1, porque son ejercicios consecutivos). Solo se avisa cuando hay años
    // parseables: ante un texto que no se entiende, se calla (no bloquea guardar).
    const periodo = String(data.periodo_programacion ?? "").trim();
    const años = (periodo.match(/\b20\d{2}\b/g) ?? []).map(Number);
    if (años.length > 0) {
      const tramo = Math.max(...años) - Math.min(...años) + 1;
      if (tramo < 3) {
        push(
          "periodo_programacion",
          `El horizonte del CMN ("${periodo}") cubre ${tramo} año(s); la programación multianual (PMBSO) debe abarcar al menos 3 años fiscales.`,
        );
      }
    }

    // Si se declara una causal de procedimiento NO competitivo (Art. 55), el
    // documento del área usuaria que la sustenta es lo que la DEC analiza en la
    // variable b) de la estrategia (Art. 46.1.b): sin él, el no competitivo llega
    // a A4 sin respaldo.
    if (String(data.causal_art_55 ?? "").trim() && !String(data.documento_causal_art_55 ?? "").trim()) {
      push(
        "documento_causal_art_55",
        "Elegiste una causal de procedimiento no competitivo (Art. 55) pero falta el documento del área usuaria que la sustenta (lo analiza la DEC en la variable b) de la estrategia, Art. 46.1.b).",
      );
    }
  }

  if (code === "A2") {
    // Una fila del cronograma sin fecha no es un cronograma: es una fila.
    const items = leerFilas<{ area?: string; fecha?: string }>(data.cronogramaItems);
    const sinFecha = items.filter((i) => (i.area ?? "").trim() && !(i.fecha ?? "").trim());
    for (const i of sinFecha) {
      push(
        "cronogramaItems",
        `El cronograma no tiene fecha para "${i.area}": es la fecha que el área usuaria debe cumplir.`,
      );
    }
  }

  if (code === "A4") {
    // El sustento del evaluador: se eligió el tipo y la celda del formato se
    // queda en blanco. Hay un botón que lo redacta de un clic.
    if (String(data.var_e_tipo_evaluador ?? "").trim() && esRelleno(data.var_e_perfil_evaluador)) {
      push("var_e_perfil_evaluador", "Elegiste el tipo de evaluador pero su sustento está vacío o incompleto.");
    }
    // Cuadro N° 7 de la Guía (Arts. 93/94/95): el tipo de evaluador de e) debe ser
    // uno de los ADMISIBLES para el proceso de a). Si se eligió uno que el proceso no
    // admite, hay que alinear el evaluador (e) o el proceso (a).
    const tipoEval = String(data.var_e_tipo_evaluador ?? "").trim();
    const procesoA = String(data.var_a_proceso ?? "").trim();
    const admisibles = evaluadoresAdmisibles(procesoA);
    if (tipoEval && admisibles.length > 0 && !admisibles.includes(tipoEval as TipoEvaluador)) {
      const et = (v: string) =>
        ({ oficial_compra: "oficial de compra", comite: "comité", jurado: "jurado" })[v] ?? v;
      push(
        "var_e_tipo_evaluador",
        `El proceso «${procesoA}» solo admite ${admisibles.map(et).join(" o ")} como evaluador (Cuadro N° 7 de la Guía, Arts. 93/94/95). Elegiste ${et(tipoEval)}: alinéalo cambiando el tipo de evaluador (e) o el proceso (a).`,
      );
    }
    // s) admite "NO CORRESPONDE" como respuesta final (no toda contratación tiene
    // factores externos o riesgos que declarar, Art. 46.1.s): es el valor por defecto
    // del campo y el botón de la matriz de riesgos es la alternativa. Sin esta
    // excepción, ese default (14 caracteres) caía por debajo del mínimo de `esRelleno`
    // y saltaba un aviso falso. Mismo trato que los puntos no negociables.
    const sObjetivo = String(data.var_s_objetivo ?? "").trim();
    if (sObjetivo && !/^no corresponde/i.test(sObjetivo) && esRelleno(data.var_s_objetivo)) {
      push("var_s_objetivo", "El análisis de s) no dice nada que se pueda sustentar.");
    }
    for (const [i, f] of leerFilas<FactorEvaluacion>(data.factores_items).entries()) {
      if ((f.nombre ?? "").trim() && esRelleno(f.sustento)) {
        push("factores_items", `El factor "${f.nombre}" (fila ${i + 1}) no tiene un sustento real.`);
      }
    }
    for (const [i, p] of leerFilas<PuntoNoNegociable>(data.var_j_puntos_no_negociables).entries()) {
      if ((p.punto ?? "").trim() && !/^no corresponde/i.test((p.punto ?? "").trim()) && esRelleno(p.sustento)) {
        push("var_j_puntos_no_negociables", `El punto no negociable ${i + 1} no tiene un sustento real.`);
      }
    }
    // Una actividad con fin anterior al inicio es imposible, y en el cronograma
    // que se publica la ve todo el mundo. Las fechas pueden traer hora
    // ("YYYY-MM-DDTHH:mm"): el regex acepta la hora opcional y la comparación
    // léxica sigue siendo correcta con el mismo formato.
    const fechaHora = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
    const cronoFilas = leerFilas<ActividadCronograma>(data.cronograma_items);
    for (const f of cronoFilas) {
      const inicio = f.inicio ?? "";
      const fin = f.fin ?? "";
      if (fechaHora.test(inicio) && fechaHora.test(fin) && fin < inicio) {
        push("cronograma_items", `"${f.actividad}" termina (${fin}) antes de empezar (${inicio}).`);
      }
    }

    // o) Cronograma ↔ procedimiento (Arts. 64.1/66.1/68.1). `validarCronograma` y
    // `cronogramaCoincideConProcedimiento` YA se muestran como aviso en el editor,
    // pero no impedían dar el paso por hecho: un cronograma que incumple el mínimo de
    // días entre convocatoria/integración y ofertas, o que se quedó con las
    // actividades de OTRO procedimiento, se firmaba igual. El procedimiento operativo
    // es el genérico del Art. 54 (var_a_procedimiento ya lo guarda; si falta, se deriva
    // del proceso específico de a) con `procedimientoGenerico`).
    const procGenerico =
      String(data.var_a_procedimiento ?? "").trim() || procedimientoGenerico(String(data.var_a_proceso ?? "")) || "";
    if (procGenerico) {
      for (const aviso of validarCronograma(cronoFilas, contexto?.feriados ?? new Set(), procGenerico)) {
        push("cronograma_items", aviso);
      }
      if (cronogramaCoincideConProcedimiento(cronoFilas, procGenerico) === false) {
        push(
          "cronograma_items",
          "El cronograma tiene las actividades de OTRO procedimiento de selección, no las de a). Usa «Rehacer la fase de selección» en el editor para que coincida con el procedimiento elegido.",
        );
      }
    }

    // a) Procedimiento ↔ objeto (Arts. 93/94/95): cada procedimiento acota los objetos
    // aplicables (`OBJETOS_POR_PROCEDIMIENTO`, del catálogo). Un concurso público con
    // objeto "obras", o una licitación de obras sobre un bien, es una incoherencia que
    // hay que resolver en a) o en el objeto del requerimiento (A3). El objeto de A3 es
    // singular ("obra"); el catálogo, plural ("obras"): se normaliza. Si el proceso no
    // está en el catálogo (genérico, no competitivo, texto libre), no se juzga.
    const objetoNorm =
      ({ bien: "bienes", servicio: "servicios", obra: "obras" })[String(contexto?.objeto ?? "").trim()] ??
      String(contexto?.objeto ?? "").trim();
    const objetosDelProceso = OBJETOS_POR_PROCEDIMIENTO[String(data.var_a_proceso ?? "").trim()];
    if (objetosDelProceso && objetoNorm && !objetosDelProceso.includes(objetoNorm as (typeof objetosDelProceso)[number])) {
      push(
        "var_a_proceso",
        `El procedimiento «${String(data.var_a_proceso)}» no aplica al objeto de esta contratación (${objetoNorm}). Alinéalo cambiando el procedimiento en a) o el objeto del requerimiento (A3).`,
      );
    }

    // f) Requisitos de calificación. La obligatoriedad la fija el procedimiento
    // (matriz de bases estándar, Art. 72.4), no el marcado manual. Se avisa solo
    // de lo FIABLE: un facultativo activo sin sustento real (la DEC puede
    // excluirlo, Art. 44.8/72.4) y la capacidad económica marcada donde no cabe
    // (solo con precalificación, Art. 72.3.e). NO se juzga el "detalle": la
    // capacidad legal es condicional ("si la normativa exige habilitación; si no,
    // se omite") y la técnica vive en columnas aparte — un vacío ahí no es fallo.
    const procReq = String(data.var_a_proceso ?? data.var_a_procedimiento ?? "");
    const precalifReq = tienePrecalificacion(procReq);
    const matrizReq = requisitosDeProcedimiento(procReq, String(contexto?.a1?.causal_art_55 ?? ""), precalifReq);
    const repartoReq = repartirRequisitos(parseRequisitos(String(data.var_f_requisitos_calificacion ?? "")));
    for (const tipo of TIPOS_REQUISITO_ART72) {
      const e = repartoReq.porTipo.get(tipo.key);
      const estado = matrizReq[tipo.key] === "obligatorio" ? "obligatorio" : (e?.estado ?? "no");
      if (estado === "facultativo" && esRelleno(e?.sustento)) {
        push(
          "var_f_requisitos_calificacion",
          `El requisito facultativo "${labelTipoArt72(tipo.key)}" no tiene un sustento real; sin él la DEC puede excluirlo (Art. 44.8).`,
        );
      }
      if (tipo.key === "capacidad_economica" && estado !== "no" && !precalifReq) {
        push(
          "var_f_requisitos_calificacion",
          "La capacidad económica solo aplica en procedimientos con precalificación (Art. 72.3.e); este no la tiene.",
        );
      }
    }

    // No objeción por EXCLUSIÓN de un facultativo (Art. 44.8): si la DEC excluye en
    // A4 un facultativo que el área usuaria propuso en el requerimiento (A3), esa
    // decisión final está sujeta a la no objeción del área usuaria (Guía Cap. III,
    // f)), que se registra en A3 (campo `no_objecion`). Solo se comprueba si
    // tenemos A3; fijar obligatorios o perfeccionar el detalle NO la exige (Art.
    // 72.1), por eso solo mira las EXCLUSIONES.
    if (contexto?.a3) {
      const propuestaPorTipo = repartirRequisitos(
        parseRequisitos(String(contexto.a3.propuesta_requisitos_calificacion ?? "")),
      ).porTipo;
      const excluidos = facultativosExcluidos(propuestaPorTipo, repartoReq.porTipo, matrizReq);
      if (excluidos.length > 0 && String(contexto.a3.no_objecion ?? "") !== "otorgada") {
        const nombres = excluidos.map((k) => `"${labelTipoArt72(k)}"`).join(", ");
        push(
          "var_f_requisitos_calificacion",
          `Excluiste ${excluidos.length === 1 ? "un requisito facultativo que" : `${excluidos.length} requisitos facultativos que`} el área usuaria propuso (${nombres}). El Art. 44.8 exige su no objeción: regístrala en el requerimiento (A3) antes de dar la estrategia por hecha.`,
        );
      }
    }

    // Coherencia A1 ↔ b): la causal del Art. 55 declarada en A1 y el sustento del
    // no competitivo de b) tienen que ir juntos. Lo competitivo es la regla (Art.
    // 54.3); el no competitivo es la excepción del Art. 55 que la DEC valida en b)
    // (Art. 46.1.b). Solo se comprueba si tenemos los datos de A1 (si no, se calla).
    if (contexto?.a1) {
      const hayCausal = String(contexto.a1.causal_art_55 ?? "").trim() !== "";
      const bAfirma = String(data.si_sustenta_no_competitivo ?? "") === "si";
      if (hayCausal && !bAfirma) {
        push(
          "si_sustenta_no_competitivo",
          "En A1 se declaró una causal de procedimiento NO competitivo (Art. 55), pero b) no confirma que su uso esté sustentado. La DEC valida el no competitivo en la variable b) (Art. 46.1.b).",
        );
      }
      if (!hayCausal && bAfirma) {
        push(
          "si_sustenta_no_competitivo",
          "b) sustenta un procedimiento NO competitivo, pero en A1 no consta ninguna causal del Art. 55. Registra la causal en A1, o corrige b): lo competitivo es la regla (Art. 54.3).",
        );
      }
    }
  }

  if (code === "A5") {
    const nivel = String(data.nivel ?? "");
    const esConsulta = nivel === "consulta_mercado_basica" || nivel === "consulta_mercado_avanzada";
    const esIndagacion = nivel === "indagacion_basica" || nivel === "indagacion_avanzada";
    const proveedores = leerProveedores(data.proveedores);

    // Una fila a medias no sustenta nada: en el Anexo sale un "Proveedor
    // consultado" anónimo o una propuesta sin dueño. El RUC, si está, es un dato
    // duro: 11 dígitos (eso es un hecho, no una opinión) y no repetido —
    // consultar dos veces al mismo proveedor no son dos fuentes.
    const rucVistos = new Map<string, number>();
    for (const [i, p] of proveedores.entries()) {
      const tieneMonto = Number(p.monto) > 0;
      const tieneNombre = (p.razonSocial ?? "").trim().length > 0;
      if (tieneMonto !== tieneNombre) {
        push(
          "proveedores",
          `El proveedor ${i + 1} está incompleto: ${tieneMonto ? "tiene monto pero le falta la razón social" : "tiene razón social pero le falta el monto"}.`,
        );
      }
      const ruc = String(p.ruc ?? "").replace(/\s/g, "");
      if (ruc) {
        if (!/^\d{11}$/.test(ruc)) {
          push("proveedores", `El RUC del proveedor ${i + 1} ("${ruc}") no tiene 11 dígitos.`);
        } else if (rucVistos.has(ruc)) {
          push("proveedores", `El RUC ${ruc} se repite (proveedores ${rucVistos.get(ruc)} y ${i + 1}).`);
        } else {
          rucVistos.set(ruc, i + 1);
        }
      }
    }

    // El nivel declarado exige un mínimo de fuentes/herramientas marcadas: una
    // indagación avanzada con una sola fuente, o una consulta avanzada con una
    // sola herramienta, es exactamente el nivel de abajo con otra etiqueta. Se
    // cuenta lo MARCADO (String(v)==="true", igual que el resto del panel).
    const marcada = (k: string) => String(data[k] ?? "") === "true";
    if (esIndagacion) {
      const n = FUENTES_ANEXO1.filter((f) => marcada(f.key)).length;
      const min = nivel === "indagacion_avanzada" ? 2 : 1;
      if (n < min) {
        push(
          "nivel",
          nivel === "indagacion_avanzada"
            ? `La indagación avanzada exige dos o más fuentes de información (Art. 48.3); has marcado ${n}.`
            : `La indagación básica exige al menos una fuente de información (Art. 48.3); no has marcado ninguna.`,
        );
      }
    }
    if (esConsulta) {
      const n = HERRAMIENTAS_ANEXO1.filter((h) => marcada(h.key)).length;
      const min = nivel === "consulta_mercado_avanzada" ? 2 : 1;
      if (n < min) {
        push(
          "nivel",
          nivel === "consulta_mercado_avanzada"
            ? `La consulta al mercado avanzada exige dos o más herramientas (Art. 49.2); has marcado ${n}.`
            : `La consulta al mercado básica exige al menos una herramienta (Art. 49.2); no has marcado ninguna.`,
        );
      }
      // Si se usó la difusión del requerimiento, su acta de absolución es
      // OBLIGATORIA (Art. 51.3): sin el N° del acta, el Anexo no puede acreditar
      // que las consultas técnicas se absolvieron y se publicaron en la Pladicop.
      if (marcada("herr_difusion") && !String(data.difusion_acta_numero ?? "").trim()) {
        push(
          "difusion_acta_numero",
          "Usaste la difusión del requerimiento: el Art. 51.3 obliga a publicar en la Pladicop un acta con el resultado de la absolución. Registra su número.",
        );
      }
    }

    // La cuantía debe quedar determinada (Art. 47.1): la sustentan las propuestas
    // de la consulta o se registra a mano en la indagación. Sin ella, A7 (CCP) y
    // A8 (aprobación) se quedan sin cifra contra la que comparar.
    if (esConsulta && cuantiaDeA5(data) == null) {
      push(
        "proveedores",
        "La consulta al mercado sustenta la cuantía en las propuestas recibidas (Art. 47.1/49): añade al menos un proveedor con su monto, o registra la cuantía actualizada.",
      );
    }
    if (esIndagacion && cuantiaDeA5(data) == null) {
      push(
        "cuantia_actualizada",
        "En una indagación no hay tabla de propuestas: registra la cuantía actualizada (Art. 47.1) para que A7 y A8 tengan cifra.",
      );
    }
  }

  if (code === "A6") {
    // Composición del panel evaluador (Art. 56.1, 58.1, 59.1, 60.1): que no se
    // designe un comité sin comprador público de la DEC o sin experto, con un
    // número de titulares incorrecto, o sin suplentes. Solo se comprueba si ya
    // hay integrantes: cuando está vacío, lo atrapa el campo obligatorio.
    const integrantes = todosLosIntegrantes(data);
    if (integrantes.length > 0) {
      for (const msg of problemasComposicionPanel(String(data.tipo_evaluador ?? ""), integrantes)) {
        push("integrantes", msg);
      }
    }

    // Blindaje A4↔A6: el tipo de evaluador se decide en la Estrategia (A4,
    // Art. 46.1.e) y A6 solo lo confirma (Art. 54.2.e). Si divergen, el
    // expediente se contradice —la designación diría "comité" y la estrategia
    // "oficial de compra"—, así que se bloquea hasta alinearlos.
    const tipoA6 = String(data.tipo_evaluador ?? "").trim();
    const tipoA4 = String(contexto?.a4?.var_e_tipo_evaluador ?? "").trim();
    if (tipoA6 && tipoA4 && tipoA6 !== tipoA4) {
      const etiqueta = (v: string) =>
        ({ oficial_compra: "oficial de compra", comite: "comité", jurado: "jurado" })[v] ?? v;
      push(
        "tipo_evaluador",
        `El tipo de evaluador (${etiqueta(tipoA6)}) no coincide con el de la Estrategia A4 (${etiqueta(tipoA4)}). Alinéalos —cámbialo aquí o en A4— para que el expediente no se contradiga.`,
      );
    }
  }

  return problemas;
}
