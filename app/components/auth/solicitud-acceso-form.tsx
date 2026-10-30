"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck, GraduationCap, KeyRound, Loader2, Mail, Scale, Send, UserCheck } from "lucide-react";
import { LISTA_MODULOS_EXTERNOS, MODULOS_EXTERNOS, type ModuloExterno } from "@/lib/modulos-acceso";
import { solicitudSchema } from "@/lib/solicitud-acceso";
import { normalizarUsuario, USUARIO_LONGITUD } from "@/lib/usuario-credencial";
import { AuthAlert, authAyuda, authBoton, authEnlace, authErrorCampo, authInput, authInputError, authLabel, authTitulo } from "./auth-ui";

// Pedir acceso a ACE. No crea ninguna cuenta: deja una solicitud que el administrador aprueba o rechaza. Por eso el aviso
// final no promete nada («recibirás acceso») sino lo que de verdad pasa («revisaremos tu solicitud»).

const ICONOS: Record<ModuloExterno, typeof Scale> = { centro_juridico: Scale, simulacro: GraduationCap };
// El simulacro tiene el permiso y la pantalla reservados, pero todavía no está construido: se dice de frente.
const PROXIMAMENTE: Partial<Record<ModuloExterno, boolean>> = { simulacro: true };

type Valores = { nombre: string; dni: string; correo: string; celular: string; institucion: string; motivo: string; modulos: ModuloExterno[]; consentimiento: boolean };
type Campo = keyof Valores;

const VACIO: Valores = { nombre: "", dni: "", correo: "", celular: "", institucion: "", motivo: "", modulos: [], consentimiento: false };
const MAX_MOTIVO = 500;

/** Los errores de cada campo según el esquema del servidor: la pantalla y la ruta validan exactamente lo mismo. */
function erroresDe(valores: Valores): Partial<Record<Campo, string>> {
  const resultado = solicitudSchema.safeParse(valores);
  if (resultado.success) return {};
  const errores: Partial<Record<Campo, string>> = {};
  for (const problema of resultado.error.issues) {
    const campo = problema.path[0] as Campo | undefined;
    if (campo && !errores[campo]) errores[campo] = problema.message;
  }
  return errores;
}

export function SolicitudAccesoForm() {
  const [valores, setValores] = useState<Valores>(VACIO);
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({});
  const [errorServidor, setErrorServidor] = useState<{ campo?: Campo; mensaje: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  // Cuándo se abrió el formulario: un envío instantáneo no lo hizo una persona (ver decidirSolicitud en el servidor).
  // `performance.now()` y `event.timeStamp` comparten origen, así que su resta es el tiempo que pasó con la pantalla abierta.
  const [abiertoEn] = useState(() => performance.now());

  const errores = erroresDe(valores);
  // El error que se ve de un campo: el que devolvió el servidor, o el de la validación local una vez que la persona pasó por él.
  const ver = (campo: Campo): string | undefined => {
    const delServidor = errorServidor?.campo === campo ? errorServidor.mensaje : undefined;
    return delServidor ?? (tocados[campo] ? errores[campo] : undefined);
  };
  const poner = <K extends Campo>(campo: K, valor: Valores[K]) => {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    if (errorServidor?.campo === campo) setErrorServidor(null);
  };
  const tocar = (campo: Campo) => setTocados((previos) => ({ ...previos, [campo]: true }));
  // Al salir de un campo solo se valida si ya tiene texto. Un campo VACÍO se marca al enviar: si el error apareciera al
  // perder el foco, el mensaje empujaría el botón «Enviar» hacia abajo entre que se pulsa y se suelta, y el clic se perdería.
  const alSalir = (campo: "nombre" | "dni" | "correo" | "celular" | "institucion" | "motivo") => () => { if (valores[campo].trim() !== "") tocar(campo); };

  function alternarModulo(modulo: ModuloExterno) {
    tocar("modulos");
    poner("modulos", valores.modulos.includes(modulo) ? valores.modulos.filter((m) => m !== modulo) : [...valores.modulos, modulo]);
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorServidor(null);
    if (Object.keys(errores).length) {
      // Se muestran todos los errores y el foco va al primero, para que no haya que adivinar por qué no avanza.
      setTocados({ nombre: true, dni: true, correo: true, celular: true, institucion: true, motivo: true, modulos: true, consentimiento: true });
      const primero = (["nombre", "dni", "correo", "celular", "motivo", "modulos", "consentimiento"] as Campo[]).find((campo) => errores[campo]);
      if (primero) document.getElementById(`acceso-${primero}`)?.focus();
      return;
    }
    setEnviando(true);
    try {
      const formulario = new FormData(evento.currentTarget);
      const respuesta = await fetch("/api/acceso/solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...valores, sitioWeb: String(formulario.get("sitioWeb") ?? ""), tardoMs: Math.round(evento.timeStamp - abiertoEn) }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as { codigo?: string; error?: string; campo?: Campo };
      if (!respuesta.ok) {
        setErrorServidor({ campo: datos.campo && datos.campo in VACIO ? datos.campo : undefined, mensaje: datos.error ?? "No se pudo enviar la solicitud. Inténtalo de nuevo." });
        return;
      }
      setCodigo(datos.codigo ?? "—");
    } catch {
      setErrorServidor({ mensaje: "No se pudo conectar. Revisa tu conexión a internet e inténtalo otra vez." });
    } finally {
      setEnviando(false);
    }
  }

  if (codigo) {
    return (
      <div>
        <div className="mb-5 grid size-14 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 size={30} aria-hidden /></div>
        <h1 className={authTitulo}>Recibimos tu solicitud</h1>
        <p className="mb-6 text-md text-muted">
          Tu código es <strong className="font-mono text-ink">{codigo}</strong>. Guárdalo por si necesitas consultar con el administrador.
        </p>
        <ol className="m-0 mb-7 flex list-none flex-col gap-4 p-0">
          {[
            { Icono: ClipboardCheck, titulo: "Revisamos tu solicitud", texto: "El administrador evalúa para qué necesitas el acceso y qué módulos corresponden." },
            { Icono: Mail, titulo: "Te contactamos", texto: `Si se aprueba, recibirás tu usuario (tu DNI) y una contraseña temporal por el correo o el celular que indicaste.` },
            { Icono: KeyRound, titulo: "Eliges tu contraseña", texto: "Al entrar por primera vez, ACE te pide crear una contraseña propia." },
          ].map(({ Icono, titulo, texto }, indice) => (
            <li key={titulo} className="flex items-start gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-dark"><Icono size={18} aria-hidden /></span>
              <span className="text-md leading-snug"><strong className="block">{indice + 1}. {titulo}</strong><span className="text-muted">{texto}</span></span>
            </li>
          ))}
        </ol>
        <a className={`${authBoton} no-underline`} href="/login"><ArrowLeft size={18} aria-hidden /> Volver al inicio de sesión</a>
      </div>
    );
  }

  const claseCampo = (campo: Campo) => `${authInput} ${ver(campo) ? authInputError : ""}`;
  const mensajeCampo = (campo: Campo) => (ver(campo) ? <p id={`acceso-${campo}-error`} className={authErrorCampo}>{ver(campo)}</p> : null);
  const ariaCampo = (campo: Campo) => ({ "aria-invalid": ver(campo) ? true : undefined, "aria-describedby": ver(campo) ? `acceso-${campo}-error` : undefined });

  return (
    <form onSubmit={enviar} noValidate>
      <h1 className={authTitulo}>Solicita tu acceso</h1>
      <p className="mb-6 text-md text-muted">
        Cuéntanos quién eres y qué necesitas. El administrador revisará tu solicitud; hasta entonces no se crea ninguna cuenta.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label className={authLabel} htmlFor="acceso-nombre">Nombre completo</label>
          <input id="acceso-nombre" className={claseCampo("nombre")} autoComplete="name" autoFocus maxLength={120} value={valores.nombre} onChange={(e) => poner("nombre", e.target.value)} onBlur={alSalir("nombre")} placeholder="Nombres y apellidos" {...ariaCampo("nombre")} />
          {mensajeCampo("nombre")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={authLabel} htmlFor="acceso-dni">DNI <span className="text-xs font-normal text-muted">será tu usuario</span></label>
            <input id="acceso-dni" className={claseCampo("dni")} inputMode="numeric" autoComplete="off" value={valores.dni} onChange={(e) => poner("dni", normalizarUsuario(e.target.value))} onBlur={alSalir("dni")} placeholder={`${USUARIO_LONGITUD} dígitos`} {...ariaCampo("dni")} />
            {mensajeCampo("dni")}
          </div>
          <div>
            <label className={authLabel} htmlFor="acceso-celular">Celular <span className="text-xs font-normal text-muted">opcional</span></label>
            <input id="acceso-celular" className={claseCampo("celular")} type="tel" inputMode="tel" autoComplete="tel" maxLength={18} value={valores.celular} onChange={(e) => poner("celular", e.target.value.replace(/[^\d+ ]/g, ""))} onBlur={alSalir("celular")} placeholder="987 654 321" {...ariaCampo("celular")} />
            {mensajeCampo("celular")}
          </div>
        </div>

        <div>
          <label className={authLabel} htmlFor="acceso-correo">Correo electrónico</label>
          <input id="acceso-correo" className={claseCampo("correo")} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={120} value={valores.correo} onChange={(e) => poner("correo", e.target.value.trim())} onBlur={alSalir("correo")} placeholder="tucorreo@ejemplo.com" {...ariaCampo("correo")} />
          {!ver("correo") ? <p className={authAyuda}>Por aquí te enviaremos tu usuario y tu contraseña temporal si se aprueba.</p> : mensajeCampo("correo")}
        </div>

        <div>
          <label className={authLabel} htmlFor="acceso-institucion">Institución o entidad <span className="text-xs font-normal text-muted">opcional</span></label>
          <input id="acceso-institucion" className={claseCampo("institucion")} autoComplete="organization" maxLength={120} value={valores.institucion} onChange={(e) => poner("institucion", e.target.value)} onBlur={alSalir("institucion")} placeholder="Dónde trabajas o estudias" {...ariaCampo("institucion")} />
          {mensajeCampo("institucion")}
        </div>

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className={`${authLabel} w-full`}>¿Qué necesitas usar?</legend>
          <div id="acceso-modulos" tabIndex={-1} className="flex flex-col gap-2.5 outline-none" aria-describedby={ver("modulos") ? "acceso-modulos-error" : undefined}>
            {LISTA_MODULOS_EXTERNOS.map((modulo) => {
              const Icono = ICONOS[modulo];
              return (
                <label key={modulo} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-white p-3.5 transition-colors duration-150 hover:border-brand/40 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:shadow-focus">
                  <input type="checkbox" className="mt-1 size-4 shrink-0 accent-brand" checked={valores.modulos.includes(modulo)} onChange={() => alternarModulo(modulo)} />
                  <span className="min-w-0 text-md leading-snug">
                    <span className="flex flex-wrap items-center gap-2 font-semibold"><Icono size={16} className="text-brand" aria-hidden /> {MODULOS_EXTERNOS[modulo].label}{PROXIMAMENTE[modulo] ? <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">Próximamente</span> : null}</span>
                    <span className="mt-0.5 block text-sm text-muted">{MODULOS_EXTERNOS[modulo].descripcion}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {mensajeCampo("modulos")}
        </fieldset>

        <div>
          <label className={authLabel} htmlFor="acceso-motivo">
            <span>¿Para qué lo necesitas?</span>
            <span className={`text-xs font-normal ${valores.motivo.length > MAX_MOTIVO ? "text-danger" : "text-muted"}`}>{valores.motivo.length}/{MAX_MOTIVO}</span>
          </label>
          <textarea id="acceso-motivo" className={`${claseCampo("motivo")} min-h-[96px] resize-y`} rows={3} value={valores.motivo} onChange={(e) => poner("motivo", e.target.value)} onBlur={alSalir("motivo")} placeholder="Por ejemplo: preparo el examen de certificación OECE y necesito consultar la Ley 32069." {...ariaCampo("motivo")} />
          {mensajeCampo("motivo")}
        </div>

        {/* Trampa para envíos automáticos: una persona no ve este campo ni lo rellena. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Sitio web<input name="sitioWeb" tabIndex={-1} autoComplete="off" /></label>
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-[1.5] text-muted">
            <input id="acceso-consentimiento" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand" checked={valores.consentimiento} onChange={(e) => poner("consentimiento", e.target.checked)} {...ariaCampo("consentimiento")} />
            <span>
              Autorizo el uso de mis datos personales y de mi dirección IP para evaluar esta solicitud y, si se aprueba, administrar mi cuenta
              (Ley N.° 29733). Se conservan 12 meses.
            </span>
          </label>
          {mensajeCampo("consentimiento")}
        </div>

        {errorServidor && !errorServidor.campo ? <AuthAlert tono="error">{errorServidor.mensaje}</AuthAlert> : null}

        <button className={authBoton} type="submit" disabled={enviando}>
          {enviando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </button>

        <p className="m-0 flex items-center justify-center gap-1.5 border-t border-line pt-4 text-center text-md text-muted">
          <UserCheck size={16} aria-hidden /> ¿Ya tienes cuenta? <a className={authEnlace} href="/login">Inicia sesión</a>
        </p>
      </div>
    </form>
  );
}
