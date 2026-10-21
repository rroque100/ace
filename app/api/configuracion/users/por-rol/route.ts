import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { type AppRole, isAppRole } from "@/lib/permisos-contratacion";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/configuracion/users/por-rol?role=oficial_compra
//
// Lista MÍNIMA de usuarios de un rol, para que la designación de evaluadores
// (A6) proponga a los oficiales de compra registrados en Configuración sin que
// quien instruye el expediente tenga que teclear sus datos.
//
// Deliberadamente aparte de /api/configuracion/users, que exige admin y devuelve
// permisos, entidad y metadatos. Esto lo llama la DEC (expediente.manage), no un
// admin, así que solo entrega lo justo para nombrar a alguien: id, correo,
// nombre y oficina. Nada de permisos ni metadatos.
type ProfileRow = {
  id: string;
  email: string | null;
  nombre_completo?: string | null;
  dni?: string | null;
  cargo?: string | null;
  grado_academico?: string | null;
  oficina_id?: string | null;
};

type OficinaRow = { id: string; nombre: string | null };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function GET(request: Request) {
  // Instruir el expediente incluye designar evaluadores (Art. 54.2.e), así que
  // basta con poder gestionar expedientes; no hace falta ser admin.
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const rolPedido = new URL(request.url).searchParams.get("role") ?? "";
  if (!isAppRole(rolPedido)) {
    return NextResponse.json({ error: "Rol desconocido" }, { status: 400 });
  }
  const role: AppRole = rolPedido;

  try {
    const perfiles = await supabaseRest<ProfileRow[]>(
      `profiles?role=eq.${encodeURIComponent(role)}&select=id,email,nombre_completo,dni,cargo,grado_academico,oficina_id&order=email.asc`,
    ).catch(() =>
      // Fallback si las columnas nuevas aún no existen (SQL pendiente).
      supabaseRest<ProfileRow[]>(
        `profiles?role=eq.${encodeURIComponent(role)}&select=id,email&order=email.asc`,
      ).catch(() => []),
    );

    // Nombre de la oficina en una sola consulta, para no pedirlo por usuario.
    const oficinaIds = [...new Set(perfiles.map((p) => p.oficina_id).filter(Boolean))] as string[];
    const oficinas = oficinaIds.length
      ? await supabaseRest<OficinaRow[]>(
          `oficinas?id=in.(${oficinaIds.map((id) => `"${id}"`).join(",")})&select=id,nombre`,
        ).catch(() => [])
      : [];
    const nombreOficina = new Map(oficinas.map((o) => [o.id, o.nombre ?? null]));

    const usuarios = perfiles.map((p) => ({
      id: p.id,
      email: p.email ?? "",
      nombre: texto(p.nombre_completo), // null si Configuración no lo tiene: la UI lo avisa
      dni: texto(p.dni),
      cargo: texto(p.cargo),
      gradoAcademico: texto(p.grado_academico),
      oficina: p.oficina_id ? (nombreOficina.get(p.oficina_id) ?? null) : null,
    }));

    return NextResponse.json({ role, usuarios });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron listar los usuarios" },
      { status: 500 },
    );
  }
}
