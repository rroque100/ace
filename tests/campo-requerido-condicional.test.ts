import { describe, expect, it } from "vitest";
import {
  avisosA1,
  avisosA3,
  campoEsRequerido,
  pasoF1,
  variablesClaveA4Faltantes,
  type CampoFormulario,
} from "@/lib/actuaciones-preparatorias";

// Hay obligaciones que solo nacen cuando se afirma algo antes. La versión del
// CMN es el caso: si se declara que la necesidad está incluida en el CMN, hay
// que decir en cuál —ese dato viaja como N° de CMN a la solicitud de
// certificación presupuestaria—; si no se declara, no hay versión que citar y
// exigirla sería absurdo.

const campoA1 = (name: string): CampoFormulario => {
  const c = pasoF1("A1")?.campos.find((x) => x.name === name);
  if (!c) throw new Error(`Campo inexistente en A1: ${name}`);
  return c;
};

describe("campoEsRequerido", () => {
  it("un obligatorio fijo lo es siempre, haya o no datos", () => {
    expect(campoEsRequerido(campoA1("en_cmn"), {})).toBe(true);
    expect(campoEsRequerido(campoA1("situacion_pac"), { en_cmn: false })).toBe(true);
  });

  it("la versión del CMN NO se exige mientras no se marque el check", () => {
    expect(campoEsRequerido(campoA1("version_cmn"), {})).toBe(false);
    expect(campoEsRequerido(campoA1("version_cmn"), { en_cmn: false })).toBe(false);
  });

  it("al marcar «la necesidad está incluida en el CMN», pasa a obligatoria", () => {
    expect(campoEsRequerido(campoA1("version_cmn"), { en_cmn: true })).toBe(true);
  });

  it("el check se compara como texto: llega como booleano, no como cadena", () => {
    // Es lo que rompería el condicional si se comparara con ===.
    expect(campoEsRequerido(campoA1("version_cmn"), { en_cmn: "true" })).toBe(true);
  });

  it("un campo sin condición ni obligatoriedad nunca bloquea", () => {
    expect(campoEsRequerido(campoA1("observaciones"), { en_cmn: true })).toBe(false);
  });

  it("admite varios valores que activan la exigencia", () => {
    const campo: CampoFormulario = {
      name: "x",
      label: "X",
      tipo: "text",
      requeridoSi: { campo: "otro", valor: ["si", "true"] },
    };
    expect(campoEsRequerido(campo, { otro: "si" })).toBe(true);
    expect(campoEsRequerido(campo, { otro: true })).toBe(true);
    expect(campoEsRequerido(campo, { otro: "no" })).toBe(false);
  });

  it("sin datos del paso no revienta: simplemente no se exige", () => {
    expect(campoEsRequerido(campoA1("version_cmn"), undefined)).toBe(false);
  });

  it("el campo se sigue VIENDO aunque no se exija: no es dependeDe", () => {
    // `dependeDe` oculta; `requeridoSi` solo cambia el nivel. Si la versión del
    // CMN desapareciera al desmarcar el check, no podría registrarse antes de
    // confirmarlo.
    expect(campoA1("version_cmn").dependeDe).toBeUndefined();
    expect(campoA1("version_cmn").requeridoSi).toEqual({ campo: "en_cmn", valor: "true" });
  });
});

// El Art. 42.3 contempla la contratación NO programada: la DEC la segmenta una
// vez que el área usuaria ha solicitado la modificación del CMN. A2 ya avisaba
// de que faltaba esa precondición, pero A1 —donde se declara la no
// programación— no pedía la constancia.
describe("A1 · contratación no programada", () => {
  it("el documento de modificación del CMN no se exige en una programada", () => {
    expect(campoEsRequerido(campoA1("documento_modificacion_cmn"), { situacion_pac: "programado" })).toBe(false);
  });

  it("se exige en cuanto se elige «No programado»", () => {
    expect(campoEsRequerido(campoA1("documento_modificacion_cmn"), { situacion_pac: "no_programado" })).toBe(true);
  });

  it("mientras no se responda, no se exige: no se pide antes de saber", () => {
    expect(campoEsRequerido(campoA1("documento_modificacion_cmn"), {})).toBe(false);
  });

  it("cita el artículo que lo sustenta", () => {
    expect(campoA1("documento_modificacion_cmn").baseLegal).toContain("42.3");
  });
});

// La programación ya no se pregunta con dos casillas que podían contradecirse
// ("¿está en el PAC?" y "¿es programada?"), sino con UN select obligatorio
// «Programado / No programado». Elegir «No programado» es una respuesta válida
// (Art. 42.3), no un vacío, y es lo que decide qué campos ve el usuario.
describe("A1 · un select gobierna las dos ramas de la programación", () => {
  it("es un select obligatorio con las dos opciones del Art. 42", () => {
    const c = campoA1("situacion_pac");
    expect(c.tipo).toBe("select");
    expect(c.required).toBe(true);
    expect((c.opciones ?? []).map((o) => o.value).sort()).toEqual(["no_programado", "programado"]);
  });

  it("los campos de la rama PROGRAMADA solo se ven al elegir «Programado»", () => {
    for (const name of ["referencia_pac", "procedimiento_pac", "trimestre", "mes_programado", "fecha_limite_requerimiento"]) {
      expect(campoA1(name).dependeDe, name).toEqual({ campo: "situacion_pac", valor: "programado" });
    }
  });

  it("el documento de modificación y el valor estimado solo se ven al elegir «No programado»", () => {
    for (const name of ["documento_modificacion_cmn", "valor_estimado"]) {
      expect(campoA1(name).dependeDe, name).toEqual({ campo: "situacion_pac", valor: "no_programado" });
    }
    // El valor estimado es una cifra en soles (moneda), no un documento.
    expect(campoA1("valor_estimado").tipo).toBe("number");
    expect(campoA1("valor_estimado").moneda).toBe(true);
  });

  it("el valor estimado es obligatorio en «No programado» y no se exige en «Programado»", () => {
    expect(campoEsRequerido(campoA1("valor_estimado"), { situacion_pac: "no_programado" })).toBe(true);
    expect(campoEsRequerido(campoA1("valor_estimado"), { situacion_pac: "programado" })).toBe(false);
    expect(campoEsRequerido(campoA1("valor_estimado"), {})).toBe(false);
  });

  it("el CMN y las observaciones quedan fuera del gate: se ven en ambas ramas", () => {
    for (const name of ["en_cmn", "version_cmn", "observaciones"]) {
      expect(campoA1(name).dependeDe, name).toBeUndefined();
    }
  });
});

describe("avisosA1 · las dos casillas de programación son el mismo hecho", () => {
  it("avisa si se dice que está en el PAC pero que no es programada", () => {
    const avisos = avisosA1({ en_pac: true, programada: false });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].mensaje).toContain("125.2");
  });

  it("avisa en el sentido contrario, remitiendo al 42.3", () => {
    const avisos = avisosA1({ en_pac: false, programada: true });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].mensaje).toContain("42.3");
  });

  it("no avisa cuando ambas coinciden", () => {
    expect(avisosA1({ en_pac: true, programada: true })).toEqual([]);
    expect(avisosA1({ en_pac: false, programada: false })).toEqual([]);
  });

  it("avisa si falta la respuesta directa a «¿es programada?»: no se presume en silencio", () => {
    // El fallback a `en_pac` existe para datos legados, pero un expediente sin
    // respuesta no debe actuar como programada calladamente: de `programada`
    // depende la línea de corte (125.2) y el orden A3→A2 (42.3).
    expect(avisosA1({ en_pac: true })[0].mensaje).toContain("42.3");
    expect(avisosA1({})).toHaveLength(1);
    expect(avisosA1(undefined)).toHaveLength(1);
    // Responder «No es programada» sí basta: no hay contradicción que señalar.
    expect(avisosA1({ programada: false })).toEqual([]);
  });

  it("ningún aviso bloquea: son datos que la entidad conoce mejor", () => {
    expect(avisosA1({ en_pac: true, programada: false })[0].nivel).toBe("warn");
  });
});

// Los contenidos "de corresponder" del Art. 44 no bloquean A3, pero dejarlos en
// blanco no se distingue de "no lo evalué". El aviso recuerda declararlos.
describe("avisosA3 · recuerda declarar los contenidos «de corresponder» del Art. 44", () => {
  it("avisa de riesgos (44.3) y normas técnicas (44.5) en blanco; no bloquea", () => {
    const av = avisosA3({ objeto_contractual: "servicio" });
    expect(av).toHaveLength(1);
    expect(av[0].nivel).toBe("warn");
    expect(av[0].mensaje).toContain("44.3");
    expect(av[0].mensaje).toContain("44.5");
  });

  it("las prestaciones accesorias (44.4) solo se piden en bienes y obras", () => {
    // Servicio: no aplica el 44.4 → no aparece en el aviso.
    expect(avisosA3({ objeto_contractual: "servicio" })[0].mensaje).not.toContain("44.4");
    // Bien: sí aplica.
    expect(avisosA3({ objeto_contractual: "bien" })[0].mensaje).toContain("44.4");
  });

  it("no avisa cuando los contenidos están llenos o declarados «No aplica»", () => {
    expect(
      avisosA3({
        objeto_contractual: "bien",
        riesgos_asignacion: "La entidad asume el riesgo cambiario.",
        prestaciones_accesorias: "No aplica",
        normas_tecnicas: "NTP 350.043",
      }),
    ).toEqual([]);
  });
});

// Las bases legales se MUESTRAN al usuario bajo cada campo: una cita falsa es
// peor que ninguna, porque se copia a un informe que alguien firma.
//
// Estas comprobaciones se contrastaron contra el texto indexado del Reglamento
// (D.S. 009-2025-EF), no contra lo que ya decía el código:
//
//   Art. 14.2.c — la DEC verifica que la necesidad "se encuentre debidamente
//                 registrada y aprobada en su CMN y sus modificaciones".
//   Art. 41     — las actuaciones preparatorias comprenden "desde la
//                 segmentación de contrataciones del PAC del CMN".
//   Art. 42     — SEGMENTACIÓN de contrataciones (no "programación"):
//     42.1  segmenta las contrataciones consideradas en el PAC del CMN, "con
//           excepción de aquellas que correspondan a contratos menores".
//     42.2  aprobado el CMN, la DEC informa la clasificación en categorías
//           "adjuntando un cronograma para la presentación de los requerimientos".
//     42.3  no planificadas: la DEC segmenta "una vez que el área usuaria haya
//           solicitado la modificación del CMN".
describe("A1 · las bases legales citan lo que el artículo dice", () => {
  it("la inclusión en el CMN se sustenta en el 14.2.c, que es quien la exige", () => {
    expect(campoA1("en_cmn").baseLegal).toContain("14.2.c");
  });

  it("la versión del CMN también: el 14.2.c dice «y sus modificaciones»", () => {
    // Antes citaba el 42.2, que trata del aviso de categorías y su cronograma.
    const base = campoA1("version_cmn").baseLegal ?? "";
    expect(base).toContain("14.2.c");
    expect(base).not.toContain("42.2");
  });

  it("la no programada cita el 42.3, y su documento también", () => {
    // El select de situación cita las dos ramas: 42.1 (programado) y 42.3 (no).
    const base = campoA1("situacion_pac").baseLegal ?? "";
    expect(base).toContain("42.1");
    expect(base).toContain("42.3");
    expect(campoA1("documento_modificacion_cmn").baseLegal).toContain("42.3");
  });

  it("el cronograma de presentación del requerimiento cita el 42.2", () => {
    expect(campoA1("fecha_limite_requerimiento").baseLegal).toContain("42.2");
  });

  it("los datos de periodificación NO citan artículo: los fija la directiva PMBSO", () => {
    // Citaban 42.1 y 42.2, que no hablan de trimestres, meses ni POI. Sin cita
    // es honesto; con una cita falsa, el campo miente al que lo lee.
    for (const name of ["periodo_programacion", "trimestre", "mes_programado", "poi_actividad"]) {
      expect(campoA1(name).baseLegal, name).toBeUndefined();
    }
  });

  it("el paso ya no presenta el Art. 42 como «programación»: es segmentación", () => {
    const paso = pasoF1("A1")!;
    expect(paso.nota).toContain("contratos menores");
    expect(paso.baseLegal).toContain("14.2.c");
    expect(paso.baseLegal).not.toContain("42 del Reglamento (programación");
  });
});

// A4: la estrategia no puede cerrarse sin a) el tipo de procedimiento ni s) la
// identificación del objetivo, que INCLUYE la gestión de riesgos (Art. 46.1.s).
// El resto de obligatorios de A4 no bloquea "Hecho"; estas dos sí.
describe("variablesClaveA4Faltantes · A4 no cierra sin a), e) ni s)", () => {
  it("faltan las tres (a, e-tipo, s) cuando A4 está vacío", () => {
    expect(variablesClaveA4Faltantes({}).map((x) => x.campo).sort()).toEqual([
      "var_a_proceso",
      "var_e_tipo_evaluador",
      "var_s_objetivo",
    ]);
    expect(variablesClaveA4Faltantes(undefined)).toHaveLength(3);
  });

  it("e) es condicional: sin tipo falta el TIPO; con tipo falta el PERFIL", () => {
    // Sin tipo de evaluador → lo que falta es el tipo, no el perfil.
    const sinTipo = variablesClaveA4Faltantes({ var_a_proceso: "LP", var_s_objetivo: "x" });
    expect(sinTipo.map((x) => x.campo)).toEqual(["var_e_tipo_evaluador"]);
    // Con tipo elegido pero sin perfil → falta el perfil.
    const conTipo = variablesClaveA4Faltantes({
      var_a_proceso: "LP",
      var_s_objetivo: "x",
      var_e_tipo_evaluador: "oficial_compra",
    });
    expect(conTipo.map((x) => x.campo)).toEqual(["var_e_perfil_evaluador"]);
    expect(conTipo[0].falta).toContain("perfil");
  });

  it("s) menciona la gestión de riesgos", () => {
    const f = variablesClaveA4Faltantes({ var_a_proceso: "LP", var_e_tipo_evaluador: "comite", var_e_perfil_evaluador: "p" });
    expect(f.map((x) => x.campo)).toEqual(["var_s_objetivo"]);
    expect(f[0].falta).toContain("gestión de riesgos");
  });

  it("con a), e) (tipo+perfil) y s) llenas no falta ninguna", () => {
    expect(
      variablesClaveA4Faltantes({
        var_a_proceso: "LP",
        var_e_tipo_evaluador: "oficial_compra",
        var_e_perfil_evaluador: "Sustento del perfil.",
        var_s_objetivo: "Riesgos: ...",
      }),
    ).toEqual([]);
  });

  it("los espacios en blanco cuentan como vacío", () => {
    expect(
      variablesClaveA4Faltantes({ var_a_proceso: "  ", var_e_tipo_evaluador: "comite", var_e_perfil_evaluador: "p", var_s_objetivo: "x" }).map((x) => x.campo),
    ).toEqual(["var_a_proceso"]);
  });
});
