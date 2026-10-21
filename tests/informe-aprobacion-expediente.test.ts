import { describe, expect, it } from "vitest";
import {
  construirInformeAprobacion,
  type DatosInformeAprobacion,
} from "@/lib/informe-aprobacion-expediente";
import { FORMATOS_ARCHIVABLES } from "@/lib/archivar-formato";

const BASE: DatosInformeAprobacion = {
  areaUsuaria: "GERENCIA DE DESARROLLO ECONOMICO",
  certificacionCredito: "S/. 58,500.00",
  copia: { cargo: "Gerente General", nombre: "ING. WELLINTONG LOPEZ PILLCO" },
  destinatario: { cargo: "Gerente municipal", nombre: "CPC. SAUL QUISPE CHIPANA" },
  emisor: { cargo: "Jefe de la Oficina de Abastecimiento", nombre: "MAG. JUAN ROJAS MAYTAN" },
  fecha: "17 de marzo del 2026",
  lugar: "Challhuahuacho",
  modalidadPago: "SUMA ALZADA",
  numeroInforme: "INFORME N° 87-2026-MDCH-OGA-OL-JRM",
  numeroPac: "S/N",
  objeto: "ADQUISICION DE ALAMBRE DE ACERO, CON CUI N° 2614417.",
  referencia: "SUBASTA INVERSA ELECTRONICA Nº 28-2026-DEC-MDCH-1",
  tipoProcedimiento: "SUBASTA INVERSA ELECTRONICA Nº 28-2026-DEC-MDCH-1",
  valorCuantia: "S/. 58,500.00",
  requerimientoEstandarizado: "SÍ (ficha de homologación o ficha técnica vigente)",
  compatibilizacion: "",
  designacionEvaluadores: "MEMO N° 45-2026-DEC-MDCH",
  cmn: "Versión 3 · 2026",
  esNoCompetitivo: false,
  noCompetitivo: null,
  vieneDeDesierto: false,
  delegacion: null,
};

async function textoDelDocx(buffer: Buffer): Promise<string> {
  const { default: JSZip } = (await import("jszip")) as unknown as {
    default: {
      loadAsync: (b: Buffer) => Promise<{
        file: (p: string) => { async: (t: "string") => Promise<string> } | null;
      }>;
    };
  };
  const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml")!.async("string");
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("\n");
}

describe("informe de aprobación del expediente", () => {
  it("produce un .docx válido con una sola tabla, como el modelo", async () => {
    const buffer = await construirInformeAprobacion(BASE);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
    const { default: JSZip } = (await import("jszip")) as never as {
      default: { loadAsync: (b: Buffer) => Promise<{ file: (p: string) => { async: (t: "string") => Promise<string> } } > };
    };
    const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml").async("string");
    expect((xml.match(/<w:tbl>/g) ?? []).length).toBe(1);
  });

  it("lleva la cabecera del modelo: A, ATENCION, DE, Asunto, Referencia y Fecha", async () => {
    // El modelo la llamaba "C/C". Se renombró a ATENCION porque es lo que la
    // línea contiene: la gerencia de la entidad a cuya atención va el informe,
    // no una copia de cortesía. El destinatario va como "A" (no "AL"), y la
    // etiqueta va sin tilde ("ATENCION"), como en el membrete de la entidad.
    const { contenidoInformeAprobacion } = await import("@/lib/informe-aprobacion-contenido");
    const etiquetas = contenidoInformeAprobacion(BASE).flatMap((b) => (b.tipo === "cabecera" ? [b.etiqueta] : []));
    expect(etiquetas).toEqual(["A", "ATENCION", "DE"]);
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    for (const etiqueta of ["ATENCION", "DE", "Asunto", "REFERENCIA", "Fecha"]) {
      expect(texto, etiqueta).toContain(etiqueta);
    }
    expect(texto).toContain("SOLICITO APROBACION DE EXPEDIENTE DE CONTRATACIÓN");
    expect(texto).toContain("Challhuahuacho, 17 de marzo del 2026");
  });

  it("cierra la cabecera con una línea justo debajo de la Fecha", async () => {
    // El formato de la entidad separa la cabecera del cuerpo con una regla de
    // borde a borde inmediatamente después de la Fecha.
    const { contenidoInformeAprobacion } = await import("@/lib/informe-aprobacion-contenido");
    const bloques = contenidoInformeAprobacion(BASE);
    const iFecha = bloques.findIndex(
      (b) => b.tipo === "parrafo" && b.fragmentos.some((f) => f.texto.startsWith("Fecha")),
    );
    expect(iFecha).toBeGreaterThan(-1);
    expect(bloques[iFecha + 1]?.tipo).toBe("linea");
  });

  it("cuando la aprobación es delegada, cita la resolución (Art. 25.2)", async () => {
    const texto = await textoDelDocx(
      await construirInformeAprobacion({
        ...BASE,
        delegacion: { resolucion: "012-2026-MDCH/GM", fecha: "1 de agosto del 2026" },
      }),
    );
    expect(texto).toContain("por delegación");
    expect(texto).toContain("Resolución N° 012-2026-MDCH/GM");
    expect(texto).toContain("numeral 25.2");
  });

  it("sin delegación, no mete la constancia del Art. 25.2", async () => {
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(texto).not.toContain("por delegación");
  });

  it("cita los artículos que cita el modelo", async () => {
    // El cuerpo es cita legal literal: si alguien lo "mejora", esto lo detecta.
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    for (const cita of ["Artículo 51", "54.1.", "54.2.", "54.3.", "Artículo 63", "32069", "009-2025-EF"]) {
      expect(texto, cita).toContain(cita);
    }
  });

  it("enumera los siete literales del Art. 54.2", async () => {
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    for (const literal of [
      "El requerimiento final",
      "compatibilización del requerimiento",
      "La estrategia de contratación",
      "La cuantía de la contratación.",
      "designado a los evaluadores",
      "certificación de crédito presupuestario",
      "Otra documentación necesaria",
    ]) {
      expect(texto, literal).toContain(literal);
    }
  });

  it("la tabla trae las siete filas del modelo con sus valores", async () => {
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    for (const fila of [
      "OBJETO DE LA CONVOCATORIA",
      "AREA USUARIA",
      "VALOR DE LA CUANTIA",
      "CERTIFICACION CREDITO PRESUPUESTARIO",
      "TIPO DEL PROCEDIMIENTO DE SELECCIÓN",
      "N° DE PAC",
      "MODALIDAD DE PAGO",
    ]) {
      expect(texto, fila).toContain(fila);
    }
    expect(texto).toContain("S/. 58,500.00");
    expect(texto).toContain("SUMA ALZADA");
  });

  it("cierra con la despedida del modelo", async () => {
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(texto).toContain("Es cuanto puedo informar a Ud.");
    expect(texto).toContain("Atentamente,");
  });

  it("los datos que faltan salen con guion, no en blanco", async () => {
    // En un documento que se lleva a firmar, un hueco visible dice "falta esto";
    // un blanco pasa inadvertido y se firma incompleto.
    const texto = await textoDelDocx(
      await construirInformeAprobacion({
        ...BASE,
        certificacionCredito: "",
        modalidadPago: "",
        tipoProcedimiento: "",
      }),
    );
    expect(texto).toContain("—");
    expect(texto).toContain("CERTIFICACION CREDITO PRESUPUESTARIO");
  });

  it("sin número de informe deja el hueco para escribirlo a mano", async () => {
    const texto = await textoDelDocx(
      await construirInformeAprobacion({ ...BASE, numeroInforme: "" }),
    );
    expect(texto).toContain("INFORME N° ______");
  });

  it("un expediente sin ningún dato de fase no revienta", async () => {
    const vacio: DatosInformeAprobacion = {
      areaUsuaria: "",
      certificacionCredito: "",
      copia: null,
      destinatario: { cargo: "", nombre: "" },
      emisor: { cargo: "", nombre: "" },
      fecha: "",
      lugar: "",
      modalidadPago: "",
      numeroInforme: "",
      numeroPac: "",
      objeto: "",
      referencia: "",
      tipoProcedimiento: "",
      valorCuantia: "",
      requerimientoEstandarizado: "",
      compatibilizacion: "",
      designacionEvaluadores: "",
      cmn: "",
      esNoCompetitivo: false,
      noCompetitivo: null,
      vieneDeDesierto: false,
      delegacion: null,
    };
    const buffer = await construirInformeAprobacion(vacio);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});

describe("archivado del informe", () => {
  it("entra como informe, no como acta", () => {
    // El acta es el Anexo N° 2, que es el acto APROBATORIO. Este solo lo pide:
    // darlo por aprobación cerraría una etapa que sigue esperando la firma.
    const f = FORMATOS_ARCHIVABLES["A8|informe_aprobacion"];
    expect(f.kind).toBe("informe");
    expect(f.paso).toBe("A8");
    expect(FORMATOS_ARCHIVABLES["A8|anexo2"].kind).toBe("acta");
  });
});

describe("acredita los siete literales del Art. 54.2", () => {
  it("la tabla trae lo que el cuerpo enumera", async () => {
    // El modelo listaba siete literales y la tabla probaba cuatro: quien firma
    // leía "el expediente contiene estas siete cosas" y veía menos de la mitad.
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(texto).toContain("REQUERIMIENTO ESTANDARIZADO"); // literal a)
    expect(texto).toContain("DESIGNACIÓN DE EVALUADORES"); // literal e)
    expect(texto).toContain("MEMO N° 45-2026-DEC-MDCH");
  });

  it("acredita el CMN, que es lo que exige el Art. 54.3 — no el PAC", async () => {
    // CMN y PAC no son lo mismo: el 54.3 pide que la necesidad esté prevista en
    // el CMN, y el modelo solo traía el número de PAC.
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(texto).toContain("INCLUIDA EN EL CMN");
    expect(texto).toContain("Versión 3 · 2026");
  });

  it("la compatibilización solo sale cuando corresponde (literal b)", async () => {
    const sin = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(sin).not.toContain("COMPATIBILIZACIÓN");
    const con = await textoDelDocx(
      await construirInformeAprobacion({ ...BASE, compatibilizacion: "INFORME N° 12-2026" }),
    );
    expect(con).toContain("COMPATIBILIZACIÓN DEL REQUERIMIENTO");
  });

  it("ya no insinúa un corte falso en el 54.3", async () => {
    // El 54.3 es una sola frase completa; el modelo le ponía "(…)".
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(texto).toContain("CMN aprobado del año fiscal correspondiente o su modificatoria.");
    expect(texto).not.toContain("o su modificatoria. (…)");
  });
});

describe("se adapta al procedimiento", () => {
  const noComp = {
    ...BASE,
    esNoCompetitivo: true,
    noCompetitivo: {
      aprobador: "Titular de la entidad",
      articuloAprobador: "Art. 102.2",
      causal: "b) Situación de emergencia (ocurrencia o inminencia)",
    },
  };

  it("en competitivo se apoya en el Art. 63", async () => {
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(texto).toContain("Artículo 63");
    expect(texto).not.toContain("101.2");
  });

  it("en NO competitivo cambia al 101.2: no hay convocatoria", async () => {
    const texto = await textoDelDocx(await construirInformeAprobacion(noComp));
    expect(texto).toContain("101.2");
    expect(texto).toContain("invitación al proveedor identificado");
    // El Art. 63 habla de CONVOCAR, y ahí no se convoca.
    expect(texto).not.toContain("Para convocar un procedimiento de selección");
  });

  it("en NO competitivo añade el bloque del Art. 102", async () => {
    const texto = await textoDelDocx(await construirInformeAprobacion(noComp));
    expect(texto).toContain("Art. 102.2");
    expect(texto).toContain("Titular de la entidad");
    expect(texto).toContain("informes técnico y legal");
    expect(texto).toContain("emergencia");
  });

  it("en NO competitivo no pide la designación de evaluadores", async () => {
    // El Art. 101.2 dice que no se designan: exigir el documento sería pedir
    // algo que la norma declara inexistente.
    const texto = await textoDelDocx(await construirInformeAprobacion(noComp));
    expect(texto).not.toContain("DESIGNACIÓN DE EVALUADORES");
  });

  it("menciona el Art. 54.4 solo si viene de un desierto", async () => {
    const normal = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(normal).not.toContain("54.4");
    const desierto = await textoDelDocx(
      await construirInformeAprobacion({ ...BASE, vieneDeDesierto: true }),
    );
    expect(desierto).toContain("54.4");
    expect(desierto).toContain("no requiere una nueva aprobación");
  });
});


describe("la cabecera sale de los campos del paso", () => {
  it("el ATENCIÓN trae la gerencia de la entidad, con su cargo debajo", async () => {
    // Antes se buscaba un perfil con rol `aga`. En una municipalidad distrital
    // el gerente municipal no usa la aplicación, así que ese perfil no existe y
    // la línea salía en blanco en un documento que se lleva a firmar. El dato sí
    // estaba: en Configuración → Municipalidad.
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(texto).toContain("ING. WELLINTONG LOPEZ PILLCO");
    expect(texto).toContain("Gerente General");
  });

  it("sin ATENCIÓN no imprime una línea vacía", async () => {
    // Una etiqueta sin nombre debajo se lee como un olvido.
    const texto = await textoDelDocx(await construirInformeAprobacion({ ...BASE, copia: null }));
    expect(texto).not.toContain("ATENCION");
  });

  it("el número del informe se imprime tal cual viene del paso", async () => {
    // El campo ya trae el formato completo, igual que en A2: no se recompone.
    const texto = await textoDelDocx(await construirInformeAprobacion(BASE));
    expect(texto).toContain("INFORME N° 87-2026-MDCH-OGA-OL-JRM");
  });
});

describe("forma del documento", () => {
  it("interlineado 1.15 en todo el cuerpo", async () => {
    // 240 es sencillo; 276 es 1.15.
    const buffer = await construirInformeAprobacion(BASE);
    const { default: JSZip } = (await import("jszip")) as never as {
      default: { loadAsync: (b: Buffer) => Promise<{ file: (p: string) => { async: (t: "string") => Promise<string> } }> };
    };
    const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml").async("string");
    const interlineados = [...xml.matchAll(/w:line="(\d+)"/g)].map((m) => m[1]);
    expect(interlineados.length).toBeGreaterThan(10);
    expect([...new Set(interlineados)]).toEqual(["276"]);
  });

  it("las citas legales van en cursiva y las etiquetas en negrita", async () => {
    const buffer = await construirInformeAprobacion(BASE);
    const { default: JSZip } = (await import("jszip")) as never as {
      default: { loadAsync: (b: Buffer) => Promise<{ file: (p: string) => { async: (t: "string") => Promise<string> } }> };
    };
    const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml").async("string");
    // Distinguir cita de redacción propia importa: quien firma tiene que ver de
    // un vistazo qué transcribe la norma y qué afirma la entidad.
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain("<w:b/>");
  });

  it("la cabecera usa tabulación, no espacios, para alinear los dos puntos", async () => {
    // Arial no es monoespaciada: con espacios, AL / ATENCIÓN / DE quedaban
    // escalonados.
    const buffer = await construirInformeAprobacion(BASE);
    const { default: JSZip } = (await import("jszip")) as never as {
      default: { loadAsync: (b: Buffer) => Promise<{ file: (p: string) => { async: (t: "string") => Promise<string> } }> };
    };
    const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml").async("string");
    expect(xml).toContain("<w:tab");
    expect(xml).toContain("w:tabs");
  });
});

describe("la vista previa dice lo mismo que el documento", () => {
  it("los dos salen del mismo compositor de bloques", async () => {
    // Es lo único que hace útil a la previa: si compusieran el texto por
    // separado, podría enseñar una cosa y descargarse otra.
    const { contenidoInformeAprobacion } = await import("@/lib/informe-aprobacion-contenido");
    const bloques = contenidoInformeAprobacion(BASE);
    const delDocx = await textoDelDocx(await construirInformeAprobacion(BASE));

    const textos = bloques.flatMap((b) => {
      if (b.tipo === "parrafo") return b.fragmentos.map((f) => f.texto);
      if (b.tipo === "vinetas") return b.items;
      if (b.tipo === "tabla") return b.filas.flatMap((f) => [f.etiqueta, f.valor]);
      if (b.tipo === "cabecera") return [b.nombre, b.cargo];
      if (b.tipo === "titulo" || b.tipo === "subtitulo") return [b.texto];
      return [];
    });

    for (const t of textos.filter((x) => x.trim().length > 3)) {
      expect(delDocx, t.slice(0, 40)).toContain(t.trim());
    }
  });

  it("la tabla de la previa marca lo que falta con guion", async () => {
    const { contenidoInformeAprobacion } = await import("@/lib/informe-aprobacion-contenido");
    const bloques = contenidoInformeAprobacion({ ...BASE, modalidadPago: "", cmn: "" });
    const tabla = bloques.find((b) => b.tipo === "tabla");
    const vacias = tabla?.tipo === "tabla" ? tabla.filas.filter((f) => f.valor === "—") : [];
    expect(vacias.map((f) => f.etiqueta)).toContain("MODALIDAD DE PAGO");
    expect(vacias.map((f) => f.etiqueta)).toContain("INCLUIDA EN EL CMN");
  });
});
