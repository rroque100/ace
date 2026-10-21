import { describe, expect, it } from "vitest";
import { componerOtrasPenalidades } from "@/lib/otras-penalidades";
import { formatRequisitos } from "@/lib/requisitos-calificacion";
import { ACREDITACION_EXPERIENCIA } from "@/lib/requisitos-experiencia";
import { ACREDITACION_PERSONAL_CLAVE, formatPersonalClave } from "@/lib/personal-clave";
import { ACREDITACION_FORMACION_ACADEMICA, formatFilasFormacion } from "@/lib/formacion-academica";
import { generarRequerimientoDocx } from "@/lib/requerimiento-docx";

/**
 * El .docx es un zip de XML, así que se puede comprobar de verdad: se genera y se
 * mira dentro. No se afirma «tiene Arial 10,5» leyendo el código, se lee del
 * documento.
 */
async function xmlDel(docx: Buffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(docx);
  return zip.file("word/document.xml")!.async("string");
}

const BASE = {
  areaUsuaria: "Gerencia de Servicios Públicos",
  codigo: "REQ-2026-0001",
  entidad: "Municipalidad de Prueba",
  fecha: "2026-07-27",
  items: [],
  lugar: "Abancay",
  nombre: "Servicio de mantenimiento de vías",
  responsable: "Juan Pérez",
  // Los que el generador ya recibía sueltos y sigue usando en la cabecera.
  alcance: "", adelantoDirecto: "", cantidad: "", clasificadorGasto: "",
  condicionesEjecucion: "", departamento: "", descripcionDetallada: "",
  distrito: "", finalidadPublica: "", formulaReajuste: "", fuenteFinanciamiento: "",
  garantias: "", lugarEntrega: "", metaPresupuestal: "", modalidadPago: "",
  montoEstimado: "", objetoLabel: "", penalidadMora: "", plazoEjecucion: "",
  provincia: "", recepcionConformidad: "", requisitosCalificacion: "",
  sistemaEntrega: "", subcontratacion: "", unidadMedida: "",
};

describe("formato del documento", () => {
  it("todo el texto va en Arial 10,5", async () => {
    const xml = await xmlDel(await generarRequerimientoDocx({ ...BASE }));
    // 21 medios puntos = 10,5 pt. Es el tamaño que pidió la entidad.
    expect(xml).toContain('w:ascii="Arial"');
    expect(xml).toContain('w:val="21"');
    // Y que no se haya quedado el 10 pt de antes en el estilo por defecto.
    expect(xml).not.toContain('w:val="20"');
  });

  it("los títulos de apartado van en negrita", async () => {
    const xml = await xmlDel(await generarRequerimientoDocx({ ...BASE }));
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("DENOMINACIÓN DE LA CONTRATACIÓN");
  });

  it("la cita legal del apartado va en CURSIVA", async () => {
    const xml = await xmlDel(
      await generarRequerimientoDocx({ ...BASE, apartados: [], ficha: { finalidadPublica: "Operatividad" } }),
    );
    expect(xml).toContain("<w:i/>");
  });

  it("los requisitos de calificación salen en VIÑETAS, no como JSON", async () => {
    const xml = await xmlDel(
      await generarRequerimientoDocx({
        ...BASE,
        apartados: ["3.5 Requisitos de calificación"],
        // Se serializa con la MISMA funcion que usa la ficha: escribir el
        // formato a mano en la prueba es como se cuela un formato que no existe.
        ficha: {
          requisitosCalificacion: formatRequisitos({
            obligatorios: ["Capacidad legal: RNP vigente"],
            facultativos: [{ nombre: "Experiencia", sustento: "3 obras similares" }],
          }),
        },
      }),
    );
    expect(xml).toContain("<w:numPr>"); // la viñeta
    expect(xml).toContain("Capacidad legal: RNP vigente");
    expect(xml).toContain("3 obras similares");
  });

  it("la acreditación de la experiencia lleva el cierre del Anexo 11 en NEGRITA", async () => {
    const xml = await xmlDel(
      await generarRequerimientoDocx({
        ...BASE,
        apartados: ["3.5 Requisitos de calificación"],
        ficha: {
          requisitosCalificacion: formatRequisitos({
            obligatorios: [`Experiencia del postor en la especialidad — Acredita: ${ACREDITACION_EXPERIENCIA}`],
            facultativos: [],
          }),
        },
      }),
    );
    // El `**…**` del texto NO llega al documento: se convierte en negrita real.
    expect(xml).not.toContain("**");
    // El párrafo del Anexo 11 va en un run con <w:b/>.
    const iAnexo = xml.indexOf("Sin perjuicio de lo anterior");
    expect(iAnexo).toBeGreaterThan(-1);
    const runAnexo = xml.lastIndexOf("<w:r>", iAnexo);
    expect(xml.slice(runAnexo, iAnexo)).toContain("<w:b/>");
    // Y los párrafos del texto se separan con saltos de línea, no van pegados.
    expect(xml).toContain("<w:br/>");
    // El primer párrafo, que NO va en negrita, no arrastra el <w:b/>.
    const iPrimero = xml.indexOf("La experiencia del postor en la especialidad se acredita");
    const runPrimero = xml.lastIndexOf("<w:r>", iPrimero);
    expect(xml.slice(runPrimero, iPrimero)).not.toContain("<w:b/>");
  });

  it("la experiencia del personal clave sale en TABLA, un puesto por fila", async () => {
    const xml = await xmlDel(
      await generarRequerimientoDocx({
        ...BASE,
        apartados: ["3.5.1 Requisitos de calificación obligatorios"],
        ficha: {
          personalClaveExperiencia: formatPersonalClave([
            { actividad: "Estructuras", cantidad: "1", tiempo: "tres (3) años", trabajos: "supervisión de montaje", puesto: "Ingeniero residente" },
            { actividad: "Calidad", cantidad: "2", tiempo: "dos (2) años", trabajos: "control de calidad", puesto: "Supervisor de obra" },
          ]),
          personalClaveAcreditacion: ACREDITACION_PERSONAL_CLAVE,
        },
      }),
    );
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("Actividad");
    expect(xml).toContain("Cantidad");
    expect(xml).toContain("Tiempo de experiencia mínimo");
    expect(xml).toContain("Ingeniero residente");
    expect(xml).toContain("Supervisor de obra");
    // El campo está `oculto` en la ficha pero SÍ va al documento (kind personalClave).
    expect(xml).not.toContain("1. Actividad:"); // no vuelca la serialización cruda
    // Y tras el cuadro, el texto de cómo se acredita (Anexo N° 19).
    expect(xml).toContain("Anexo N° 19");
    expect(xml).toContain("periodo traslapado");
  });

  it("la formación académica del personal clave sale en TABLA", async () => {
    const xml = await xmlDel(
      await generarRequerimientoDocx({
        ...BASE,
        apartados: ["3.5.1 Requisitos de calificación obligatorios"],
        ficha: {
          formacionAcademica: formatFilasFormacion([
            { actividad: "Estructuras", grado: "Título profesional de Ingeniero Civil", puesto: "Ingeniero residente" },
          ]),
          formacionAcademicaAcreditacion: ACREDITACION_FORMACION_ACADEMICA,
        },
      }),
    );
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("Grado de bachiller o título profesional requerido");
    expect(xml).toContain("Título profesional de Ingeniero Civil");
    // El requisito se compone con los dos campos de la fila.
    expect(xml).toContain("del personal clave requerido como Ingeniero residente");
    expect(xml).not.toContain("1. Grado:"); // no vuelca la serialización cruda
    // Y tras el cuadro, el texto de cómo se acredita (Anexo N° 19, SUNEDU).
    expect(xml).toContain("SUNEDU");
  });

  it("las penalidades adicionales salen en TABLA", async () => {
    const xml = await xmlDel(
      await generarRequerimientoDocx({
        ...BASE,
        apartados: ["Penalidades"],
        // Serializado con la MISMA funcion que usa la ficha. Escribir el formato
        // a mano fue justo como se me colo uno que no existe: la prueba pasaba
        // por la via de reserva —texto plano— sin llegar nunca a la tabla.
        ficha: {
          otrasPenalidades: componerOtrasPenalidades([
            { calculo: "0.5 UIT", supuesto: "No usar uniforme", verificacion: "Informe del supervisor" },
          ]),
          penalidadMora: "0.10 × monto",
        },
      }),
    );
    expect(xml).toContain("Supuesto de aplicación");
    expect(xml).toContain("No usar uniforme");
  });

  it("nada de lo registrado se queda fuera", async () => {
    // Este es el fallo que se corrigio: el documento salia SOLO con los
    // apartados del modelo, y lo demas que el area usuaria habia registrado
    // desaparecia. Medido sobre datos reales: en REQ-2026-0020 se registraron 29
    // campos y salian 5.
    const xml = await xmlDel(
      await generarRequerimientoDocx({
        ...BASE,
        apartados: ["Modalidad de pago"],
        ficha: {
          cui: "2456789",
          formulaReajuste: "K = 0.4",
          metaPresupuestal: "0034",
          modalidadPago: "Pago único",
        },
      }),
    );
    expect(xml).toContain("Pago único");
    expect(xml).toContain("K = 0.4");
    expect(xml).toContain("2456789");
    expect(xml).toContain("0034");
  });

  it("un apartado que el modelo exige sale aunque este vacio", async () => {
    // Al reves que arriba: en un documento que se firma, lo que el
    // procedimiento pide y nadie relleno vale mas en blanco que desaparecido.
    const xml = await xmlDel(
      await generarRequerimientoDocx({ ...BASE, apartados: ["Subcontratación"], ficha: {} }),
    );
    expect(xml).toContain("Subcontratación");
  });
});
