// Reúne los datos del expediente + Configuración para el Anexo de Solicitud de
// Certificación de Crédito Presupuestario (A7). Compartido por el endpoint de
// exportación (.xlsx) y el de vista previa, para que ambos partan de lo mismo.

import { cuantiaDeA5 } from "./anexo1-interaccion";
import { formatDocumentNumber } from "./document-number";
import { montoA7 } from "./expediente-contenido";
import {
  capitalizarProceso,
  labelProcedimiento,
  nomenclaturaConNumero,
  nomenclaturaDelFormato,
} from "./estrategia-formato";
import type { HitosMap } from "./procurement-fases";
import type { SolicitudCertInput } from "./solicitud-certificacion-xlsx";
import { supabaseRest, supabaseUserRest } from "./supabase-server";

type ProcesoRow = {
  id: string;
  nomenclature: string;
  entity: string | null;
  object_type: string | null;
  amount: number | null;
  valor_estimado: number | null;
  necesidad_id: string | null;
  hitos: HitosMap | null;
};
type NecesidadRow = {
  nombre: string | null;
  area_usuaria: string | null;
  proyecto_inversion: string | null;
  cui: string | null;
  plazo_ejecucion: number | null;
  clasificador_gasto: string | null;
  fuente_financiamiento: string | null;
  rubro: string | null;
  meta_presupuestal: string | null;
  cadena_funcional: string | null;
};
type OficinaRow = {
  id: string;
  nombre: string;
  ancho: number | null;
  sufijo: string | null;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
  gestiona_contrataciones: boolean | null;
};
type CounterRow = { siguiente: number; sufijo: string | null };
type ProfileRow = {
  nombre_completo: string | null;
  grado_academico: string | null;
  cargo: string | null;
  oficina_id: string | null;
};

/** Fecha de hoy en ISO (YYYY-MM-DD), para el valor por defecto de la solicitud. */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function str(data: Record<string, unknown> | undefined, key: string): string {
  const v = data?.[key];
  return typeof v === "string" ? v.trim() : "";
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function norm(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function buscarOficina(oficinas: OficinaRow[], terminos: string[]): OficinaRow | undefined {
  return oficinas.find((x) => terminos.some((t) => norm(x.nombre).includes(t)));
}

export type ArmarResult = { input: SolicitudCertInput } | { error: string; status: number };

export type ArmarOpts = {
  /** Fecha de la solicitud (editable en A7); por defecto hoy. Va a C12. */
  fechaSolicitud?: string;
  /** Nombre completo del usuario en sesión que genera la solicitud. */
  elaboradoPor?: string | null;
};

export async function armarInputCertificacion(
  token: string,
  id: string,
  opts: ArmarOpts = {},
): Promise<ArmarResult> {
  const rows = await supabaseUserRest<ProcesoRow[]>(
    token,
    `procurement_processes?id=eq.${id}&select=id,nomenclature,entity,object_type,amount,valor_estimado,necesidad_id,hitos`,
  );
  const proceso = rows[0];
  if (!proceso) return { error: "Expediente no encontrado", status: 404 };

  const hitos = proceso.hitos ?? {};
  const a1 = hitos.A1?.data ?? {};
  const a3 = hitos.A3?.data ?? {};
  const a4 = hitos.A4?.data ?? {};
  const a5 = hitos.A5?.data ?? {};
  const a7 = hitos.A7?.data ?? {};
  if (!hitos.A7) {
    return { error: "Guarda el paso A7 (Certificación presupuestal) antes de exportar.", status: 409 };
  }

  let nec: NecesidadRow | null = null;
  if (proceso.necesidad_id) {
    const necs = await supabaseUserRest<NecesidadRow[]>(
      token,
      `necesidades?id=eq.${proceso.necesidad_id}` +
        `&select=nombre,area_usuaria,proyecto_inversion,cui,plazo_ejecucion,clasificador_gasto,fuente_financiamiento,rubro,meta_presupuestal,cadena_funcional&limit=1`,
    ).catch(() => []);
    nec = necs[0] ?? null;
  }

  const objeto = (nec?.nombre ?? "").trim() || str(a4, "var_a_nomenclatura") || proceso.nomenclature || "";
  // Cuantía base: el monto que la DEC registró en A7; si aún no lo puso, la
  // "Cuantía actualizada" de A5 (Art. 53.1) —que es la base—; y, en último caso,
  // el valor estimado del expediente. El campo de A7 se siembra con esta cuantía.
  const monto = montoA7(a7) || (cuantiaDeA5(a5) ?? 0) || proceso.valor_estimado || proceso.amount || 0;
  const tipo = str(a7, "tipo");
  const vigencia = str(a7, "vigencia");
  const plazoDias = nec?.plazo_ejecucion ?? num(a3.plazo_dias);

  let montoCert = 0;
  let montoPrev = 0;
  if (tipo === "ambas") {
    montoCert = num(a7.monto_ccp);
    montoPrev = num(a7.monto_prevision);
  } else if (tipo === "prevision") {
    montoPrev = num(a7.monto);
  } else {
    montoCert = num(a7.monto) || monto;
  }

  // Tres lecturas globales independientes entre sí (entidad, DEC, oficinas): en
  // PARALELO en vez de tres round-trips encadenados. `oficinas` para resolver
  // nombres por id/nombre; el jefe DEC para el bloque "DE" (C8/C9).
  const [inst, jefe, oficinas] = await Promise.all([
    supabaseRest<{ city: string | null }[]>(
      "entity_settings?id=eq.default&select=city&limit=1",
    ).catch(() => [] as { city: string | null }[]),
    supabaseRest<ProfileRow[]>(
      "profiles?role=eq.dec&select=nombre_completo,grado_academico,cargo,oficina_id&order=es_jefe.desc&limit=1",
    ).catch(() => [] as ProfileRow[]),
    supabaseRest<OficinaRow[]>(
      "expedientes_oficinas?select=id,nombre,ancho,sufijo,responsable_nombre,responsable_cargo,gestiona_contrataciones",
    ).catch(() => [] as OficinaRow[]),
  ]);

  // La DEC es la oficina que gestiona contrataciones (UNIDAD DE ABASTECIMIENTO).
  const ofiDec =
    oficinas.find((o) => o.gestiona_contrataciones) ??
    buscarOficina(oficinas, ["abastecimiento", "logistica", "adquisicion"]);
  // "A" (C2/C3): la oficina ELEGIDA en A7 (`solicitud_al`) si la hay; si no, la
  // OFICINA GENERAL DE ADMINISTRACIÓN JEFATURA por coincidencia de nombre (se exige
  // "general de administracion" para no capturar otras "… ADMINISTRACION …").
  const alElegido = str(a7, "solicitud_al");
  const ofiAl =
    (alElegido ? oficinas.find((o) => o.nombre === alElegido) : undefined) ??
    oficinas.find(
      (o) => norm(o.nombre).includes("general de administracion") && norm(o.nombre).includes("jefatura"),
    ) ??
    buscarOficina(oficinas, ["general de administracion", "administracion general"]);
  // ATENCIÓN (C5/C6): la elegida en A7 (`solicitud_atencion`); si no, PLANEAMIENTO
  // Y PRESUPUESTO JEFATURA por nombre.
  const atElegido = str(a7, "solicitud_atencion");
  const ofiAtencion =
    (atElegido ? oficinas.find((o) => o.nombre === atElegido) : undefined) ??
    oficinas.find(
      (o) => norm(o.nombre).includes("planeamiento") && norm(o.nombre).includes("jefatura"),
    ) ??
    buscarOficina(oficinas, ["planeamiento y presupuesto", "general de planeamiento"]);

  // Perfil (pestaña Usuarios) registrado en una oficina; el jefe primero.
  const perfilDeOficina = async (oficinaId: string | undefined): Promise<ProfileRow | undefined> => {
    if (!oficinaId) return undefined;
    const ps = await supabaseRest<ProfileRow[]>(
      `profiles?oficina_id=eq.${oficinaId}&select=nombre_completo,grado_academico,cargo,oficina_id&order=es_jefe.desc&limit=1`,
    ).catch(() => []);
    return ps[0];
  };
  // Los dos perfiles son independientes entre sí (dependen de oficinas ya leídas).
  const [alProfile, atencionProfile] = await Promise.all([
    perfilDeOficina(ofiAl?.id), // C2/C3: OGA JEFATURA
    perfilDeOficina(ofiAtencion?.id), // C5/C6: Planeamiento JEFATURA
  ]);

  // B1: número de la solicitud. Es el campo `numero_solicitud` de A7 (guarda solo
  // el número; el "INFORME N° " es su prefijo). Al descargar se consume el
  // correlativo de la DEC y se congela ahí. Si por algún motivo no hay campo, se
  // cae al siguiente de la serie INFORME de la DEC (Configuración → Numeración).
  const anioFiscal = str(a7, "fecha").slice(0, 4) || String(new Date().getFullYear());
  const numeroSolicitud = str(a7, "numero_solicitud");
  let informeNumero = numeroSolicitud
    ? `INFORME N° ${numeroSolicitud.replace(/^\s*informe\s*n(?:ro|[°ºo])?\.?\s*/i, "")}`
    : "";
  if (!informeNumero && ofiDec) {
    const counters = await supabaseRest<CounterRow[]>(
      `expedientes_doc_counters?oficina_id=eq.${ofiDec.id}&tipo=eq.INFORME&select=siguiente,sufijo&limit=1`,
    ).catch(() => []);
    const c = counters[0];
    if (c) {
      informeNumero = formatDocumentNumber({
        tipo: "INFORME",
        siguiente: c.siguiente,
        ancho: ofiDec.ancho ?? 3,
        sufijo: c.sufijo?.trim() || ofiDec.sufijo,
        year: Number(anioFiscal),
      });
    }
  }

  // "cargo de la {oficina}" para la 2.ª línea del bloque; si no hay cargo, solo
  // la oficina.
  const cargoDeOficina = (cargo: string, oficina: string) =>
    cargo && oficina ? `${cargo} de la ${oficina}` : oficina || cargo;

  // Destinatario (OGA JEFATURA): C2 = grado + nombre; C3 = cargo de la oficina.
  const alGrado = (alProfile?.grado_academico ?? "").trim();
  const alNombreCompleto = (alProfile?.nombre_completo ?? "").trim();
  const alCargo = (alProfile?.cargo ?? "").trim() || (ofiAl?.responsable_cargo ?? "").trim();
  const ofiAlNombre = (ofiAl?.nombre ?? "").trim() || "OFICINA GENERAL DE ADMINISTRACIÓN JEFATURA";
  const c2 = [alGrado, alNombreCompleto].filter(Boolean).join(" ") || (ofiAl?.responsable_nombre ?? "").trim();
  const c3 = cargoDeOficina(alCargo, ofiAlNombre);

  // Atención (PLANEAMIENTO JEFATURA): C5 = grado + nombre; C6 = cargo de la oficina.
  const atGrado = (atencionProfile?.grado_academico ?? "").trim();
  const atNombre = (atencionProfile?.nombre_completo ?? "").trim();
  const atCargo = (atencionProfile?.cargo ?? "").trim() || (ofiAtencion?.responsable_cargo ?? "").trim();
  const ofiAtNombre =
    (ofiAtencion?.nombre ?? "").trim() || "OFICINA GENERAL DE PLANEAMIENTO Y PRESUPUESTO JEFATURA";
  const c5 = [atGrado, atNombre].filter(Boolean).join(" ") || (ofiAtencion?.responsable_nombre ?? "").trim();
  const c6 = cargoDeOficina(atCargo, ofiAtNombre);

  const input: SolicitudCertInput = {
    informeNumero,
    al: { nombre: c2, oficina: c3 },
    atencion: { nombre: c5, oficina: c6 },
    del: {
      grado: (jefe[0]?.grado_academico ?? "").trim(),
      nombre: (jefe[0]?.nombre_completo ?? "").trim() || (ofiDec?.responsable_nombre ?? "").trim(),
      // C9: nombre de la oficina de la DEC (UNIDAD DE ABASTECIMIENTO).
      cargo: (ofiDec?.nombre ?? "").trim() || "UNIDAD DE ABASTECIMIENTO",
    },
    ciudad: inst[0]?.city ?? "",
    // C12: fecha de la solicitud. Es un campo del paso A7 (`fecha_solicitud`,
    // sembrado con hoy y editable). El query param `opts.fechaSolicitud` lo refleja
    // en vivo desde el formulario aunque no se haya guardado; si no llega, se usa el
    // valor persistido y, en último caso, hoy.
    fechaISO: (opts.fechaSolicitud || "").trim() || str(a7, "fecha_solicitud") || hoyISO(),
    // El proceso ESPECÍFICO de A4 (var_a_proceso, p. ej. "Licitación Pública para
    // bienes"), igual que el Anexo N° 2 y el informe de aprobación; cae al
    // genérico del Art. 54 en expedientes antiguos sin var_a_proceso. (La
    // detección de competitivo de abajo SÍ usa el genérico a propósito.)
    procedimientoLabel: capitalizarProceso(
      str(a4, "var_a_proceso") ||
        labelProcedimiento(str(a4, "var_a_procedimiento")) ||
        "Procedimiento de selección",
    ),
    // Mismo formato que C11 del Anexo N° 2: la nomenclatura con "N° " antepuesto,
    // de A4 y, si no, del nomenclature del expediente. C24 la une al procedimiento.
    nomenclatura: nomenclaturaConNumero(nomenclaturaDelFormato(a4, proceso.nomenclature, nec?.nombre)),
    objeto,
    proyectoInversion: (nec?.proyecto_inversion ?? "").trim(),
    cui: (nec?.cui ?? "").trim(),
    monto,
    esObra: (proceso.object_type ?? "").toLowerCase().includes("obra"),
    areaUsuaria: (nec?.area_usuaria ?? "").trim(),
    referenciaPac: str(a1, "referencia_pac"),
    plazoEjecucion: plazoDias > 0 ? `${plazoDias} días calendario` : "",
    anioCertificacion: montoCert > 0 ? vigencia || anioFiscal : "",
    montoCertificacion: montoCert,
    anioPrevision: montoPrev > 0 ? vigencia || anioFiscal : "",
    montoPrevision: montoPrev,
    // Bloque de previsión (filas 39-42): solo para "ambas" y "previsión"; en
    // certificación de crédito presupuestal esas filas se ocultan.
    mostrarPrevision: tipo === "ambas" || tipo === "prevision",
    // A4 var_a_procedimiento solo admite procedimientos competitivos: si trae
    // uno válido (labelProcedimiento != null), C24 es competitivo → ocultar 25-26.
    esCompetitivo: labelProcedimiento(str(a4, "var_a_procedimiento")) !== null,
    // N° CMN (A1 · "N.° del CMN") y clasificador de gasto (Necesidad).
    nroCmn: str(a1, "version_cmn"),
    clasificadorGasto: (nec?.clasificador_gasto ?? "").trim(),
    // Coordenadas presupuestales que necesita Presupuesto para EMITIR la
    // certificación (DL 1440; Art. 54.2.f y 53.1 del Reglamento). Todas de la
    // ficha de la necesidad.
    fuenteFinanciamiento: (nec?.fuente_financiamiento ?? "").trim(),
    rubro: (nec?.rubro ?? "").trim(),
    metaPresupuestal: (nec?.meta_presupuestal ?? "").trim(),
    cadenaFuncional: (nec?.cadena_funcional ?? "").trim(),
    elaboradoPor: opts.elaboradoPor,
  };
  return { input };
}
