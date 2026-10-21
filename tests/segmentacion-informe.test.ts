import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildSegmentacionInformeDocx,
  type SegmentacionInformeInput,
} from "@/lib/segmentacion-informe";

const base: SegmentacionInformeInput = {
  entidad: "Municipalidad Distrital de Challhuahuacho",
  areaUsuaria: "Sub Gerencia de Ejecución de Inversiones",
  objeto: "Adquisición de acero corrugado y alambres",
  tipoObjetoLabel: "Bien",
  valorEstimado: 580600,
  plazoDias: 15,
  programada: false,
  referenciaPac: null,
  documentoRequerimiento: "el requerimiento REQ-2026-0001",
  seg: {
    objeto: "bienes_servicios",
    cuantiaAlta: false,
    condicionesRiesgo: [],
    criteriosBasica: [],
    centralizada: false,
  },
};

// Un .docx es un ZIP: debe empezar con la firma "PK".
function esZipValido(buf: Buffer): boolean {
  return buf.length > 0 && buf[0] === 0x50 && buf[1] === 0x4b;
}

// XML crudo del .docx: para comprobar formato, no contenido. El pie de página
// vive en su propio archivo (word/footer1.xml), no en document.xml.
async function partesDelDocx(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const nombreFooter = Object.keys(zip.files).find((f) => /footer\d*\.xml$/.test(f));
  return {
    documento: await zip.file("word/document.xml")!.async("string"),
    estilos: await zip.file("word/styles.xml")!.async("string"),
    footer: nombreFooter ? await zip.file(nombreFooter)!.async("string") : null,
  };
}

// Texto plano del documento. Word parte un párrafo en varios <w:t>, así que se
// concatenan y se normalizan los espacios antes de buscar.
async function textoDelDocx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")!.async("string");
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[ \t ]+/g, " ");
}

describe("buildSegmentacionInformeDocx", () => {
  it("genera un .docx válido para bienes/servicios (rutinaria)", async () => {
    const buf = await buildSegmentacionInformeDocx(base);
    expect(esZipValido(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("genera un .docx válido para obras/consultoría (criterios concurrentes)", async () => {
    const buf = await buildSegmentacionInformeDocx({
      ...base,
      tipoObjetoLabel: "Obra",
      seg: {
        objeto: "obras_consultoria_obras",
        criteriosBasica: ["baja_innovacion_complejidad", "experiencia_previa"],
        centralizada: false,
      },
    });
    expect(esZipValido(buf)).toBe(true);
  });

  it("refleja las condiciones de riesgo marcadas en A2 (SÍ/NO por condición)", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        seg: { ...base.seg, condicionesRiesgo: ["desierto_2anios"] },
      }),
    );
    // La condición marcada debe salir en SÍ y el nivel de riesgo en ALTO.
    expect(texto).toContain("Nivel de riesgo: ALTO");

    // Se comprueba la fila entera (condición | fuente | ¿aplica?) en vez de
    // buscar "SÍ" cerca del texto: así el test no se rompe al añadir columnas
    // y además verifica que el SÍ es el de ESTA condición y no el de otra.
    const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
    const i = lineas.findIndex((l) => l.startsWith("i) En los 2 últimos años"));
    expect(i).toBeGreaterThan(-1);
    expect(lineas[i + 1]).toBe("Art. 125.3 Reglamento");
    expect(lineas[i + 2]).toBe("SÍ");

    // Las no marcadas siguen en NO.
    const j = lineas.findIndex((l) => l.startsWith("ii) El promedio de postores"));
    expect(lineas[j + 2]).toBe("NO");
  });

  it("sin condiciones marcadas el riesgo es BAJO", async () => {
    const texto = await textoDelDocx(await buildSegmentacionInformeDocx(base));
    expect(texto).toContain("Nivel de riesgo: BAJO");
  });

  it("incluye la compra centralizada marcada en A2", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({ ...base, seg: { ...base.seg, centralizada: true } }),
    );
    expect(texto).toContain("Compra centralizada o corporativa");
  });

  // El cronograma del Art. 42.2 nace de segmentar el PAC ya aprobado, para
  // decir a las áreas usuarias cuándo remitir sus requerimientos.
  it("programada: incluye el cronograma de presentación de requerimientos", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        programada: true,
        cronograma: [
          { area: "OFICINA DE LOGISTICA", fecha: "2026-05-10" },
          { area: "GERENCIA DE SERVICIOS MUNICIPALES", fecha: "" },
        ],
      }),
    );
    expect(texto).toContain("Cronograma de presentación de requerimientos (Art. 42.2)");
    expect(texto).toContain("OFICINA DE LOGISTICA");
    expect(texto).toContain("2026-05-10");
  });

  // En una no programada el requerimiento ya llegó (es lo que dispara la
  // segmentación, Art. 42.3): no hay nada que calendarizar. El modelo
  // institucional de segmentación no programada tampoco lo lleva.
  it("no programada: omite el cronograma aunque haya datos cargados", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        programada: false,
        cronograma: [{ area: "OFICINA DE LOGISTICA", fecha: "2026-05-10" }],
      }),
    );
    expect(texto).not.toContain("Cronograma de presentación de requerimientos");
    expect(texto).not.toContain("OFICINA DE LOGISTICA");
  });

  // Caso real del informe de segmentación de la M.D. de Paracas (leche
  // evaporada): los montos y el resultado deben salir calcados.
  it("incluye antecedentes de PIA/PAC y los parámetros de segmentación", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        objeto: "Adquisición de Leche Evaporada para el personal obrero",
        valorEstimado: 61174,
        institucional: {
          pacAnio: 2026,
          pacMontoBienesServicios: 1226465.7,
          pacMontoObras: 4872595.98,
          pacMontoTotal: 6099061.68,
          pacResolucionFecha: "2026-01-21",
          pacResolucionNumero: "Resolución de Gerencia Municipal N° 007-2026-MDP/GM",
          piaResolucionFecha: "2025-12-31",
          piaResolucionNumero: "Resolución de Alcaldía N° 238-2025-MDP/ALC",
        },
      }),
    );

    // Antecedentes: resoluciones con fecha en texto (sin desfase de zona horaria).
    expect(texto).toContain("Resolución de Alcaldía N° 238-2025-MDP/ALC");
    expect(texto).toContain("31 de diciembre de 2025");
    expect(texto).toContain("Presupuesto Institucional de Apertura (PIA)");
    expect(texto).toContain("Año Fiscal 2026");
    expect(texto).toContain("Resolución de Gerencia Municipal N° 007-2026-MDP/GM");
    expect(texto).toContain("21 de enero de 2026");
    expect(texto).toContain("S/ 6,099,061.68");
    expect(texto).toContain("S/ 4,872,595.98");

    // Parámetros: la aritmética del informe de referencia.
    expect(texto).toContain("Parámetros de Segmentación");
    expect(texto).toContain("Monto Inicial PAC (Bienes/Servicios)");
    expect(texto).toContain("S/ 1,226,465.70");
    expect(texto).toContain("Nueva Contratación");
    expect(texto).toContain("Monto Total Actualizado");
    expect(texto).toContain("S/ 1,287,639.70");
    expect(texto).toContain("Línea de Corte (10%)");
    expect(texto).toContain("S/ 128,763.97");
    // Conclusión con el porcentaje sustentado.
    expect(texto).toContain("4.75%");
    expect(texto).toContain("situándose por debajo de");
    // El matiz: el 10% es el 125.2, pero la base que se actualiza (sumar la
    // nueva contratación) sigue el método de la Guía, no el propio 125.2.
    expect(texto).toContain("El umbral del 10% aplicado a la cuantía corresponde al numeral 125.2");
    expect(texto).toContain("se determina conforme al método de la Guía de");
  });

  it("programada: no suma el monto al PAC y omite la fila de nueva contratación", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        programada: true,
        valorEstimado: 61174,
        institucional: {
          pacAnio: 2026,
          pacMontoBienesServicios: 1226465.7,
          pacMontoObras: null,
          pacMontoTotal: null,
          pacResolucionFecha: null,
          pacResolucionNumero: null,
          piaResolucionFecha: null,
          piaResolucionNumero: null,
        },
      }),
    );
    expect(texto).not.toContain("Nueva Contratación");
    // Línea de corte = 10% de 1,226,465.70, sin sumar el requerimiento.
    expect(texto).toContain("S/ 122,646.57");
    // Programada y sin sumandos: la base no se actualiza, así que no se añade
    // el matiz de la Guía (el 10% es directo sobre la cuantía del PAC).
    expect(texto).not.toContain("El umbral del 10% aplicado a la cuantía corresponde al numeral 125.2");
  });

  it("sin PAC registrado sigue generando el informe, sin parámetros", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({ ...base, institucional: null }),
    );
    expect(texto).toContain("SEGMENTACIÓN DE BIENES Y SERVICIOS");
    expect(texto).not.toContain("Parámetros de Segmentación");
    expect(texto).toContain("Matriz de Segmentación");
  });

  // El modelo institucional (Segmentacion_No_Programado) es un memorando con
  // cabecera, análisis citando la norma, matriz, resumen y conclusiones numeradas.
  it("sigue la estructura del modelo institucional", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        lugar: "Paracas",
        valorEstimado: 61174,
        narrativa: {
          destinatario: "Jefa de la Oficina General de Administración y Finanzas",
          remitente: "Jefe de la Oficina de Abastecimiento y Control Patrimonial",
          justificacion: "Existe amplia pluralidad de proveedores y no hay procesos desiertos.",
          continuidad: "La provisión cubre un pacto colectivo de entrega diaria.",
          riesgoMercado: "Mínimo: producto con oferta permanente y precios estables.",
          estrategiaMitigacion: "Coordinación con el contratista para entregas pactadas.",
          puntoControl: "Verificación del Registro Sanitario DIGESA vigente.",
        },
        institucional: {
          pacAnio: 2026,
          pacMontoBienesServicios: 1226465.7,
          pacMontoObras: null,
          pacMontoTotal: null,
          pacResolucionFecha: "2026-01-21",
          pacResolucionNumero: "Resolución de Gerencia Municipal N° 007-2026-MDP/GM",
          piaResolucionFecha: "2025-12-31",
          piaResolucionNumero: "Resolución de Alcaldía N° 238-2025-MDP/ALC",
        },
      }),
    );

    // Título: no programada ⇒ el modelo lo dice en el encabezado.
    expect(texto).toContain("SEGMENTACIÓN DE BIENES Y SERVICIOS NO PROGRAMADOS");

    // El encabezado de memorando (INFORME N°/PARA/ATENCIÓN/DE/ASUNTO) y el
    // saludo se omiten a propósito: los aporta la entidad desde su membrete al
    // ensamblar el expediente. Solo quedan REFERENCIA y FECHA.
    expect(texto).not.toContain("PARA:");
    expect(texto).not.toContain("ATENCIÓN:");
    expect(texto).not.toContain("DE:");
    expect(texto).not.toContain("ASUNTO:");
    expect(texto).not.toContain("Jefa de la Oficina General de Administración y Finanzas");
    expect(texto).not.toContain("Es grato dirigirme a usted");
    expect(texto).toContain("REFERENCIA:");
    // Las referencias se numeran a) b) c) con lo ya registrado.
    expect(texto).toContain("a) Resolución de Alcaldía N° 238-2025-MDP/ALC");
    expect(texto).toContain("b) Resolución de Gerencia Municipal N° 007-2026-MDP/GM");
    expect(texto).toContain("FECHA:");
    expect(texto).toContain("Paracas,");

    // Análisis: las 4 categorías del Art. 125.1, citadas literalmente.
    expect(texto).toContain("a) Rutinarios: contrataciones de baja cuantía y bajo riesgo.");
    expect(texto).toContain("d) Estratégico: contrataciones de alta cuantía, y alto riesgo.");

    // Matriz con la justificación del usuario.
    expect(texto).toContain("Matriz de Segmentación y Tipo de Interacción");
    expect(texto).toContain("Justificación de la categoría");
    expect(texto).toContain("Existe amplia pluralidad de proveedores");

    // Resumen de la clasificación + estrategia del Art. 125.4.
    expect(texto).toContain("Resumen de la Clasificación");
    expect(texto).toContain("Objetivo Estratégico");
    expect(texto).toContain("la atención oportuna y la reducción de costos");
    expect(texto).toContain("Continuidad");

    // Gestión de riesgos.
    expect(texto).toContain("Gestión de Riesgos");
    expect(texto).toContain("Riesgo de Mercado");
    expect(texto).toContain("Estrategia de Mitigación");
    expect(texto).toContain("Punto de Control");
    expect(texto).toContain("Registro Sanitario DIGESA");

    // Conclusiones numeradas y cierre.
    expect(texto).toContain("3.1");
    expect(texto).toContain("3.4");
    expect(texto).toContain("Cuadro N° 10 de la Guía de Actuaciones Preparatorias");
    // El cierre añade la finalidad: el informe se incorpora al expediente
    // como sustento de la segmentación (Art. 54.2.c).
    expect(texto).toContain("Es cuanto informo a usted");
    expect(texto).toContain("incorporarse el presente al expediente de contratación");
    expect(texto).toContain("Atentamente,");
  });

  it("los bloques narrativos vacíos se omiten (no salen títulos huérfanos)", async () => {
    const texto = await textoDelDocx(await buildSegmentacionInformeDocx(base));
    // Ojo: "Gestión de Riesgos" aparece en la cita del Art. 125.4 aunque la
    // sección no exista, así que se comprueban sus viñetas, que son únicas.
    expect(texto).not.toContain("Riesgo de Mercado");
    expect(texto).not.toContain("Estrategia de Mitigación");
    expect(texto).not.toContain("Punto de Control");
    expect(texto).not.toContain("PARA:");
    expect(texto).not.toContain("Continuidad:");
    // Lo derivable de la norma sí debe seguir estando.
    expect(texto).toContain("Resumen de la Clasificación");
    expect(texto).toContain("Matriz de Segmentación");
    expect(texto).toContain("Objetivo Estratégico");
  });

  // El informe se imprime y se firma: la tipografía es parte del entregable.
  it("aplica la tipografía institucional (Arial 10.5, justificado, títulos negros)", async () => {
    const { documento, estilos, footer } = await partesDelDocx(
      await buildSegmentacionInformeDocx(base),
    );

    expect(estilos).toContain("Arial");
    // docx mide en MEDIOS puntos: 21 = 10.5pt.
    expect(estilos).toContain('<w:sz w:val="21"');
    expect(estilos).toContain('<w:jc w:val="both"'); // justificado
    expect(estilos).toContain('w:line="276"'); // interlineado 1.15
    expect(estilos).toContain('<w:color w:val="000000"'); // títulos en negro
    expect(estilos).not.toContain('w:val="2F5496"'); // NO el azul por defecto de Word

    // Margen normal: 2.5cm superior/inferior, 3cm izquierda/derecha.
    expect(documento).toContain('w:top="1418"');
    expect(documento).toContain('w:bottom="1418"');
    expect(documento).toContain('w:left="1701"');
    expect(documento).toContain('w:right="1701"');
    expect(documento).toContain('<w:sz w:val="18"'); // tablas a 9pt
    expect(documento).toContain('w:fill="E7E9EC"'); // cabecera sombreada
    expect(documento).toContain("<w:tblHeader"); // cabecera repetida al partir página

    // El pie vive en su propio archivo, no en document.xml.
    expect(footer).not.toBeNull();
    expect(footer).toContain("PAGE");
    expect(footer).toContain("NUMPAGES");
  });

  // "Elaborado por" es la trazabilidad de quién generó el documento, no una
  // firma: va en el pie de página (se repite en cada hoja), a la izquierda y
  // a 8pt — no en el cuerpo que se imprime y se firma.
  it('"Elaborado por" va en el pie de página, a la izquierda y a 8pt', async () => {
    const { documento, footer } = await partesDelDocx(
      await buildSegmentacionInformeDocx({ ...base, elaboradoPor: "Juan Pérez — DEC" }),
    );

    expect(documento).not.toContain("Elaborado por");
    expect(footer).not.toBeNull();
    expect(footer).toContain("Elaborado por: Juan Pérez — DEC");
    expect(footer).toContain('<w:jc w:val="left"');
    // docx mide en MEDIOS puntos: 16 = 8pt.
    expect(footer).toContain('<w:sz w:val="16"');
  });

  it("las citas de la norma van en cursiva y sangradas, separadas del análisis", async () => {
    const { documento } = await partesDelDocx(await buildSegmentacionInformeDocx(base));
    const texto = await textoDelDocx(await buildSegmentacionInformeDocx(base));

    // Cita literal del 42.1 entrecomillada (no parafraseada).
    expect(texto).toContain(
      "“Mediante la segmentación la entidad contratante clasifica las contrataciones, consideradas en el PAC del CMN del ejercicio presupuestal en curso",
    );
    expect(documento).toContain("<w:i"); // hay cursivas
    expect(documento).toContain('w:left="567"'); // sangría de cita (1 cm)
  });

  // La base del 10% incluye las no programadas convocadas y las otras a
  // segmentar (Guía). El informe debe mostrar cada sumando para sustentarlo.
  it("los parámetros muestran los sumandos de la Guía cuando existen", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        valorEstimado: 60000,
        noProgramadasConvocadas: 100000,
        otrasNoProgramadasASegmentar: 38000,
        institucional: {
          pacAnio: 2026,
          pacMontoBienesServicios: 1900000,
          pacMontoObras: null,
          pacMontoTotal: null,
          pacResolucionFecha: null,
          pacResolucionNumero: null,
          piaResolucionFecha: null,
          piaResolucionNumero: null,
        },
      }),
    );
    expect(texto).toContain("No programadas ya convocadas");
    expect(texto).toContain("S/ 100,000.00");
    expect(texto).toContain("Otras no programadas a segmentar");
    expect(texto).toContain("S/ 38,000.00");
    // 1,900,000 + 100,000 + 38,000 + 60,000 = 2,098,000 ⇒ 10% = 209,800
    expect(texto).toContain("S/ 2,098,000.00");
    expect(texto).toContain("S/ 209,800.00");
  });

  it("sin sumandos extra, el informe no imprime filas en cero", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        valorEstimado: 61174,
        institucional: {
          pacAnio: 2026,
          pacMontoBienesServicios: 1226465.7,
          pacMontoObras: null,
          pacMontoTotal: null,
          pacResolucionFecha: null,
          pacResolucionNumero: null,
          piaResolucionFecha: null,
          piaResolucionNumero: null,
        },
      }),
    );
    expect(texto).not.toContain("No programadas ya convocadas");
    expect(texto).not.toContain("Otras no programadas a segmentar");
    expect(texto).toContain("S/ 128,763.97"); // el caso de Paracas, intacto
  });

  // Si el informe presenta un texto como cita literal, debe serlo palabra por
  // palabra: quien verifique el Reglamento no puede encontrar diferencias.
  it("cita el 125.1 literal, con el singular y la coma del literal d)", async () => {
    const texto = await textoDelDocx(await buildSegmentacionInformeDocx(base));
    expect(texto).toContain("a) Rutinarios: contrataciones de baja cuantía y bajo riesgo.");
    expect(texto).toContain("b) Operacionales: contrataciones de alta cuantía y bajo riesgo.");
    expect(texto).toContain("c) Críticos: contrataciones de baja cuantía y alto riesgo.");
    // El Reglamento dice "Estratégico" (singular) y con coma antes de "y alto riesgo".
    expect(texto).toContain("d) Estratégico: contrataciones de alta cuantía, y alto riesgo.");
    expect(texto).not.toContain("d) Estratégicos:");
  });

  // La cuarta condición de riesgo no está en el 125.3: la añade la Guía.
  // Atribuirlas todas al Reglamento haría observable el informe.
  it("declara la fuente de cada condición de riesgo", async () => {
    const texto = await textoDelDocx(await buildSegmentacionInformeDocx(base));
    expect(texto).toContain("numeral 125.3 del Reglamento y Guía de Actuaciones Preparatorias");
    expect(texto).toContain("Art. 125.3 Reglamento");
    expect(texto).toContain("Guía de Act. Preparatorias");
    expect(texto).toContain("la condición iv) la incorpora la Guía de Actuaciones Preparatorias");
    // Las condiciones se numeran como en la norma.
    expect(texto).toContain("i) En los 2 últimos años");
    expect(texto).toContain("iv) Es un bien o servicio que no ha sido contratado anteriormente");
  });

  // Art. 42.3: la segmentación de una no programada procede una vez que la
  // necesidad consta en el CMN. El informe declara el estado real de esa
  // precondición en vez de darla por cumplida.
  it("no programada con CMN verificado: lo deja constar con su versión", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        programada: false,
        enCmn: true,
        versionCmn: "CMN 2026 v2",
      }),
    );
    expect(texto).toContain("la necesidad se encuentra incluida en el Cuadro Multianual de Necesidades");
    expect(texto).toContain("CMN 2026 v2");
    expect(texto).not.toContain("Precondición pendiente");
  });

  it("no programada sin CMN verificado: el informe declara la precondición pendiente", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({ ...base, programada: false, enCmn: false }),
    );
    expect(texto).toContain("Precondición pendiente");
    expect(texto).toContain("no consta en el expediente la verificación");
    expect(texto).toContain("numeral 42.3");
    // No debe afirmar un cumplimiento que nadie verificó.
    expect(texto).not.toContain("por lo que corresponde efectuar la segmentación");
  });

  // A1 captura el documento con que el área usuaria solicita la modificación
  // del CMN (Art. 42.3); el informe debe dejarlo constar, no quedárselo.
  it("no programada con documento de modificación del CMN: lo deja constar", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        programada: false,
        documentoModificacionCmn: "INFORME N° 045-2026-AU-MDCH",
      }),
    );
    expect(texto).toContain("INFORME N° 045-2026-AU-MDCH");
    expect(texto).toContain("numeral 42.3");
    expect(texto).toContain("solicita la modificación del Cuadro Multianual de Necesidades");
  });

  it("no programada con documento y CMN verificado: deja constar ambos", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        programada: false,
        enCmn: true,
        versionCmn: "CMN 2026 v2",
        documentoModificacionCmn: "INFORME N° 045-2026-AU-MDCH",
      }),
    );
    expect(texto).toContain("INFORME N° 045-2026-AU-MDCH");
    expect(texto).toContain("CMN 2026 v2");
    expect(texto).not.toContain("Precondición pendiente");
  });

  it("programada: el documento del 42.3 no aplica y no se menciona", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        programada: true,
        documentoModificacionCmn: "INFORME N° 045-2026-AU-MDCH",
      }),
    );
    expect(texto).not.toContain("INFORME N° 045-2026-AU-MDCH");
  });

  it("programada: la precondición del 42.3 no aplica y no se menciona", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({ ...base, programada: true, enCmn: false }),
    );
    expect(texto).not.toContain("Precondición pendiente");
    expect(texto).toContain("se encuentra programada en el PAC");
  });

  // El informe se imprime sobre el membrete de la entidad y se firma con el
  // sello real: una línea con el nombre mecanografiado debajo se acaba tachando.
  it("no lleva bloque de firma", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({
        ...base,
        narrativa: { remitente: "ROJAS MAYTAN JUAN — OFICINA DE LOGISTICA" },
      }),
    );
    // El cierre añade la finalidad: el informe se incorpora al expediente
    // como sustento de la segmentación (Art. 54.2.c).
    expect(texto).toContain("Es cuanto informo a usted");
    expect(texto).toContain("incorporarse el presente al expediente de contratación");
    expect(texto).toContain("Atentamente,");
    // Ni línea de firma, ni el remitente repetido al pie, ni la entidad.
    expect(texto).not.toContain("______");
    expect(texto.split("Atentamente,")[1]?.trim()).toBe("");
  });

  it("programada: el título no dice 'NO PROGRAMADOS'", async () => {
    const texto = await textoDelDocx(
      await buildSegmentacionInformeDocx({ ...base, programada: true }),
    );
    expect(texto).toContain("SEGMENTACIÓN DE BIENES Y SERVICIOS");
    expect(texto).not.toContain("NO PROGRAMADOS");
  });

  it("no falla con campos opcionales nulos (contratación programada)", async () => {
    const buf = await buildSegmentacionInformeDocx({
      ...base,
      areaUsuaria: null,
      valorEstimado: null,
      plazoDias: null,
      programada: true,
      documentoRequerimiento: null,
      seg: { objeto: "bienes_servicios", cuantiaAlta: true, condicionesRiesgo: ["desierto_2anios"] },
    });
    expect(esZipValido(buf)).toBe(true);
  });
});
