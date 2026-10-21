"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Gavel, Info, Loader, PencilLine, Trash2 } from "lucide-react";
import {
  ACREDITACION_TIPICA,
  GRUPO_TIPO_ART72,
  LETRA_TIPO_ART72,
  TIPOS_REQUISITO_ART72,
  TITULO_GRUPO_ART72,
  ayudaPorObjeto,
  componerRequisitos,
  parseRequisitos,
  repartirRequisitos,
  type EstadoRequisito,
  type EstadoTipoRequisito,
  type RepartoRequisitos,
  type RequisitoFacultativo,
  type TipoRequisitoArt72,
} from "@/lib/requisitos-calificacion";
import { avisosDeTopes } from "@/lib/requisitos-topes";
import {
  ACREDITACION_EXPERIENCIA,
  componerExperienciaPostor,
  montoDeExperiencia,
  montoMypeDeExperiencia,
  objetoConvocatoria,
  similaresDeExperiencia,
} from "@/lib/requisitos-experiencia";
import { ACREDITACION_PERSONAL_CLAVE, parsePersonalClave } from "@/lib/personal-clave";
import { ACREDITACION_FORMACION_ACADEMICA } from "@/lib/formacion-academica";
import { ACREDITACION_CAPACITACION } from "@/lib/capacitacion-personal-clave";
import { ACREDITACION_EQUIPAMIENTO, REQUISITO_EQUIPAMIENTO } from "@/lib/equipamiento-estrategico";
import { ACREDITACION_INFRAESTRUCTURA, REQUISITO_INFRAESTRUCTURA } from "@/lib/infraestructura-estrategica";
import { ACREDITACION_CONSORCIO } from "@/lib/consorcio";
import { ConsorcioEditor } from "./consorcio-editor";
import { PersonalClaveEditor } from "./personal-clave-editor";
import { FormacionAcademicaEditor } from "./formacion-academica-editor";
import { CapacitacionPersonalClaveEditor } from "./capacitacion-personal-clave-editor";
import { tienePrecalificacion } from "@/lib/procesos-seleccion";
import { analizarRequisitos, facultativosExcluidos, requisitosDeProcedimiento } from "@/lib/requisitos-por-procedimiento";
import { Sparkles } from "lucide-react";
// El alto se calcula con la estimación ESTRECHA (no `wide`): estos textarea
// viven dentro de la tarjeta de cada tipo, que es bastante más angosta que un
// campo ancho de la ficha, y con la estimación ancha un párrafo de 270
// caracteres se quedaba en cuatro filas.
import { filasTextarea } from "@/lib/textarea-alto";

// ── Estilos migrados de styles.css (clases .reqCal*) ─────────────────────────
// Conservan la nomenclatura original. Los <button>/<input>/<select>/<textarea>
// nativos llevan `!` en tamaño/peso/radio/fondo: la regla global `input,…{font:
// inherit}` + `input,…{border-radius:10px;background:#fff}` (sin capa) ganaría a
// las utilidades. Todo esto vive dentro del `.tw` de process-detail.
const RC_ROOT = "mt-1 grid gap-2.5";
const RC_MODO =
  "mb-2 inline-flex items-center gap-[5px] rounded-full border border-line bg-transparent px-[9px] py-[3px] text-[11px] font-semibold text-muted [&>svg]:flex-none";
const RC_HINT =
  "m-0 mb-2 flex items-start gap-[5px] text-[11px] leading-[1.45] text-muted [&>svg]:mt-px [&>svg]:flex-none";
const RC_RESUMEN =
  "mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-[5px] text-[11.5px] text-muted";
const RC_RESUMEN_CUENTA = "font-semibold text-ink";
const RC_RESUMEN_FALTA = "inline-flex items-center gap-1 text-warning [&>svg]:flex-none";
// La estructura oficial del 3.5 (grupos 3.5.1/3.5.2 y letras A–D) vive en
// lib/requisitos-calificacion.ts para compartirse con el documento (Word).
const RC_GRUPOTITULO =
  "mt-2 mb-0.5 text-[11.5px] font-[750] uppercase tracking-[0.03em] text-brand";
const RC_TIPOS = "grid gap-1.5";
const RC_TIPO =
  "grid gap-1.5 rounded-[9px] border border-line border-l-[3px] border-l-line px-2.5 py-2 " +
  "[&_textarea]:w-full [&_textarea]:!text-[12.5px] [&_textarea]:px-2 [&_textarea]:py-1.5 " +
  "[&_textarea]:!min-h-[60px] [&_textarea]:!leading-[1.45] [&_textarea]:resize-y [&_textarea]:whitespace-pre-wrap [&_textarea]:[overflow-wrap:anywhere]";
const RC_TIPOHEAD =
  "flex items-start justify-between gap-2.5 [&_select]:flex-none [&_select]:!text-[11px] [&_select]:px-1.5 [&_select]:py-[3px]";
const RC_TIPONOMBRE =
  "flex min-w-0 flex-col gap-0.5 [&>strong]:text-[12px] [&>small]:text-[10.5px] [&>small]:leading-[1.4] [&>small]:text-muted";
const RC_CAMPO = "flex flex-col gap-[3px] [&>span]:text-[10.5px] [&>span]:text-muted";
const RC_MONTO = "flex-[0_1_190px]";
const RC_SIMILARES = "flex-[2_1_260px]";
const RC_EXPFILA =
  "flex flex-wrap items-start gap-2.5 " +
  "[&_input]:w-full [&_input]:!text-[12.5px] [&_input]:px-2 [&_input]:py-1.5 [&_input]:border [&_input]:border-line [&_input]:!rounded-[7px] [&_input]:text-ink";
const RC_REDACTAR =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-[6px] px-[9px] py-1.5 !text-[11px] !font-semibold text-accent " +
  "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] transition-[background] duration-150 " +
  "hover:enabled:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] disabled:cursor-default disabled:opacity-50";
const RC_SPANBOTON = "flex flex-wrap items-center justify-between gap-2";
const RC_AVISOTOPE =
  "mt-1 flex items-start gap-[5px] text-[11px] leading-[1.4] text-warning [&>svg]:mt-0.5 [&>svg]:shrink-0";
const RC_DELMODELO = "ml-1.5 whitespace-nowrap text-[11px] font-semibold text-brand";
const RC_CAPTECNICA = "mt-2.5 border-t border-line pt-2";
const RC_CAPTOGGLE =
  "flex w-full cursor-pointer items-center gap-1.5 py-1 text-left !text-[12.5px] !font-semibold text-ink " +
  "[&>small]:font-normal [&>small]:text-muted [&>svg]:flex-none [&>svg]:text-muted";
const RC_PERSONALCLAVE =
  "mt-1 flex flex-col gap-2 rounded-[9px] border border-dashed border-line p-2.5 bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]";
const RC_PCTITULO = "text-[11px] font-bold uppercase tracking-[0.02em] text-muted";
const RC_PCAYUDA = "m-0 text-[11.5px] leading-[1.45] text-muted";
const RC_HEREDADOS =
  "grid gap-[5px] rounded-[9px] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_6%,transparent)] px-2.5 py-2 " +
  "[&>p]:m-0 [&>p]:flex [&>p]:items-start [&>p]:gap-[5px] [&>p]:text-[11px] [&>p]:leading-[1.45] [&>p]:text-muted [&>p>svg]:mt-0.5 [&>p>svg]:flex-none [&_em]:text-[10.5px] [&_em]:text-muted";
const RC_ROW = "flex items-center justify-between gap-1.5 text-[11.5px] [&_input]:flex-1 [&_input]:min-w-0";

// Editor de la variable f) de la Estrategia (Art. 46.1.f) y de la propuesta del
// requerimiento (Art. 44.2.b).
//
// El Art. 72.3 define una lista CERRADA de cinco tipos: no existe un sexto. Por
// eso son casillas y no texto libre — antes se podía escribir cualquier cosa
// ("Certificación ISO 9001") como requisito de calificación.
//
// Qué tipo es obligatorio y cuál facultativo lo determinan las bases estándar
// según la modalidad (Art. 72.4). Mientras esa tabla no esté cargada en ACE, lo
// marca el usuario; el día que esté, se deriva del tipo de procedimiento.

/** El 25% de un monto (en texto), redondeado a céntimos. Vacío si no es válido. */
function pct25(montoTexto: string): string {
  const n = Number(montoTexto);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n * 0.25 * 100) / 100);
}

export function RequisitosCalificacionEditor({
  value,
  onChange,
  readOnly = false,
  objeto,
  montoEstimado,
  moneda,
  necesidadId,
  personalClaveExperiencia,
  personalClaveAcreditacion,
  formacionAcademica,
  formacionAcademicaAcreditacion,
  capacitacionPersonalClave,
  capacitacionPersonalClaveAcreditacion,
  equipamientoEstrategico,
  equipamientoEstrategicoAcreditacion,
  infraestructuraEstrategica,
  infraestructuraEstrategicaAcreditacion,
  onCampoFicha,
  tipoProceso,
  requisitosModelo,
  modo = "propuesta",
  propuesta,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /**
   * Rol de quien usa el editor. `propuesta` (Necesidad / A3): el ÁREA USUARIA
   * propone (Art. 44.2.b). `decision` (A4): la DEC establece los requisitos
   * (Art. 72.1) — valida, decide facultativos y puede excluir con no objeción. Es
   * el mismo componente; solo cambian el encuadre y los verbos.
   */
  modo?: "propuesta" | "decision";
  /**
   * Propuesta del área usuaria (texto canónico del requerimiento, A3), solo en
   * modo `decision`. Sirve para CONTRASTAR: marca qué tipos vienen del área
   * usuaria y avisa cuando la DEC EXCLUYE un facultativo que aquella propuso, que
   * es el único supuesto que exige su no objeción (Guía Cap. III, f) · Art. 44.8).
   * Apartarse en el detalle o fijar obligatorios NO la requiere: eso es potestad
   * de la DEC (Art. 72.1).
   */
  propuesta?: string;
  // itemsExperiencia / umbralLpConfigurado: aún llegan desde la ficha (rango de
  // la LP abreviada), pero este botón ya no rotula por ítem —compone el requisito
  // único con los montos de sus campos—, así que se aceptan y se ignoran.
  itemsExperiencia?: ReadonlyArray<{ nro: number; cuantia: number | null }>;
  umbralLpConfigurado?: boolean;
  /** Para pedir a la IA la propuesta de servicios similares. */
  necesidadId?: string;
  /**
   * Experiencia del personal clave (Art. 72.3.b), como cuadro serializado. Se
   * registra DENTRO de la tarjeta de experiencia del postor, pero se guarda en
   * una columna propia de la necesidad, no en el texto canónico de requisitos:
   * por eso llega y se escribe por fuera del `value`/`onChange` del editor.
   */
  personalClaveExperiencia?: string;
  /** Texto de cómo se acredita la experiencia del personal clave (fijo del formato). */
  personalClaveAcreditacion?: string;
  /** Requisito de formación académica del personal clave, ya compuesto. */
  formacionAcademica?: string;
  /** Texto de cómo se acredita la formación académica (fijo del formato). */
  formacionAcademicaAcreditacion?: string;
  /** Requisito de capacitación del personal clave (cuadro serializado). */
  capacitacionPersonalClave?: string;
  /** Texto de cómo se acredita la capacitación (fijo del formato). */
  capacitacionPersonalClaveAcreditacion?: string;
  /** Requisito y acreditación del equipamiento estratégico (textos del formato). */
  equipamientoEstrategico?: string;
  equipamientoEstrategicoAcreditacion?: string;
  /** Requisito y acreditación de la infraestructura estratégica (textos del formato). */
  infraestructuraEstrategica?: string;
  infraestructuraEstrategicaAcreditacion?: string;
  /** Escribe un campo suelto de la ficha (el cuadro del personal clave). */
  onCampoFicha?: (api: string, valor: string) => void;
  // Objeto contractual: la ayuda de capacidad técnica y experiencia cambia en
  // obras (Art. 72.3.b + Art. 157). undefined = ayuda genérica.
  objeto?: string | null;
  /** Cuantía de la contratación: sin ella no se puede calcular el tope de 3x. */
  montoEstimado?: number | null;
  /** Moneda de la convocatoria: la frase de experiencia se redacta en ella. */
  moneda?: string | null;
  /** Procedimiento: decide si cabe la capacidad económica (Art. 72.3.e). */
  tipoProceso?: string | null;
  /**
   * Tipos que el PDF-modelo del procedimiento declara como apartado.
   *
   * NO filtra: el Art. 72.3 permite los cinco y la entidad puede sustentar uno
   * que su formato no liste. Solo DICE cual pide el formato, que es lo que hasta
   * ahora habia que saberse de memoria: los modelos declaran entre cero y cuatro
   * segun el objeto y el procedimiento —los de obras nunca traen capacidad
   * legal, el no competitivo no trae ninguno— y la ficha ofrecia siempre los
   * mismos.
   */
  requisitosModelo?: ReadonlySet<string>;
}) {
  // Estado LOCAL del reparto. El valor se persiste como texto canónico y ese
  // round-trip (serializar → parsear) recorta los espacios al final de cada campo
  // (`.trim()` en unirNombre/partirSegmentos/partirNombre). Si el textarea leyera
  // su contenido de ese round-trip en cada tecla, un espacio al final se borraría
  // al instante y no se podría separar palabras. Por eso el editor guarda lo
  // TECLEADO (con sus espacios) y solo re-sincroniza cuando el valor cambia por
  // FUERA (traer datos de la IA, recarga de la ficha…).
  const [reparto, setReparto] = useState<RepartoRequisitos>(() =>
    repartirRequisitos(parseRequisitos(value)),
  );
  // Última cadena que ESTE editor emitió: distingue un cambio propio (no
  // re-sincronizar, borraría el espacio recién tecleado) de uno externo.
  const emitidoRef = useRef<string>(value);
  // El monto facturado que exige la experiencia del postor. No tiene columna
  // propia: se compone dentro del detalle y se relee de él, como el resto de
  // este módulo (texto canónico). Se guarda lo TECLEADO para no perder los
  // decimales a medio escribir; se re-sincroniza solo cuando el valor cambia por
  // fuera (traer datos de IA, recarga).
  // Monto estimado (S/) de la contratación (Art. 48): la CUANTÍA. Es el valor por
  // defecto del monto de experiencia exigido —del que además no puede pasar de
  // 3×—; el área usuaria puede subirlo. Vacío si aún no hay cuantía.
  const montoEstimadoTexto =
    typeof montoEstimado === "number" && Number.isFinite(montoEstimado) && montoEstimado > 0
      ? String(montoEstimado)
      : "";
  // El monto exigido se calcula del Monto estimado (cuantía) como punto de
  // partida; si ya había uno redactado, se relee de él.
  const montoExpInicial = (detalle: string) => montoDeExperiencia(detalle) || montoEstimadoTexto;
  // El monto MYPE se calcula como el 25% del exigido; si ya había uno, se relee.
  const montoMypeInicial = (detalle: string) =>
    montoMypeDeExperiencia(detalle) || pct25(montoExpInicial(detalle));
  const [montoExp, setMontoExp] = useState<string>(() =>
    montoExpInicial(repartirRequisitos(parseRequisitos(value)).porTipo.get("experiencia_postor")?.detalle ?? ""),
  );
  // Monto de la experiencia MYPE (25% de la cuantía del ítem). Como el exigido,
  // no tiene columna: se relee del detalle o se calcula del exigido.
  const [montoMypeExp, setMontoMypeExp] = useState<string>(() =>
    montoMypeInicial(repartirRequisitos(parseRequisitos(value)).porTipo.get("experiencia_postor")?.detalle ?? ""),
  );
  // Al cambiar el exigido, el MYPE se recalcula a su 25% (queda editable después).
  const cambiarMontoExp = (valor: string) => {
    setMontoExp(valor);
    setMontoMypeExp(pct25(valor));
  };
  // Qué se considera similar al objeto convocado: la segunda frase del requisito.
  // Tampoco tiene columna; se relee del detalle, igual que el monto.
  const [similaresExp, setSimilaresExp] = useState<string>(() =>
    similaresDeExperiencia(repartirRequisitos(parseRequisitos(value)).porTipo.get("experiencia_postor")?.detalle ?? ""),
  );
  useEffect(() => {
    if (value !== emitidoRef.current) {
      const next = repartirRequisitos(parseRequisitos(value));
      setReparto(next);
      const detExp = next.porTipo.get("experiencia_postor")?.detalle ?? "";
      // Sin monto guardado, se calcula del Monto estimado; el MYPE, del exigido.
      const expVal = montoDeExperiencia(detExp) || montoEstimadoTexto;
      setMontoExp(expVal);
      setMontoMypeExp(montoMypeDeExperiencia(detExp) || pct25(expVal));
      setSimilaresExp(similaresDeExperiencia(detExp));
      emitidoRef.current = value;
    }
  }, [value, montoEstimadoTexto]);

  // El monto de experiencia MYPE no puede pasar del 25% de la cuantía. Se avisa,
  // no se bloquea: es una propuesta del área usuaria que valida la DEC (Art. 72.1).
  const mypeTope =
    typeof montoEstimado === "number" && Number.isFinite(montoEstimado) && montoEstimado > 0
      ? montoEstimado * 0.25
      : null;
  const mypeExcede = mypeTope !== null && montoMypeExp.trim() !== "" && Number(montoMypeExp) > mypeTope;

  const { porTipo, otrosObligatorios, otrosFacultativos } = reparto;

  // Las actividades del cuadro de experiencia, que heredan formación y
  // capacitación. Se calcula UNA vez (antes se parseaba dos veces por render, una
  // por cuadro) y con identidad estable, para que los cuadros hijos —memoizados—
  // no se repinten en cada tecla que se escriba en OTRO campo del editor.
  const actividadesExperiencia = useMemo(
    () => parsePersonalClave(personalClaveExperiencia ?? "").map((f) => f.actividad),
    [personalClaveExperiencia],
  );
  // Callbacks estables hacia los cuadros hijos: `onCampoFicha` ya es estable, pero
  // envolverlo en una flecha nueva por render anularía la memoización del hijo.
  const setPersonalClave = useCallback((next: string) => onCampoFicha?.("personalClaveExperiencia", next), [onCampoFicha]);
  const setFormacion = useCallback((next: string) => onCampoFicha?.("formacionAcademica", next), [onCampoFicha]);
  const setCapacitacion = useCallback((next: string) => onCampoFicha?.("capacitacionPersonalClave", next), [onCampoFicha]);

  function propagar(next: RepartoRequisitos) {
    if (readOnly) return;
    setReparto(next);
    const texto = componerRequisitos(next);
    emitidoRef.current = texto;
    onChange(texto);
  }

  function emit(
    next: Map<TipoRequisitoArt72, EstadoTipoRequisito>,
    otrosObl: string[] = otrosObligatorios,
    otrosFac: RequisitoFacultativo[] = otrosFacultativos,
  ) {
    propagar({ porTipo: next, otrosObligatorios: otrosObl, otrosFacultativos: otrosFac });
  }

  function cambiar(key: TipoRequisitoArt72, estado: EstadoRequisito) {
    const next = new Map(porTipo);
    const actual = next.get(key);
    next.set(key, {
      estado,
      // El detalle se conserva al cambiar de naturaleza: es lo que se exige, y
      // no depende de si el requisito es obligatorio o facultativo.
      detalle: actual?.detalle ?? "",
      // La acreditación (cómo se prueba, Art. 72.1) aplica a ambas naturalezas,
      // así que también se conserva al cambiar de obligatorio a facultativo.
      acreditacion: actual?.acreditacion ?? "",
      // El sustento solo aplica a los facultativos: al dejar de serlo, se suelta.
      sustento: estado === "facultativo" ? (actual?.sustento ?? "") : "",
    });
    emit(next);
  }

  function editar(key: TipoRequisitoArt72, campo: "detalle" | "acreditacion" | "sustento", valor: string) {
    const next = new Map(porTipo);
    const actual = next.get(key) ?? { estado: "obligatorio" as EstadoRequisito, detalle: "", acreditacion: "", sustento: "" };
    // Si la matriz lo hace obligatorio, editar su detalle no debe dejar un estado
    // "facultativo"/"no" heredado: el estado guardado se alinea con la ley.
    const estado: EstadoRequisito = matriz[key] === "obligatorio" ? "obligatorio" : actual.estado;
    next.set(key, { ...actual, estado, [campo]: valor });
    emit(next);
  }

  // Propuesta de la IA para «servicios similares». A diferencia del resto de la
  // experiencia —que es texto fijo y se compone—, qué se considera similar es un
  // juicio abierto sobre el objeto, así que SÍ se le pide al modelo. Es una
  // propuesta: rellena el campo, que el usuario revisa. Si falla, se conserva lo
  // que hubiera y se avisa; nunca se borra con una respuesta en blanco.
  const [proponiendo, setProponiendo] = useState(false);
  const [errorSimilares, setErrorSimilares] = useState("");
  // Fase 4 · divulgación progresiva: el bloque de capacidad técnica (personal
  // clave, formación, capacitación, equipamiento e infraestructura) es el más
  // largo del editor. Arranca colapsado salvo que ya traiga contenido, para no
  // enterrar el resto de tipos bajo un muro de sub-cuadros.
  const hayCapTecnica = [
    personalClaveExperiencia,
    personalClaveAcreditacion,
    formacionAcademica,
    formacionAcademicaAcreditacion,
    capacitacionPersonalClave,
    capacitacionPersonalClaveAcreditacion,
    equipamientoEstrategico,
    equipamientoEstrategicoAcreditacion,
    infraestructuraEstrategica,
    infraestructuraEstrategicaAcreditacion,
  ].some((v) => (v ?? "").trim());
  const [capTecnicaAbierta, setCapTecnicaAbierta] = useState(hayCapTecnica);
  async function proponerSimilares() {
    if (!necesidadId || readOnly) return;
    setProponiendo(true);
    setErrorSimilares("");
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}/servicios-similares`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.texto) {
        setErrorSimilares(data?.error ?? "No se pudo proponer. Escríbelo a mano.");
        return;
      }
      setSimilaresExp(data.texto);
    } catch {
      setErrorSimilares("No se pudo conectar. Escríbelo a mano.");
    } finally {
      setProponiendo(false);
    }
  }

  // «Redactar del formato» de la experiencia del postor. Como la forma de pago o la
  // recepción, se COMPONE con el texto del formato en vez de pedírselo al
  // modelo: es texto reglamentario con un solo hueco, el monto. El monto y su
  // versión en letras salen del número tecleado, en la moneda de la convocatoria.
  function redactarExperiencia() {
    // Se rellenan LOS DOS campos a la vez: el detalle (qué se exige, con el
    // monto y lo similar) y la acreditación (cómo se prueba), que es texto fijo
    // del formato. Un solo `emit` para no dejar la ficha en un estado a medias.
    const next = new Map(porTipo);
    const actual = next.get("experiencia_postor") ?? {
      estado: "obligatorio" as EstadoRequisito,
      detalle: "",
      acreditacion: "",
      sustento: "",
    };
    next.set("experiencia_postor", {
      ...actual,
      // Requisito único: párrafo general + cláusula MYPE, con el monto exigido y
      // el monto MYPE que registró el área usuaria en sus campos.
      detalle: componerExperienciaPostor({ monto: montoExp, montoMype: montoMypeExp, moneda, objeto, similares: similaresExp }),
      acreditacion: ACREDITACION_EXPERIENCIA,
    });
    emit(next);
  }

  const hayHeredados = otrosObligatorios.length > 0 || otrosFacultativos.length > 0;

  // El Art. 72.3.e limita la capacidad económica a los procedimientos CON
  // precalificación, y el 72.4 remite a las bases estándar de cada modalidad.
  // Ofrecerla siempre invitaba a exigir en un Concurso Público de servicios algo
  // que su modelo no contempla. Si ya viniera rellenada de antes se conserva:
  // ocultar un dato escrito sería hacerlo desaparecer sin avisar.
  const conPrecalificacion = tienePrecalificacion(tipoProceso);
  // Obligatoriedad por bases estándar (Art. 72.4): la fija el PROCEDIMIENTO, no el
  // usuario (es lo que el comentario de cabecera anticipaba: "el día que esté la
  // tabla, se deriva del tipo de procedimiento"). Los obligatorios de la matriz se
  // muestran bloqueados; el resto (facultativos) los decide la entidad. Sin
  // procedimiento definido, la matriz no fija nada y todo queda a criterio.
  const matriz = requisitosDeProcedimiento(tipoProceso ?? null, "", conPrecalificacion);
  // Lo que propuso el área usuaria (A3), para contrastar en modo decisión (A4).
  const propuestaPorTipo = useMemo(
    () => (modo === "decision" && propuesta?.trim() ? repartirRequisitos(parseRequisitos(propuesta)).porTipo : null),
    [modo, propuesta],
  );
  const tiposAplicables = TIPOS_REQUISITO_ART72.filter(
    (t) => t.key !== "capacidad_economica" || conPrecalificacion || porTipo.get("capacidad_economica")?.estado !== "no",
  );

  // Resumen de completitud (lógica pura y testeada en requisitos-por-procedimiento).
  // Guía de un vistazo, no bloqueo (los definitivos los establece la DEC, Art. 72.1).
  const resumen = analizarRequisitos(porTipo, matriz, conPrecalificacion);
  // Facultativos que el área usuaria propuso y esta decisión (DEC) excluye →
  // requieren su no objeción (Art. 44.8). Vacío fuera del modo decisión.
  const excluidos = new Set(facultativosExcluidos(propuestaPorTipo, porTipo, matriz));

  // "Por qué es obligatorio": nombra el procedimiento que lo fija (Art. 72.4).
  const porQueObligatorio = tipoProceso
    ? `Obligatorio en «${tipoProceso}» por las bases estándar (R.D. N° 0001-2026-EF/54.01, Art. 72.4). La ley lo fija según el procedimiento; no se elige.`
    : "Obligatorio por las bases estándar (R.D. N° 0001-2026-EF/54.01, Art. 72.4). La ley lo fija; no se elige.";

  return (
    <div className={RC_ROOT}>
      <span className={RC_MODO} data-modo={modo}>
        {modo === "decision" ? (
          <>
            <Gavel size={12} /> Decisión de la DEC · Art. 72.1
          </>
        ) : (
          <>
            <PencilLine size={12} /> Propuesta del área usuaria · Art. 44.2.b
          </>
        )}
      </span>

      <p className={RC_HINT}>
        <Info size={12} /> El Art. 72.3 del Reglamento define estos cinco tipos y no admite otros. Los
        OBLIGATORIOS los fija la ley según el procedimiento (bases estándar, Art. 72.4): salen bloqueados
        «Obligatorio · bases estándar».{" "}
        {modo === "decision"
          ? "Valida y perfecciona su detalle; decides los facultativos con su sustento y puedes excluir uno si limita la concurrencia, con no objeción del área usuaria (Art. 44.8)."
          : "Describe qué exiges en cada uno y cómo se acredita; propón los facultativos que correspondan con su sustento."}
      </p>

      {resumen.obligatorios > 0 || resumen.facultativos > 0 ? (
        <div className={RC_RESUMEN}>
          <span className={RC_RESUMEN_CUENTA}>
            {resumen.obligatorios} obligatorio{resumen.obligatorios === 1 ? "" : "s"} ·{" "}
            {resumen.facultativos} facultativo{resumen.facultativos === 1 ? "" : "s"}
          </span>
          {resumen.faltaSustento.length > 0 ? (
            <span className={RC_RESUMEN_FALTA}>
              <AlertTriangle size={11} /> falta sustento en {resumen.faltaSustento.length}
            </span>
          ) : null}
          {resumen.economicaSinPrecalificacion ? (
            <span className={RC_RESUMEN_FALTA}>
              <AlertTriangle size={11} /> capacidad económica sin precalificación
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={RC_TIPOS}>
        {tiposAplicables.map((tipo, i) => {
          const e = porTipo.get(tipo.key);
          // La matriz de bases estándar manda: si fija el tipo como obligatorio, el
          // estado efectivo es "obligatorio" aunque el valor guardado diga otra cosa.
          const obligatorioPorMatriz = matriz[tipo.key] === "obligatorio";
          const estado: EstadoRequisito = obligatorioPorMatriz ? "obligatorio" : (e?.estado ?? "no");
          // Contraste con la propuesta del área usuaria (solo en modo decisión).
          const propuestoEstado = propuestaPorTipo?.get(tipo.key)?.estado;
          const fuePropuesto = !!propuestoEstado && propuestoEstado !== "no";
          // ¿La DEC excluye un facultativo que el área usuaria propuso? → no
          // objeción (Art. 44.8). El conjunto lo calcula la función pura testeada.
          const excluidoRequiereNoObjecion = excluidos.has(tipo.key);
          // Agrupación 3.5.1/3.5.2 y letra A–D del formato oficial. El encabezado
          // sale antes del PRIMER tipo aplicable de su grupo (robusto a que la
          // matriz oculte alguno). Es solo presentación: no toca datos ni claves.
          const grupo = GRUPO_TIPO_ART72[tipo.key];
          const abreGrupo =
            tiposAplicables.findIndex((t) => GRUPO_TIPO_ART72[t.key] === grupo) === i;
          const letra = LETRA_TIPO_ART72[tipo.key];
          return (
            <Fragment key={tipo.key}>
              {abreGrupo ? <p className={RC_GRUPOTITULO}>{TITULO_GRUPO_ART72[grupo]}</p> : null}
              <div className={RC_TIPO} data-estado={estado}>
              <div className={RC_TIPOHEAD}>
                <div className={RC_TIPONOMBRE}>
                  <strong>{letra ? `${letra}. ` : ""}{tipo.label}</strong>
                  {requisitosModelo?.has(tipo.key) ? (
                    <span className={RC_DELMODELO} title="El modelo de requerimiento de este procedimiento trae este apartado">
                      · lo pide el modelo
                    </span>
                  ) : null}
                  {fuePropuesto ? (
                    <span className={RC_DELMODELO} title="El área usuaria lo incluyó en su propuesta del requerimiento (A3)">
                      · propuesto por el área usuaria
                    </span>
                  ) : null}
                  <small>{ayudaPorObjeto(tipo.key, tipo.ayuda, objeto)}</small>
                </div>
                {obligatorioPorMatriz ? (
                  // Obligatorio por ley (Art. 72.4 · bases estándar): no se elige.
                  // Select bloqueado para mantener el mismo aspecto que los demás.
                  <select
                    aria-label={`Naturaleza de ${tipo.label}`}
                    disabled
                    title={porQueObligatorio}
                    value="obligatorio"
                  >
                    <option value="obligatorio">Obligatorio · bases estándar</option>
                  </select>
                ) : (
                  <select
                    aria-label={`Naturaleza de ${tipo.label}`}
                    disabled={readOnly}
                    onChange={(ev) => cambiar(tipo.key, ev.target.value as EstadoRequisito)}
                    value={estado}
                  >
                    <option value="no">No aplica</option>
                    <option value="facultativo">Facultativo</option>
                    {/* La obligatoriedad la fija la matriz (Art. 72.4), no la DEC:
                        para un tipo que la matriz NO hace obligatorio, la entidad
                        solo puede proponerlo como facultativo (que se vuelve
                        exigible al pasar a las bases). El "Obligatorio" solo se
                        ofrece si ya venía marcado así (dato heredado), para poder
                        corregirlo sin perderlo. */}
                    {estado === "obligatorio" ? (
                      <option value="obligatorio">Obligatorio (heredado)</option>
                    ) : null}
                  </select>
                )}
              </div>
              {/* No objeción: la DEC excluye un facultativo que el área usuaria
                  propuso. Es el único cambio de requisitos que la exige (Guía
                  Cap. III, f) · Art. 44.8); apartarse en el detalle o fijar
                  obligatorios es potestad de la DEC (Art. 72.1). */}
              {excluidoRequiereNoObjecion ? (
                <p className={RC_AVISOTOPE} role="status">
                  <AlertTriangle aria-hidden size={11} /> El área usuaria lo propuso como facultativo:
                  excluirlo requiere su no objeción (Art. 44.8).
                </p>
              ) : null}
              {/* El 72.3 fija el TIPO; el contenido concreto lo pone la
                  entidad. Sin detalle, el requisito no es acreditable. */}
              {/* Experiencia del postor: el monto facturado es un NÚMERO con
                  decimales, y de él sale la frase entera del formato —cifra y
                  letras, en la moneda de la convocatoria—. Se registra aquí y
                  «Redactar del formato» lo compone en el detalle de abajo. */}
              {tipo.key === "experiencia_postor" && estado !== "no" ? (
                <>
                  {/* Monto y «qué se considera similar», en UNA fila: el monto es
                      una cifra corta y no necesita todo el ancho. */}
                  <div className={RC_EXPFILA}>
                    <label className={`${RC_CAMPO} ${RC_MONTO}`}>
                      <span>Monto facturado acumulado exigido</span>
                      <input
                        disabled={readOnly}
                        inputMode="decimal"
                        min={0}
                        onChange={(ev) => cambiarMontoExp(ev.target.value)}
                        placeholder="Ej. 180000.00"
                        step="0.01"
                        type="number"
                        value={montoExp}
                      />
                    </label>
                    <label className={`${RC_CAMPO} ${RC_MONTO}`}>
                      <span>Monto de experiencia MYPE (≤ 25% de la cuantía del ítem)</span>
                      <input
                        aria-invalid={mypeExcede || undefined}
                        disabled={readOnly}
                        inputMode="decimal"
                        min={0}
                        onChange={(ev) => setMontoMypeExp(ev.target.value)}
                        placeholder="Ej. 45000.00"
                        step="0.01"
                        type="number"
                        value={montoMypeExp}
                      />
                      {mypeExcede && mypeTope !== null ? (
                        <span className={RC_AVISOTOPE} role="status">
                          <AlertTriangle aria-hidden size={11} /> No puede superar el 25% de la cuantía
                          (S/ {mypeTope.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).
                        </span>
                      ) : null}
                    </label>
                    <label className={`${RC_CAMPO} ${RC_SIMILARES}`}>
                      <span className={RC_SPANBOTON}>
                        {`¿Qué se considera ${objetoConvocatoria(objeto)} similar al objeto convocado?`}
                        {necesidadId ? (
                          <button
                            className={RC_REDACTAR}
                            disabled={readOnly || proponiendo}
                            onClick={proponerSimilares}
                            title="Que la IA proponga qué se considera similar, a partir del objeto de la contratación"
                            type="button"
                          >
                            {proponiendo ? <Loader className="reqCalSpin" size={12} /> : <Sparkles size={12} />}
                            {proponiendo ? "Proponiendo…" : "Proponer con IA"}
                          </button>
                        ) : null}
                      </span>
                      <textarea
                        disabled={readOnly}
                        onChange={(ev) => setSimilaresExp(ev.target.value)}
                        placeholder="Ej. mantenimiento de áreas verdes, jardinería y afines."
                        rows={2}
                        value={similaresExp}
                      />
                      {errorSimilares ? <span className={RC_AVISOTOPE} role="status">{errorSimilares}</span> : null}
                    </label>
                  </div>
                  <button
                    className={RC_REDACTAR}
                    disabled={readOnly}
                    onClick={redactarExperiencia}
                    title="Redactar el requisito con el texto del formato (Art. 72.3.c)"
                    type="button"
                  >
                    <Sparkles size={12} /> Redactar del formato
                  </button>
                </>
              ) : null}
              {/* Consorcio (Art. 72.3.d): el requisito no es texto libre, son las
                  tres condiciones D.1/D.2/D.3 con su número. Se componen en el
                  mismo `detalle`, así que el resto del flujo no cambia. */}
              {tipo.key === "consorcio" && estado !== "no" ? (
                <label className={RC_CAMPO}>
                  <span>Requisitos (condiciones de participación en consorcio)</span>
                  <ConsorcioEditor
                    onChange={(next) => editar("consorcio", "detalle", next)}
                    readOnly={readOnly}
                    value={e?.detalle ?? ""}
                  />
                </label>
              ) : null}
              {/* En «Capacidad técnica y profesional» (C) NO se pide el detalle
                  genérico cuando se muestran los cuadros C.1–C.4 (onCampoFicha):
                  esos ya recogen lo que se exige y cómo se acredita. En otros
                  modos (sin onCampoFicha) se conserva como reserva. */}
              {tipo.key !== "consorcio" && estado !== "no" && !(tipo.key === "capacidad_tecnica" && onCampoFicha) ? (
                <label className={RC_CAMPO}>
                  <span>
                    {modo === "decision" ? "¿Qué se exige? · valida o perfecciona" : "¿Qué se exige exactamente?"}
                  </span>
                  <textarea
                    disabled={readOnly}
                    onChange={(ev) => editar(tipo.key, "detalle", ev.target.value)}
                    placeholder={`Ej. ${tipo.ejemplo}`}
                    // Crece con su contenido. La experiencia del postor se compone
                    // en dos párrafos (general + MYPE): se le da la mitad de alto
                    // (mínimo 5 filas) para que ocupe menos y baste con scroll.
                    rows={
                      tipo.key === "experiencia_postor"
                        ? Math.max(5, Math.ceil(filasTextarea(e?.detalle ?? "") / 2))
                        : filasTextarea(e?.detalle ?? "")
                    }
                    value={e?.detalle ?? ""}
                  />
                  {/* Topes del modelo. Se avisa, no se bloquea: esto es una PROPUESTA del
                      area usuaria y quien establece los requisitos es la DEC (Art. 72.1).
                      Impedir escribir la cifra seria arrogarse esa decision. */}
                  {(tipo.key === "experiencia_postor" || tipo.key === "capacidad_tecnica")
                    ? avisosDeTopes(
                        // El monto tecleado se suma al detalle para que el tope
                        // de 3x avise ya, antes de componer el texto.
                        tipo.key === "experiencia_postor" ? `${e?.detalle ?? ""} ${montoExp}` : e?.detalle ?? "",
                        montoEstimado ?? null,
                        tipo.key,
                      ).map((aviso) => (
                        <span className={RC_AVISOTOPE} key={aviso.clave} role="status">
                          <AlertTriangle aria-hidden size={11} /> {aviso.mensaje}
                        </span>
                      ))
                    : null}
                </label>
              ) : null}

              {/* Art. 72.1: el cumplimiento "es acreditado conforme indiquen
                  las bases". La acreditación la propone el área usuaria en el
                  requerimiento y se fija en las bases; NO tiene celda en el
                  formato de estrategia. Por eso solo se captura en modo propuesta
                  (Necesidad/A3); en A4 (decisión) se oculta —no produciría salida—
                  para que el editor muestre solo lo que la DEC decide y exporta. */}
              {estado !== "no" && modo !== "decision" && !(tipo.key === "capacidad_tecnica" && onCampoFicha) ? (
                <label className={RC_CAMPO}>
                  <span className={tipo.key === "consorcio" ? "reqCalSpanConBoton" : undefined}>
                    ¿Con qué se acredita?
                    {tipo.key === "consorcio" ? (
                      <button
                        className={RC_REDACTAR}
                        disabled={readOnly}
                        onClick={() => editar("consorcio", "acreditacion", ACREDITACION_CONSORCIO)}
                        title="Rellenar con el texto estándar del formato"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar del formato
                      </button>
                    ) : null}
                  </span>
                  <textarea
                    disabled={readOnly}
                    onChange={(ev) => editar(tipo.key, "acreditacion", ev.target.value)}
                    placeholder={tipo.key === "consorcio" ? "Pulsa «Redactar del formato»: se acredita con la promesa de consorcio." : ACREDITACION_TIPICA[tipo.key]}
                    rows={filasTextarea(e?.acreditacion ?? "")}
                    value={e?.acreditacion ?? ""}
                  />
                </label>
              ) : null}

              {/* CAPACIDAD TÉCNICA Y PROFESIONAL · Experiencia del personal clave
                  (Art. 72.3.b). Va en su PROPIA sección —el tipo `capacidad_tecnica`,
                  rotulado «Requisitos de calificación adicionales»—, entre
                  «Experiencia del postor» y «Condiciones de consorcio». El texto lo
                  fija el formato y tiene tres huecos; «Redactar del formato» lo
                  compone con ellos. Se guarda en columnas propias de la
                  necesidad (personalClave*), por eso escribe con `onCampoFicha`. */}
              {tipo.key === "capacidad_tecnica" && estado !== "no" && onCampoFicha ? (
                <div className={RC_CAPTECNICA}>
                  <button
                    aria-expanded={capTecnicaAbierta}
                    className={RC_CAPTOGGLE}
                    onClick={() => setCapTecnicaAbierta((v) => !v)}
                    type="button"
                  >
                    {capTecnicaAbierta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    Detalle · C.1 a C.4
                    <small>personal clave, formación, capacitación, equipamiento e infraestructura</small>
                  </button>
                  {capTecnicaAbierta ? (
                  <div className={RC_PERSONALCLAVE}>
                  <p className={RC_PCTITULO}>C.1 Experiencia del personal clave</p>
                  <p className={RC_PCAYUDA}>
                    Un puesto por fila. En el requerimiento sale como cuadro (Art. 72.3.b).
                  </p>
                  <PersonalClaveEditor
                    onChange={setPersonalClave}
                    readOnly={readOnly}
                    value={personalClaveExperiencia ?? ""}
                  />
                  {/* Cómo se acredita: texto fijo del formato. «Redactar del formato»
                      lo rellena; se puede ajustar a mano. */}
                  <label className={RC_CAMPO}>
                    <span className={RC_SPANBOTON}>
                      ¿Cómo se acredita la experiencia del personal clave?
                      <button
                        className={RC_REDACTAR}
                        disabled={readOnly}
                        onClick={() => onCampoFicha("personalClaveAcreditacion", ACREDITACION_PERSONAL_CLAVE)}
                        title="Rellenar con el texto estándar del formato (Anexo N° 19)"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar del formato
                      </button>
                    </span>
                    <textarea
                      disabled={readOnly}
                      onChange={(ev) => onCampoFicha("personalClaveAcreditacion", ev.target.value)}
                      placeholder="Pulsa «Redactar del formato» para el texto estándar del Anexo N° 19."
                      // Crece con el contenido: el texto del Anexo N° 19 son tres
                      // párrafos y con cuatro filas no se leía sin desplazarse.
                      rows={filasTextarea(personalClaveAcreditacion ?? "", true)}
                      value={personalClaveAcreditacion ?? ""}
                    />
                  </label>

                  {/* CALIFICACIONES DEL PERSONAL CLAVE · Formación académica
                      (Art. 72.3.b, C.2.1). Un puesto por fila; el requisito de
                      cada uno se redacta con el grado y el puesto de su fila. */}
                  <p className={RC_PCTITULO}>C.2 Calificaciones del personal clave</p>
                  <p className={RC_PCAYUDA}>
                    C.2.1 Formación académica · solo cabe exigir el GRADO o el TÍTULO, no cursos ni especializaciones.
                  </p>
                  <FormacionAcademicaEditor
                    actividades={actividadesExperiencia}
                    onChange={setFormacion}
                    readOnly={readOnly}
                    value={formacionAcademica ?? ""}
                  />
                  {/* Cómo se acredita la formación académica: texto fijo del
                      formato (Anexo N° 19, SUNEDU/MINEDU). */}
                  <label className={RC_CAMPO}>
                    <span className={RC_SPANBOTON}>
                      ¿Cómo se acredita la formación académica?
                      <button
                        className={RC_REDACTAR}
                        disabled={readOnly}
                        onClick={() => onCampoFicha("formacionAcademicaAcreditacion", ACREDITACION_FORMACION_ACADEMICA)}
                        title="Rellenar con el texto estándar del formato (Anexo N° 19)"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar del formato
                      </button>
                    </span>
                    <textarea
                      disabled={readOnly}
                      onChange={(ev) => onCampoFicha("formacionAcademicaAcreditacion", ev.target.value)}
                      placeholder="Pulsa «Redactar del formato» para el texto estándar (Anexo N° 19, SUNEDU/MINEDU)."
                      rows={filasTextarea(formacionAcademicaAcreditacion ?? "", true)}
                      value={formacionAcademicaAcreditacion ?? ""}
                    />
                  </label>

                  {/* CALIFICACIONES DEL PERSONAL CLAVE · Capacitación (Art. 72.3.b).
                      Un puesto por fila (heredado del cuadro de experiencia); el
                      requisito de cada uno se redacta con sus horas, materia y
                      puesto. La capacitación se exige hasta un máximo de 120 horas. */}
                  <p className={RC_PCTITULO}>C.2.2 Capacitación del personal clave</p>
                  <p className={RC_PCAYUDA}>
                    Horas (máximo 120), materia relacionada con la actividad que realizará el personal clave, y el
                    puesto del que se acredita.
                  </p>
                  <CapacitacionPersonalClaveEditor
                    actividades={actividadesExperiencia}
                    onChange={setCapacitacion}
                    readOnly={readOnly}
                    value={capacitacionPersonalClave ?? ""}
                  />
                  {/* Cómo se acredita la capacitación: texto fijo del formato (Anexo N° 19). */}
                  <p className={RC_PCTITULO}>Capacitación del personal clave</p>
                  <label className={RC_CAMPO}>
                    <span className={RC_SPANBOTON}>
                      ¿Cómo se acredita la capacitación?
                      <button
                        className={RC_REDACTAR}
                        disabled={readOnly}
                        onClick={() => onCampoFicha("capacitacionPersonalClaveAcreditacion", ACREDITACION_CAPACITACION)}
                        title="Rellenar con el texto estándar del formato (Anexo N° 19)"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar del formato
                      </button>
                    </span>
                    <textarea
                      disabled={readOnly}
                      onChange={(ev) => onCampoFicha("capacitacionPersonalClaveAcreditacion", ev.target.value)}
                      placeholder="Pulsa «Redactar del formato» para el texto estándar (Anexo N° 19)."
                      rows={filasTextarea(capacitacionPersonalClaveAcreditacion ?? "", true)}
                      value={capacitacionPersonalClaveAcreditacion ?? ""}
                    />
                  </label>

                  {/* EQUIPAMIENTO ESTRATÉGICO (Art. 72.3.b, C.3). No es cuadro:
                      dos textos —el requisito, con su hueco, y su acreditación—. */}
                  <p className={RC_PCTITULO}>C.3 Equipamiento estratégico</p>
                  <label className={RC_CAMPO}>
                    <span className={RC_SPANBOTON}>
                      Requisitos (equipamiento estratégico)
                      <button
                        className={RC_REDACTAR}
                        disabled={readOnly}
                        onClick={() => onCampoFicha("equipamientoEstrategico", REQUISITO_EQUIPAMIENTO)}
                        title="Insertar el hueco del formato para consignar el equipamiento estratégico"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar del formato
                      </button>
                    </span>
                    <textarea
                      disabled={readOnly}
                      onChange={(ev) => onCampoFicha("equipamientoEstrategico", ev.target.value)}
                      placeholder="Solo el equipamiento CLASIFICADO como estratégico para la prestación, según la estrategia de contratación."
                      rows={filasTextarea(equipamientoEstrategico ?? "")}
                      value={equipamientoEstrategico ?? ""}
                    />
                  </label>
                  <label className={RC_CAMPO}>
                    <span className={RC_SPANBOTON}>
                      ¿Cómo se acredita el equipamiento estratégico?
                      <button
                        className={RC_REDACTAR}
                        disabled={readOnly}
                        onClick={() => onCampoFicha("equipamientoEstrategicoAcreditacion", ACREDITACION_EQUIPAMIENTO)}
                        title="Rellenar con el texto estándar del formato"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar del formato
                      </button>
                    </span>
                    <textarea
                      disabled={readOnly}
                      onChange={(ev) => onCampoFicha("equipamientoEstrategicoAcreditacion", ev.target.value)}
                      placeholder="Pulsa «Redactar del formato» para el texto estándar."
                      rows={filasTextarea(equipamientoEstrategicoAcreditacion ?? "", true)}
                      value={equipamientoEstrategicoAcreditacion ?? ""}
                    />
                  </label>

                  {/* INFRAESTRUCTURA ESTRATÉGICA (Art. 72.3.b, C.3). Igual que el
                      equipamiento: el requisito, con su hueco, y su acreditación. */}
                  <p className={RC_PCTITULO}>C.4 Infraestructura estratégica</p>
                  <label className={RC_CAMPO}>
                    <span className={RC_SPANBOTON}>
                      Requisitos (infraestructura estratégica)
                      <button
                        className={RC_REDACTAR}
                        disabled={readOnly}
                        onClick={() => onCampoFicha("infraestructuraEstrategica", REQUISITO_INFRAESTRUCTURA)}
                        title="Insertar el hueco del formato para consignar la infraestructura estratégica"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar del formato
                      </button>
                    </span>
                    <textarea
                      disabled={readOnly}
                      onChange={(ev) => onCampoFicha("infraestructuraEstrategica", ev.target.value)}
                      placeholder="Solo la infraestructura CLASIFICADA como estratégica para la prestación, según la estrategia de contratación."
                      rows={filasTextarea(infraestructuraEstrategica ?? "")}
                      value={infraestructuraEstrategica ?? ""}
                    />
                  </label>
                  <label className={RC_CAMPO}>
                    <span className={RC_SPANBOTON}>
                      ¿Cómo se acredita la infraestructura estratégica?
                      <button
                        className={RC_REDACTAR}
                        disabled={readOnly}
                        onClick={() => onCampoFicha("infraestructuraEstrategicaAcreditacion", ACREDITACION_INFRAESTRUCTURA)}
                        title="Rellenar con el texto estándar del formato"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar del formato
                      </button>
                    </span>
                    <textarea
                      disabled={readOnly}
                      onChange={(ev) => onCampoFicha("infraestructuraEstrategicaAcreditacion", ev.target.value)}
                      placeholder="Pulsa «Redactar del formato» para el texto estándar."
                      rows={filasTextarea(infraestructuraEstrategicaAcreditacion ?? "", true)}
                      value={infraestructuraEstrategicaAcreditacion ?? ""}
                    />
                  </label>
                  </div>
                  ) : null}
                </div>
              ) : null}

              {/* Solo los facultativos se sustentan: son los únicos que la DEC
                  puede excluir tras la interacción con el mercado. */}
              {estado === "facultativo" ? (
                <label className={RC_CAMPO}>
                  <span>Sustento: ¿por qué se exige este facultativo?</span>
                  <textarea
                    disabled={readOnly}
                    onChange={(ev) => editar(tipo.key, "sustento", ev.target.value)}
                    placeholder="Sin sustento, la DEC puede excluirlo si el mercado muestra que no es necesario."
                    rows={filasTextarea(e?.sustento ?? "")}
                    value={e?.sustento ?? ""}
                  />
                </label>
              ) : null}
            </div>
            </Fragment>
          );
        })}
      </div>

      {/* Datos heredados del texto libre anterior: no se borran solos. */}
      {hayHeredados ? (
        <div className={RC_HEREDADOS}>
          <p>
            <AlertTriangle size={12} /> Estos requisitos vienen de un registro anterior en texto
            libre y no corresponden a ninguno de los cinco tipos del Art. 72.3. Reemplázalos por el
            tipo que corresponda y elimínalos.
          </p>
          {[...otrosObligatorios.map((n) => ({ nombre: n, fac: false })),
            ...otrosFacultativos.map((f) => ({ nombre: f.nombre, fac: true }))].map((item, i) => (
            <div className={RC_ROW} key={`${item.nombre}-${i}`}>
              <span>
                {item.nombre} <em>{item.fac ? "(facultativo)" : "(obligatorio)"}</em>
              </span>
              {!readOnly ? (
                <button
                  aria-label={`Eliminar ${item.nombre}`}
                  className="segCronoRemove"
                  onClick={() =>
                    emit(
                      porTipo,
                      otrosObligatorios.filter((n) => !(n === item.nombre && !item.fac)),
                      otrosFacultativos.filter((f) => !(f.nombre === item.nombre && item.fac)),
                    )
                  }
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
