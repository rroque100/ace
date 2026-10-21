import { describe, expect, it } from "vitest";
import { componerAreaConformidad, componerFormaPago, huecosPendientes } from "@/lib/forma-pago";

/**
 * El apartado FORMA DE PAGO no está en los PDF-modelo cargados: lo pide la
 * entidad. Su texto lo fija el Art. 67 de la Ley y solo tiene cinco huecos, así
 * que se compone con una plantilla en vez de generarse: parafrasear un artículo
 * de la Ley en un documento que se firma es un defecto, no una ayuda.
 */
const COMPLETO = {
  areaConformidad: "Sub Gerencia de Desarrollo Económico",
  direccion: "Av. Arenas 121, Abancay",
  documentacionAdicional: "Acta de entrega de los bienes",
  lugarPresentacion: "Mesa de Partes de la Municipalidad",
  tipoPago: "un pago único contra conformidad",
};

describe("el texto que fija la Ley sale literal", () => {
  it("cita el artículo 67 y los plazos de la norma", () => {
    const t = componerFormaPago(COMPLETO);
    expect(t).toContain("artículo 67 de la Ley");
    expect(t).toContain("dentro de los diez días hábiles siguientes de otorgada la conformidad");
    expect(t).toContain("prorrogable, previa justificación de la demora, por cinco días hábiles");
  });

  it("incluye el párrafo del consorcio, que no depende de nada que se escriba", () => {
    expect(componerFormaPago({})).toContain("se haya suscrito contrato con un consorcio");
  });

  it("los dos documentos fijos van siempre", () => {
    const t = componerFormaPago(COMPLETO);
    expect(t).toContain("conformidad de la prestación efectuada");
    expect(t).toContain("- Comprobante de pago.");
  });
});

describe("los cinco huecos se rellenan con lo registrado", () => {
  it("cada valor aparece en su sitio", () => {
    const t = componerFormaPago(COMPLETO);
    expect(t).toContain("a favor del contratista en un pago único contra conformidad.");
    expect(t).toContain("servidor responsable del Sub Gerencia de Desarrollo Económico.");
    expect(t).toContain("- Acta de entrega de los bienes.");
    expect(t).toContain("restante en Mesa de Partes de la Municipalidad, sito en Av. Arenas 121, Abancay.");
  });

  it("ya no queda ningún corchete cuando están los cinco", () => {
    expect(componerFormaPago(COMPLETO)).not.toMatch(/\[[A-ZÁÉÍÓÚ]/);
  });
});

describe("un hueco sin rellenar se VE", () => {
  it("conserva el corchete del formato en vez de disolverse", () => {
    // El requerimiento se firma: un hueco vacío tiene que parecer lo que es
    // —algo que falta— y no una frase que ya está completa.
    const t = componerFormaPago({ ...COMPLETO, direccion: "" });
    expect(t).toContain("[CONSIGNAR LA DIRECCIÓN EXACTA]");
  });

  it("sin nada registrado salen los cinco corchetes", () => {
    const t = componerFormaPago({});
    expect((t.match(/\[[A-ZÁÉÍÓÚ][^\]]*\]/g) ?? []).length).toBe(5);
  });

  it("los espacios en blanco no cuentan como relleno", () => {
    expect(componerFormaPago({ ...COMPLETO, tipoPago: "   " })).toContain("[CONSIGNAR SI SE TRATA DE PAGO ÚNICO");
  });
});

describe("cuántos huecos faltan", () => {
  it("los cuenta para poder avisar antes de firmar", () => {
    expect(huecosPendientes({})).toBe(5);
    expect(huecosPendientes(COMPLETO)).toBe(0);
    expect(huecosPendientes({ ...COMPLETO, direccion: "", tipoPago: "  " })).toBe(2);
  });
});

describe("el apartado está en la ficha y se guarda", () => {
  it("los seis campos existen en 3.3 Condiciones de contratación", async () => {
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const seccion = FICHA_SECCIONES.find((s) => s.title === "3.3 Condiciones de contratación")!;
    const apis = seccion.fields.map((f) => f.api);
    for (const api of [
      "formaPago", "formaPagoTipo", "formaPagoAreaConformidad",
      "formaPagoDocumentacion", "formaPagoLugar", "formaPagoDireccion",
    ]) {
      expect(apis, api).toContain(api);
    }
  });

  it("el esquema los acepta: sin esto el guardado responde 400", async () => {
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const r = necesidadUpdateSchema.safeParse({
      formaPago: componerFormaPago(COMPLETO),
      formaPagoAreaConformidad: COMPLETO.areaConformidad,
      formaPagoDireccion: COMPLETO.direccion,
      formaPagoDocumentacion: COMPLETO.documentacionAdicional,
      formaPagoLugar: COMPLETO.lugarPresentacion,
      formaPagoTipo: COMPLETO.tipoPago,
    });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("el texto compuesto cabe en el tope del campo", () => {
    // Con los cinco huecos vacios el texto es el MAS largo: los corchetes del
    // formato son mas largos que casi cualquier valor real.
    expect(componerFormaPago({}).length).toBeLessThan(6000);
  });

  it("«Redactar con IA» compone el texto, no llama al copiloto", async () => {
    // Se vigila el fuente porque el suite no monta React. Lo que importa es que
    // este campo NO pase por el modelo de lenguaje: su texto es literal de la
    // Ley y parafrasearlo en un documento que se firma seria un defecto.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    // Se acota por el CIERRE de la función, no por un número de caracteres: la
    // primera versión de esta prueba cortaba a 1 400 y empezó a fallar sola en
    // cuanto se añadió un segundo atajo al mismo manejador.
    const i = fuente.indexOf("const pedirRedactarIA");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo).toContain('api === "formaPago"');
    expect(cuerpo).toContain("componerFormaPago");
    // y el atajo va ANTES de abrir el copiloto
    expect(cuerpo.indexOf("componerFormaPago")).toBeLessThan(cuerpo.indexOf("setCopilotoAbierto"));
  });
});

describe("el tipo de pago se elige, no se escribe", () => {
  it("son exactamente dos opciones", async () => {
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "formaPagoTipo")!;
    expect(campo.kind).toBe("select");
    expect(campo.opciones?.map((o) => o.label)).toEqual(["Pago único", "Pagos a cuenta"]);
  });

  it("el valor guardado encaja en la frase del formato", async () => {
    // La frase es «...a favor del contratista en ___.», así que el valor se
    // guarda ya redactado —«un pago único»— y no como etiqueta suelta. Los
    // pagos a cuenta arrastran además su detalle, así que se les da uno.
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "formaPagoTipo")!;
    for (const opcion of campo.opciones ?? []) {
      const texto = componerFormaPago({ ...COMPLETO, detallePagosACuenta: "", tipoPago: opcion.value });
      expect(texto).toContain(`a favor del contratista en ${opcion.value}`);
    }
  });

  it("y el esquema acepta los dos valores", async () => {
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "formaPagoTipo")!;
    for (const o of campo.opciones ?? []) {
      expect(necesidadUpdateSchema.safeParse({ formaPagoTipo: o.value }).success, o.value).toBe(true);
    }
  });
});

/**
 * El área que otorga la conformidad ya está registrada en la ficha —en el
 * apartado del Art. 144— y, cuando la contratación se imputa a una inversión,
 * también su proyecto y su CUI. Aquí se compone con los tres en vez de pedir
 * que se teclee otra vez.
 */
const PROYECTO =
  "186 MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS DE AGUA POTABLE Y SANEAMIENTO BASICO";

describe("el área de la conformidad se trae de lo ya registrado", () => {
  it("con los tres datos dice a qué inversión pertenece el área", () => {
    expect(
      componerAreaConformidad({
        area: "Sub Gerencia de Desarrollo Económico",
        cui: "2661009",
        proyectoInversion: PROYECTO,
      }),
    ).toBe(
      `Sub Gerencia de Desarrollo Económico, del proyecto de inversión «${PROYECTO}», con CUI 2661009`,
    );
  });

  it("sin inversión sale solo el área", () => {
    expect(componerAreaConformidad({ area: "Unidad de Logística" })).toBe("Unidad de Logística");
  });

  it("el proyecto y el CUI se añaden por separado", () => {
    // Una ficha puede tener el nombre del proyecto y todavía no el código, o al
    // revés: esperar a los dos dejaría el campo vacío teniendo ya la mitad.
    expect(componerAreaConformidad({ area: "A", proyectoInversion: "P" })).toBe(
      "A, del proyecto de inversión «P»",
    );
    expect(componerAreaConformidad({ area: "A", cui: "123" })).toBe("A, con CUI 123");
  });

  it("sin área no compone nada: el hueco del formato tiene que verse", () => {
    // Devolver «del proyecto de inversión …» sin decir QUIÉN firma sería peor
    // que el corchete: parecería un apartado completo.
    expect(componerAreaConformidad({ cui: "2661009", proyectoInversion: PROYECTO })).toBe("");
    expect(componerAreaConformidad({ area: "   ", cui: "2661009" })).toBe("");
    expect(componerAreaConformidad({})).toBe("");
  });

  it("los espacios sobrantes no cuentan como dato", () => {
    expect(componerAreaConformidad({ area: " A ", cui: "  ", proyectoInversion: " " })).toBe("A");
  });

  it("el apartado lo compone solo, a partir de los campos sueltos", () => {
    // La composición vive DENTRO de `componerFormaPago` y no en el campo de la
    // ficha: ese campo es de donde sale el área, y escribir en él el resultado
    // de leerlo sería morderse la cola.
    const texto = componerFormaPago({ ...COMPLETO, cui: "2661009", proyectoInversion: PROYECTO });
    expect(texto).toContain(
      `responsable del Sub Gerencia de Desarrollo Económico, del proyecto de inversión «${PROYECTO}», con CUI 2661009.`,
    );
  });

  it("sin inversión el apartado no cambia respecto a antes", () => {
    expect(componerFormaPago(COMPLETO)).toContain(
      "responsable del Sub Gerencia de Desarrollo Económico.",
    );
  });

  it("y el corchete sigue saliendo si falta el área, aunque haya inversión", () => {
    const texto = componerFormaPago({ ...COMPLETO, areaConformidad: "", cui: "2661009", proyectoInversion: PROYECTO });
    expect(texto).toContain("[REGISTRAR LA DENOMINACIÓN DEL ÁREA RESPONSABLE");
    expect(texto).not.toContain(PROYECTO);
  });
});

describe("el área se pide UNA sola vez", () => {
  it("de las dos casillas del área, solo se enseña una", async () => {
    // Estaban las dos en la sección 3.3, con el MISMO rótulo y una debajo de la
    // otra: se registraba dos veces y nada garantizaba que dijeran lo mismo.
    // Se comprueba por `api` y no por etiqueta: la etiqueta puede cambiar —de
    // hecho cambió— y la prueba dejaría de mirar lo que dice mirar.
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const lasDos = ["formaPagoAreaConformidad", "conformidadArea"];
    const visibles = FICHA_SECCIONES.flatMap((s) => s.fields).filter(
      (f) => !f.oculto && lasDos.includes(f.api),
    );
    expect(visibles.map((f) => f.api)).toEqual(["formaPagoAreaConformidad"]);
  });

  it("y su etiqueta son las palabras del corchete del formato", async () => {
    // Se llamaba «Área que otorga la conformidad» y no se reconocía al cotejar
    // la ficha contra la base estándar, que dice «REGISTRAR LA DENOMINACIÓN DEL
    // ÁREA RESPONSABLE DE OTORGAR LA CONFORMIDAD».
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find(
      (f) => f.api === "formaPagoAreaConformidad",
    )!;
    expect(campo.label).toBe("Denominación del área responsable de otorgar la conformidad");
    expect(campo.kind ?? "text").toBe("text");
    expect(campo.subgrupo).toBe("Forma de pago (Art. 67 de la Ley)");
    // Y el corchete que rellena sigue siendo ese, no otro.
    expect(componerFormaPago({})).toContain(
      `[${campo.label.toUpperCase().replace("DENOMINACIÓN", "REGISTRAR LA DENOMINACIÓN")}]`,
    );
  });

  it("pero su columna sigue existiendo, espejada", async () => {
    // El apartado del Art. 144 la usa: se oculta la casilla, no el dato.
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "conformidadArea");
    expect(campo?.oculto).toBe(true);

    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");
    const i = fuente.indexOf("function setFichaField");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  }", i));
    expect(cuerpo).toContain('if (api === "formaPagoAreaConformidad") next.conformidadArea = value;');
  });

  it("y al abrir, la ficha vieja que solo tenga una de las dos rellena la otra", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");
    const i = fuente.indexOf("function startFichaEdit");
    const cuerpo = fuente.slice(i, fuente.indexOf("setFichaEdit(true)", i));
    expect(cuerpo).toContain("initial.formaPagoAreaConformidad = initial.conformidadArea");
    expect(cuerpo).toContain("initial.conformidadArea = initial.formaPagoAreaConformidad");
  });
});

describe("no repite la inversión si ya está escrita en el área", () => {
  // Caso real: se tecleó la denominación con el proyecto dentro, y el apartado
  // salió nombrándolo dos veces seguidas —una con las palabras del usuario y
  // otra con las de `componerAreaConformidad`— dentro de un documento firmable.
  const AREA_CON_PROYECTO =
    'SUB GERENCIA DE EJECUCIÓN DE INVERSIONES Y MANTENIMIENTO, para el proyecto de inversión "CREACION DEL SERVICIO DE PRÁCTICA DEPORTIVA"';

  it("si el área ya menciona el proyecto, no se añade otra vez", () => {
    const t = componerAreaConformidad({
      area: AREA_CON_PROYECTO,
      cui: "2656190",
      proyectoInversion: "CREACION DEL SERVICIO DE PRÁCTICA DEPORTIVA Y/O RECREATIVA",
    });
    expect(t.match(/proyecto de inversión/gi)).toHaveLength(1);
  });

  it("se mira si lo MENCIONA, no si lo contiene entero", () => {
    // El campo tiene tope: el nombre que se tecleó puede estar cortado, y
    // comparar textos completos no habría detectado nada.
    const cortado = 'Área X, para el proyecto de inversión "CREACION DEL SERV';
    expect(componerAreaConformidad({ area: cortado, proyectoInversion: "CREACION DEL SERVICIO ENTERO" })).toBe(cortado);
  });

  it("y el CUI tampoco se duplica", () => {
    const t = componerAreaConformidad({ area: "Área X, con CUI 2656190", cui: "2656190" });
    expect(t.match(/CUI/g)).toHaveLength(1);
  });

  it("pero si el área es solo el nombre, se añaden los dos", () => {
    expect(componerAreaConformidad({ area: "Área X", cui: "9", proyectoInversion: "P" })).toBe(
      "Área X, del proyecto de inversión «P», con CUI 9",
    );
  });
});

describe("la denominación del área cabe con su proyecto dentro", () => {
  it("un caso real de 299 caracteres ya no se corta", async () => {
    // Se bajó el tope a 300 razonando que aquí solo cabe un nombre. No es
    // cierto: el formato pide la DENOMINACIÓN del área responsable, y en una
    // inversión eso se escribe con el proyecto al que pertenece. El valor real
    // se guardó cortado a mitad de palabra, «…DE COTABAMBAS DEL».
    const { LIMITES_TEXTO } = await import("@/lib/necesidades-limites");
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const real =
      'SUB GERENCIA DE EJECUCION DE INVERSIONES Y MANTENIMIENTO, para el proyecto de inversión "CREACION DEL SERVICIO DE PRÁCTICA DEPORTIVA Y/O RECREATIVA EN LOS CASERÍOS DE PANCHAMA, JAWAPAYLLA Y CHUSPIRE DE LA COMUNIDAD DE NUEVA FUERABAMBA DEL DISTRITO DE CHALLHUAHUACHO DE LA PROVINCIA DE COTABAMBAS DEL DEPARTAMENTO DE APURIMAC"';
    expect(real.length).toBeGreaterThan(300);
    expect(real.length).toBeLessThanOrEqual(LIMITES_TEXTO.formaPagoAreaConformidad);
    expect(necesidadUpdateSchema.safeParse({ formaPagoAreaConformidad: real }).success).toBe(true);
  });
});

describe("el apartado entero cabe en su tope", () => {
  it("el peor caso posible —todos los huecos al máximo— no se corta", async () => {
    // El texto capa a `LIMITES_TEXTO.formaPago` al escribirlo en la ficha. Si el
    // peor caso lo rebasa, el apartado se corta SIN avisar en un documento que
    // se firma. Al sumarle el nombre del proyecto (2000 por sí solo) el tope de
    // 6000 se quedó corto.
    const { LIMITES_TEXTO } = await import("@/lib/necesidades-limites");
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const relleno = (api: string) => "á".repeat(LIMITES_TEXTO[api]);
    const peor = componerFormaPago({
      areaConformidad: relleno("formaPagoAreaConformidad"),
      cui: relleno("cui"),
      // El detalle solo entra si el pago es a cuenta, así que el peor caso lo
      // es de verdad solo por esa rama: el tipo tiene que decir «a cuenta».
      detallePagosACuenta: relleno("formaPagoDetalle"),
      direccion: relleno("formaPagoDireccion"),
      documentacionAdicional: relleno("formaPagoDocumentacion"),
      lugarPresentacion: relleno("formaPagoLugar"),
      proyectoInversion: relleno("proyectoInversion"),
      tipoPago: `pagos a cuenta ${relleno("formaPagoTipo")}`.slice(0, LIMITES_TEXTO.formaPagoTipo),
    });
    expect(peor.length).toBeLessThanOrEqual(LIMITES_TEXTO.formaPago);
    expect(necesidadUpdateSchema.safeParse({ formaPago: peor }).success).toBe(true);
  });
});

describe("el formulario compone el apartado con la inversión", () => {
  it("«Redactar con IA» le pasa el proyecto y el CUI", async () => {
    // Se vigila el fuente porque el suite no monta React.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    const i = fuente.indexOf("const pedirRedactarIA");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo).toContain("cui: fichaForm.cui");
    expect(cuerpo).toContain("proyectoInversion: fichaForm.proyectoInversion");
  });

  it("el borrador local se guarda DESPUÉS de derivar los campos", async () => {
    // Estaba antes, así que guardaba un estado que ya no era el devuelto y solo
    // se corregía en la siguiente tecla.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");
    const i = fuente.indexOf("function setFichaField");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  }", i));
    // Los dos tienen que ESTAR: con -1, un «menor que» pasaría solo.
    expect(cuerpo).toContain("next.conformidadArea = value");
    expect(cuerpo).toContain("localStorage.setItem(DRAFT_KEY");
    expect(cuerpo.indexOf("next.conformidadArea = value")).toBeLessThan(
      cuerpo.indexOf("localStorage.setItem(DRAFT_KEY"),
    );
  });
});

/**
 * El apartado se coteja contra el formato PUBLICADO en las bases estándar, así
 * que las diferencias de redacción no son de estilo: se comparan párrafo a
 * párrafo con el literal.
 */
describe("el texto es el de la base estándar, párrafo a párrafo", () => {
  const t = componerFormaPago({});

  it("el artículo 67 y el plazo van en UN solo párrafo", () => {
    // Estaban partidos en dos. El formato los publica juntos.
    expect(t).toContain(
      "El pago se realiza de conformidad con lo establecido en el artículo 67 de la Ley. La entidad contratante paga las contraprestaciones pactadas a favor del contratista dentro de los diez días hábiles siguientes de otorgada la conformidad por parte del área usuaria y es prorrogable, previa justificación de la demora, por cinco días hábiles.",
    );
  });

  it("el del consorcio va entero y aparte", () => {
    expect(t).toContain(
      "\nEn el caso que se haya suscrito contrato con un consorcio, el pago se realiza, a quien corresponda, de acuerdo con lo que se indique en el contrato de consorcio.\n",
    );
  });

  it("la lista lleva los tres documentos, en su orden", () => {
    const lineas = t.split("\n").filter((l) => l.startsWith("- "));
    expect(lineas).toHaveLength(3);
    expect(lineas[1]).toBe("- Comprobante de pago.");
  });

  it("y el último párrafo, con el hueco vacío, es el del formato: sin «en»", () => {
    // El formato escribe «…la documentación restante [CONSIGNAR MESA DE
    // PARTES…]»: espera la preposición dentro de lo que se consigne.
    expect(t).toContain(
      "el contratista debe presentar la documentación restante [CONSIGNAR MESA DE PARTES O LA DEPENDENCIA ESPECÍFICA DE LA ENTIDAD CONTRATANTE DONDE SE DEBE PRESENTAR LA DOCUMENTACIÓN], sito en",
    );
  });

  it("pero relleno sí lo lleva, porque si no deja de ser una frase", () => {
    expect(componerFormaPago(COMPLETO)).toContain(
      "la documentación restante en Mesa de Partes de la Municipalidad, sito en",
    );
  });
});

describe("el detalle de los pagos a cuenta", () => {
  const A_CUENTA = { ...COMPLETO, tipoPago: "pagos a cuenta" };
  const DETALLE = "tres pagos del 30%, 30% y 40% contra la conformidad de cada entregable";

  it("entra en la frase cuando el pago es a cuenta", () => {
    expect(componerFormaPago({ ...A_CUENTA, detallePagosACuenta: DETALLE })).toContain(
      `a favor del contratista en pagos a cuenta, según el siguiente detalle: ${DETALLE}.`,
    );
  });

  it("y sin escribirlo, el corchete del formato sigue ahí", () => {
    // Es lo que la base estándar exige en ese mismo hueco. Al cerrar el tipo en
    // un desplegable el detalle se quedó sin sitio y el apartado salía sin
    // decir cuántos pagos ni contra qué entregables.
    expect(componerFormaPago({ ...A_CUENTA, detallePagosACuenta: "" })).toContain(
      "[CONSIGNAR EL DETALLE QUE CORRESPONDE EN EL CASO DE PAGO A CUENTA]",
    );
  });

  it("en un pago único no se escribe, aunque haya algo guardado", () => {
    // Un detalle sobrante de cuando el pago era a cuenta no puede colarse en un
    // apartado que dice que el pago es único.
    const t = componerFormaPago({ ...COMPLETO, detallePagosACuenta: DETALLE, tipoPago: "un pago único" });
    expect(t).toContain("a favor del contratista en un pago único.");
    expect(t).not.toContain(DETALLE);
  });

  it("sin tipo elegido, el corchete es el entero del formato", () => {
    expect(componerFormaPago({ detallePagosACuenta: DETALLE })).toContain(
      "[CONSIGNAR SI SE TRATA DE PAGO ÚNICO O PAGOS A CUENTA, ASÍ COMO EL DETALLE QUE CORRESPONDE EN EL CASO DE PAGO A CUENTA]",
    );
  });

  it("cuenta como hueco pendiente solo si el pago es a cuenta", () => {
    expect(huecosPendientes({ ...A_CUENTA, detallePagosACuenta: "" })).toBe(1);
    expect(huecosPendientes({ ...A_CUENTA, detallePagosACuenta: DETALLE })).toBe(0);
    // En un pago único no es un hueco pendiente: es un campo que no aplica.
    expect(huecosPendientes({ ...COMPLETO, detallePagosACuenta: "" })).toBe(0);
  });

  it("está en la ficha, se guarda y llega al compositor", async () => {
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "formaPagoDetalle")!;
    expect(campo.subgrupo).toBe("Forma de pago (Art. 67 de la Ley)");
    expect(necesidadUpdateSchema.safeParse({ formaPagoDetalle: DETALLE }).success).toBe(true);

    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    const i = fuente.indexOf("const pedirRedactarIA");
    expect(fuente.slice(i, fuente.indexOf("\n  };", i))).toContain("fichaForm.formaPagoDetalle");
  });
});

describe("«Redactar con IA» solo donde hay prosa", () => {
  it("no sale en desplegables, fechas ni números", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/campo-ficha.tsx", "utf-8");
    // El botón solo aparece en PROSA: `esProsa` mira el kind, y el botón se
    // calcula a partir de `admiteRedaccion` (que parte de esProsa).
    expect(fuente).toMatch(/const esProsa =[^\n]*!field\.kind[^\n]*kind === "text"[^\n]*kind === "textarea"/);
    expect(fuente).toMatch(/const botonRedactarIA =[^\n]*admiteRedaccion/);
  });
});
