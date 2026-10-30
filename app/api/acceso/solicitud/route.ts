import { NextResponse } from "next/server";
import { esFaltaSql } from "@/lib/externos-cuenta";
import { ipDeSolicitud } from "@/lib/modulos-acceso";
import { codigoDeSolicitud, decidirSolicitud, LIMITES_SOLICITUD, solicitudSchema } from "@/lib/solicitud-acceso";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// RUTA PÚBLICA (sin sesión; ver isPublicPath en lib/supabase/middleware.ts). Solo escribe una fila «pendiente»: no crea
// ninguna cuenta ni concede nada. Lo que sí hay que impedir es que sirva para llenar la base o para hostigar al
// administrador, de ahí los límites. Escribe con la clave de servicio porque quien llama no tiene sesión: es una acción del
// sistema, y por eso la tabla no tiene políticas de RLS.

const TAMANO_MAXIMO = 8_000;

/** Misma forma de respuesta para lo que se guarda y para lo que se descarta, de modo que un bot no distingue uno de otro. */
const codigoAleatorio = () => codigoDeSolicitud(crypto.randomUUID());

const NO_DISPONIBLE = "Las solicitudes de acceso no están disponibles por ahora. Contacta con el administrador de tu entidad.";

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Formato no admitido." }, { status: 415 });
  }
  const texto = await request.text();
  if (texto.length > TAMANO_MAXIMO) return NextResponse.json({ error: "La solicitud es demasiado grande." }, { status: 413 });
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return NextResponse.json({ error: "No se pudo leer la solicitud." }, { status: 400 });
  }
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return NextResponse.json({ error: "No se pudo leer la solicitud." }, { status: 400 });
  const senales = crudo as Record<string, unknown>;

  const validada = solicitudSchema.safeParse(crudo);
  if (!validada.success) {
    const problema = validada.error.issues[0];
    return NextResponse.json({ error: problema?.message ?? "Revisa los datos del formulario.", campo: String(problema?.path[0] ?? "") }, { status: 400 });
  }
  const datos = validada.data;

  const ip = ipDeSolicitud((nombre) => request.headers.get(nombre));
  const haceUnaHora = new Date(Date.now() - 3_600_000).toISOString();

  let decision;
  try {
    const [mismoDni, desdeEstaIp, pendientes] = await Promise.all([
      supabaseRest<Array<{ id: string }>>(`solicitudes_acceso?dni=eq.${datos.dni}&estado=eq.pendiente&select=id&limit=1`),
      ip === "desconocida"
        ? Promise.resolve([] as Array<{ id: string }>)
        : supabaseRest<Array<{ id: string }>>(`solicitudes_acceso?ip=eq.${encodeURIComponent(ip)}&creado_en=gte.${encodeURIComponent(haceUnaHora)}&select=id&limit=${LIMITES_SOLICITUD.porIpPorHora}`),
      supabaseRest<Array<{ id: string }>>(`solicitudes_acceso?estado=eq.pendiente&select=id&limit=${LIMITES_SOLICITUD.pendientesTotales}`),
    ]);
    decision = decidirSolicitud({
      senales: { sitioWeb: senales.sitioWeb, tardoMs: senales.tardoMs },
      pendientesMismoDni: mismoDni.length,
      solicitudesIpUltimaHora: desdeEstaIp.length,
      ipConocida: ip !== "desconocida",
      pendientesTotales: pendientes.length,
    });
  } catch (error) {
    if (!esFaltaSql(error)) console.error("[acceso] no se pudo consultar las solicitudes", error);
    return NextResponse.json({ error: NO_DISPONIBLE }, { status: 503 });
  }

  if (decision.tipo === "descartar") return NextResponse.json({ ok: true, codigo: codigoAleatorio() }, { status: 201 });
  if (decision.tipo === "rechazar") return NextResponse.json({ error: decision.mensaje }, { status: decision.estado });

  try {
    const [fila] = await supabaseRest<Array<{ id: string }>>("solicitudes_acceso", {
      method: "POST",
      body: JSON.stringify({
        nombre: datos.nombre,
        dni: datos.dni,
        correo: datos.correo,
        celular: datos.celular || null,
        institucion: datos.institucion || null,
        modulos: datos.modulos,
        motivo: datos.motivo,
        ip,
        user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300) || null,
      }),
    });
    return NextResponse.json({ ok: true, codigo: fila ? codigoDeSolicitud(fila.id) : codigoAleatorio() }, { status: 201 });
  } catch (error) {
    // Dos envíos simultáneos con el mismo DNI: el índice único deja pasar uno. El otro se trata como la duplicada de siempre.
    if (/23505|duplicate key/i.test(error instanceof Error ? error.message : String(error))) {
      return NextResponse.json({ ok: true, codigo: codigoAleatorio() }, { status: 201 });
    }
    if (!esFaltaSql(error)) console.error("[acceso] no se pudo guardar la solicitud", error);
    return NextResponse.json({ error: esFaltaSql(error) ? NO_DISPONIBLE : "No se pudo enviar la solicitud. Inténtalo de nuevo." }, { status: esFaltaSql(error) ? 503 : 500 });
  }
}
