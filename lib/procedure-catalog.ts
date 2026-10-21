export type ProcedureCatalogEntry = {
  aliases: string[];
  anchors: string[];
  label: string;
  requiredSources?: ProcedureSourceRequirement[];
  requirementRule?: {
    article?: string;
    documentType: "ley" | "reglamento" | "directiva" | "opinion";
    message: string;
  };
  value: string;
};

export type ProcedureSourceRequirement = {
  article?: string;
  critical?: boolean;
  documentType: "ley" | "reglamento" | "directiva" | "opinion" | "bases_integradas";
  label: string;
  message: string;
  optional?: boolean;
  titleIncludes?: string[];
};

export type ProcedureSourceLike = {
  article?: string | null;
  documentTitle?: string | null;
  documentType: string;
  excerpt?: string | null;
  processType?: string | null;
  status?: string | null;
  vigencia?: string | null;
};

export const normativeDocumentTypes = ["ley", "reglamento", "directiva", "opinion"] as const;
export const operationalDocumentTypes = ["bases_integradas"] as const;

const generalLawRequirement: ProcedureSourceRequirement = {
  documentType: "ley",
  label: "Ley N. 32069",
  message: "Debe existir Ley vigente para ubicar definiciones, principios y remisiones generales.",
};

const generalRegulationRequirement: ProcedureSourceRequirement = {
  critical: true,
  documentType: "reglamento",
  label: "Reglamento vigente",
  message: "Debe recuperarse Reglamento vigente que desarrolle reglas del procedimiento.",
};

const optionalOpinionRequirement: ProcedureSourceRequirement = {
  documentType: "opinion",
  label: "Opiniones OECE aplicables",
  message: "Las opiniones OECE son criterio interpretativo; no son norma obligatoria.",
  optional: true,
};

const optionalBasesRequirement: ProcedureSourceRequirement = {
  documentType: "bases_integradas",
  label: "Bases operativas",
  message: "Las bases sirven como esquema de implementacion, pero no sustituyen fundamento normativo.",
  optional: true,
};

const optionalDirectiveRequirement: ProcedureSourceRequirement = {
  documentType: "directiva",
  label: "Directiva aplicable si corresponde",
  message: "Cuando el procedimiento tenga directiva especifica, debe recuperarse antes de concluir.",
  optional: true,
};

export const procedureCatalog: Record<string, ProcedureCatalogEntry> = {
  licitacion_publica: {
    aliases: ["licitacion publica", "licitacion", "lp"],
    anchors: [
      "licitacion publica procedimiento de seleccion requisitos procedencia reglamento ley",
      "licitacion publica convocatoria admision evaluacion buena pro",
    ],
    label: "Licitacion publica",
    requiredSources: [
      generalLawRequirement,
      generalRegulationRequirement,
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ],
    requirementRule: {
      documentType: "reglamento",
      message: "Para Licitacion publica debe recuperarse normativa vigente del Reglamento que desarrolle el procedimiento.",
    },
    value: "licitacion_publica",
  },
  concurso_publico: {
    aliases: ["concurso publico"],
    anchors: [
      "concurso publico procedimiento de seleccion requisitos procedencia reglamento ley",
      "concurso publico servicios consultoria evaluacion buena pro",
    ],
    label: "Concurso publico",
    requiredSources: [
      generalLawRequirement,
      generalRegulationRequirement,
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ],
    requirementRule: {
      documentType: "reglamento",
      message: "Para Concurso publico debe recuperarse normativa vigente del Reglamento que desarrolle el procedimiento.",
    },
    value: "concurso_publico",
  },
  adjudicacion_simplificada: {
    aliases: ["adjudicacion simplificada", "adjudicacion", "as"],
    anchors: [
      "adjudicacion simplificada procedimiento de seleccion requisitos procedencia reglamento ley",
      "adjudicacion simplificada convocatoria admision evaluacion buena pro",
    ],
    label: "Adjudicacion simplificada",
    requiredSources: [
      generalLawRequirement,
      generalRegulationRequirement,
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ],
    requirementRule: {
      documentType: "reglamento",
      message: "Para Adjudicacion simplificada debe recuperarse normativa vigente del Reglamento que desarrolle el procedimiento.",
    },
    value: "adjudicacion_simplificada",
  },
  subasta_inversa_electronica: {
    aliases: ["subasta inversa electronica", "subasta inversa", "sie"],
    anchors: [
      "subasta inversa electronica ficha tecnica bienes comunes requisitos procedimiento",
      "subasta inversa electronica directiva condiciones entrega ficha tecnica",
    ],
    label: "Subasta inversa electronica",
    requiredSources: [
      generalLawRequirement,
      generalRegulationRequirement,
      {
        critical: true,
        documentType: "directiva",
        label: "Directiva SIE aplicable",
        message: "Para SIE debe recuperarse la Directiva aplicable; ficha tecnica y bases no sustituyen esta fuente.",
        titleIncludes: ["subasta inversa", "sie"],
      },
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ],
    requirementRule: {
      documentType: "directiva",
      message: "Para SIE debe recuperarse la Directiva aplicable y Reglamento; la ficha tecnica/bases no sustituyen el fundamento normativo.",
    },
    value: "subasta_inversa_electronica",
  },
  comparacion_precios: {
    aliases: ["comparacion de precios", "comparacion precios", "comparar precios"],
    anchors: [
      "Ley 32069 articulo 4 comparacion de precios procedimiento de seleccion competitivo unico factor de evaluacion precio bienes y servicios",
      "Reglamento Decreto Supremo 009-2025-EF comparacion de precios condiciones de utilizacion requisitos de procedencia",
      "comparacion de precios modificatoria vigente del reglamento condiciones",
      "bases estandar comparacion de precios admision calificacion evaluacion otorgamiento buena pro",
    ],
    label: "Comparacion de precios",
    requiredSources: [
      {
        documentType: "ley",
        label: "Ley 32069 (definicion/remision, art. 4)",
        message:
          "La Ley (art. 4) define Comparacion de Precios como procedimiento competitivo y remite sus condiciones al Reglamento.",
      },
      {
        critical: true,
        documentType: "reglamento",
        label: "Reglamento (condiciones de Comparacion de Precios)",
        message:
          "Para requisitos de Comparacion de Precios debe recuperarse el Reglamento vigente que desarrolle sus condiciones; la Ley sola remite al Reglamento.",
      },
      {
        documentType: "reglamento",
        label: "Modificatoria vigente del Reglamento",
        message: "Si existe D.S. modificatorio, debe advertirse la version vigente de las condiciones.",
        optional: true,
        titleIncludes: ["001-2026", "modifica", "modificatoria"],
      },
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ],
    requirementRule: {
      documentType: "reglamento",
      message:
        "Para requisitos de Comparacion de precios debe recuperarse el Reglamento que desarrolle sus condiciones; la Ley (art. 4) solo remite al Reglamento.",
    },
    value: "comparacion_precios",
  },
  contratacion_directa: {
    aliases: ["contratacion directa", "contrataciones directas", "cd"],
    anchors: [
      "contratacion directa causales requisitos procedencia reglamento ley",
      "contratacion directa sustento causal aprobacion actuaciones preparatorias",
    ],
    label: "Contratacion directa",
    requiredSources: [
      {
        critical: true,
        documentType: "ley",
        label: "Causal en Ley",
        message: "Debe identificarse la causal normativa de contratacion directa en Ley o Reglamento.",
      },
      {
        critical: true,
        documentType: "reglamento",
        label: "Desarrollo reglamentario de la causal",
        message: "Debe recuperarse Reglamento aplicable a la causal invocada cuando corresponda.",
        optional: true,
      },
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ],
    requirementRule: {
      documentType: "reglamento",
      message: "Para Contratacion directa debe recuperarse Ley o Reglamento que sustente la causal invocada.",
    },
    value: "contratacion_directa",
  },
  acuerdo_marco: {
    aliases: ["acuerdo marco", "catalogo electronico", "catalogos electronicos", "catalogo electronico de acuerdo marco"],
    anchors: [
      "acuerdo marco catalogos electronicos procedimiento requisitos reglas aplicables",
      "catalogo electronico acuerdo marco contratacion publica",
    ],
    label: "Acuerdo marco",
    requiredSources: [
      generalLawRequirement,
      generalRegulationRequirement,
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ],
    requirementRule: {
      documentType: "reglamento",
      message: "Para Acuerdo marco debe recuperarse normativa vigente del Reglamento y reglas aplicables del catalogo.",
    },
    value: "acuerdo_marco",
  },
  seleccion_consultores_individuales: {
    aliases: ["seleccion de consultores individuales", "seleccion consultores individuales", "consultores individuales"],
    anchors: [
      "seleccion de consultores individuales procedimiento requisitos calificacion experiencia",
      "consultores individuales contratacion publica procedimiento seleccion",
    ],
    label: "Seleccion de consultores individuales",
    requiredSources: [
      generalLawRequirement,
      generalRegulationRequirement,
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ],
    requirementRule: {
      documentType: "reglamento",
      message: "Para Seleccion de consultores individuales debe recuperarse normativa vigente del Reglamento que establezca reglas y requisitos.",
    },
    value: "seleccion_consultores_individuales",
  },
  procedimiento_especial: {
    aliases: ["procedimiento especial", "procedimientos especiales"],
    anchors: [
      "procedimiento especial contratacion publica requisitos reglas aplicables",
      "procedimientos especiales normativa contrataciones publicas",
    ],
    label: "Procedimiento especial",
    requiredSources: [
      {
        // En procedimientos especiales el regimen lo fija una norma especial o
        // habilitante (no siempre la Ley general y puede no estar en el corpus);
        // la fuente obligatoria es el reglamento. Por eso la norma habilitante es
        // opcional: no debe penalizarse como critica si no consta indexada.
        documentType: "ley",
        label: "Norma habilitante o especial",
        message: "Si aplica, recuperar la norma especial o habilitante.",
        optional: true,
      },
      generalRegulationRequirement,
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ],
    requirementRule: {
      documentType: "reglamento",
      message: "Para Procedimiento especial debe recuperarse la norma especial o reglamentaria vigente aplicable.",
    },
    value: "procedimiento_especial",
  },
  otros: {
    aliases: ["otro procedimiento", "otros procedimientos"],
    anchors: ["otros procedimientos de seleccion contratacion publica requisitos normativa aplicable"],
    label: "Otros",
    value: "otros",
  },
};

export const procedureEntries = Object.values(procedureCatalog);

export function normalizeProcedureText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function procedureTextIncludes(source: string, target: string) {
  const normalizedSource = normalizeProcedureText(source);
  const normalizedTarget = normalizeProcedureText(target);

  if (!normalizedTarget) {
    return false;
  }

  return new RegExp(`(^|\\s)${escapeRegExp(normalizedTarget)}($|\\s)`).test(normalizedSource);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inferProcedureType(text: string) {
  for (const entry of procedureEntries) {
    if (entry.aliases.some((alias) => procedureTextIncludes(text, alias))) {
      return entry.value;
    }
  }

  return null;
}

export function procedureLabel(processType?: string | null) {
  if (processType === "todos") {
    return "Todos los procesos";
  }

  return processType ? procedureCatalog[processType]?.label ?? processType.replaceAll("_", " ") : "";
}

export function procedureAliases(processType?: string | null) {
  if (processType === "todos") {
    return ["todos los procesos", "aplicacion general"];
  }

  return processType ? procedureCatalog[processType]?.aliases ?? [] : [];
}

export function procedureAnchors(processType?: string | null) {
  if (processType === "todos") {
    return ["norma general aplicable a todos los procesos de contratacion publica"];
  }

  return processType ? procedureCatalog[processType]?.anchors ?? [] : [];
}

export function procedureSourceRequirements(processType?: string | null): ProcedureSourceRequirement[] {
  if (!processType || processType === "todos") {
    return [
      generalLawRequirement,
      generalRegulationRequirement,
      optionalDirectiveRequirement,
      optionalOpinionRequirement,
      optionalBasesRequirement,
    ];
  }

  return procedureCatalog[processType]?.requiredSources ?? [
    generalLawRequirement,
    generalRegulationRequirement,
    optionalOpinionRequirement,
    optionalBasesRequirement,
  ];
}

export function sourceIsCurrent(source: ProcedureSourceLike) {
  const status = normalizeProcedureText(`${source.status ?? ""} ${source.vigencia ?? ""}`);
  return !status.includes("derogad") && !status.includes("no vigente");
}

function sourceTitleText(source: ProcedureSourceLike) {
  return normalizeProcedureText(`${source.documentTitle ?? ""} ${source.excerpt ?? ""}`);
}

export function sourceMatchesRequirement(source: ProcedureSourceLike, requirement: ProcedureSourceRequirement) {
  if (source.documentType !== requirement.documentType) {
    return false;
  }

  if (requirement.article && normalizeProcedureText(source.article ?? "") !== normalizeProcedureText(requirement.article)) {
    return false;
  }

  if (requirement.titleIncludes?.length) {
    const titleText = sourceTitleText(source);
    const hasTitleSignal = requirement.titleIncludes.some((signal) =>
      titleText.includes(normalizeProcedureText(signal)),
    );

    if (!hasTitleSignal) {
      return false;
    }
  }

  return true;
}

export function assessProcedureSourceCoverage(
  processType: string | null | undefined,
  sources: ProcedureSourceLike[],
) {
  const requirements = procedureSourceRequirements(processType);
  const results = requirements.map((requirement) => {
    const matchingSources = sources.filter((source) => sourceMatchesRequirement(source, requirement));
    const currentSources = matchingSources.filter(sourceIsCurrent);
    const ok = requirement.optional ? matchingSources.length > 0 : currentSources.length > 0;
    return {
      ...requirement,
      found: matchingSources.length > 0,
      ok,
      sourceCount: matchingSources.length,
      warning:
        matchingSources.length > 0 && currentSources.length === 0
          ? `${requirement.label} fue recuperada, pero no aparece claramente vigente.`
          : null,
    };
  });
  const missingCritical = results.filter((item) => item.critical && !item.ok);
  const missingRequired = results.filter((item) => !item.optional && !item.ok);
  const basesOnly =
    sources.length > 0 &&
    sources.every((source) => source.documentType === "bases_integradas");

  return {
    basesOnly,
    missing: missingRequired.map((item) => item.label),
    missingCritical: missingCritical.map((item) => item.label),
    ok: missingRequired.length === 0,
    required: requirements.filter((item) => !item.optional).map((item) => item.label),
    results,
    warnings: results.map((item) => item.warning).filter(Boolean) as string[],
  };
}
