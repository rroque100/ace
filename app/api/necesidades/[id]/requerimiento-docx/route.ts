import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { MIME_DOCX } from "@/lib/archivar-formato";
import { objectTypeLabel } from "@/lib/legal-taxonomy";
import type { Necesidad } from "@/lib/necesidades";
import { apartadosDelModelo } from "@/lib/modelo-apartados";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import type { ObjetoFilter } from "@/lib/procesos-seleccion";
import { resolverModelosDocIds } from "@/lib/necesidad-copiloto";
import { generarRequerimientoDocx } from "@/lib/requerimiento-docx";
import { filtroEettTdr } from "@/lib/eett-tdr-documento";
import { slugify } from "@/lib/slugify";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Todas las columnas: el documento lleva TODO lo registrado, y una lista a mano
// se queda corta en cuanto la ficha crece un campo —que es justo lo que pasaba—.
const SELECT = "*";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

// GET /api/necesidades/[id]/requerimiento-docx
//
// Descarga el REQUERIMIENTO (Art. 44) de la necesidad en Word. Se lee con el JWT
// del usuario (RLS): quien no ve la necesidad, no descarga su requerimiento.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    const [necesidad] = await supabaseUserRest<Necesidad[]>(
      auth.user.accessToken,
      `necesidades?id=eq.${id}&select=${SELECT}`,
    );
    if (!necesidad) {
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }

    const aNum = (v: number | string | null): number | null => {
      if (v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // Las cuatro lecturas siguientes solo dependen de la necesidad ya cargada y
    // son independientes entre sí: se resuelven en PARALELO en vez de encadenar
    // cuatro round-trips a Supabase. Cada una conserva su propio fallback ante
    // fallo (falla en silencio a propósito; ver los comentarios de cada bloque).
    const [entRows, itemRows, anexoRows, apartados] = await Promise.all([
      // Entidad y ciudad para el encabezado y la fecha del pie (config global).
      // Sin `order=year.desc`: es una fila única (PK `id`), no una por ejercicio.
      supabaseRest<Array<{ name: string | null; city: string | null }>>(
        `entity_settings?id=eq.default&select=name,city&limit=1`,
      ).catch((err) => {
        console.error("[requerimiento-docx] no se pudo leer la entidad:", err);
        return [] as Array<{ name: string | null; city: string | null }>;
      }),
      // Desagregado del requerimiento (Art. 52). Si no hay, el documento sale con
      // la línea "Cantidad" de siempre.
      supabaseUserRest<
        Array<{
          nro: number;
          descripcion: string;
          unidad_medida: string | null;
          cantidad: number | string | null;
          costo_unitario: number | string | null;
          costo_total: number | string | null;
          tipo_objeto: string | null;
        }>
      >(
        auth.user.accessToken,
        `necesidad_items?necesidad_id=eq.${id}&select=nro,descripcion,unidad_medida,cantidad,costo_unitario,costo_total,tipo_objeto&order=nro.asc`,
      ).catch((err) => {
        console.error("[requerimiento-docx] no se pudieron leer los ítems:", err);
        return [];
      }),
      // EETT/TDR adjuntos a la necesidad, para listarlos como anexo al cerrar el
      // 3.4. Con service-role (como el resto del módulo EETT/TDR); la visibilidad
      // ya la garantizó la lectura de la necesidad con el token del usuario, arriba.
      supabaseRest<Array<{ file_name: string | null; title: string | null }>>(
        `documents?${filtroEettTdr(id)}&select=file_name,title&order=created_at.asc`,
      ).catch((err) => {
        console.error("[requerimiento-docx] no se pudieron leer los EETT/TDR adjuntos:", err);
        return [] as Array<{ file_name: string | null; title: string | null }>;
      }),
      // Los apartados que este PROCEDIMIENTO pide, leídos de su PDF-modelo. Es lo
      // que decide la estructura del documento: no es lo mismo una Subasta Inversa
      // de bienes que una Licitación de obras. Sin modelo cargado la lista queda
      // vacía y el generador cae a la estructura del Art. 44.2.
      (async (): Promise<string[]> => {
        try {
          const [docId] = await resolverModelosDocIds(
            str(necesidad.tipo_proceso_seleccion),
            auth.user.entity,
            str(necesidad.tipo_objeto),
          );
          if (docId) {
            const chunks = await supabaseRest<Array<{ content: string }>>(
              `document_chunks?document_id=eq.${docId}&select=content&order=chunk_index.asc`,
            );
            return apartadosDelModelo(chunks.map((c) => c.content).join("\n"));
          }
        } catch (err) {
          console.error("[requerimiento-docx] no se pudo leer el modelo del proceso:", err);
        }
        return [];
      })(),
    ]);
    const [ent] = entRows;
    const anexosTdr = anexoRows.map((r) => str(r.file_name) || str(r.title)).filter(Boolean);

    const hoy = new Date();
    const fechaISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

    // La ficha por api, derivada del CATALOGO. Escribir el mapa a mano fue como
    // se quedaron fuera veinte campos: cada campo nuevo de la ficha habia que
    // acordarse de anadirlo aqui, y nadie se acuerda.
    const ficha: Record<string, string> = {};
    for (const seccion of FICHA_SECCIONES) {
      for (const field of seccion.fields) {
        ficha[field.api] = field.checkbox
          ? String(Boolean(necesidad[field.col]))
          : str(necesidad[field.col]);
      }
    }
    // El plazo lleva su unidad dentro: un numero de dias sin unidad no significa
    // nada en un contrato (Art. 105.3).
    if (necesidad.plazo_ejecucion) {
      ficha.plazoEjecucion = `${necesidad.plazo_ejecucion} días ${necesidad.plazo_ejecucion_unidad === "habiles" ? "hábiles" : "calendario"}`;
    }


    const buffer = await generarRequerimientoDocx({
      apartados,
      ficha,
      objeto: (str(necesidad.tipo_objeto) || undefined) as ObjetoFilter | undefined,
      proceso: str(necesidad.tipo_proceso_seleccion),
      codigo: str(necesidad.codigo),
      entidad: str(ent?.name) || str(auth.user.entity),
      areaUsuaria: str(necesidad.area_usuaria),
      responsable: str(necesidad.responsable),
      lugar: str(ent?.city),
      fecha: fechaISO,
      nombre: str(necesidad.nombre),
      finalidadPublica: str(necesidad.finalidad_publica),
      objetoLabel: necesidad.tipo_objeto ? objectTypeLabel(necesidad.tipo_objeto) : "",
      descripcionDetallada: str(necesidad.descripcion_detallada),
      cantidad: str(necesidad.cantidad),
      anexosTdr,
      items: itemRows.map((r) => ({
        cantidad: aNum(r.cantidad),
        costoTotal: aNum(r.costo_total),
        costoUnitario: aNum(r.costo_unitario),
        descripcion: r.descripcion,
        nro: r.nro,
        tipoObjeto: r.tipo_objeto,
        unidadMedida: r.unidad_medida,
      })),
      unidadMedida: str(necesidad.unidad_medida),
      alcance: str(necesidad.alcance),
      condicionesEjecucion: str(necesidad.condiciones_ejecucion),
      // El numero sin unidad se lee como quien mire quiera, y en un contrato eso
      // son dias de penalidad de diferencia. Art. 105.3: calendario es la regla.
      plazoEjecucion: necesidad.plazo_ejecucion
        ? `${necesidad.plazo_ejecucion} días ${necesidad.plazo_ejecucion_unidad === "habiles" ? "hábiles" : "calendario"}`
        : "",
      modalidadPago: str(necesidad.modalidad_pago),
      sistemaEntrega: str(necesidad.sistema_entrega),
      garantias: str(necesidad.garantias),
      penalidadMora: str(necesidad.penalidad_mora),
      adelantoDirecto: str(necesidad.adelanto_directo),
      subcontratacion: str(necesidad.subcontratacion),
      formulaReajuste: str(necesidad.formula_reajuste),
      recepcionConformidad: str(necesidad.recepcion_conformidad),
      requisitosCalificacion: str(necesidad.requisitos_calificacion),
      departamento: str(necesidad.departamento),
      provincia: str(necesidad.provincia),
      distrito: str(necesidad.distrito),
      lugarEntrega: str(necesidad.lugar_entrega),
      metaPresupuestal: str(necesidad.meta_presupuestal),
      fuenteFinanciamiento: str(necesidad.fuente_financiamiento),
      clasificadorGasto: str(necesidad.clasificador_gasto),
      montoEstimado: str(necesidad.monto_estimado),
      elaboradoPor: [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
    });

    const filename = `Requerimiento-${slugify(str(necesidad.codigo) || "necesidad")}.docx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME_DOCX,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el requerimiento." },
      { status: 500 },
    );
  }
}
