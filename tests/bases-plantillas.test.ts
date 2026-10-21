import { describe, expect, it } from "vitest";
import { esProcesoAmbiguo, PLANTILLAS_BASES, resolverPlantillaAmbigua, VARIANTES_AMBIGUAS } from "@/lib/bases-plantillas";

describe("PLANTILLAS_BASES · Licitación Pública para bienes", () => {
  const plantilla = PLANTILLAS_BASES["Licitación Pública para bienes"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("la Sección Específica tiene los campos confirmados del Capítulo I y III", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).toContain("cap1.entidad.nombre");
    expect(rutas).toContain("cap1.entidad.ruc");
    expect(rutas).toContain("cap3.finalidadPublica");
    expect(rutas).toContain("cap3.descripcionRequerimiento");
    expect(rutas).toContain("cap3.modalidadPago");
    expect(rutas).toContain("cap3.sistemaEntrega");
  });

  it("los campos con origen literal declaran de qué hito salen", () => {
    const finalidad = plantilla.seccionEspecifica.find((c) => c.ruta === "cap3.finalidadPublica")!;
    expect(finalidad.origen).toBe("literal");
    expect(finalidad.hito).toBe("A3");
  });

  it("el nombre y RUC de la entidad no se inventan como literal de un hito", () => {
    // Ni A1 ni A9 tienen un campo de nombre/RUC de la entidad contratante: ese
    // dato vive en Configuración → Municipalidad (entity_settings), no en los
    // hitos de la fase de contratación.
    const nombre = plantilla.seccionEspecifica.find((c) => c.ruta === "cap1.entidad.nombre")!;
    const ruc = plantilla.seccionEspecifica.find((c) => c.ruta === "cap1.entidad.ruc")!;
    expect(nombre.origen).toBe("entidad");
    expect(ruc.origen).toBe("entidad");
  });

  it("el resto del Capítulo III (3.3.c-j) y el 3.5 salen de A3/A4, leídos del PDF real", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap3.plazoEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "plazo_dias" });
    expect(porRuta["cap3.lugarEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "lugar_entrega" });
    expect(porRuta["cap3.penalidadMora"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "penalidad_mora" });
    expect(porRuta["cap3.otrasPenalidades"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "otras_penalidades" });
    expect(porRuta["cap3.subcontratacion"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "subcontratacion" });
    expect(porRuta["cap3.formulaReajuste"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "formula_reajuste" });
    expect(porRuta["cap3.solucionControversias"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "solucion_controversias" });
    // Los requisitos de calificación de las bases son los DECIDIDOS en la
    // estrategia (A4 · f), no la propuesta del área usuaria en A3.
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
  });

  it("el Capítulo IV (factores de evaluación) sale de la estrategia decidida en A4", () => {
    const factores = plantilla.seccionEspecifica.find((c) => c.ruta === "cap4.factoresEvaluacion")!;
    expect(factores).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("el Capítulo V (proforma del contrato) no se mapea aquí: depende de datos de Fase 2 (buena pro), no de A1-A9", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas.some((r) => r.startsWith("cap5."))).toBe(false);
  });
});

describe("PLANTILLAS_BASES · Licitación Pública para bienes especializados", () => {
  const especializados = PLANTILLAS_BASES["Licitación Pública para bienes especializados"];
  const bienes = PLANTILLAS_BASES["Licitación Pública para bienes"];

  it("existe y no está vacía", () => {
    expect(especializados).toBeDefined();
    expect(especializados.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("reutiliza la MISMA Sección General y los mismos campos que bienes: mismo pdfBasesEstandar (BASES_BIENES)", () => {
    // Confirmado en lib/procesos-seleccion.ts: ambos catálogos apuntan al
    // mismo PDF — el OECE no publicó una bases estándar propia para la
    // variante "especializados". No es una coincidencia de contenido, es
    // literalmente el mismo array de campos (misma referencia).
    expect(especializados.seccionGeneral).toBe(bienes.seccionGeneral);
    expect(especializados.seccionEspecifica).toBe(bienes.seccionEspecifica);
  });

  it("el proceso declarado es el propio, no el de bienes sin especializar", () => {
    expect(especializados.proceso).toBe("Licitación Pública para bienes especializados");
  });
});

describe("PLANTILLAS_BASES · Licitación Pública de obras", () => {
  const plantilla = PLANTILLAS_BASES["Licitación Pública de obras"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("la Sección General refleja el contenido propio de obras (dos sistemas de entrega, JPRD y garantías distintas de bienes)", () => {
    // Estos valores NO son los de bienes (S/ 480 000 / S/ 10 000 000 con otro
    // texto): confirman que no se copió la Sección General de bienes por error.
    expect(plantilla.seccionGeneral).toContain("solo construcción");
    expect(plantilla.seccionGeneral).toContain("diseño y construcción");
    expect(plantilla.seccionGeneral).toContain("S/ 5 000 000,00");
    expect(plantilla.seccionGeneral).toContain("Capacidad Técnica y Profesional");
  });

  it("nombre/RUC de la entidad y el año fiscal siguen el mismo patrón que bienes", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.entidad.ruc"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.anioFiscal"]).toMatchObject({ origen: "necesidad" });
  });

  it("la finalidad pública y el CUI salen de A3/A4, confirmados contra el PDF de obras", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.cui"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "cui" });
  });

  it("las condiciones de contratación compartidas por ambas variantes de Cap. III salen de A3/A4, confirmadas contra el PDF completo", () => {
    // Confirmado leyendo el PDF completo (no solo la Sección General): ambas
    // variantes del Cap. III (diseño y construcción p. 34-49; solo
    // construcción p. 51-65) numeran distinto (3.5.x vs. 3.3.x) pero
    // contienen el MISMO conjunto de condiciones de contratación, con la
    // misma base legal en ambas.
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap3.subcontratacion"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "subcontratacion" });
    // Modalidad de pago de obras cita el artículo 161, NO el 130 de
    // bienes/servicios — mismo campoHito (el dato es genérico por objeto).
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.formulaReajuste"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "formula_reajuste" });
    expect(porRuta["cap3.penalidadMora"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "penalidad_mora" });
    expect(porRuta["cap3.otrasPenalidades"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "otras_penalidades" });
    expect(porRuta["cap3.solucionControversias"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "solucion_controversias" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("sigue sin forzar 3.2/plazos/sistema de entrega: no son campos de relleno simples", () => {
    // "descripcionRequerimiento" (3.2 es un bloque estructurado propio de
    // obras, no un texto libre), "sistemaEntrega" (no es un campo de relleno:
    // es la elección de cuál de las dos variantes de Cap. III usar) y
    // "plazoEntrega"/"lugarEntrega" (los plazos de obras son una tabla con
    // varias filas, no un escalar) siguen sin mapear a propósito.
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).not.toContain("cap3.descripcionRequerimiento");
    expect(rutas).not.toContain("cap3.sistemaEntrega");
    expect(rutas).not.toContain("cap3.plazoEntrega");
    expect(rutas).not.toContain("cap3.lugarEntrega");
  });
});

describe("PLANTILLAS_BASES · Licitación Pública de obras con precalificación", () => {
  const conPrecalificacion = PLANTILLAS_BASES["Licitación Pública de obras con precalificación"];
  const obras = PLANTILLAS_BASES["Licitación Pública de obras"];

  it("existe y no está vacía", () => {
    expect(conPrecalificacion).toBeDefined();
    expect(conPrecalificacion.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("reutiliza la MISMA Sección General y los mismos campos que obras sin precalificar: mismo pdfBasesEstandar (BASES_OBRAS)", () => {
    // Confirmado en lib/procesos-seleccion.ts: ambos catálogos apuntan al
    // mismo PDF — el OECE no publicó una bases estándar propia para la
    // variante "con precalificación".
    expect(conPrecalificacion.seccionGeneral).toBe(obras.seccionGeneral);
    expect(conPrecalificacion.seccionEspecifica).toBe(obras.seccionEspecifica);
  });

  it("el proceso declarado es el propio, no el de obras sin precalificar", () => {
    expect(conPrecalificacion.proceso).toBe("Licitación Pública de obras con precalificación");
  });
});

describe("PLANTILLAS_BASES · Licitación Pública de obras con negociación", () => {
  const conNegociacion = PLANTILLAS_BASES["Licitación Pública de obras con negociación"];
  const obras = PLANTILLAS_BASES["Licitación Pública de obras"];

  it("existe y no está vacía", () => {
    expect(conNegociacion).toBeDefined();
    expect(conNegociacion.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("reutiliza la MISMA Sección General y los mismos campos que obras sin negociación: mismo pdfBasesEstandar (BASES_OBRAS)", () => {
    // Confirmado en lib/procesos-seleccion.ts: ambos catálogos apuntan al
    // mismo PDF — el OECE no publicó una bases estándar propia para la
    // variante "con negociación". Encontrado en la auditoría de cobertura
    // (todo `pdfBasesEstandar` del catálogo debe resolver a una plantilla).
    expect(conNegociacion.seccionGeneral).toBe(obras.seccionGeneral);
    expect(conNegociacion.seccionEspecifica).toBe(obras.seccionEspecifica);
  });

  it("el proceso declarado es el propio, no el de obras sin negociación", () => {
    expect(conNegociacion.proceso).toBe("Licitación Pública de obras con negociación");
  });
});

describe("PLANTILLAS_BASES · Concurso Público de servicios", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público de servicios"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("la Sección General refleja el contenido propio de servicios (ASISTE, sin el literal f de JPRD)", () => {
    expect(plantilla.seccionGeneral).toContain("ASISTE");
    // Confirmado leyendo el PDF: el Capítulo IV de servicios termina en el
    // literal e) Institución Arbitral — NO tiene el literal f) de JPRD que sí
    // tienen bienes y obras. Si algún día aparece "Centro de administración
    // de la JPRD" aquí, la transcripción se copió mal de otro tipo.
    expect(plantilla.seccionGeneral).not.toContain("Centro de administración de la JPRD");
  });

  it("tiene el mismo mapeo completo que bienes: la estructura del Capítulo III es idéntica", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.entidad.ruc"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.anioFiscal"]).toMatchObject({ origen: "necesidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.descripcionRequerimiento"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "descripcion" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.sistemaEntrega"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" });
    expect(porRuta["cap3.plazoEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "plazo_dias" });
    expect(porRuta["cap3.lugarEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "lugar_entrega" });
    expect(porRuta["cap3.penalidadMora"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "penalidad_mora" });
    expect(porRuta["cap3.otrasPenalidades"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "otras_penalidades" });
    expect(porRuta["cap3.subcontratacion"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "subcontratacion" });
    expect(porRuta["cap3.formulaReajuste"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "formula_reajuste" });
    expect(porRuta["cap3.solucionControversias"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "solucion_controversias" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("el Capítulo V (proforma del contrato) no se mapea aquí", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas.some((r) => r.startsWith("cap5."))).toBe(false);
  });
});

describe("PLANTILLAS_BASES · Concurso Público para consultoría en general", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público para consultoría en general"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("la Sección General refleja el contenido propio de consultoría en general (evaluadores comité o jurado, sin JPRD)", () => {
    expect(plantilla.seccionGeneral).toContain("consultoría en general");
    expect(plantilla.seccionGeneral).toContain("comité o jurado");
    expect(plantilla.seccionGeneral).not.toContain("Centro de administración de la JPRD");
  });

  it("tiene el mismo mapeo completo que bienes y servicios: la estructura del Capítulo III es idéntica", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("NO está registrada bajo el valor real del catálogo, porque ese valor es ambiguo (resuelve a 3 PDFs)", () => {
    // "Concurso Público para consultorías y servicios de mantenimiento vial"
    // es el value real en lib/procesos-seleccion.ts, y resuelve a 3 PDFs
    // (BASES_CONSULTORIA_VIAL): esta plantilla es solo uno de los tres, y
    // registrarla bajo ese value habría fingido resuelta una ambigüedad que
    // ACE todavía no puede distinguir (ver el comentario junto a
    // SECCION_GENERAL_CONSULTORIA_GENERAL en lib/bases-plantillas.ts).
    expect(PLANTILLAS_BASES["Concurso Público para consultorías y servicios de mantenimiento vial"]).toBeUndefined();
  });
});

describe("PLANTILLAS_BASES · Concurso Público para consultoría de obra", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público para consultoría de obra"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("la Sección General refleja diferencias reales frente a bienes/servicios: sin fideicomiso ni excepción de 50 UIT", () => {
    // Confirmado leyendo el PDF: la garantía de fiel cumplimiento de
    // consultoría de obra NO incluye "fideicomiso" como opción (bienes,
    // servicios y consultoría en general sí lo tienen), y no trae el párrafo
    // de "Excepciones" para contratos ≤ 50 UIT que los otros tres sí tienen.
    expect(plantilla.seccionGeneral).toContain("consultoría de obra");
    expect(plantilla.seccionGeneral).not.toContain("fideicomiso");
    expect(plantilla.seccionGeneral).not.toContain("Excepciones:");
    expect(plantilla.seccionGeneral).not.toContain("Centro de administración de la JPRD");
  });

  it("las condiciones de contratación del 3.3.5 salen de A3/A4, confirmadas contra el PDF completo", () => {
    // Confirmado leyendo el PDF completo (no solo la Sección General): el
    // numeral 3.3.5 "Condiciones de contratación" (a diferencia de obras, un
    // solo numeral, no repetido por variante de capítulo) trae modalidad de
    // pago (Art. 161), sistema de entrega (Art. 159/160 — aquí SÍ es un
    // campo de relleno, a diferencia de obras), lugar de prestación,
    // penalidades, subcontratación (Art. 108), fórmula de reajuste (Art.
    // 209) y solución de controversias, más requisitos de calificación
    // (3.4) y factores de evaluación (Cap. IV).
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.entidad.ruc"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.anioFiscal"]).toMatchObject({ origen: "necesidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.cui"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "cui" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.sistemaEntrega"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" });
    expect(porRuta["cap3.lugarEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "lugar_entrega" });
    expect(porRuta["cap3.penalidadMora"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "penalidad_mora" });
    expect(porRuta["cap3.otrasPenalidades"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "otras_penalidades" });
    expect(porRuta["cap3.subcontratacion"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "subcontratacion" });
    expect(porRuta["cap3.formulaReajuste"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "formula_reajuste" });
    expect(porRuta["cap3.solucionControversias"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "solucion_controversias" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("sigue sin forzar 3.2 ni el plazo de prestación: su estructura difiere de bienes y no se adivina", () => {
    // "descripcionRequerimiento" es la ruta de bienes (3.3.a); consultoría de
    // obra tiene un bloque 3.2 estructurado propio
    // (proyecto/CUI/ubicación/especialidad/subespecialidad/tipología + 6
    // tablas alternativas por sistema de entrega) sin campo ACE equivalente.
    // El plazo de prestación (3.3.5.c) es también una tabla, no un escalar.
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).not.toContain("cap3.descripcionRequerimiento");
    expect(rutas).not.toContain("cap3.plazoEntrega");
  });
});

describe("PLANTILLAS_BASES · Concurso Público para servicio de mantenimiento vial", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público para servicio de mantenimiento vial"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("la Sección General refleja contenido propio: fideicomiso Y excepción de 50 UIT, a diferencia de consultoría de obra", () => {
    // Mantenimiento vial SÍ tiene ambas (como bienes/servicios); consultoría
    // de obra no tiene ninguna de las dos — confirma que no se confundió la
    // transcripción entre las tres variantes del mismo grupo.
    expect(plantilla.seccionGeneral).toContain("mantenimiento vial");
    expect(plantilla.seccionGeneral).toContain("fideicomiso");
    expect(plantilla.seccionGeneral).toContain("Excepciones:");
  });

  it("tiene el mismo mapeo completo que bienes/servicios/consultoría en general: modalidad de pago cita el artículo 130", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.descripcionRequerimiento"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "descripcion" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.sistemaEntrega"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("el Capítulo V (proforma del contrato) no se mapea aquí", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas.some((r) => r.startsWith("cap5."))).toBe(false);
  });
});

describe("PLANTILLAS_BASES · Subasta Inversa Electrónica", () => {
  const plantilla = PLANTILLAS_BASES["Subasta Inversa Electrónica"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("refleja diferencias reales: apelación en 5 días hábiles (no 8) y sí tiene JPRD", () => {
    // Confirmado leyendo el PDF: distinto del resto de bases estándar, que
    // interponen la apelación en 8 días hábiles siempre.
    expect(plantilla.seccionGeneral).toContain("cinco días hábiles");
    expect(plantilla.seccionGeneral).toContain("Centro de administración de la JPRD");
  });

  it("mapea el Capítulo III salvo lo confirmado ausente: sin sistema de entrega ni factores de evaluación", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    // Ausentes a propósito: la ficha técnica fija el sistema de entrega, y
    // "el único factor de evaluación es el precio" (no hay nada que elegir).
    expect(rutas).not.toContain("cap3.sistemaEntrega");
    expect(rutas).not.toContain("cap4.factoresEvaluacion");
  });
});

describe("PLANTILLAS_BASES · Comparación de Precios", () => {
  const plantilla = PLANTILLAS_BASES["Comparación de Precios"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("refleja diferencias reales: cuantía tope S/ 100 000 y sin garantía de fiel cumplimiento", () => {
    // Confirmado leyendo el PDF: por la cuantía tope, el Capítulo IV nunca
    // menciona garantía de fiel cumplimiento (empieza directo en "Contrato
    // de consorcio"), a diferencia del resto de bases estándar.
    expect(plantilla.seccionGeneral).toContain("S/ 100 000,00");
    expect(plantilla.seccionGeneral).not.toContain("garantía de fiel cumplimiento");
    expect(plantilla.seccionGeneral).not.toContain("CONSIDERACIONES PARA LAS GARANTÍAS FINANCIERAS");
  });

  it("mapea el Capítulo III salvo lo confirmado ausente: sin sistema de entrega, subcontratación, reajuste ni factores", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).not.toContain("cap3.sistemaEntrega");
    expect(rutas).not.toContain("cap3.subcontratacion");
    expect(rutas).not.toContain("cap3.formulaReajuste");
    expect(rutas).not.toContain("cap4.factoresEvaluacion");
  });
});

describe("PLANTILLAS_BASES · Procedimiento de Selección No Competitivo", () => {
  const plantilla = PLANTILLAS_BASES["Procedimiento de Selección No Competitivo"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General tiene SOLO 3 capítulos: no hay Recurso de Apelación", () => {
    // Confirmado leyendo el PDF: al invitarse a un único proveedor, no hay
    // postores en competencia ni buena pro que impugnar entre ellos.
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN NO COMPETITIVO");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
    expect(plantilla.seccionGeneral).not.toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).not.toContain("CAPÍTULO IV");
  });

  it("refleja las etapas propias: actuaciones preparatorias, fase de selección, aprobación", () => {
    expect(plantilla.seccionGeneral).toContain("a) Actuaciones preparatorias.");
    expect(plantilla.seccionGeneral).toContain("b) Fase de Selección.");
    expect(plantilla.seccionGeneral).toContain("c) Aprobación del procedimiento no competitivo.");
  });

  it("el mapeo es PARCIAL: solo entidad, año fiscal, finalidad pública, descripción y requisitos de calificación", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.descripcionRequerimiento"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "descripcion" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
  });

  it("no fuerza 'condiciones de contratación': el PDF remite a las bases estándar del objeto, no da campos propios", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).not.toContain("cap3.modalidadPago");
    expect(rutas).not.toContain("cap3.sistemaEntrega");
    expect(rutas).not.toContain("cap3.plazoEntrega");
    expect(rutas).not.toContain("cap3.lugarEntrega");
    expect(rutas).not.toContain("cap3.penalidadMora");
    expect(rutas).not.toContain("cap4.factoresEvaluacion");
  });
});

describe("PLANTILLAS_BASES · Licitación Pública abreviada para bienes", () => {
  const plantilla = PLANTILLAS_BASES["Licitación Pública abreviada para bienes"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("refleja plazos abreviados: consultas en 3 días hábiles y apelación en 5 (no 7 y 8 como bienes)", () => {
    expect(plantilla.seccionGeneral).toContain("no menor a tres días hábiles");
    expect(plantilla.seccionGeneral).toContain("dentro de los cinco días hábiles siguientes");
    expect(plantilla.seccionGeneral).not.toContain("no menor a siete días hábiles");
  });

  it("tiene el mismo mapeo completo que bienes: la estructura del Capítulo III es idéntica", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.sistemaEntrega"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });
});

describe("PLANTILLAS_BASES · Licitación Pública abreviada de obras", () => {
  const plantilla = PLANTILLAS_BASES["Licitación Pública abreviada de obras"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("refleja plazos abreviados y el alcance propio (sin la variante de precalificación)", () => {
    expect(plantilla.seccionGeneral).toContain("no menor a tres días hábiles");
    expect(plantilla.seccionGeneral).toContain("dentro de los cinco días hábiles siguientes");
    expect(plantilla.seccionGeneral).toContain("rehabilitación y reconstrucción");
  });

  it("reutiliza CAMPOS_OBRAS_SM tal cual: mismo mapeo ampliado que obras sin abreviar", () => {
    // Confirmado leyendo el PDF completo de la abreviada: comparte con
    // "Licitación Pública de obras" las mismas dos variantes de Cap. III y
    // las mismas condiciones de contratación, con idénticas citas legales
    // (Art. 108 subcontratación, 161 modalidad de pago, 209 reajuste, 120
    // penalidad por mora) en ambas.
    const obras = PLANTILLAS_BASES["Licitación Pública de obras"];
    expect(plantilla.seccionEspecifica).toBe(obras.seccionEspecifica);
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.cui"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "cui" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("sigue sin forzar 3.2/plazos/sistema de entrega: no son campos de relleno simples", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).not.toContain("cap3.descripcionRequerimiento");
    expect(rutas).not.toContain("cap3.sistemaEntrega");
    expect(rutas).not.toContain("cap3.plazoEntrega");
    expect(rutas).not.toContain("cap3.lugarEntrega");
  });
});

describe("PLANTILLAS_BASES · Concurso Público abreviado de servicios", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público abreviado de servicios"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("refleja plazos abreviados y el alcance propio (sin la variante de precalificación)", () => {
    expect(plantilla.seccionGeneral).toContain("no menor a tres días hábiles");
    expect(plantilla.seccionGeneral).toContain("dentro de los cinco días hábiles siguientes");
    expect(plantilla.seccionGeneral).toContain("rehabilitación y reconstrucción");
  });

  it("la Sección General refleja el contenido propio de servicios (ASISTE, sin el literal f de JPRD)", () => {
    expect(plantilla.seccionGeneral).toContain("ASISTE");
    // Igual que "Concurso Público de servicios" sin abreviar: el Capítulo IV
    // termina en el literal e) Institución Arbitral, sin el literal f) de JPRD
    // que sí tienen bienes/obras (abreviados o no).
    expect(plantilla.seccionGeneral).not.toContain("Centro de administración de la JPRD");
  });

  it("tiene el mismo mapeo completo que servicios sin abreviar: la estructura del Capítulo III es idéntica", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.entidad.ruc"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.anioFiscal"]).toMatchObject({ origen: "necesidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.descripcionRequerimiento"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "descripcion" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.sistemaEntrega"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" });
    expect(porRuta["cap3.plazoEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "plazo_dias" });
    expect(porRuta["cap3.lugarEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "lugar_entrega" });
    expect(porRuta["cap3.penalidadMora"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "penalidad_mora" });
    expect(porRuta["cap3.otrasPenalidades"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "otras_penalidades" });
    expect(porRuta["cap3.subcontratacion"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "subcontratacion" });
    expect(porRuta["cap3.formulaReajuste"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "formula_reajuste" });
    expect(porRuta["cap3.solucionControversias"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "solucion_controversias" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("el Capítulo V (proforma del contrato) no se mapea aquí", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas.some((r) => r.startsWith("cap5."))).toBe(false);
  });

  it("NO está registrada bajo el valor real del catálogo, porque ese valor es ambiguo (agrupa 4 PDFs abreviados)", () => {
    // "Concurso Público abreviado" es el value real en
    // lib/procesos-seleccion.ts (BASES_CONCURSO_ABREVIADO): esta plantilla es
    // solo una de las cuatro variantes abreviadas (servicios / consultoría en
    // general / consultoría de obra / mantenimiento vial).
    expect(PLANTILLAS_BASES["Concurso Público abreviado"]).toBeUndefined();
  });
});

describe("PLANTILLAS_BASES · Concurso Público abreviado para consultoría en general", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público abreviado para consultoría en general"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("refleja plazos abreviados y un alcance propio (sin el listado de 5 supuestos de bienes/obras/servicios)", () => {
    expect(plantilla.seccionGeneral).toContain("no menor a tres días hábiles");
    expect(plantilla.seccionGeneral).toContain("dentro de los cinco días hábiles siguientes");
    expect(plantilla.seccionGeneral).toContain("rehabilitación y reconstrucción");
    // El alcance de consultoría en general (abreviada o no) tiene solo tres
    // supuestos, sin homologados ni insumos de empresas del Estado.
    expect(plantilla.seccionGeneral).not.toContain("homologados");
  });

  it("la Sección General refleja el contenido propio de consultoría en general (evaluadores oficial de compra, comité o jurado)", () => {
    expect(plantilla.seccionGeneral).toContain("consultoría en general");
    expect(plantilla.seccionGeneral).toContain("oficial de compra, comité o jurado");
    expect(plantilla.seccionGeneral).not.toContain("Centro de administración de la JPRD");
  });

  it("tiene el mismo mapeo completo que consultoría en general sin abreviar: la estructura del Capítulo III es idéntica", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.entidad.ruc"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.anioFiscal"]).toMatchObject({ origen: "necesidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.sistemaEntrega"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("NO está registrada bajo el valor real del catálogo, porque ese valor es ambiguo (agrupa 4 PDFs abreviados)", () => {
    expect(PLANTILLAS_BASES["Concurso Público abreviado"]).toBeUndefined();
  });
});

describe("PLANTILLAS_BASES · Concurso Público abreviado para consultoría de obra", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público abreviado para consultoría de obra"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("refleja plazos abreviados y la evaluación económica limitada al 90% propia de consultoría de obra", () => {
    expect(plantilla.seccionGeneral).toContain("no menor a tres días hábiles");
    expect(plantilla.seccionGeneral).toContain("dentro de los cinco días hábiles siguientes");
    expect(plantilla.seccionGeneral).toContain("no debe ser menor al 90% de la cuantía de la contratación");
  });

  it("no incluye fideicomiso como opción de garantía (a diferencia de bienes/servicios)", () => {
    // Confirmado leyendo el PDF: igual que "Concurso Público para
    // consultoría de obra" sin abreviar, el literal a) del Capítulo IV solo
    // ofrece carta fianza financiera, contrato de seguro o retención de
    // pago — sin la opción de fideicomiso que sí tienen bienes/servicios.
    expect(plantilla.seccionGeneral).not.toContain("fideicomiso");
  });

  it("reutiliza CAMPOS_CONSULTORIA_OBRA tal cual: mismo mapeo ampliado que la versión sin abreviar", () => {
    // Confirmado leyendo el PDF completo de la abreviada: comparte con
    // "Concurso Público para consultoría de obra" el mismo numeral 3.3.5 y
    // las mismas citas legales (Art. 161/159-160/108/209/120).
    const sinAbreviar = PLANTILLAS_BASES["Concurso Público para consultoría de obra"];
    expect(plantilla.seccionEspecifica).toBe(sinAbreviar.seccionEspecifica);
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.cui"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "cui" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.sistemaEntrega"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("sigue sin forzar 3.2 ni el plazo de prestación: su estructura difiere de bienes y no se adivina", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).not.toContain("cap3.descripcionRequerimiento");
    expect(rutas).not.toContain("cap3.plazoEntrega");
  });

  it("NO está registrada bajo el valor real del catálogo, porque ese valor es ambiguo (agrupa 4 PDFs abreviados)", () => {
    expect(PLANTILLAS_BASES["Concurso Público abreviado"]).toBeUndefined();
  });
});

describe("PLANTILLAS_BASES · Concurso Público abreviado para servicios de mantenimiento vial", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público abreviado para servicios de mantenimiento vial"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("refleja plazos abreviados y los dos métodos de evaluación económica propios de mantenimiento vial", () => {
    expect(plantilla.seccionGeneral).toContain("no menor a tres días hábiles");
    expect(plantilla.seccionGeneral).toContain("dentro de los cinco días hábiles siguientes");
    expect(plantilla.seccionGeneral).toContain("entre el 95% y 110% de la cuantía de la contratación");
    expect(plantilla.seccionGeneral).toContain("Oferta económica fija al 100%");
  });

  it("sí incluye fideicomiso como opción de garantía (a diferencia de consultoría de obra)", () => {
    expect(plantilla.seccionGeneral).toContain("fideicomiso");
  });

  it("tiene el mismo mapeo completo que mantenimiento vial sin abreviar: la estructura del Capítulo III es idéntica", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.entidad.ruc"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.anioFiscal"]).toMatchObject({ origen: "necesidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.descripcionRequerimiento"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "descripcion" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.sistemaEntrega"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" });
    expect(porRuta["cap3.plazoEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "plazo_dias" });
    expect(porRuta["cap3.lugarEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "lugar_entrega" });
    expect(porRuta["cap3.penalidadMora"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "penalidad_mora" });
    expect(porRuta["cap3.otrasPenalidades"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "otras_penalidades" });
    expect(porRuta["cap3.subcontratacion"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "subcontratacion" });
    expect(porRuta["cap3.formulaReajuste"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "formula_reajuste" });
    expect(porRuta["cap3.solucionControversias"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "solucion_controversias" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("el Capítulo V (proforma del contrato) no se mapea aquí", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas.some((r) => r.startsWith("cap5."))).toBe(false);
  });

  it("NO está registrada bajo el valor real del catálogo, porque ese valor es ambiguo (agrupa 4 PDFs abreviados)", () => {
    expect(PLANTILLAS_BASES["Concurso Público abreviado"]).toBeUndefined();
  });
});

describe("resolverPlantillaAmbigua", () => {
  const AMBIGUO = "Concurso Público para consultorías y servicios de mantenimiento vial";

  it("un procedimiento con plantilla directa la devuelve sin mirar variantes", () => {
    const r = resolverPlantillaAmbigua("Licitación Pública para bienes");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plantilla.proceso).toBe("Licitación Pública para bienes");
  });

  it("un procedimiento sin plantilla y sin variantes conocidas: sin_plantilla", () => {
    // Todavía no tiene plantilla propia: no confundir con las variantes de
    // VARIANTES_AMBIGUAS, que sí resuelven (ver los tests de esa constante).
    const r = resolverPlantillaAmbigua("Concurso Público con diálogo competitivo");
    expect(r).toEqual({ ok: false, motivo: "sin_plantilla" });
  });

  it("esProcesoAmbiguo identifica este grupo como ambiguo y un procedimiento con plantilla directa como no ambiguo", () => {
    expect(esProcesoAmbiguo(AMBIGUO)).toBe(true);
    expect(esProcesoAmbiguo("Licitación Pública para bienes")).toBe(false);
  });

  it("con 2+ variantes registradas y sin elegir, pide elección en vez de adivinar", () => {
    // Desde que se transcribió "consultoría de obra" hay dos variantes
    // registradas: el atajo de "una sola opción" ya no aplica, y sin
    // `variante` explícita la función debe pedir que se elija, no devolver
    // cualquiera de las dos al azar.
    expect(VARIANTES_AMBIGUAS[AMBIGUO].length).toBeGreaterThanOrEqual(2);
    const r = resolverPlantillaAmbigua(AMBIGUO);
    expect(r).toEqual({ ok: false, motivo: "ambiguo", variantes: VARIANTES_AMBIGUAS[AMBIGUO] });
  });

  it("una variante explícita válida se resuelve a esa plantilla concreta", () => {
    const general = resolverPlantillaAmbigua(AMBIGUO, "Concurso Público para consultoría en general");
    expect(general.ok).toBe(true);
    if (general.ok) expect(general.plantilla.proceso).toBe("Concurso Público para consultoría en general");

    const obra = resolverPlantillaAmbigua(AMBIGUO, "Concurso Público para consultoría de obra");
    expect(obra.ok).toBe(true);
    if (obra.ok) expect(obra.plantilla.proceso).toBe("Concurso Público para consultoría de obra");

    const vial = resolverPlantillaAmbigua(AMBIGUO, "Concurso Público para servicio de mantenimiento vial");
    expect(vial.ok).toBe(true);
    if (vial.ok) expect(vial.plantilla.proceso).toBe("Concurso Público para servicio de mantenimiento vial");
  });

  it("las tres variantes del grupo están registradas: la brecha de disambiguación queda completa", () => {
    expect(VARIANTES_AMBIGUAS[AMBIGUO]).toEqual([
      "Concurso Público para consultoría en general",
      "Concurso Público para consultoría de obra",
      "Concurso Público para servicio de mantenimiento vial",
    ]);
  });

  it("una variante que no pertenece a ese procedimiento ambiguo: variante_invalida", () => {
    const r = resolverPlantillaAmbigua(AMBIGUO, "Licitación Pública para bienes");
    expect(r).toEqual({ ok: false, motivo: "variante_invalida", variantes: VARIANTES_AMBIGUAS[AMBIGUO] });
  });

  it("«Concurso Público abreviado» con las 4 variantes registradas pide elección, no adivina", () => {
    const ABREVIADO = "Concurso Público abreviado";
    expect(esProcesoAmbiguo(ABREVIADO)).toBe(true);
    expect(VARIANTES_AMBIGUAS[ABREVIADO]).toEqual([
      "Concurso Público abreviado de servicios",
      "Concurso Público abreviado para consultoría en general",
      "Concurso Público abreviado para consultoría de obra",
      "Concurso Público abreviado para servicios de mantenimiento vial",
    ]);
    const r = resolverPlantillaAmbigua(ABREVIADO);
    expect(r).toEqual({ ok: false, motivo: "ambiguo", variantes: VARIANTES_AMBIGUAS[ABREVIADO] });
  });

  it("«Concurso Público abreviado» con variante explícita se resuelve a esa plantilla concreta", () => {
    const ABREVIADO = "Concurso Público abreviado";
    const servicios = resolverPlantillaAmbigua(ABREVIADO, "Concurso Público abreviado de servicios");
    expect(servicios.ok).toBe(true);
    if (servicios.ok) expect(servicios.plantilla.proceso).toBe("Concurso Público abreviado de servicios");

    const consultoriaGeneral = resolverPlantillaAmbigua(ABREVIADO, "Concurso Público abreviado para consultoría en general");
    expect(consultoriaGeneral.ok).toBe(true);
    if (consultoriaGeneral.ok) {
      expect(consultoriaGeneral.plantilla.proceso).toBe("Concurso Público abreviado para consultoría en general");
    }

    const consultoriaObra = resolverPlantillaAmbigua(ABREVIADO, "Concurso Público abreviado para consultoría de obra");
    expect(consultoriaObra.ok).toBe(true);
    if (consultoriaObra.ok) {
      expect(consultoriaObra.plantilla.proceso).toBe("Concurso Público abreviado para consultoría de obra");
    }

    const mantenimientoVial = resolverPlantillaAmbigua(ABREVIADO, "Concurso Público abreviado para servicios de mantenimiento vial");
    expect(mantenimientoVial.ok).toBe(true);
    if (mantenimientoVial.ok) {
      expect(mantenimientoVial.plantilla.proceso).toBe("Concurso Público abreviado para servicios de mantenimiento vial");
    }
  });

  it("las cuatro variantes del grupo «Concurso Público abreviado» están registradas: la brecha de disambiguación queda completa", () => {
    expect(VARIANTES_AMBIGUAS["Concurso Público abreviado"]).toEqual([
      "Concurso Público abreviado de servicios",
      "Concurso Público abreviado para consultoría en general",
      "Concurso Público abreviado para consultoría de obra",
      "Concurso Público abreviado para servicios de mantenimiento vial",
    ]);
  });

  it("«Concurso Público con precalificación» reutiliza las mismas tres plantillas del grupo sin abreviar", () => {
    // Confirmado en lib/procesos-seleccion.ts: su pdfBasesEstandar es
    // literalmente BASES_CONSULTORIA_VIAL, la MISMA constante que usa
    // "Concurso Público para consultorías y servicios de mantenimiento
    // vial" — el OECE no publicó una bases estándar propia para la variante
    // "con precalificación", así que no hizo falta transcribir un PDF nuevo.
    const PRECALIFICACION = "Concurso Público con precalificación";
    expect(esProcesoAmbiguo(PRECALIFICACION)).toBe(true);
    expect(VARIANTES_AMBIGUAS[PRECALIFICACION]).toEqual([
      "Concurso Público para consultoría en general",
      "Concurso Público para consultoría de obra",
      "Concurso Público para servicio de mantenimiento vial",
    ]);
    // Sin variante explícita, con 3 variantes registradas pide elección.
    const r = resolverPlantillaAmbigua(PRECALIFICACION);
    expect(r).toEqual({ ok: false, motivo: "ambiguo", variantes: VARIANTES_AMBIGUAS[PRECALIFICACION] });
  });

  it("«Concurso Público con precalificación» con variante explícita resuelve a la MISMA plantilla que su contraparte sin precalificación", () => {
    const PRECALIFICACION = "Concurso Público con precalificación";
    const viaPrecalificacion = resolverPlantillaAmbigua(PRECALIFICACION, "Concurso Público para consultoría de obra");
    const viaSm = resolverPlantillaAmbigua(AMBIGUO, "Concurso Público para consultoría de obra");
    expect(viaPrecalificacion.ok).toBe(true);
    expect(viaSm.ok).toBe(true);
    if (viaPrecalificacion.ok && viaSm.ok) {
      // Misma plantilla (mismo objeto, mismo PDF): no hay bases estándar
      // distinta para la variante "con precalificación".
      expect(viaPrecalificacion.plantilla).toBe(viaSm.plantilla);
    }
  });
});
