import { describe, expect, it } from "vitest";
import {
  avisoJPRD,
  componerControversias,
  faltaDesignarInstitucion,
  PARRAFO_CONTROVERSIAS,
  parseInstituciones,
  TEXTO_ESTANDAR_CONTROVERSIAS,
  textoLibreControversias,
} from "@/lib/instituciones-arbitrales";

// Apartado i) del requerimiento: el texto de solución de controversias se guarda
// en una sola columna, con el cuadro de instituciones embebido como tabla
// Markdown. El editor lo COMPONE al escribir y lo vuelve a LEER al abrir, así que
// componer→parsear tiene que dar la vuelta completa.
describe("instituciones-arbitrales · serializador del apartado i)", () => {
  it("el texto del apartado es editable; el estándar trae el párrafo y el encabezado", () => {
    // Sin texto ni instituciones no compone nada (el compositor ya no añade el
    // párrafo por su cuenta: vive en el texto editable).
    expect(componerControversias([], "")).toBe("");
    // El texto estándar (que carga el botón «Insertar texto estándar»).
    expect(TEXTO_ESTANDAR_CONTROVERSIAS).toContain("330 y 331");
    expect(TEXTO_ESTANDAR_CONTROVERSIAS).toContain("artículo 332");
    // Compuesto: texto estándar arriba, tabla debajo, sin duplicar.
    const texto = componerControversias(
      [{ nombre: "Cámara de Comercio de Lima", ruc: "20101266819" }],
      TEXTO_ESTANDAR_CONTROVERSIAS,
    );
    expect(texto.startsWith(TEXTO_ESTANDAR_CONTROVERSIAS)).toBe(true);
    expect(texto).toContain("| N.º | Institución arbitral | RUC |");
    expect(parseInstituciones(texto)).toEqual([
      { nombre: "Cámara de Comercio de Lima", ruc: "20101266819" },
    ]);
    // El texto estándar se recupera una sola vez (no se mezcla con la tabla).
    expect(textoLibreControversias(texto)).toBe(TEXTO_ESTANDAR_CONTROVERSIAS);
  });

  it("round-trip: parsear lo que se compone devuelve las mismas instituciones", () => {
    const inst = [
      { nombre: "Cámara de Comercio de Lima", ruc: "20112273922" },
      { nombre: "Centro de Análisis y Resolución de Conflictos PUCP", ruc: "" },
    ];
    const texto = componerControversias(inst, "");
    expect(parseInstituciones(texto)).toEqual(inst);
    // El cuadro va como tabla Markdown.
    expect(texto).toContain("| N.º | Institución arbitral | RUC |");
    // Un RUC vacío se marca como pendiente, no se inventa.
    expect(texto).toContain("[POR CONSIGNAR]");
  });

  it("lee también el formato antiguo «1. NOMBRE — RUC 20112273922»", () => {
    const antiguo = `${PARRAFO_CONTROVERSIAS}\n\n1. Cámara de Comercio — RUC 20112273922`;
    expect(parseInstituciones(antiguo)).toEqual([
      { nombre: "Cámara de Comercio", ruc: "20112273922" },
    ]);
  });

  it("las instituciones sin nombre se descartan al componer", () => {
    const texto = componerControversias([{ nombre: "  ", ruc: "20112273922" }], "");
    expect(parseInstituciones(texto)).toEqual([]);
    expect(faltaDesignarInstitucion(texto)).toBe(true);
  });

  it("el texto libre (condiciones adicionales) se conserva y se separa del cuadro", () => {
    const texto = componerControversias(
      [{ nombre: "Cámara de Comercio de Lima", ruc: "20112273922" }],
      "Sede del arbitraje: Lima.",
    );
    expect(textoLibreControversias(texto)).toBe("Sede del arbitraje: Lima.");
    // Ni el párrafo fijo ni el encabezado ni las filas del cuadro cuentan como libre.
    expect(textoLibreControversias(texto)).not.toContain("330 y 331");
    expect(textoLibreControversias(texto)).not.toContain("N.º");
  });

  it("fusionar con texto de IA que repite el cuadro NO duplica las instituciones", () => {
    // Regresión: «Redactar con IA» reproducía el párrafo fijo y la tabla de
    // instituciones que ya venían en el campo; sumarlos tal cual duplicaba las
    // filas (las del campo + las repetidas por la IA). La fusión debe tomar SOLO
    // el texto libre de la IA y conservar las instituciones del campo una vez.
    const insts = [
      { nombre: "Centro de Arbitraje Elit Arbitrium S.A.C.", ruc: "20603618875" },
      { nombre: "Arbitrare Soluciones Legales y Arbitrales S.A.C.", ruc: "20477731482" },
      { nombre: "Sociedad Nacional de Construcción e Infraestructura - SNCI", ruc: "20610019421" },
    ];
    const valorCampo = componerControversias(insts, "");
    // La IA devuelve el apartado completo (párrafo + cuadro) más una condición.
    const textoIA = componerControversias(insts, "La sede del arbitraje es Lima.");
    const fusion = componerControversias(
      parseInstituciones(valorCampo),
      textoLibreControversias(textoIA),
    );
    expect(parseInstituciones(fusion)).toEqual(insts); // 3, no 6
    expect(textoLibreControversias(fusion)).toBe("La sede del arbitraje es Lima.");
  });

  it("faltaDesignarInstitucion es cierto solo cuando no hay ninguna", () => {
    expect(faltaDesignarInstitucion(PARRAFO_CONTROVERSIAS)).toBe(true);
    expect(
      faltaDesignarInstitucion(
        componerControversias([{ nombre: "Cámara de Comercio", ruc: "" }], ""),
      ),
    ).toBe(false);
  });
});

// Junta de Prevención y Resolución de Disputas (Art. 346): umbrales por objeto.
describe("avisoJPRD · umbrales de la JPRD (Art. 346)", () => {
  it("obras ≥ S/ 10M: obligatoria (346.1)", () => {
    const a = avisoJPRD("obras", 10_000_000);
    expect(a).toContain("OBLIGATORIA");
    expect(a).toContain("346.1");
  });

  it("obras entre S/ 5M y S/ 10M: facultativa (346.1)", () => {
    expect(avisoJPRD("obras", 7_000_000)).toContain("facultativa");
  });

  it("obras por debajo de S/ 5M: no cabe (null)", () => {
    expect(avisoJPRD("obras", 3_000_000)).toBeNull();
  });

  it("obra sin monto: advierte del umbral condicional", () => {
    expect(avisoJPRD("obras", null)).toContain("obligatoria");
  });

  it("suministros > S/ 10M: facultativa (346.2); en el resto no aplica", () => {
    expect(avisoJPRD("bienes", 12_000_000)).toContain("346.2");
    expect(avisoJPRD("servicios", 9_000_000)).toBeNull();
  });
});
