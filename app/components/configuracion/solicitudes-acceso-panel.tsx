"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Inbox, Link2, Loader, Mail, X } from "lucide-react";
import { btnPrimary, btnSecondary, btnSecondarySm, fieldLabel, inputBase, inputSelect, statusBadge } from "./ui";
import { useToastHelpers } from "@/lib/toast";
import { LISTA_MODULOS_EXTERNOS, MODULOS_EXTERNOS, type ModuloExterno } from "@/lib/modulos-acceso";

// Bandeja de las solicitudes que la gente envía desde el formulario público /acceso. Aprobar crea la cuenta (con lo que el
// administrador decida aquí, no necesariamente lo que se pidió) y muestra UNA vez la contraseña temporal junto con el
// mensaje listo para entregar. Todo lo decide el servidor: aquí solo se pide y se muestra.

type Solicitud = {
  id: string; codigo: string; creadoEn: string; nombre: string; dni: string; correo: string; celular: string | null; institucion: string | null;
  modulos: string[]; motivo: string; estado: "pendiente" | "aprobada" | "rechazada"; resueltaEn: string | null; motivoRechazo: string | null; ip: string | null;
};
type Bandeja = { sqlPendiente: boolean; aviso?: string; pendientes: number; solicitudes: Solicitud[] };
type Resultado = { usuario: string; nombre: string; passwordTemporal: string; mensaje: string; correo: string; celular: string | null };

const FILTROS = [["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"], ["todas", "Todas"]] as const;
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
const etiqueta = (modulo: string) => (modulo in MODULOS_EXTERNOS ? MODULOS_EXTERNOS[modulo as ModuloExterno].label : modulo);
const hoyISO = () => new Date().toISOString().slice(0, 10);

export function SolicitudesAccesoPanel({ onCuentaCreada }: { onCuentaCreada: () => void }) {
  const { success, error: toastError } = useToastHelpers();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number][0]>("pendiente");
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [aprobando, setAprobando] = useState<string | null>(null);
  const [modulos, setModulos] = useState<ModuloExterno[]>([]);
  const [fin, setFin] = useState("");
  const [cuota, setCuota] = useState("");
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const respuesta = await fetch(`/api/configuracion/externos/solicitudes?estado=${filtro}`, { cache: "no-store" });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudieron cargar las solicitudes");
      setBandeja(datos);
    } catch (error) {
      setErrorCarga(error instanceof Error ? error.message : "No se pudieron cargar las solicitudes");
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => { void cargar(); }, [cargar]);

  function empezarAprobacion(solicitud: Solicitud) {
    setRechazando(null);
    setAprobando(solicitud.id);
    setModulos(solicitud.modulos.filter((m): m is ModuloExterno => m in MODULOS_EXTERNOS));
    setFin("");
    setCuota("");
  }

  async function resolver(solicitud: Solicitud, cuerpo: Record<string, unknown>) {
    setProcesando(solicitud.id);
    try {
      const respuesta = await fetch(`/api/configuracion/externos/solicitudes/${solicitud.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo resolver la solicitud");
      if (cuerpo.accion === "aprobar") {
        setResultado({ usuario: datos.usuario, nombre: solicitud.nombre, passwordTemporal: datos.passwordTemporal, mensaje: datos.mensaje, correo: datos.correo, celular: datos.celular });
        success("Solicitud aprobada: cuenta creada");
        onCuentaCreada();
      } else {
        success("Solicitud rechazada");
      }
      setAprobando(null);
      setRechazando(null);
      setMotivo("");
      await cargar();
    } catch (error) {
      toastError(error instanceof Error ? error.message : "No se pudo resolver la solicitud");
    } finally {
      setProcesando(null);
    }
  }

  const copiar = (texto: string, aviso: string) => void navigator.clipboard?.writeText(texto).then(() => success(aviso));
  const enlaceSolicitud = () => `${window.location.origin}/acceso`;

  return (
    <section aria-labelledby="solicitudes-titulo" className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 id="solicitudes-titulo" className="flex items-center gap-2 text-base font-bold">
          <Inbox size={18} aria-hidden /> Solicitudes de acceso
          {bandeja && bandeja.pendientes > 0 ? <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white" aria-label={`${bandeja.pendientes} pendientes`}>{bandeja.pendientes}</span> : null}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${inputSelect} w-auto`} value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Filtrar solicitudes">
            {FILTROS.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
          </select>
          <button type="button" className={btnSecondarySm} onClick={() => copiar(enlaceSolicitud(), "Enlace copiado")}><Link2 size={14} aria-hidden /> Copiar enlace de solicitud</button>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted">
        Quien aún no tiene cuenta la pide en <code className="font-mono">/acceso</code>. Nada se crea hasta que apruebes: tú decides los módulos, la vigencia y la cuota.
      </p>

      {bandeja?.sqlPendiente ? (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2.5 text-sm leading-[1.45]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>Falta ejecutar <strong>docs/supabase/solicitudes-acceso.sql</strong> en el SQL Editor de Supabase. Hasta entonces el formulario público no recibe solicitudes.</span>
        </p>
      ) : null}
      {errorCarga ? <p role="alert" className="text-sm text-danger">{errorCarga}</p> : null}

      {resultado ? (
        <div role="status" className="mb-4 rounded-md border border-brand/40 bg-brand-soft p-3.5">
          <p className="mb-1 flex items-center gap-2 font-bold"><CheckCircle2 size={18} className="text-brand" aria-hidden /> Cuenta creada para {resultado.nombre}</p>
          <p className="mb-2 text-sm text-muted">La contraseña temporal se muestra <strong>una sola vez</strong>. Entrega el mensaje de abajo: al entrar, la persona deberá elegir su propia contraseña.</p>
          <textarea readOnly className={`${inputBase} min-h-[190px] font-mono text-sm`} value={resultado.mensaje} onFocus={(e) => e.currentTarget.select()} aria-label="Mensaje para la persona" />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={() => copiar(resultado.mensaje, "Mensaje copiado")}><Copy size={16} aria-hidden /> Copiar mensaje</button>
            <a className={btnSecondary} href={`mailto:${resultado.correo}?subject=${encodeURIComponent("Tu acceso a ACE IA Jurídica")}&body=${encodeURIComponent(resultado.mensaje)}`}><Mail size={16} aria-hidden /> Escribir correo a {resultado.correo}</a>
            <button type="button" className={btnSecondary} onClick={() => setResultado(null)}>Ya lo entregué</button>
          </div>
          {resultado.celular ? <p className="mb-0 mt-2 text-sm text-muted">Celular de contacto: {resultado.celular}</p> : null}
        </div>
      ) : null}

      {cargando && !bandeja ? <p className="text-sm text-muted">Cargando…</p> : null}
      {bandeja && !bandeja.sqlPendiente && bandeja.solicitudes.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-muted">{filtro === "pendiente" ? "No hay solicitudes pendientes." : "No hay solicitudes en este estado."}</p>
      ) : null}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {bandeja?.solicitudes.map((solicitud) => (
          <li key={solicitud.id} className="rounded-md border border-line bg-white p-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <strong className="text-md">{solicitud.nombre}</strong>
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-muted">{solicitud.codigo}</code>
              {solicitud.estado === "pendiente" ? <span className="inline-flex rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">Pendiente</span> : <span className={statusBadge(solicitud.estado === "aprobada")}>{solicitud.estado === "aprobada" ? "Aprobada" : "Rechazada"}</span>}
              <span className="text-sm text-muted">{fechaHora(solicitud.creadoEn)}</span>
            </div>
            <dl className="m-0 mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex gap-2"><dt className="text-muted">DNI</dt><dd className="m-0 font-semibold">{solicitud.dni}</dd></div>
              <div className="flex gap-2"><dt className="text-muted">Correo</dt><dd className="m-0 break-all font-semibold">{solicitud.correo}</dd></div>
              {solicitud.celular ? <div className="flex gap-2"><dt className="text-muted">Celular</dt><dd className="m-0 font-semibold">{solicitud.celular}</dd></div> : null}
              {solicitud.institucion ? <div className="flex gap-2"><dt className="text-muted">Institución</dt><dd className="m-0 font-semibold">{solicitud.institucion}</dd></div> : null}
              {solicitud.ip ? <div className="flex gap-2"><dt className="text-muted">IP</dt><dd className="m-0">{solicitud.ip}</dd></div> : null}
            </dl>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-muted">Pide:</span>
              {solicitud.modulos.map((modulo) => <span key={modulo} className={statusBadge(true)}>{etiqueta(modulo)}</span>)}
            </div>
            <blockquote className="m-0 mt-2 border-l-2 border-line pl-3 text-sm leading-[1.5] text-ink">{solicitud.motivo}</blockquote>
            {solicitud.estado === "rechazada" && solicitud.motivoRechazo ? <p className="mb-0 mt-2 text-sm text-muted">Motivo del rechazo: {solicitud.motivoRechazo}</p> : null}

            {solicitud.estado === "pendiente" && aprobando !== solicitud.id && rechazando !== solicitud.id ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={() => empezarAprobacion(solicitud)}><Check size={16} aria-hidden /> Aprobar…</button>
                <button type="button" className={btnSecondary} onClick={() => { setAprobando(null); setRechazando(solicitud.id); setMotivo(""); }}><X size={16} aria-hidden /> Rechazar</button>
              </div>
            ) : null}

            {aprobando === solicitud.id ? (
              <form className="mt-3 grid gap-3 rounded-md border border-line bg-surface p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void resolver(solicitud, { accion: "aprobar", modulos, vigenteHasta: fin ? `${fin}T23:59:59-05:00` : null, cuotaIAMensual: cuota.trim() === "" ? null : Number(cuota) }); }}>
                <fieldset className="m-0 min-w-0 border-0 p-0 sm:col-span-2">
                  <legend className="mb-1 text-sm font-semibold">Módulos que concedes</legend>
                  <div className="flex flex-wrap gap-4">
                    {LISTA_MODULOS_EXTERNOS.map((modulo) => (
                      <label key={modulo} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={modulos.includes(modulo)} onChange={() => setModulos((actuales) => actuales.includes(modulo) ? actuales.filter((m) => m !== modulo) : [...actuales, modulo])} />
                        {MODULOS_EXTERNOS[modulo].label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className={fieldLabel}><span className="text-sm font-semibold">Acceso hasta (opcional)</span><input className={inputBase} type="date" min={hoyISO()} value={fin} onChange={(e) => setFin(e.target.value)} /></label>
                <label className={fieldLabel}><span className="text-sm font-semibold">Cuota mensual de IA, en tokens (opcional)</span><input className={inputBase} inputMode="numeric" value={cuota} onChange={(e) => setCuota(e.target.value.replace(/\D/g, ""))} placeholder="vacío = sin tope · 0 = sin IA" /></label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button type="submit" className={btnPrimary} disabled={procesando === solicitud.id || modulos.length === 0}>{procesando === solicitud.id ? <Loader size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />} Aprobar y crear cuenta</button>
                  <button type="button" className={btnSecondary} onClick={() => setAprobando(null)} disabled={procesando === solicitud.id}>Cancelar</button>
                </div>
              </form>
            ) : null}

            {rechazando === solicitud.id ? (
              <form className="mt-3 grid gap-3 rounded-md border border-line bg-surface p-3" onSubmit={(e) => { e.preventDefault(); void resolver(solicitud, { accion: "rechazar", motivo }); }}>
                <label className={fieldLabel}><span className="text-sm font-semibold">Motivo (opcional, queda registrado)</span><input className={inputBase} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="p. ej. No corresponde a un usuario de la entidad" /></label>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={btnPrimary} disabled={procesando === solicitud.id}>{procesando === solicitud.id ? <Loader size={16} className="animate-spin" aria-hidden /> : <X size={16} aria-hidden />} Rechazar solicitud</button>
                  <button type="button" className={btnSecondary} onClick={() => setRechazando(null)} disabled={procesando === solicitud.id}>Cancelar</button>
                </div>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
