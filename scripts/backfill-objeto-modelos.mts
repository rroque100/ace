import { supabaseRest } from "@/lib/supabase-server";
const APLICAR = process.argv.includes("--aplicar");

// Objeto que sirve cada plantilla. Sale del propio nombre del archivo, que es lo
// que la entidad usó para distinguirlas; se imprime para poder revisarlo.
function objetoDe(fileName: string): string {
  const n = fileName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("CONSULTORIA DE OBRA")) return "consultoria_obra";
  if (n.includes("OBRAS")) return "obras";
  if (n.includes("BIENES")) return "bienes";
  if (n.includes("SUBASTA INVERSA") || n.includes("COMPARACION DE PRECIOS")) return "";
  if (n.includes("NO COMPETITIVO")) return "";
  return "servicios";
}

type Doc = { id: string; file_name: string; metadata: Record<string, unknown> };
const docs = await supabaseRest<Doc[]>(
  "documents?metadata->>kind=eq.modelo_requerimiento&select=id,file_name,metadata&order=file_name.asc",
);
let tocados = 0;
for (const d of docs) {
  const objeto = objetoDe(d.file_name);
  const actual = typeof d.metadata.objeto === "string" ? d.metadata.objeto : "";
  const proc = String(d.metadata.procesoSeleccion ?? "—");
  console.log(
    `  ${objeto === actual ? "=" : "→"} ${(objeto || "(cualquiera)").padEnd(17)} ${d.file_name.slice(0, 52).padEnd(53)} ${proc.slice(0, 34)}`,
  );
  if (objeto === actual || !APLICAR) continue;
  const metadata = { ...d.metadata };
  if (objeto) metadata.objeto = objeto;
  else delete metadata.objeto;
  await supabaseRest(`documents?id=eq.${d.id}`, { body: JSON.stringify({ metadata }), method: "PATCH" });
  tocados += 1;
}
console.log(`\n${APLICAR ? "APLICADO" : "SIMULACIÓN"} · ${tocados} modelos actualizados de ${docs.length}`);
