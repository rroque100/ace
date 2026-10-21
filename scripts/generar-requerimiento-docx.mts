/**
 * Genera el Word del requerimiento de una necesidad, fuera de la aplicación.
 *
 * Sirve para revisar el documento sin pasar por el navegador: la página exige
 * inicio de sesión y el .docx solo se puede juzgar abriéndolo. Reproduce lo
 * mismo que hace `GET /api/necesidades/[id]/requerimiento-docx`.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/generar-requerimiento-docx.mts REQ-2026-0018
 *   npx tsx --env-file=.env.local scripts/generar-requerimiento-docx.mts REQ-2026-0018 --texto
 *
 * `--texto` vuelca además el contenido a la consola con su formato (negrita,
 * cursiva, viñeta, tabla), que es como se detectan los fallos de presentación
 * sin abrir Word.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { objectTypeLabel } from "@/lib/legal-taxonomy";
import { apartadosDelModelo } from "@/lib/modelo-apartados";
import { resolverModelosDocIds } from "@/lib/necesidad-copiloto";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { generarRequerimientoDocx } from "@/lib/requerimiento-docx";
import { supabaseRest } from "@/lib/supabase-server";
import type { ObjetoFilter } from "@/lib/procesos-seleccion";

const codigo = process.argv[2];
const conTexto = process.argv.includes("--texto");
if (!codigo) {
  console.error("Falta el código. Ej: scripts/generar-requerimiento-docx.mts REQ-2026-0018");
  process.exit(1);
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const aNum = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type Fila = Record<string, unknown>;
const [necesidad] = await supabaseRest<Fila[]>(`necesidades?codigo=eq.${codigo}&select=*`);
if (!necesidad) {
  console.error(`No existe la necesidad ${codigo}.`);
  process.exit(1);
}

const items = await supabaseRest<Fila[]>(
  `necesidad_items?necesidad_id=eq.${necesidad.id}&select=*&order=nro.asc`,
);

// Apartados del PDF-modelo del procedimiento: deciden qué es exigible.
const [docId] = await resolverModelosDocIds(
  str(necesidad.tipo_proceso_seleccion),
  null,
  str(necesidad.tipo_objeto),
);
const chunks = docId
  ? await supabaseRest<Array<{ content: string }>>(
      `document_chunks?document_id=eq.${docId}&select=content&order=chunk_index.asc`,
    )
  : [];
const apartados = apartadosDelModelo(chunks.map((c) => c.content).join("\n"));

// La ficha por api, derivada del catálogo (igual que la ruta).
const ficha: Record<string, string> = {};
for (const seccion of FICHA_SECCIONES) {
  for (const field of seccion.fields) {
    ficha[field.api] = field.checkbox
      ? String(Boolean(necesidad[field.col]))
      : str(necesidad[field.col]);
  }
}
if (necesidad.plazo_ejecucion) {
  const unidad = necesidad.plazo_ejecucion_unidad === "habiles" ? "hábiles" : "calendario";
  ficha.plazoEjecucion = `${necesidad.plazo_ejecucion} días ${unidad}`;
}

const [entidad] = await supabaseRest<Array<{ city: string | null; name: string | null }>>(
  "entity_settings?id=eq.default&select=name,city&limit=1",
).catch(() => []);

const hoy = new Date();
const buffer = await generarRequerimientoDocx({
  apartados,
  areaUsuaria: str(necesidad.area_usuaria),
  codigo: str(necesidad.codigo),
  entidad: str(entidad?.name),
  fecha: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`,
  ficha,
  items: items.map((r) => ({
    cantidad: aNum(r.cantidad),
    costoTotal: aNum(r.costo_total),
    costoUnitario: aNum(r.costo_unitario),
    descripcion: String(r.descripcion),
    nro: Number(r.nro),
    tipoObjeto: (r.tipo_objeto as string | null) ?? null,
    unidadMedida: (r.unidad_medida as string | null) ?? null,
  })),
  lugar: str(entidad?.city),
  nombre: str(necesidad.nombre),
  objeto: (str(necesidad.tipo_objeto) || undefined) as ObjetoFilter | undefined,
  objetoLabel: necesidad.tipo_objeto ? objectTypeLabel(str(necesidad.tipo_objeto)) : "",
  proceso: str(necesidad.tipo_proceso_seleccion),
  responsable: str(necesidad.responsable),
  // El resto del input lo cubre `ficha`; se pasan vacíos para no duplicarlo.
  adelantoDirecto: "", alcance: "", cantidad: "", clasificadorGasto: "", condicionesEjecucion: "",
  departamento: "", descripcionDetallada: "", distrito: "", finalidadPublica: "", formulaReajuste: "",
  fuenteFinanciamiento: "", garantias: "", lugarEntrega: "", metaPresupuestal: "", modalidadPago: "",
  montoEstimado: "", penalidadMora: "", plazoEjecucion: "", provincia: "", recepcionConformidad: "",
  requisitosCalificacion: "", sistemaEntrega: "", subcontratacion: "", unidadMedida: "",
});

mkdirSync("docs/requerimientos", { recursive: true });
const ruta = `docs/requerimientos/Requerimiento-${codigo}.docx`;
writeFileSync(ruta, buffer);

const registrados = Object.values(ficha).filter((v) => v && v !== "false").length;
console.log(`${codigo} · ${apartados.length} apartados del modelo · ${registrados} campos con dato`);
console.log(`  ${ruta}  (${(buffer.length / 1024).toFixed(0)} KB)`);

if (conTexto) {
  const { default: JSZip } = await import("jszip");
  const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml")!.async("string");
  console.log("");
  for (const trozo of xml.split(/(<w:tbl>[\s\S]*?<\/w:tbl>)/)) {
    if (trozo.startsWith("<w:tbl>")) {
      const celdas = [...trozo.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
      console.log(`  [tabla  ] ${celdas.slice(0, 10).join(" | ").slice(0, 90)}`);
      continue;
    }
    for (const parrafo of trozo.split("<w:p>").slice(1)) {
      const texto = [...parrafo.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
      if (!texto.trim()) continue;
      const marca = parrafo.includes("<w:i/>")
        ? "cursiva"
        : parrafo.includes("<w:numPr>")
          ? "viñeta "
          : parrafo.includes("<w:b/>")
            ? "negrita"
            : "       ";
      console.log(`  [${marca}] ${texto.slice(0, 90)}`);
    }
  }
}
