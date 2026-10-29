import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { registrarEventoAcceso } from "@/lib/auditoria-externos";
import { usuarioDeCorreo } from "@/lib/usuario-credencial";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// El inicio de sesión se hace en el navegador, directo contra Supabase Auth: el servidor no lo ve y no puede anotar desde
// qué IP entró nadie. El formulario de login llama aquí justo después de entrar. Solo registra a las cuentas EXTERNAS (la
// auditoría de IP es para ellas) y siempre contesta 204: no debe delatar ni frenar nada.
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.esExterno) {
    await registrarEventoAcceso({
      usuarioId: user.id,
      usuario: usuarioDeCorreo(user.email) ?? user.email,
      modulo: null,
      accion: "login",
      ruta: "/login",
      metodo: "POST",
      estado: 204,
      // La IP la fijó el proxy sobre la solicitud real; no se toma de nada que mande el cliente.
      ip: request.headers.get("x-ace-ip") ?? "desconocida",
      userAgent: request.headers.get("user-agent"),
    });
  }
  return new NextResponse(null, { status: 204 });
}
