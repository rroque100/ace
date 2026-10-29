import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { usuarioDeCorreo } from "@/lib/usuario-credencial";
import { consultaConsumo, consultaEventos } from "@/lib/auditoria-consulta";
import { aCsv, resumirConsumo, type FilaUsoIA } from "@/lib/auditoria-resumen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Auditoría de las cuentas externas: desde qué IP entran, qué hacen y cuánta IA consumen en cada módulo. Solo el
// administrador la ve. Todo filtro del cliente pasa por lib/auditoria-consulta.ts antes de llegar a la consulta.

const esFaltaSql = (error: unknown) => /42703|42P01|PGRST20[45]|does not exist|Could not find|schema cache/i.test(error instanceof Error ? error.message : String(error));

type Evento = {
  creado_en: string;
  usuario_id: string;
  usuario: string | null;
  modulo: string | null;
  accion: string;
  ruta: string | null;
  metodo: string | null;
  estado: number | null;
  ip: string | null;
  user_agent: string | null;
};

const COLUMNAS_CSV = ["creado_en", "usuario", "modulo", "accion", "ruta", "metodo", "estado", "ip", "user_agent"] as const;

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const parametros = {
    usuarioId: searchParams.get("usuarioId"),
    modulo: searchParams.get("modulo"),
    ip: searchParams.get("ip"),
    desde: searchParams.get("desde"),
    hasta: searchParams.get("hasta"),
    limite: searchParams.get("limite"),
    pagina: searchParams.get("pagina"),
  };
  const ahora = Date.now();
  const consulta = consultaEventos(parametros, ahora);
  if (!consulta.ok) return NextResponse.json({ error: consulta.error }, { status: 400 });
  const csv = searchParams.get("formato") === "csv";

  try {
    // Exportar baja hasta 5 000 filas de una vez y no pagina; la pantalla pagina de a 100.
    const limite = csv ? 5000 : consulta.limite;
    const desde = csv ? 0 : consulta.desde;
    const eventos = await supabaseRest<Evento[]>(`acceso_eventos?${consulta.filtro}&select=*&order=creado_en.desc&limit=${limite}&offset=${desde}`);

    if (csv) {
      await writeAuditLog({
        action: "settings.externo.export",
        details: { filas: eventos.length, filtros: parametros },
        entityId: parametros.usuarioId ?? undefined,
        entityType: "user",
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      });
      return new NextResponse(aCsv(COLUMNAS_CSV, eventos), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="auditoria-externos-${new Date(ahora).toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const consumoFiltro = consultaConsumo(parametros, ahora);
    const filas = consumoFiltro.ok
      ? await supabaseRest<FilaUsoIA[]>(`uso_ia?${consumoFiltro.filtro}&tipo_usuario=eq.externo&select=usuario_id,modulo,operacion,tokens_entrada,tokens_salida,costo_estimado,estimado&limit=20000`)
      : [];
    const consumo = resumirConsumo(filas);
    const perfiles = await supabaseRest<Array<{ id: string; email: string | null; nombre_completo: string | null }>>("profiles?tipo=eq.externo&select=id,email,nombre_completo&limit=500");
    const usuarios = perfiles.map((perfil) => ({ id: perfil.id, usuario: usuarioDeCorreo(perfil.email) ?? perfil.email, nombre: perfil.nombre_completo }));

    return NextResponse.json({
      sqlPendiente: false,
      rango: { desde: new Date(consulta.desdeMs).toISOString(), hasta: new Date(consulta.hastaMs).toISOString() },
      eventos,
      hayMas: eventos.length === consulta.limite,
      consumo,
      usuarios,
    });
  } catch (error) {
    if (esFaltaSql(error)) {
      return NextResponse.json({ sqlPendiente: true, aviso: "Falta ejecutar docs/supabase/usuarios-externos.sql en el SQL Editor de Supabase.", eventos: [], hayMas: false, consumo: resumirConsumo([]), usuarios: [] });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer la auditoría" }, { status: 500 });
  }
}
