import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esOficinaAbastecimiento } from "@/lib/entity-utils";

// Rutas accesibles sin sesion.
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/integrations/health")
  );
}

// Expedientes y Contratos (menú "Procesos") son exclusivos de la oficina de
// Abastecimiento (ver lib/auth.ts `puedeUsarProcesos`). Se bloquean aquí, en
// el único punto por el que pasan TODAS sus páginas y rutas /api, en vez de en
// cada route.ts: ocultar el enlace del menú no es seguridad real si la ruta
// sigue abierta a quien escriba la URL a mano.
//
// Necesidades queda FUERA a propósito: la crea y gestiona el área usuaria que
// pide algo (cualquier oficina), no solo Abastecimiento.
//
// OJO: "/expedientes-archivo" (Biblioteca de expedientes / Archivo documental)
// es una función DISTINTA —no vive bajo el menú "Procesos"— y por eso queda
// excluida explícitamente pese a compartir el prefijo "/expedientes".
const PREFIJOS_PROCESOS = ["/expedientes", "/contratos", "/api/processes", "/api/contracts", "/api/contratos-cp", "/api/contratos-sie"];

function esRutaDeProcesos(pathname: string): boolean {
  if (pathname === "/expedientes-archivo" || pathname.startsWith("/expedientes-archivo/")) return false;
  if (pathname === "/api/expedientes-archivo" || pathname.startsWith("/api/expedientes-archivo/")) return false;
  return PREFIJOS_PROCESOS.some((prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`));
}

// Refresca la sesion (cookies) en cada request y bloquea el acceso sin sesion:
// redirige paginas a /login y responde 401 en rutas /api.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  // Consulta el perfil solo cuando hace falta (rutas de Procesos): es una
  // vuelta extra a la base en cada request que matchee, así que se evita para
  // el resto de la app.
  if (user && esRutaDeProcesos(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, entity, oficina_id")
      .eq("id", user.id)
      .maybeSingle();
    const esAdmin = profile?.role === "admin";
    // `entity` es la municipalidad entera, no la oficina del usuario dentro de
    // ella (esa vive en `oficina_id` → expedientes_oficinas.nombre) — revisar
    // solo `entity` bloqueaba a DEC de oficinas cuyo nombre de entidad no dice
    // "abastecimiento" aunque su OFICINA sí lo sea (ver el mismo bug ya
    // corregido en app/expedientes-archivo/page.tsx). Se comprueban ambos.
    let oficinaNombre: string | null = null;
    if (profile?.oficina_id) {
      const { data: oficina } = await supabase
        .from("expedientes_oficinas")
        .select("nombre")
        .eq("id", profile.oficina_id)
        .maybeSingle();
      oficinaNombre = (oficina?.nombre as string | null | undefined) ?? null;
    }
    const autorizado =
      esAdmin ||
      esOficinaAbastecimiento(profile?.entity as string | null | undefined) ||
      esOficinaAbastecimiento(oficinaNombre);

    if (!autorizado) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Esta función es exclusiva de la oficina de Abastecimiento." },
          { status: 403 },
        );
      }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
