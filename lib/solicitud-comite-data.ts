// Datos de la "Solicitud de propuesta de miembros del Comité de Selección" (A6).
//
// Vive aparte porque lo usan DOS endpoints: el que descarga el .xlsx y el de la
// vista previa. Reunirlos por separado dejaría que la previa enseñe una cosa y el
// documento otra —justo lo que la haría inútil—, así que ambos parten de aquí.

import { OPCIONES_TIPO_EVALUADOR } from "./actuaciones-preparatorias";
import { cuantiaDeA5 } from "./anexo1-interaccion";
import { leerIntegrantes, prefijoDesignacion, soloNumeroDesignacion } from "./designacion-evaluadores";
import {
  capitalizarProceso,
  labelProcedimiento,
  nomenclaturaConNumero,
  nomenclaturaDelFormato,
} from "./estrategia-formato";
import { type JefeDeOficina, resolverCabeceraDeOficina } from "./informe-aprobacion-datos";
import { conGradoAcademico, type Persona } from "./nombres";
import type { HitosMap } from "./procurement-fases";
import type { MiembroComite, SolicitudComiteInput } from "./solicitud-comite-xlsx";
import { supabaseRest, supabaseUserRest } from "./supabase-server";

type ProcesoRow = {
  id: string;
  nomenclature: string;
  entity: string | null;
  amount: number | string | null;
  hitos: HitosMap | null;
  necesidad_id: string | null;
};

type NecesidadRow = { codigo: string | null; area_usuaria: string | null; created_at: string | null };

const str = (data: Record<string, unknown> | undefined, key: string): string => {
  const v = data?.[key];
  return typeof v === "string" ? v.trim() : "";
};

export type ResultadoComite = { input: SolicitudComiteInput } | { error: string; status: number };

/**
 * Reúne el input de la solicitud de comité, o el motivo por el que no procede
 * (contrato sin A6, o tipo de evaluador que no es comité).
 */
export async function armarInputComite(
  accessToken: string,
  id: string,
  /** Nombre completo del usuario en sesión que genera la solicitud. */
  elaboradoPor?: string | null,
): Promise<ResultadoComite> {
  const rows = await supabaseUserRest<ProcesoRow[]>(
    accessToken,
    `procurement_processes?id=eq.${id}&select=id,nomenclature,entity,amount,hitos,necesidad_id`,
  );
  const proceso = rows[0];
  if (!proceso) return { error: "Expediente no encontrado", status: 404 };

  const hitos = proceso.hitos ?? {};
  if (!hitos.A6) {
    return { error: "Guarda el paso A6 (Designación de evaluadores) antes de exportar.", status: 409 };
  }
  const a2 = hitos.A2?.data ?? {};
  const a4 = hitos.A4?.data ?? {};
  const a5 = hitos.A5?.data ?? {};
  const a6 = hitos.A6?.data ?? {};

  // El valor sale del catálogo, no de un literal: si mañana cambia el `value` del
  // comité, esta comparación cambia con él en vez de bloquear siempre en silencio.
  const COMITE = OPCIONES_TIPO_EVALUADOR.find((o) => /comit/i.test(o.label));
  const tipoEvaluador = str(a6, "tipo_evaluador") || str(a4, "var_e_tipo_evaluador");
  if (!COMITE || tipoEvaluador !== COMITE.value) {
    return {
      error: `La solicitud de comité solo aplica cuando el tipo de evaluador es «${COMITE?.label ?? "Comité"}».`,
      status: 409,
    };
  }

  // Necesidad de origen: número/fecha del requerimiento y área usuaria.
  let necesidad: NecesidadRow | null = null;
  if (proceso.necesidad_id) {
    const nRows = await supabaseUserRest<NecesidadRow[]>(
      accessToken,
      `necesidades?id=eq.${proceso.necesidad_id}&select=codigo,area_usuaria,created_at`,
    ).catch(() => []);
    necesidad = nRows[0] ?? null;
  }

  // Órgano encargado (DEC) que solicita la propuesta.
  const jefe = await supabaseRest<{ nombre_completo: string | null; oficina: string | null }[]>(
    "profiles?role=eq.dec&select=nombre_completo,oficina&order=es_jefe.desc&limit=1",
  ).catch(() => []);

  // AL y ATENCIÓN de A6 guardan el NOMBRE de una oficina del catálogo (misma
  // mecánica que A7/A8): se resuelven a la cabecera de su responsable —el jefe de
  // esa oficina en Usuarios—, igual que el informe de aprobación. El padrón eleva
  // "QUISPE CHIPANA SAUL" a "CPC. SAUL QUISPE CHIPANA" para la firma.
  const hoy = new Date();
  const oficinasTodas = await supabaseRest<
    {
      id: string;
      nombre: string;
      responsable_nombre: string | null;
      responsable_cargo: string | null;
      gestiona_contrataciones: boolean | null;
    }[]
  >(
    `expedientes_oficinas?year=eq.${hoy.getFullYear()}` +
      `&select=id,nombre,responsable_nombre,responsable_cargo,gestiona_contrataciones`,
  ).catch(() => []);
  const perfiles = await supabaseRest<
    {
      nombre_completo: string | null;
      grado_academico: string | null;
      cargo: string | null;
      oficina_id: string | null;
      es_jefe: boolean | null;
    }[]
  >(
    "profiles?select=nombre_completo,grado_academico,cargo,oficina_id,es_jefe&nombre_completo=not.is.null",
  ).catch(() => []);
  const personas: Persona[] = perfiles
    .filter((p) => p.nombre_completo)
    .map((p) => ({ nombre: p.nombre_completo as string, grado: p.grado_academico ?? undefined }));
  const jefePorOficina = new Map<string, JefeDeOficina>();
  for (const p of perfiles) {
    if (p.es_jefe && p.oficina_id && p.nombre_completo && !jefePorOficina.has(p.oficina_id)) {
      jefePorOficina.set(p.oficina_id, { nombre: p.nombre_completo, cargo: (p.cargo ?? "").trim() });
    }
  }
  const cabeceraOficina = (valor: string): string =>
    resolverCabeceraDeOficina(valor, oficinasTodas, personas, jefePorOficina);

  // ATENCIÓN: el desplegable de A6 guarda un ROL ("aga" o "gerente"), que aquí se
  // resuelve al texto de esa autoridad —"GRADO Nombre\ncargo"— desde Configuración
  // → Municipalidad (viven en `entity_settings`; en un gobierno local no usan la
  // app, por eso no están en profiles). No se les añade "de la OGA": esa oficina
  // ya sale en el AL.
  const inst = await supabaseRest<
    {
      aga_degree: string | null;
      aga_full_name: string | null;
      aga_position: string | null;
      manager_degree: string | null;
      manager_full_name: string | null;
      manager_position: string | null;
    }[]
  >(
    "entity_settings?id=eq.default&select=aga_degree,aga_full_name,aga_position," +
      "manager_degree,manager_full_name,manager_position&limit=1",
  ).catch(() => []);
  const oga = oficinasTodas.find((o) => /^OFICINA GENERAL DE ADMINISTRACION/i.test(o.nombre));
  const autoridadTxt = (grado: string | null, nombre: string | null, cargo: string): string => {
    const n = (nombre ?? "").trim();
    if (!n) return "";
    return cargo ? `${conGradoAcademico(grado, n)}\n${cargo}` : conGradoAcademico(grado, n);
  };
  const agaTxt = autoridadTxt(
    inst[0]?.aga_degree ?? null,
    inst[0]?.aga_full_name ?? null,
    (inst[0]?.aga_position ?? "").trim() || "AUTORIDAD DE GESTIÓN ADMINISTRATIVA",
  );
  const gerenteTxt = autoridadTxt(
    inst[0]?.manager_degree ?? null,
    inst[0]?.manager_full_name ?? null,
    (inst[0]?.manager_position ?? "").trim(),
  );
  const atencionSel = str(a6, "atencion");
  const atencionResuelta =
    atencionSel === "gerente"
      ? gerenteTxt || agaTxt
      : atencionSel === "aga"
        ? agaTxt || gerenteTxt
        : // Texto antiguo (cuando ATENCIÓN era un campo libre) u oficina: se respeta.
          cabeceraOficina(atencionSel) || agaTxt || str(a2, "atencion");

  // Default de DE (remitente): la dependencia encargada de las contrataciones (la
  // DEC), resuelta a su responsable. El campo está oculto en A6 —el DE siempre es
  // la DEC—, pero se sigue imprimiendo en la previa y el .xls.
  const oficinaDec =
    oficinasTodas.find((o) => /DEPENDENCIA ENCARGADA DE (LAS )?CONTRATACION/i.test(o.nombre)) ??
    oficinasTodas.find((o) => o.gestiona_contrataciones);
  const remitenteDefault = cabeceraOficina(oficinaDec?.nombre ?? "");

  const aMiembro = (i: {
    nombre?: string;
    correo?: string;
    grado?: string;
    cargo?: string;
    dni?: string;
    rol?: string;
    condicion?: "titular" | "suplente";
  }): MiembroComite => ({
    nombre: (i.nombre ?? "").trim() || (i.correo ?? "").trim(),
    grado: (i.grado ?? "").trim(),
    cargo: (i.cargo ?? "").trim(),
    dni: (i.dni ?? "").trim(),
    rol: (i.rol ?? "").trim(),
    condicion: i.condicion === "suplente" ? "suplente" : "titular",
  });
  // Dos propuestas: la de la DEC (integrantes) y la del área usuaria (los expertos).
  const miembrosDec = leerIntegrantes(a6.integrantes).map(aMiembro);
  const miembrosAreaUsuaria = leerIntegrantes(a6.integrantes_area_usuaria).map(aMiembro);

  // Cuantía de la contratación: la BASE es la "Cuantía actualizada" de A5 (Art.
  // 53.1); solo si el expediente no la trae (antiguo) se cae al monto del proceso.
  const monto = cuantiaDeA5(a5) ?? Number(proceso.amount);
  // El proceso ESPECÍFICO de A4 (var_a_proceso, p. ej. "Licitación Pública
  // Abreviada para bienes"), igual que A7, A8 y el informe de aprobación; cae al
  // genérico del Art. 54 en expedientes antiguos que no traen var_a_proceso.
  const procedimiento = capitalizarProceso(
    str(a4, "var_a_proceso") || labelProcedimiento(str(a4, "var_a_procedimiento")) || "",
  );

  return {
    input: {
      // Cabecera de memo: número del memorándum de designación (A6) y el
      // enrutamiento AL/ATENCIÓN/DE de A6 (con el Informe de Segmentación A2 como
      // respaldo, que ya trae ese enrutamiento por defecto).
      // El número del documento de designación con su prefijo por tipo (comité →
      // "INFORME N° "). Si A6 no lo trae, el del Informe de Segmentación (A2).
      numeroInforme: str(a6, "documento_designacion")
        ? `${prefijoDesignacion(tipoEvaluador)}${soloNumeroDesignacion(str(a6, "documento_designacion"))}`
        : str(a2, "numeroInforme"),
      // AL y ATENCIÓN: la oficina elegida en A6 resuelta a su responsable; si no se
      // eligió (o es texto antiguo que no casa con ninguna oficina), lo que haya en
      // A6 tal cual y, en último caso, lo del Informe de Segmentación (A2).
      // AL: la oficina elegida en A6, resuelta a su responsable; por defecto la OGA;
      // y en último caso lo del Informe de Segmentación (A2).
      destinatario:
        cabeceraOficina(str(a6, "destinatario")) ||
        cabeceraOficina(oga?.nombre ?? "") ||
        str(a2, "destinatario"),
      // ATENCIÓN: la autoridad elegida en el desplegable (AGA por defecto), resuelta
      // a su grado, nombre y cargo.
      atencion: atencionResuelta,
      // DE: el campo está oculto; se resuelve a la DEC (o al valor previo/A2 si lo
      // hubiera, para no reescribir expedientes ya redactados a mano).
      remitente: cabeceraOficina(str(a6, "remitente")) || remitenteDefault || str(a2, "remitente"),
      dependenciaSolicitada: necesidad?.area_usuaria?.trim() || "",
      dependenciaSolicitante:
        [jefe[0]?.nombre_completo, jefe[0]?.oficina].filter(Boolean).join(" · ") ||
        "Órgano Encargado de las Contrataciones",
      denominacion: [proceso.nomenclature].filter(Boolean).join(" "),
      // Mismo formato que C11 del Anexo N° 2: el proceso (específico) + la
      // nomenclatura con "N° " antepuesto (nomenclaturaConNumero), tomándola de A4
      // y, si no, del nomenclature del expediente (nomenclaturaDelFormato).
      nomenclatura: [
        procedimiento,
        nomenclaturaConNumero(nomenclaturaDelFormato(a4, proceso.nomenclature, null)),
      ]
        .filter(Boolean)
        .join(" "),
      monto: Number.isFinite(monto) ? monto : 0,
      numeroRequerimiento: necesidad?.codigo?.trim() || "",
      fechaRequerimientoISO: (necesidad?.created_at ?? "").slice(0, 10),
      miembrosDec,
      miembrosAreaUsuaria,
      sustentoPerfil: str(a4, "var_e_perfil_evaluador") || str(a6, "perfil_evaluador"),
      elaboradoPor,
    },
  };
}
