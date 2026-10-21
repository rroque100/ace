import { describe, expect, it } from "vitest";
import { pasoF1 } from "@/lib/actuaciones-preparatorias";
import { progresoDeGrupos, visibilidadDePaso } from "@/lib/fase-campos-visibles";

// Los campos de A4 tal como los ve el panel (sin el filtro por objeto, que solo
// quita los `obra_*`: los sustentos de h) e i) no lo son, así que están siempre).
const CAMPOS_A4 = pasoF1("A4")?.campos ?? [];
const nombres = (data: Record<string, unknown>, verOpcionales = false) =>
  visibilidadDePaso(CAMPOS_A4, data, verOpcionales).camposVisibles.map((c) => c.name);

describe("A4 · visibilidad de los sustentos de h) y i)", () => {
  it("el paso A4 existe y trae los dos campos de sustento", () => {
    expect(CAMPOS_A4.length).toBeGreaterThan(0);
    const h = CAMPOS_A4.find((c) => c.name === "var_h_sustento_pago");
    const i = CAMPOS_A4.find((c) => c.name === "var_i_sustento_entrega");
    // Marcados `recomendado` a propósito: alimentan B70/B83 del formato firmado.
    expect(h?.recomendado).toBe(true);
    expect(i?.recomendado).toBe(true);
  });

  it("se ven SIN desplegar opcionales y SIN haber elegido nada (campo vacío)", () => {
    // Reproduce el estado del que se quejó el usuario: A4 recién abierto, nada
    // seleccionado, "Mostrar campos opcionales" plegado.
    const visibles = nombres({});
    expect(visibles).toContain("var_h_sustento_pago");
    expect(visibles).toContain("var_i_sustento_entrega");
  });

  it("el filtro de opcionales está activo (hay campos que sí se ocultan)", () => {
    // Control: si TODO se viera, que los sustentos aparezcan no probaría nada. El
    // paso A4 tiene ~46 campos con la mitad opcionales, así que `ocultos` > 0.
    const { ocultos, camposVisibles } = visibilidadDePaso(CAMPOS_A4, {}, false);
    expect(ocultos).toBeGreaterThan(0);
    expect(camposVisibles.length).toBeLessThan(CAMPOS_A4.length);
  });

  it("al desplegar opcionales siguen estando (no desaparecen)", () => {
    const visibles = nombres({}, true);
    expect(visibles).toContain("var_h_sustento_pago");
    expect(visibles).toContain("var_i_sustento_entrega");
  });

  it("siguen visibles ya con la modalidad/sistema elegidos (con valor)", () => {
    const visibles = nombres({
      var_h_modalidad_pago: "suma_alzada",
      var_h_sustento_pago: "…",
      var_i_sistema_entrega: "llave_en_mano",
      var_i_sustento_entrega: "…",
    });
    expect(visibles).toContain("var_h_sustento_pago");
    expect(visibles).toContain("var_i_sustento_entrega");
  });

  // La rejilla de A4 es de 2 columnas y `ancho:"full"` ocupa la fila entera. Para
  // que cada SELECT quede en la misma fila que su SUSTENTO, ninguno de los cuatro
  // puede ser full y deben salir CONSECUTIVOS: [h-select, h-sustento] es la fila 1
  // y [i-select, i-sustento] la fila 2.
  it("ningún campo de h)/i) es de ancho completo (van a media rejilla)", () => {
    for (const name of ["var_h_modalidad_pago", "var_h_sustento_pago", "var_i_sistema_entrega", "var_i_sustento_entrega"]) {
      const c = CAMPOS_A4.find((x) => x.name === name);
      expect(c, name).toBeTruthy();
      expect(c?.ancho, `${name} no debe ser full`).not.toBe("full");
    }
  });

  it("el orden visible empareja cada select con su sustento (2 filas de a 2)", () => {
    // A4 típico: modalidad y sistema ya elegidos → los cuatro visibles.
    const visibles = nombres({ var_h_modalidad_pago: "suma_alzada", var_i_sistema_entrega: "llave_en_mano" });
    const at = (name: string) => visibles.indexOf(name);
    const h = at("var_h_modalidad_pago");
    const hs = at("var_h_sustento_pago");
    const i = at("var_i_sistema_entrega");
    const is = at("var_i_sustento_entrega");
    // Consecutivos y en este orden: fila 1 = h + su sustento, fila 2 = i + el suyo.
    expect(hs).toBe(h + 1);
    expect(i).toBe(hs + 1);
    expect(is).toBe(i + 1);
  });
});

describe("A4 · progreso por sección (a–t)", () => {
  const grupoAB = CAMPOS_A4.find((c) => c.name === "var_a_proceso")?.grupo ?? "";

  it("cada grupo cuenta solo sus campos exigibles (obligatorio + de corresponder)", () => {
    const m = progresoDeGrupos(CAMPOS_A4, {});
    const ab = m.get(grupoAB);
    expect(ab).toBeTruthy();
    expect(ab!.total).toBeGreaterThan(0);
    // Sin datos, nada lleno.
    expect(ab!.llenos).toBe(0);
    // Un campo opcional del grupo (var_a_sustento_cambio) no infla el total.
    expect(ab!.total).toBe(
      CAMPOS_A4.filter((c) => c.grupo === grupoAB && (c.required || c.recomendado)).length,
    );
  });

  it("una sección con todos sus campos exigibles llenos queda completa", () => {
    // Rellena TODO el grupo a–b; solo cuentan los exigibles, así que llenos === total.
    const data: Record<string, unknown> = {};
    for (const c of CAMPOS_A4.filter((c) => c.grupo === grupoAB)) data[c.name] = "x";
    const g = progresoDeGrupos(CAMPOS_A4, data).get(grupoAB)!;
    expect(g.llenos).toBe(g.total);
  });
});

describe("progreso de obligatorios del paso (cabecera A1–A8)", () => {
  it("obligatoriosTotal cuenta los obligatorios exigibles y pendientes ≤ total", () => {
    const vacío = visibilidadDePaso(CAMPOS_A4, {}, false);
    expect(vacío.obligatoriosTotal).toBeGreaterThan(0);
    expect(vacío.obligatoriosPendientes).toBeLessThanOrEqual(vacío.obligatoriosTotal);
    // Sin datos, todos los obligatorios están pendientes.
    expect(vacío.obligatoriosPendientes).toBe(vacío.obligatoriosTotal);
  });

  it("al llenar todos los campos, pendientes = 0 con total > 0 (paso «listo»)", () => {
    const data: Record<string, unknown> = {};
    for (const c of CAMPOS_A4.filter((c) => !c.oculto)) data[c.name] = "x";
    const v = visibilidadDePaso(CAMPOS_A4, data, false);
    expect(v.obligatoriosPendientes).toBe(0);
    expect(v.obligatoriosTotal).toBeGreaterThan(0);
  });
});

describe("A8 · el DE (remitente) está oculto en el formulario", () => {
  const CAMPOS_A8 = pasoF1("A8")?.campos ?? [];
  const visiblesA8 = (verOpcionales = false) =>
    visibilidadDePaso(CAMPOS_A8, {}, verOpcionales).camposVisibles.map((c) => c.name);

  it("el DE está marcado `oculto` pero sigue en la definición (lo consume el documento)", () => {
    const de = CAMPOS_A8.find((c) => c.name === "remitente");
    expect(de).toBeTruthy();
    expect(de?.oculto).toBe(true);
  });

  it("un campo oculto no se muestra NI al desplegar opcionales", () => {
    expect(visiblesA8(false)).not.toContain("remitente");
    expect(visiblesA8(true)).not.toContain("remitente");
  });

  it("el resto de A8 sí se ve (AL, número del documento)", () => {
    const v = visiblesA8(true);
    expect(v).toContain("autoridad");
    expect(v).toContain("numero_documento");
  });
});
