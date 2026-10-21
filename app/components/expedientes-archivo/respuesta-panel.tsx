"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, FilePlus2 } from "lucide-react";
import {
  DOC_TIPOS,
  exportRespuestaDocx,
  generateRespuesta,
  previewRespuestaPdf,
  refinarRespuesta,
  saveRespuesta,
  type SavedRespuesta,
} from "@/lib/expedientes-archivo-actions";
import { rememberDestinatario } from "@/lib/destinatarios-frecuentes";
import { ConfirmDialog } from "../confirm-dialog";
import { useRespuestaState } from "./use-respuesta-state";
import { DocumentoRecibido } from "./respuesta/documento-recibido";
import { ResumenTecnicoBanner } from "./respuesta/resumen-tecnico-banner";
import { ConfiguracionRespuesta } from "./respuesta/configuracion-respuesta";
import { BorradorEditor } from "./respuesta/borrador-editor";
import { DatosDocumento } from "./respuesta/datos-documento";
import { HistorialRespuestas } from "./respuesta/historial-respuestas";
import { EXP_TAB_CONTENT } from "./estilos";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "warning" | "info";

// Orquestador de la pestana Responder. Antes: 663 lineas con 18 useState.
// Ahora: usa useRespuestaState() + 5 sub-componentes (< 250 lineas).
export function RespuestaPanel({
  showToast: externalShowToast,
}: {
  showToast: (message: string, kind?: ToastKind) => void;
}) {
  const state = useRespuestaState();
  const [confirmSave, setConfirmSave] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [savingRespuesta, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [result, setResult] = useState<{
    respuesta: string;
    sources: Array<{ citation: string; title: string; documentNumber: string | null; excerpt: string }>;
    antecedentes: Array<{ anio: number | null; excerpt: string; expedienteId: string; serie: string | null; title: string; ubicacion: string }>;
    tokenUsage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  } | null>(null);

  // Adaptamos el showToast del panel padre a la firma interna
  const showToast = useCallback(
    (msg: string, kind?: ToastKind) => externalShowToast(msg, kind ?? "info"),
    [externalShowToast],
  );

  async function handleGenerate() {
    if (state.intencion.trim().length < 10) {
      showToast("Escribe qué quieres responder (mín. 10 caracteres).", "warning");
      return;
    }
    state.setGenerating(true);
    try {
      const res = await generateRespuesta({
        intencion: state.intencion.trim(),
        tipoDocumento: state.tipoDocumento,
        documentoTexto: state.documentoTexto.trim() || undefined,
        remitente: state.remitenteDoc.trim() || undefined,
        destinatario: state.destinatario.trim() || undefined,
        cargoDestinatario: state.cargoDestinatario.trim() || undefined,
        asunto: state.asunto.trim() || undefined,
        tone: state.tone,
        length: state.length,
        includeAntecedentes: state.includeAntecedentes,
        normativaIds: state.normativaIds.length > 0 ? state.normativaIds : undefined,
        adjuntosIds: state.adjuntos.length > 0 ? state.adjuntos.map((a) => a.documentId) : undefined,
        antecedenteId: state.antecedenteId ?? undefined,
        entityName: state.oficina?.entidad || undefined,
        oficinaId: state.oficinaId || undefined,
      });
      setResult(res as never);
      state.setCuerpo(res.respuesta);
      state.setBaseLegal(
        (res.sources ?? []).map((s) => ({ referencia: s.citation || s.title, texto: s.excerpt })),
      );
      state.setAntecedentes((res.antecedentes ?? []) as never);
      state.setGenUsage(res.tokenUsage);
      const partes = [
        (res.sources ?? []).length > 0 ? `${(res.sources ?? []).length} norma(s)` : "sin normativa directa",
        (res.antecedentes ?? []).length > 0 ? `${(res.antecedentes ?? []).length} antecedente(s)` : null,
      ].filter(Boolean);
      showToast(
        `Cuerpo generado (${partes.join(", ")}). Revísalo antes de emitir.`,
        (res.sources ?? []).length === 0 ? "warning" : "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo generar la respuesta", "error");
    } finally {
      state.setGenerating(false);
    }
  }

  // Refinamiento conversacional: aplica SOLO el cambio pedido al borrador.
  async function handleRefine(instruccion: string) {
    if (!state.cuerpo.trim()) {
      showToast("Primero genera o escribe el borrador.", "warning");
      return;
    }
    setRefining(true);
    try {
      const res = await refinarRespuesta({
        cuerpo: state.cuerpo,
        instruccion,
        tipoDocumento: state.tipoDocumento,
        tone: state.tone,
      });
      state.setCuerpo(res.cuerpo);
      if (res.tokenUsage) state.setGenUsage(res.tokenUsage);
      showToast("Cambio aplicado al borrador.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo aplicar el cambio", "error");
    } finally {
      setRefining(false);
    }
  }

  // Vista previa del PDF real (con membrete) sin descargar.
  async function handlePreviewPdf(): Promise<string | null> {
    if (!state.cuerpo.trim()) {
      showToast("No hay cuerpo de respuesta para previsualizar.", "warning");
      return null;
    }
    try {
      return await previewRespuestaPdf({
        asunto:
          state.asunto.trim() ||
          (state.tipoDocumento === "CARTA" ? "" : "Respuesta a su solicitud"),
        cargoDestinatario: state.cargoDestinatario.trim() || undefined,
        cargoRemitente: state.oficina?.responsableCargo ?? undefined,
        cuerpo: state.cuerpo.trim(),
        destinatario: state.destinatario.trim() || state.remitenteDoc.trim() || "[DESTINATARIO]",
        entity: { name: state.oficina?.entidad ?? "", ruc: state.oficina?.ruc ?? "" },
        lugar: state.lugar.trim() || undefined,
        nroOficio: state.numeroEfectivo || undefined,
        oficinaId: state.oficinaId,
        referencia: state.referencia.trim() || undefined,
        remitente: state.oficina?.responsableNombre ?? undefined,
        tipoDocumento: state.tipoDocumento,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo generar la vista previa", "error");
      return null;
    }
  }

  function validateSave(): string | null {
    if (!state.cuerpo.trim()) return "No hay cuerpo de respuesta para guardar.";
    if (!state.oficinaId) return "Elige la oficina emisora.";
    if (
      // Cubre tambien OFICIO/MEMORANDUM MULTIPLE. CONTRATO e INFORME no
      // llevan destinatario epistolar.
      (state.tipoDocumento.includes("OFICIO") ||
        state.tipoDocumento.includes("CARTA") ||
        state.tipoDocumento.includes("MEMORANDUM")) &&
      !state.destinatario.trim() &&
      !state.remitenteDoc.trim()
    ) {
      return "Indica el destinatario o el remitente para guardar la respuesta.";
    }
    if (!state.asunto.trim()) return "Indica el asunto del documento antes de guardar.";
    return null;
  }

  // Guarda/archiva la respuesta (asigna correlativo si aun no tiene).
  // Devuelve el numero asignado o null si la validacion fallo.
  async function saveRespuestaNow(): Promise<{
    ok: boolean;
    nro: string | null;
    /** Relleno si se pidió correlativo y no se pudo asignar: se guardó sin número. */
    numeracionError?: string | null;
  }> {
    const error = validateSave();
    if (error) {
      showToast(error, "warning");
      return { ok: false, nro: null };
    }
    const res = await saveRespuesta({
      anio: new Date().getFullYear(),
      antecedentes: state.antecedentes as never,
      antecedenteId: state.antecedenteId ?? undefined,
      assignNumber: !state.nroAsignado,
      baseLegal: state.baseLegal,
      cargoDestinatario: state.cargoDestinatario.trim() || undefined,
      cuerpo: state.cuerpo.trim(),
      destinatario: state.destinatario.trim() || state.remitenteDoc.trim() || undefined,
      documentoTexto: state.documentoTexto.trim() || undefined,
      entity: { name: state.oficina?.entidad ?? "", ruc: state.oficina?.ruc ?? "" },
      expedienteId: (state.antecedentes[0] as { expedienteId?: string } | undefined)?.expedienteId ?? null,
      length: state.length,
      nroOficio: state.numeroEfectivo || undefined,
      oficinaId: state.oficinaId,
      remitente: state.oficina?.responsableNombre ?? undefined,
      // Sin tipoDocumento el backend no puede asignar el correlativo
      // (RPC expedientes_next_doc_number es por oficina + tipo).
      tipoDocumento: state.tipoDocumento,
      tone: state.tone,
    });
    if (res.nroOficio) {
      state.setNroOficio(res.nroOficio);
      state.setNroAsignado(true);
    }
    // Recordar el destinatario para autocompletar futuros documentos.
    rememberDestinatario(state.destinatario, state.cargoDestinatario);
    state.reloadSaved();
    state.reloadOficinas?.();
    return { ok: true, nro: res.nroOficio ?? null, numeracionError: res.numeracionError ?? null };
  }

  // Mensaje de la confirmación: el correlativo es un número de serie
  // municipal (RPC `expedientes_next_doc_number`, por oficina + tipo). Una
  // vez asignado no se puede devolver ni reutilizar, así que la primera
  // asignación —tanto al guardar como al descargar— pide visto bueno.
  function confirmarAsignacion(confirmLabel: string, onConfirm: () => void) {
    setConfirmSave({
      title: "Asignar número de documento",
      message:
        "Este documento aún no tiene número. Se le asignará el siguiente correlativo oficial de la oficina — es un número de serie municipal y no se puede deshacer ni reutilizar. ¿Continuar?",
      confirmLabel,
      onConfirm: () => {
        setConfirmSave(null);
        onConfirm();
      },
    });
  }

  async function guardarRespuestaAhora() {
    setSaving(true);
    try {
      const saved = await saveRespuestaNow();
      if (saved.ok && saved.numeracionError) {
        // Se guardó, pero sin número: sin él el documento no se puede emitir,
        // así que no vale con decir "archivada".
        showToast(
          "Respuesta archivada SIN número: no se pudo asignar el correlativo. Revisa la numeración de la oficina en Configuración.",
          "warning",
        );
      } else if (saved.ok) {
        showToast(`Respuesta archivada${saved.nro ? ` como ${saved.nro}` : ""}.`, "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar la respuesta", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleSaveRespuesta() {
    if (!state.nroAsignado) {
      confirmarAsignacion("Asignar y guardar", () => void guardarRespuestaAhora());
      return;
    }
    void guardarRespuestaAhora();
  }

  function handleExport() {
    if (!state.cuerpo.trim()) {
      showToast("No hay cuerpo de respuesta para exportar.", "warning");
      return;
    }
    // Descargar es lo que el usuario pidió, pero por debajo también archiva
    // y asigna número si aún no lo tiene: eso no debe pasar sin que lo sepa.
    if (!state.nroAsignado) {
      confirmarAsignacion("Asignar y descargar", () => void exportarAhora());
      return;
    }
    void exportarAhora();
  }

  async function exportarAhora() {
    setExporting(true);
    try {
      // El documento FINAL siempre queda archivado: si aun no tiene numero,
      // se guarda y numera antes de descargar (asi el PDF/Word sale con el
      // correlativo real y el contenido queda registrado).
      let numero = state.numeroEfectivo;
      if (!state.nroAsignado) {
        const saved = await saveRespuestaNow();
        if (!saved.ok) {
          setExporting(false);
          return;
        }
        if (saved.nro) numero = saved.nro;
        if (saved.numeracionError) {
          // Se descarga igual, pero el documento sale sin correlativo: hay que
          // decirlo antes de que alguien lo firme creyendo que está numerado.
          showToast(
            "Se archivó SIN número: el documento se descargará sin correlativo. Revisa la numeración de la oficina en Configuración.",
            "warning",
          );
        } else {
          showToast(`Documento archivado${saved.nro ? ` como ${saved.nro}` : ""} antes de descargar.`, "info");
        }
      }
      await exportRespuestaDocx({
        // En la CARTA el asunto es opcional; en los demas tipos siempre va.
        asunto:
          state.asunto.trim() ||
          (state.tipoDocumento === "CARTA" ? "" : "Respuesta a su solicitud"),
        // baseLegal NO se envia al export: solo se usa como contexto
        // para la IA en /generate. El usuario la ve en la UI del borrador.
        cargoDestinatario: state.cargoDestinatario.trim() || undefined,
        cargoRemitente: state.oficina?.responsableCargo ?? undefined,
        cuerpo: state.cuerpo.trim(),
        destinatario: state.destinatario.trim() || state.remitenteDoc.trim() || "[DESTINATARIO]",
        entity: { name: state.oficina?.entidad ?? "", ruc: state.oficina?.ruc ?? "" },
        format: state.exportFormat,
        lugar: state.lugar.trim() || undefined,
        nroOficio: numero || undefined,
        oficinaId: state.oficinaId,
        referencia: state.referencia.trim() || undefined,
        remitente: state.oficina?.responsableNombre ?? undefined,
        tipoDocumento: state.tipoDocumento,
      });
      showToast(`Documento .${state.exportFormat} descargado.`, "success");
      rememberDestinatario(state.destinatario, state.cargoDestinatario);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo exportar el documento", "error");
    } finally {
      setExporting(false);
    }
  }

  function openSaved(r: SavedRespuesta) {
    state.setCuerpo(r.cuerpo);
    state.setBaseLegal(Array.isArray(r.base_legal) ? r.base_legal : []);
    state.setAntecedentes((r.antecedentes ?? []) as never);
    state.setAsunto(r.asunto ?? "");
    state.setRemitenteDoc(r.remitente ?? "");
    state.setNroOficio(r.nro_oficio ?? "");
    state.setNroAsignado(Boolean(r.nro_oficio));
    state.setDestinatario(r.destinatario ?? "");
    if (r.tipo_documento && (DOC_TIPOS as readonly string[]).includes(r.tipo_documento)) {
      state.setTipoDocumento(r.tipo_documento as never);
    }
    state.setGenUsage(r.token_usage ?? undefined);
    setResult({
      antecedentes: r.antecedentes as never,
      respuesta: r.cuerpo,
      sources: [],
      tokenUsage: r.token_usage ?? undefined,
    } as never);
    state.setDocumentoTexto(r.documento_texto ?? "");
    state.setAntecedenteId(r.antecedente_id ?? null);
    state.setAntecedenteMeta(null);
    showToast(
      r.version && r.version > 1
        ? `Version v${r.version} cargada en el editor.`
        : "Respuesta cargada en el editor.",
      "info",
    );
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // "Nueva respuesta": única forma de limpiar el editor a propósito. Sin esto
  // no había manera de descartar un borrador sin guardarlo — y el borrador de
  // localStorage resucitaba solo al volver a abrir la pestaña, incluso
  // después de haber archivado la respuesta (ver el comentario en
  // BorradorGuardado sobre el correlativo). Pide confirmación solo si hay
  // algo que se perdería; lo ya guardado sigue intacto en el historial.
  function handleNueva() {
    const ejecutar = () => {
      state.reset();
      setResult(null);
    };
    const hayContenido = Boolean(
      state.cuerpo.trim() || state.documentoTexto.trim() || state.intencion.trim(),
    );
    if (!hayContenido) {
      ejecutar();
      return;
    }
    setConfirmSave({
      title: "¿Empezar una respuesta nueva?",
      message:
        "Se borra lo que hay en el editor y el documento recibido cargado. Si ya guardaste esta respuesta, queda intacta en el historial de abajo — esto solo limpia lo que ves en pantalla.",
      confirmLabel: "Empezar de nuevo",
      onConfirm: ejecutar,
    });
  }

  // Guía visual para usuarios no técnicos: en qué paso del flujo están.
  // Cada chip lleva a su sección al hacer clic.
  const pasos: Array<{ label: string; done: boolean; anchor: string; ready: boolean }> = [
    {
      label: "Sube el documento",
      done: Boolean(state.documentoTexto.trim() || state.antecedenteId),
      anchor: "paso-documento",
      ready: true,
    },
    {
      label: "Di qué responder",
      done: state.intencion.trim().length >= 10,
      anchor: "paso-respuesta",
      ready: true,
    },
    {
      label: "Revisa el borrador",
      done: Boolean(state.cuerpo.trim()),
      anchor: "paso-borrador",
      ready: Boolean(result) || Boolean(state.cuerpo.trim()),
    },
    {
      label: "Numera y descarga",
      done: state.nroAsignado,
      anchor: "paso-emitir",
      ready: Boolean(result) || Boolean(state.cuerpo.trim()),
    },
  ];
  const pasoActual = pasos.findIndex((p) => !p.done);

  function goToPaso(p: (typeof pasos)[number]) {
    if (!p.ready) {
      showToast("Primero genera el borrador con la IA (paso 2).", "info");
      return;
    }
    document.getElementById(p.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={cn("tw", EXP_TAB_CONTENT)}>
      <div
        role="list"
        aria-label="Progreso de la respuesta"
        className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-1.5 bg-exp-panel py-2"
      >
        {pasos.map((p, i) => {
          const isCurrent = i === pasoActual;
          return (
            <button
              key={p.label}
              type="button"
              role="listitem"
              onClick={() => goToPaso(p)}
              title={p.ready ? `Ir a: ${p.label}` : "Disponible cuando generes el borrador"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-xs font-medium transition-colors duration-[120ms] ease-linear",
                p.ready ? "cursor-pointer" : "cursor-not-allowed opacity-55",
                p.done
                  ? "bg-exp-success-soft text-[#065f46]"
                  : isCurrent
                    ? "border-exp-brand bg-exp-brand-soft font-bold text-exp-brand"
                    : "bg-exp-line-soft text-exp-muted",
              )}
            >
              {p.done ? <CheckCircle2 size={13} /> : <span className="font-bold">{i + 1}.</span>}
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={handleNueva}
          title="Limpia el editor y el documento recibido cargado (lo ya guardado no se toca)"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-exp-line bg-exp-panel px-3 py-1 text-xs font-medium text-exp-muted transition-colors duration-[120ms] ease-linear hover:border-exp-brand hover:text-exp-brand"
        >
          <FilePlus2 size={13} />
          Nueva respuesta
        </button>
      </div>

      <ResumenTecnicoBanner
        analisis={state.analisis}
        onDismiss={() => state.setAnalisis(null)}
      />

      <div id="paso-documento" className="scroll-mt-14">
        <DocumentoRecibido
          antecedenteId={state.antecedenteId}
          antecedenteMeta={state.antecedenteMeta}
          analisis={state.analisis}
          documentoTexto={state.documentoTexto}
          handleFile={state.handleFile}
          inputRef={state.inputRef}
          isDragging={state.isDragging}
          reading={state.reading}
          removeAntecedente={state.removeAntecedente}
          setDocumentoTexto={state.setDocumentoTexto}
          setIsDragging={state.setIsDragging}
          showToast={showToast}
        />
      </div>

      <div id="paso-respuesta" className="scroll-mt-14" />
      <ConfiguracionRespuesta
        adjuntos={state.adjuntos}
        asunto={state.asunto}
        clearBorrador={state.clearBorrador}
        cuerpo={state.cuerpo}
        destinoNumero={state.previewNumero}
        intencion={state.intencion}
        isAdminOficinas={state.isAdminOficinas}
        length={state.length}
        normativaIds={state.normativaIds}
        oficina={state.oficina}
        oficinaId={state.oficinaId}
        oficinas={state.oficinas}
        onChangeOficina={state.handleChangeOficina}
        remitenteDoc={state.remitenteDoc}
        setAdjuntos={state.setAdjuntos}
        setIncludeAntecedentes={state.setIncludeAntecedentes}
        setIntencion={state.setIntencion}
        setLength={state.setLength}
        setNormativaIds={state.setNormativaIds}
        setTipoDocumento={state.setTipoDocumento}
        setTone={state.setTone}
        setRemitenteDoc={state.setRemitenteDoc}
        setAsunto={state.setAsunto}
        includeAntecedentes={state.includeAntecedentes}
        tipoDocumento={state.tipoDocumento}
        tone={state.tone}
        totalActivas={state.totalActivas}
        userEntity={state.userEntity}
        showToast={showToast}
        onGenerate={handleGenerate}
        generating={state.generating}
      />

      <div id="paso-borrador" className="scroll-mt-14" />
      {/* Se muestra tambien cuando el cuerpo viene del borrador restaurado
          de localStorage (sin `result` en memoria). */}
      {result || state.cuerpo.trim() ? (
        <BorradorEditor
          antecedentes={state.antecedentes as never}
          baseLegal={state.baseLegal}
          cuerpo={state.cuerpo}
          genUsage={state.genUsage as never}
          intencion={state.intencion}
          oficinaId={state.oficinaId}
          refining={refining}
          savingRespuesta={savingRespuesta}
          setBaseLegal={state.setBaseLegal}
          setCuerpo={state.setCuerpo}
          showToast={showToast}
          tipoDocumento={state.tipoDocumento}
          onRefine={handleRefine}
          onSave={handleSaveRespuesta}
        />
      ) : null}

      <div id="paso-emitir" className="scroll-mt-14" />
      {result || state.cuerpo.trim() ? (
        <DatosDocumento
          asunto={state.asunto}
          cargoDestinatario={state.cargoDestinatario}
          cuerpo={state.cuerpo}
          destinatario={state.destinatario}
          exportFormat={state.exportFormat}
          exporting={exporting}
          lugar={state.lugar}
          nroAsignado={state.nroAsignado}
          numeroEfectivo={state.numeroEfectivo}
          oficina={state.oficina}
          referencia={state.referencia}
          setCargoDestinatario={state.setCargoDestinatario}
          setDestinatario={state.setDestinatario}
          setExportFormat={state.setExportFormat}
          setLugar={state.setLugar}
          setReferencia={state.setReferencia}
          showToast={showToast}
          tipoDocumento={state.tipoDocumento}
          onExport={handleExport}
          onPreviewPdf={handlePreviewPdf}
        />
      ) : null}

      <HistorialRespuestas
        onOpen={openSaved}
        saved={state.saved as never}
        onVersionCreated={() => {
          state.reloadSaved();
        }}
        showToast={showToast}
      />

      {confirmSave ? (
        <ConfirmDialog
          open={true}
          title={confirmSave.title}
          message={confirmSave.message}
          tone="warning"
          confirmLabel={confirmSave.confirmLabel}
          onConfirm={confirmSave.onConfirm}
          onCancel={() => setConfirmSave(null)}
        />
      ) : null}
    </div>
  );
}
