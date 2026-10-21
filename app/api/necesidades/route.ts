import { NextRequest, NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { type Necesidad, necesidadCreateSchema } from "@/lib/necesidades";
import { columnasSelect, construirColumnas } from "@/lib/necesidad-columnas";
import { construirQueryNecesidades } from "@/lib/necesidades-query";
import { ordenPostgrest } from "@/lib/necesidad-lista";
import { estadosBandeja } from "@/lib/necesidades-bandeja";
import {
  ESTADOS_ACTIVOS,
  ESTADOS_ESPERA,
  fechaLimiteEstancada,
  fechaLimitePorVencer,
} from "@/lib/necesidades-portafolio";
import { supabaseRest, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lo que la tarjeta del listado necesita enseñar. Se amplía con los datos por
// los que además se filtra (meta, proceso) y con los que dicen de un vistazo si
// una necesidad está lista o parada: el monto, la fecha en que se necesita y si
// ya tiene expediente abierto.
const LIST_SELECT =
  "id,codigo,nombre,tipo_objeto,tipo_proceso_seleccion,area_usuaria,meta_presupuestal," +
  "monto_estimado,fecha_requerida,responsable,process_id,status,created_at,updated_at";

// Estados de la bandeja "lo que me toca": la regla vive en lib/necesidades-bandeja
// (compartida con el contador del menú), para que el filtro y el badge coincidan.
const estadosPendientesDe = estadosBandeja;

// ===== Portafolio (E2) =====
// Los estados y umbrales viven en lib/necesidades-portafolio: fuente única
// compartida con el CONTADOR del chip (facetas), para que la lista que sale al
// pulsarlo y el número del chip no puedan discrepar.

/** Filtros server-side de una vista de portafolio ("por_vencer" | "estancadas"). */
function filtrosDeVista(vista: string): { statusIn?: string[]; fechaRequeridaHasta?: string; updatedAntesDe?: string } {
  if (vista === "por_vencer") {
    return { statusIn: [...ESTADOS_ACTIVOS], fechaRequeridaHasta: fechaLimitePorVencer() };
  }
  if (vista === "estancadas") {
    return { statusIn: [...ESTADOS_ESPERA], updatedAntesDe: fechaLimiteEstancada().toISOString() };
  }
  return {};
}

// Lo que devuelve el POST tras crear: la necesidad ENTERA. Se deriva del
// esquema para no repetir el bug de la lista fija —una columna nueva que no se
// sumaba a mano y volvía vacía—; ver la nota en `necesidades/[id]/route.ts`.
const COLUMNAS_SISTEMA = [
  "id",
  "codigo",
  "status",
  "cmn_verificado",
  "no_objecion",
  "no_objecion_sustento",
  "no_objecion_mecanismo",
  "summary",
  "process_id",
  "owner_id",
  "created_at",
  "updated_at",
];
const FULL_SELECT = [...new Set([...columnasSelect(), ...COLUMNAS_SISTEMA])].join(",");

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const statusFilter = searchParams.get("status")?.trim() || "";
  const tipoObjetoFilter = searchParams.get("tipo_objeto")?.trim() || "";
  const tipoProcesoFilter = searchParams.get("tipo_proceso_seleccion")?.trim() || "";
  const metaFilter = searchParams.get("meta_presupuestal")?.trim() || "";
  const oficinaFilter = searchParams.get("area_usuaria")?.trim() || "";
  const responsableFilter = searchParams.get("responsable")?.trim() || "";
  // Bandeja "lo que me toca": filtra a los estados que esperan la acción del lado
  // del usuario (área usuaria o DEC). El servidor deriva los estados del rol, así
  // el cliente no decide qué le corresponde a cada quién.
  const soloMios = searchParams.get("mine") === "1";
  // Vista de portafolio (E2): "por_vencer" | "estancadas". Manda sobre `mine`.
  const vista = searchParams.get("vista")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;

  // La clave de orden llega del cliente; `ordenPostgrest` la traduce a un
  // fragmento seguro (clave desconocida → recientes), así nada del cliente se
  // interpola crudo en el `order=` de la consulta.
  const orden = ordenPostgrest(searchParams.get("orden"));

  const porVista = filtrosDeVista(vista);
  const query = construirQueryNecesidades({
    fechaRequeridaHasta: porVista.fechaRequeridaHasta,
    limit,
    meta: metaFilter,
    offset,
    orden,
    oficina: oficinaFilter,
    responsable: responsableFilter,
    search,
    select: LIST_SELECT,
    status: statusFilter,
    statusIn: porVista.statusIn ?? (soloMios ? estadosPendientesDe(auth.user.role) : undefined),
    tipoObjeto: tipoObjetoFilter,
    tipoProceso: tipoProcesoFilter,
    updatedAntesDe: porVista.updatedAntesDe,
  });

  try {
    const necesidades = await supabaseUserRest<Necesidad[]>(
      auth.user.accessToken,
      `necesidades?${query}`,
    );
    return NextResponse.json({ necesidades, page, limit, offset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron listar las necesidades", necesidades: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const payload = necesidadCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: payload.error.flatten() }, { status: 400 });
  }

  const data = payload.data;

  // Ubicación de la entidad (Configuración → Municipalidad): departamento,
  // provincia y distrito (= ciudad) se heredan a cada necesidad nueva, para que
  // el área usuaria solo registre el LUGAR DE ENTREGA concreto. Lectura de la
  // config global (no bloquea el alta si falla: los campos quedan como vengan).
  const [ent] = await supabaseRest<Array<{ department: string | null; province: string | null; city: string | null }>>(
    // Sin `order=year.desc`: `entity_settings` es una fila única (PK `id`).
    // Ordenar por año daba a entender que hay una por ejercicio y que aquí se
    // toma la más reciente; no hay tal cosa, y esa lectura era la única del
    // proyecto que lo insinuaba.
    `entity_settings?id=eq.default&select=department,province,city&limit=1`,
  ).catch((err) => {
    console.error("[necesidades] no se pudo heredar la geografía de la entidad:", err);
    return [];
  });

  try {
    const [necesidad] = await supabaseUserRest<Necesidad[]>(auth.user.accessToken, `necesidades?select=${FULL_SELECT}`, {
      // El insert se DERIVA del schema (misma razón que el PATCH): un campo
      // nuevo llega solo a su columna, sin lista manual que olvidar. Las tres
      // excepciones que no son 1:1 se ponen encima.
      body: JSON.stringify({
        ...construirColumnas(data),
        // area_usuaria cae al nombre de la entidad del usuario si no viene.
        area_usuaria: data.areaUsuaria || auth.user.entity || null,
        // Ubicación heredada de la entidad si no vino en el alta (distrito = ciudad).
        departamento: data.departamento || ent?.department || null,
        provincia: data.provincia || ent?.province || null,
        distrito: data.distrito || ent?.city || null,
        // Toda necesidad nace en "borrador"; el estado lo mueve la transición.
        status: "borrador",
        owner_id: auth.user.id,
      }),
      method: "POST",
    });

    await writeAuditLog({
      action: "necesidad.create",
      actorReference: auth.user.email ?? auth.user.id,
      details: { codigo: necesidad?.codigo, nombre: data.nombre, tipo: data.tipoObjeto },
      entityId: necesidad?.id,
      entityType: "necesidad",
    });

    // Vincular la fila de pedidos_siga con la necesidad recién creada.
    //
    // El pedido se persiste ÍNTEGRO al importarlo (import-pedido), antes de que
    // exista la necesidad; aquí se cierra la trazabilidad pedido → necesidad.
    // Solo se toca la fila aún sin vincular: si el mismo ítem ya alimentó otra
    // necesidad, no se le roba el vínculo. No bloquea el alta si falla — la
    // necesidad ya existe y el vínculo puede repararse reimportando.
    if (data.nroPedido && necesidad?.id) {
      const filtroSecuencia = data.pedidoSecuencia
        ? `&secuencia=eq.${encodeURIComponent(data.pedidoSecuencia)}`
        : "";
      await supabaseUserRest(
        auth.user.accessToken,
        `pedidos_siga?nro_pedido=eq.${encodeURIComponent(data.nroPedido)}${filtroSecuencia}&necesidad_id=is.null`,
        { body: JSON.stringify({ necesidad_id: necesidad.id }), method: "PATCH" },
      ).catch(() => undefined);
    }

    return NextResponse.json({ necesidad }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la necesidad" },
      { status: 500 },
    );
  }
}
