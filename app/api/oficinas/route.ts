import { NextResponse } from "next/server";
import { conGradoAcademico, mismaPersona } from "@/lib/nombres";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OficinaMin = {
  id: string;
  nombre: string;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
};

// GET /api/oficinas
// Lista liviana de oficinas para autocompletar el "Área usuaria" en formularios
// (necesidades, etc.) y para proponer el PARA/DE del Informe de Segmentación.
// Accesible a cualquier usuario autenticado —a diferencia de
// /api/configuracion/oficinas, que es solo de administración.
//
// Incluye el responsable porque el memorando del informe se dirige a un cargo,
// no a una oficina: sin él, el PARA/DE habría que teclearlos en cada expediente.
type PerfilMin = {
  nombre_completo: string | null;
  grado_academico: string | null;
  cargo: string | null;
};

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    // Sin reintento por columnas ausentes: `responsable_nombre`,
    // `responsable_cargo` y `gestiona_contrataciones` existen. El reintento que
    // había aquí solo servía para convertir un fallo real en una lista muda.
    const oficinas = await supabaseRest<OficinaMin[]>(
      "expedientes_oficinas?select=id,nombre,responsable_nombre,responsable_cargo,gestiona_contrataciones&activo=eq.true&order=nombre.asc",
    );
    // El nombre del responsable se toma de Configuración › Usuarios, que es
    // donde vive el GRADO ACADÉMICO y donde el nombre está en el orden en que
    // se firma ("JUAN ROJAS MAYTAN"). La oficina lo guarda como el padrón
    // ("ROJAS MAYTAN JUAN") y sin grado.
    //
    // El emparejamiento es POR NOMBRE, no por `oficina_id`: en la base hay
    // jefes cuyo perfil apunta a otra oficina, y resolver por el vínculo
    // devolvía a quien no firma. Si no hay perfil que case, se conserva lo que
    // tiene la oficina.
    //
    // Este SÍ degrada a propósito, y es distinto del de arriba: el padrón solo
    // ENRIQUECE la firma. Sin él la oficina conserva su propio responsable y el
    // combobox sigue sirviendo, así que un fallo aquí no debe tumbar la lista
    // entera. Se registra para que no sea invisible.
    const perfiles = await supabaseRest<PerfilMin[]>(
      "profiles?select=nombre_completo,grado_academico,cargo&nombre_completo=not.is.null",
    ).catch((err) => {
      console.error("[oficinas] no se pudo leer el padrón para la firma:", err);
      return [] as PerfilMin[];
    });

    const conFirma = oficinas.map((o) => {
      const perfil = perfiles.find((p) => mismaPersona(p.nombre_completo, o.responsable_nombre));
      if (!perfil) return o;
      return {
        ...o,
        responsable_nombre: conGradoAcademico(perfil.grado_academico, perfil.nombre_completo ?? ""),
        responsable_cargo: (o.responsable_cargo ?? perfil.cargo ?? "").trim() || null,
      };
    });

    return NextResponse.json({ oficinas: conFirma });
  } catch (error) {
    // 500, no 200. Devolver `{oficinas: []}` con estado 200 hacía indistinguible
    // "la consulta falló" de "no hay oficinas": quien llama pintaba un combobox
    // vacío como si esa fuera la respuesta correcta.
    console.error("[oficinas] no se pudieron cargar las oficinas:", error);
    return NextResponse.json(
      {
        oficinas: [],
        error: error instanceof Error ? error.message : "No se pudieron cargar las oficinas",
      },
      { status: 500 },
    );
  }
}
