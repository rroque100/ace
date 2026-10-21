"use client";

import dynamic from "next/dynamic";
import { AlertCircle, Building2, CalendarDays, CheckCircle2, FileSpreadsheet, Gavel, Hash, Landmark, Scale, UserCog, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminSettings } from "./admin-settings";
import { ConfirmDialog } from "./confirm-dialog";
import { useOficinas } from "./oficinas/use-oficinas";

// El padrón de personal (carga del .xls + búsqueda) solo se monta al entrar en su
// pestaña: no lo necesita el resto de la configuración.
const PersonalSettings = dynamic(
  () => import("./configuracion/personal-settings").then((m) => m.PersonalSettings),
  {
    loading: () => (
      <div className="grid gap-3" aria-busy="true">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-line/70" />
        <div className="h-52 animate-pulse rounded-[10px] bg-line/70" />
      </div>
    ),
    ssr: false,
  },
);

// Oficinas arrastra 2 662 lineas de subcomponentes —areas, numeracion,
// membrete, modelos y sus dos modales— para una seccion que hay que elegir.
const OficinasSettings = dynamic(() => import("./oficinas-settings").then((m) => m.OficinasSettings), {
  loading: () => (
    <div className="grid gap-3" aria-busy="true">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-line/70" />
      <div className="h-52 animate-pulse rounded-[10px] bg-line/70" />
    </div>
  ),
  ssr: false,
});

// El catálogo de instituciones arbitrales solo se monta al entrar en su pestaña.
const InstitucionesArbitralesTab = dynamic(
  () =>
    import("./configuracion/instituciones-arbitrales-tab").then((m) => m.InstitucionesArbitralesTab),
  {
    loading: () => (
      <div className="grid gap-3" aria-busy="true">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-line/70" />
        <div className="h-52 animate-pulse rounded-[10px] bg-line/70" />
      </div>
    ),
    ssr: false,
  },
);

type SectionKey =
  | "municipalidad"
  | "procesos"
  | "areas"
  | "numeracion"
  | "membrete"
  | "usuarios"
  | "personal"
  | "arbitraje"
  | "feriados";

type Owner = "admin" | "ofic" | "personal" | "arbitraje";

type NavItem = {
  key: SectionKey;
  icon: React.ReactNode;
  label: string;
  desc: string;
  owner: Owner;
};

// Una sola navegación para TODA la configuración, agrupada por dominio. Antes
// vivían en dos componentes apilados (AdminSettings + OficinasSettings), cada uno
// con su propio hero y su propia barra de pestañas: cuatro encabezados y dos
// menús para seis secciones. Aquí la navegación es única y aquellos componentes
// se han quedado solo con el contenido de cada sección.
const NAV: { grupo: string; items: NavItem[] }[] = [
  {
    grupo: "Entidad",
    items: [
      {
        key: "municipalidad",
        icon: <Landmark size={18} />,
        label: "Municipalidad",
        desc: "Datos de la entidad y gerente",
        owner: "admin",
      },
      {
        key: "procesos",
        icon: <Gavel size={18} />,
        label: "Procesos de selección",
        desc: "AGA, PAC, topes y cronograma",
        owner: "admin",
      },
    ],
  },
  {
    grupo: "Oficinas y documentos",
    items: [
      {
        key: "areas",
        icon: <Building2 size={18} />,
        label: "Áreas",
        desc: "Oficinas emisoras",
        owner: "ofic",
      },
      {
        key: "numeracion",
        icon: <Hash size={18} />,
        label: "Numeración",
        desc: "Correlativos por documento",
        owner: "ofic",
      },
      {
        key: "membrete",
        icon: <FileSpreadsheet size={18} />,
        label: "Membrete",
        desc: "Hoja membretada de PDF",
        owner: "ofic",
      },
    ],
  },
  {
    grupo: "Acceso",
    items: [
      {
        key: "usuarios",
        icon: <UserCog size={18} />,
        label: "Usuarios",
        desc: "Cuentas, roles y permisos",
        owner: "admin",
      },
      {
        key: "personal",
        icon: <Users size={18} />,
        label: "Personal",
        desc: "Padrón para elegir personas",
        owner: "personal",
      },
    ],
  },
  {
    grupo: "Sistema",
    items: [
      {
        key: "arbitraje",
        icon: <Scale size={18} />,
        label: "Institución arbitral",
        desc: "Catálogo para el convenio arbitral",
        owner: "arbitraje",
      },
      {
        key: "feriados",
        icon: <CalendarDays size={18} />,
        label: "Feriados",
        desc: "Días no laborables (plazos)",
        owner: "admin",
      },
    ],
  },
];

/**
 * Cabecera de cada sección: qué es y para qué sirve, en una frase.
 *
 * Vive aquí y no en cada pestaña porque el workspace ya sabe cuál está activa:
 * así las seis empiezan igual —antes unas abrían con un párrafo suelto y otras
 * directamente con la lista— y añadir una sección no obliga a recordar el patrón.
 */
const SECCION_INFO: Record<SectionKey, { titulo: string; sub: string }> = {
  municipalidad: {
    titulo: "Datos de la entidad",
    sub: "Identificación, tipo de gobierno y gerente. Es lo que se imprime en la cabecera de los documentos que la entidad firma.",
  },
  procesos: {
    titulo: "Procesos de selección",
    sub: "Los parámetros que deciden el procedimiento: la autoridad que aprueba (AGA), las resoluciones del PIA y PAC, la línea de corte, los topes por cuantía y los días del cronograma.",
  },
  areas: {
    titulo: "Áreas y oficinas",
    sub: "Las oficinas que emiten documentos. Registra primero el área; después podrás darle numeración y hoja membretada.",
  },
  numeracion: {
    titulo: "Numeración de documentos",
    sub: "Qué tipos de documento emite cada oficina y desde qué correlativo empieza cada uno.",
  },
  membrete: {
    titulo: "Hoja membretada",
    sub: "El PDF de fondo sobre el que se redactan las respuestas oficiales. Sin membrete, el PDF exportado sale sin membrete.",
  },
  usuarios: {
    titulo: "Usuarios y accesos",
    sub: "Cuentas del sistema. El rol define los permisos; la oficina y la jefatura, qué expedientes ve cada persona.",
  },
  personal: {
    titulo: "Padrón de personal",
    sub: "Servidores de la entidad cargados desde el .xls del SIGA. Alimenta el selector de personas de Necesidades y Expedientes: elegir en vez de teclear nombre, DNI y cargo.",
  },
  arbitraje: {
    titulo: "Instituciones arbitrales",
    sub: "Catálogo de instituciones con inscripción vigente en el REGAJU (Art. 332.1) que la entidad admite en el convenio arbitral. Se eligen al fijar la solución de controversias del requerimiento.",
  },
  feriados: {
    titulo: "Feriados y días no laborables",
    sub: "Se descuentan —junto a sábados y domingos— al calcular las fechas del cronograma de la estrategia.",
  },
};

const OWNER: Record<SectionKey, Owner> = {
  municipalidad: "admin",
  procesos: "admin",
  usuarios: "admin",
  feriados: "admin",
  areas: "ofic",
  numeracion: "ofic",
  membrete: "ofic",
  personal: "personal",
  arbitraje: "arbitraje",
};

type Summary = {
  entityComplete: boolean;
  usersCount: number;
  oficinasCount: number;
  oficinasConMembrete: number;
  oficinasConNumeracion: number;
  feriadosCount: number | null;
  personalCount: number | null;
  arbitrajeCount: number | null;
};

const SUMMARY_INICIAL: Summary = {
  entityComplete: false,
  usersCount: 0,
  oficinasCount: 0,
  oficinasConMembrete: 0,
  oficinasConNumeracion: 0,
  feriadosCount: null,
  personalCount: null,
  arbitrajeCount: null,
};

// Indicador (badge) que se pinta a la derecha de cada ítem de la barra lateral.
// `tono`: ok = verde (listo), warn = ámbar (falta algo), mute = gris (informativo).
type Indicador = { texto: string; tono: "ok" | "warn" | "mute" } | null;

export function ConfiguracionWorkspace({ currentUserId }: { currentUserId: string }) {
  const [active, setActive] = useState<SectionKey>("municipalidad");
  const [summary, setSummary] = useState<Summary>(SUMMARY_INICIAL);
  /** Sección a la que se quiere ir dejando cambios sin guardar (pide confirmar). */
  const [saltoPendiente, setSaltoPendiente] = useState<SectionKey | null>(null);
  // Las oficinas se cargan UNA vez para toda la configuración: las consumen la
  // sección de Oficinas (Áreas/Numeración/Membrete), el desplegable de "Oficina
  // asignada" del alta de usuarios y los indicadores de la barra lateral.
  const oficinasState = useOficinas();

  const adminSection =
    OWNER[active] === "admin" ? (active as "municipalidad" | "procesos" | "usuarios" | "feriados") : null;
  const oficSection =
    OWNER[active] === "ofic" ? (active as "areas" | "numeracion" | "membrete") : null;
  const personalSection = OWNER[active] === "personal" ? "personal" : null;
  const enArbitraje = active === "arbitraje";

  // Callbacks estables: los hijos ya tienen los datos y los reportan aquí.
  const reportAdmin = useCallback(
    (s: { entityComplete: boolean; usersCount: number }) =>
      setSummary((prev) => ({ ...prev, entityComplete: s.entityComplete, usersCount: s.usersCount })),
    [],
  );
  // Los indicadores de oficinas se derivan del estado que ya vive aquí.
  const { oficinas, loading: oficinasCargando, sinGuardar } = oficinasState;

  // Áreas y Numeración editan sobre el estado compartido: salir de ellas con
  // cambios pendientes los descartaba en silencio (la siguiente recarga los
  // revertía). Se avisa antes de perderlos.
  const editandoOficinas = active === "areas" || active === "numeracion";
  const hayPendientes = sinGuardar && editandoOficinas;

  function irA(destino: SectionKey) {
    if (destino === active) return;
    if (hayPendientes) {
      setSaltoPendiente(destino);
      return;
    }
    setActive(destino);
  }

  // Aviso del navegador al cerrar/recargar la pestaña con cambios pendientes.
  useEffect(() => {
    if (!hayPendientes) return;
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [hayPendientes]);
  useEffect(() => {
    if (oficinasCargando) return;
    setSummary((prev) => ({
      ...prev,
      oficinasCount: oficinas.length,
      oficinasConMembrete: oficinas.filter((o) => o.membrete).length,
      oficinasConNumeracion: oficinas.filter((o) => o.counters.some((c) => c.enabled)).length,
    }));
  }, [oficinas, oficinasCargando]);

  // Feriados carga aparte (dentro de su pestaña); aquí se consulta solo el conteo
  // para el indicador. La dependencia es "¿estoy en feriados?" y no la sección
  // activa: así se consulta al entrar y al salir de esa pestaña —que es cuando el
  // número puede haber cambiado— en vez de en cada uno de los seis saltos de menú.
  const enFeriados = active === "feriados";
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/configuracion/feriados", { cache: "no-store" });
        const d = await r.json();
        if (vivo) setSummary((prev) => ({ ...prev, feriadosCount: (d.feriados ?? []).length }));
      } catch {
        /* sin indicador */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [enFeriados]);

  // El conteo del padrón para el indicador de la barra lateral, con el mismo
  // criterio que feriados: se consulta al entrar y salir de su pestaña, que es
  // cuando pudo cambiar (una carga nueva), y no en cada salto de menú.
  const enPersonal = active === "personal";
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/configuracion/personal?withTotal=1&limit=1", { cache: "no-store" });
        const d = await r.json();
        if (vivo) {
          setSummary((prev) => ({
            ...prev,
            personalCount: typeof d.total === "number" ? d.total : (d.personal?.length ?? 0),
          }));
        }
      } catch {
        /* sin indicador */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [enPersonal]);

  // Conteo del catálogo de instituciones arbitrales para el indicador, con el
  // mismo criterio: se consulta al entrar y salir de su pestaña.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/configuracion/instituciones-arbitrales", { cache: "no-store" });
        const d = await r.json();
        if (vivo)
          setSummary((prev) => ({ ...prev, arbitrajeCount: (d.instituciones ?? []).length }));
      } catch {
        /* sin indicador */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [enArbitraje]);

  // Resumen antes del detalle: configurar es una puesta a punto, y lo primero
  // que hace falta saber es cuánto queda. Se cuenta "lista" una sección cuando
  // tiene lo mínimo para que el resto de la aplicación funcione.
  const listas: Record<SectionKey, boolean> = {
    municipalidad: summary.entityComplete,
    // Parámetros OPCIONALES: la app trae valores por defecto (topes 2026, días del
    // cronograma), así que no cuenta como sección pendiente en la puesta a punto.
    procesos: true,
    areas: summary.oficinasCount > 0,
    numeracion: summary.oficinasConNumeracion > 0,
    membrete: summary.oficinasConMembrete > 0,
    usuarios: summary.usersCount > 0,
    personal: (summary.personalCount ?? 0) > 0,
    // Catálogo OPCIONAL: la entidad puede operar sin instituciones arbitrales
    // registradas, así que no cuenta como sección pendiente en la puesta a punto.
    arbitraje: true,
    feriados: (summary.feriadosCount ?? 0) > 0,
  };
  const totalSecciones = Object.keys(listas).length;
  const completas = Object.values(listas).filter(Boolean).length;
  const pct = Math.round((completas / totalSecciones) * 100);

  const indicadores: Record<SectionKey, Indicador> = {
    municipalidad: summary.entityComplete
      ? { texto: "Listo", tono: "ok" }
      : { texto: "Incompleto", tono: "warn" },
    // Sin indicador: son parámetros opcionales, no hay un "completo/incompleto" que medir.
    procesos: null,
    areas:
      summary.oficinasCount === 0
        ? { texto: "0", tono: "warn" }
        : { texto: String(summary.oficinasCount), tono: "mute" },
    numeracion:
      summary.oficinasCount === 0
        ? { texto: "Falta área", tono: "warn" }
        : { texto: `${summary.oficinasConNumeracion}/${summary.oficinasCount}`, tono: "mute" },
    membrete:
      summary.oficinasCount === 0
        ? { texto: "Falta área", tono: "warn" }
        : { texto: `${summary.oficinasConMembrete}/${summary.oficinasCount}`, tono: "mute" },
    usuarios: { texto: String(summary.usersCount), tono: summary.usersCount === 0 ? "warn" : "mute" },
    personal:
      summary.personalCount === null
        ? null
        : { texto: String(summary.personalCount), tono: summary.personalCount === 0 ? "warn" : "mute" },
    // Opcional: solo el conteo, sin ámbar cuando está vacío.
    arbitraje:
      summary.arbitrajeCount === null ? null : { texto: String(summary.arbitrajeCount), tono: "mute" },
    feriados:
      summary.feriadosCount === null
        ? null
        : { texto: String(summary.feriadosCount), tono: summary.feriadosCount === 0 ? "warn" : "mute" },
  };

  return (
    <div className="tw grid grid-cols-[264px_1fr] gap-6 items-start">
      <aside className="grid gap-[18px] sticky top-4" aria-label="Secciones de configuración">
        <div className="flex items-center gap-3 p-3.5 border border-line rounded-lg bg-panel shadow-card">
          <div
            aria-hidden
            className="relative flex-none w-[46px] h-[46px] rounded-full grid place-items-center"
            style={{ background: `conic-gradient(var(--brand) calc(${pct} * 1%), color-mix(in srgb, var(--line) 70%, transparent) 0)` }}
          >
            <div className="absolute inset-[5px] rounded-full bg-panel" />
            <span className="relative text-sm font-bold text-brand-dark tabular-nums">
              {completas}/{totalSecciones}
            </span>
          </div>
          <div className="grid gap-0.5 min-w-0">
            <span className="text-sm font-semibold text-ink">
              {completas === totalSecciones ? "Configuración completa" : "Puesta a punto"}
            </span>
            <span className="text-xs leading-[1.35] text-muted">
              {completas === totalSecciones
                ? "Todas las secciones tienen lo mínimo registrado."
                : `Faltan ${totalSecciones - completas} de ${totalSecciones} secciones por completar.`}
            </span>
          </div>
        </div>

        {NAV.map((grupo) => (
          <div className="grid gap-1" key={grupo.grupo}>
            <p className="text-[10.5px] font-bold text-muted tracking-wide uppercase px-1.5 mb-0.5 m-0">
              {grupo.grupo}
            </p>
            {grupo.items.map((it) => {
              const ind = indicadores[it.key];
              return (
                <button
                  aria-current={active === it.key ? "page" : undefined}
                  className="group flex items-center gap-[11px] w-full px-2.5 py-[9px] rounded-[8px] border border-transparent bg-transparent text-ink cursor-pointer text-left font-inherit transition-[background,border-color] duration-140 hover:bg-surface hover:border-line aria-[current=page]:bg-brand-soft aria-[current=page]:border-brand/35 aria-[current=page]:shadow-[inset_3px_0_0_var(--brand)]"
                  key={it.key}
                  onClick={() => irA(it.key)}
                  type="button"
                >
                  <span className="grid place-items-center w-8 h-8 rounded-sm bg-panel border border-line text-muted shrink-0 transition-[color,border-color] duration-140 group-aria-[current=page]:text-brand group-aria-[current=page]:border-brand/40">
                    {it.icon}
                  </span>
                  <span className="grid min-w-0">
                    <span className="text-[13.5px] font-semibold group-aria-[current=page]:text-brand-dark">
                      {it.label}
                    </span>
                    <span className="text-xs text-muted truncate">
                      {it.desc}
                    </span>
                  </span>
                  {ind ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-[9px] py-0.5 text-xs font-medium leading-[1.5] whitespace-nowrap shrink-0 ml-auto tabular-nums ${
                      ind.tono === "ok"
                        ? "bg-success-soft text-success"
                        : ind.tono === "warn"
                          ? "bg-warning-soft text-warning"
                          : "bg-brand-soft text-muted"
                    }`}>
                      {ind.tono === "ok" ? (
                        <CheckCircle2 size={11} />
                      ) : ind.tono === "warn" ? (
                        <AlertCircle size={11} />
                      ) : null}
                      {ind.texto}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="min-w-0">
        <header className="flex items-start gap-3 flex-wrap pb-3.5 mb-[18px] border-b border-line">
          <span className="grid place-items-center flex-none w-[38px] h-[38px] rounded-[11px] bg-brand-soft text-brand border border-brand/22" aria-hidden>
            {NAV.flatMap((g) => g.items).find((i) => i.key === active)?.icon}
          </span>
          <div className="grid gap-0.5 flex-1 min-w-0">
            <h2 className="text-[17px] font-semibold leading-[1.25] text-ink m-0">{SECCION_INFO[active].titulo}</h2>
            <p className="text-sm leading-[1.5] text-muted max-w-[68ch] m-0">{SECCION_INFO[active].sub}</p>
          </div>
          {indicadores[active] ? (
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              <span className={`inline-flex items-center gap-1 rounded-full px-[9px] py-0.5 text-xs font-medium leading-[1.5] whitespace-nowrap tabular-nums ${
                indicadores[active]!.tono === "ok"
                  ? "bg-success-soft text-success"
                  : indicadores[active]!.tono === "warn"
                    ? "bg-warning-soft text-warning"
                    : "bg-brand-soft text-muted"
              }`}>
                {indicadores[active]!.tono === "ok" ? (
                  <CheckCircle2 size={11} />
                ) : indicadores[active]!.tono === "warn" ? (
                  <AlertCircle size={11} />
                ) : null}
                {indicadores[active]!.texto}
              </span>
            </div>
          ) : null}
        </header>

        {hayPendientes ? (
          <p className="flex items-center gap-2 px-3 py-2.5 rounded-sm border border-warning text-sm leading-[1.45] text-ink bg-warning-soft" role="status">
            <AlertCircle size={13} className="shrink-0" aria-hidden />
            Hay cambios sin guardar en esta sección. Pulsa <strong>Guardar</strong> antes de salir:
            todavía solo existen en este navegador.
          </p>
        ) : null}
        <AdminSettings
          currentUserId={currentUserId}
          oficinas={oficinas.map((o) => ({ id: o.id, nombre: o.nombre }))}
          oficinasContrataciones={oficinas.filter((o) => o.gestiona_contrataciones)}
          onReloadOficinas={oficinasState.reload}
          onSummary={reportAdmin}
          section={adminSection}
        />
        <OficinasSettings
          aplicarDelServidor={oficinasState.aplicarDelServidor}
          error={oficinasState.error}
          loading={oficinasState.loading}
          oficinas={oficinas}
          reload={oficinasState.reload}
          section={oficSection}
          setOficinas={oficinasState.setOficinas}
        />
        <PersonalSettings section={personalSection} />
        {enArbitraje ? <InstitucionesArbitralesTab /> : null}
      </div>

      <ConfirmDialog
        open={saltoPendiente !== null}
        title="Cambios sin guardar"
        message="Los cambios de esta sección todavía no se han guardado. Si sales ahora se descartarán."
        tone="warning"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir aquí"
        onConfirm={() => {
          const destino = saltoPendiente;
          setSaltoPendiente(null);
          void oficinasState.reload();
          if (destino) setActive(destino);
        }}
        onCancel={() => setSaltoPendiente(null)}
      />
    </div>
  );
}
