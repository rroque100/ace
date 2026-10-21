import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { emptyEntity, parseMonto } from "@/lib/configuracion-types";
import { parseDiasPorProcedimiento } from "@/lib/cronograma-dias";
import { APP_AREAS, APP_ROLES, type AppRole } from "@/lib/permisos-contratacion";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { getYearFromRequest } from "@/lib/year-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const governmentLevels = ["gobierno_nacional", "gobierno_regional", "gobierno_local"] as const;

const entitySchema = z.object({
  address: z.string().trim().min(5).max(260),
  // Ciudad: se usa como "Lugar" del encabezado de los documentos de Responder.
  city: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  province: z.string().trim().max(120).optional().or(z.literal("")),
  executingUnit: z.string().trim().regex(/^\d{6}$/, "La unidad ejecutora debe tener 6 digitos"),
  governmentLevel: z.enum(governmentLevels),
  managerDegree: z.string().trim().max(30).optional().or(z.literal("")),
  managerDni: z.string().trim().regex(/^\d{8}$/, "El DNI debe tener 8 digitos").optional().or(z.literal("")),
  managerFullName: z.string().trim().max(200).optional().or(z.literal("")),
  managerPosition: z.string().trim().max(120).optional().or(z.literal("")),
  managerResolutionDate: z.string().trim().max(20).optional().or(z.literal("")),
  managerResolutionNumber: z.string().trim().max(80).optional().or(z.literal("")),
  // Autoridad de Gestión Administrativa (AGA): aprueba el expediente (Art. 54.2;
  // Ley 32069 Art. 25.1.b / Reglamento Art. 19). Autoridad designada por
  // resolución, con los mismos datos que el gerente.
  agaDegree: z.string().trim().max(30).optional().or(z.literal("")),
  agaDni: z.string().trim().regex(/^\d{8}$/, "El DNI debe tener 8 digitos").optional().or(z.literal("")),
  agaFullName: z.string().trim().max(200).optional().or(z.literal("")),
  agaPosition: z.string().trim().max(120).optional().or(z.literal("")),
  agaResolutionDate: z.string().trim().max(20).optional().or(z.literal("")),
  agaResolutionNumber: z.string().trim().max(80).optional().or(z.literal("")),
  name: z.string().trim().min(3).max(180),
  // PIA y PAC del ejercicio (datos anuales). Los montos llegan como texto
  // escrito a mano y se normalizan con parseMonto antes de persistir.
  pacAnio: z.string().trim().max(4).optional().or(z.literal("")),
  pacMontoBienesServicios: z.string().trim().max(30).optional().or(z.literal("")),
  pacMontoObras: z.string().trim().max(30).optional().or(z.literal("")),
  pacMontoTotal: z.string().trim().max(30).optional().or(z.literal("")),
  pacResolutionDate: z.string().trim().max(20).optional().or(z.literal("")),
  pacResolutionNumber: z.string().trim().max(120).optional().or(z.literal("")),
  piaResolutionDate: z.string().trim().max(20).optional().or(z.literal("")),
  piaResolutionNumber: z.string().trim().max(120).optional().or(z.literal("")),
  ruc: z.string().trim().regex(/^\d{11}$/, "El RUC debe tener 11 digitos"),
  // UIT del ejercicio: base del umbral del contrato menor, que a su vez decide
  // si una contratación puede agruparse por ítems (Art. 52.1.b del Reglamento).
  uitAnio: z.string().trim().max(4).optional().or(z.literal("")),
  uitValor: z.string().trim().max(30).optional().or(z.literal("")),
  // Rango de cuantía de la LP abreviada para bienes (umbral anual editable).
  lpAbreviadaBienesAnio: z.string().trim().max(4).optional().or(z.literal("")),
  lpAbreviadaBienesMin: z.string().trim().max(30).optional().or(z.literal("")),
  lpAbreviadaBienesMax: z.string().trim().max(30).optional().or(z.literal("")),
  // Topes por cuantía de los procedimientos (umbrales anuales editables).
  topeAnio: z.string().trim().max(4).optional().or(z.literal("")),
  topePiso: z.string().trim().max(30).optional().or(z.literal("")),
  topeLicitacionConcurso: z.string().trim().max(30).optional().or(z.literal("")),
  topeLicitacionObras: z.string().trim().max(30).optional().or(z.literal("")),
  topeComparacionPrecios: z.string().trim().max(30).optional().or(z.literal("")),
  cronogramaAnio: z.string().trim().max(4).optional().or(z.literal("")),
  cronogramaDias: z.string().trim().max(4000).optional().or(z.literal("")),
});

const processTypeSchema = z.object({
  active: z.boolean().default(true),
  category: z.enum(["competitivo", "no_competitivo", "contrato_menor"]).default("competitivo"),
  code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  frequentMunicipality: z.boolean().default(false),
  label: z.string().trim().min(3).max(140),
  legalBasis: z.string().trim().max(260).optional().or(z.literal("")),
  object: z.string().trim().max(160).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const saveSchema = z.object({
  entity: entitySchema,
  processTypes: z.array(processTypeSchema).min(1).max(50).optional(),
});

type EntitySettingsRow = {
  address: string | null;
  city?: string | null;
  department?: string | null;
  province?: string | null;
  executing_unit: string | null;
  government_level: string | null;
  id: string;
  manager_degree?: string | null;
  manager_dni?: string | null;
  manager_full_name?: string | null;
  manager_position?: string | null;
  manager_resolution_date?: string | null;
  manager_resolution_number?: string | null;
  aga_degree?: string | null;
  aga_dni?: string | null;
  aga_full_name?: string | null;
  aga_position?: string | null;
  aga_resolution_date?: string | null;
  aga_resolution_number?: string | null;
  name: string | null;
  pac_anio?: number | null;
  pac_monto_bienes_servicios?: number | string | null;
  pac_monto_obras?: number | string | null;
  pac_monto_total?: number | string | null;
  pac_resolucion_fecha?: string | null;
  pac_resolucion_numero?: string | null;
  pia_resolucion_fecha?: string | null;
  pia_resolucion_numero?: string | null;
  ruc: string | null;
  uit_anio?: number | null;
  uit_valor?: number | string | null;
  lp_abreviada_bienes_anio?: number | null;
  lp_abreviada_bienes_min?: number | string | null;
  lp_abreviada_bienes_max?: number | string | null;
  cronograma_anio?: number | null;
  cronograma_dias?: unknown;
  tope_anio?: number | null;
  tope_piso?: number | string | null;
  tope_licitacion_concurso?: number | string | null;
  tope_licitacion_obras?: number | string | null;
  tope_comparacion_precios?: number | string | null;
  updated_at: string | null;
};

type ProcessTypeRow = {
  active: boolean;
  category?: string | null;
  code: string;
  description: string | null;
  frequent_municipality?: boolean | null;
  label: string;
  legal_basis?: string | null;
  object?: string | null;
  sort_order: number;
  updated_at: string | null;
};

const governmentLevelOptions = [
  {
    examples: "Ministerios, organismos publicos, programas y organismos constitucionales autonomos",
    label: "Gobierno Nacional",
    value: "gobierno_nacional",
  },
  {
    examples: "Gobiernos Regionales",
    label: "Gobierno Regional",
    value: "gobierno_regional",
  },
  {
    examples: "Municipalidades Provinciales y Municipalidades Distritales",
    label: "Gobierno Local",
    value: "gobierno_local",
  },
] as const;

const roles = APP_ROLES.map((role) => ({
  description: role.description,
  label: role.label,
  value: role.value,
}));

const rolePermissions = APP_AREAS.map((area) => ({
  area: area.area,
  permissions: Object.fromEntries(
    APP_ROLES.map((role) => [role.value, role.value === "admin" || area.roles.includes(role.value)]),
  ) as Record<AppRole, boolean>,
  scope: area.scope,
}));

// PostgREST devuelve numeric como string ("1226465.70"); el formulario lo
// maneja como texto libre.
function montoToText(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

// Columnas que dependen de un SQL que puede no haberse ejecutado todavia. Si
// falta alguna, se guarda el resto en lugar de fallar entero.
const COLUMNAS_OPCIONALES = new Set([
  "city",
  "department",
  "province",
  "manager_degree",
  "manager_dni",
  "manager_full_name",
  "manager_position",
  "manager_resolution_date",
  "manager_resolution_number",
  "aga_degree",
  "aga_dni",
  "aga_full_name",
  "aga_position",
  "aga_resolution_date",
  "aga_resolution_number",
  "pac_anio",
  "pac_monto_bienes_servicios",
  "pac_monto_obras",
  "pac_monto_total",
  "pac_resolucion_fecha",
  "pac_resolucion_numero",
  "pia_resolucion_fecha",
  "pia_resolucion_numero",
  "uit_anio",
  "uit_valor",
  "lp_abreviada_bienes_anio",
  "lp_abreviada_bienes_min",
  "lp_abreviada_bienes_max",
  "tope_anio",
  "tope_piso",
  "tope_licitacion_concurso",
  "tope_licitacion_obras",
  "tope_comparacion_precios",
  "cronograma_anio",
  "cronograma_dias",
  "year",
]);

/**
 * Upsert de entity_settings tolerante a columnas ausentes.
 * PostgREST responde "Could not find the 'X' column ... in the schema cache"
 * (PGRST204) cuando el payload trae una columna que aun no existe. En ese caso
 * se quita esa columna y se reintenta, en vez de mantener una cadena de `if`
 * por cada tanda de columnas nuevas.
 */
async function upsertEntitySettings(row: Record<string, unknown>): Promise<void> {
  const payload = { ...row };
  // Cota: como maximo una vuelta por columna opcional presente.
  for (let intento = 0; intento <= COLUMNAS_OPCIONALES.size; intento += 1) {
    try {
      await supabaseRest("entity_settings?on_conflict=id", {
        body: JSON.stringify(payload),
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        method: "POST",
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const faltante =
        message.match(/'([a-z_]+)' column/i)?.[1] ??
        message.match(/column "?([a-z_]+)"? of relation/i)?.[1];
      // Solo se descarta una columna opcional que realmente estemos enviando;
      // cualquier otro error (RUC duplicado, permisos, red) se propaga.
      if (!faltante || !(faltante in payload) || !COLUMNAS_OPCIONALES.has(faltante)) {
        throw error;
      }
      delete payload[faltante];
    }
  }
  throw new Error("No se pudo guardar la entidad: demasiadas columnas ausentes en el esquema.");
}

function defaultProcessTypes(): ProcessTypeRow[] {
  const rows: Array<Omit<ProcessTypeRow, "sort_order" | "updated_at">> = [
    { active: true, category: "competitivo", code: "licitacion_publica_bienes", description: "Procedimiento competitivo para contratacion de bienes.", frequent_municipality: false, label: "Licitacion Publica para Bienes", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Bienes" },
    { active: true, category: "competitivo", code: "licitacion_publica_abreviada_bienes", description: "Procedimiento competitivo abreviado para contratacion de bienes.", frequent_municipality: false, label: "Licitacion Publica Abreviada para Bienes", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Bienes" },
    { active: true, category: "competitivo", code: "licitacion_publica_obras", description: "Procedimiento competitivo para ejecucion de obras.", frequent_municipality: false, label: "Licitacion Publica para Obras", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Obras" },
    { active: true, category: "competitivo", code: "licitacion_publica_abreviada_obras", description: "Procedimiento competitivo abreviado para ejecucion de obras.", frequent_municipality: true, label: "Licitacion Publica Abreviada para Obras", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Obras" },
    { active: true, category: "competitivo", code: "concurso_publico_servicios", description: "Procedimiento competitivo para servicios.", frequent_municipality: false, label: "Concurso Publico de Servicios", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Servicios" },
    { active: true, category: "competitivo", code: "concurso_publico_abreviado_servicios", description: "Procedimiento competitivo abreviado para servicios.", frequent_municipality: true, label: "Concurso Publico Abreviado de Servicios", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Servicios" },
    { active: true, category: "competitivo", code: "concurso_publico_consultoria", description: "Incluye consultorias y servicios de mantenimiento vial.", frequent_municipality: false, label: "Concurso Publico para Consultorias y Servicios de Mantenimiento Vial", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Consultorias" },
    { active: true, category: "competitivo", code: "concurso_publico_abreviado_consultoria", description: "Procedimiento abreviado para consultorias y mantenimiento vial.", frequent_municipality: false, label: "Concurso Publico Abreviado para Consultorias y Servicios de Mantenimiento Vial", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Consultorias" },
    { active: true, category: "competitivo", code: "concurso_publico_expertos", description: "Procedimiento competitivo abreviado para expertos.", frequent_municipality: false, label: "Concurso Publico Abreviado para Expertos", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Expertos" },
    { active: true, category: "competitivo", code: "concurso_publico_gerente_proyecto", description: "Procedimiento para gerentes de proyecto.", frequent_municipality: false, label: "Concurso Publico para Gerentes de Proyecto", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Gerentes de Proyecto" },
    { active: true, category: "competitivo", code: "subasta_inversa_electronica", description: "Para bienes y servicios estandarizados; requiere ficha tecnica y directiva aplicable.", frequent_municipality: true, label: "Subasta Inversa Electronica", legal_basis: "Ley 32069, Reglamento, Directiva aplicable y Bases Estandar DGA", object: "Bienes y servicios estandarizados" },
    { active: true, category: "competitivo", code: "comparacion_precios", description: "Procedimiento competitivo donde el precio es factor central conforme a Reglamento.", frequent_municipality: true, label: "Comparacion de Precios", legal_basis: "Ley 32069 (art. 4) y su Reglamento (D.S. 009-2025-EF)", object: "Bienes y servicios" },
    { active: true, category: "competitivo", code: "concurso_proyectos_arquitectonicos", description: "Procedimiento competitivo para proyectos arquitectonicos y urbanisticos.", frequent_municipality: false, label: "Concurso de Proyectos Arquitectonicos y Urbanisticos", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Proyectos arquitectonicos y urbanisticos" },
    { active: true, category: "no_competitivo", code: "procedimiento_no_competitivo", description: "Incluye supuestos como emergencia, proveedor unico, contrato resuelto o nulo, continuacion de prestaciones y otros previstos por Ley.", frequent_municipality: true, label: "Procedimiento de Seleccion No Competitivo", legal_basis: "Ley 32069 articulo 55 y Reglamento", object: "Supuestos excepcionales previstos por Ley" },
    { active: true, category: "contrato_menor", code: "contrato_menor", description: "No constituye procedimiento de seleccion competitivo; aplica reglas especiales.", frequent_municipality: true, label: "Contrato Menor", legal_basis: "Ley 32069; hasta 8 UIT", object: "Contrataciones hasta 8 UIT" },
  ];
  return rows.map((row, index) => ({ ...row, sort_order: index + 1, updated_at: null }));
}

async function getSettings(year: number) {
  // Fallback progresivo por si el SQL de una tanda de columnas aun no se
  // ejecuto: PAC -> manager -> core. Asi registrar el PAC no es requisito para
  // que siga funcionando lo que ya existia.
  const columnsCore = "id,name,ruc,executing_unit,address,city,government_level,updated_at";
  const columnsManager = `${columnsCore},manager_degree,manager_dni,manager_full_name,manager_position,manager_resolution_date,manager_resolution_number`;
  const columnsAll = `${columnsManager},pia_resolucion_numero,pia_resolucion_fecha,pac_resolucion_numero,pac_resolucion_fecha,pac_anio,pac_monto_total,pac_monto_bienes_servicios,pac_monto_obras,department,province,uit_valor,uit_anio`;
  // El rango de la LP abreviada es la tanda de columnas más reciente: va en su
  // propio nivel de fallback para que, si su SQL aún no se ha corrido, siga
  // leyéndose el PAC/UIT (columnsAll) en vez de caer hasta `columnsManager`.
  const columnsLp = `${columnsAll},lp_abreviada_bienes_min,lp_abreviada_bienes_max,lp_abreviada_bienes_anio,aga_degree,aga_dni,aga_full_name,aga_position,aga_resolution_date,aga_resolution_number`;
  // Topes por cuantía: la tanda de columnas MÁS reciente. En su propio nivel de
  // fallback para que, si su SQL aún no se ha corrido, siga leyéndose el resto.
  const columnsTopes = `${columnsLp},tope_anio,tope_piso,tope_licitacion_concurso,tope_licitacion_obras,tope_comparacion_precios`;
  // Días estimados del cronograma: la tanda MÁS reciente, en su propio nivel de
  // fallback para que, si su SQL aún no se ha corrido, siga leyéndose el resto.
  const columnsCronograma = `${columnsTopes},cronograma_anio,cronograma_dias`;
  const yearFilter = `&year=eq.${year}`;
  const [entityRows, processRows] = await Promise.all([
    // SIN filtro de año, a diferencia de los tipos de proceso de más abajo.
    //
    // `entity_settings` es una fila ÚNICA (su clave primaria es `id`, y el id es
    // siempre 'default'): la identidad de la entidad —nombre, RUC, domicilio,
    // gerente— no cambia con el ejercicio fiscal. Lo que sí es anual son las
    // cifras del PIA/PAC, y esas ya llevan su propio `pac_anio`.
    //
    // Filtrar aquí por año era una pérdida de datos: al elegir un año sin fila,
    // PostgREST devuelve 0 resultados SIN error, así que la cadena de `.catch()`
    // no se disparaba y Municipalidad salía en blanco, como si no hubiera nada
    // configurado. Quien la rellenara sobrescribía la fila del año anterior,
    // porque el upsert va con `on_conflict=id` sobre esa misma fila única.
    supabaseRest<EntitySettingsRow[]>(
      `entity_settings?id=eq.default&select=${columnsCronograma}&limit=1`,
    ).catch(() =>
    supabaseRest<EntitySettingsRow[]>(
      `entity_settings?id=eq.default&select=${columnsTopes}&limit=1`,
    ).catch(() =>
    supabaseRest<EntitySettingsRow[]>(
      `entity_settings?id=eq.default&select=${columnsLp}&limit=1`,
    ).catch(() =>
      supabaseRest<EntitySettingsRow[]>(
        `entity_settings?id=eq.default&select=${columnsAll}&limit=1`,
      ).catch(() =>
        supabaseRest<EntitySettingsRow[]>(
          `entity_settings?id=eq.default&select=${columnsManager}&limit=1`,
        ).catch(() =>
          supabaseRest<EntitySettingsRow[]>(
            `entity_settings?id=eq.default&select=${columnsCore}&limit=1`,
          ).catch(() => []),
        ),
      ),
    ),
    ),
    ),
    // Solo tipos de proceso a nivel entidad (sin oficina).
    // Los tipos asignados a oficinas se gestionan en oficinas/[id]/procesos.
    supabaseRest<ProcessTypeRow[]>(
      `process_type_settings?select=code,label,description,active,category,object,legal_basis,frequent_municipality,sort_order,updated_at&metadata->>oficina_id=is.null${yearFilter}&order=sort_order.asc,label.asc`,
    ).catch(() => supabaseRest<ProcessTypeRow[]>(
      `process_type_settings?select=code,label,description,active,category,object,legal_basis,frequent_municipality,sort_order,updated_at${yearFilter}&order=sort_order.asc,label.asc`,
    ).catch(() => [])),
  ]);

  const entity = entityRows[0] ?? null;
  const processTypes = processRows.length > 0 ? processRows : defaultProcessTypes();

  return {
    entity: entity
      ? {
          address: entity.address ?? "",
          city: entity.city ?? "",
          department: entity.department ?? "",
          province: entity.province ?? "",
          executingUnit: entity.executing_unit ?? "",
          governmentLevel: entity.government_level ?? "",
          managerDegree: entity.manager_degree ?? "",
          managerDni: entity.manager_dni ?? "",
          managerFullName: entity.manager_full_name ?? "",
          // Sin inventar el cargo: si la base no lo tiene, el campo sale vacío y
          // lo escribe quien configura. Rellenarlo con "Gerente General" hacía
          // que el siguiente autoguardado lo persistiera como si lo hubieran
          // tecleado, y ese cargo acaba impreso en documentos que se firman.
          managerPosition: entity.manager_position ?? "",
          managerResolutionDate: entity.manager_resolution_date ?? "",
          managerResolutionNumber: entity.manager_resolution_number ?? "",
          agaDegree: entity.aga_degree ?? "",
          agaDni: entity.aga_dni ?? "",
          agaFullName: entity.aga_full_name ?? "",
          agaPosition: entity.aga_position ?? "",
          agaResolutionDate: entity.aga_resolution_date ?? "",
          agaResolutionNumber: entity.aga_resolution_number ?? "",
          name: entity.name ?? "",
          pacAnio: entity.pac_anio ? String(entity.pac_anio) : "",
          pacMontoBienesServicios: montoToText(entity.pac_monto_bienes_servicios),
          pacMontoObras: montoToText(entity.pac_monto_obras),
          pacMontoTotal: montoToText(entity.pac_monto_total),
          pacResolutionDate: entity.pac_resolucion_fecha ?? "",
          pacResolutionNumber: entity.pac_resolucion_numero ?? "",
          piaResolutionDate: entity.pia_resolucion_fecha ?? "",
          piaResolutionNumber: entity.pia_resolucion_numero ?? "",
          ruc: entity.ruc ?? "",
          uitAnio: entity.uit_anio ? String(entity.uit_anio) : "",
          uitValor: montoToText(entity.uit_valor),
          lpAbreviadaBienesAnio: entity.lp_abreviada_bienes_anio ? String(entity.lp_abreviada_bienes_anio) : "",
          lpAbreviadaBienesMin: montoToText(entity.lp_abreviada_bienes_min),
          lpAbreviadaBienesMax: montoToText(entity.lp_abreviada_bienes_max),
          topeAnio: entity.tope_anio ? String(entity.tope_anio) : "",
          topePiso: montoToText(entity.tope_piso),
          topeLicitacionConcurso: montoToText(entity.tope_licitacion_concurso),
          topeLicitacionObras: montoToText(entity.tope_licitacion_obras),
          topeComparacionPrecios: montoToText(entity.tope_comparacion_precios),
          cronogramaAnio: entity.cronograma_anio ? String(entity.cronograma_anio) : "",
          // El jsonb llega ya como objeto (PostgREST): se serializa para el form.
          cronogramaDias:
            entity.cronograma_dias && typeof entity.cronograma_dias === "object"
              ? JSON.stringify(entity.cronograma_dias)
              : "",
          updatedAt: entity.updated_at,
        }
      : { ...emptyEntity, updatedAt: null },
    governmentLevels: governmentLevelOptions,
    processTypes: processTypes.map((item) => ({
      active: item.active,
      category: item.category ?? "competitivo",
      code: item.code,
      description: item.description ?? "",
      frequentMunicipality: Boolean(item.frequent_municipality),
      label: item.label,
      legalBasis: item.legal_basis ?? "",
      object: item.object ?? "",
      sortOrder: item.sort_order,
      updatedAt: item.updated_at,
    })),
    roles,
    rolePermissions,
  };
}

// GET /api/configuracion/settings?year=2026
// Devuelve la configuracion institucional: entidad, niveles de gobierno,
// catalogo de procesos, roles y matriz de permisos (derivada de
// lib/permisos-contratacion).
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const year = getYearFromRequest(request);
    return NextResponse.json(await getSettings(year));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar configuracion" },
      { status: 500 },
    );
  }
}

// PUT /api/configuracion/settings
// Guarda la entidad y el catalogo de procesos. El cliente debe mandar TODOS
// los procesos: se hace upsert por code y se eliminan los codes que ya no
// esten en el payload (B1 fix).
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const year = getYearFromRequest(request);
  const payload = saveSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: payload.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const { entity, processTypes } = payload.data;
    // El catalogo de procesos ahora se gestiona por oficina
    // (oficinas/[id]/procesos), pero seguimos aceptandolo a nivel entidad
    // para compatibilidad.
    const entityRow: Record<string, unknown> = {
      address: entity.address,
      city: entity.city?.trim() || null,
      department: entity.department?.trim() || null,
      province: entity.province?.trim() || null,
      executing_unit: entity.executingUnit,
      government_level: entity.governmentLevel,
      id: "default",
      manager_degree: entity.managerDegree?.trim() || null,
      manager_dni: entity.managerDni?.trim() || null,
      manager_full_name: entity.managerFullName?.trim() || null,
      manager_position: entity.managerPosition?.trim() || null,
      manager_resolution_date: entity.managerResolutionDate?.trim() || null,
      manager_resolution_number: entity.managerResolutionNumber?.trim() || null,
      aga_degree: entity.agaDegree?.trim() || null,
      aga_dni: entity.agaDni?.trim() || null,
      aga_full_name: entity.agaFullName?.trim() || null,
      aga_position: entity.agaPosition?.trim() || null,
      aga_resolution_date: entity.agaResolutionDate?.trim() || null,
      aga_resolution_number: entity.agaResolutionNumber?.trim() || null,
      name: entity.name,
      pac_anio: entity.pacAnio?.trim() ? Number(entity.pacAnio) : null,
      pac_monto_bienes_servicios: parseMonto(entity.pacMontoBienesServicios),
      pac_monto_obras: parseMonto(entity.pacMontoObras),
      pac_monto_total: parseMonto(entity.pacMontoTotal),
      pac_resolucion_fecha: entity.pacResolutionDate?.trim() || null,
      pac_resolucion_numero: entity.pacResolutionNumber?.trim() || null,
      pia_resolucion_fecha: entity.piaResolutionDate?.trim() || null,
      pia_resolucion_numero: entity.piaResolutionNumber?.trim() || null,
      ruc: entity.ruc,
      uit_anio: entity.uitAnio?.trim() ? Number(entity.uitAnio) : null,
      uit_valor: parseMonto(entity.uitValor),
      lp_abreviada_bienes_anio: entity.lpAbreviadaBienesAnio?.trim() ? Number(entity.lpAbreviadaBienesAnio) : null,
      lp_abreviada_bienes_min: parseMonto(entity.lpAbreviadaBienesMin),
      lp_abreviada_bienes_max: parseMonto(entity.lpAbreviadaBienesMax),
      tope_anio: entity.topeAnio?.trim() ? Number(entity.topeAnio) : null,
      tope_piso: parseMonto(entity.topePiso),
      tope_licitacion_concurso: parseMonto(entity.topeLicitacionConcurso),
      tope_licitacion_obras: parseMonto(entity.topeLicitacionObras),
      tope_comparacion_precios: parseMonto(entity.topeComparacionPrecios),
      cronograma_anio: entity.cronogramaAnio?.trim() ? Number(entity.cronogramaAnio) : null,
      // Se saneam a un mapa completo por procedimiento antes de persistir (JSONB);
      // cadena vacía → null (el código completa con los defectos al leer).
      cronograma_dias: entity.cronogramaDias?.trim()
        ? parseDiasPorProcedimiento(entity.cronogramaDias)
        : null,
      // Sin `year`: la fila es única y describe a la entidad, no a un ejercicio.
      // Sellarla con el año del selector no la separaba por año —seguía siendo
      // la misma fila— y solo servía para que la lectura filtrada no la
      // encontrase. El ejercicio de las cifras del PIA/PAC va en `pac_anio`.
      updated_by: auth.user.id,
    };
    await upsertEntitySettings(entityRow);
    if (processTypes) {
      const ptRows = processTypes.map((item) => ({
        active: item.active,
        category: item.category,
        code: item.code,
        description: item.description || null,
        frequent_municipality: item.frequentMunicipality,
        label: item.label,
        legal_basis: item.legalBasis || null,
        object: item.object || null,
        sort_order: item.sortOrder,
        year,
        updated_by: auth.user.id,
      }));
      let ptHasYear = true;
      await supabaseRest("process_type_settings?on_conflict=code", {
        body: JSON.stringify(ptRows),
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        method: "POST",
      }).catch(async (err) => {
        const msg = err instanceof Error ? err.message : "";
        if (/\byear\b/i.test(msg)) {
          ptHasYear = false;
          const noYearRows = ptRows.map((r) => {
            const { year: _y, ...rest } = r;
            return rest;
          });
          await supabaseRest("process_type_settings?on_conflict=code", {
            body: JSON.stringify(noYearRows),
            headers: { Prefer: "resolution=merge-duplicates,return=representation" },
            method: "POST",
          });
          return;
        }
        throw err;
      });
      const incomingCodes = processTypes.map((item) => item.code).filter(Boolean);
      if (incomingCodes.length > 0) {
        const codesList = incomingCodes.map((code) => encodeURIComponent(code)).join(",");
        const deleteUrl = ptHasYear
          ? `process_type_settings?code=not.in.(${codesList})&year=eq.${year}&metadata->>oficina_id=is.null`
          : `process_type_settings?code=not.in.(${codesList})&metadata->>oficina_id=is.null`;
        await supabaseRest(deleteUrl, { method: "DELETE" }).catch(() => {});
      }
    }
    await writeAuditLog({
      action: "settings.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        entity: { governmentLevel: entity.governmentLevel, name: entity.name, ruc: entity.ruc },
        processTypeCount: processTypes?.length ?? 0,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityType: "settings",
      module: "configuracion",
    });
    return NextResponse.json({ saved: true, ...(await getSettings(year)) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar configuracion" },
      { status: 500 },
    );
  }
}
