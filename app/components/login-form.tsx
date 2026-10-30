"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, EyeOff, HelpCircle, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  credencialAIdentificador,
  esUsuarioValido,
  USUARIO_LONGITUD,
} from "@/lib/usuario-credencial";
import { AuthAlert, authAyuda, authBoton, authEnlace, authInput, authInputError, authLabel } from "./auth/auth-ui";

type LoginFormProps = {
  next: string;
};

// Aquí no hay «Registrarse»: las cuentas las crea el administrador. Quien aún no tiene una la pide en /acceso, y queda
// pendiente de aprobación. Con el registro abierto, cualquiera con un correo podía crearse una cuenta y gastar IA sin que
// nadie la hubiera autorizado.

/** Traduce lo que devuelve Auth a algo que una persona pueda resolver; nunca muestra el texto técnico tal cual. */
function mensajeDeError(error: unknown): string {
  const texto = error instanceof Error ? error.message : "";
  const estado = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
  if (/invalid login credentials/i.test(texto)) return "El DNI o correo y la contraseña no coinciden con una cuenta. Revísalos e inténtalo de nuevo.";
  if (estado === 429 || /rate limit|too many/i.test(texto)) return "Hiciste demasiados intentos. Espera unos minutos e inténtalo otra vez.";
  if (/failed to fetch|network|fetch failed/i.test(texto)) return "No se pudo conectar. Revisa tu conexión a internet e inténtalo otra vez.";
  if (/email not confirmed/i.test(texto)) return "Tu cuenta todavía no está activada. Contacta con el administrador.";
  return "No se pudo iniciar sesión. Inténtalo de nuevo; si sigue fallando, contacta con el administrador.";
}

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const faltanDigitos = /^\d{1,7}$/.test(usuario);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!usuario.includes("@") && !esUsuarioValido(usuario)) {
      setError(`Tu usuario es tu DNI: ${USUARIO_LONGITUD} dígitos.`);
      return;
    }
    setLoading(true);

    try {
      const supabase = createClient();
      // Auth solo entiende de correos: el usuario de ocho dígitos se traduce a su
      // correo interno aquí, en el único punto donde se habla con Supabase.
      const email = credencialAIdentificador(usuario);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw signInError;
      }
      // El inicio de sesión ocurre en el navegador, directo contra Supabase: el servidor no lo ve. Se le avisa para que
      // quede en la auditoría de las cuentas externas con su IP. Si falla no impide entrar.
      await fetch("/api/auth/registro-acceso", { method: "POST" }).catch(() => undefined);
      // Una cuenta con contraseña temporal no llega a `next`: el proxy la lleva a elegir la suya.
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(mensajeDeError(err));
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div>
        <label className={authLabel} htmlFor="login-usuario">DNI o correo</label>
        <input
          id="login-usuario"
          className={`${authInput} ${error ? authInputError : ""}`}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          autoFocus
          required
          aria-describedby={faltanDigitos ? "login-usuario-ayuda" : undefined}
          value={usuario}
          onChange={(event) => setUsuario(event.target.value.trim())}
          placeholder="Tu DNI de 8 dígitos"
        />
        {faltanDigitos ? (
          <p id="login-usuario-ayuda" className={authAyuda}>
            Faltan {USUARIO_LONGITUD - usuario.length} de {USUARIO_LONGITUD} dígitos.
          </p>
        ) : null}
      </div>

      <div>
        <label className={authLabel} htmlFor="login-password">Contraseña</label>
        <div className="relative">
          <input
            id="login-password"
            className={`${authInput} pr-11 ${error ? authInputError : ""}`}
            type={verPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyUp={(event) => setMayusculas(event.getModifierState("CapsLock"))}
            onBlur={() => setMayusculas(false)}
            placeholder="Tu contraseña"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-1.5 my-auto grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:shadow-focus"
            onClick={() => setVerPassword((visible) => !visible)}
            aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={verPassword}
          >
            {verPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {mayusculas ? (
          <p className="mt-1.5! flex items-center gap-1.5 text-sm text-warning" role="status">
            <AlertTriangle size={14} aria-hidden /> Tienes las mayúsculas activadas.
          </p>
        ) : null}
      </div>

      {error ? <AuthAlert tono="error">{error}</AuthAlert> : null}

      <button className={authBoton} type="submit" disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <LogIn size={18} aria-hidden />}
        {loading ? "Entrando…" : "Entrar"}
      </button>

      <details className="group rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <HelpCircle size={16} className="text-muted" aria-hidden /> ¿Olvidaste tu contraseña?
        </summary>
        <p className="m-0 mt-2! leading-[1.5] text-muted">
          ACE no envía correos de recuperación. Pide al administrador que te asigne una contraseña temporal: al entrar con ella,
          ACE te pedirá elegir una nueva.
        </p>
      </details>

      <p className="m-0 border-t border-line pt-4 text-center text-md text-muted">
        ¿Aún no tienes cuenta? <a className={authEnlace} href="/acceso">Solicitar acceso</a>
      </p>

      <p className="m-0 flex items-start justify-center gap-1.5 text-center text-xs leading-[1.5] text-muted">
        <ShieldCheck size={13} className="mt-px shrink-0" aria-hidden />
        <span>Para proteger el sistema, ACE registra la dirección IP y la actividad de las cuentas externas y las conserva 12 meses.</span>
      </p>
    </form>
  );
}
