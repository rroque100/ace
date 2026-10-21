import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { conGradoAcademico } from "@/lib/nombres";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  manager_degree: string | null;
  manager_full_name: string | null;
  manager_position: string | null;
  aga_degree: string | null;
  aga_full_name: string | null;
  aga_position: string | null;
  city: string | null;
};

// GET /api/configuracion/autoridad
//
// Gerente de la entidad, tal como está registrado en Configuración →
// Municipalidad, para encabezar los documentos que se le dirigen.
//
// ── Por qué no sale de `profiles` ─────────────────────────────────────────────
//
// El informe de aprobación buscaba al destinatario entre los perfiles con rol
// `aga`. En una municipalidad distrital el gerente municipal no suele tener
// cuenta en la aplicación —no la usa—, así que ese perfil no existe y la
// cabecera salía en blanco. El dato SÍ estaba registrado, en la ficha de la
// entidad, que es donde tiene sentido: es un cargo de la institución, no un
// usuario del sistema.
//
// ── Por qué con clave de servicio ─────────────────────────────────────────────
//
// `entity_settings` solo lo ve un admin por RLS, pero quien redacta el informe
// es la DEC. Se sigue el mismo criterio que `parametros-segmentacion`: se
// devuelven CUATRO campos —grado, nombre, cargo y ciudad—, que son los que van
// impresos en la cabecera de documentos que estos mismos usuarios exportan y
// firman, y no el resto de la configuración institucional.
//
// El DNI y la resolución de designación quedan fuera a propósito: no se
// imprimen en la cabecera y no hay razón para exponerlos.
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const filas = await supabaseRest<Row[]>(
    "entity_settings?id=eq.default&select=manager_degree,manager_full_name,manager_position," +
      "aga_degree,aga_full_name,aga_position,city&limit=1",
  ).catch(() => []);

  const fila = filas[0];
  const nombre = (fila?.manager_full_name ?? "").trim();
  const agaNombre = (fila?.aga_full_name ?? "").trim();

  return NextResponse.json({
    ciudad: (fila?.city ?? "").trim(),
    // Grado y nombre ya compuestos ("ING. WELLINTONG LOPEZ PILLCO"): quien lo
    // consume lo pinta tal cual y no tiene que conocer la convención.
    nombre: nombre ? conGradoAcademico(fila?.manager_degree, nombre) : "",
    cargo: (fila?.manager_position ?? "").trim(),
    // AGA (Configuración → Municipalidad): es el ATENCIÓN del informe de A8.
    // Se guarda aparte porque no siempre coincide con el gerente (Art. 25.2).
    aga: {
      nombre: agaNombre ? conGradoAcademico(fila?.aga_degree, agaNombre) : "",
      cargo: (fila?.aga_position ?? "").trim(),
    },
  });
}
