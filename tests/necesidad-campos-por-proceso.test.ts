import { FICHA_SECCIONES, campoAplica, campoObligatorio, objetosEfectivosDe, type FichaField } from "@/lib/necesidad-ficha-secciones";
import { describe, expect, it } from "vitest";

// Eje de aplicabilidad POR PROCEDIMIENTO de la ficha de necesidad.
//
// Hasta ahora la ficha solo filtraba por OBJETO (bienes/servicios/obras), y por
// eso campos que solo aplican a un procedimiento concreto —el código de catálogo
// de la Subasta Inversa, el costo unitario de la Comparación de Precios— parecían
// "campos muertos" al mirar su consumo global. La lección que fija este test es
// que la respuesta a "nadie lo usa" no es borrarlo, sino declarar DÓNDE se usa.

const SIE = "Subasta Inversa Electrónica";
const CP = "Comparación de Precios";
const LP_BIENES = "Licitación Pública para bienes";

const campo = (api: string): FichaField => {
  for (const s of FICHA_SECCIONES) {
    const f = s.fields.find((x) => x.api === api);
    if (f) return f;
  }
  throw new Error(`Campo no encontrado en la ficha: ${api}`);
};

describe("objetosEfectivosDe", () => {
  it("el procedimiento acota el objeto cuando el declarado cae dentro", () => {
    expect(objetosEfectivosDe(LP_BIENES, "bienes")).toEqual(["bienes"]);
  });

  it("sin procedimiento manda el objeto declarado", () => {
    expect(objetosEfectivosDe("", "servicios")).toEqual(["servicios"]);
  });

  it("sin procedimiento ni objeto no hay con qué acotar", () => {
    expect(objetosEfectivosDe("", undefined)).toEqual([]);
  });

  it("si el objeto declarado no pertenece al procedimiento, manda el ámbito del procedimiento", () => {
    // Comparación de Precios admite bienes y servicios; obras no.
    expect(objetosEfectivosDe(CP, "obras")).toEqual(["bienes", "servicios"]);
  });
});

describe("campoObligatorio · eje por procedimiento", () => {
  it("el costo unitario se exige donde la puja/comparación es unitaria", () => {
    expect(campoObligatorio(campo("costoUnitario"), ["bienes"], SIE)).toBe(true);
    expect(campoObligatorio(campo("costoUnitario"), ["bienes"], CP)).toBe(true);
    expect(campoObligatorio(campo("costoUnitario"), ["bienes"], LP_BIENES)).toBe(false);
  });

  it("el año de referencia se exige donde el precio manda (Art. 47.1)", () => {
    expect(campoObligatorio(campo("anioReferencia"), ["bienes"], CP)).toBe(true);
    expect(campoObligatorio(campo("anioReferencia"), ["bienes"], LP_BIENES)).toBe(false);
  });

  it("sin procedimiento elegido, el condicional por proceso no se activa", () => {
    expect(campoObligatorio(campo("costoUnitario"), ["bienes"], "")).toBe(false);
  });

  it("el código de catálogo ya no es un campo de cabecera: va por ítem", () => {
    // La Subasta Inversa exige la ficha técnica del Listado, pero un pedido de
    // varias líneas tiene un código por prestación y en la cabecera solo cabía
    // uno. El campo queda oculto (la columna se conserva) y la exigencia se
    // comprueba en el cuadro con `itemsSinCodigoCatalogo`.
    expect(campo("codigoCatalogo").oculto).toBe(true);
    expect(campo("codigoCatalogo").obligatorioEnProceso).toBeUndefined();
  });

  it("el obligatorio por OBJETO sigue funcionando junto al de proceso", () => {
    // `sistemaEntrega` se exige en obras/consultoría por `obligatorioPara`.
    const f = campo("sistemaEntrega");
    expect(campoObligatorio(f, ["obras"], "")).toBe(true);
    expect(campoObligatorio(f, ["servicios"], "")).toBe(false);
  });
});

describe("campoAplica", () => {
  it("un campo sin restricciones aplica siempre", () => {
    expect(campoAplica(campo("finalidadPublica"), ["bienes"], LP_BIENES)).toBe(true);
  });

  it("respeta el filtro por objeto", () => {
    // Metas físicas es de obras/consultoría de obra.
    expect(campoAplica(campo("metasFisicas"), ["obras"], "")).toBe(true);
    expect(campoAplica(campo("metasFisicas"), ["bienes"], "")).toBe(false);
  });

  it("sin objeto ni proceso no se oculta nada: quien aún no eligió debe verlo", () => {
    expect(campoAplica(campo("metasFisicas"), [], "")).toBe(true);
  });
});

describe("los duplicados del Art. 72.3 ya no están en la ficha", () => {
  it("experiencia del postor y personal clave viven solo en el editor de requisitos", () => {
    const apis = FICHA_SECCIONES.flatMap((s) => s.fields.map((f) => f.api));
    expect(apis).not.toContain("experienciaRequerida");
    expect(apis).not.toContain("personalClave");
    expect(apis).toContain("requisitosCalificacion");
  });
});

describe("la sección 3.3 sigue el orden y las letras del requerimiento modelo", () => {
  // El PDF-modelo de Concurso Público de servicios rotula su 3.3 con apartados
  // a-j: a. modalidad de pago, b. sistema de entrega, c. plazo de prestación,
  // d. lugar de prestación, e. adelanto directo, f. penalidades,
  // g. subcontratación, h. fórmulas de reajuste, i. solución de controversias,
  // j. plazo para respuestas entre las partes. La ficha usaba las letras del
  // Art. 44.2 del Reglamento —otra numeración— y quien trasladaba tenía que
  // reordenar de cabeza.
  const seccion33 = () => {
    const s = FICHA_SECCIONES.find((x) => x.title.startsWith("3.3"));
    if (!s) throw new Error("Falta la sección 3.3");
    return s;
  };
  const objetos = objetosEfectivosDe("Concurso Público de servicios", "servicios");
  const subgruposVisibles = () => {
    const vistos: string[] = [];
    for (const f of seccion33().fields) {
      if (f.oculto || !campoAplica(f, objetos, "Concurso Público de servicios")) continue;
      const sub = f.subgrupo ?? "";
      if (sub && vistos[vistos.length - 1] !== sub) vistos.push(sub);
    }
    return vistos;
  };

  it("los apartados con letra van en el orden del modelo", () => {
    expect(subgruposVisibles().slice(0, 10)).toEqual([
      "a) Modalidad de pago",
      "b) Sistema de entrega",
      "c) Plazo de prestación",
      "d) Lugar de prestación",
      "e) Adelanto directo",
      "f) Penalidades",
      "g) Subcontratación",
      "h) Fórmula de reajuste",
      "i) Solución de controversias contractuales",
      "j) Plazo para respuestas entre las partes",
    ]);
  });

  it("lo que el modelo no numera va DESPUÉS y con rótulo propio", () => {
    // Son exigencias del Art. 44.2 que el 3.3 del modelo no lista con letra;
    // mezclarlas en la secuencia a-j haría creer que también están numeradas.
    const resto = subgruposVisibles().slice(10);
    expect(resto.every((s) => !/^[a-j]\)/.test(s))).toBe(true);
    expect(resto).toContain("Alcance y condiciones de ejecución (Art. 44.2.a)");
  });

  it("el lugar de prestación es el apartado d) del 3.3, no una sección aparte", () => {
    // Estaba como sección propia colocada después del 3.5.1.
    expect(FICHA_SECCIONES.some((s) => s.title === "Lugar de entrega")).toBe(false);
    const lugar = seccion33().fields.filter((f) => f.subgrupo === "d) Lugar de prestación");
    expect(lugar.map((f) => f.api)).toEqual(["departamento", "provincia", "distrito", "lugarEntrega"]);
  });

  it("ninguna etiqueta arrastra una letra propia: la pone el subgrupo", () => {
    for (const f of seccion33().fields) {
      expect(f.label, `«${f.label}» lleva la letra en la etiqueta`).not.toMatch(/^[a-j]\)\s/);
    }
  });

  it("no hay una sección 3.5.2 de adicionales: era dato muerto y se retiró", () => {
    // El textarea libre `requisitos_adicionales` no lo consumía nadie (ni el
    // requerimiento, ni A4, ni la estrategia) y estaba vacío en todas las
    // necesidades. Los facultativos se proponen en el editor de 3.5 marcando un
    // tipo del 72.3 como "Facultativo".
    expect(FICHA_SECCIONES.some((x) => x.title.startsWith("3.5.2"))).toBe(false);
    expect(FICHA_SECCIONES.every((x) => !x.fields.some((f) => f.api === "requisitosAdicionales"))).toBe(true);
  });

  it("la experiencia del personal clave está en el editor de 3.5, con la del postor", () => {
    const s = FICHA_SECCIONES.find((x) => x.title.startsWith("3.5 Requisitos"));
    expect(s?.fields.map((f) => f.api)).toContain("personalClaveExperiencia");
  });
});

describe("los campos del 3.3 encajan con lo que el modelo pide en cada apartado", () => {
  const objetos = objetosEfectivosDe("Concurso Público de servicios", "servicios");
  const campo33 = (api: string) => {
    const s = FICHA_SECCIONES.find((x) => x.title.startsWith("3.3"));
    const f = s?.fields.find((x) => x.api === api);
    if (!f) throw new Error(`Falta ${api} en el 3.3`);
    return f;
  };
  const visible = (api: string) => campoAplica(campo33(api), objetos, "Concurso Público de servicios");

  it("el plazo de respuesta entre las partes es un número de días, no un párrafo", () => {
    // Apartado j) del modelo: «Plazo máximo de respuesta: [CONSIGNAR EL PLAZO EN
    // DÍAS CALENDARIO]». Estaba como textarea de 600 caracteres.
    expect(campo33("plazoRespuestas").kind).toBe("number");
  });

  it("las penalidades son DOS campos: la mora y las demás", () => {
    // Art. 119.1: el contrato establece la penalidad por mora Y otras penalidades.
    // El apartado f) del modelo trae un cuadro para estas últimas.
    expect(campo33("otrasPenalidades").baseLegal).toMatch(/119\.1/);
    expect(campo33("penalidadMora").baseLegal).toMatch(/Art\.\s*120/);
    for (const f of [campo33("penalidadMora"), campo33("otrasPenalidades")]) {
      expect(f.subgrupo).toBe("f) Penalidades");
    }
  });

  it("modalidad de pago y sistema de entrega remiten a los Arts. 130 y 129", () => {
    // Son las listas cerradas que el modelo cita en sus apartados a) y b), pero
    // lo que los hace contenido del requerimiento es el Art. 44.2.c: por eso va
    // primero, que es el que lee la insignia del campo.
    expect(campo33("modalidadPago").baseLegal).toMatch(/^Art\. 44\.2\.c/);
    expect(campo33("modalidadPago").baseLegal).toMatch(/Art\. 130/);
    expect(campo33("sistemaEntrega").baseLegal).toMatch(/^Art\. 44\.2\.c/);
    expect(campo33("sistemaEntrega").baseLegal).toMatch(/Art\. 129/);
  });

  it("la fórmula de reajuste remite al numeral 136.2, que es el que la regula", () => {
    expect(campo33("formulaReajuste").baseLegal).toMatch(/136\.2/);
  });

  it("equipamiento, habilitaciones y riesgos NO son solo de obras", () => {
    // El Art. 44.2.d (equipamiento, permisos y demás recursos) y el 44.3 (riesgos)
    // valen para todo requerimiento; estaban restringidos a obras y no aparecían
    // en una ficha de servicios.
    for (const api of ["equipamientoMinimo", "habilitaciones", "gestionRiesgos"]) {
      expect(campo33(api).mostrarPara, api).toBeUndefined();
      expect(visible(api), api).toBe(true);
    }
  });

  it("los apartados que el modelo redacta con fórmula llevan plantilla", () => {
    // El modelo no pide texto libre: da la frase con huecos. Sin plantilla, el
    // área usuaria improvisa y luego no encaja al trasladar al documento.
    for (const api of ["adelantoDirecto", "formulaReajuste"]) {
      expect(campo33(api).plantilla, api).toMatch(/\[.+?\]/);
    }
  });

  it("la solución de controversias se captura estructurada, no con plantilla", () => {
    // Dejó de necesitar frase con huecos al pasar a tener su propio cuadro de
    // instituciones arbitrales: los datos se capturan y el apartado se compone
    // solo. Una plantilla con corchetes volvería a invitar a escribir a mano lo
    // que el editor ya sabe montar.
    const campo = campo33("solucionControversias");
    expect(campo.kind).toBe("controversias");
    expect(campo.plantilla).toBeUndefined();
    // Y cita los artículos que de verdad aplican: conciliación/arbitraje
    // (330/331) y —el mecanismo del cuadro— la lista de instituciones que
    // propone la entidad y elige el postor, con inscripción en el REGAJU (332).
    // El 224 es de contratos estandarizados de ingeniería y construcción.
    expect(campo.baseLegal).toMatch(/330|331/);
    expect(campo.baseLegal).toMatch(/332/);
    expect(campo.baseLegal).toMatch(/REGAJU/);
  });

  it("las otras penalidades se capturan en cuadro y siguen siendo opcionales", () => {
    // El modelo trae un cuadro de tres columnas (supuesto, calculo,
    // verificacion), no una frase con huecos. Y es OPCIONAL: un requerimiento
    // sin otras penalidades es valido, asi que no puede volverse obligatorio.
    const campo = campo33("otrasPenalidades");
    expect(campo.kind).toBe("penalidades");
    expect(campo.plantilla).toBeUndefined();
    expect(campo.obligatorio).toBeFalsy();
    // El tope del 10% es del Art. 119.2 y no se deja a criterio de quien redacta.
    expect(campo.baseLegal).toMatch(/119/);
  });

  it("las otras penalidades acompañan a la penalidad por mora", () => {
    // El modelo las presenta juntas: «Adicionalmente a la penalidad por mora,
    // se aplican las siguientes penalidades». Sin `juntoA` quedaban escondidas
    // tras «Mostrar N campos opcionales» y no se encontraban.
    expect(campo33("otrasPenalidades").juntoA).toBe("penalidadMora");
  });

  it("el adelanto directo recuerda el tope del 30%", () => {
    expect(campo33("adelantoDirecto").plantilla).toMatch(/30\s*%/);
  });
});

describe("las secciones 3.4 y 3.5 recogen lo que el modelo exige", () => {
  const objetos = objetosEfectivosDe("Concurso Público de servicios", "servicios");
  const seccion = (prefijo: string) => {
    const s = FICHA_SECCIONES.find((x) => x.title.startsWith(prefijo));
    if (!s) throw new Error(`Falta la sección ${prefijo}`);
    return s;
  };
  const visibles = (prefijo: string) =>
    seccion(prefijo).fields.filter((f) => !f.oculto && campoAplica(f, objetos, "Concurso Público de servicios"));

  it("el 3.4 no es solo el TDR: trae las tres precisiones del modelo", () => {
    // El apartado exige además identificar la ficha técnica u homologación que se
    // use (Art. 260), las normas técnicas aplicables (44.5) y el documento de
    // compatibilización (44.6). Las prestaciones accesorias NO están aquí: el
    // formato pide consignarlas en el 3.2, y en el 3.4 solo va su detalle técnico.
    expect(visibles("3.4").map((f) => f.api)).toEqual([
      "descripcionDetallada",
      "fichaTecnicaIdentificacion",
      "normasTecnicas",
      "compatibilizacion",
    ]);
  });

  it("cada precisión del 3.4 cita su artículo", () => {
    const esperado: Record<string, RegExp> = {
      compatibilizacion: /Art\.\s*44\.6/,
      fichaTecnicaIdentificacion: /Art\.\s*260/,
      normasTecnicas: /Art\.\s*44\.5/,
    };
    for (const [api, re] of Object.entries(esperado)) {
      const f = visibles("3.4").find((x) => x.api === api);
      expect(f?.baseLegal, api).toMatch(re);
    }
  });

  it("el 3.4 advierte que los requisitos de calificación NO van ahí", () => {
    // Es la prohibición expresa del modelo, y es el error típico: colar la
    // experiencia del proveedor entre las características del servicio.
    expect(seccion("3.4").nota).toMatch(/no van los requisitos de calificaci[oó]n/i);
  });

  it("el 3.5 recuerda los dos topes del formato", () => {
    const nota = seccion("3.5 Requisitos").nota ?? "";
    expect(nota).toMatch(/TRES VECES/);
    expect(nota).toMatch(/QUINCE/);
  });

  it("el 3.5 explica que los facultativos son opcionales, con sustento", () => {
    expect(seccion("3.5 Requisitos").nota).toMatch(/facultativ/i);
  });
});

describe("las secciones 3.1 y 3.2 recogen lo que el modelo exige", () => {
  const objetos = objetosEfectivosDe("Concurso Público de servicios", "servicios");
  const seccion = (prefijo: string) => {
    const s = FICHA_SECCIONES.find((x) => x.title.startsWith(prefijo));
    if (!s) throw new Error(`Falta la sección ${prefijo}`);
    return s;
  };
  const visibles = (prefijo: string) =>
    seccion(prefijo).fields.filter((f) => !f.oculto && campoAplica(f, objetos, "Concurso Público de servicios"));

  it("el 3.2 abre con la descripción general, que es lo que el modelo pide", () => {
    // «INDICAR LA DESCRIPCIÓN GENERAL DEL REQUERIMIENTO, INCLUYENDO LOS ÍTEMS O
    // PAQUETES». No existía: había nombre de catálogo y cuadro de ítems, pero
    // ningún sitio donde describir el requerimiento en conjunto.
    const apis = visibles("3.2").map((f) => f.api);
    expect(apis[0]).toBe("descripcionGeneral");
    expect(seccion("3.2").fields.find((f) => f.api === "descripcionGeneral")?.obligatorio).toBe(true);
  });

  it("las prestaciones accesorias se consignan en el 3.2, no en el 3.4", () => {
    // «EN CASO LA PRESTACIÓN PRINCIPAL CONLLEVE PRESTACIONES ACCESORIAS,
    // CONSIGNARLAS» está en el 3.2 del formato; el 3.4 solo pide su detalle.
    expect(visibles("3.2").map((f) => f.api)).toContain("prestacionesAccesorias");
    expect(visibles("3.4").map((f) => f.api)).not.toContain("prestacionesAccesorias");
  });

  it("el 3.2 avisa de que la descripción técnica no va ahí", () => {
    expect(seccion("3.2").nota).toMatch(/no va aqu[ií]|es el 3\.4/i);
  });

  it("la finalidad pública conserva la fórmula del Art. 44.1", () => {
    // Es la sección que más se improvisa; la plantilla es lo que la sostiene.
    const f = visibles("3.1")[0];
    expect(f.api).toBe("finalidadPublica");
    expect(f.obligatorio).toBe(true);
    expect(f.plantilla).toMatch(/necesidad/i);
    expect(f.plantilla).toMatch(/finalidad p[uú]blica/i);
    expect(f.plantilla).toMatch(/valor por dinero/i);
  });
});

describe("Identificación y Programación: agrupación y anclaje legal", () => {
  const objetos = objetosEfectivosDe("Concurso Público de servicios", "servicios");
  const seccion = (titulo: string) => {
    const s = FICHA_SECCIONES.find((x) => x.title.startsWith(titulo));
    if (!s) throw new Error(`Falta la sección ${titulo}`);
    return s;
  };
  const visibles = (titulo: string) =>
    seccion(titulo).fields.filter((f) => !f.oculto && campoAplica(f, objetos, "Concurso Público de servicios"));

  it("el presupuesto va agrupado, no en una lista corrida de veinte campos", () => {
    const subgrupos: string[] = [];
    for (const f of visibles("Programación")) {
      const s = f.subgrupo ?? "";
      if (s && subgrupos[subgrupos.length - 1] !== s) subgrupos.push(s);
    }
    expect(subgrupos).toEqual([
      "a) Programación en el CMN y el PAC",
      "b) Inversión a la que se imputa",
      "c) Financiamiento",
      "d) Cuantía de la contratación",
      "e) Fechas del requerimiento",
    ]);
    // Ningún campo se queda fuera de su grupo.
    expect(visibles("Programación").every((f) => Boolean(f.subgrupo))).toBe(true);
  });

  it("el periodo del CMN está con la programación, no en Identificación", () => {
    expect(visibles("Identificación").map((f) => f.api)).not.toContain("periodoProgramacion");
    expect(visibles("Programación").map((f) => f.api)).toContain("periodoProgramacion");
  });

  it("el área usuaria y el responsable se apoyan en el Art. 20.a", () => {
    // Es el artículo que define la función: formular el requerimiento EN
    // COORDINACIÓN CON LA DEC y que esté previsto en el CMN. El 44.2 solo dice
    // que se lo remite, que es un paso posterior.
    for (const api of ["areaUsuaria", "responsable", "periodoProgramacion"]) {
      const f = FICHA_SECCIONES.flatMap((s) => s.fields).find((x) => x.api === api);
      expect(f?.baseLegal, api).toMatch(/Art\.\s*20\.a/);
    }
  });

  it("el monto estimado nombra la cuantía de la Ley, no solo cómo se determina", () => {
    const f = visibles("Programación").find((x) => x.api === "montoEstimado");
    expect(f?.baseLegal).toMatch(/Art\.\s*48/);
    expect(f?.baseLegal).toMatch(/Art\.\s*47\.1/);
  });

  it("la unidad ejecutora ya no se apoya en un «Art. 44» sin numeral", () => {
    const f = visibles("Identificación").find((x) => x.api === "unidadEjecutora");
    expect(f?.baseLegal).not.toMatch(/Art\.\s*44\b/);
  });
});

describe("Verificaciones DEC y Planeamiento", () => {
  const seccion = (titulo: string) => {
    const s = FICHA_SECCIONES.find((x) => x.title.startsWith(titulo));
    if (!s) throw new Error(`Falta la sección ${titulo}`);
    return s;
  };

  it("las cuatro casillas son las letras del Art. 14.2 que tocan al requerimiento", () => {
    // Verificado contra el texto del artículo: c) CMN, d) ficha técnica u
    // homologación o acuerdo marco, e) almacén y patrimonio, j) certificación
    // presupuestal. Las demás letras (a, b, f-i, k) son de otras fases.
    const letras = seccion("Verificaciones DEC").fields.map(
      (f) => (f.baseLegal ?? "").match(/Art\.\s*14\.2\.([a-k])/)?.[1],
    );
    expect(letras).toEqual(["c", "d", "e", "j"]);
  });

  it("el 14.2.d incluye el catálogo de acuerdos marco, no solo las fichas", () => {
    // El artículo verifica TRES vías; omitir el acuerdo marco es omitir una
    // forma de contratar distinta.
    const f = seccion("Verificaciones DEC").fields.find((x) => x.api === "verificacionFichaTecnica");
    expect(f?.label).toMatch(/acuerdo marco/i);
    expect(f?.baseLegal).toMatch(/ACUERDOS MARCO/);
  });

  it("la sección deja claro que lo técnico no lo revisa la DEC", () => {
    // Art. 14.2.b: la participación de la DEC «no alcanza los aspectos técnicos
    // relacionados a la necesidad del área usuaria».
    expect(seccion("Verificaciones DEC").nota).toMatch(/14\.2\.b/);
    expect(seccion("Verificaciones DEC").nota).toMatch(/responsabilidad del [áa]rea usuaria/i);
  });

  it("Planeamiento explica por qué no cita artículo", () => {
    // PEI y POI no aparecen en la Ley 32069 ni en su Reglamento: se comprobó
    // contra `norma_articulos`. Sin la nota, tres campos sin artículo junto a
    // secciones que sí lo citan parecen un descuido.
    const s = seccion("Planeamiento");
    expect(s.nota).toMatch(/aparecen en la Ley 32069/i);
    expect(s.nota).toMatch(/Art\.\s*20\.a/);
    for (const f of s.fields) expect(f.baseLegal, f.api).not.toMatch(/Art\./);
  });
});
