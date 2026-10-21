import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { resolverBases } from "@/lib/bases-elaboracion";
import { generarBasesDocx } from "@/lib/bases-docx";
import { leerPlantillaDocx } from "@/lib/bases-docx-plantilla";
import { construirSustituciones, rellenarBasesDocx } from "@/lib/bases-docx-relleno";
import { resolverPlantillaAmbigua } from "@/lib/bases-plantillas";
import type { HitosMap } from "@/lib/procurement-fases";
import { slugify } from "@/lib/slugify";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIN_PLANTILLA = "Todavía no hay plantilla de bases para este tipo de procedimiento.";
// Distinto del mensaje anterior a propósito: "sin_plantilla" con
// `procedure_type` NULO no significa que el OECE no publicó bases estándar
// para ese tipo (SIN_PLANTILLA) — significa que el expediente TODAVÍA no
// tiene un tipo de procedimiento definido, porque la DEC no ha completado la
// Estrategia (A4, donde se confirma `procedure_type`). Confundir ambos casos
// bajo un solo mensaje genérico llevó a un reporte real: la entidad veía
// "no hay plantilla" en un expediente cuyo problema real era A4 sin terminar.
const SIN_TIPO_DEFINIDO =
  "Este expediente todavía no tiene definido el tipo de procedimiento de selección. Complétalo en la Estrategia de contratación (A4) antes de elaborar las Bases.";

// Busca el año fiscal por cualquiera de los dos extremos del vínculo
// expediente↔necesidad (igual que lib/segmentacion-informe-datos.ts y otros
// exportables de Fase 1: hay filas con el vínculo cojo, solo un lado apunta
// al otro). `procurement_processes` no tiene columna `year` propia — no es
// una de las tablas migradas a año fiscal — así que este es el único origen
// real del dato.
async function buscarAnioFiscal(token: string, procesoId: string, necesidadId: string | null): Promise<number | null> {
  if (necesidadId) {
    const [porId] = await supabaseUserRest<Array<{ anio_fiscal: number | null }>>(
      token,
      `necesidades?id=eq.${necesidadId}&select=anio_fiscal`,
    ).catch(() => []);
    if (porId) return porId.anio_fiscal ?? null;
  }
  const [porProceso] = await supabaseUserRest<Array<{ anio_fiscal: number | null }>>(
    token,
    `necesidades?process_id=eq.${procesoId}&select=anio_fiscal&limit=1`,
  ).catch(() => []);
  return porProceso?.anio_fiscal ?? null;
}

// GET /api/processes/{id}/fase1/bases-docx?variante=<...> → elabora las
// Bases del procedimiento de selección (A9) en Word, a partir de la
// plantilla OECE del tipo de procedimiento del expediente
// (lib/bases-plantillas.ts) y de los datos ya registrados en A1-A9
// (lib/bases-elaboracion.ts).
//
// Un puñado de procedimientos de catálogo resuelven a MÁS DE UN PDF oficial
// (ver VARIANTES_AMBIGUAS en lib/bases-plantillas.ts); `resolverPlantillaAmbigua`
// decide: 404 si el tipo está definido pero el OECE no publicó bases estándar
// para él, 409 con la lista de variantes si hace falta elegir una
// explícitamente (`?variante=`), o la plantilla directa en cualquier otro
// caso — incluida la variante única de hoy, que se resuelve sola sin pedir
// nada. Si el expediente ni siquiera tiene `procedure_type` (A4 sin
// completar), se responde 409 sin llegar a preguntarle a esa función.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  const variante = new URL(request.url).searchParams.get("variante");

  try {
    const [proceso] = await supabaseUserRest<
      Array<{ nomenclature: string; procedure_type: string | null; hitos: HitosMap | null; necesidad_id: string | null }>
    >(auth.user.accessToken, `procurement_processes?id=eq.${id}&select=nomenclature,procedure_type,hitos,necesidad_id`);
    if (!proceso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

    // El tipo ESPECÍFICO (el catálogo de los Arts. 93-95, el mismo de
    // lib/procesos-seleccion.ts) vive en `hitos.A4.data.var_a_proceso` — lo
    // trae el área usuaria desde la ficha y la DEC lo confirma en la
    // Estrategia. La columna `procurement_processes.procedure_type` NO es lo
    // mismo: `lib/expediente-columnas.ts` la alimenta desde
    // `var_a_procedimiento`, el genérico de 7 valores del Art. 54 (p. ej.
    // "licitacion_publica_abreviada"), que sirve para cronograma/carátula
    // pero JAMÁS coincide con un `value` de `PROCESOS_SELECCION` — usarla
    // aquí garantizaba un 404 aunque A4 estuviera completo (reporte real,
    // expediente 03315fbc). Se prioriza el hito y se cae a la columna solo
    // por si alguna vez se escribió ahí el valor específico correcto.
    const datosA4 = (proceso.hitos?.A4?.data ?? {}) as Record<string, unknown>;
    const varAProceso = typeof datosA4.var_a_proceso === "string" ? datosA4.var_a_proceso.trim() : "";
    const tipoProcedimiento = varAProceso || proceso.procedure_type || null;

    if (!tipoProcedimiento) {
      // No es lo mismo que "sin_plantilla": aquí el expediente ni siquiera
      // tiene un tipo de procedimiento asignado (A4 sin completar), así que
      // no tiene sentido preguntarle a `resolverPlantillaAmbigua` — 409
      // porque es un prerrequisito pendiente y corregible, no una ausencia
      // permanente del OECE.
      return NextResponse.json({ error: SIN_TIPO_DEFINIDO }, { status: 409 });
    }

    const resolucion = resolverPlantillaAmbigua(tipoProcedimiento, variante);

    if (!resolucion.ok) {
      if (resolucion.motivo === "sin_plantilla") {
        return NextResponse.json({ error: SIN_PLANTILLA }, { status: 404 });
      }
      // "ambiguo" (falta elegir) y "variante_invalida" (se eligió mal) se
      // responden igual: 409, con las opciones válidas para que la UI arme
      // el selector — no es un error del cliente en el sentido de un 400,
      // es un procedimiento que legítimamente necesita una decisión.
      return NextResponse.json(
        {
          error:
            resolucion.motivo === "variante_invalida"
              ? "Esa variante no corresponde a este tipo de procedimiento."
              : "Este tipo de procedimiento agrupa más de una plantilla de bases oficial. Elige cuál corresponde.",
          variantes: resolucion.variantes,
        },
        { status: 409 },
      );
    }
    const plantilla = resolucion.plantilla;

    // entity_settings está cerrada por RLS al usuario normal: se lee con
    // service-role, igual que ya hace lib/evaluadores-docx-datos.ts.
    const [entidad] = await supabaseRest<Array<{ name: string | null; ruc: string | null }>>(
      "entity_settings?id=eq.default&select=name,ruc&limit=1",
    ).catch(() => []);

    const anioFiscal = await buscarAnioFiscal(auth.user.accessToken, id, proceso.necesidad_id);

    const valores = resolverBases(
      plantilla.proceso,
      proceso.hitos ?? {},
      { nombre: entidad?.name ?? "", ruc: entidad?.ruc ?? "" },
      anioFiscal,
    );
    if (!valores) {
      // No debería ocurrir: `resolverPlantillaAmbigua` ya devolvió `ok: true`
      // con esta misma `plantilla.proceso` arriba. Defensivo, no silencioso.
      return NextResponse.json({ error: SIN_PLANTILLA }, { status: 404 });
    }

    // Vía preferida: rellenar el .docx OFICIAL del OECE (respeta páginas,
    // tipografía, Proforma y Anexos). Solo se sustituyen los marcadores "[...]"
    // que tienen dato en A1-A8; el resto queda intacto. Si no hay .docx para
    // este tipo, se cae al generador estructural (borrador recompuesto).
    const plantillaDocx = await leerPlantillaDocx(plantilla.proceso);
    const buffer = plantillaDocx
      ? (
          await rellenarBasesDocx(
            plantillaDocx,
            construirSustituciones({
              hitos: proceso.hitos ?? {},
              entidad: entidad?.name ?? "",
              anioFiscal: anioFiscal !== null ? String(anioFiscal) : "",
              nomenclaturaProceso: proceso.nomenclature ?? "",
            }),
          )
        ).buffer
      : await generarBasesDocx(plantilla.proceso, valores, plantilla.seccionGeneral);
    const filename = `Bases-${slugify(proceso.nomenclature || "expediente")}.docx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron elaborar las bases" },
      { status: 500 },
    );
  }
}
