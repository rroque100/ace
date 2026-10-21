"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  eliminarAntecedente,
  type AdjuntoResult,
  type AnalisisTecnico,
  type DocTipo,
  listOficinas,
  type OficinaOption,
  listRespuestas,
  type RespuestaTokenUsage,
  subirAntecedente,
} from "@/lib/expedientes-archivo-actions";
import { formatDocumentNumber, TIPOS_DOCUMENTO } from "@/lib/document-number";

// Deduce el DocTipo a partir de un texto libre de la IA ("informe técnico",
// "memorando múltiple", "carta de respuesta"...). Los tipos compuestos
// ("MEMORANDUM MULTIPLE") se prueban primero para no quedarse en el simple.
function matchDocTipo(texto: string | null | undefined): DocTipo | null {
  if (!texto) return null;
  const t = texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // "MEMORANDO" (variante frecuente) → "MEMORANDUM"
    .replace(/MEMORANDO/g, "MEMORANDUM");
  const ordered = [...TIPOS_DOCUMENTO].sort((a, b) => b.length - a.length);
  return (ordered.find((tipo) => t.includes(tipo)) as DocTipo | undefined) ?? null;
}

// Estado centralizado de la pestaña Responder.
// Antes: 18 useState en un solo componente de 663 lineas.
// Ahora: 1 hook que centraliza la logica y persiste el borrador en localStorage.

export type RespuestaState = ReturnType<typeof useRespuestaState>;

const STORAGE_KEY = "respuesta-borrador-v1";

type BorradorGuardado = {
  asunto: string;
  cuerpo: string;
  destinatario: string;
  cargoDestinatario: string;
  documentoTexto: string;
  intencion: string;
  length: "concisa" | "media" | "detallada";
  // Ciudad del encabezado "Lugar, dd de mes de año" (modelo oficial peruano).
  lugar: string;
  // Número de documento YA asignado (si lo hay) y si quedó asignado. Antes NO
  // se guardaban: el borrador restaurado traía el cuerpo de una respuesta ya
  // archivada pero con nroAsignado en false (valor inicial del estado), así
  // que "Guardar" la confundía con una respuesta nueva y pedía otro
  // correlativo — un número de serie municipal que "no se puede deshacer ni
  // reutilizar" (ver saveRespuesta en respuesta-panel.tsx).
  nroOficio: string;
  nroAsignado: boolean;
  // REF.: numero del documento anterior al que se responde (opcional).
  referencia: string;
  remitenteDoc: string;
  savedAt: number;
  tipoDocumento: DocTipo;
  tone: "cercano" | "formal" | "tecnico";
};

export function useRespuestaState() {
  // Estado del wizard (pasos 1-5)
  const [documentoTexto, setDocumentoTexto] = useState("");
  const [antecedenteId, setAntecedenteId] = useState<string | null>(null);
  const [antecedenteMeta, setAntecedenteMeta] = useState<{
    chunkCount: number;
    extractionMethod: string;
    fileName: string;
    fileSize: number;
    pageCount: number | null;
  } | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisTecnico | null>(null);
  const [remitenteDoc, setRemitenteDocRaw] = useState("");
  const [asunto, setAsunto] = useState("");
  const [reading, setReading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tu respuesta
  const [oficinas, setOficinas] = useState<OficinaOption[]>([]);
  const [oficinaId, setOficinaId] = useState("");
  const [isAdminOficinas, setIsAdminOficinas] = useState(false);
  const [userEntity, setUserEntity] = useState<string | null>(null);
  const [totalActivas, setTotalActivas] = useState(0);
  const [tipoDocumento, setTipoDocumento] = useState<DocTipo>("OFICIO");
  const [intencion, setIntencion] = useState("");
  const [tone, setTone] = useState<"cercano" | "formal" | "tecnico">("formal");
  const [length, setLength] = useState<"concisa" | "media" | "detallada">("media");
  // El antecedente de la respuesta es el PDF cargado en esta pestaña; la
  // busqueda en la biblioteca de expedientes archivados es opcional (off).
  const [includeAntecedentes, setIncludeAntecedentes] = useState(false);
  const [normativaIds, setNormativaIds] = useState<string[]>([]);
  const [adjuntos, setAdjuntos] = useState<AdjuntoResult[]>([]);

  // Resultado / edicion
  const [generating, setGenerating] = useState(false);
  const [cuerpo, setCuerpo] = useState("");
  const [baseLegal, setBaseLegal] = useState<{ referencia: string; texto: string }[]>([]);
  const [antecedentes, setAntecedentes] = useState<
    { anio: number | null; excerpt: string; expedienteId: string; serie: string | null; title: string; ubicacion: string }[]
  >([]);
  const [genUsage, setGenUsage] = useState<unknown>(undefined);

  const [nroOficio, setNroOficio] = useState("");
  const [nroAsignado, setNroAsignado] = useState(false);
  const [destinatario, setDestinatario] = useState("");
  const [cargoDestinatario, setCargoDestinatario] = useState("");

  // "Dirigido a" (remitenteDoc) se COPIA al campo Destinatario de la seccion
  // Datos del documento, mientras el usuario no lo haya cambiado a mano: el
  // destinatario sigue el espejo si esta vacio o si aun refleja el valor
  // anterior de "Dirigido a". El ref guarda el valor vigente (todas las
  // escrituras pasan por este wrapper).
  const remitenteDocPrevRef = useRef("");
  const setRemitenteDoc = useCallback((value: string | ((prev: string) => string)) => {
    const anterior = remitenteDocPrevRef.current;
    const next = typeof value === "function" ? value(anterior) : value;
    remitenteDocPrevRef.current = next;
    setRemitenteDocRaw(next);
    setDestinatario((dest) => (dest.trim() === "" || dest === anterior ? next : dest));
  }, []);
  const [lugar, setLugar] = useState("");
  const [referencia, setReferencia] = useState("");
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");
  const [exporting, setExporting] = useState(false);
  const [savingRespuesta, setSavingRespuesta] = useState(false);

  // Historial
  const [saved, setSaved] = useState<
    {
      id: string;
      nro_oficio: string | null;
      tipo_documento: string | null;
      anio: number | null;
      asunto: string | null;
      destinatario: string | null;
      remitente: string | null;
      cuerpo: string;
      base_legal: { referencia: string; texto: string }[];
      antecedentes: unknown[];
      entity: Record<string, unknown>;
      tone: string | null;
      length: string | null;
      token_usage: RespuestaTokenUsage | null;
      created_at: string;
      antecedente_id: string | null;
      documento_texto: string | null;
    }[]
  >([]);

  // Auto-guardar borrador en localStorage cada 5s (Mejora #9 del Sprint 2)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = setInterval(() => {
      const borrador: BorradorGuardado = {
        asunto,
        cuerpo,
        cargoDestinatario,
        destinatario,
        documentoTexto,
        intencion,
        length,
        lugar,
        nroOficio,
        nroAsignado,
        referencia,
        remitenteDoc,
        savedAt: Date.now(),
        tipoDocumento,
        tone,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(borrador));
      } catch {
        // Si el localStorage esta lleno, lo limpiamos y reintentamos
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(borrador));
        } catch {
          // Ignorar.
        }
      }
    }, 5000);
    return () => clearInterval(handle);
  }, [
    asunto,
    cuerpo,
    cargoDestinatario,
    destinatario,
    documentoTexto,
    intencion,
    length,
    lugar,
    nroOficio,
    nroAsignado,
    referencia,
    remitenteDoc,
    tipoDocumento,
    tone,
  ]);

  // Restaurar el borrador al montar el componente
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<BorradorGuardado>;
      // Restaurar si el borrador tiene menos de 24 horas.
      if (!data.savedAt || Date.now() - data.savedAt > 86_400_000) return;
      if (data.asunto) setAsunto(data.asunto);
      if (data.cuerpo) setCuerpo(data.cuerpo);
      if (data.destinatario) setDestinatario(data.destinatario);
      if (data.cargoDestinatario) setCargoDestinatario(data.cargoDestinatario);
      if (data.documentoTexto) setDocumentoTexto(data.documentoTexto);
      if (data.intencion) setIntencion(data.intencion);
      if (data.length) setLength(data.length);
      if (data.lugar) setLugar(data.lugar);
      // El correlativo ya asignado se restaura JUNTO con el cuerpo: si no,
      // "Guardar" trataba una respuesta ya archivada como nueva y pedía otro
      // número (ver el comentario en BorradorGuardado).
      if (data.nroOficio) setNroOficio(data.nroOficio);
      if (data.nroAsignado) setNroAsignado(data.nroAsignado);
      if (data.referencia) setReferencia(data.referencia);
      if (data.remitenteDoc) setRemitenteDoc(data.remitenteDoc);
      if (data.tipoDocumento) setTipoDocumento(data.tipoDocumento);
      if (data.tone) setTone(data.tone);
    } catch {
      // Ignorar borrador corrupto.
    }
  }, [setRemitenteDoc]);

  const reloadOficinas = useCallback(() => {
    void listOficinas()
      .then((data) => {
        setOficinas(data.oficinas);
        setIsAdminOficinas(data.isAdmin);
        setUserEntity(data.userEntity);
        setTotalActivas(data.totalActivas);
        setOficinaId((prev) => prev || data.defaultOficinaId || data.oficinas[0]?.id || "");
        // Ciudad institucional como "Lugar" por defecto del encabezado
        // (no pisa lo que el usuario ya escribio o tenia en su borrador).
        if (data.ciudad) setLugar((prev) => prev || data.ciudad || "");
      })
      .catch(() => undefined);
  }, []);

  const reloadSaved = useCallback(() => {
    void listRespuestas(20)
      .then((items) => setSaved(items as never))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    reloadOficinas();
    reloadSaved();
  }, [reloadOficinas, reloadSaved]);

  // Si el admin ajusta Configuracion → Numeracion en otra pestaña y vuelve,
  // recargamos las oficinas para que la sigla/correlativo preview este al dia.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => reloadOficinas();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadOficinas]);

  const oficina = oficinas.find((o) => o.id === oficinaId) ?? null;
  const previewNumero = oficina?.previews?.[tipoDocumento] ?? "";
  const numeroEfectivo = nroOficio.trim() || previewNumero;

  const tipoManualRef = useRef(false);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      if (file.type !== "application/pdf") return;
      if (file.size > 50 * 1024 * 1024) return;
      setReading(true);
      try {
        const result = await subirAntecedente(file);
        setAntecedenteId(result.id);
        setDocumentoTexto(result.text);
        setAntecedenteMeta({
          chunkCount: result.chunkCount,
          extractionMethod: result.extractionMethod,
          fileName: result.fileName,
          fileSize: result.fileSize,
          pageCount: result.pageCount,
        });
        setAnalisis(result.analisis ?? null);
        if (result.asunto) setAsunto((prev) => prev || result.asunto || "");
        if (result.remitente) setRemitenteDoc((prev) => prev || result.remitente || "");
        if (!tipoManualRef.current && result.analisis) {
          // El TIPO DE RESPUESTA que el documento espera manda (es lo que vamos
          // a emitir); el tipo del documento RECIBIDO es solo un respaldo.
          const match =
            matchDocTipo(result.analisis.tipoRespuestaEsperada) ??
            matchDocTipo(result.analisis.tipoDocumento);
          if (match) setTipoDocumento(match);
        }
      } finally {
        setReading(false);
      }
    },
    [setRemitenteDoc],
  );

  const handleSetTipoDocumento = useCallback((v: DocTipo) => {
    tipoManualRef.current = true;
    setTipoDocumento(v);
  }, []);

  // Reset al cambiar oficina: detecta cambio, limpia correlativo y avisa
  // al panel hijo (que puede mostrar confirm para limpiar el borrador).
  const handleChangeOficina = (nextId: string): { previousId: string; hasBody: boolean } => {
    if (nextId === oficinaId) {
      return { hasBody: false, previousId: oficinaId };
    }
    const previousId = oficinaId;
    setOficinaId(nextId);
    setNroOficio("");
    setNroAsignado(false);
    return { hasBody: cuerpo.trim().length > 0, previousId };
  };

  // Acciones destructivas con confirmacion
  const removeAntecedente = useCallback(async () => {
    if (!antecedenteId) return;
    setAntecedenteId(null);
    setAntecedenteMeta(null);
    setAnalisis(null);
    try {
      await eliminarAntecedente(antecedenteId);
    } catch {
      // El backend ya lo loguea; no interrumpimos al usuario.
    }
  }, [antecedenteId]);

  const clearBorrador = useCallback(() => {
    setCuerpo("");
    setBaseLegal([]);
    setAntecedentes([]);
    setGenUsage(undefined);
  }, []);

  const reset = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignorar.
      }
    }
    setDocumentoTexto("");
    setAntecedenteId(null);
    setAntecedenteMeta(null);
    setAnalisis(null);
    setRemitenteDoc("");
    setAsunto("");
    setCuerpo("");
    setBaseLegal([]);
    setAntecedentes([]);
    setIntencion("");
    setDestinatario("");
    setCargoDestinatario("");
    setReferencia("");
    setNroOficio("");
    setNroAsignado(false);
    setNormativaIds([]);
    setAdjuntos([]);
  }, [setRemitenteDoc]);

  return {
    // documento recibido
    analisis,
    setAnalisis,
    antecedenteId,
    antecedenteMeta,
    documentoTexto,
    handleFile,
    inputRef,
    isDragging,
    reading,
    removeAntecedente,
    setAntecedenteId,
    setAntecedenteMeta,
    setDocumentoTexto,
    setIsDragging,
    setRemitenteDoc,
    setAsunto,
    asunto,
    remitenteDoc,
    // tu respuesta
    adjuntos,
    isAdminOficinas,
    intencion,
    length,
    normativaIds,
    oficina,
    oficinaId,
    oficinas,
    previewNumero,
    setAdjuntos,
    setIncludeAntecedentes,
    setIntencion,
    setLength,
    setNormativaIds,
    setOficinaId,
    setTipoDocumento: handleSetTipoDocumento,
    setTone,
    includeAntecedentes,
    tipoDocumento,
    tone,
    totalActivas,
    userEntity,
    handleChangeOficina,
    // resultado
    antecedentes,
    baseLegal,
    cuerpo,
    generating,
    genUsage,
    numeroEfectivo,
    setAntecedentes,
    setBaseLegal,
    setCuerpo,
    setGenerating,
    setGenUsage,
    // datos documento
    cargoDestinatario,
    destinatario,
    exportFormat,
    exporting,
    lugar,
    nroAsignado,
    nroOficio,
    referencia,
    savingRespuesta,
    setCargoDestinatario,
    setDestinatario,
    setExportFormat,
    setLugar,
    setReferencia,
    setExporting,
    setNroAsignado,
    setNroOficio,
    setSavingRespuesta,
    // historial
    reloadOficinas,
    reloadSaved,
    saved,
    // acciones globales
    clearBorrador,
    formatDocumentNumber,
    reset,
  };
}
