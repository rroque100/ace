"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, KeyRound, Loader, Power, Save, ShieldCheck, UserPlus } from "lucide-react";
import { btnPrimary, btnSecondary, btnSecondarySm, fieldLabel, inputBase, statusBadge } from "./ui";
import { useToastHelpers } from "@/lib/toast";
import { LISTA_MODULOS_EXTERNOS, MODULOS_EXTERNOS, type ModuloExterno } from "@/lib/modulos-acceso";
import { mensajeBienvenida } from "@/lib/solicitud-acceso";
import { USUARIO_LONGITUD } from "@/lib/usuario-credencial";
import { ConfirmDialog } from "../confirm-dialog";
import { CuentaCreadaCard } from "./cuenta-creada-card";
import { SolicitudesAccesoPanel } from "./solicitudes-acceso-panel";

// Usuarios externos: alta con módulos, vigencia y cuota de IA; consumo del mes; y auditoría (IP, acciones, consumo por
// módulo). Todo lo decide el servidor: aquí solo se pide y se muestra. Ver docs/supabase/usuarios-externos.sql.

type ConsumoModulo = { modulo: string; llamadas: number; tokens: number; costo: number; conEstimados: boolean };
type Externo = {
  id: string; usuario: string | null; nombre: string | null; activo: boolean; modulos: string[]; vigenteHasta: string | null; cuotaIAMensual: number | null;
  consumoMes: { llamadas: number; tokens: number; costo: number; modulos: ConsumoModulo[] }; ultimoAcceso: { ip: string | null; en: string } | null;
};
type Evento = { creado_en: string; usuario_id: string; usuario: string | null; modulo: string | null; accion: string; ruta: string | null; ip: string | null; user_agent: string | null; estado: number | null };
type Auditoria = {
  sqlPendiente?: boolean; aviso?: string; eventos: Evento[]; hayMas: boolean;
  consumo: { usuarios: Array<{ usuarioId: string; llamadas: number; tokens: number; costo: number; modulos: ConsumoModulo[] }>; total: { llamadas: number; tokens: number; costo: number } };
  usuarios: Array<{ id: string; usuario: string | null; nombre: string | null }>;
};

const numero = (n: number) => n.toLocaleString("es-PE");
const dolares = (n: number) => (n < 0.01 && n > 0 ? "< US$ 0,01" : `US$ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
const etiquetaModulo = (modulo: string | null) => (modulo && modulo in MODULOS_EXTERNOS ? MODULOS_EXTERNOS[modulo as ModuloExterno].label : modulo ?? "—");
const hoyISO = () => new Date().toISOString().slice(0, 10);

export function ExternosTab() {
  const { success, error: toastError } = useToastHelpers();
  const [ahora] = useState(() => Date.now());
  const [externos, setExternos] = useState<Externo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sqlPendiente, setSqlPendiente] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Alta
  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [modulos, setModulos] = useState<ModuloExterno[]>(["centro_juridico"]);
  const [fin, setFin] = useState("");
  const [cuota, setCuota] = useState("");
  const [creando, setCreando] = useState(false);
  const [creada, setCreada] = useState<{ nombre: string | null; usuario: string; password: string; mensaje: string } | null>(null);
  const creadaRef = useRef<HTMLDivElement>(null);

  // Restablecer contraseña
  const [aRestablecer, setARestablecer] = useState<Externo | null>(null);

  // Edición en línea
  const [editando, setEditando] = useState<string | null>(null);
  const [edModulos, setEdModulos] = useState<ModuloExterno[]>([]);
  const [edFin, setEdFin] = useState("");
  const [edCuota, setEdCuota] = useState("");

  // Auditoría
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroIp, setFiltroIp] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [auditoria, setAuditoria] = useState<Auditoria | null>(null);
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false);
  const [pagina, setPagina] = useState(0);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const respuesta = await fetch("/api/configuracion/externos", { cache: "no-store" });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo cargar la lista");
      setSqlPendiente(Boolean(datos.sqlPendiente));
      setExternos(datos.externos ?? []);
    } catch (error) {
      setErrorCarga(error instanceof Error ? error.message : "No se pudo cargar la lista");
    } finally {
      setCargando(false);
    }
  }, []);

  const consultaAuditoria = useCallback((formato?: "csv", paginaActual = 0) => {
    const parametros = new URLSearchParams();
    if (filtroUsuario) parametros.set("usuarioId", filtroUsuario);
    if (filtroModulo) parametros.set("modulo", filtroModulo);
    if (filtroIp.trim()) parametros.set("ip", filtroIp.trim());
    if (desde) parametros.set("desde", `${desde}T00:00:00-05:00`);
    if (hasta) parametros.set("hasta", `${hasta}T23:59:59-05:00`);
    if (formato) parametros.set("formato", formato);
    else { parametros.set("limite", "100"); parametros.set("pagina", String(paginaActual)); }
    return `/api/configuracion/externos/auditoria?${parametros.toString()}`;
  }, [filtroUsuario, filtroModulo, filtroIp, desde, hasta]);

  const cargarAuditoria = useCallback(async (paginaActual = 0) => {
    setCargandoAuditoria(true);
    try {
      const respuesta = await fetch(consultaAuditoria(undefined, paginaActual), { cache: "no-store" });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo cargar la auditoría");
      setAuditoria((previa) => (paginaActual > 0 && previa ? { ...datos, eventos: [...previa.eventos, ...datos.eventos] } : datos));
      setPagina(paginaActual);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "No se pudo cargar la auditoría");
    } finally {
      setCargandoAuditoria(false);
    }
  }, [consultaAuditoria, toastError]);

  useEffect(() => { void cargar(); }, [cargar]);
  // Al aparecer la contraseña temporal (el alta está más abajo) se lleva a la vista.
  useEffect(() => { if (creada) creadaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [creada]);
  useEffect(() => { void cargarAuditoria(0); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nombres = useMemo(() => new Map(externos.map((e) => [e.id, e.usuario ?? e.id])), [externos]);

  function alternarModulo(lista: ModuloExterno[], modulo: ModuloExterno, poner: (m: ModuloExterno[]) => void) {
    poner(lista.includes(modulo) ? lista.filter((m) => m !== modulo) : [...lista, modulo]);
  }

  async function crear(evento: React.FormEvent) {
    evento.preventDefault();
    setCreando(true);
    setCreada(null);
    try {
      const respuesta = await fetch("/api/configuracion/externos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario, nombreCompleto: nombre, modulos,
          vigenteHasta: fin ? `${fin}T23:59:59-05:00` : null,
          cuotaIAMensual: cuota.trim() === "" ? null : Number(cuota),
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo crear la cuenta");
      if (datos.passwordTemporal) {
        setCreada({
          nombre: nombre || null,
          usuario: datos.usuario,
          password: datos.passwordTemporal,
          mensaje: mensajeBienvenida({
            nombre: nombre || null,
            usuario: datos.usuario,
            passwordTemporal: datos.passwordTemporal,
            urlLogin: `${window.location.origin}/login`,
            modulos,
            vigenteHasta: fin ? `${fin}T23:59:59-05:00` : null,
          }),
        });
      }
      success("Cuenta externa creada");
      setUsuario(""); setNombre(""); setFin(""); setCuota(""); setModulos(["centro_juridico"]);
      await cargar();
    } catch (error) {
      toastError(error instanceof Error ? error.message : "No se pudo crear la cuenta");
    } finally {
      setCreando(false);
    }
  }

  function empezarEdicion(externo: Externo) {
    setEditando(externo.id);
    setEdModulos(externo.modulos.filter((m): m is ModuloExterno => m in MODULOS_EXTERNOS));
    setEdFin(externo.vigenteHasta ? externo.vigenteHasta.slice(0, 10) : "");
    setEdCuota(externo.cuotaIAMensual === null ? "" : String(externo.cuotaIAMensual));
  }

  async function guardarEdicion(id: string) {
    try {
      const respuesta = await fetch(`/api/configuracion/externos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulos: edModulos, vigenteHasta: edFin ? `${edFin}T23:59:59-05:00` : null, cuotaIAMensual: edCuota.trim() === "" ? null : Number(edCuota) }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo guardar");
      success(`Guardado. Se aplica en ${datos.aplicaEn}`);
      setEditando(null);
      await cargar();
    } catch (error) {
      toastError(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }

  async function cambiarEstado(externo: Externo) {
    try {
      const respuesta = await fetch(`/api/configuracion/users/${externo.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !externo.activo }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo cambiar el estado");
      success(externo.activo ? "Cuenta desactivada: ya no puede entrar" : "Cuenta activada");
      await cargar();
    } catch (error) {
      toastError(error instanceof Error ? error.message : "No se pudo cambiar el estado");
    }
  }

  // La contraseña nueva es temporal: en su próximo ingreso la persona deberá elegir la suya (lo impone el servidor). Se muestra
  // una sola vez, con el mismo mensaje de entrega que el alta.
  async function restablecerPassword(externo: Externo) {
    setARestablecer(null);
    try {
      const respuesta = await fetch(`/api/configuracion/users/${externo.id}/password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo restablecer la contraseña");
      setCreada({
        nombre: externo.nombre,
        usuario: externo.usuario ?? "",
        password: datos.password,
        mensaje: mensajeBienvenida({
          nombre: externo.nombre,
          usuario: externo.usuario ?? "",
          passwordTemporal: datos.password,
          urlLogin: `${window.location.origin}/login`,
          modulos: externo.modulos,
          vigenteHasta: externo.vigenteHasta,
        }),
      });
      success("Contraseña restablecida: la anterior ya no funciona");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "No se pudo restablecer la contraseña");
    }
  }

  const hoy = hoyISO();

  return (
    <div className="flex flex-col gap-6">
      {sqlPendiente ? (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2.5 text-sm leading-[1.45]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>Falta ejecutar <strong>docs/supabase/usuarios-externos.sql</strong> en el SQL Editor de Supabase. Hasta entonces no se pueden crear cuentas externas ni auditarlas.</span>
        </p>
      ) : null}
      {errorCarga ? <p role="alert" className="text-sm text-danger">{errorCarga}</p> : null}

      {/* Arriba del todo y a la vista: la contraseña temporal se muestra una sola vez, venga del alta, de una solicitud o de un restablecimiento. */}
      {creada ? (
        <div ref={creadaRef}>
          <CuentaCreadaCard nombre={creada.nombre} usuario={creada.usuario} passwordTemporal={creada.password} mensaje={creada.mensaje} onCerrar={() => setCreada(null)} />
        </div>
      ) : null}

      <SolicitudesAccesoPanel onCuentaCreada={() => void cargar()} />

      <section aria-labelledby="externos-alta" className="rounded-lg border border-line bg-panel p-4">
        <h3 id="externos-alta" className="mb-1 flex items-center gap-2 text-base font-bold"><UserPlus size={18} aria-hidden /> Nueva cuenta externa</h3>
        <p className="mb-3 text-sm text-muted">Entra solo a los módulos que marques. No ve nada del personal de la entidad. Su IP y su actividad quedan registradas, y consume IA hasta la cuota mensual que fijes.</p>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
          <label className={fieldLabel}>
            <span className="text-sm font-semibold">Usuario (DNI de {USUARIO_LONGITUD} dígitos)</span>
            <input className={inputBase} value={usuario} onChange={(e) => setUsuario(e.target.value.replace(/\D/g, "").slice(0, USUARIO_LONGITUD))} inputMode="numeric" required />
          </label>
          <label className={fieldLabel}>
            <span className="text-sm font-semibold">Nombre (opcional)</span>
            <input className={inputBase} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={160} />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-sm font-semibold">Módulos con acceso</legend>
            <div className="flex flex-wrap gap-4">
              {LISTA_MODULOS_EXTERNOS.map((modulo) => (
                <label key={modulo} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={modulos.includes(modulo)} onChange={() => alternarModulo(modulos, modulo, setModulos)} />
                  <span><strong>{MODULOS_EXTERNOS[modulo].label}</strong><br /><span className="text-muted">{MODULOS_EXTERNOS[modulo].descripcion}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className={fieldLabel}>
            <span className="text-sm font-semibold">Acceso hasta (opcional)</span>
            <input className={inputBase} type="date" min={hoy} value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
          <label className={fieldLabel}>
            <span className="text-sm font-semibold">Cuota mensual de IA, en tokens (opcional)</span>
            <input className={inputBase} inputMode="numeric" value={cuota} onChange={(e) => setCuota(e.target.value.replace(/\D/g, ""))} placeholder="vacío = sin tope · 0 = sin IA" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={btnPrimary} disabled={creando || modulos.length === 0 || usuario.length !== USUARIO_LONGITUD}>
              {creando ? <Loader size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />} Crear cuenta
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="externos-lista">
        <h3 id="externos-lista" className="mb-2 flex items-center gap-2 text-base font-bold"><ShieldCheck size={18} aria-hidden /> Cuentas externas</h3>
        {cargando ? <p className="text-sm text-muted">Cargando…</p> : externos.length === 0 ? <p className="text-sm text-muted">Todavía no hay cuentas externas.</p> : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                <tr><th className="p-2.5">Usuario</th><th className="p-2.5">Módulos</th><th className="p-2.5">Vigencia</th><th className="p-2.5">IA del mes</th><th className="p-2.5">Último acceso</th><th className="p-2.5">Acciones</th></tr>
              </thead>
              <tbody>
                {externos.map((externo) => {
                  const vencido = externo.vigenteHasta ? Date.parse(externo.vigenteHasta) <= ahora : false;
                  const porcentaje = externo.cuotaIAMensual ? Math.min(100, Math.round((externo.consumoMes.tokens / externo.cuotaIAMensual) * 100)) : null;
                  return (
                    <tr key={externo.id} className="border-t border-line align-top">
                      <td className="p-2.5"><strong>{externo.usuario}</strong>{externo.nombre ? <><br /><span className="text-muted">{externo.nombre}</span></> : null}<br /><span className={statusBadge(externo.activo)}>{externo.activo ? "Activa" : "Desactivada"}</span></td>
                      <td className="p-2.5">{editando === externo.id ? (
                        <div className="flex flex-col gap-1">{LISTA_MODULOS_EXTERNOS.map((modulo) => <label key={modulo} className="flex items-center gap-2"><input type="checkbox" checked={edModulos.includes(modulo)} onChange={() => alternarModulo(edModulos, modulo, setEdModulos)} />{MODULOS_EXTERNOS[modulo].label}</label>)}</div>
                      ) : externo.modulos.length ? externo.modulos.map((m) => <span key={m} className={`${statusBadge(true)} mr-1`}>{etiquetaModulo(m)}</span>) : <span className="text-danger">Sin módulos</span>}</td>
                      <td className="p-2.5">{editando === externo.id ? <input className={inputBase} type="date" value={edFin} onChange={(e) => setEdFin(e.target.value)} /> : externo.vigenteHasta ? <>{new Date(externo.vigenteHasta).toLocaleDateString("es-PE")}{vencido ? <><br /><span className="text-danger font-semibold">Vencida</span></> : null}</> : "Sin fecha de fin"}</td>
                      <td className="p-2.5">{editando === externo.id ? <input className={inputBase} inputMode="numeric" value={edCuota} onChange={(e) => setEdCuota(e.target.value.replace(/\D/g, ""))} placeholder="sin tope" /> : <>{numero(externo.consumoMes.tokens)} tokens{externo.cuotaIAMensual !== null ? <> de {numero(externo.cuotaIAMensual)} ({porcentaje}%)</> : " · sin tope"}<br /><span className="text-muted">{externo.consumoMes.llamadas} llamadas · {dolares(externo.consumoMes.costo)} est.</span></>}</td>
                      <td className="p-2.5">{externo.ultimoAcceso ? <>{externo.ultimoAcceso.ip ?? "IP desconocida"}<br /><span className="text-muted">{fechaHora(externo.ultimoAcceso.en)}</span></> : <span className="text-muted">Nunca</span>}</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {editando === externo.id ? (
                            <><button type="button" className={btnSecondarySm} onClick={() => void guardarEdicion(externo.id)}><Save size={14} aria-hidden /> Guardar</button><button type="button" className={btnSecondarySm} onClick={() => setEditando(null)}>Cancelar</button></>
                          ) : (
                            <><button type="button" className={btnSecondarySm} onClick={() => empezarEdicion(externo)}>Editar</button>
                            <button type="button" className={btnSecondarySm} onClick={() => { setFiltroUsuario(externo.id); void Promise.resolve().then(() => cargarAuditoria(0)); }}>Auditoría</button>
                            <button type="button" className={btnSecondarySm} onClick={() => setARestablecer(externo)}><KeyRound size={14} aria-hidden /> Contraseña</button>
                            <button type="button" className={btnSecondarySm} onClick={() => void cambiarEstado(externo)}><Power size={14} aria-hidden /> {externo.activo ? "Desactivar" : "Activar"}</button></>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Los cambios de módulos, vigencia y cuota se aplican en la próxima renovación de la sesión de la persona (hasta 1 hora). Para cortar el acceso al instante, desactiva la cuenta.</p>
      </section>

      <section aria-labelledby="externos-auditoria" className="rounded-lg border border-line bg-panel p-4">
        <h3 id="externos-auditoria" className="mb-1 text-base font-bold">Auditoría de cuentas externas</h3>
        <p className="mb-3 text-sm text-muted">Desde qué IP entra cada cuenta, qué hace y cuánta IA consume en cada módulo. Los eventos se conservan 12 meses.</p>
        <form className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); void cargarAuditoria(0); }}>
          <label className={fieldLabel}><span className="text-sm font-semibold">Cuenta</span>
            <select className={inputBase} value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}><option value="">Todas</option>{externos.map((e) => <option key={e.id} value={e.id}>{e.usuario}</option>)}</select></label>
          <label className={fieldLabel}><span className="text-sm font-semibold">Módulo</span>
            <select className={inputBase} value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)}><option value="">Todos</option>{LISTA_MODULOS_EXTERNOS.map((m) => <option key={m} value={m}>{MODULOS_EXTERNOS[m].label}</option>)}</select></label>
          <label className={fieldLabel}><span className="text-sm font-semibold">IP</span><input className={inputBase} value={filtroIp} onChange={(e) => setFiltroIp(e.target.value)} placeholder="190.12.5.7" /></label>
          <label className={fieldLabel}><span className="text-sm font-semibold">Desde</span><input className={inputBase} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className={fieldLabel}><span className="text-sm font-semibold">Hasta</span><input className={inputBase} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2 sm:col-span-3 lg:col-span-5">
            <button type="submit" className={btnSecondary} disabled={cargandoAuditoria}>{cargandoAuditoria ? <Loader size={16} className="animate-spin" aria-hidden /> : null} Consultar</button>
            <a className={btnSecondary} href={consultaAuditoria("csv")}><Download size={16} aria-hidden /> Exportar CSV</a>
          </div>
        </form>

        {auditoria?.sqlPendiente ? <p role="alert" className="text-sm text-danger">{auditoria.aviso}</p> : null}
        {auditoria && !auditoria.sqlPendiente ? (
          <>
            <h4 className="mb-1 text-sm font-bold">Consumo de IA en el período · {numero(auditoria.consumo.total.tokens)} tokens · {dolares(auditoria.consumo.total.costo)} est.</h4>
            {auditoria.consumo.usuarios.length === 0 ? <p className="mb-4 text-sm text-muted">Sin consumo en este período.</p> : (
              <div className="mb-4 overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wide text-muted"><tr><th className="p-2">Cuenta</th><th className="p-2">Módulo</th><th className="p-2 text-right">Llamadas</th><th className="p-2 text-right">Tokens</th><th className="p-2 text-right">Costo est.</th></tr></thead>
                  <tbody>{auditoria.consumo.usuarios.flatMap((u) => u.modulos.map((m, i) => (
                    <tr key={`${u.usuarioId}-${m.modulo}`} className="border-t border-line"><td className="p-2">{i === 0 ? <strong>{nombres.get(u.usuarioId) ?? auditoria.usuarios.find((x) => x.id === u.usuarioId)?.usuario ?? u.usuarioId}</strong> : null}</td><td className="p-2">{etiquetaModulo(m.modulo)}</td><td className="p-2 text-right">{numero(m.llamadas)}</td><td className="p-2 text-right">{numero(m.tokens)}{m.conEstimados ? <span title="Incluye tokens estimados: el proveedor no los informó"> ≈</span> : null}</td><td className="p-2 text-right">{dolares(m.costo)}</td></tr>
                  )))}</tbody>
                </table>
              </div>
            )}

            <h4 className="mb-1 text-sm font-bold">Actividad</h4>
            {auditoria.eventos.length === 0 ? <p className="text-sm text-muted">Sin actividad en este período.</p> : (
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wide text-muted"><tr><th className="p-2">Fecha</th><th className="p-2">Cuenta</th><th className="p-2">Módulo</th><th className="p-2">Acción</th><th className="p-2">IP</th><th className="p-2">Navegador</th></tr></thead>
                  <tbody>{auditoria.eventos.map((e, i) => (
                    <tr key={`${e.creado_en}-${i}`} className="border-t border-line align-top"><td className="p-2 whitespace-nowrap">{fechaHora(e.creado_en)}</td><td className="p-2">{e.usuario ?? e.usuario_id}</td><td className="p-2">{etiquetaModulo(e.modulo)}</td><td className="p-2 break-all">{e.accion}</td><td className="p-2 whitespace-nowrap">{e.ip ?? "—"}</td><td className="p-2 max-w-[260px] truncate text-muted" title={e.user_agent ?? ""}>{e.user_agent ?? "—"}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {auditoria.hayMas ? <button type="button" className={`${btnSecondary} mt-3`} disabled={cargandoAuditoria} onClick={() => void cargarAuditoria(pagina + 1)}>Cargar más</button> : null}
          </>
        ) : null}
      </section>
      <ConfirmDialog
        open={aRestablecer !== null}
        title="Restablecer contraseña"
        message={aRestablecer ? `Se generará una contraseña temporal para ${aRestablecer.nombre?.trim() || aRestablecer.usuario}. La actual dejará de funcionar, la nueva se muestra una sola vez y al entrar la persona deberá elegir una propia.` : ""}
        tone="warning"
        confirmLabel="Restablecer"
        onConfirm={() => { if (aRestablecer) void restablecerPassword(aRestablecer); }}
        onCancel={() => setARestablecer(null)}
      />
    </div>
  );
}
