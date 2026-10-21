"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { calcularFechasCronograma, sumarDiasHabiles, validarCronograma } from "@/lib/cronograma-fechas";
import { diasParaProcedimiento, type DiasCronogramaPorProcedimiento } from "@/lib/cronograma-dias";
import { SustentoIA } from "./sustento-ia";
import { useFeriados } from "./use-feriados";
import {
  actividadesSeleccionDe,
  construirCronogramaInicial,
  cronogramaCoincideConProcedimiento,
  esActividadSegunBases,
  type ActividadCronograma,
  ADELANTOS_FILAS,
  type AdelantoFila,
  ETAPAS_ROL,
  FACTOR_OTRO,
  factorCanonicoDeNombre,
  factoresDeProcedimiento,
  type FactorEvaluacion,
  leerAdelantos,
  FASES_CRONOGRAMA,
  leerFilas,
  modeloRolesP,
  OPCIONES_FACTOR_EVALUACION,
  OPCIONES_PUNTO_NO_NEGOCIABLE,
  PUNTO_NO_CORRESPONDE,
  sustentoAlElegirFactor,
  sustentoAlElegirPunto,
  type PuntoNoNegociable,
  ROL_OTRO,
  rolesDe,
  type RolEstrategia,
  textoRolHabitual,
} from "@/lib/estrategia-formato";
import { PROV_QUITAR, PROV_TABLA, PROV_VACIA } from "./tabla-editor-estilos";

// Caja de aviso/gating (migrada de la clase .pasoGating de styles.css): borde
// con color-mix de marca sobre fondo brand-soft. Idéntica a la de fase-panel.
const GATING =
  "mb-2.5 flex items-start gap-1.5 rounded-[8px] border border-[color-mix(in_srgb,var(--brand)_25%,var(--line))] bg-brand-soft px-2.5 py-2 text-[12px] leading-[1.45] text-ink";

/**
 * o) Cronograma estimado del proceso de contratación (Art. 46.1.o).
 *
 * Tabla y no textarea: el formato tiene columnas de fase, actividad, inicio y
 * fin, y con texto libre no hay forma de repartirlo por celdas.
 */
export function CronogramaEditor({
  value,
  onChange,
  readOnly,
  procedimiento,
  procedimientoLabel,
  plazoDias,
  plazoUnidad,
  cuantia,
  diasPorProcedimiento,
}: {
  value: unknown;
  onChange: (next: ActividadCronograma[]) => void;
  readOnly?: boolean;
  // Tipo de procedimiento elegido en a) (var_a_procedimiento): determina las
  // actividades de la fase de selección (Art. 46.1.o).
  procedimiento?: string;
  procedimientoLabel?: string;
  // Plazo de ejecución del requerimiento (A3/necesidad): se anota junto a la
  // actividad "Ejecución contractual" al sembrar. Es una duración, no una fecha.
  plazoDias?: number | null;
  plazoUnidad?: string | null;
  // Cuantía actualizada de A5: fija el plazo de apelación/consentimiento (Art. 304
  // + 82.1) al calcular las fechas — 8 hábiles si ≥ 485 000, 5 si menor (+1 día).
  cuantia?: number | null;
  // Días ESTIMADOS del cronograma POR PROCEDIMIENTO (Configuración anual). Se
  // resuelve el set del procedimiento de a); los mínimos legales van en código, y
  // si no llega nada, cae al defecto por procedimiento.
  diasPorProcedimiento?: DiasCronogramaPorProcedimiento;
}) {
  const filas = leerFilas<ActividadCronograma>(value);
  // Días del procedimiento elegido en a) (o el defecto). Se pasa a cada cálculo.
  const dias = diasParaProcedimiento(diasPorProcedimiento, procedimiento);
  const actividadesSeleccion = actividadesSeleccionDe(procedimiento);
  // datetime-local necesita "YYYY-MM-DDTHH:mm"; una fecha antigua sin hora se abre
  // a las 00:00 para que el input la acepte.
  const paraInput = (v: string | undefined) => (!v ? "" : v.includes("T") ? v.slice(0, 16) : `${v}T00:00`);
  // ¿o) sigue listando las actividades del procedimiento que se eligió en a)?
  const coincideConA = cronogramaCoincideConProcedimiento(filas, procedimiento);

  // Feriados registrados en Configuración: se descuentan (junto a sáb/dom) al
  // calcular las fechas. Vienen del hook compartido (mismo cálculo en A5,
  // vencimientos, etc.).
  const { setFechas: feriados } = useFeriados();
  const avisos = validarCronograma(filas, feriados, procedimiento);

  // Cálculo AUTOMÁTICO de fechas: si el cronograma tiene actividades pero AÚN SIN
  // fechas, las encadena solo —desde hoy, con el procedimiento de a) y la cuantía de
  // A5 (Arts. 64.1/66.1/68.1/304 + 82.1)—, sin tener que pulsar "Calcular fechas".
  // Solo actúa cuando NO hay ninguna fecha: nunca pisa un cronograma ya fechado ni
  // editado a mano; para rehacerlo, la DEC usa los botones. Aplica a cualquier
  // expediente —existente o nuevo— en cuanto se abre el paso.
  useEffect(() => {
    if (readOnly) return;
    const actuales = leerFilas<ActividadCronograma>(value);
    if (actuales.length === 0 || actuales.some((f) => (f.inicio ?? "").trim())) return;
    // Ancla por defecto: hoy + 5 días hábiles (margen para aprobar el expediente
    // antes de arrancar el cronograma). La DEC puede reanclar con el botón.
    const ancla = sumarDiasHabiles(new Date().toISOString().slice(0, 10), 5, feriados);
    onChange(calcularFechasCronograma(actuales, ancla, feriados, { procedimiento, cuantia, dias }));
    // feriados/onChange se omiten a propósito: solo debe reaccionar a que aparezcan
    // actividades sin fechas o cambie el procedimiento/cuantía de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, procedimiento, cuantia, dias]);

  function editar(i: number, campo: keyof ActividadCronograma, v: string) {
    onChange(filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));
  }

  /**
   * Siembra el cronograma con las actividades del PROCEDIMIENTO elegido en a).
   *
   * El Art. 46.1.o exige considerar las actividades "de acuerdo al tipo de
   * procedimiento y al objeto contractual": la fase de selección se llena con la
   * lista propia del procedimiento. Es un punto de partida editable —se pueden
   * borrar, renombrar y añadir— que la DEC verifica contra las bases estándar.
   */
  function sembrar() {
    // Lista las etapas del procedimiento Y calcula sus fechas de una vez: ancla por
    // defecto hoy + 5 días hábiles (margen para aprobar el expediente), reanclable
    // luego con «Calcular fechas desde el inicio».
    const base = construirCronogramaInicial(procedimiento, plazoDias, plazoUnidad);
    const ancla = sumarDiasHabiles(new Date().toISOString().slice(0, 10), 5, feriados);
    onChange(calcularFechasCronograma(base, ancla, feriados, { procedimiento, cuantia, dias }));
  }

  /**
   * Rehace SOLO la fase de selección con las actividades del procedimiento
   * elegido ahora en a). Las preparatorias y la ejecución no dependen del
   * procedimiento y suelen estar ya ajustadas a mano: rehacer el cronograma
   * entero las tiraría.
   */
  function relistarSeleccion() {
    const otras = filas.filter((f) => f.fase !== "seleccion");
    const antes = otras.filter((f) => f.fase !== "ejecucion");
    const despues = otras.filter((f) => f.fase === "ejecucion");
    const nuevo = [
      ...antes,
      ...actividadesSeleccion.map((actividad) => ({ actividad, fase: "seleccion" as const })),
      ...despues,
    ];
    // Recalcula las fechas de las nuevas etapas: reancla desde el inicio de la
    // primera actividad si ya lo hay, o desde hoy + 5 días hábiles.
    const ancla = filas[0]?.inicio || sumarDiasHabiles(new Date().toISOString().slice(0, 10), 5, feriados);
    onChange(calcularFechasCronograma(nuevo, ancla, feriados, { procedimiento, cuantia, dias }));
  }

  return (
    <div className={PROV_TABLA}>
      {filas.length === 0 ? (
        <p className={PROV_VACIA}>
          Sin actividades.{" "}
          {procedimientoLabel
            ? `Puedes listar las de ${procedimientoLabel} y ajustar sus fechas`
            : "Elige el tipo de procedimiento en a) para listar sus actividades, o parte de las habituales"}
          : el formato exige que el cronograma refleje el tipo de procedimiento y el objeto contractual (Art. 46.1.o).
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fase</th>
              <th>Actividad</th>
              <th>Inicio</th>
              <th>Fin</th>
              {!readOnly ? <th aria-label="Quitar" /> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td>
                  <select disabled={readOnly} onChange={(e) => editar(i, "fase", e.target.value)} value={f.fase ?? ""}>
                    <option value="">—</option>
                    {FASES_CRONOGRAMA.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    disabled={readOnly || f.fase === "preparatorias"}
                    onChange={(e) => editar(i, "actividad", e.target.value)}
                    title={
                      f.fase === "preparatorias"
                        ? "Esta actividad viene impresa en el formato: solo se registran sus fechas."
                        : undefined
                    }
                    value={f.actividad ?? ""}
                  />
                </td>
                {/* SOLO la actividad "Ejecución contractual" va "SEGÚN BASES":
                    su plazo lo fijan las bases. El resto de la fase de ejecución
                    (presentación de requisitos, suscripción) sí lleva fechas. */}
                {esActividadSegunBases(f.actividad) ? (
                  <>
                    <td>
                      <input disabled readOnly title="La ejecución no fija fecha en la estrategia." value="SEGÚN BASES" />
                    </td>
                    <td>
                      <input disabled readOnly title="La ejecución no fija fecha en la estrategia." value="SEGÚN BASES" />
                    </td>
                  </>
                ) : (
                  <>
                    <td>
                      <input
                        disabled={readOnly}
                        onChange={(e) => editar(i, "inicio", e.target.value)}
                        type="datetime-local"
                        value={paraInput(f.inicio)}
                      />
                    </td>
                    <td>
                      <input
                        disabled={readOnly}
                        onChange={(e) => editar(i, "fin", e.target.value)}
                        type="datetime-local"
                        value={paraInput(f.fin)}
                      />
                    </td>
                  </>
                )}
                {!readOnly ? (
                  <td>
                    <button
                      aria-label={`Quitar la actividad ${i + 1}`}
                      className={PROV_QUITAR}
                      onClick={() => onChange(filas.filter((_, j) => j !== i))}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!readOnly ? (
        <div className="flex gap-2">
          <button
            className="secondaryButton compactButton"
            onClick={() => onChange([...filas, { fase: "seleccion" }])}
            type="button"
          >
            <Plus size={13} /> Añadir actividad
          </button>
          {filas.length === 0 ? (
            <button className="secondaryButton compactButton" onClick={sembrar} type="button">
              {procedimientoLabel
                ? `Listar las actividades de ${procedimientoLabel}`
                : "Usar las actividades habituales"}
            </button>
          ) : null}
          {filas.length > 0 ? (
            <button
              className="secondaryButton compactButton"
              disabled={!filas[0]?.inicio}
              // "Calcular" recalcula las fechas SOBRE las actividades ACTUALES —las
              // conserva tal cual, incluidas las añadidas o renombradas a mano— y las
              // encadena fecha+hora desde el inicio de la primera: días hábiles
              // respetando los feriados y los plazos del Reglamento, con la convención
              // de horas 00:01/23:59 (la hora del anclaje se respeta). Ya NO rehace la
              // lista: para volver a las etapas mínimas del procedimiento están el
              // sembrado y el aviso «Re-listar la selección».
              onClick={() =>
                onChange(calcularFechasCronograma(filas, filas[0]?.inicio, feriados, { procedimiento, cuantia, dias }))
              }
              title={
                filas[0]?.inicio
                  ? "Recalcula las fechas de las actividades actuales (días hábiles, respetando feriados y los plazos del Reglamento) desde el inicio de la primera. No cambia la lista de actividades."
                  : "Pon la fecha y hora de inicio de la primera actividad para calcular el resto."
              }
              type="button"
            >
              Calcular fechas desde el inicio
            </button>
          ) : null}
        </div>
      ) : null}
      {/* a) manda sobre o): si se cambia el procedimiento después de sembrar el
          cronograma, este se queda listando las actividades del anterior y el
          formato sale contradiciéndose. Se AVISA y se ofrece rehacerlo; no se
          rehace solo, porque las fechas ya ajustadas son trabajo de la DEC. */}
      {coincideConA === false && !readOnly ? (
        <div className={GATING}>
          <span>
            Las actividades de la fase de selección son las de otro procedimiento
            {procedimientoLabel ? (
              <>
                {" "}
                y en a) está elegido <strong>{procedimientoLabel}</strong>
              </>
            ) : null}
            . El Art. 46.1.o pide el cronograma del procedimiento que se va a convocar.
          </span>
          <button
            className="secondaryButton compactButton"
            onClick={relistarSeleccion}
            title="Reemplaza las actividades de la fase de selección (se pierden sus fechas). Las preparatorias y la ejecución no se tocan."
            type="button"
          >
            {procedimientoLabel ? `Re-listar las de ${procedimientoLabel}` : "Re-listar la selección"}
          </button>
        </div>
      ) : null}
      {/* Las fechas se pueden editar a mano después de calcularlas, así que los
          plazos que el Reglamento fija como mínimos se revisan sobre lo que hay
          en la tabla, no solo al calcular. */}
      {avisos.map((aviso) => (
        <div className={GATING} key={aviso}>
          <span>{aviso}</span>
        </div>
      ))}
      {filas.length > 0 ? (
        <small className="text-[11px] leading-[1.4] text-muted">
          “Calcular fechas” encadena inicio y fin en días hábiles (omite fines de semana y los
          feriados registrados en Configuración) y aplica los plazos del Reglamento: mínimo de 22
          días hábiles entre convocatoria y ofertas (Art. 64.1), registro de participantes como
          rango (Art. 65.2), consultas según el procedimiento (Art. 66.1) y consentimiento de la
          buena pro (Art. 82.1). Verifica y ajusta contra las bases estándar.
        </small>
      ) : null}
    </div>
  );
}

/** p) Roles y responsabilidades de los involucrados (Art. 46.1.p). */
export function RolesEditor({
  value,
  onChange,
  readOnly,
  tipoEvaluador,
  objeto,
  proceso,
}: {
  value: unknown;
  onChange: (next: RolEstrategia[]) => void;
  readOnly?: boolean;
  // Tipo de evaluador elegido en e) (var_e_tipo_evaluador): especializa el rol del
  // evaluador (oficial de compra / comité / jurado), lo único que la Guía hace
  // variar por procedimiento.
  tipoEvaluador?: string;
  // Objeto contractual (de A3) y proceso de a): adaptan el modelo de roles (el
  // entregable del área usuaria y la mención del procedimiento).
  objeto?: string;
  proceso?: string;
}) {
  const filas = leerFilas<RolEstrategia>(value);
  // Involucrados según el tipo de evaluador de e) (la fila del evaluador cambia).
  const roles = rolesDe(tipoEvaluador);

  function editar(i: number, campo: keyof RolEstrategia, v: string) {
    onChange(filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));
  }

  // Involucrado del desplegable que corresponde a lo escrito: si el texto
  // arranca con uno de los habituales, ese; si hay texto pero no encaja, "Otro".
  const involucradoDe = (rol: string | undefined) => {
    const r = (rol ?? "").trim();
    if (!r) return "";
    return roles.find((x) => r.startsWith(x.involucrado))?.involucrado ?? ROL_OTRO;
  };

  function elegirInvolucrado(i: number, val: string) {
    if (val === "") return;
    if (val === ROL_OTRO) {
      // Si venía de un habitual, se limpia para escribir libre; si ya era libre, se respeta.
      const actual = filas[i]?.rol ?? "";
      if (roles.some((x) => actual.startsWith(x.involucrado))) editar(i, "rol", "");
      return;
    }
    const r = roles.find((x) => x.involucrado === val);
    if (r) onChange(filas.map((f, j) => (j === i ? { ...f, rol: textoRolHabitual(r), etapa: r.etapa } : f)));
  }

  // "Listar roles habituales": siembra el MODELO de roles por etapa (Guía p),
  // adaptado al proceso de a), el objeto y el evaluador de e). Editable.
  function sembrar() {
    onChange(modeloRolesP({ proceso, objeto, tipoEvaluador }));
  }

  return (
    <div className={PROV_TABLA}>
      {filas.length === 0 ? (
        <p className={PROV_VACIA}>
          Sin roles. Lista los involucrados de la fase de selección (DEC, evaluador, área usuaria,
          RR. HH., titular/AGA, presupuesto…) o añádelos uno a uno, con la etapa en la que actúan.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Rol y responsabilidad</th>
              <th>Etapa de la fase de selección</th>
              {!readOnly ? <th aria-label="Quitar" /> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td>
                  <select
                    aria-label={`Involucrado del rol ${i + 1}`}
                    disabled={readOnly}
                    onChange={(e) => elegirInvolucrado(i, e.target.value)}
                    value={involucradoDe(f.rol)}
                  >
                    <option value="">— Elegir involucrado —</option>
                    {roles.map((r) => (
                      <option key={r.involucrado} value={r.involucrado}>
                        {r.involucrado}
                      </option>
                    ))}
                    <option value={ROL_OTRO}>{ROL_OTRO}</option>
                  </select>
                  <textarea
                    disabled={readOnly}
                    onChange={(e) => editar(i, "rol", e.target.value)}
                    placeholder="Rol y responsabilidad del involucrado…"
                    rows={3}
                    value={f.rol ?? ""}
                  />
                </td>
                <td>
                  <select disabled={readOnly} onChange={(e) => editar(i, "etapa", e.target.value)} value={f.etapa ?? ""}>
                    <option value="">—</option>
                    {ETAPAS_ROL.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                {!readOnly ? (
                  <td>
                    <button
                      aria-label={`Quitar el rol ${i + 1}`}
                      className={PROV_QUITAR}
                      onClick={() => onChange(filas.filter((_, j) => j !== i))}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!readOnly ? (
        <div className="flex gap-2">
          <button
            className="secondaryButton compactButton"
            onClick={() => onChange([...filas, {}])}
            type="button"
          >
            <Plus size={13} /> Añadir rol
          </button>
          {filas.length === 0 ? (
            <button className="secondaryButton compactButton" onClick={sembrar} type="button">
              Listar roles habituales
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * g) Propuesta de factores de evaluación (Art. 46.1.g).
 *
 * Tabla y no textarea: el formato los pide fila a fila (nombre y sustento) en
 * B56:C58. Con texto libre, el exportador volcaba el bloque entero en B56.
 */
export function FactoresEditor({
  value,
  onChange,
  readOnly,
  procedimiento,
}: {
  value: unknown;
  onChange: (next: FactorEvaluacion[]) => void;
  readOnly?: boolean;
  // Procedimiento elegido en a): el menú lista SIEMPRE todos los factores, pero
  // sirve para avisar cuando el procedimiento va por menor monto (Art. 74.3).
  procedimiento?: string;
}) {
  const filas = leerFilas<FactorEvaluacion>(value);
  // Solo para la NOTA: si es subasta inversa / comparación de precios, la lista
  // legal de factores es vacía (Art. 74.3). El desplegable igualmente ofrece todos.
  const opciones = factoresDeProcedimiento(procedimiento);

  // Un nombre "custom" es el que NO está en la lista estándar: se escribió con
  // la opción "Otro". Sirve para saber si una fila ya cargada debe mostrar el
  // campo de texto, sin depender del estado local.
  const esCustom = (nombre: string | undefined) =>
    !!nombre && !(OPCIONES_FACTOR_EVALUACION as readonly string[]).includes(nombre);

  // "Otro" recién elegido: el nombre aún está vacío, así que no basta con
  // `esCustom`. Se recuerda por índice para mostrar el campo de texto de una.
  const [otroMode, setOtroMode] = useState<Set<number>>(new Set());

  function editar(i: number, campo: keyof FactorEvaluacion, v: string) {
    onChange(filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));
  }

  function elegirNombre(i: number, opcion: string) {
    if (opcion === FACTOR_OTRO) {
      setOtroMode((prev) => new Set(prev).add(i));
      // Si venía de una opción de la lista, se limpia para escribir de cero.
      if (!esCustom(filas[i]?.nombre)) editar(i, "nombre", "");
    } else {
      setOtroMode((prev) => {
        const n = new Set(prev);
        n.delete(i);
        return n;
      });
      // Se fija el nombre y se precarga AUTOMÁTICAMENTE el sustento oficial del
      // factor (plantilla editable, Art. 73.3): al elegir —o CAMBIAR de— factor,
      // su sustento aparece solo. `sustentoAlElegirFactor` respeta lo que la DEC
      // haya escrito a mano (devuelve null y no se toca).
      onChange(
        filas.map((f, j) => {
          if (j !== i) return f;
          const next: FactorEvaluacion = { ...f, nombre: opcion };
          const nuevo = sustentoAlElegirFactor(opcion, f.sustento ?? "");
          if (nuevo !== null) next.sustento = nuevo;
          return next;
        }),
      );
    }
  }

  // Nombre escrito A MANO (modo "Otro"): al salir del campo, si lo tecleado
  // coincide con un factor del catálogo (sin distinguir mayúsculas ni tildes), se
  // NORMALIZA el nombre a su forma canónica ("mejora en las ee.tt." → "Mejora en
  // las EE.TT.") y se precarga su sustento oficial, igual que si se hubiera elegido
  // del desplegable. El sustento solo rellena huecos: `sustentoAlElegirFactor`
  // respeta lo que la DEC ya escribió.
  function reconocerNombreEscrito(i: number, valor: string) {
    const canonico = factorCanonicoDeNombre(valor);
    if (!canonico) return;
    onChange(
      filas.map((f, j) => {
        if (j !== i) return f;
        const next: FactorEvaluacion = { ...f, nombre: canonico };
        const nuevo = sustentoAlElegirFactor(canonico, f.sustento ?? "");
        if (nuevo !== null) next.sustento = nuevo;
        return next;
      }),
    );
    // Reconocido: la fila sale del modo "Otro" y vuelve al desplegable con el
    // factor canónico seleccionado; si se quedara en "Otro", el input libre —que
    // solo muestra nombres `esCustom`— saldría vacío al no ser ya un nombre custom.
    setOtroMode((prev) => {
      if (!prev.has(i)) return prev;
      const n = new Set(prev);
      n.delete(i);
      return n;
    });
  }

  function quitar(i: number) {
    onChange(filas.filter((_, j) => j !== i));
    // Reindexar el modo "Otro": las filas por debajo de la quitada bajan uno.
    setOtroMode((prev) => {
      const n = new Set<number>();
      for (const idx of prev) {
        if (idx < i) n.add(idx);
        else if (idx > i) n.add(idx - 1);
      }
      return n;
    });
  }

  return (
    <div className={`${PROV_TABLA} [&_td:first-child]:w-[34%] [&_td:first-child_select]:max-w-[260px] [&_td:first-child_input]:max-w-[260px]`}>
      {filas.length === 0 ? (
        <p className={PROV_VACIA}>
          {opciones.length === 0
            ? "Este procedimiento otorga la buena pro por MENOR MONTO (Art. 74.3): por regla general no lleva factores técnicos, pero puedes añadir uno si tu contratación lo justifica."
            : "Sin factores. Son facultativos: si no propones ninguno, el formato saldrá con esta sección en blanco."}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre del factor</th>
              <th>Sustento</th>
              {!readOnly ? <th aria-label="Quitar" /> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const enOtro = otroMode.has(i) || esCustom(f.nombre);
              // Un factor no se propone dos veces: las opciones ya usadas en OTRA
              // fila se deshabilitan (la de esta fila sigue disponible para no
              // bloquear su propio valor).
              const usadosOtros = new Set(
                filas
                  .filter((_, j) => j !== i)
                  .map((g) => (g.nombre ?? "").trim())
                  .filter(Boolean),
              );
              return (
                <tr key={i}>
                  <td>
                    <select
                      aria-label={`Nombre del factor ${i + 1}`}
                      disabled={readOnly}
                      onChange={(e) => elegirNombre(i, e.target.value)}
                      value={enOtro ? FACTOR_OTRO : (f.nombre ?? "")}
                    >
                      <option value="">— Seleccionar factor —</option>
                      {OPCIONES_FACTOR_EVALUACION.map((o) => (
                        <option key={o} disabled={usadosOtros.has(o)} value={o}>
                          {usadosOtros.has(o) ? `${o} (ya agregado)` : o}
                        </option>
                      ))}
                      <option value={FACTOR_OTRO}>{FACTOR_OTRO}</option>
                    </select>
                    {enOtro ? (
                      <input
                        aria-label={`Especificar el factor ${i + 1}`}
                        disabled={readOnly}
                        onBlur={(e) => reconocerNombreEscrito(i, e.target.value)}
                        onChange={(e) => editar(i, "nombre", e.target.value)}
                        placeholder="Escribe el factor…"
                        value={esCustom(f.nombre) ? f.nombre : ""}
                      />
                    ) : null}
                    {enOtro && esCustom(f.nombre) && usadosOtros.has((f.nombre ?? "").trim()) ? (
                      <small className="mt-0.5 block text-[11px] text-danger">Ese factor ya está agregado.</small>
                    ) : null}
                  </td>
                  <td>
                    <textarea
                      disabled={readOnly}
                      onChange={(e) => editar(i, "sustento", e.target.value)}
                      placeholder="Se evaluará en función al plazo de entrega ofertado…"
                      rows={2}
                      value={f.sustento ?? ""}
                    />
                    {/* Sin botón de IA en g): al elegir el factor su sustento
                        oficial se precarga solo (`sustentoAlElegirFactor`), y es
                        texto de las bases estándar que no debe reescribir un
                        modelo. La DEC lo edita a mano si quiere. */}
                  </td>
                  {!readOnly ? (
                    <td>
                      <button
                        aria-label={`Quitar el factor ${i + 1}`}
                        className={PROV_QUITAR}
                        onClick={() => quitar(i)}
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!readOnly ? (
        <button
          className="secondaryButton compactButton"
          onClick={() => onChange([...filas, {}])}
          type="button"
        >
          <Plus size={13} /> Añadir factor
        </button>
      ) : null}
    </div>
  );
}

/**
 * j) Puntos no negociables del requerimiento (Art. 46.1.j): tabla de dos
 * columnas —el punto no negociable y su sustento—, una fila por punto. En el
 * formato, los puntos van a la celda C87 y sus sustentos a C88 (numerados para
 * que se correspondan).
 */
export function PuntosEditor({
  value,
  onChange,
  readOnly,
  processId,
}: {
  value: unknown;
  onChange: (next: PuntoNoNegociable[]) => void;
  readOnly?: boolean;
  // Expediente: los borradores de sustento se redactan con sus datos.
  processId?: string;
}) {
  // Migración: j) era un textarea (string). Un valor de texto heredado se
  // muestra como un único punto para no perderlo; al editar pasa a array.
  // Vacío → una fila "NO CORRESPONDE" por defecto: los puntos no negociables solo
  // aplican con subetapa de negociación (Art. 46.1.j), así que ese es el caso común.
  const filasGuardadas =
    typeof value === "string" && value.trim()
      ? [{ punto: value.trim() }]
      : leerFilas<PuntoNoNegociable>(value);
  const filas: PuntoNoNegociable[] =
    filasGuardadas.length > 0 ? filasGuardadas : [{ punto: PUNTO_NO_CORRESPONDE, sustento: PUNTO_NO_CORRESPONDE }];

  // Un punto "custom" es cualquiera que NO sea "NO CORRESPONDE": se escribió con
  // la opción "Otro". Sirve para saber si una fila ya cargada muestra el texto libre.
  const esCustom = (punto: string | undefined) => !!punto && punto !== PUNTO_NO_CORRESPONDE;

  // "Otro" recién elegido: el punto aún está vacío, así que no basta con `esCustom`.
  const [otroMode, setOtroMode] = useState<Set<number>>(new Set());

  function editar(i: number, campo: keyof PuntoNoNegociable, v: string) {
    onChange(filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));
  }

  function elegirPunto(i: number, opcion: string) {
    if (opcion === FACTOR_OTRO) {
      setOtroMode((prev) => new Set(prev).add(i));
      // Se limpia para escribir de cero; el sustento "NO CORRESPONDE" auto también
      // se limpia para que la DEC redacte el propio (no así uno ya suyo).
      onChange(
        filas.map((f, j) =>
          j === i
            ? {
                ...f,
                punto: esCustom(f.punto) ? f.punto : "",
                sustento: f.sustento === PUNTO_NO_CORRESPONDE ? "" : f.sustento,
              }
            : f,
        ),
      );
    } else {
      setOtroMode((prev) => {
        const n = new Set(prev);
        n.delete(i);
        return n;
      });
      // "NO CORRESPONDE": el punto y su sustento quedan en "NO CORRESPONDE".
      const nuevo = sustentoAlElegirPunto(opcion);
      onChange(filas.map((f, j) => (j === i ? { ...f, punto: opcion, sustento: nuevo ?? f.sustento } : f)));
    }
  }

  return (
    <div className={PROV_TABLA}>
      <table>
        <thead>
          <tr>
            <th>Punto no negociable</th>
            <th>Sustento</th>
            {!readOnly ? <th aria-label="Quitar" /> : null}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const enOtro = otroMode.has(i) || esCustom(f.punto);
            return (
              <tr key={i}>
                <td>
                  <select
                    aria-label={`Punto no negociable ${i + 1}`}
                    disabled={readOnly}
                    onChange={(e) => elegirPunto(i, e.target.value)}
                    value={enOtro ? FACTOR_OTRO : PUNTO_NO_CORRESPONDE}
                  >
                    {OPCIONES_PUNTO_NO_NEGOCIABLE.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                    <option value={FACTOR_OTRO}>{FACTOR_OTRO}</option>
                  </select>
                  {enOtro ? (
                    <textarea
                      aria-label={`Especificar el punto ${i + 1}`}
                      disabled={readOnly}
                      onChange={(e) => editar(i, "punto", e.target.value)}
                      placeholder="El plazo de entrega no es negociable…"
                      rows={2}
                      value={esCustom(f.punto) ? f.punto : ""}
                    />
                  ) : null}
                </td>
                <td>
                  {enOtro ? (
                    <>
                      <textarea
                        disabled={readOnly}
                        onChange={(e) => editar(i, "sustento", e.target.value)}
                        placeholder="Por qué ese punto no puede negociarse…"
                        rows={2}
                        value={f.sustento ?? ""}
                      />
                      {processId && (f.punto ?? "").trim() ? (
                        <SustentoIA
                          actual={f.sustento}
                          campo="punto_no_negociable"
                          detalle={f.punto}
                          disabled={readOnly}
                          onUsar={(texto) => editar(i, "sustento", texto)}
                          processId={processId}
                        />
                      ) : null}
                    </>
                  ) : (
                    // "NO CORRESPONDE": el sustento va fijo, sin caja editable —igual
                    // que la variable b) cuando el procedimiento es competitivo—.
                    <input disabled readOnly value={PUNTO_NO_CORRESPONDE} />
                  )}
                </td>
                {!readOnly ? (
                  <td>
                    <button
                      aria-label={`Quitar el punto ${i + 1}`}
                      className={PROV_QUITAR}
                      onClick={() => onChange(filas.filter((_, j) => j !== i))}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      {!readOnly ? (
        <button
          className="secondaryButton compactButton"
          onClick={() => onChange([...filas, { punto: PUNTO_NO_CORRESPONDE, sustento: PUNTO_NO_CORRESPONDE }])}
          type="button"
        >
          <Plus size={13} /> Añadir punto
        </button>
      ) : null}
    </div>
  );
}

/**
 * l) Tabla de adelantos (Art. 46.1.l): una rejilla igual a la del formato
 * exportable —tres filas fijas (Adelanto directo / materiales / por avance) con
 * las columnas Marcar (X), Mecanismo de garantía y % del adelanto—. No es una
 * tabla de filas variables como los puntos: las filas son las tres del formato.
 * La fila que no se marca sale "NO CORRESPONDE" en el .xlsx (filas 108-110).
 */
export function AdelantosEditor({
  value,
  onChange,
  readOnly,
  esObras,
}: {
  value: unknown;
  onChange: (next: AdelantoFila[]) => void;
  readOnly?: boolean;
  // El adelanto para materiales y el de por avance SOLO se usan en obras (nota (*)
  // del formato). Fuera de obras, esas filas se bloquean y quedan "NO CORRESPONDE".
  esObras?: boolean;
}) {
  const guardadas = leerAdelantos(value);
  // Se renderizan SIEMPRE las tres filas del formato, con lo guardado por `prefijo`.
  // Una fila "solo obras" fuera de obras se bloquea: no se puede marcar y su marca
  // efectiva es siempre falsa (aunque un dato viejo la trajera marcada).
  const filas = ADELANTOS_FILAS.map((f) => {
    const row = guardadas.find((r) => r.prefijo === f.prefijo);
    const bloqueada = Boolean(f.soloObras) && !esObras;
    return {
      ...f,
      bloqueada,
      marcar: !bloqueada && Boolean(row?.marcar),
      mecanismo: row?.mecanismo ?? "",
      pct: row?.pct ?? "",
    };
  });

  function editar(prefijo: string, cambio: Partial<AdelantoFila>) {
    // Se reconstruyen las tres filas completas (con `prefijo`) para no perder ninguna.
    const next: AdelantoFila[] = ADELANTOS_FILAS.map((f) => {
      const cur = filas.find((r) => r.prefijo === f.prefijo)!;
      const base: AdelantoFila = { prefijo: f.prefijo, marcar: cur.marcar, mecanismo: cur.mecanismo, pct: cur.pct };
      if (f.prefijo === prefijo) {
        Object.assign(base, cambio);
        // Al desmarcar, se limpian mecanismo y % SOLO de esta fila (la que pasa a
        // "NO CORRESPONDE"). Antes el clear estaba fuera de este `if` y borraba el
        // mecanismo/% de las TRES filas al desmarcar cualquiera.
        if (cambio.marcar === false) {
          base.mecanismo = "";
          base.pct = "";
        }
      }
      return base;
    });
    onChange(next);
  }

  return (
    <div className={PROV_TABLA}>
      <table>
        <thead>
          <tr>
            <th>Seleccionar el tipo de adelanto</th>
            <th>Marcar</th>
            <th>Mecanismo de garantía a utilizar</th>
            <th>% del adelanto</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.prefijo}>
              <td>
                {f.label}
                {f.soloObras ? " (*)" : ""}
                {f.bloqueada ? (
                  <small style={{ display: "block", color: "var(--text-muted, #888)" }}>
                    Solo en obras — no aplica a este objeto.
                  </small>
                ) : null}
              </td>
              <td>
                <input
                  aria-label={`Marcar ${f.label}`}
                  checked={f.marcar}
                  disabled={readOnly || f.bloqueada}
                  onChange={(e) => editar(f.prefijo, { marcar: e.target.checked })}
                  type="checkbox"
                />
              </td>
              <td>
                {f.marcar ? (
                  <input
                    aria-label={`Mecanismo de garantía de ${f.label}`}
                    disabled={readOnly}
                    onChange={(e) => editar(f.prefijo, { mecanismo: e.target.value })}
                    placeholder="Carta fianza"
                    value={f.mecanismo}
                  />
                ) : (
                  <input disabled readOnly value="NO CORRESPONDE" />
                )}
              </td>
              <td>
                {f.marcar ? (
                  <input
                    aria-label={`Porcentaje del adelanto de ${f.label}`}
                    disabled={readOnly}
                    onChange={(e) => editar(f.prefijo, { pct: e.target.value })}
                    placeholder="10%"
                    value={f.pct}
                  />
                ) : (
                  <input disabled readOnly value="NO CORRESPONDE" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <small className="text-[11px] leading-[1.4] text-muted">(*) Solo se utilizan en el caso de ejecución de obras.</small>
    </div>
  );
}
