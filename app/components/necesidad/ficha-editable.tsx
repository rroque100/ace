"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Check,
  CheckCircle2,
  FileText,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { detectarMarca } from "@/lib/necesidad-denominacion";
import { OBJETOS_NECESIDAD, objetoNecesidadLabel } from "@/lib/necesidades";
import { PROCESO_SELECCION_OPCIONES } from "@/lib/procesos-seleccion";
import { TIPO_AREA_OPCIONES } from "@/lib/necesidad-workflow";
import { REQUERIMIENTO_GUIA } from "@/lib/requerimiento-guia";
import { componerControversias, parseInstituciones, textoLibreControversias } from "@/lib/instituciones-arbitrales";
import { desdeMatrizRiesgos } from "@/lib/matriz-riesgos";
import { NOMBRE_MAX } from "@/lib/necesidades-limites";
import { topeSubsanacion } from "@/lib/plazo-subsanacion";
import { cn } from "@/lib/utils";
import { Alert, Button } from "../ui";
import { NecesidadItemsEditor } from "../necesidad-items-editor";
import { useSettingsCatalog } from "../use-settings-catalog";
import { CampoFicha } from "./campo-ficha";
import { BarraObligatorios, SeccionBadge } from "./ficha-progreso";
import { CAMPO_LABEL } from "./campos-etiquetas";
import { FICHA_CTRL, FICHA_CTRL_H, FICHA_IA, FICHA_LABEL, FICHA_REQ } from "./ficha-estilos";

/** Referencia estable para el campo de requisitos cuando no hay ítems (memo de CampoFicha). */
const SIN_ITEMS: ReadonlyArray<{ nro: number; cuantia: number | null }> = [];

/** El copiloto son 345 lineas que solo ve quien lo despliega. */
const NecesidadCopiloto = dynamic(
  () => import("../necesidad-copiloto").then((m) => m.NecesidadCopiloto),
  { ssr: false },
);

import type { FichaField, FichaSection } from "@/lib/necesidad-ficha-secciones";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import type { ObjetoFilter } from "@/lib/procesos-seleccion";
import type { Necesidad, ObservacionNecesidad } from "@/lib/necesidades";
import type { NecesidadItem } from "@/lib/necesidad-items";
import { importeItem } from "@/lib/necesidad-items";
import { enRangoLpAbreviadaBienes, rangoLpAbreviadaConfigurado } from "@/lib/umbral-licitacion-abreviada";
import type { ModoFicha } from "@/lib/necesidad-modos";
import type { CopilotoCampo } from "../necesidad-copiloto";

/**
 * La ficha en modo EDICION: el formulario completo, con su paso a paso, su
 * indice de secciones, la guia del procedimiento y el copiloto.
 *
 * Era un IIFE de 680 lineas dentro del JSX del detalle —`{fichaEditable ? (() =>
 * { ... })() : ...}`—, que es la forma mas efectiva de que nada se pueda
 * memoizar ni probar: lo que devuelve una funcion llamada durante el render
 * forma parte del arbol de quien la llama.
 *
 * Depende de 65 cosas del padre, y por eso no se pudo sacar antes. No se han
 * convertido en 65 props: se han agrupado en seis bloques que ya existian en la
 * cabeza de cualquiera que leyera esto —el formulario, el catalogo, la vista, el
 * copiloto, el EETT/TDR y los manejadores de campo— mas lo suelto. Un componente
 * de 65 props no seria una frontera, seria la misma maraña con un import.
 *
 * Cada bloque se desestructura aqui arriba con los MISMOS nombres que tenia en
 * el padre. Es a proposito: asi el cuerpo se movio literal, sin tocar un solo
 * identificador, y se pudo comprobar que es identico al original.
 */
export function FichaEditable({
  campo,
  catalogo,
  copiloto,
  eett,
  ficha,
  necesidad,
  necesidadId,
  onError,
  onRecargar,
  permisos,
  items,
  setItems,
  uitValor,
  lpAbreviadaBienesMin,
  lpAbreviadaBienesMax,
  vista,
}: {
  /** Lo que necesita cada control de campo. */
  campo: {
    areasSugeridas: string[];
    cambiarCampo: (api: string, valor: string) => void;
    marcarError: (api: string, mensaje: string | null) => void;
    marcarTocado: (api: string) => void;
    redactarConIA: (api: string) => void;
  };
  /** Que campos aplican, cuales son obligatorios y como van los contadores. */
  catalogo: {
    avanceRequerimiento: (modo: "edicion" | "lectura") => { done: number; total: number };
    campoEsObligatorio: (field: FichaField) => boolean;
    campoExigible: (field: FichaField) => boolean;
    camposDeIA: ReadonlyMap<string, string>;
    camposParaObjeto: (fields: FichaField[]) => FichaField[];
    camposVisibles: (section: FichaSection) => { visibles: FichaField[]; ocultosOpcionales: number };
    ejeObjeto: ObjetoFilter | "";
    ejeProceso: string;
    exigidosModelo: ReadonlySet<string>;
    obsPendientesPorCampo: ReadonlyMap<string, ObservacionNecesidad[]>;
    opcionesProcesoAgrupadas: { otros: typeof PROCESO_SELECCION_OPCIONES; realiza: typeof PROCESO_SELECCION_OPCIONES };
    /** El panel de campos obligatorios, ya pintado por el padre. */
    panelObligatorios: React.ReactNode;
    /** Tipos del Art. 72.3 que declara el modelo del procedimiento. */
    requisitosModelo: ReadonlySet<string>;
    tieneValor: (field: FichaField) => boolean;
    tipoObj: ObjetoFilter | null | undefined;
  };
  copiloto: {
    abierto: boolean;
    montado: boolean;
    redactar: { key: string; nonce: number } | null;
    setAbierto: React.Dispatch<React.SetStateAction<boolean>>;
    setMontado: React.Dispatch<React.SetStateAction<boolean>>;
  };
  eett: {
    abrir: (doc: { id: string }) => void;
    docs: Array<{ file_name: string; id: string; status: string; title: string; metadata?: unknown; created_at?: string }>;
    subiendo: boolean;
    subir: (archivo: File, tipo: "eett" | "tdr") => void;
    /** Abre el modal de gestión del PDF de EETT/TDR (subir, revisar, eliminar). */
    gestionar: () => void;
  };
  /** Todo el ciclo de vida del formulario, tal cual lo devuelve `useFichaForm`. */
  ficha: {
    autoguardado: "" | "guardando" | "guardado" | "error";
    camposBorrador: string[];
    camposTocados: Set<string>;
    conflictoGuardado: boolean;
    descartarBorrador: () => void;
    fichaEdit: boolean;
    fichaForm: Record<string, string>;
    fieldErrors: Record<string, string>;
    guardar: () => Promise<void>;
    savingFicha: boolean;
    setFichaEdit: React.Dispatch<React.SetStateAction<boolean>>;
    setFichaField: (api: string, valor: string) => void;
    superarConflicto: () => void;
  };
  necesidad: Necesidad;
  necesidadId: string;
  onError: (mensaje: string) => void;
  onRecargar: () => Promise<void> | void;
  permisos: { derivar: boolean; manage: boolean };
  items: NecesidadItem[];
  setItems: (items: NecesidadItem[]) => void;
  /** UIT del ejercicio, para juzgar el tope del contrato menor. */
  uitValor: number | null;
  /** Rango (S/) de la LP abreviada para bienes: qué ítems llevan experiencia por ítem. */
  lpAbreviadaBienesMin: number | null;
  lpAbreviadaBienesMax: number | null;
  /** Como se esta mirando la ficha: paso a paso, filtros y modo de trabajo. */
  vista: {
    cambiarModo: (m: ModoFicha) => void;
    modo: ModoFicha;
    modoSimple: boolean;
    obligatoriosOnly: boolean;
    seccionEnVista: string;
    setObligatoriosOnly: React.Dispatch<React.SetStateAction<boolean>>;
    setOptionalExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
    setWizardMode: React.Dispatch<React.SetStateAction<boolean>>;
    setWizardStep: React.Dispatch<React.SetStateAction<number>>;
    toggleModoSimple: () => void;
    wizardMode: boolean;
    wizardStep: number;
  };
}) {
  const { entity: configuredEntity } = useSettingsCatalog();
  const { areasSugeridas, cambiarCampo, marcarError, marcarTocado, redactarConIA } = campo;
  const {
    avanceRequerimiento, campoEsObligatorio, campoExigible, camposDeIA, camposParaObjeto,
    camposVisibles, ejeObjeto, ejeProceso, exigidosModelo, obsPendientesPorCampo,
    opcionesProcesoAgrupadas, panelObligatorios, requisitosModelo, tieneValor, tipoObj,
  } = catalogo;
  const {
    abierto: copilotoAbierto, montado: copilotoMontado, redactar: copilotoRedactar,
    setAbierto: setCopilotoAbierto, setMontado: setCopilotoMontado,
  } = copiloto;
  const { abrir: abrirEettEstable, docs: eettDocs, subiendo: eettUploading, subir: subirEettEstable } = eett;
  const {
    autoguardado, camposBorrador, camposTocados, conflictoGuardado, descartarBorrador,
    fichaEdit, fichaForm, fieldErrors, guardar: saveFicha, savingFicha, setFichaEdit,
    setFichaField, superarConflicto,
  } = ficha;
  const {
    cambiarModo, modo, modoSimple, obligatoriosOnly, seccionEnVista,
    setObligatoriosOnly, setOptionalExpanded, setWizardMode, setWizardStep,
    toggleModoSimple, wizardMode, wizardStep,
  } = vista;
  const setError = onError;
  const reload = onRecargar;

  const seccionesVisibles = FICHA_SECCIONES.filter((s) => {
    if (s.mostrarPara && !(tipoObj && s.mostrarPara.includes(tipoObj))) return false;
    // Sección sin campos visibles (p. ej. 3.5.2 quedó vacía tras
    // consolidar sus campos en el editor de requisitos): fuera en ambos
    // modos, para no dejar una cabecera huérfana.
    if (camposParaObjeto(s.fields).length === 0) return false;
    // En "solo obligatorios" ocultamos las secciones que no aportan
    // nada exigible: ni campos obligatorios ni contenido del Art. 44.2.
    if (obligatoriosOnly) {
      return camposParaObjeto(s.fields).some((f) => campoEsObligatorio(f) || f.recomendado);
    }
    return true;
  });
  const totalPasos = 1 + seccionesVisibles.length; // Datos principales + secciones

  // Progreso de campos obligatorios (guía al usuario a completar lo mínimo).
  // Antes se recontaba aqui sobre las secciones VISIBLES y solo con los
  // obligatorios de la ficha: al filtrar por «Solo obligatorios» cambiaba el
  // denominador y dejaba de cuadrar con la cabecera.
  const { done: obligDone, total: obligTotal } = avanceRequerimiento("edicion");
  const pasoActual = wizardMode ? Math.min(wizardStep, totalPasos - 1) : -1;

  // Campos redactables por el copiloto: los de texto de las secciones
  // visibles (sin ocultos ni casillas), con su valor actual como contexto.
  const camposCopiloto: CopilotoCampo[] = [];
  const faltantesCopiloto: string[] = [];
  const vistosCopiloto = new Set<string>();
  for (const s of seccionesVisibles) {
    for (const f of camposParaObjeto(s.fields)) {
      // Lo que el copiloto ve como «falta» es lo mismo que cuenta la cabecera: si
      // el modelo exige un campo y esta vacio, tiene que saberlo.
      if (campoExigible(f) && !tieneValor(f)) faltantesCopiloto.push(f.label);
      if (f.oculto || f.checkbox || f.kind === "number" || f.kind === "date") continue;
      // La solución de controversias NO se redacta con IA: su texto es el estándar
      // del Reglamento (se carga con el botón «Insertar texto estándar» en su
      // editor). Se deja fuera del copiloto para no reintroducir la redacción por
      // IA que duplicaba las instituciones.
      if (f.kind === "controversias") continue;
      if (vistosCopiloto.has(f.api)) continue;
      vistosCopiloto.add(f.api);
      camposCopiloto.push({
        key: f.api,
        label: f.label,
        valor: fichaForm[f.api] ?? "",
        baseLegal: f.baseLegal ?? "",
        seccion: s.title,
        // El molde del campo (estructura + ejemplo) viaja al copiloto para que
        // redacte con la FORMA que exige su artículo (p. ej. la finalidad con la
        // estructura tripartita del Art. 44.1), no solo con el principio.
        plantilla: f.plantilla ?? "",
        ejemplo: f.ejemplo ?? "",
      });
    }
  }

  // --- Navegación por secciones + completitud (Fase 4 UX/UI) ---
  const DATOS_PRINCIPALES_ID = "ficha-datos-principales";
  function seccionId(title: string) {
    return `ficha-sec-${title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;
  }
  type Completitud = {
    oblig: number;
    obligDone: number;
    llenos: number;
    total: number;
    estado: "completo" | "pendiente" | "parcial" | "vacio";
  };
  function completitudSeccion(section: FichaSection): Completitud {
    const campos = camposParaObjeto(section.fields).filter((f) => !f.oculto && !f.checkbox);
    let oblig = 0;
    let obligDone = 0;
    let llenos = 0;
    for (const f of campos) {
      const con = tieneValor(f);
      if (con) llenos += 1;
      // `campoExigible`, no `campoEsObligatorio`: si las partes cuentan con
      // otro criterio que el total, los chips no suman lo que dice la cabecera.
      if (campoExigible(f)) {
        oblig += 1;
        if (con) obligDone += 1;
      }
    }
    const total = campos.length;
    // Los obligatorios mandan: una sección está "lista" cuando no le
    // falta ninguno. Sin obligatorios, se guía por lo relleno.
    let estado: Completitud["estado"];
    if (oblig > 0) {
      estado = obligDone >= oblig ? "completo" : "pendiente";
    } else if (total === 0 || llenos === 0) {
      estado = llenos === 0 ? "vacio" : "parcial";
    } else {
      estado = llenos === total ? "completo" : "parcial";
    }
    return { oblig, obligDone, llenos, total, estado };
  }
  function badgeTexto(c: Completitud) {
    if (c.oblig > 0) return `${c.obligDone}/${c.oblig} oblig.`;
    if (c.total > 0) return `${c.llenos}/${c.total}`;
    return "";
  }
  function scrollASeccion(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const navSecciones = seccionesVisibles.map((s) => ({
    id: seccionId(s.title),
    title: s.title,
    comp: completitudSeccion(s),
  }));

  // El plazo para subsanar observaciones no puede pasar del 30% del plazo del
  // entregable (Art. 144). Es el único tope de la ficha que depende de OTRO
  // campo, así que se calcula aquí y baja al campo como un número suelto: leer
  // el formulario dentro de `CampoFicha` anularía su memoización.
  const topeSubsanacionDias = topeSubsanacion(fichaForm.plazoEjecucion);
  const motivoSubsanacion =
    topeSubsanacionDias === null
      ? ""
      : `No puede pasar de ${topeSubsanacionDias} días: es el 30% del plazo de ejecución (${(fichaForm.plazoEjecucion ?? "").trim()} días) que fija el Art. 144.`;

  // Ítems (nº + cuantía) para redactar la experiencia del postor rotulada por
  // ítem. Se memoiza —solo cambia con los ítems o el rango, no en cada tecla—
  // para no anular la memoización de `CampoFicha`; solo baja al campo de requisitos.
  //
  // Con el rango de la LP abreviada configurado, solo pasan los ítems cuya
  // cuantía cae en esa banda (los que "corresponden a una LP abreviada de
  // bienes"). Sin rango, pasan todos y el editor avisa de que falta configurarlo.
  const umbralLpConfigurado = rangoLpAbreviadaConfigurado({
    min: lpAbreviadaBienesMin,
    max: lpAbreviadaBienesMax,
  });
  const itemsExperiencia = useMemo(() => {
    const rango = { min: lpAbreviadaBienesMin, max: lpAbreviadaBienesMax };
    const todos = items.map((it) => ({ nro: it.nro, cuantia: importeItem(it) }));
    if (!rangoLpAbreviadaConfigurado(rango)) return todos;
    return todos.filter((it) => enRangoLpAbreviadaBienes(it.cuantia, rango) === true);
  }, [items, lpAbreviadaBienesMin, lpAbreviadaBienesMax]);

  function renderFichaField(field: FichaField) {
    // El cuadro del personal clave solo se le pasa al campo de requisitos —que
    // es quien lo pinta—. Al resto de campos se les da cadena vacía (estable),
    // para que un cambio en el personal clave no repinte toda la ficha: la
    // memoización de `CampoFicha` depende de props estables.
    const esRequisitos = field.kind === "requisitos";
    // Igual que el personal clave con los requisitos: la matriz de riesgos solo
    // se le pasa al cuadro de «otras penalidades» —que la usa para el traslado—;
    // al resto, cadena vacía, para no repintar la ficha en cada tecla.
    const esPenalidades = field.kind === "penalidades";
    // El campo se pinta en su propio componente memoizado. Lo que se le
    // pasa son VALORES de este campo, no las estructuras completas: el
    // formulario y los mapas de avisos cambian de identidad en cada
    // pulsacion y anularian la memo, que es justo lo que se buscaba.
    const geoKey = CAMPO_GEO_ENTIDAD[field.api];
    return (
      <CampoFicha
        areasSugeridas={areasSugeridas}
        editable={fichaEdit}
        eettDocs={eettDocs}
        eettUploading={eettUploading}
        error={fieldErrors[field.api]}
        exigido={exigidosModelo.has(field.api)}
        fechaIA={camposDeIA.get(field.api) ?? null}
        field={field}
        geoValorEntidad={geoKey ? (configuredEntity?.[geoKey] ?? "").trim() : ""}
        key={field.api}
        modoSimple={modoSimple}
        montoEstimado={Number(fichaForm.montoEstimado) || null}
        moneda={fichaForm.moneda ?? ""}
        necesidadId={necesidadId}
        personalClaveExperiencia={esRequisitos ? (fichaForm.personalClaveExperiencia ?? "") : ""}
        personalClaveAcreditacion={esRequisitos ? (fichaForm.personalClaveAcreditacion ?? "") : ""}
        formacionAcademica={esRequisitos ? (fichaForm.formacionAcademica ?? "") : ""}
        formacionAcademicaAcreditacion={esRequisitos ? (fichaForm.formacionAcademicaAcreditacion ?? "") : ""}
        capacitacionPersonalClave={esRequisitos ? (fichaForm.capacitacionPersonalClave ?? "") : ""}
        capacitacionPersonalClaveAcreditacion={esRequisitos ? (fichaForm.capacitacionPersonalClaveAcreditacion ?? "") : ""}
        equipamientoEstrategico={esRequisitos ? (fichaForm.equipamientoEstrategico ?? "") : ""}
        equipamientoEstrategicoAcreditacion={esRequisitos ? (fichaForm.equipamientoEstrategicoAcreditacion ?? "") : ""}
        infraestructuraEstrategica={esRequisitos ? (fichaForm.infraestructuraEstrategica ?? "") : ""}
        infraestructuraEstrategicaAcreditacion={esRequisitos ? (fichaForm.infraestructuraEstrategicaAcreditacion ?? "") : ""}
        gestionRiesgos={esPenalidades ? (fichaForm.gestionRiesgos ?? "") : ""}
        itemsExperiencia={esRequisitos ? itemsExperiencia : SIN_ITEMS}
        umbralLpConfigurado={umbralLpConfigurado}
        onCampoFicha={cambiarCampo}
        obligatorio={campoEsObligatorio(field)}
        obsPendiente={obsPendientesPorCampo.get(field.api) ?? null}
        onAbrirEett={abrirEettEstable}
        onCambio={cambiarCampo}
        onError={marcarError}
        onRedactarIA={redactarConIA}
        onSubirEett={subirEettEstable}
        onTocar={marcarTocado}
        puedeGestionar={permisos.manage}
        requisitosModelo={requisitosModelo}
        tipoObjeto={ejeObjeto}
        tipoProceso={ejeProceso || null}
        tocado={camposTocados.has(field.api)}
        topeCalculado={field.api === "conformidadPlazoSubsanacion" ? topeSubsanacionDias : null}
        topeMotivo={field.api === "conformidadPlazoSubsanacion" ? motivoSubsanacion : ""}
        valor={fichaForm[field.api] ?? ""}
      />
    );
  }

  function renderDatosPrincipales() {
    return (
      <div className="flex scroll-mt-16 flex-col gap-2.5" id={DATOS_PRINCIPALES_ID}>
        <h4 className="text-sm font-bold text-ink">Datos principales</h4>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
          <div className="col-span-full min-w-0">
            <label className="flex flex-col">
              <span className={FICHA_LABEL}>
                Nombre de la contratación <span className={FICHA_REQ}>obligatorio</span>
              </span>
              <input
                aria-required
                // Inválido solo cuando hay texto pero es demasiado corto (1-2): es
                // lo que bloquea guardar y lo que avisa DenominacionAsistente; el
                // vacío inicial no se marca inválido antes de que escriban.
                aria-invalid={
                  (fichaForm.nombre ?? "").trim().length > 0 && (fichaForm.nombre ?? "").trim().length < 3
                    ? true
                    : undefined
                }
                className={cn(FICHA_CTRL, FICHA_CTRL_H)}
                onChange={(e) => setFichaField("nombre", e.target.value)}
                value={fichaForm.nombre ?? ""}
              />
            </label>
            <DenominacionAsistente form={fichaForm} />
          </div>
          <label className="flex min-w-0 flex-col">
            <span className={FICHA_LABEL}>Tipo de objeto</span>
            <select className={cn(FICHA_CTRL, FICHA_CTRL_H)} onChange={(e) => setFichaField("tipoObjeto", e.target.value)} value={fichaForm.tipoObjeto ?? ""}>
              {OBJETOS_NECESIDAD.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col" data-campo="tipoProcesoSeleccion">
            <span className={FICHA_LABEL}>
              Tipo de proceso de selección <em className="font-normal not-italic text-muted">· referencia inicial</em>
            </span>
            <select
              className={cn(FICHA_CTRL, FICHA_CTRL_H)}
              onChange={(e) => setFichaField("tipoProcesoSeleccion", e.target.value)}
              value={fichaForm.tipoProcesoSeleccion ?? ""}
            >
              {/* "— Por definir —" siempre primero */}
              <option value="">{PROCESO_SELECCION_OPCIONES[0].label}</option>
              {opcionesProcesoAgrupadas.realiza.length > 0 ? (
                <>
                  <optgroup label="Procesos que realiza tu entidad">
                    {opcionesProcesoAgrupadas.realiza.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </optgroup>
                  {/* Si la entidad realiza TODO el catálogo, "Otros" queda vacío:
                      no pintamos una cabecera de grupo sin opciones debajo. */}
                  {opcionesProcesoAgrupadas.otros.length > 0 ? (
                    <optgroup label="Otros procedimientos">
                      {opcionesProcesoAgrupadas.otros.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </optgroup>
                  ) : null}
                </>
              ) : (
                // Sin procesos configurados (o ninguno empareja): lista
                // plana, en el orden original del catálogo.
                opcionesProcesoAgrupadas.otros.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))
              )}
            </select>
          </label>
          <label className="flex min-w-0 flex-col">
            <span className={FICHA_LABEL}>Tipo de área solicitante</span>
            <select className={cn(FICHA_CTRL, FICHA_CTRL_H)} onChange={(e) => setFichaField("tipoArea", e.target.value)} value={fichaForm.tipoArea ?? ""}>
              {TIPO_AREA_OPCIONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    );
  }

  // Guía del requerimiento (advertencias rojas / notas azules del PDF)
  // del tipo de proceso elegido, para la sección dada. Se agrupa por la
  // sección canónica 3.x (ej. "3.5.1" → guía de "3.5").
  const guiaTipo = fichaForm.tipoProcesoSeleccion
    ? (REQUERIMIENTO_GUIA[fichaForm.tipoProcesoSeleccion] ?? [])
    : [];
  function dedupGuia(items: typeof guiaTipo) {
    const vistos = new Set<string>();
    return items.filter((g) => {
      const k = `${g.tipo}|${g.etiqueta ?? ""}|${g.texto}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }
  function guiaDeSeccion(title: string) {
    const m = title.match(/^(\d+\.\d+)/);
    const key = m ? m[1] : "";
    return key ? dedupGuia(guiaTipo.filter((g) => g.seccion === key)) : [];
  }
  function renderGuiaItems(items: typeof guiaTipo) {
    return (
      <div className="flex flex-col gap-2">
        {items.map((g, i) => (
          <div
            className={cn(
              "rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-relaxed",
              g.tipo === "advertencia" ? "border-danger/25 bg-danger-soft text-ink" : "border-brand/20 bg-brand-soft text-ink",
            )}
            key={i}
          >
            <strong className={cn("block font-semibold", g.tipo === "advertencia" ? "text-danger" : "text-brand")}>
              {g.tipo === "advertencia" ? "⚠ Advertencia" : "ℹ Importante para la entidad"}
              {g.etiqueta ? ` · ${g.etiqueta}` : ""}
            </strong>
            <span>{g.texto}</span>
          </div>
        ))}
      </div>
    );
  }
  function renderGuiaGeneral() {
    const items = dedupGuia(guiaTipo.filter((g) => g.seccion === "general"));
    if (items.length === 0) return null;
    return (
      <details className="group rounded-[10px] border border-line bg-surface p-3">
        <summary className="cursor-pointer list-none text-[13px] font-semibold text-muted marker:content-none hover:text-brand">
          ▸ Advertencias y notas generales del tipo de proceso ({items.length})
        </summary>
        <div className="mt-2.5">{renderGuiaItems(items)}</div>
      </details>
    );
  }

  function renderSeccion(section: FichaSection) {
    const { visibles, ocultosOpcionales } = camposVisibles(section);
    if (visibles.length === 0 && ocultosOpcionales === 0) return null;
    const guia = guiaDeSeccion(section.title);
    const comp = completitudSeccion(section);
    const badge = badgeTexto(comp);
    return (
      <div
        className={cn(
          // scroll-mt: al saltar desde el índice, el título quedaba
          // debajo de la barra fija y parecía que no había pasado nada.
          // Medida en el navegador, la barra ocupa 57px; 64 deja holgura.
          "flex scroll-mt-16 flex-col gap-2.5 border-t border-line pt-4 first:border-t-0 first:pt-0",
          section.preliminar && "rounded-[12px] border border-dashed border-brand/30 bg-brand-soft/40 p-4",
        )}
        id={seccionId(section.title)}
        key={section.title}
      >
        <h4 className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
          {section.title}
          {section.preliminar ? (
            <span className="rounded-full bg-brand/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand">preliminar</span>
          ) : null}
          <SeccionBadge estado={comp.estado} texto={badge} />
        </h4>
        {section.resumenLlano ? (
          <p className="text-[13px] leading-relaxed text-ink">{section.resumenLlano}</p>
        ) : null}
        {!modoSimple && section.nota ? <p className="text-[12.5px] leading-relaxed text-muted">{section.nota}</p> : null}
        {!modoSimple && guia.length > 0 ? renderGuiaItems(guia) : null}
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
          {(() => {
            // Subtítulo del subgrupo (literal legal) una vez por grupo,
            // antes de su primer campo VISIBLE.
            let prevSub: string | undefined;
            const out: React.ReactNode[] = [];
            for (const f of visibles) {
              if (f.subgrupo && f.subgrupo !== prevSub) {
                out.push(
                  <div className="col-span-full mt-1.5 text-[12px] font-bold uppercase tracking-wide text-muted" key={`sub-${f.subgrupo}`}>
                    {f.subgrupo}
                  </div>,
                );
              }
              prevSub = f.subgrupo;
              out.push(renderFichaField(f));
            }
            return out;
          })()}
        </div>
        {/* El cuadro de ítems no es un campo de `necesidades`: vive en
            su propia tabla, así que se inyecta en su sección en vez de
            declararse en FICHA_SECCIONES. */}
        {section.title.startsWith("3.2") ? (
          <NecesidadItemsEditor
            items={items}
            montoDeclarado={Number(fichaForm.montoEstimado) || null}
            objetoNecesidad={fichaForm.tipoObjeto || null}
            onChange={setItems}
            readOnly={!fichaEdit}
            tipoProceso={fichaForm.tipoProcesoSeleccion || null}
            uitValor={uitValor}
          />
        ) : null}
        {/* El documento del TDR/EETT no es un campo de `necesidades`: es un PDF que
            se sube, se indexa en RAG y se revisa en su propia ventana. Desde 3.4
            se abre esa gestión, que es donde vive «el cómo debe ser» detallado. */}
        {section.title.startsWith("3.4") && permisos.manage ? (
          <button
            type="button"
            onClick={eett.gestionar}
            className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-brand/30 bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand transition hover:border-brand/50 hover:bg-brand-soft"
          >
            <FileText size={15} /> Revisar TDR
            <span className="font-normal text-brand/80">— subir y gestionar el PDF (se indexa en el buscador con IA)</span>
          </button>
        ) : null}
        {ocultosOpcionales > 0 ? (
          <button
            className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-[13px] font-semibold text-brand hover:underline"
            onClick={() => setOptionalExpanded((prev) => new Set(prev).add(section.title))}
            type="button"
          >
            <Plus size={13} /> Mostrar {ocultosOpcionales} campo{ocultosOpcionales > 1 ? "s" : ""} opcional{ocultosOpcionales > 1 ? "es" : ""}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sin esto, el área usuaria ve menos campos que ayer y no sabe
          por qué: parece que la ficha perdió contenido. */}
      {exigidosModelo.size > 0 && obligatoriosOnly ? (
        <Alert tone="info" icon={false}>
          <div className="flex items-start gap-2.5">
            <FileText size={15} className="mt-0.5 shrink-0" />
            <div>
              <strong>
                Se muestran los {exigidosModelo.size} campos que exige el modelo de{" "}
                {necesidad.tipo_proceso_seleccion}.
              </strong>{" "}
              Salen del PDF-modelo de requerimiento cargado en Configuración → Unidad de abastecimiento,
              ajustados al objeto <strong>{objetoNecesidadLabel(necesidad.tipo_objeto)}</strong>. Los demás siguen
              ahí: usa <strong>«Ver todos»</strong> para abrirlos.
            </div>
          </div>
        </Alert>
      ) : null}

      {/* Origen del contenido. Tras el traslado, la ficha se ve igual
          la escriba quien la escriba: este aviso dice de un vistazo
          cuántos campos propuso el modelo y cuáles. */}
      {camposDeIA.size > 0 ? (
        <Alert tone="info" icon={false}>
          <div className="flex items-start gap-2.5">
            <WandSparkles size={15} className="mt-0.5 shrink-0" />
            <div>
              <strong>
                {camposDeIA.size} campo{camposDeIA.size === 1 ? "" : "s"} de esta ficha{" "}
                {camposDeIA.size === 1 ? "proviene" : "provienen"} de la propuesta IA del EETT/TDR.
              </strong>{" "}
              Llevan la marca <span className={FICHA_IA}>✦ propuesto por IA</span> junto a su nombre.
              Revísalos antes de remitir: los redactó un modelo a partir del documento, no una persona.
              <ul className="mt-1.5 list-inside list-disc">
                {FICHA_SECCIONES.flatMap((s) => s.fields)
                  .filter((f) => camposDeIA.has(f.api))
                  .map((f) => (
                    <li key={f.api}>{f.label}</li>
                  ))}
              </ul>
            </div>
          </div>
        </Alert>
      ) : null}

      {/* El formulario restaura el borrador de localStorage al abrirse.
          Sin este aviso, el trabajo sin guardar reaparece intacto y
          parece registrado. */}
      {camposBorrador.length > 0 ? (
        <Alert tone="warning" icon={false}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <strong>Hay cambios sin guardar en este navegador.</strong>
              <p className="mt-0.5">
                Estos campos NO están en la base de datos todavía:{" "}
                {camposBorrador.map((k) => CAMPO_LABEL[k] ?? k).join(" · ")}. Pulsa{" "}
                <em>Guardar ficha</em> para registrarlos.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => descartarBorrador()}>
              Descartar y volver a lo guardado
            </Button>
          </div>
        </Alert>
      ) : null}

      {panelObligatorios}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-[10px] border border-line bg-surface p-0.5" role="group" aria-label="Campos a mostrar">
          <button
            aria-pressed={obligatoriosOnly}
            className={cn("rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition", obligatoriosOnly ? "bg-brand text-white shadow-card" : "text-muted hover:text-brand")}
            onClick={() => setObligatoriosOnly(true)}
            type="button"
          >
            Solo obligatorios
          </button>
          <button
            aria-pressed={!obligatoriosOnly}
            className={cn("rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition", !obligatoriosOnly ? "bg-brand text-white shadow-card" : "text-muted hover:text-brand")}
            onClick={() => setObligatoriosOnly(false)}
            type="button"
          >
            Todos los campos
          </button>
        </div>

        <BarraObligatorios done={obligDone} total={obligTotal} barClassName="w-28 flex-none" />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setWizardMode((w) => !w); setWizardStep(0); }}>
            {wizardMode ? "Formulario completo" : "Paso a paso"}
          </Button>
          {/* Interruptor de modo. Mismo patron de grupo de dos botones que
              «Solo obligatorios / Todos los campos», que ya se entiende. */}
          <div className="inline-flex rounded-[10px] border border-line bg-surface p-0.5" role="group" aria-label="Modo de trabajo">
            {([["redactar", "Redactar"], ["revisar", "Revisar"]] as const).map(([valor, etiqueta]) => (
              <button
                aria-pressed={modo === valor}
                className={cn(
                  "rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                  modo === valor ? "bg-brand text-white shadow-card" : "text-muted hover:text-brand",
                )}
                key={valor}
                onClick={() => cambiarModo(valor)}
                type="button"
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <Button
            variant={modoSimple ? "subtle" : "secondary"}
            size="sm"
            onClick={toggleModoSimple}
            title={modoSimple
              ? "Volver a mostrar las referencias legales (artículos, notas)"
              : "Ocultar artículos y notas legales: deja solo el texto en lenguaje sencillo"}
          >
            {modoSimple ? "Mostrar detalle legal" : "Modo simple"}
          </Button>
          <Button variant={copilotoAbierto ? "primary" : "secondary"} size="sm" onClick={() => { setCopilotoAbierto((v) => !v); setCopilotoMontado(true); }}>
            <Sparkles size={13} /> Copiloto IA
          </Button>
        </div>
      </div>

      {/* Indicador de pasos en modo wizard */}
      {wizardMode ? (
        <div className="flex flex-wrap gap-1.5">
          {[
            { title: "Datos principales" },
            ...seccionesVisibles.map((s) => ({ title: s.title })),
          ].map((step, i) => {
            const activo = i === pasoActual;
            const hecho = i < pasoActual;
            return (
              <button
                key={i}
                type="button"
                aria-current={activo ? "step" : undefined}
                onClick={() => setWizardStep(i)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
                  activo
                    ? "border-brand bg-brand text-white"
                    : hecho
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-line bg-panel text-muted hover:border-brand/30",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded-full text-[10px] font-bold",
                    activo ? "bg-white/25" : hecho ? "bg-success/15" : "bg-ink/[0.06]",
                  )}
                >
                  {hecho ? <Check size={10} /> : i + 1}
                </span>
                {step.title}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Solo el paso actual en modo wizard; todo en modo completo */}
      {wizardMode ? (
        pasoActual === 0 ? (
          <>
            {renderDatosPrincipales()}
            {renderGuiaGeneral()}
          </>
        ) : renderSeccion(seccionesVisibles[pasoActual - 1])
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          {/* Índice de secciones, horizontal y fijo bajo la cabecera de la
              aplicación (56px = top-14). Es NAVEGACIÓN, no pestañas de verdad:
              al pulsar se salta a la sección y TODAS siguen montadas debajo,
              así que lleva aria-current="location" y no role="tab" —anunciarlo
              como pestañas prometería un panel que se sustituye, y no ocurre.
              Antes era una columna lateral con `hidden lg:flex`: en tablet y
              móvil, justo donde más falta hace saber por dónde vas, no había
              índice ninguno.

              `top-0` y no `top-14`: la aplicación NO tiene cabecera fija (no
              hay `sticky` ni `fixed` en app-shell), así que los 56px que
              reservaba la versión lateral solo dejaban pasar contenido por
              encima. Los márgenes negativos igualan el relleno de la tarjeta
              (`p-3.5`) para que la barra tape de borde a borde. */}
          <nav
            aria-label="Secciones del requerimiento"
            className="sticky top-0 z-20 -mx-3.5 border-b border-line bg-panel/95 px-3.5 py-2 backdrop-blur-sm"
          >
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <SectionNavItem
                actual={seccionEnVista === DATOS_PRINCIPALES_ID}
                estado="parcial"
                label="Datos principales"
                onClick={() => scrollASeccion(DATOS_PRINCIPALES_ID)}
              />
              {navSecciones.map((n) => (
                <SectionNavItem
                  key={n.id}
                  actual={seccionEnVista === n.id}
                  estado={n.comp.estado}
                  label={n.title}
                  count={
                    badgeTexto(n.comp)
                      ? n.comp.oblig > 0
                        ? `${n.comp.obligDone}/${n.comp.oblig}`
                        : `${n.comp.llenos}/${n.comp.total}`
                      : undefined
                  }
                  onClick={() => scrollASeccion(n.id)}
                />
              ))}
            </div>
          </nav>
          {renderDatosPrincipales()}
          {renderGuiaGeneral()}
          {seccionesVisibles.map(renderSeccion)}
        </div>
      )}

      {/* Aviso de conflicto de versión: común a ambos modos. Antes vivía dentro
          del bloque !wizardMode, así que en «paso a paso» un 409 (autoguardado o
          traslado) era invisible y el usuario no tenía el botón «Recargar». */}
      {conflictoGuardado ? (
        <Alert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Otro usuario guardó cambios en esta necesidad. Recarga para ver su versión antes de
              volver a guardar (tu borrador se conserva).
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { superarConflicto(); setError(""); void reload(); }}
            >
              Recargar
            </Button>
          </div>
        </Alert>
      ) : null}

      {/* Navegación del wizard */}
      {wizardMode ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button variant="secondary" size="sm" disabled={pasoActual === 0} onClick={() => setWizardStep((s) => Math.max(0, s - 1))}>
            ← Anterior
          </Button>
          <Button variant="ghost" size="sm" disabled={savingFicha} onClick={() => setFichaEdit(false)}>
            Cancelar
          </Button>
          <span className="text-[12px] text-muted">Paso {pasoActual + 1} de {totalPasos}</span>
          {autoguardado ? (
            <span
              className={cn(
                "text-[12px] font-medium",
                autoguardado === "error" ? "text-danger" : autoguardado === "guardado" ? "text-success" : "text-muted",
              )}
            >
              {autoguardado === "guardando"
                ? "Guardando…"
                : autoguardado === "guardado"
                  ? "Cambios guardados"
                  : "No se pudo autoguardar — pulsa Guardar ficha"}
            </span>
          ) : null}
          {pasoActual < totalPasos - 1 ? (
            <Button variant="primary" size="sm" className="ml-auto" onClick={() => setWizardStep((s) => Math.min(totalPasos - 1, s + 1))}>
              Siguiente →
            </Button>
          ) : (
            <Button variant="primary" size="sm" className="ml-auto" disabled={conflictoGuardado} loading={savingFicha} onClick={saveFicha}>
              {!savingFicha ? <CheckCircle2 size={15} /> : null}
              Guardar ficha
            </Button>
          )}
        </div>
      ) : null}

      {/* Botones de acción en modo completo */}
      {!wizardMode ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button variant="primary" disabled={conflictoGuardado} loading={savingFicha} onClick={saveFicha}>
              {!savingFicha ? <CheckCircle2 size={15} /> : null}
              Guardar ficha
            </Button>
            <Button variant="ghost" disabled={savingFicha} onClick={() => setFichaEdit(false)}>
              Cancelar
            </Button>
            {autoguardado ? (
              <span
                className={cn(
                  "text-[12px] font-medium",
                  autoguardado === "error" ? "text-danger" : autoguardado === "guardado" ? "text-success" : "text-muted",
                )}
              >
                {autoguardado === "guardando"
                  ? "Guardando…"
                  : autoguardado === "guardado"
                    ? "Cambios guardados"
                    : "No se pudo autoguardar — pulsa Guardar ficha"}
              </span>
            ) : null}
          </div>
        </>
      ) : null}

      {copilotoMontado ? (
        <NecesidadCopiloto
          abierto={copilotoAbierto}
          campos={camposCopiloto}
          faltantes={faltantesCopiloto}
          necesidadId={necesidadId}
          // La solución de controversias se FUSIONA en vez de sustituirse: su valor
          // lleva el cuadro de instituciones designadas, y volcar encima el texto de
          // la IA las borraría. Se conservan y lo redactado pasa a ser el bloque de
          // condiciones adicionales. Del texto de la IA se toma SOLO su parte libre
          // (`textoLibreControversias`): la IA suele reproducir el párrafo fijo y la
          // tabla de instituciones que ya venían en el campo, y sumarlos tal cual
          // duplicaba las instituciones (las del campo + las repetidas por la IA).
          onAplicarCampo={(api, valor) => {
            setFichaField(
              api,
              api === "solucionControversias"
                ? componerControversias(
                    parseInstituciones(fichaForm.solucionControversias ?? ""),
                    textoLibreControversias(valor),
                  )
                : // Gestión de riesgos: se guarda SOLO la matriz (desde su
                  // encabezado), sin el párrafo de sustento que la IA redacta
                  // antes, para que el campo coincida con la vista previa.
                  api === "gestionRiesgos"
                  ? desdeMatrizRiesgos(valor)
                  : valor,
            );
            // Desplaza la vista al campo donde se insertó el texto: sin esto,
            // el usuario no ve el resultado porque la sección puede estar fuera
            // del viewport.
            setTimeout(() => {
              const el = document.querySelector(`[data-campo="${api}"]`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-brand", "ring-offset-2");
                setTimeout(() => el.classList.remove("ring-2", "ring-brand", "ring-offset-2"), 2000);
              }
            }, 100);
          }}
          onCerrar={() => setCopilotoAbierto(false)}
          redactarSolicitud={copilotoRedactar}
          tipoObjeto={tipoObj ? objetoNecesidadLabel(tipoObj) : ""}
          tipoProcesoSeleccion={fichaForm.tipoProcesoSeleccion ?? ""}
        />
      ) : null}
    </div>
  );
}

// Campos geográficos que se resuelven contra la ubicación configurada de la
// entidad (Configuración → Municipalidad), en vez de escribirse a mano. Es la
// raíz del problema de grafías divergentes (APURIMAC/Apurímac/Apurimac): la
// entidad tiene UNA ubicación, así que el campo es un desplegable, no texto.
const CAMPO_GEO_ENTIDAD: Record<string, "department" | "province" | "city"> = {
  departamento: "department",
  provincia: "province",
  distrito: "city",
};

/** Color del punto de estado de una sección (índice de navegación de la ficha). */
const NAV_DOT: Record<string, string> = {
  completo: "bg-success",
  pendiente: "bg-warning",
  parcial: "bg-muted/60",
  vacio: "bg-line",
};

function DenominacionAsistente({ form }: { form: Record<string, string> }) {
  const marcas = useMemo(() => detectarMarca(form.nombre ?? ""), [form.nombre]);
  const largo = (form.nombre ?? "").trim().length;

  // Solo avisos: si el nombre no menciona marca (Art. 44.6) ni pasa del máximo,
  // no hay nada que mostrar. (Va tras los hooks: no altera su orden.)
  if (marcas.length === 0 && largo <= NOMBRE_MAX) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {marcas.length > 0 ? (
        <Alert tone="warning">
          El nombre menciona <strong>{marcas.map((m) => m.termino).join(", ")}</strong>. El Art. 44.6 prohíbe
          referir marca, fabricante u origen, o describir orientando hacia ellos, salvo compatibilización
          aprobada por la AGA. Descríbelo por desempeño y funcionalidad.
        </Alert>
      ) : null}

      {largo > NOMBRE_MAX ? (
        <Alert tone="danger">
          El nombre tiene <strong>{largo}</strong> caracteres y el máximo es {NOMBRE_MAX}. No se podrá guardar.
          Suele pasar cuando la descripción de catálogo o la población beneficiaria arrastran texto de más:
          acórtalas y recompón el nombre.
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * Pestaña del índice de secciones de la ficha.
 *
 * La tira es horizontal y desplazable, así que la sección en pantalla puede
 * quedar fuera de la vista: cuando esta pestaña pasa a ser la actual se
 * autocentra. Se mueve SOLO el scroll horizontal del contenedor —calculado a
 * mano en vez de `scrollIntoView`, que además arrastraría la página entera
 * mientras el usuario está leyendo.
 */
function SectionNavItem({
  actual,
  estado,
  label,
  count,
  onClick,
}: {
  actual: boolean;
  estado: string;
  label: string;
  count?: string;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!actual) return;
    const el = ref.current;
    const tira = el?.parentElement;
    if (!el || !tira) return;
    const destino = el.offsetLeft - tira.offsetLeft - (tira.clientWidth - el.clientWidth) / 2;
    tira.scrollTo({ behavior: "smooth", left: Math.max(0, destino) });
  }, [actual]);
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-current={actual ? "location" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] transition",
        actual
          ? "border-brand bg-brand font-semibold text-white"
          : "border-line bg-surface text-muted hover:border-brand/40 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          actual ? "bg-white/70" : (NAV_DOT[estado] ?? "bg-line"),
        )}
      />
      {label}
      {count ? (
        <span className={cn("text-[11px] font-semibold tabular-nums", actual ? "text-white/75" : "text-muted")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
