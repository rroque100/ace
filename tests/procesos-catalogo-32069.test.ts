import { describe, expect, it } from "vitest";
import { LEY_32069_PROCESOS_CATALOGO as CATALOGO } from "@/lib/procesos-catalogo-32069";
import { PROCESOS_SELECCION } from "@/lib/procesos-seleccion";

// El catálogo de procedimientos venía de una lista escrita a mano que resultó ser
// del régimen DEROGADO: "Adjudicación Simplificada" y "Adjudicación Directa" son
// vocabulario de la Ley 30225, y sus citas legales no correspondían a ningún
// artículo real (decía "Licitación Pública, Art. 22" cuando el Art. 22 son los
// requisitos para designar al jefe de Perú Compras). Estos tests fijan lo que la
// Ley 32069 y su Reglamento SÍ establecen.

describe("el catálogo no reintroduce el régimen derogado", () => {
  const DEROGADO = [
    /adjudicaci[oó]n\s+simplificada/i,
    /adjudicaci[oó]n\s+directa/i,
    /\bley\s*30225\b/i,
    /menor\s+cuant[ií]a/i,
  ];

  for (const proceso of CATALOGO) {
    it(`${proceso.code}: sin vocabulario de la 30225`, () => {
      const texto = `${proceso.label} ${proceso.legalBasis} ${proceso.description} ${proceso.object}`;
      for (const patron of DEROGADO) {
        expect(texto, `«${proceso.label}» usa ${patron}`).not.toMatch(patron);
      }
    });
  }
});

describe("cada procedimiento cita el artículo que de verdad lo sostiene", () => {
  const ARTICULOS_VALIDOS = [
    /Art\.\s*54\.1\.a/, // licitación pública — bienes y obras
    /Art\.\s*54\.1\.b/, // concurso público — servicios
    /Art\.\s*95/, // otras modalidades diferenciadas (Reglamento)
    /Art\.\s*55/, // procedimiento de selección no competitivo
  ];

  for (const proceso of CATALOGO) {
    it(`${proceso.code}: su base legal es uno de los cuatro artículos`, () => {
      expect(
        ARTICULOS_VALIDOS.some((a) => a.test(proceso.legalBasis)),
        `«${proceso.label}» cita «${proceso.legalBasis}»`,
      ).toBe(true);
    });
  }

  it("la licitación pública se sostiene en el 54.1.a y el concurso en el 54.1.b", () => {
    for (const p of CATALOGO) {
      if (p.label.startsWith("Licitación Pública")) expect(p.legalBasis).toMatch(/54\.1\.a/);
      if (p.label.startsWith("Concurso Público")) expect(p.legalBasis).toMatch(/54\.1\.b/);
    }
  });
});

describe("las otras modalidades diferenciadas son las cinco del Art. 95", () => {
  // El Art. 95 del Reglamento las enumera en una tabla: compra pública
  // precomercial, asociación para la innovación, subasta inversa electrónica,
  // comparación de precios y concurso de proyectos arquitectónicos y urbanísticos.
  const CINCO = [
    "Asociación para la Innovación",
    "Comparación de Precios",
    "Compra Pública Precomercial",
    "Concurso de Proyectos Arquitectónicos y Urbanísticos",
    "Subasta Inversa Electrónica",
  ];

  it("están las cinco, y ninguna de más bajo ese artículo", () => {
    const delArt95 = CATALOGO.filter((p) => /Art\.\s*95/.test(p.legalBasis)).map((p) => p.label);
    expect([...delArt95].sort()).toEqual([...CINCO].sort());
  });
});

describe("el no competitivo es UNO, no uno por causal", () => {
  it("hay exactamente un procedimiento no competitivo", () => {
    // El Art. 55.1 lista once supuestos (a-k) para contratar directamente, pero
    // son CAUSALES de un mismo procedimiento. Desglosarlos sería repetir el error
    // del catálogo derogado, que hacía una "Adjudicación Directa" por causal.
    const noCompetitivos = CATALOGO.filter((p) => p.category === "no_competitivo");
    expect(noCompetitivos).toHaveLength(1);
    expect(noCompetitivos[0]?.label).toBe("Procedimiento de Selección No Competitivo");
  });

  it("el contrato menor NO está: la ley dice que no requiere procedimiento", () => {
    // Art. 34.1: los contratos menores "no requieren procedimientos de selección
    // para su contratación".
    expect(CATALOGO.some((p) => /contrato\s+menor/i.test(p.label))).toBe(false);
  });
});

describe("una sola fuente", () => {
  it("el catálogo se deriva de PROCESOS_SELECCION, sin inventar entradas", () => {
    const delSelector = PROCESOS_SELECCION.filter((p) => p.value !== "").map((p) => p.label);
    expect(CATALOGO.map((p) => p.label)).toEqual(delSelector);
  });

  it("los códigos son únicos: son la clave con la que se guarda", () => {
    const codigos = CATALOGO.map((p) => p.code);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(codigos.every((c) => /^[a-z0-9_]+$/.test(c))).toBe(true);
  });
});

describe("la lista es la de las tablas del Reglamento, no una lista propia", () => {
  // Los Arts. 93, 94 y 95 enumeran los procedimientos en tablas con las columnas
  // «Tipo de procedimiento», «Modalidad» y «Condiciones para su uso». El catálogo
  // salía antes de los NOMBRES DE LOS PDF-MODELO, que son plantillas operativas:
  // partía una fila del Art. 94 en seis y dejaba fuera ocho tipos.
  const REALES = PROCESOS_SELECCION.filter((p) => p.value !== "");

  it("el Art. 93 aporta los nueve tipos de licitación pública", () => {
    const art93 = REALES.filter((p) => /Art\.\s*93/.test(p.articulo)).map((p) => p.value);
    expect(art93).toEqual([
      "Licitación Pública para bienes",
      "Licitación Pública para bienes especializados",
      "Licitación Pública abreviada para bienes",
      "Licitación Pública de obras",
      "Licitación Pública de obras con precalificación",
      "Licitación Pública abreviada de obras",
      "Licitación Pública con diálogo competitivo",
      "Licitación Pública de obras con negociación",
      "Licitación Pública para mecanismos diferenciados de adquisición (MDA)",
    ]);
  });

  it("el Art. 94 aporta los seis tipos de concurso público", () => {
    const art94 = REALES.filter((p) => /Art\.\s*94/.test(p.articulo)).map((p) => p.value);
    expect(art94).toEqual([
      "Concurso Público de servicios",
      "Concurso Público para consultorías y servicios de mantenimiento vial",
      "Concurso Público abreviado",
      "Concurso Público con precalificación",
      "Concurso Público con diálogo competitivo",
      "Concurso Público abreviado para la contratación de expertos y gerentes de proyectos",
    ]);
  });

  it("consultorías y mantenimiento vial son UN procedimiento, no seis", () => {
    // El Art. 94 los junta en una sola fila. Tenerlos separados hacía que la
    // ficha ofreciera procedimientos que no existen con ese nombre.
    const partidos = REALES.filter((p) =>
      /consultor[ií]a en general|consultor[ií]a de obra\b|^Concurso Público Abreviado de Servicios$/i.test(p.value),
    );
    expect(partidos).toEqual([]);
  });

  it("el concurso abreviado para expertos y gerentes de proyectos existe y es uno solo", () => {
    // Art. 94: gerentes de proyecto del Art. 223 y evaluadores expertos del
    // Art. 57. Estaban en el catálogo de Configuración partidos en dos.
    const expertos = REALES.filter((p) => /expertos|gerentes/i.test(p.value));
    expect(expertos).toHaveLength(1);
    expect(expertos[0].modalidad).toBe("abreviada");
  });

  it("todo procedimiento de los Arts. 93 y 94 declara su modalidad", () => {
    for (const p of REALES.filter((x) => /Art\.\s*9[34]/.test(x.articulo))) {
      expect(["sm", "abreviada", "diferenciada"], p.value).toContain(p.modalidad);
    }
  });

  it("todo procedimiento dice cuándo se usa", () => {
    for (const p of REALES) {
      expect(p.condiciones.length, `«${p.value}» sin condiciones de uso`).toBeGreaterThan(30);
    }
  });

  it("un modelo puede servir a varios procedimientos, y al revés", () => {
    // La tipología legal es más gruesa que las plantillas de la entidad.
    const vial = REALES.find(
      (p) => p.value === "Concurso Público para consultorías y servicios de mantenimiento vial",
    );
    expect(vial?.pdfs).toHaveLength(3);
    const obras = REALES.filter((p) => p.pdfs?.includes("REQUERIMIENTO LICITACIÓN PÚBLICA DE OBRAS.pdf"));
    expect(obras.length).toBeGreaterThan(1);
  });
});

describe("Cuadro N° 7 · evaluadores admisibles por proceso", () => {
  it("cada proceso competitivo del catálogo tiene su fila en el Cuadro N° 7", async () => {
    const { PROCESOS_COMPETITIVOS_OPCIONES, EVALUADORES_POR_PROCESO } = await import("@/lib/procesos-seleccion");
    for (const p of PROCESOS_COMPETITIVOS_OPCIONES) {
      const admisibles = EVALUADORES_POR_PROCESO[p.value];
      expect(admisibles, `falta el evaluador de "${p.value}"`).toBeTruthy();
      expect(admisibles!.length, p.value).toBeGreaterThan(0);
    }
  });

  it("respeta las filas verificadas del PDF (oficial/comité/jurado)", async () => {
    const { evaluadoresAdmisibles } = await import("@/lib/procesos-seleccion");
    expect(evaluadoresAdmisibles("Licitación Pública abreviada para bienes")).toEqual(["oficial_compra", "comite"]);
    expect(evaluadoresAdmisibles("Licitación Pública de obras")).toEqual(["comite", "jurado"]);
    expect(evaluadoresAdmisibles("Subasta Inversa Electrónica")).toEqual(["oficial_compra"]);
    expect(evaluadoresAdmisibles("Comparación de Precios")).toEqual(["oficial_compra"]);
    expect(evaluadoresAdmisibles("Concurso Público con diálogo competitivo")).toEqual(["jurado"]);
    expect(
      evaluadoresAdmisibles("Concurso Público abreviado para la contratación de expertos y gerentes de proyectos"),
    ).toEqual(["comite"]);
    // Fuera del cuadro (no competitivo / desconocido): sin restricción.
    expect(evaluadoresAdmisibles("Procedimiento de Selección No Competitivo")).toEqual([]);
    expect(evaluadoresAdmisibles("")).toEqual([]);
  });
});
