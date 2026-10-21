// Motor de instruccion del expediente de contratacion.
//
// Tras la unificacion de motores, hay UNA sola lista de fases: el ciclo de vida
// canonico de 11 etapas (Necesidad -> Archivo) definido en
// lib/contratacion-modulos.ts y alineado con procurement_processes.status. Este
// modulo evalua, de forma deterministica y sin IA, sobre ESE ciclo:
//  - la etapa oficial del expediente (segun su `status`),
//  - que documentos faltan en cada etapa (completitud y foliacion),
//  - y las rupturas de secuencia (actuaciones cargadas fuera de orden).
//
// Es codigo puro (solo depende de tipos y de la taxonomia), por lo que puede
// usarse tanto en el cliente como en el servidor y es facil de testear.

import {
  CICLO_CONTRATACION,
  type DocumentoRequerido,
  type EtapaCiclo,
  etapaActualDelProceso,
} from "./contratacion-modulos";
import type { ActorId, MacroFase } from "./actores-contratacion";

export type { DocumentoRequerido };

export type EstadoFase = "completa" | "en_curso" | "pendiente" | "atencion" | "no_aplica";

export type RequisitoEvaluado = {
  kind: string;
  label: string;
  obligatorio: boolean;
  cumplido: boolean;
  documentoTitulo?: string;
};

// Una etapa del ciclo, ya evaluada contra los documentos del expediente. Lleva
// los metadatos del ciclo de vida (modulo, actores, artefactos) + el resultado
// de la instruccion, para que tanto el mapa de ciclo como el tracker de fases
// rendericen la MISMA fase.
export type FaseEvaluada = {
  id: string;
  numero: number;
  label: string;
  descripcion: string;
  modulo: number;
  macroFase: MacroFase;
  responsable: ActorId;
  participantes: ActorId[];
  estado: EstadoFase;
  esActual: boolean;
  completa: boolean;
  /** Insumos que la etapa necesita y artefactos que produce, del catálogo del
   *  ciclo. Antes solo los enseñaba el mapa del ciclo, que era un segundo riel
   *  de las mismas once etapas; al fusionarlos vienen aquí. */
  entradas: string[];
  salidas: string[];
  requisitos: RequisitoEvaluado[];
  documentosFaltantes: DocumentoRequerido[];
  alertas: string[];
};

export type InstruccionExpediente = {
  fases: FaseEvaluada[];
  faseActualId: string | null;
  totalFases: number;
  fasesCompletas: number;
  progreso: number; // 0..1
  alertasSecuencia: string[];
  // El procedimiento se declaró desierto (salida terminal de la selección): las
  // etapas posteriores a Buena pro no aplican y no hay "siguiente actuación".
  desierto: boolean;
  // El expediente se cerró y archivó (salida terminal del flujo normal).
  archivado: boolean;
};

export type DocumentoExpediente = {
  kind: string;
  title: string;
  status: string;
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function documentoPresente(documents: DocumentoExpediente[], req: DocumentoRequerido) {
  return documents.find((doc) => {
    if (doc.kind !== req.kind || doc.status === "error") {
      return false;
    }
    if (!req.tituloIncluye || req.tituloIncluye.length === 0) {
      return true;
    }
    const title = normalize(doc.title);
    return req.tituloIncluye.some((keyword) => title.includes(normalize(keyword)));
  });
}

function tieneKind(documents: DocumentoExpediente[], kind: string) {
  return documents.some((doc) => doc.kind === kind && doc.status !== "error");
}

function tieneActaConTitulo(documents: DocumentoExpediente[], keywords: string[]) {
  return documents.some(
    (doc) =>
      doc.kind === "acta" &&
      doc.status !== "error" &&
      keywords.some((keyword) => normalize(doc.title).includes(normalize(keyword))),
  );
}

// Cualquier documento (no en error) cuyo titulo contenga alguna palabra clave.
// Los artefactos de ejecucion (orden de inicio, conformidad, liquidacion) se
// cargan como acta o informe, asi que no se filtra por kind.
function tieneTitulo(documents: DocumentoExpediente[], keywords: string[]) {
  return documents.some(
    (doc) =>
      doc.status !== "error" &&
      keywords.some((keyword) => normalize(doc.title).includes(normalize(keyword))),
  );
}

function detectarAlertasSecuencia(
  documents: DocumentoExpediente[],
  evaluacionesCount: number,
): string[] {
  const alertas: string[] = [];

  if (tieneKind(documents, "bases_integradas") && !tieneKind(documents, "bases")) {
    alertas.push("Hay bases integradas pero no se cargaron las bases originales: revisa la foliación de la convocatoria.");
  }
  if (tieneKind(documents, "oferta") && !tieneKind(documents, "bases_integradas")) {
    alertas.push("Hay ofertas cargadas pero faltan las bases integradas que fijan las reglas definitivas.");
  }
  if (evaluacionesCount > 0 && !tieneKind(documents, "oferta")) {
    alertas.push("Existe una evaluación registrada pero no hay oferta cargada en el expediente.");
  }
  if (
    tieneKind(documents, "contrato") &&
    !tieneActaConTitulo(documents, ["buena pro", "buenapro", "adjudicacion", "otorgamiento"])
  ) {
    alertas.push("Hay un contrato suscrito sin acta de otorgamiento de la buena pro que lo respalde.");
  }

  return alertas;
}

// ===== Avance automatico del ciclo (status) por evidencia =====

// Etapa lineal mas avanzada que justifican los documentos y evaluaciones del
// expediente. No devuelve 'desierto' (es una salida que decide una persona).
export function inferirEstadoPorEvidencia(input: {
  documents: DocumentoExpediente[];
  evaluacionesCount?: number;
}): string | null {
  const docs = input.documents ?? [];
  const evals = input.evaluacionesCount ?? 0;

  if (tieneTitulo(docs, ["liquidacion"])) {
    return "liquidacion";
  }
  if (tieneTitulo(docs, ["conformidad"])) {
    return "conformidad";
  }
  if (tieneTitulo(docs, ["orden de inicio"])) {
    return "ejecucion";
  }
  if (tieneKind(docs, "contrato")) {
    return "contrato";
  }
  if (tieneActaConTitulo(docs, ["buena pro", "buenapro", "otorgamiento", "adjudicacion"])) {
    return "buena_pro";
  }
  if (
    tieneKind(docs, "oferta") ||
    evals > 0 ||
    tieneActaConTitulo(docs, ["admision", "evaluacion", "calificacion"]) ||
    tieneKind(docs, "bases") ||
    tieneKind(docs, "bases_integradas")
  ) {
    return "seleccion";
  }
  if (tieneActaConTitulo(docs, ["aprobacion", "aprobado", "resolucion"])) {
    return "aprobacion_aga";
  }
  if (
    tieneKind(docs, "requerimiento") ||
    tieneKind(docs, "tdr") ||
    tieneKind(docs, "ee_tt") ||
    docs.some((doc) => doc.kind === "informe" && doc.status !== "error")
  ) {
    return "actuaciones_preparatorias";
  }
  return null;
}

// Estado al que debe avanzar el expediente segun la evidencia, SOLO hacia
// adelante. Devuelve el nuevo status si corresponde avanzar, o null si no hay
// cambio (incluye el caso terminal 'desierto', que no se toca de forma automatica).
export function avanzarEstado(
  currentStatus: string | null | undefined,
  input: { documents: DocumentoExpediente[]; evaluacionesCount?: number },
): string | null {
  if (currentStatus === "desierto") {
    return null;
  }
  const inferido = inferirEstadoPorEvidencia(input);
  if (!inferido) {
    return null;
  }
  const ordenActual = etapaActualDelProceso(currentStatus).orden;
  const ordenInferido = etapaActualDelProceso(inferido).orden;
  return ordenInferido > ordenActual ? inferido : null;
}

// Responsable principal + actores de apoyo (sin duplicar al responsable).
function responsableYParticipantes(etapa: EtapaCiclo): {
  responsable: ActorId;
  participantes: ActorId[];
} {
  const [responsable, ...resto] = etapa.responsables;
  const participantes = Array.from(new Set([...resto, ...etapa.participantes])).filter(
    (id) => id !== responsable,
  );
  return { responsable, participantes };
}

export function instruirExpediente(input: {
  // procurement_processes.status (id de etapa del ciclo). Define la etapa oficial.
  status?: string | null;
  documents: DocumentoExpediente[];
  evaluacionesCount?: number;
}): InstruccionExpediente {
  const documents = input.documents ?? [];
  const evaluacionesCount = input.evaluacionesCount ?? 0;

  // Ciclo ordenado y etapa oficial actual (segun el status del expediente).
  const etapas = [...CICLO_CONTRATACION].sort((a, b) => a.orden - b.orden);
  const etapaActual = etapaActualDelProceso(input.status);
  const indiceActual = etapas.findIndex((etapa) => etapa.id === etapaActual.id);
  // 'desierto' es una salida terminal de la etapa Buena pro: la selección
  // concluyó sin adjudicación y las etapas posteriores no aplican.
  const esDesierto = input.status === "desierto";

  // 1) Evalua requisitos y completitud de cada etapa (independiente del status).
  const base = etapas.map((etapa) => {
    const requisitos: RequisitoEvaluado[] = etapa.documentos.map((req) => {
      const match = documentoPresente(documents, req);
      const cumplidoPorEval = Boolean(req.satisfechoPorEvaluacion) && evaluacionesCount > 0;
      const cumplido = Boolean(match) || cumplidoPorEval;
      return {
        kind: req.kind,
        label: req.label,
        obligatorio: req.obligatorio,
        cumplido,
        documentoTitulo: match?.title,
      };
    });

    const documentosFaltantes = etapa.documentos.filter(
      (req, index) => req.obligatorio && !requisitos[index].cumplido,
    );
    const tieneAlgo = requisitos.some((req) => req.cumplido);
    const completa = documentosFaltantes.length === 0;

    return { etapa, requisitos, documentosFaltantes, tieneAlgo, completa };
  });

  // 2) El estado es posicional respecto de la etapa OFICIAL (status):
  //    - etapas anteriores: completas, salvo que falten obligatorios -> "atención"
  //      (pasaron oficialmente pero el expediente quedó sin foliar);
  //    - etapa actual: en curso;
  //    - etapas posteriores: pendientes, salvo que ya tengan todo cargado.
  const fases: FaseEvaluada[] = base.map((item, index) => {
    let estado: EstadoFase;
    if (esDesierto) {
      // Hasta Buena pro se evalúa normal; esa etapa se da por concluida (sin
      // adjudicación) y todo lo posterior no aplica.
      if (index < indiceActual) {
        estado = item.completa ? "completa" : "atencion";
      } else if (index === indiceActual) {
        estado = "completa";
      } else {
        estado = "no_aplica";
      }
    } else if (index < indiceActual) {
      estado = item.completa ? "completa" : "atencion";
    } else if (index === indiceActual) {
      estado = "en_curso";
    } else if (item.completa && item.tieneAlgo) {
      estado = "completa";
    } else {
      estado = "pendiente";
    }

    const alertas: string[] = [];
    if (estado === "atencion") {
      alertas.push("Esta fase quedó marcada como pasada pero faltan documentos obligatorios.");
    }

    const { responsable, participantes } = responsableYParticipantes(item.etapa);

    return {
      id: item.etapa.id,
      numero: item.etapa.orden,
      label: item.etapa.label,
      descripcion: item.etapa.descripcion,
      modulo: item.etapa.modulo,
      macroFase: item.etapa.macroFase,
      responsable,
      participantes,
      entradas: item.etapa.entradas,
      salidas: item.etapa.salidas.map((s) =>
        s.formato.length > 0 ? `${s.nombre} (${s.formato.join(", ")})` : s.nombre,
      ),
      estado,
      esActual: !esDesierto && index === indiceActual,
      completa: item.completa,
      requisitos: item.requisitos,
      documentosFaltantes: item.documentosFaltantes,
      alertas,
    };
  });

  const fasesCompletas = fases.filter((fase) => fase.estado === "completa").length;
  // Las etapas "no aplica" (posteriores a un desierto) no cuentan para el avance.
  const relevantes = fases.filter((fase) => fase.estado !== "no_aplica").length;

  return {
    fases,
    faseActualId: esDesierto ? null : indiceActual >= 0 ? etapas[indiceActual].id : null,
    totalFases: etapas.length,
    fasesCompletas,
    progreso: relevantes > 0 ? fasesCompletas / relevantes : 0,
    alertasSecuencia: detectarAlertasSecuencia(documents, evaluacionesCount),
    desierto: esDesierto,
    archivado: input.status === "archivo",
  };
}
