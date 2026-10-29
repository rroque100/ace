import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { registrarEventoAcceso } from "@/lib/auditoria-externos";
import { usuarioDeCorreo } from "@/lib/usuario-credencial";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  // Antes de cerrar la sesión: después ya no se sabe quién era. Solo se anota a las cuentas externas.
  const user = await getSessionUser();
  if (user?.esExterno) {
    await registrarEventoAcceso({
      usuarioId: user.id,
      usuario: usuarioDeCorreo(user.email) ?? user.email,
      modulo: null,
      accion: "logout",
      ruta: "/auth/signout",
      metodo: "POST",
      estado: 303,
      ip: request.headers.get("x-ace-ip") ?? "desconocida",
      userAgent: request.headers.get("user-agent"),
    });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 fuerza GET en la redireccion tras el POST del formulario de salida.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
