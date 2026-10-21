import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  ESTADOS_ACTIVOS,
  ESTADOS_ESPERA,
  fechaLimiteEstancada,
  fechaLimitePorVencer,
} from "@/lib/necesidades-portafolio";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tope de filas que se leen para construir los desplegables. */
const MAX_FILAS = 2000;

type Fila = {
  meta_presupuestal: string | null;
  area_usuaria: string | null;
  responsable: string | null;
  status: string | null;
  fecha_requerida: string | null;
  updated_at: string | null;
};

// Portafolio (E2): las listas de estados y los umbrales son fuente única
// (lib/necesidades-portafolio), los mismos que usa el listado. Aquí solo se
// envuelven en Set para el `.has()` del conteo.
const ESPERA = new Set(ESTADOS_ESPERA);
const ACTIVOS = new Set(ESTADOS_ACTIVOS);

// GET /api/necesidades/facetas
//
// Valores que existen DE VERDAD en las necesidades, para llenar los filtros de
// meta presupuestal y área usuaria.
//
// Por qué no se sacan de las necesidades ya cargadas en pantalla: el listado va
// paginado de veinte en veinte, así que el desplegable solo ofrecería las metas
// de la primera página y filtrar por una meta de la página tres sería imposible.
//
// Y por qué no un `select distinct`: PostgREST no lo expone. Se leen las filas
// (solo dos columnas) y se agrupan aquí. Con el tope de MAX_FILAS es una lectura
// acotada; si una entidad lo superara, el desplegable se quedaría corto pero la
// búsqueda por texto sigue alcanzando cualquier necesidad, así que no se pierde
// acceso a nada.
//
// Va con `supabaseUserRest` —no con la clave de servicio— para que las opciones
// respeten el scope del usuario: ofrecer una meta cuyas necesidades no puede ver
// produciría un filtro que siempre devuelve cero.
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const filas = await supabaseUserRest<Fila[]>(
      auth.user.accessToken,
      `necesidades?select=meta_presupuestal,area_usuaria,responsable,status,fecha_requerida,updated_at&order=created_at.desc&limit=${MAX_FILAS}`,
    );

    const limitePorVencer = fechaLimitePorVencer();
    const limiteEstancada = fechaLimiteEstancada().getTime();

    const metas = new Map<string, number>();
    const areas = new Map<string, number>();
    const responsables = new Map<string, number>();
    // Conteo por estado para el tablero de la cola (dashboard del listado).
    const estados = new Map<string, number>();
    let porVencer = 0;
    let estancadas = 0;
    for (const fila of filas) {
      const meta = (fila.meta_presupuestal ?? "").trim();
      if (meta) metas.set(meta, (metas.get(meta) ?? 0) + 1);
      const area = (fila.area_usuaria ?? "").trim();
      if (area) areas.set(area, (areas.get(area) ?? 0) + 1);
      const responsable = (fila.responsable ?? "").trim();
      if (responsable) responsables.set(responsable, (responsables.get(responsable) ?? 0) + 1);
      const estado = (fila.status ?? "").trim() || "borrador";
      estados.set(estado, (estados.get(estado) ?? 0) + 1);
      // Portafolio: por vencer (fecha requerida próxima/pasada, aún en trámite) y
      // estancadas (en espera de acción y sin cambio desde hace días).
      const fr = (fila.fecha_requerida ?? "").slice(0, 10);
      if (ACTIVOS.has(estado) && fr && fr <= limitePorVencer) porVencer += 1;
      const upd = fila.updated_at ? Date.parse(fila.updated_at) : NaN;
      if (ESPERA.has(estado) && Number.isFinite(upd) && upd < limiteEstancada) estancadas += 1;
    }

    // Alfabético y no por frecuencia: en una lista que se recorre con la vista,
    // buscar "Meta 0043" es más fácil que adivinar dónde cayó por uso.
    const ordenar = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([valor, total]) => ({ valor, total }))
        .sort((a, b) => a.valor.localeCompare(b.valor, "es"));

    return NextResponse.json({
      metas: ordenar(metas),
      areas: ordenar(areas),
      responsables: ordenar(responsables),
      // Objeto estado→conteo (no ordenado: el orden lo pone el catálogo del flujo).
      estados: Object.fromEntries(estados),
      // Portafolio (E2): conteos para los chips de vista rápida.
      portafolio: { porVencer, estancadas },
      truncado: filas.length >= MAX_FILAS,
    });
  } catch {
    // Sin facetas los desplegables salen vacíos, pero el listado y la búsqueda
    // siguen funcionando: no se convierte en un error de página.
    return NextResponse.json({ metas: [], areas: [], responsables: [], estados: {}, portafolio: { porVencer: 0, estancadas: 0 }, truncado: false });
  }
}
