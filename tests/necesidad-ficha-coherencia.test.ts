import { FICHA_SECCIONES, etiquetaRecomendado, type FichaField } from "@/lib/necesidad-ficha-secciones";
import { describe, expect, it } from "vitest";

// Coherencia interna del catálogo de campos de la ficha.
//
// `obligatorio` BLOQUEA EL GUARDADO, que es más duro que impedir remitir: con
// campos marcados por costumbre, no se podía ni dejar un borrador a medias. La
// referencia de qué se exige es `lib/necesidad-verificacion.ts`, que agrupa por
// artículo y distingue stop de warn.

const campos = (): FichaField[] => FICHA_SECCIONES.flatMap((s) => s.fields);
const buscar = (api: string) => {
  const f = campos().find((c) => c.api === api);
  if (!f) throw new Error(`Campo inexistente: ${api}`);
  return f;
};

describe("catálogo de campos de la ficha", () => {
  it("ningún campo oculto se marca obligatorio: no hay forma de rellenarlo", () => {
    const contradictorios = campos().filter((f) => f.oculto && f.obligatorio);
    expect(contradictorios.map((f) => f.api)).toEqual([]);
  });

  it("todo campo visible cita su base legal o explica de dónde sale", () => {
    const sinBase = campos().filter((f) => !f.oculto && !f.baseLegal);
    expect(sinBase.map((f) => f.api)).toEqual([]);
  });

  it("un select siempre trae opciones, y un no-select nunca", () => {
    for (const f of campos()) {
      if (f.kind === "select") expect(f.opciones?.length, f.api).toBeGreaterThan(0);
      else expect(f.opciones, f.api).toBeUndefined();
    }
  });

  it("las opciones de un select no se repiten", () => {
    for (const f of campos().filter((c) => c.kind === "select")) {
      const values = (f.opciones ?? []).map((o) => o.value);
      expect(new Set(values).size, f.api).toBe(values.length);
    }
  });
});

describe("lo que el Art. 44.2 pide «de corresponder» no bloquea el guardado", () => {
  it("la modalidad de pago se recomienda, no se exige", () => {
    const f = buscar("modalidadPago");
    expect(f.obligatorio).toBeFalsy();
    expect(f.recomendado).toBe(true);
  });

  it("el alcance solo es obligatorio en obras y consultoría de obra (Art. 154.1)", () => {
    const f = buscar("alcance");
    expect(f.obligatorio).toBeFalsy();
    expect(f.obligatorioPara).toEqual(["obras", "consultoria_obra"]);
  });

  it("el lugar de entrega se recomienda: el 44.2 lo pide de corresponder", () => {
    for (const api of ["departamento", "provincia", "distrito", "lugarEntrega"]) {
      expect(buscar(api).obligatorio, api).toBeFalsy();
    }
  });

  it("la especialidad solo se exige donde su anclaje aplica (obras, Art. 72.3.b/157)", () => {
    const f = buscar("especialidad");
    expect(f.obligatorio).toBeFalsy();
    expect(f.obligatorioPara).toEqual(["obras", "consultoria_obra"]);
  });
});

describe("lo que la norma sí exige sigue bloqueando", () => {
  it("la finalidad pública (44.1) sigue siendo obligatoria", () => {
    expect(buscar("finalidadPublica").obligatorio).toBe(true);
  });

  it("el TDR/EETT (126.1) es «de corresponder», no obligatorio: puede adjuntarse como PDF", () => {
    // La carga de 3.4 es opcional (puede escribirse aquí o adjuntarse como PDF del
    // TDR/EETT en el panel de la ficha), así que no bloquea guardar ni remitir.
    const f = buscar("descripcionDetallada");
    expect(f.obligatorio).toBeFalsy();
    expect(f.recomendado).toBe(true);
  });

  it("los requisitos de calificación (3.5.1) siguen siendo obligatorios", () => {
    expect(buscar("requisitosCalificacion").obligatorio).toBe(true);
  });
});

describe("listas cerradas como desplegable, no como texto libre", () => {
  it("modalidad de pago, sistema de entrega y moneda son select", () => {
    for (const api of ["modalidadPago", "sistemaEntrega", "moneda"]) {
      expect(buscar(api).kind, api).toBe("select");
    }
  });

  it("guardan la ETIQUETA, no la clave: la siembra de A3 mapea por texto", () => {
    // `normalizarModalidadPago` busca "suma alzada"; con la clave `suma_alzada`
    // no encontraría nada y A3 se sembraría vacío.
    const opciones = buscar("modalidadPago").opciones ?? [];
    expect(opciones.some((o) => o.value === "Suma alzada")).toBe(true);
    expect(opciones.some((o) => o.value === "suma_alzada")).toBe(false);
  });
});

describe("las cláusulas se escriben en textarea ancho, no en una línea", () => {
  it("el lugar de entrega tiene sitio para redactar", () => {
    const f = buscar("lugarEntrega");
    expect(f.kind).toBe("textarea");
    expect(f.wide).toBe(true);
  });

  it("la subcontratación se elige entre los dos supuestos, no se redacta", () => {
    // El modelo admite UNO de dos textos fijos —permitida hasta el 40% o
    // prohibida—, nunca los dos ni una redaccion propia. Un textarea libre
    // invitaba a mezclarlos.
    const f = buscar("subcontratacion");
    expect(f.kind).toBe("subcontratacion");
    expect(f.wide).toBe(true);
  });

  it("el adelanto directo se elige (se otorga / no corresponde), no se redacta libre", () => {
    // Art. 137: o se otorga con sus condiciones, o no corresponde. La selección
    // por radios evita el apartado en blanco, que se lee como un olvido.
    const f = buscar("adelantoDirecto");
    expect(f.kind).toBe("adelanto");
    expect(f.wide).toBe(true);
  });
});

// La etiqueta de un campo recomendado citaba SIEMPRE el Art. 44.2. Al pasar a
// recomendados campos que son sustento de la finalidad pública (Art. 44.1), la
// ficha les atribuía un artículo que no es el suyo: un error de fondo en un
// documento que se firma, no un detalle de redacción.
describe("etiquetaRecomendado · cita el artículo del propio campo", () => {
  const campo = (api: string) => {
    const f = FICHA_SECCIONES.flatMap((s) => s.fields).find((c) => c.api === api);
    if (!f) throw new Error(`Campo inexistente: ${api}`);
    return f;
  };

  it("los campos de sustento de la finalidad pública ya no están en la ficha", () => {
    // Se retiraron: ninguna fase los consumía y no se imprimen en ningún
    // documento. Lo que el Art. 44.1 exige —la finalidad pública— sí sigue.
    const apis = FICHA_SECCIONES.flatMap((s) => s.fields).map((f) => f.api);
    for (const api of ["problemaIdentificado", "objetivoContratacion", "beneficioEsperado", "poblacionBeneficiaria"]) {
      expect(apis, api).not.toContain(api);
    }
    expect(apis).toContain("finalidadPublica");
  });

  it("las condiciones de contratación siguen citando el 44.2", () => {
    expect(etiquetaRecomendado(campo("modalidadPago"))).toContain("Art. 44.2");
    expect(etiquetaRecomendado(campo("lugarEntrega"))).toContain("Art. 44.2");
  });

  it("sin artículo en su base legal no se inventa uno", () => {
    expect(etiquetaRecomendado({ api: "x", col: "nombre", label: "X" })).toBe("recomendado");
    expect(etiquetaRecomendado({ api: "x", col: "nombre", label: "X", baseLegal: "Dato del SIGA." })).toBe(
      "recomendado",
    );
  });
});
