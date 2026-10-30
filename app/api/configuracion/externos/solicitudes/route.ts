import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { esFaltaSql, SQL_SOLICITUDES_PENDIENTE } from "@/lib/externos-cuenta";
import { codigoDeSolicitud, ESTADOS_SOLICITUD, type EstadoSolicitud } from "@/lib/solicitud-acceso";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Bandeja de solicitudes de acceso (las envía la gente desde el formulario público /acceso). Solo la ve el administrador.

type Fila = {
  id: string;
  creado_en: string;
  nombre: string;
  dni: string;
  correo: string;
  celular: string | null;
  institucion: string | null;
  modulos: string[] | null;
  motivo: string;
  estado: EstadoSolicitud;
  resuelta_en: string | null;
  motivo_rechazo: string | null;
  ip: string | null;
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const pedido = new URL(request.url).searchParams.get("estado") ?? "pendiente";
  const filtro = (ESTADOS_SOLICITUD as readonly string[]).includes(pedido) ? `&estado=eq.${pedido}` : "";
  try {
    const [filas, pendientes] = await Promise.all([
      supabaseRest<Fila[]>(`solicitudes_acceso?select=id,creado_en,nombre,dni,correo,celular,institucion,modulos,motivo,estado,resuelta_en,motivo_rechazo,ip${filtro}&order=creado_en.desc&limit=200`),
      supabaseRest<Array<{ id: string }>>("solicitudes_acceso?estado=eq.pendiente&select=id&limit=1000"),
    ]);
    return NextResponse.json({
      sqlPendiente: false,
      pendientes: pendientes.length,
      solicitudes: filas.map((fila) => ({
        id: fila.id,
        codigo: codigoDeSolicitud(fila.id),
        creadoEn: fila.creado_en,
        nombre: fila.nombre,
        dni: fila.dni,
        correo: fila.correo,
        celular: fila.celular,
        institucion: fila.institucion,
        modulos: fila.modulos ?? [],
        motivo: fila.motivo,
        estado: fila.estado,
        resueltaEn: fila.resuelta_en,
        motivoRechazo: fila.motivo_rechazo,
        ip: fila.ip,
      })),
    });
  } catch (error) {
    if (esFaltaSql(error)) return NextResponse.json({ sqlPendiente: true, aviso: SQL_SOLICITUDES_PENDIENTE, pendientes: 0, solicitudes: [] });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron leer las solicitudes" }, { status: 500 });
  }
}
