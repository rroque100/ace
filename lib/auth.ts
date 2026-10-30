import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  entitiesMatch,
  esOficinaAbastecimiento,
  normalizeEntity,
} from "@/lib/entity-utils";
import { esIdSeguro } from "@/lib/supabase-server";
import {
  leerCredencialExterna,
  type ModuloExterno,
} from "@/lib/modulos-acceso";
import { CuotaIAAgotadaError, exigirCuotaIA } from "@/lib/uso-ia";
import {
  type AppRole,
  type Capability,
  capabilitiesForRole,
  isAppRole,
  roleHasCapability,
} from "@/lib/permisos-contratacion";

// Roles y capacidades de los actores de la Ley 32069 viven en
// lib/permisos-contratacion.ts (fuente unica). Aqui solo se resuelve la sesion.
export type { AppRole, Capability } from "@/lib/permisos-contratacion";

export type AppPermission = {
  area: string;
  scope: string;
};

export type SessionUser = {
  accessToken: string;
  email: string | null;
  /**
   * Nombre registrado en el perfil, para saludar a una persona y no a un DNI.
   *
   * Puede venir vacío: el nombre es opcional al dar de alta, y las cuentas de
   * rol del seed no tienen ninguno.
   */
  nombreCompleto: string | null;
  /**
   * Cargo del perfil (p. ej. "Jefe de la Oficina de Abastecimiento"). Va bajo el
   * nombre en los documentos que se firman —el Anexo N° 1 identifica al firmante
   * por nombre y cargo, no por su correo—. Puede venir vacío como el nombre.
   */
  cargo: string | null;
  entity: string | null;
  id: string;
  isAdmin: boolean;
  // dec o admin: gestiona el corpus y los expedientes (crear/evaluar/generar)
  isDec: boolean;
  // alias de isDec por compatibilidad con el codigo de gestion de corpus
  isEditor: boolean;
  // legal o admin: revisa informes legales / nulidades
  isLegal: boolean;
  // Acciones del expediente habilitadas para el rol (permisos por accion).
  capabilities: Capability[];
  permissions: AppPermission[];
  role: AppRole;
  // Oficina emisora asignada al usuario (para numeracion y scope de expedientes).
  oficinaId?: string | null;
  // Jefe de oficina: ve/administra TODO lo de su oficina (no solo lo propio).
  esJefe: boolean;
  // Cuenta EXTERNA (asesor, alumno): solo entra a los módulos habilitados (ver lib/modulos-acceso.ts). Sale del
  // `app_metadata` del token, que la persona no puede modificar.
  esExterno: boolean;
  modulosExternos: ModuloExterno[];
  // Cuenta externa cuyo acceso ya venció (fecha de fin pasada o ilegible).
  externoVencido: boolean;
  // Tokens de IA permitidos al mes a una cuenta externa; null = sin tope.
  cuotaIAMensual: number | null;
};

function normalizeRole(raw: string | null | undefined): AppRole {
  // Remapeo de valores historicos a la nomenclatura vigente.
  if (raw === "editor") return "dec";
  if (raw === "user") return "consulta";
  if (isAppRole(raw)) return raw;
  return "consulta";
}

function parsePermissions(metadata: unknown): AppPermission[] {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const permissions = (metadata as { permissions?: unknown }).permissions;
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions
    .map((item) => {
      if (typeof item === "string") {
        return { area: item, scope: "" };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as { area?: unknown; scope?: unknown };
      return typeof record.area === "string"
        ? {
            area: record.area,
            scope: typeof record.scope === "string" ? record.scope : "",
          }
        : null;
    })
    .filter((item): item is AppPermission => Boolean(item));
}

// Lee el usuario autenticado, su rol (profiles) y su access token. Devuelve
// null si no hay sesion. Usar en server components y rutas API.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: sessionData }, profileResult] = await Promise.all([
    supabase.auth.getSession(),
    supabase
      .from("profiles")
      .select(
        "role, entity, metadata, oficina_id, es_jefe, nombre_completo, cargo",
      )
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // Fallbacks si las columnas nuevas aun no existen (SQL pendiente): primero sin
  // `es_jefe`, luego solo `role` para no degradar a todos a rol consulta.
  type ProfileData = {
    role?: string;
    entity?: string | null;
    metadata?: unknown;
    oficina_id?: string | null;
    es_jefe?: boolean | null;
    nombre_completo?: string | null;
    cargo?: string | null;
  };
  let profile = profileResult.data as ProfileData | null;
  if (!profile && profileResult.error) {
    const retry = await supabase
      .from("profiles")
      .select("role, entity, metadata, oficina_id")
      .eq("id", user.id)
      .maybeSingle();
    profile = retry.data as ProfileData | null;
    if (!profile && retry.error) {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      profile = data as ProfileData | null;
    }
  }

  const role = normalizeRole(profile?.role);
  // Una cuenta externa nunca es administradora, aunque su perfil dijera otra cosa: el acceso externo es más estrecho que cualquier rol.
  const credencialExterna = leerCredencialExterna(
    user.app_metadata,
    Date.now(),
  );
  const isAdmin = role === "admin" && !credencialExterna.externo;

  return {
    accessToken: sessionData.session?.access_token ?? "",
    email: user.email ?? null,
    nombreCompleto: (profile?.nombre_completo as string | null) ?? null,
    cargo: (profile?.cargo as string | null) ?? null,
    entity: (profile?.entity as string | null) ?? null,
    id: user.id,
    isAdmin,
    isDec: role === "dec" || isAdmin,
    isEditor: role === "dec" || isAdmin,
    isLegal: role === "legal" || isAdmin,
    capabilities: capabilitiesForRole(role),
    permissions: parsePermissions(profile?.metadata),
    role,
    oficinaId: profile?.oficina_id ?? null,
    esJefe: Boolean(profile?.es_jefe),
    esExterno: credencialExterna.externo,
    modulosExternos: credencialExterna.modulos,
    externoVencido: credencialExterna.vencido,
    cuotaIAMensual: credencialExterna.externo
      ? credencialExterna.cuotaIAMensual
      : null,
  };
}

/**
 * Valida que los identificadores que vienen del CLIENTE (segmentos de la ruta
 * `[id]`/`[docId]`, o ids en query/body) sean UUID antes de interpolarlos en un
 * filtro PostgREST. Un id pegado tal cual en `?id=eq.${id}` permite colar `&` y
 * añadir filtros propios —un PATCH o un DELETE de una fila se vuelve masivo, y
 * bajo service_role eso salta la RLS—. Se valida la FORMA (un UUID no tiene
 * caracteres especiales) y se rechaza antes de tocar la base.
 *
 * Devuelve un 400 listo para `return`, o `null` si todos son válidos:
 *   const malos = idsDeRutaInvalidos(id, docId);
 *   if (malos) return malos;
 *
 * NO lo uses con ids que salen de la propia base (p. ej. `doc.id` de una fila ya
 * leída): esos no son de forma controlable por el cliente.
 */
export function idsDeRutaInvalidos(...ids: unknown[]): NextResponse | null {
  return ids.every((valor) => esIdSeguro(valor))
    ? null
    : NextResponse.json(
        { error: "Identificador de ruta inválido." },
        { status: 400 },
      );
}

type AuthResult = { user: SessionUser } | { error: NextResponse };

// Exige sesion valida; devuelve 401 si no hay usuario.
export async function requireUser(
  options: { usesAI?: boolean } = {},
): Promise<AuthResult> {
  const user = await getSessionUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  // Una cuenta externa con la cuota mensual de IA agotada puede seguir leyendo (su historial, las normas), pero no lanzar
  // nada que escriba —preguntar al chat, grabar voz—, que es lo que gasta IA. La barrera de fondo está en el cliente de
  // modelos (lib/openai-server.ts); esto da un 429 claro en vez de una respuesta degradada.
  if (
    options.usesAI !== false &&
    user.esExterno &&
    user.cuotaIAMensual !== null
  ) {
    const metodo = (
      (await headers().catch(() => null))?.get("x-ace-metodo") ?? "GET"
    ).toUpperCase();
    if (metodo !== "GET" && metodo !== "HEAD" && metodo !== "OPTIONS") {
      try {
        await exigirCuotaIA();
      } catch (error) {
        if (error instanceof CuotaIAAgotadaError) {
          return {
            error: NextResponse.json(
              { error: error.message, codigo: "cuota_ia_agotada" },
              { status: 429 },
            ),
          };
        }
        throw error;
      }
    }
  }

  return { user };
}

// Exige rol admin; devuelve 401 sin sesion o 403 si no es admin.
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireUser();

  if ("error" in result) {
    return result;
  }

  if (!result.user.isAdmin) {
    return {
      error: NextResponse.json(
        { error: "Requiere rol de administrador" },
        { status: 403 },
      ),
    };
  }

  return result;
}

// Exige rol DEC o admin (gestion del corpus y expedientes); 403 en otro caso.
export async function requireDec(): Promise<AuthResult> {
  const result = await requireUser();

  if ("error" in result) {
    return result;
  }

  if (!result.user.isDec) {
    return {
      error: NextResponse.json(
        { error: "Requiere rol DEC o administrador" },
        { status: 403 },
      ),
    };
  }

  return result;
}

// Alias historico de requireDec (rutas de gestion de corpus ya existentes).
export const requireEditor = requireDec;

// Exige rol DEC, admin o area_usuaria; 403 en otro caso. Solo para
// /api/expedientes-archivo/**: ahi el area usuaria tambien administra (sube,
// reindexa, elimina, edita en lote y responde sus propios expedientes
// archivados), a diferencia del resto de rutas de gestion de corpus que
// siguen exigiendo requireDec puro.
export async function requireDecOrAreaUsuaria(): Promise<AuthResult> {
  const result = await requireUser();

  if ("error" in result) {
    return result;
  }

  if (!result.user.isDec && result.user.role !== "area_usuaria") {
    return {
      error: NextResponse.json(
        { error: "Requiere rol DEC, administrador o área usuaria" },
        { status: 403 },
      ),
    };
  }

  return result;
}

// Exige rol Legal o admin (revision de informes legales).
export async function requireLegal(): Promise<AuthResult> {
  const result = await requireUser();

  if ("error" in result) {
    return result;
  }

  if (!result.user.isLegal) {
    return {
      error: NextResponse.json(
        { error: "Requiere rol Legal o administrador" },
        { status: 403 },
      ),
    };
  }

  return result;
}

// Devuelve la entity normalizada del usuario para filtrar por oficina,
// o null si es admin (ve todo).
export function getOfficeFilter(user: SessionUser): string | null {
  if (user.isAdmin) return null;
  return normalizeEntity(user.entity) || null;
}

// Expedientes y Contratos (menú "Procesos") son exclusivos de la oficina de
// Abastecimiento (la DEC): el resto de oficinas no gestiona procedimientos de
// contratación. Necesidades queda FUERA a propósito: la crea y gestiona el
// área usuaria que pide algo, de cualquier oficina. Admin ve todo, igual que
// el resto del scope por oficina (getOfficeFilter, getArchivoScopeLevel).
//
// `user.entity` es la municipalidad entera, no la oficina del usuario dentro
// de ella — revisar solo `entity` deja fuera a un DEC cuya entidad no dice
// "abastecimiento" aunque su OFICINA sí lo sea. `oficinaNombre` (resuelto por
// el caller desde `user.oficinaId`, ver AppShell) es opcional para no romper
// el resto de llamadas existentes, pero SIEMPRE debe pasarse cuando se tenga
// a mano (mismo criterio ya reforzado en lib/supabase/middleware.ts, el gate
// real de estas rutas).
export function puedeUsarProcesos(
  user: SessionUser,
  oficinaNombre?: string | null,
): boolean {
  return (
    user.isAdmin ||
    esOficinaAbastecimiento(user.entity) ||
    esOficinaAbastecimiento(oficinaNombre)
  );
}

// ── Scope del archivo de expedientes (buscar / subir / responder) ───────────
// Modelo jerarquico: admin ve todo; jefe de oficina ve/administra lo de su
// oficina; el resto SOLO lo que subio o creo (uploaded_by / created_by).
export type ArchivoScopeLevel = "all" | "oficina" | "own";

export function getArchivoScopeLevel(user: SessionUser): ArchivoScopeLevel {
  if (user.isAdmin) return "all";
  // Jefe sin oficina asignada degrada a "own" para no abrir acceso por error.
  if (user.esJefe && (normalizeEntity(user.entity) || user.oficinaId))
    return "oficina";
  return "own";
}

// Autoriza una fila del archivo (expediente o respuesta) segun el scope del
// usuario. `owner` es uploaded_by/created_by; `oficinaId` es la FK resuelta y
// `oficina` el texto (respaldo). Cuando el perfil del jefe y la fila tienen
// oficina_id, se compara por id (mismo criterio que las políticas RLS); si no,
// se cae al match normalizado por texto.
export function canAccessArchivoRow(
  user: SessionUser,
  row: {
    oficina?: string | null;
    oficinaId?: string | null;
    owner?: string | null;
  },
): boolean {
  const level = getArchivoScopeLevel(user);
  if (level === "all") return true;
  if (level === "oficina") {
    if (user.oficinaId && row.oficinaId)
      return row.oficinaId === user.oficinaId;
    return entitiesMatch(row.oficina, user.entity);
  }
  return Boolean(row.owner) && row.owner === user.id;
}

// Exige una capacidad concreta del expediente (permisos por accion segun rol).
export async function requireCapability(
  capability: Capability,
): Promise<AuthResult> {
  const result = await requireUser();

  if ("error" in result) {
    return result;
  }

  if (!roleHasCapability(result.user.role, capability)) {
    return {
      error: NextResponse.json(
        { error: "Tu rol no tiene permiso para esta acción del expediente" },
        { status: 403 },
      ),
    };
  }

  return result;
}
