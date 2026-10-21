"use client";
import { useEffect, useRef, useState } from "react";
import { parseRagPath, type RagIdentity } from "@/lib/archivo-rag";
import { prepareArchivoUpload } from "@/lib/archivo-upload-client";
import { maxPdfSizeBytes } from "@/lib/upload-limits";
import { fetchRagRequest } from "@/lib/archivo-rag-client";

type Entry = { file: File; data: RagIdentity; selected: boolean; state: string; saved: boolean };
const control = "w-full rounded-lg border border-exp-line bg-exp-panel px-3 py-2 text-sm text-exp-ink";
const button = "rounded-lg bg-exp-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export function SubirRagTab({ oficina }: { oficina: string | null }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [location, setLocation] = useState({ local: "", estante: "", piso: "" });
  const [notice, setNotice] = useState("");
  const stop = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  const repeated = entries.filter((e, i) => e.data.cp && entries.some((other, j) => i !== j && other.data.cp === e.data.cp && other.data.cabinet === e.data.cabinet));
  function patch(index: number, change: Partial<Entry>) { setEntries(prev => prev.map((e,i) => i === index ? { ...e, ...change } : e)); }
  function choose(files: FileList | null) {
    const all = Array.from(files ?? []);
    const pdfs = all.filter(f => /\.pdf$/i.test(f.name));
    // Si vuelves a seleccionar la MISMA carpeta (para reintentar los que
    // fallaron en un lote parcial), los que ya se guardaron conservan su
    // estado en vez de reconstruirse en blanco: si no, reintentar los que
    // fallaron también resucitaba a los que ya estaban guardados, listos para
    // subirse (y gastar OCR) otra vez.
    setEntries(prev => {
      const previouslySaved = new Map(prev.filter(e => e.saved).map(e => [e.data.path, e]));
      return pdfs.map(file => {
        const data = parseRagPath(file.webkitRelativePath || file.name);
        const anterior = previouslySaved.get(data.path);
        if (anterior) return { ...anterior, file, data };
        return { file, data, selected: file.size <= maxPdfSizeBytes, state: file.size > maxPdfSizeBytes ? "Supera el límite de tamaño" : "Por revisar", saved: false };
      });
    });
    setReviewed(false);
    setNotice(`${pdfs.length} PDF encontrados. ${all.length - pdfs.length} archivos de otros formatos omitidos.`);
  }
  async function upload() {
    if (busy) return;
    const pending = entries.filter(e => e.selected && !e.saved);
    if (!pending.length) return;
    // Tipo, archivador y CP ya NO son obligatorios: solo se sube el PDF y el
    // contenido queda disponible para buscar/preguntar en Buscar RAG/Buscar.
    // Se valida el FORMATO únicamente de lo que sí se haya escrito (si hay CP,
    // que se vea "CP1234"; si hay SIAF, solo números) para no rebotar en el
    // backend por una entrada suelta cuando esos datos sí importan (p. ej.
    // notas de pago con su código contable).
    if (pending.some(e => (e.data.cp.trim() && !/^CP\d+$/i.test(e.data.cp)) || (e.data.siaf.trim() && !/^\d+$/.test(e.data.siaf)))) {
      setNotice("Revisa los datos: si escribes CP debe verse como CP1234; SIAF solo números."); return;
    }
    setBusy(true); stop.current = false;
    try {
      for (let i = 0; i < entries.length; i++) {
        if (stop.current) break;
        const entry = entries[i];
        if (!entry.selected || entry.saved) continue;
        patch(i, { state: "Subiendo y guardando…" });
        try {
          const form = new FormData();
          form.set("file", entry.file.type === "application/pdf" ? entry.file : new File([entry.file], entry.file.name, { type: "application/pdf" }));
          const fields = { relativePath: entry.data.path, title: entry.file.name.replace(/\.pdf$/i, ""), tipoDocumento: entry.data.type, nroArchivador: entry.data.cabinet, serieDocumento: entry.data.cp.toUpperCase(), ragCp: entry.data.cp.toUpperCase(), ragSiaf: entry.data.siaf, ragDate: entry.data.date, anio: entry.data.year, oficina: oficina ?? "", tipoAlmacenamiento: "archivador", nroLocal: location.local, nroEstante: location.estante, nroPiso: location.piso };
          for (const [key, value] of Object.entries(fields)) if (value) form.set(key, value);
          await prepareArchivoUpload(form, fetchRagRequest);
          const response = await fetchRagRequest("/api/expedientes-archivo", { method: "POST", body: form });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "No se pudo guardar");
          patch(i, { saved: true, state: result.duplicate ? "Ya estaba guardado (mismo contenido)" : "Guardado · OCR pendiente. Continúa en Buscar RAG." });
        } catch (error) { patch(i, { state: `${error instanceof Error ? error.message : "Error de subida"}. Puedes reintentar este archivo.` }); }
      }
      setNotice("Los archivos guardados ya se pueden localizar en Buscar RAG. El contenido estará disponible cuando termine el OCR. Los que fallaron permanecen seleccionados para reintentar.");
    } finally { setBusy(false); }
  }
  return <section className="space-y-5 p-5 text-exp-ink" aria-labelledby="rag-upload-title">
    <div><h2 id="rag-upload-title" className="text-xl font-semibold">Subir RAG</h2><p className="mt-1 text-sm text-exp-muted">Selecciona uno o varios PDF y súbelos. El contenido queda disponible para buscar y preguntar en Buscar RAG/Buscar. Los datos de tipo, archivador, CP y SIAF son opcionales — se detectan solos si vienen en el nombre del archivo (p. ej. carpetas de notas de pago), o los completas abajo si los tienes.</p></div>
    <label className="block rounded-xl border border-dashed border-exp-brand bg-exp-brand-soft p-5">
      <span className="mb-2 block font-semibold">Seleccionar PDF</span>
      <input type="file" multiple accept="application/pdf" disabled={busy} onChange={e => choose(e.target.files)} className="max-w-full text-sm" />
    </label>
    <p className="text-sm text-exp-muted">La selección prepara una revisión; todavía no sube archivos. Mantén esta página abierta hasta que termine la subida. La carga puede hacer pausas breves para respetar el límite del servidor.</p>
    <fieldset disabled={busy} className="grid gap-3 rounded-xl border border-exp-line p-4 md:grid-cols-3">
      <legend className="px-2 text-sm font-semibold">Ubicación común del lote (opcional)</legend>
      {([['local','Local'],['estante','Estante'],['piso','Piso']] as const).map(([key,label]) => <label key={key} className="text-sm">{label}<input className={control} value={location[key]} maxLength={60} onChange={e => setLocation({ ...location, [key]: e.target.value })} /></label>)}
    </fieldset>
    {entries.length > 0 && <>
      <p className="text-sm">{entries.length} PDF · {(entries.reduce((n,e) => n + e.file.size, 0) / 1_000_000).toFixed(1)} MB · {entries.filter(e => e.saved).length} guardados</p>
      <div className="overflow-x-auto rounded-xl border border-exp-line"><table className="w-full text-left text-sm"><caption className="p-3 text-left">Datos opcionales detectados de los nombres de archivo/carpeta (si venían); no son datos confirmados por OCR ni hace falta completarlos para subir.</caption><thead><tr>{["Incluir", "Archivo / estado", "Tipo (opcional)", "Archivador (opcional)", "CP (opcional)", "SIAF (opcional)", "Fecha (opcional)", "Año (opcional)"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>
        {entries.map((entry, i) => <tr key={entry.data.path} className="border-t border-exp-line"><td className="p-3"><input type="checkbox" aria-label={`Incluir ${entry.file.name}`} checked={entry.selected} disabled={busy || entry.saved || entry.file.size > maxPdfSizeBytes} onChange={e => patch(i, { selected: e.target.checked })} /></td><td className="min-w-64 p-3"><p>{entry.file.name}</p><p className="mt-1 text-xs text-exp-muted">{entry.state}</p></td>
          {(["type", "cabinet", "cp", "siaf", "date", "year"] as const).map(key => <td key={key} className="min-w-32 p-2"><input aria-label={`${key} de ${entry.file.name}`} className={control} disabled={busy || entry.saved} type={key === "date" ? "date" : "text"} value={entry.data[key]} maxLength={key === "type" || key === "cabinet" ? 60 : 30} onChange={e => { patch(i, { data: { ...entry.data, [key]: e.target.value } }); setReviewed(false); }} /></td>)}
        </tr>)}
      </tbody></table></div>
      {repeated.length > 0 && <label className="flex gap-3 rounded-lg border border-exp-line p-4 text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)} /><span>Hay números CP repetidos dentro del mismo archivador: {Array.from(new Set(repeated.map(e => e.data.cp))).join(", ")}. Revisé las fechas y los SIAF; los archivos seleccionados se conservarán separados.</span></label>}
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || (repeated.length > 0 && !reviewed) || !entries.some(e => e.selected && !e.saved)} onClick={() => void upload()}>{busy ? "Guardando archivos…" : "Importar seleccionados"}</button>{busy && <button className={control + " !w-auto"} onClick={() => { stop.current = true; setNotice("La subida se detendrá después del archivo actual."); }}>Detener después del actual</button>}</div>
    </>}
    <p role="status" className="text-sm text-exp-muted">{notice}</p>
  </section>;
}
