import { parseAdelantoDirecto } from "./adelanto-directo";
import { parseFormulaReajuste } from "./formula-reajuste";
import { APARTADOS_MODELO } from "./modelo-apartados";
import { campoAplica, FICHA_SECCIONES, type FichaField, objetosEfectivosDe } from "./necesidad-ficha-secciones";
import { parseSubcontratacion } from "./subcontratacion";
import type { ObjetoFilter } from "./procesos-seleccion";
import { filasCapacitacionParaDocumento, formatFilasCapacitacion } from "./capacitacion-personal-clave";
import { desdeMatrizRiesgos } from "./matriz-riesgos";

/**
 * Qué lleva el Word del requerimiento, y cómo se pinta cada cosa.
 *
 * El documento SE DEJABA información. Salía solo con los apartados que el modelo
 * del procedimiento declara —diecinueve campos— mientras que la ficha tiene
 * setenta y cuatro: en REQ-2026-0020 se registraron 29 y salían 5. Meta
 * presupuestal, CUI, cadena funcional, monto estimado, plazo, alcance y
 * garantías se quedaban fuera sin que nadie lo notara.
 *
 * Ahora manda la FICHA: el documento recorre sus secciones en el MISMO ORDEN que
 * la pantalla y saca todo lo registrado. El modelo sigue pintando, pero en su
 * sitio: decide qué campos son EXIGIBLES, y esos salen aunque estén vacíos para
 * que se vea lo que falta.
 */

/** Cómo se pinta un campo en el documento. */
export type FormatoCampo = "linea" | "parrafo" | "tabla" | "tablaPersonalClave" | "tablaFormacion" | "tablaCapacitacion" | "vinetas";

export type CampoRequerimiento = {
  /** api del campo en la ficha; el renderizador lo necesita para los estructurados. */
  api: string;
  /** El modelo del procedimiento lo exige: sale aunque no tenga valor. */
  exigido: boolean;
  formato: FormatoCampo;
  label: string;
  /** Subgrupo de la ficha («a) Modalidad de pago»); encabeza sus campos. */
  subgrupo?: string;
  valor: string;
};

export type SeccionRequerimiento = {
  campos: CampoRequerimiento[];
  /** Cita legal de la sección; va en cursiva, como en los modelos del OECE. */
  nota?: string;
  titulo: string;
};

/**
 * La etiqueta del documento no es la de la ficha.
 *
 * En el formulario se lee «Propuesta de modalidad de pago» porque el área
 * usuaria PROPONE y la DEC decide. En el requerimiento firmado esa coletilla
 * sobra. Igual con el «(días)» del plazo, que es una ayuda para teclear.
 */
export function etiquetaDeDocumento(label: string): string {
  return label
    .replace(/^Propuesta de\s+/i, "")
    .replace(/\s*\((?:días|dias)\)\s*$/i, "")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * El `kind` de la ficha ya distingue los campos estructurados, así que el
 * formato se deriva de él en vez de mantener una segunda lista que se
 * desincronice.
 */
function formatoDe(field: FichaField): FormatoCampo {
  if (field.kind === "penalidades") return "tabla";
  if (field.kind === "personalClave") return "tablaPersonalClave";
  if (field.kind === "formacionAcademica") return "tablaFormacion";
  if (field.kind === "capacitacion") return "tablaCapacitacion";
  if (field.kind === "requisitos") return "vinetas";
  if (
    field.kind === "textarea" ||
    field.kind === "controversias" ||
    field.kind === "subcontratacion" ||
    field.kind === "adelanto" ||
    field.kind === "reajuste"
  ) {
    return "parrafo";
  }
  return "linea";
}

/**
 * Secciones de la ficha que NO van al requerimiento.
 *
 * No son contenido del documento: son el control interno de la DEC y el resumen
 * que la propia ficha compone para la pantalla.
 */
const SECCIONES_FUERA = new Set(["Verificaciones DEC (Art. 14 Reglamento)", "Resumen"]);

/**
 * Campos que no van SUELTOS al documento.
 *
 * La unidad del plazo viaja DENTRO del plazo («52 días calendario»), así que
 * sola solo ponía una raya debajo.
 */
const NO_VAN_SOLOS = new Set(["plazoEjecucionUnidad"]);

/** Los apis que el modelo del procedimiento declara exigibles. */
export function apisExigidos(apartados: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const nombre of apartados) {
    const entrada = APARTADOS_MODELO.find((a) => a.apartado === nombre);
    for (const api of entrada?.apis ?? []) out.add(api);
  }
  return out;
}

/** Una casilla sin marcar es un "false", no un dato. */
function tieneValor(v: string): boolean {
  const t = v.trim();
  return t !== "" && t !== "false";
}

/**
 * Las secciones del documento, en el ORDEN DE LA FICHA.
 *
 * Un campo sale si tiene valor o si el modelo lo exige. Lo primero es el
 * requisito de la entidad —que el Word lleve todo lo registrado—; lo segundo
 * hace visible lo que el procedimiento pide y nadie rellenó, que en un documento
 * que se firma vale más en blanco que desaparecido.
 *
 * `objeto` y `proceso` filtran lo que no aplica: un campo de obras no debe
 * asomar en un requerimiento de bienes porque quedara un valor suelto.
 */
export function estructuraDelRequerimiento(
  apartados: readonly string[],
  ficha: Record<string, string>,
  opciones?: { objeto?: ObjetoFilter | ""; proceso?: string },
): SeccionRequerimiento[] {
  const exigidos = apisExigidos(apartados);
  const proceso = opciones?.proceso ?? "";
  const efectivos = objetosEfectivosDe(proceso, opciones?.objeto || undefined);

  const salida: SeccionRequerimiento[] = [];
  for (const seccion of FICHA_SECCIONES) {
    if (SECCIONES_FUERA.has(seccion.title)) continue;
    const campos: CampoRequerimiento[] = [];
    for (const field of seccion.fields) {
      // El personal clave está `oculto` porque en la FICHA lo pinta el editor de
      // requisitos, no la lista de campos; pero en el DOCUMENTO sí van —el cuadro
      // y, tras él, el texto de cómo se acredita—, así que se dejan pasar. El
      // resto de ocultos son espejos internos.
      const soloEnDocumento =
        field.kind === "personalClave" ||
        field.kind === "formacionAcademica" ||
        field.kind === "capacitacion" ||
        field.api === "personalClaveAcreditacion" ||
        field.api === "formacionAcademicaAcreditacion" ||
        field.api === "capacitacionPersonalClaveAcreditacion" ||
        field.api === "equipamientoEstrategico" ||
        field.api === "equipamientoEstrategicoAcreditacion" ||
        field.api === "infraestructuraEstrategica" ||
        field.api === "infraestructuraEstrategicaAcreditacion";
      if ((field.oculto && !soloEnDocumento) || NO_VAN_SOLOS.has(field.api)) continue;
      let valor = (ficha[field.api] ?? "").trim();
      // Una fila de capacitación heredada del cuadro de experiencia, sin horas,
      // materia ni puesto, no es un requisito: solo lleva la actividad. No viaja
      // al documento —ni como fila del cuadro ni, si no queda ninguna útil, como
      // apartado con título huérfano, porque el valor queda vacío y se descarta
      // abajo—.
      if (field.kind === "capacitacion") {
        valor = formatFilasCapacitacion(filasCapacitacionParaDocumento(valor));
      }
      // Gestión de riesgos (Art. 44.3): el Word imprime SOLO la matriz, desde el
      // encabezado «MATRIZ DE GESTIÓN DE RIESGOS», sin el párrafo de sustento
      // introductorio (misma decisión que la vista previa y el modo lectura).
      if (field.api === "gestionRiesgos") {
        valor = desdeMatrizRiesgos(valor);
      }
      // «No corresponde» en apartados de selección (adelanto Art. 137,
      // subcontratación Art. 108): el área usuaria declara que el apartado no
      // aplica, así que el numeral se OMITE del documento en vez de imprimir la
      // constancia —fiel al modelo, que en el adelanto manda «eliminar el
      // numeral»—. Se omite aunque el modelo lo declare exigible.
      if (field.kind === "adelanto" && parseAdelantoDirecto(valor).modalidad === "no_corresponde") {
        continue;
      }
      if (field.kind === "subcontratacion" && parseSubcontratacion(valor).modalidad === "no_corresponde") {
        continue;
      }
      if (field.kind === "reajuste" && parseFormulaReajuste(valor).modalidad === "no_corresponde") {
        continue;
      }
      const exigido = exigidos.has(field.api);
      // Lo que no aplica a este objeto o procedimiento no entra, aunque haya
      // quedado un valor: el documento describe ESTA contratación.
      //
      // Salvo que el MODELO lo declare. Los dos discrepan de verdad: el
      // PDF-modelo de Licitación Pública abreviada PARA BIENES trae los
      // apartados de sistema de entrega y subcontratación, y el catálogo de la
      // ficha los limita a servicios, obras y consultoría de obra. Manda el
      // modelo, que es el formato que la entidad tiene que presentar; omitirlo
      // dejaría el documento sin un apartado que el formato exige.
      if (!exigido && efectivos.length > 0 && !campoAplica(field, efectivos, proceso)) continue;
      if (!tieneValor(valor) && !exigido) continue;
      campos.push({
        api: field.api,
        exigido,
        formato: formatoDe(field),
        label: etiquetaDeDocumento(field.label),
        subgrupo: field.subgrupo,
        valor,
      });
    }
    if (campos.length === 0) continue;
    // La nota legal de la sección sale del baseLegal del primer campo VISIBLE, no
    // de `seccion.fields[0]`: ese primero DEFINIDO puede estar oculto para este
    // objeto (p. ej. «especialidad» de 3.2 solo aplica a obras), y entonces el
    // Word rotulaba «3.2 Descripción general» con el Art. 72.3.b del personal
    // clave. `campos` ya está filtrado a lo visible y conserva el orden.
    const primerCampoVisible = seccion.fields.find((f) => f.api === campos[0]!.api);
    salida.push({ campos, nota: primerCampoVisible?.baseLegal, titulo: seccion.title.toUpperCase() });
  }
  return salida;
}
