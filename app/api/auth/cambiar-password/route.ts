import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { registrarEventoAcceso } from "@/lib/auditoria-externos";
import { inicioExterno } from "@/lib/modulos-acceso";
import { PASSWORD_MAXIMO, problemasPassword } from "@/lib/password-politica";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { usuarioDeCorreo } from "@/lib/usuario-credencial";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Una cuenta externa entra con la contraseña temporal que le dio el administrador y debe elegir la suya. Se guarda AQUÍ, en
// el servidor, porque quita el aviso `cambiar_password` de `app_metadata`, que la persona no puede escribir: si lo hiciera
// ella desde el navegador, bastaría con no llamarlo para saltarse el cambio.
//
// No usa `requireUser`: ese guard corta con un 429 a una cuenta externa con la cuota de IA agotada, y quien tiene cuota 0
// («sin IA») nunca podría elegir su contraseña.

const cuerpoSchema = z.object({ password: z.string().min(1, "Escribe la contraseña").max(PASSWORD_MAXIMO, "La contraseña es demasiado larga") });

/** ¿Esa contraseña ya es la actual? Si entra con ella, la «nueva» sería la temporal que conoce el administrador. */
async function esLaContrasenaActual(correo: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const cliente = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data } = await cliente.auth.signInWithPassword({ email: correo, password });
    return Boolean(data.session);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.esExterno) return NextResponse.json({ error: "Esta función es para cuentas externas." }, { status: 403 });
  if (user.externoVencido) return NextResponse.json({ error: "Tu acceso ha vencido. Contacta con el administrador." }, { status: 403 });

  const cuerpo = cuerpoSchema.safeParse(await request.json().catch(() => null));
  if (!cuerpo.success) return NextResponse.json({ error: cuerpo.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const { password } = cuerpo.data;

  const usuario = usuarioDeCorreo(user.email);
  const problemas = problemasPassword(password, usuario);
  if (problemas.length) return NextResponse.json({ error: `La contraseña no cumple: ${problemas.join("; ")}.`, problemas }, { status: 400 });
  if (user.email && await esLaContrasenaActual(user.email, password)) {
    return NextResponse.json({ error: "Elige una contraseña distinta de la temporal que te dieron." }, { status: 400 });
  }

  const supabase = await getSupabaseAdminClient();
  // Auth fusiona las claves de `app_metadata`: solo se apaga el aviso, el resto del acceso (módulos, vigencia, cuota) se conserva.
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password, app_metadata: { cambiar_password: false } });
  if (error) return NextResponse.json({ error: "No se pudo guardar la contraseña. Inténtalo de nuevo." }, { status: 500 });

  await registrarEventoAcceso({
    usuarioId: user.id,
    usuario: usuario ?? user.email,
    modulo: null,
    accion: "cambio de contraseña",
    ruta: "/cambiar-password",
    metodo: "POST",
    estado: 200,
    ip: request.headers.get("x-ace-ip") ?? "desconocida",
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true, destino: inicioExterno(user.modulosExternos) });
}
