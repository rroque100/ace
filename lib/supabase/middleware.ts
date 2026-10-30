import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esOficinaAbastecimiento } from "@/lib/entity-utils";
import { accionAuditable, decidirAccesoExterno, ipDeSolicitud, leerCredencialExterna, moduloDeRuta } from "@/lib/modulos-acceso";
import { registrarEventoAcceso } from "@/lib/auditoria-externos";
import { usuarioDeCorreo } from "@/lib/usuario-credencial";

// Rutas accesibles sin sesion.
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    // Solicitud de acceso de una persona externa: todavía no tiene cuenta, así que no puede haber sesión. Solo recibe el
    // formulario (queda pendiente de aprobación; no crea ninguna cuenta), con sus propios límites en la ruta.
    pathname === "/acceso" ||
    pathname === "/api/acceso/solicitud" ||
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
export async function updateSession(request: NextRequest, waitUntil: (trabajo: Promise<unknown>) => void = (trabajo) => void trabajo) {
  // La IP y la ruta se las pasa el proxy al resto del servidor (auditoría y consumo de IA) en cabeceras propias. Se
  // ESCRIBEN aquí, encima de lo que mande el cliente: no se puede falsear la IP mandando `x-ace-ip`.
  const ip = ipDeSolicitud((nombre) => request.headers.get(nombre));
  const reenviar = new Headers(request.headers);
  reenviar.set("x-ace-ip", ip);
  reenviar.set("x-ace-ruta", request.nextUrl.pathname);
  reenviar.set("x-ace-metodo", request.method);
  const siguiente = () => NextResponse.next({ request: { headers: reenviar } });
  let supabaseResponse = siguiente();

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
        // Con cabeceras propias, la cookie refrescada no viaja sola: se copia la que acaba de quedar en la solicitud.
        reenviar.set("cookie", request.headers.get("cookie") ?? "");
        supabaseResponse = siguiente();
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

  // La identidad validada se pasa al resto del servidor en cabeceras propias (consumo de IA y cuota; ver lib/uso-ia.ts).
  // Se escriben SIEMPRE, también vacías, para que lo que mande el cliente con esos nombres nunca llegue más allá.
  const credencial = leerCredencialExterna(user?.app_metadata, Date.now());
  reenviar.set("x-ace-uid", user?.id ?? "");
  reenviar.set("x-ace-tipo", user ? (credencial.externo ? "externo" : "interno") : "");
  reenviar.set("x-ace-cuota", credencial.externo && credencial.cuotaIAMensual !== null ? String(credencial.cuotaIAMensual) : "");
  // La respuesta ya creada no ve cabeceras añadidas después: se rehace conservando las cookies que ya se hubieran refrescado.
  const previa = supabaseResponse;
  supabaseResponse = siguiente();
  for (const cookie of previa.cookies.getAll()) supabaseResponse.cookies.set(cookie);

  // Only this scheduler endpoint can authenticate with its existing server secret.
  // Invalid/missing secrets still hit the normal session guard; the route checks again.
  const trustedSyncCron = pathname === "/api/library/sync/cron" && request.method === "GET" &&
    Boolean(process.env.CRON_SECRET) && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!user && !isPublicPath(pathname) && !trustedSyncCron) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  // Cuentas EXTERNAS (asesores, alumnos): solo entran a los módulos que tienen habilitados y su actividad queda
  // registrada. Las credenciales salen del token (`app_metadata`), así que no cuesta una consulta a la base.
  // Cuando una cuenta externa no abre una ruta se rechaza AQUÍ, antes de que llegue a ninguna página o API: ocultar
  // enlaces no es seguridad (ver lib/modulos-acceso.ts).
  if (user) {
    if (credencial.externo) {
      const registrar = (accion: string, estado: number | null) =>
        waitUntil(registrarEventoAcceso({
          usuarioId: user.id,
          usuario: usuarioDeCorreo(user.email ?? "") ?? user.email ?? null,
          modulo: moduloDeRuta(pathname),
          accion,
          ruta: pathname,
          metodo: request.method,
          estado,
          ip,
          userAgent: request.headers.get("user-agent"),
        }));
      const decision = decidirAccesoExterno(credencial, pathname);
      if (decision.tipo === "denegar") {
        if (!decision.esperado) registrar(`acceso denegado (${decision.motivo}): ${pathname}`, 403);
        if (pathname.startsWith("/api/")) {
          const mensajes = {
            vencido: "Tu acceso ha vencido. Contacta con el administrador.",
            cambiar_password: "Antes de continuar, elige tu propia contraseña.",
            sin_modulos: "Tu cuenta no tiene acceso a esta función.",
            ruta: "Tu cuenta no tiene acceso a esta función.",
          } as const;
          return NextResponse.json(
            { error: mensajes[decision.motivo], ...(decision.motivo === "cambiar_password" ? { codigo: "cambiar_password" } : {}) },
            { status: 403 },
          );
        }
        return NextResponse.redirect(new URL(decision.destino, request.url));
      }
      // En una navegación dentro de la app el navegador pide la página con `RSC: 1`, no como documento: también es «ver».
      const esPrecarga = request.headers.get("next-router-prefetch") !== null || request.headers.get("purpose") === "prefetch";
      const esDocumento = (request.headers.get("accept") ?? "").includes("text/html") || request.headers.get("rsc") === "1";
      const accion = accionAuditable({ metodo: request.method, pathname, esDocumento, esPrecarga });
      if (accion) registrar(accion, null);
    }
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
