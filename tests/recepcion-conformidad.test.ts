import { describe, expect, it } from "vitest";
import {
  areaQueOtorgaLaConformidad,
  componerRecepcionConformidad,
  huecosDePlantilla,
  plantillaPara,
} from "@/lib/recepcion-conformidad";

/**
 * El apartado de recepción y conformidad (Art. 144 del Reglamento) NO es el
 * mismo para bienes que para servicios, y la diferencia es de fondo:
 *
 *   * en bienes hay DOS actos —la recepción, que da almacén, y la conformidad,
 *     que da el área usuaria—;
 *   * en servicios solo hay conformidad, y el apartado ni siquiera se titula
 *     igual.
 *
 * Un texto único con frases condicionales daba un apartado que no era ninguno de
 * los dos formatos, así que se elige la plantilla por objeto.
 */
const HUECOS = {
  areaConformidad: "Sub Gerencia de Desarrollo Económico",
  areaRecepcion: "Unidad de Almacén Central",
  plazoConformidad: "siete (7)",
  plazoSubsanacion: "cinco (5) días hábiles",
};

describe("bienes: recepción Y conformidad", () => {
  const texto = componerRecepcionConformidad("bienes", HUECOS)!;

  it("se titula con los dos actos", () => {
    expect(texto).toContain("RECEPCIÓN Y CONFORMIDAD DE LA PRESTACIÓN");
  });

  it("nombra quién recibe y quién da la conformidad, que son distintos", () => {
    expect(texto).toContain("La recepción será otorgada por Unidad de Almacén Central");
    expect(texto).toContain("la conformidad será otorgada por Sub Gerencia de Desarrollo Económico");
  });

  it("el 30% de subsanación va fijo, no es un hueco", () => {
    // En el formato de bienes esa cifra está escrita en el texto; solo en
    // servicios se deja para consignar.
    expect(texto).toContain("no debe ser mayor al 30% del plazo del entregable correspondiente");
    expect(texto).not.toContain("[CONSIGNAR EL PLAZO EL CUAL NO DEBE SER MAYOR");
  });

  it("el último párrafo habla de bienes", () => {
    expect(texto).toContain("cuando los bienes manifiestamente no cumplan");
  });

  it("cita el Reglamento sin el decreto, como el formato de bienes", () => {
    expect(texto).toContain("Reglamento de la Ley N° 32069");
    expect(texto).not.toContain("Decreto Supremo N° 009-2025-EF");
  });
});

describe("servicios: solo conformidad", () => {
  const texto = componerRecepcionConformidad("servicios", HUECOS)!;

  it("se titula solo con la conformidad", () => {
    expect(texto).toContain("CONFORMIDAD DE LA PRESTACIÓN");
    expect(texto).not.toContain("RECEPCIÓN Y CONFORMIDAD");
  });

  it("no menciona al almacén: en servicios no hay recepción que dar", () => {
    expect(texto).not.toContain("ALMACÉN");
    expect(texto).not.toContain("Unidad de Almacén Central");
  });

  it("el plazo de subsanación SÍ es un hueco aquí", () => {
    expect(texto).toContain("otorgándole un plazo para subsanar, cinco (5) días hábiles.");
  });

  it("cita el decreto que aprueba el Reglamento, como el formato de servicios", () => {
    expect(texto).toContain("Decreto Supremo N° 009-2025-EF");
  });

  it("el último párrafo habla de servicios", () => {
    expect(texto).toContain("cuando los servicios manifiestamente no cumplan");
  });
});

describe("la consultoría de obra sigue el formato de servicios", () => {
  it("porque es un servicio", () => {
    expect(plantillaPara("consultoria_obra")).toBe("servicios");
    expect(componerRecepcionConformidad("consultoria_obra", HUECOS)).toContain("CONFORMIDAD DE LA PRESTACIÓN");
  });
});

describe("obras no se inventa", () => {
  it("devuelve null en vez de un texto aproximado", () => {
    // La recepción de obra tiene su propio procedimiento —comisión de recepción,
    // pliego de observaciones— y el formato facilitado no lo cubre. Escribir
    // algo parecido en un documento que se firma sería peor que no escribirlo.
    expect(componerRecepcionConformidad("obras", HUECOS)).toBeNull();
    expect(plantillaPara("obras")).toBeNull();
    expect(huecosDePlantilla("obras")).toEqual([]);
  });

  it("sin objeto tampoco", () => {
    expect(componerRecepcionConformidad("", HUECOS)).toBeNull();
    expect(componerRecepcionConformidad(null, HUECOS)).toBeNull();
  });
});

describe("los huecos sin rellenar se VEN", () => {
  it("conservan el corchete del formato", () => {
    const t = componerRecepcionConformidad("bienes", {})!;
    expect(t).toContain("[CONSIGNAR EL ÁREA O UNIDAD ORGÁNICA DE ALMACÉN O LA QUE HAGA SUS VECES]");
    expect(t).toContain("[CONSIGNAR EL ÁREA O UNIDAD ORGÁNICA QUE OTORGA LA CONFORMIDAD]");
    expect((t.match(/\[CONSIGNAR/g) ?? []).length).toBe(3);
  });

  it("servicios también tiene tres", () => {
    const t = componerRecepcionConformidad("servicios", {})!;
    expect((t.match(/\[CONSIGNAR/g) ?? []).length).toBe(3);
  });
});

describe("cada objeto pide sus huecos y no los del otro", () => {
  it("bienes pide el área de almacén; servicios, el plazo de subsanación", () => {
    expect(huecosDePlantilla("bienes")).toEqual(["areaRecepcion", "areaConformidad", "plazoConformidad"]);
    expect(huecosDePlantilla("servicios")).toEqual([
      "areaConformidad",
      "plazoConformidad",
      "plazoSubsanacion",
    ]);
  });
});

/**
 * El apartado se COMPONE al pulsar «Redactar con IA», no se le pide al copiloto.
 *
 * El texto es el literal que la entidad facilitó, con sus huecos entre
 * corchetes: parafrasear un artículo del Reglamento en un documento que se firma
 * es un defecto, no una ayuda.
 */
describe("el texto de servicios es el literal del formato, palabra por palabra", () => {
  const t = componerRecepcionConformidad("servicios", {
    areaConformidad: "la Sub Gerencia de Desarrollo Económico",
    plazoConformidad: "7",
    plazoSubsanacion: "de 5 días hábiles",
  })!;

  it("el primer párrafo cita la norma y su decreto sin reformularlos", () => {
    expect(t).toContain(
      "La conformidad de la prestación se regula por lo dispuesto en el artículo 144 del Reglamento de la Ley 32069, Ley General de Contrataciones Públicas, aprobado mediante Decreto Supremo N° 009-2025-EF.",
    );
  });

  it("el plazo numérico encaja en la frase sin retocarla", () => {
    // El campo es un número de días y la frase ya trae el «días»: por eso ahí
    // no se compone ninguna coletilla.
    expect(t).toContain(
      "en el plazo máximo de 7 días computados desde el día siguiente de producida la recepción.",
    );
  });

  it("el de subsanación sí necesita su frase: un «5» suelto no se lee", () => {
    expect(t).toContain("otorgándole un plazo para subsanar, de 5 días hábiles.");
  });

  it("el párrafo de los periodos adicionales va entero", () => {
    expect(t).toContain(
      "En este supuesto corresponde aplicar la penalidad por mora desde el vencimiento del plazo para subsanar sin considerar los días en los que pudiera incurrir la entidad contratante para efectuar las revisiones y notificar las observaciones correspondientes.",
    );
  });

  it("y el último párrafo también", () => {
    expect(t).toContain(
      "Este procedimiento no resulta aplicable cuando los servicios manifiestamente no cumplan con las características y condiciones ofrecidas, en cuyo caso LA ENTIDAD CONTRATANTE no efectúa la recepción o no otorga la conformidad, según corresponda, debiendo considerarse como no ejecutada la prestación, aplicándose la penalidad que corresponda por cada día de atraso.",
    );
  });
});

describe("el apartado entero cabe en su tope", () => {
  it("el peor caso —las dos áreas al máximo— no se corta", async () => {
    // El texto capa a `LIMITES_TEXTO.recepcionConformidad` al escribirlo en la
    // ficha. Con 2000 el último párrafo de BIENES se cortaba sin avisar en
    // cuanto las dos áreas tenían nombre largo.
    const { LIMITES_TEXTO } = await import("@/lib/necesidades-limites");
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    for (const objeto of ["bienes", "servicios"]) {
      const peor = componerRecepcionConformidad(objeto, {
        areaConformidad: "á".repeat(LIMITES_TEXTO.formaPagoAreaConformidad),
        areaRecepcion: "á".repeat(LIMITES_TEXTO.recepcionArea),
        // El proyecto de inversión también entra en el texto ahora, y admite
        // 2000 por sí solo: el peor caso lo es de verdad solo con él dentro.
        proyectoInversion: "P".repeat(LIMITES_TEXTO.proyectoInversion),
        cui: "9".repeat(LIMITES_TEXTO.cui),
        plazoConformidad: "999",
        plazoSubsanacion: "de 999 días hábiles",
      })!;
      expect(peor.length, objeto).toBeLessThanOrEqual(LIMITES_TEXTO.recepcionConformidad);
      expect(
        necesidadUpdateSchema.safeParse({ recepcionConformidad: peor }).success,
        objeto,
      ).toBe(true);
    }
  });

  it("y con los huecos vacíos tampoco, que es donde los corchetes son más largos", async () => {
    const { LIMITES_TEXTO } = await import("@/lib/necesidades-limites");
    for (const objeto of ["bienes", "servicios"]) {
      const t = componerRecepcionConformidad(objeto, {})!;
      expect(t.length, objeto).toBeLessThanOrEqual(LIMITES_TEXTO.recepcionConformidad);
    }
  });
});

describe("en servicios, el área de recepción dice quién otorga la conformidad", () => {
  // En una inversión ejecutada por administración directa la conformidad la
  // firma el RESIDENTE, no la sub gerencia que tramita el pago. Como en
  // servicios el formato no tiene recepción, ese campo queda libre para decirlo.
  const AREAS = { areaConformidad: "SUB GERENCIA DE EJECUCIÓN", areaRecepcion: "RESIDENTE" };

  it("en servicios manda el residente", () => {
    expect(areaQueOtorgaLaConformidad("servicios", AREAS)).toBe("RESIDENTE");
    expect(areaQueOtorgaLaConformidad("consultoria_obra", AREAS)).toBe("RESIDENTE");
  });

  it("en bienes NO se sustituye: son dos actos y dos áreas", () => {
    // Almacén recibe y el área usuaria conforma. Cambiar una por otra haría que
    // el apartado dijera dos veces el mismo nombre.
    expect(areaQueOtorgaLaConformidad("bienes", AREAS)).toBe("SUB GERENCIA DE EJECUCIÓN");
  });

  it("en obras tampoco: su recepción la hace una comisión", () => {
    expect(areaQueOtorgaLaConformidad("obras", AREAS)).toBe("SUB GERENCIA DE EJECUCIÓN");
  });

  it("sin residente registrado, manda el área de siempre", () => {
    // Es lo que había y lo que sigue valiendo para todo lo ya escrito.
    expect(areaQueOtorgaLaConformidad("servicios", { ...AREAS, areaRecepcion: "" })).toBe(
      "SUB GERENCIA DE EJECUCIÓN",
    );
    expect(areaQueOtorgaLaConformidad("servicios", { ...AREAS, areaRecepcion: "  " })).toBe(
      "SUB GERENCIA DE EJECUCIÓN",
    );
  });

  it("y así queda el apartado", () => {
    const t = componerRecepcionConformidad("servicios", {
      areaConformidad: areaQueOtorgaLaConformidad("servicios", AREAS),
      plazoConformidad: "7",
      plazoSubsanacion: "de 15 días hábiles",
    })!;
    expect(t).toContain("La conformidad es otorgada por RESIDENTE en el plazo máximo de 7 días");
    expect(t).not.toContain("SUB GERENCIA");
  });

  it("los dos apartados lo aplican con la MISMA regla", async () => {
    // Se vigila el fuente porque el suite no monta React. Si solo lo aplicara
    // uno, el requerimiento diría que la conformidad la firma el residente y
    // que el pago exige la de la sub gerencia: dos firmantes para un solo acto.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    const i = fuente.indexOf("const pedirRedactarIA");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo.match(/areaQueOtorgaLaConformidad\(fichaForm\.tipoObjeto/g)).toHaveLength(2);
  });
});

describe("el área que firma lleva su proyecto de inversión, como en la forma de pago", () => {
  const CON_INVERSION = {
    ...HUECOS,
    cui: "2656190",
    proyectoInversion: "CREACION DEL SERVICIO DE PRÁCTICA DEPORTIVA",
  };

  it("en servicios, el nombre del proyecto va tras el área", () => {
    const t = componerRecepcionConformidad("servicios", CON_INVERSION)!;
    expect(t).toContain(
      "La conformidad es otorgada por Sub Gerencia de Desarrollo Económico, del proyecto de inversión «CREACION DEL SERVICIO DE PRÁCTICA DEPORTIVA», con CUI 2656190 en el plazo máximo",
    );
  });

  it("en bienes, también acompaña a la conformidad", () => {
    const t = componerRecepcionConformidad("bienes", CON_INVERSION)!;
    expect(t).toContain(
      "la conformidad será otorgada por Sub Gerencia de Desarrollo Económico, del proyecto de inversión «CREACION DEL SERVICIO DE PRÁCTICA DEPORTIVA», con CUI 2656190 en el plazo máximo",
    );
    // La recepción, que es otro acto, NO lleva el proyecto: lo lleva quien firma.
    expect(t).toContain("La recepción será otorgada por Unidad de Almacén Central y la conformidad");
  });

  it("sin inversión, el apartado sale igual que antes", () => {
    const t = componerRecepcionConformidad("servicios", HUECOS)!;
    expect(t).toContain("La conformidad es otorgada por Sub Gerencia de Desarrollo Económico en el plazo máximo");
    expect(t).not.toContain("proyecto de inversión");
  });

  it("sin área, el corchete se ve aunque haya inversión", () => {
    const t = componerRecepcionConformidad("servicios", { ...CON_INVERSION, areaConformidad: "" })!;
    expect(t).toContain("[CONSIGNAR EL ÁREA O UNIDAD ORGÁNICA QUE OTORGA LA CONFORMIDAD]");
    expect(t).not.toContain("proyecto de inversión");
  });

  it("y no se duplica si el área ya lo menciona", () => {
    // Misma protección que en la forma de pago: si alguien tecleó la inversión
    // dentro del nombre del área, no se repite.
    const t = componerRecepcionConformidad("servicios", {
      ...CON_INVERSION,
      areaConformidad: 'RESIDENTE, para el proyecto de inversión "CREACION"',
    })!;
    expect(t.match(/proyecto de inversión/gi)).toHaveLength(1);
  });
});

describe("«Redactar con IA» lo compone en vez de pedírselo al copiloto", () => {
  // Se vigila el fuente porque el suite no monta React.
  async function cuerpoDelManejador() {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    const i = fuente.indexOf("const pedirRedactarIA");
    return fuente.slice(i, fuente.indexOf("\n  };", i));
  }

  it("el atajo existe y va ANTES de abrir el copiloto", async () => {
    const cuerpo = await cuerpoDelManejador();
    expect(cuerpo).toContain('api === "recepcionConformidad"');
    expect(cuerpo).toContain("componerRecepcionConformidad");
    expect(cuerpo.indexOf("componerRecepcionConformidad")).toBeLessThan(
      cuerpo.indexOf("setCopilotoAbierto"),
    );
  });

  it("le pasa el objeto y los tres datos registrados", async () => {
    const cuerpo = await cuerpoDelManejador();
    expect(cuerpo).toContain("fichaForm.tipoObjeto");
    // El área se pide una sola vez, en la forma de pago: aquí se lee de allí.
    expect(cuerpo).toContain("fichaForm.formaPagoAreaConformidad");
    expect(cuerpo).toContain("fichaForm.recepcionArea");
    expect(cuerpo).toContain("fichaForm.conformidadPlazo");
    expect(cuerpo).toContain("fichaForm.conformidadPlazoSubsanacion");
  });

  it("y en obras sigue al copiloto, porque no hay plantilla que aplicar", async () => {
    const cuerpo = await cuerpoDelManejador();
    // La guarda: solo se escribe el campo si SALIÓ texto. Sin ella, obras
    // —donde `componerRecepcionConformidad` devuelve null— habría dejado de
    // llegar al copiloto y el botón no haría nada.
    expect(cuerpo).toMatch(/if \(texto\) \{/);
    expect(componerRecepcionConformidad("obras", {})).toBeNull();
  });
});
