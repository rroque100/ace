import { z } from "zod";

export const procurementRuleInputSchema = z.object({
  amount: z.coerce.number().nonnegative().optional().or(z.literal("")),
  objectType: z.enum(["bienes", "servicios", "obras", "consultoria"]).optional(),
  procedureType: z.string().trim().optional().or(z.literal("")),
  standardized: z.boolean().optional(),
  validOffers: z.coerce.number().int().nonnegative().optional().or(z.literal("")),
  directCause: z.string().trim().optional().or(z.literal("")),
  hasTechnicalFile: z.boolean().optional(),
  marketPlurality: z.boolean().optional(),
});

export type ProcurementRuleInput = z.infer<typeof procurementRuleInputSchema>;

export type RuleFinding = {
  action: string;
  basis?: string;
  code: string;
  level: "bloqueante" | "alto" | "medio" | "bajo";
  message: string;
  status: "cumple" | "no_cumple" | "requiere_dato" | "riesgo";
};

export type RuleEvaluation = {
  conclusion: "procede" | "no_procede" | "requiere_revision";
  findings: RuleFinding[];
  nextSteps: string[];
  procedureType: string | null;
  procedureLabel: string | null;
};

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedProcedure(value?: string | null) {
  const normalized = normalizeText(value);

  if (normalized.includes("comparacion") && normalized.includes("precio")) {
    return "comparacion_precios";
  }

  if (normalized.includes("subasta") || normalized === "sie") {
    return "subasta_inversa_electronica";
  }

  if (normalized.includes("contratacion directa")) {
    return "contratacion_directa";
  }

  if (normalized.includes("licitacion") || normalized === "lp") {
    return "licitacion_publica";
  }

  if (normalized.includes("concurso") || normalized === "cp") {
    return "concurso_publico";
  }

  if (normalized.includes("adjudicacion") || normalized === "as") {
    return "adjudicacion_simplificada";
  }

  if (normalized.includes("acuerdo marco")) {
    return "acuerdo_marco";
  }

  if (normalized.includes("consultores individuales")) {
    return "seleccion_consultores_individuales";
  }

  return normalized || null;
}

function asNumber(value: number | "" | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const procedureLabels: Record<string, string> = {
  acuerdo_marco: "Acuerdo marco",
  adjudicacion_simplificada: "Adjudicacion simplificada",
  comparacion_precios: "Comparacion de precios",
  concurso_publico: "Concurso publico",
  contratacion_directa: "Contratacion directa",
  licitacion_publica: "Licitacion publica",
  seleccion_consultores_individuales: "Seleccion de consultores individuales",
  subasta_inversa_electronica: "Subasta inversa electronica",
};

function finding(input: RuleFinding): RuleFinding {
  return input;
}

function pushAmountFinding(findings: RuleFinding[], amount: number | null, codePrefix: string) {
  if (amount == null) {
    findings.push(
      finding({
        action: "Ingresar cuantia estimada y contrastarla con el articulo reglamentario vigente.",
        basis: "Reglamento aplicable al procedimiento y UIT vigente.",
        code: `${codePrefix}-MONTO-001`,
        level: "medio",
        message: "No se informo el monto de la contratacion.",
        status: "requiere_dato",
      }),
    );
    return;
  }

  findings.push(
    finding({
      action: "Validar la cuantia contra el Reglamento vigente y la UIT aplicable antes de aprobar el expediente.",
      basis: "Reglamento aplicable al procedimiento y reglas de cuantia vigentes.",
      code: `${codePrefix}-MONTO-002`,
      level: "medio",
      message: `Monto informado: S/ ${amount.toLocaleString("es-PE")}.`,
      status: "riesgo",
    }),
  );
}

function pushObjectFinding(
  findings: RuleFinding[],
  objectType: ProcurementRuleInput["objectType"],
  allowed: Array<NonNullable<ProcurementRuleInput["objectType"]>>,
  codePrefix: string,
  procedureLabel: string,
) {
  if (!objectType) {
    findings.push(
      finding({
        action: "Indicar si el objeto es bienes, servicios, obras o consultoria.",
        basis: "Clasificacion del objeto contractual en la normativa de contrataciones.",
        code: `${codePrefix}-OBJ-001`,
        level: "medio",
        message: "No se informo el objeto de contratacion.",
        status: "requiere_dato",
      }),
    );
    return;
  }

  if (!allowed.includes(objectType)) {
    findings.push(
      finding({
        action: `No continuar con ${procedureLabel}; seleccionar el procedimiento aplicable para el objeto real.`,
        basis: "Reglas de procedencia por objeto contractual.",
        code: `${codePrefix}-OBJ-002`,
        level: "bloqueante",
        message: `${procedureLabel} no esta configurado para objeto ${objectType}.`,
        status: "no_cumple",
      }),
    );
    return;
  }

  findings.push(
    finding({
      action: "Continuar con la verificacion del objeto contra la norma aplicable.",
      basis: "Objeto compatible con el procedimiento seleccionado.",
      code: `${codePrefix}-OBJ-003`,
      level: "bajo",
      message: `Objeto informado: ${objectType}.`,
      status: "cumple",
    }),
  );
}

function evaluateComparisonPrices(input: ProcurementRuleInput, amount: number | null, validOffers: number | null) {
  const findings: RuleFinding[] = [];

  pushObjectFinding(findings, input.objectType, ["bienes", "servicios"], "CP", "Comparacion de precios");
  pushAmountFinding(findings, amount, "CP");

  if (input.standardized == null) {
    findings.push({
      action: "Confirmar si el bien o servicio es estandarizable y comparable por precio.",
      basis: "Comparacion de precios exige prestaciones comparables y evaluacion por precio.",
      code: "CP-MERCADO-001",
      level: "medio",
      message: "No se informo si el objeto es estandarizado o comparable.",
      status: "requiere_dato",
    });
  } else if (!input.standardized) {
    findings.push({
      action: "No usar comparacion de precios si las prestaciones no son comparables por precio.",
      basis: "Comparacion de precios no debe aplicarse a prestaciones no comparables.",
      code: "CP-MERCADO-002",
      level: "alto",
      message: "El usuario indico que el objeto no es estandarizado/comparable.",
      status: "no_cumple",
    });
  } else {
    findings.push({
      action: "Documentar sustento de comparabilidad en el expediente.",
      basis: "La comparabilidad debe quedar trazable en el expediente.",
      code: "CP-MERCADO-003",
      level: "bajo",
      message: "El objeto fue marcado como estandarizado/comparable.",
      status: "cumple",
    });
  }

  if (input.marketPlurality == null) {
    findings.push({
      action: "Verificar pluralidad de proveedores y condiciones de mercado antes de convocar.",
      basis: "La procedencia requiere condiciones de mercado suficientes.",
      code: "CP-MERCADO-004",
      level: "medio",
      message: "No se informo si existe pluralidad de proveedores.",
      status: "requiere_dato",
    });
  } else if (!input.marketPlurality) {
    findings.push({
      action: "Revisar si corresponde otro procedimiento o sustento excepcional.",
      basis: "Sin pluralidad de mercado la eleccion del procedimiento requiere revision reforzada.",
      code: "CP-MERCADO-005",
      level: "alto",
      message: "No se acredito pluralidad de proveedores.",
      status: "riesgo",
    });
  }

  if (validOffers == null) {
    findings.push({
      action: "Registrar numero de ofertas validas para evaluar continuidad o desierto.",
      basis: "El resultado del procedimiento depende de ofertas validas y reglas de continuidad.",
      code: "CP-OFERTAS-001",
      level: "medio",
      message: "No se informo el numero de ofertas validas.",
      status: "requiere_dato",
    });
  } else if (validOffers < 2) {
    findings.push({
      action: "Revisar regla de declaratoria de desierto y sustentar el resultado.",
      basis: "Menos de dos ofertas validas puede afectar continuidad o resultado.",
      code: "CP-OFERTAS-002",
      level: "alto",
      message: "Hay menos de dos ofertas validas informadas.",
      status: "riesgo",
    });
  } else {
    findings.push({
      action: "Continuar con comparacion economica entre ofertas validas.",
      basis: "La competencia economica requiere ofertas validas comparables.",
      code: "CP-OFERTAS-003",
      level: "bajo",
      message: `Ofertas validas informadas: ${validOffers}.`,
      status: "cumple",
    });
  }

  return findings;
}

function evaluateSie(input: ProcurementRuleInput, amount: number | null) {
  const findings: RuleFinding[] = [];

  pushObjectFinding(findings, input.objectType, ["bienes", "servicios"], "SIE", "Subasta inversa electronica");
  pushAmountFinding(findings, amount, "SIE");

  if (input.hasTechnicalFile == null) {
    findings.push({
      action: "Confirmar si existe ficha tecnica vigente aplicable al objeto.",
      basis: "SIE requiere ficha tecnica vigente cuando corresponda a bienes/servicios comunes.",
      code: "SIE-FICHA-001",
      level: "alto",
      message: "No se informo existencia de ficha tecnica vigente.",
      status: "requiere_dato",
    });
  } else if (!input.hasTechnicalFile) {
    findings.push({
      action: "No usar SIE si no existe ficha tecnica vigente aplicable.",
      basis: "Sin ficha tecnica vigente no corresponde tramitar SIE para ese objeto.",
      code: "SIE-FICHA-002",
      level: "bloqueante",
      message: "El objeto no cuenta con ficha tecnica vigente informada.",
      status: "no_cumple",
    });
  } else {
    findings.push({
      action: "Comparar las especificaciones tecnicas contra la ficha tecnica sin agregar requisitos no previstos.",
      basis: "La ficha tecnica delimita las especificaciones del bien/servicio comun.",
      code: "SIE-FICHA-003",
      level: "bajo",
      message: "Se informo ficha tecnica vigente.",
      status: "cumple",
    });
  }

  if (input.standardized === false) {
    findings.push({
      action: "Revisar consistencia: SIE exige bienes/servicios comunes o estandarizados.",
      basis: "SIE opera sobre prestaciones comunes/estandarizadas.",
      code: "SIE-STD-001",
      level: "alto",
      message: "El objeto fue marcado como no estandarizado.",
      status: "no_cumple",
    });
  }

  return findings;
}

function evaluateDirectContract(input: ProcurementRuleInput) {
  const findings: RuleFinding[] = [];
  pushObjectFinding(findings, input.objectType, ["bienes", "servicios", "obras", "consultoria"], "CD", "Contratacion directa");

  if (!input.directCause) {
    findings.push({
      action: "Identificar y sustentar la causal legal exacta de contratacion directa.",
      basis: "Contratacion directa exige causal legal expresa y sustento reforzado.",
      code: "CD-CAUSAL-001",
      level: "bloqueante",
      message: "No se informo causal de contratacion directa.",
      status: "requiere_dato",
    });
  } else {
    findings.push({
      action: "Verificar que la causal se encuentre prevista en la Ley/Reglamento y que el expediente la sustente.",
      basis: "La causal debe estar prevista en norma y acreditada en el expediente.",
      code: "CD-CAUSAL-002",
      level: "alto",
      message: `Causal informada: ${input.directCause}.`,
      status: "riesgo",
    });
  }

  findings.push({
    action: "Preparar informe tecnico/legal con causal, proveedor, indagacion y trazabilidad del sustento.",
    basis: "Contratacion directa requiere motivacion y control del sustento.",
    code: "CD-SUST-001",
    level: "medio",
    message: "La contratacion directa requiere sustento reforzado y control posterior.",
    status: "riesgo",
  });

  return findings;
}

function evaluateCompetitiveProcedure(
  input: ProcurementRuleInput,
  amount: number | null,
  procedureType: string,
) {
  const labels = {
    adjudicacion_simplificada: "Adjudicacion simplificada",
    concurso_publico: "Concurso publico",
    licitacion_publica: "Licitacion publica",
  } as const;
  const code = procedureType === "licitacion_publica" ? "LP" : procedureType === "concurso_publico" ? "CON" : "AS";
  const findings: RuleFinding[] = [];
  const label = labels[procedureType as keyof typeof labels];
  const allowed =
    procedureType === "licitacion_publica"
      ? (["bienes", "servicios", "obras"] as const)
      : procedureType === "concurso_publico"
        ? (["servicios", "consultoria"] as const)
        : (["bienes", "servicios", "obras", "consultoria"] as const);

  pushObjectFinding(findings, input.objectType, [...allowed], code, label);
  pushAmountFinding(findings, amount, code);
  findings.push({
    action: "Verificar bases, requerimiento, cuantía de la contratación, indagacion de mercado y reglas de admision/calificacion.",
    basis: "Procedimiento competitivo requiere expediente completo y criterios objetivos.",
    code: `${code}-EXP-001`,
    level: "medio",
    message: `${label} requiere expediente completo y criterios trazables.`,
    status: "riesgo",
  });

  return findings;
}

function evaluateAgreementOrConsultants(input: ProcurementRuleInput, amount: number | null, procedureType: string) {
  const findings: RuleFinding[] = [];
  const isConsultants = procedureType === "seleccion_consultores_individuales";
  const label = isConsultants ? "Seleccion de consultores individuales" : "Acuerdo marco";
  const code = isConsultants ? "SCI" : "AM";

  pushObjectFinding(
    findings,
    input.objectType,
    isConsultants ? ["consultoria"] : ["bienes", "servicios"],
    code,
    label,
  );
  pushAmountFinding(findings, amount, code);
  findings.push({
    action: isConsultants
      ? "Validar que la necesidad corresponda a consultoria individual y que no sea una consultoria de firma."
      : "Verificar si el catalogo/acuerdo marco vigente cubre el objeto antes de elegir otro procedimiento.",
    basis: isConsultants
      ? "La seleccion de consultores individuales aplica solo a supuestos propios de consultoria individual."
      : "Acuerdo marco/catalogo debe revisarse antes de elegir otro procedimiento cuando cubre el objeto.",
    code: `${code}-PROC-001`,
    level: "medio",
    message: `${label} requiere validacion operativa especifica.`,
    status: "riesgo",
  });

  return findings;
}

function conclude(findings: RuleFinding[]) {
  const hasBlocking = findings.some((item) => item.level === "bloqueante" || item.status === "no_cumple");
  const needsData = findings.some((item) => item.status === "requiere_dato");
  return hasBlocking ? "no_procede" : needsData ? "requiere_revision" : "procede";
}

function buildNextSteps(procedureType: string | null) {
  const articleHint =
    procedureType === "comparacion_precios"
      ? "Buscar el Reglamento vigente que desarrolla la comparacion de precios (la Ley, art. 4, remite al Reglamento) y contrastar la cuantia/condiciones."
      : "Buscar Ley, Reglamento y directiva aplicable al procedimiento seleccionado.";

  return [
    articleHint,
    "Abrir las fuentes recuperadas y confirmar pagina/articulo antes de usar la conclusion.",
    "Guardar el resultado en el expediente si la decision sera usada como sustento interno.",
  ];
}

export function evaluateProcurementRules(input: ProcurementRuleInput): RuleEvaluation {
  const procedureType = normalizedProcedure(input.procedureType);
  const amount = asNumber(input.amount);
  const validOffers = asNumber(input.validOffers);
  let findings: RuleFinding[] = [];

  if (!procedureType) {
    return {
      conclusion: "requiere_revision",
      findings: [
        {
        action: "Seleccionar o describir el procedimiento que se desea validar.",
        basis: "Sin procedimiento identificado no se puede aplicar una regla de procedencia.",
          code: "PROC-000",
          level: "bajo",
          message: "No se pudo identificar el procedimiento de seleccion.",
          status: "requiere_dato",
        },
      ],
      nextSteps: buildNextSteps(null),
      procedureType,
      procedureLabel: null,
    };
  }

  if (procedureType === "comparacion_precios") {
    findings = evaluateComparisonPrices(input, amount, validOffers);
  } else if (procedureType === "subasta_inversa_electronica") {
    findings = evaluateSie(input, amount);
  } else if (procedureType === "contratacion_directa") {
    findings = evaluateDirectContract(input);
  } else if (["licitacion_publica", "concurso_publico", "adjudicacion_simplificada"].includes(procedureType)) {
    findings = evaluateCompetitiveProcedure(input, amount, procedureType);
  } else if (["acuerdo_marco", "seleccion_consultores_individuales"].includes(procedureType)) {
    findings = evaluateAgreementOrConsultants(input, amount, procedureType);
  } else {
    findings = [
      {
        action: "Revisar manualmente el procedimiento y cargar la directiva o norma especial aplicable.",
        basis: "No hay regla automatizada especifica para este procedimiento.",
        code: "PROC-999",
        level: "medio",
        message: "El procedimiento no tiene reglas especializadas configuradas.",
        status: "requiere_dato",
      },
    ];
  }

  return {
    conclusion: conclude(findings),
    findings,
    nextSteps: buildNextSteps(procedureType),
    procedureType,
    procedureLabel: procedureLabels[procedureType] ?? procedureType,
  };
}
