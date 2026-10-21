import { describe, expect, it } from "vitest";
import {
  TIPOS_REQUISITO_ART72,
  componerRequisitos,
  formatRequisitos,
  parseRequisitos,
  repartirRequisitos,
  requisitosNormaDeNecesidad,
  tipoArt72DeNombre,
  type RequisitosCalificacion,
} from "@/lib/requisitos-calificacion";

const ejemplo: RequisitosCalificacion = {
  obligatorios: ["Capacidad legal", "Experiencia del postor en la especialidad"],
  facultativos: [
    { nombre: "Capacidad técnica y profesional", sustento: "Se requiere personal especializado" },
    { nombre: "Condiciones de participación en consorcio", sustento: "" },
  ],
};

describe("requisitos-calificacion · format/parse", () => {
  it("serializa con los encabezados oficiales y el sustento", () => {
    const texto = formatRequisitos(ejemplo);
    expect(texto).toContain("OBLIGATORIOS:");
    expect(texto).toContain("- Capacidad legal");
    expect(texto).toContain("FACULTATIVOS:");
    expect(texto).toContain("- Capacidad técnica y profesional — Sustento: Se requiere personal especializado");
  });

  it("hace round-trip sin perder datos", () => {
    const round = parseRequisitos(formatRequisitos(ejemplo));
    expect(round).toEqual(ejemplo);
  });

  it("omite entradas sin nombre al serializar", () => {
    const texto = formatRequisitos({
      obligatorios: ["Capacidad legal", "  "],
      facultativos: [{ nombre: "", sustento: "algo" }],
    });
    expect(texto).toBe("OBLIGATORIOS:\n- Capacidad legal");
  });

  it("texto vacío → estructura vacía", () => {
    expect(parseRequisitos("")).toEqual({ obligatorios: [], facultativos: [] });
    expect(parseRequisitos(null)).toEqual({ obligatorios: [], facultativos: [] });
    expect(formatRequisitos({ obligatorios: [], facultativos: [] })).toBe("");
  });

  it("compatibilidad: texto libre heredado se lee como obligatorios", () => {
    const r = parseRequisitos("Experiencia mínima de 3 años\n- RNP vigente");
    expect(r.obligatorios).toEqual(["Experiencia mínima de 3 años", "RNP vigente"]);
    expect(r.facultativos).toEqual([]);
  });

  it("facultativo sin sustento se parsea con sustento vacío", () => {
    const r = parseRequisitos("FACULTATIVOS:\n- Capacidad económica");
    expect(r.facultativos).toEqual([{ nombre: "Capacidad económica", sustento: "" }]);
  });
});

// El Art. 72.3 es una lista cerrada de cinco tipos. El editor los ofrece como
// casillas; este mapeo es lo que reconoce lo ya guardado (texto canónico o
// heredado) y lo coloca en su tipo.
describe("tipoArt72DeNombre", () => {
  it("solo existen los cinco tipos del 72.3", () => {
    expect(TIPOS_REQUISITO_ART72).toHaveLength(5);
    // Orden: capacidad_tecnica va tras experiencia_postor y antes de consorcio
    // (decisión de la entidad; en la ficha se agrupa en 3.5.2 con la letra C).
    expect(TIPOS_REQUISITO_ART72.map((t) => t.key)).toEqual([
      "capacidad_legal",
      "experiencia_postor",
      "capacidad_tecnica",
      "consorcio",
      "capacidad_economica",
    ]);
  });

  it("reconoce cada tipo por su etiqueta exacta", () => {
    for (const tipo of TIPOS_REQUISITO_ART72) {
      expect(tipoArt72DeNombre(tipo.label)).toBe(tipo.key);
    }
  });

  it("tolera acentos, mayúsculas y espacios", () => {
    expect(tipoArt72DeNombre("CAPACIDAD LEGAL")).toBe("capacidad_legal");
    expect(tipoArt72DeNombre("capacidad economica")).toBe("capacidad_economica");
    expect(tipoArt72DeNombre("  Experiencia del postor en la especialidad  ")).toBe(
      "experiencia_postor",
    );
  });

  it("tolera la acotación entre paréntesis del valor heredado", () => {
    // Antes se guardaba "Capacidad económica (solo con precalificación)".
    expect(tipoArt72DeNombre("Capacidad económica (solo con precalificación)")).toBe(
      "capacidad_economica",
    );
  });

  // Los valores en texto libre no deben mapearse a la fuerza: el editor los
  // muestra aparte para que el usuario los corrija, en vez de descartarlos.
  it("devuelve null para lo que no es un tipo del 72.3", () => {
    expect(tipoArt72DeNombre("RNP vigente")).toBeNull();
    expect(tipoArt72DeNombre("Certificación ISO 9001")).toBeNull();
    expect(tipoArt72DeNombre("")).toBeNull();
  });
});

// Al cerrar la lista a los 5 tipos del 72.3, el riesgo es tirar datos que ya
// estaban guardados como texto libre. Estos tests fijan que eso no pase.
describe("repartirRequisitos / componerRequisitos", () => {
  const round = (texto: string) => componerRequisitos(repartirRequisitos(parseRequisitos(texto)));

  it("coloca cada tipo del 72.3 en su casilla, con su naturaleza", () => {
    const r = repartirRequisitos(
      parseRequisitos(
        "OBLIGATORIOS:\n- Capacidad legal\n\nFACULTATIVOS:\n- Capacidad económica — Sustento: alto monto",
      ),
    );
    expect(r.porTipo.get("capacidad_legal")).toEqual({
      estado: "obligatorio",
      detalle: "",
      acreditacion: "",
      sustento: "",
    });
    expect(r.porTipo.get("capacidad_economica")).toEqual({
      estado: "facultativo",
      detalle: "",
      acreditacion: "",
      sustento: "alto monto",
    });
    // Lo no marcado simplemente no está.
    expect(r.porTipo.has("consorcio")).toBe(false);
    expect(r.otrosObligatorios).toEqual([]);
  });

  it("los valores heredados que no son del 72.3 se conservan aparte", () => {
    const r = repartirRequisitos(parseRequisitos("RNP vigente\n- Certificación ISO 9001"));
    expect(r.otrosObligatorios).toEqual(["RNP vigente", "Certificación ISO 9001"]);
    expect(r.porTipo.size).toBe(0);
  });

  it("editar NO borra los heredados: sobreviven al round-trip", () => {
    const original = "OBLIGATORIOS:\n- Capacidad legal\n- RNP vigente";
    const texto = round(original);
    expect(texto).toContain("Capacidad legal");
    expect(texto).toContain("RNP vigente"); // el que no es del 72.3 sigue ahí
  });

  it("round-trip estable: componer(repartir(x)) no deriva al repetirse", () => {
    const texto = "OBLIGATORIOS:\n- Capacidad legal\n- RNP vigente\n\nFACULTATIVOS:\n- Capacidad técnica y profesional — Sustento: personal especializado";
    const una = round(texto);
    expect(round(una)).toBe(una);
  });

  it("normaliza el nombre al canónico del 72.3", () => {
    // Entra en minúsculas y sin acentos; sale con la etiqueta oficial.
    expect(round("OBLIGATORIOS:\n- capacidad economica")).toContain("Capacidad económica");
  });

  it("respeta el orden del 72.3 aunque se guarde desordenado", () => {
    const texto = round("OBLIGATORIOS:\n- Capacidad económica\n- Capacidad legal");
    expect(texto.indexOf("Capacidad legal")).toBeLessThan(texto.indexOf("Capacidad económica"));
  });

  it("vacío se mantiene vacío", () => {
    expect(round("")).toBe("");
  });
});

// El 72.3 fija el TIPO, pero no su contenido: "Capacidad legal" sin detalle no
// es acreditable. El detalle se guarda como "Tipo: detalle" dentro del mismo
// formato canónico, sin migrar nada.
describe("detalle del requisito", () => {
  const round = (texto: string) => componerRequisitos(repartirRequisitos(parseRequisitos(texto)));

  it("separa el tipo de su detalle al leer", () => {
    const r = repartirRequisitos(
      parseRequisitos("OBLIGATORIOS:\n- Capacidad legal: RNP vigente en bienes"),
    );
    expect(r.porTipo.get("capacidad_legal")).toEqual({
      estado: "obligatorio",
      detalle: "RNP vigente en bienes",
      acreditacion: "",
      sustento: "",
    });
    expect(r.otrosObligatorios).toEqual([]);
  });

  it("un facultativo lleva detalle Y sustento, que son cosas distintas", () => {
    const texto =
      "FACULTATIVOS:\n- Capacidad económica: liquidez > 1.0 — Sustento: contrato de alto monto";
    const r = repartirRequisitos(parseRequisitos(texto));
    expect(r.porTipo.get("capacidad_economica")).toEqual({
      estado: "facultativo",
      detalle: "liquidez > 1.0",
      acreditacion: "",
      sustento: "contrato de alto monto",
    });
    expect(round(texto)).toBe(texto); // round-trip exacto
  });

  it("sin detalle se guarda solo el tipo (no deja dos puntos colgando)", () => {
    expect(round("OBLIGATORIOS:\n- Capacidad legal")).toBe("OBLIGATORIOS:\n- Capacidad legal");
  });

  it("el detalle sobrevive al round-trip repetido", () => {
    const texto = "OBLIGATORIOS:\n- Experiencia del postor en la especialidad: S/ 180,000 en 5 años";
    const una = round(texto);
    expect(una).toContain("S/ 180,000 en 5 años");
    expect(round(una)).toBe(una);
  });

  // El texto libre heredado no tiene "Tipo: detalle": no debe partirse por un
  // ":" cualquiera ni acabar mapeado a un tipo que no es.
  it("el texto libre con dos puntos NO se fuerza a un tipo", () => {
    const r = repartirRequisitos(parseRequisitos("OBLIGATORIOS:\n- Plazo: 30 días"));
    expect(r.porTipo.size).toBe(0);
    expect(r.otrosObligatorios).toEqual(["Plazo: 30 días"]);
  });
});

// Art. 72.1: el cumplimiento del requisito "es acreditado conforme indiquen las
// bases". La acreditación (con QUÉ se prueba) es un tercer dato, distinto del
// detalle (QUÉ se exige) y del sustento (POR QUÉ). Aplica a obligatorios y
// facultativos, y se codifica como segmento "— Acredita:" del texto canónico.
describe("acreditación del requisito", () => {
  const round = (texto: string) => componerRequisitos(repartirRequisitos(parseRequisitos(texto)));

  it("el obligatorio lleva acreditación pese a no tener campo propio", () => {
    const texto = "OBLIGATORIOS:\n- Capacidad legal: RNP en bienes — Acredita: copia del RNP vigente";
    const r = repartirRequisitos(parseRequisitos(texto));
    expect(r.porTipo.get("capacidad_legal")).toEqual({
      estado: "obligatorio",
      detalle: "RNP en bienes",
      acreditacion: "copia del RNP vigente",
      sustento: "",
    });
    expect(round(texto)).toBe(texto); // round-trip exacto
  });

  it("un facultativo separa detalle, acreditación y sustento", () => {
    const texto =
      "FACULTATIVOS:\n- Capacidad económica: liquidez > 1.0 — Acredita: EE.FF. auditados — Sustento: alto monto";
    const r = repartirRequisitos(parseRequisitos(texto));
    expect(r.porTipo.get("capacidad_economica")).toEqual({
      estado: "facultativo",
      detalle: "liquidez > 1.0",
      acreditacion: "EE.FF. auditados",
      sustento: "alto monto",
    });
    expect(round(texto)).toBe(texto);
  });

  it("tolera el orden inverso Sustento antes que Acredita", () => {
    const r = parseRequisitos(
      "FACULTATIVOS:\n- Capacidad económica — Sustento: alto monto — Acredita: EE.FF. auditados",
    );
    expect(r.facultativos).toEqual([
      { nombre: "Capacidad económica", acreditacion: "EE.FF. auditados", sustento: "alto monto" },
    ]);
  });

  it("la acreditación sobrevive al round-trip repetido", () => {
    const texto = "OBLIGATORIOS:\n- Experiencia del postor en la especialidad: S/ 180,000 — Acredita: contratos con conformidad";
    const una = round(texto);
    expect(una).toContain("Acredita: contratos con conformidad");
    expect(round(una)).toBe(una);
  });

  it("sin acreditación no deja el segmento colgando", () => {
    expect(round("OBLIGATORIOS:\n- Capacidad legal: RNP vigente")).toBe(
      "OBLIGATORIOS:\n- Capacidad legal: RNP vigente",
    );
  });
});

// Los campos admiten TEXTO DE PÁRRAFO (varias líneas). El formato canónico
// delimita requisitos por "\n", así que un salto DENTRO de un campo se codifica
// al serializar y se restaura al parsear: no debe partir el requisito en dos ni
// perderse.
describe("texto de párrafo en los campos", () => {
  it("un detalle multilínea sobrevive el round-trip como un solo requisito", () => {
    const detalle = "Primer párrafo del requisito.\nSegundo párrafo con más contexto.";
    const estructura: RequisitosCalificacion = {
      obligatorios: [`Capacidad legal: ${detalle}`],
      facultativos: [],
    };
    const texto = formatRequisitos(estructura);
    // El texto canónico tiene UNA línea de requisito (más el encabezado), no
    // una por cada párrafo: el salto interno no cuenta como delimitador.
    expect(texto.split("\n")).toEqual(["OBLIGATORIOS:", expect.stringContaining("Capacidad legal")]);
    expect(parseRequisitos(texto)).toEqual(estructura);
  });

  it("detalle y acreditación multilínea llegan enteros a repartirRequisitos", () => {
    const texto = formatRequisitos({
      obligatorios: ["Capacidad económica: Ratio de liquidez.\nSegún EE.FF. — Acredita: Estados financieros.\nDel último ejercicio."],
      facultativos: [],
    });
    const r = repartirRequisitos(parseRequisitos(texto));
    expect(r.porTipo.get("capacidad_economica")).toEqual({
      estado: "obligatorio",
      detalle: "Ratio de liquidez.\nSegún EE.FF.",
      acreditacion: "Estados financieros.\nDel último ejercicio.",
      sustento: "",
    });
  });

  it("un facultativo multilínea conserva sus tres campos con saltos", () => {
    const estructura: RequisitosCalificacion = {
      obligatorios: [],
      facultativos: [
        {
          nombre: "Capacidad técnica y profesional: Un ingeniero.\nCon 3 años.",
          acreditacion: "CV documentado.\nCon títulos.",
          sustento: "Alta complejidad.\nExige experto.",
        },
      ],
    };
    expect(parseRequisitos(formatRequisitos(estructura))).toEqual(estructura);
  });

  it("no quedan saltos crudos dentro de una línea del texto canónico", () => {
    const texto = formatRequisitos({
      obligatorios: ["Capacidad legal: línea 1\nlínea 2"],
      facultativos: [{ nombre: "Capacidad económica", acreditacion: "a\nb", sustento: "c\nd" }],
    });
    // Ninguna línea de requisito (viñeta) debe partirse: exactamente 2 viñetas.
    const vinetas = texto.split("\n").filter((l) => l.startsWith("- "));
    expect(vinetas).toHaveLength(2);
  });
});

// Garantía para la sección b) del requerimiento (Art. 44.2.b): TODOS los
// subcampos de los 5 tipos —estado, detalle, acreditación y sustento— se
// guardan y se recuperan sin pérdida, incluso con texto largo de varios
// párrafos como el de las bases estándar.
describe("sección b): ningún subcampo se pierde al guardar", () => {
  const completo: RequisitosCalificacion = {
    obligatorios: [
      "Capacidad legal: Habilitación del objeto.\nSegundo párrafo. — Acredita: RNP vigente.\nCopia simple.",
      "Experiencia del postor en la especialidad: Facturación S/200,000.\nEn 10 años. — Acredita: Contratos con conformidad.\nO comprobantes cancelados.",
      "Condiciones de participación en consorcio: Máximo 2 integrantes.\n40% mínimo. — Acredita: Promesa de consorcio.",
    ],
    facultativos: [
      { nombre: "Capacidad técnica y profesional: Un ingeniero.\nCon 3 años.", acreditacion: "CV documentado.\nCon títulos.", sustento: "Alta complejidad.\nExige experto." },
      { nombre: "Capacidad económica: Liquidez > 1.0.\nÚltimo ejercicio.", acreditacion: "EE.FF. auditados.\nDel último año.", sustento: "Alto monto.\nRiesgo financiero." },
    ],
  };

  it("los 5 tipos recuperan cada subcampo que les corresponde", () => {
    const r = repartirRequisitos(parseRequisitos(formatRequisitos(completo)));
    // Obligatorios: detalle + acreditación (sin sustento, que es solo facultativo).
    for (const key of ["capacidad_legal", "experiencia_postor", "consorcio"] as const) {
      const e = r.porTipo.get(key)!;
      expect(e.estado, key).toBe("obligatorio");
      expect(e.detalle.trim().length, `${key}.detalle`).toBeGreaterThan(0);
      expect(e.acreditacion.trim().length, `${key}.acreditacion`).toBeGreaterThan(0);
    }
    // Facultativos: detalle + acreditación + sustento.
    for (const key of ["capacidad_tecnica", "capacidad_economica"] as const) {
      const e = r.porTipo.get(key)!;
      expect(e.estado, key).toBe("facultativo");
      expect(e.detalle.trim().length, `${key}.detalle`).toBeGreaterThan(0);
      expect(e.acreditacion.trim().length, `${key}.acreditacion`).toBeGreaterThan(0);
      expect(e.sustento.trim().length, `${key}.sustento`).toBeGreaterThan(0);
    }
  });

  it("guardar → editar → guardar es idéntico (no deriva ni pierde nada)", () => {
    const texto = formatRequisitos(completo);
    const round = componerRequisitos(repartirRequisitos(parseRequisitos(texto)));
    expect(round).toBe(texto);
    // Y estable al repetir el ciclo.
    expect(componerRequisitos(repartirRequisitos(parseRequisitos(round)))).toBe(round);
  });
});

// f) de la estrategia (A4): al traer datos, NO se copia el texto libre del
// requerimiento; se traen SOLO los tipos del 72.3 marcados, con su cita legal.
describe("requisitosNormaDeNecesidad (cita legal por tipo marcado)", () => {
  const nec = [
    "OBLIGATORIOS:",
    "- Experiencia del postor en la especialidad: facturación S/200,000 — Acredita: contratos con conformidad",
    "- Condiciones de participación en consorcio: máx 2 integrantes",
    "FACULTATIVOS:",
    "- Capacidad económica: liquidez > 1.0 — Sustento: alto monto",
  ].join("\n");

  it("conserva los tipos marcados con su naturaleza y les pone la cita legal", () => {
    const out = requisitosNormaDeNecesidad(nec, "bienes");
    expect(out).toContain("OBLIGATORIOS:");
    expect(out).toContain("Experiencia del postor en la especialidad: Art. 72.3");
    expect(out).toContain("Condiciones de participación en consorcio: Art. 72.3");
    expect(out).toContain("FACULTATIVOS:");
    expect(out).toContain("Capacidad económica: Art. 72.3");
  });

  it("descarta el texto libre, la acreditación y el sustento del requerimiento", () => {
    const out = requisitosNormaDeNecesidad(nec, "bienes");
    expect(out).not.toContain("facturación S/200,000");
    expect(out).not.toContain("contratos con conformidad");
    expect(out).not.toContain("liquidez > 1.0");
    expect(out).not.toContain("alto monto");
  });

  it("en obras añade el Art. 157 a capacidad técnica y experiencia", () => {
    const enObra = requisitosNormaDeNecesidad(
      "OBLIGATORIOS:\n- Experiencia del postor en la especialidad: X\n- Capacidad legal: Y",
      "obras",
    );
    // La experiencia añade el 157; la capacidad legal no.
    expect(enObra).toMatch(/Experiencia del postor en la especialidad:[^\n]*Art\. 157/);
    expect(enObra).toMatch(/Capacidad legal: Art\. 72\.3 del Reglamento de la Ley N° 32069\.\n?/);
  });

  it("descarta valores heredados que no son del 72.3 y devuelve vacío si no hay tipos", () => {
    expect(requisitosNormaDeNecesidad("RNP vigente\n- Certificación ISO 9001", "bienes")).toBe("");
    expect(requisitosNormaDeNecesidad("", "bienes")).toBe("");
  });
});

describe("las ayudas del editor no contradicen al requerimiento modelo", () => {
  const tipo = (key: string) => {
    const t = TIPOS_REQUISITO_ART72.find((x) => x.key === key);
    if (!t) throw new Error(`Falta el tipo ${key}`);
    return t;
  };

  it("la experiencia del postor lleva los dos topes del formato", () => {
    // El ejemplo decía «en los últimos 5 años», que es del régimen anterior: el
    // modelo de Concurso Público de servicios cuenta QUINCE años y limita el
    // monto facturado a tres veces la cuantía.
    expect(tipo("experiencia_postor").ayuda).toMatch(/TRES VECES/);
    expect(tipo("experiencia_postor").ayuda).toMatch(/QUINCE/);
    expect(tipo("experiencia_postor").ejemplo).not.toMatch(/5 a[ñn]os/);
  });

  it("la capacidad legal solo se exige si la normativa del objeto la pide", () => {
    expect(tipo("capacidad_legal").ayuda).toMatch(/si no la pide/i);
  });

  it("en formación académica solo cabe el grado o título", () => {
    expect(tipo("capacidad_tecnica").ayuda).toMatch(/GRADO/);
  });
});
