"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  credencialAIdentificador,
  esUsuarioValido,
  USUARIO_LONGITUD,
} from "@/lib/usuario-credencial";

type LoginFormProps = {
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!usuario.includes("@") && !esUsuarioValido(usuario)) {
      setError(`El usuario es tu DNI: ${USUARIO_LONGITUD} dígitos.`);
      return;
    }
    setLoading(true);

    try {
      const supabase = createClient();
      // Auth solo entiende de correos: el usuario de ocho dígitos se traduce a su
      // correo interno aquí, en el único punto donde se habla con Supabase.
      const email = credencialAIdentificador(usuario);
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw signInError;
        }
        router.push(next);
        router.refresh();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          throw signUpError;
        }
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setInfo(
            "Cuenta creada. Si la confirmacion por correo esta activada, revisa tu bandeja; luego inicia sesion.",
          );
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error && err.message === "Invalid login credentials"
        ? "El DNI o correo y la contraseña no coinciden con una cuenta. Revisa los datos; si olvidaste tu contraseña, solicita al administrador que la cambie."
        : err instanceof Error ? err.message : "No se pudo completar la autenticacion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="authForm" onSubmit={handleSubmit}>
      {/* No son pestañas aunque lo parezcan: los dos modos comparten los mismos
          campos. Lo único que cambia es a dónde se envía el formulario, así que
          esto elige el modo, no un panel. */}
      <div className="authTabs" role="group" aria-label="Modo de acceso">
        <button
          type="button"
          aria-pressed={mode === "signin"}
          className={mode === "signin" ? "active" : undefined}
          onClick={() => setMode("signin")}
        >
          Iniciar sesion
        </button>
        <button
          type="button"
          aria-pressed={mode === "signup"}
          className={mode === "signup" ? "active" : undefined}
          onClick={() => setMode("signup")}
        >
          Registrarse
        </button>
      </div>

      <label className="authField">
        <span>DNI o correo</span>
        <input
          type="text"
          autoComplete="username"
          inputMode="text"
          required
          value={usuario}
          onChange={(event) => setUsuario(event.target.value)}
          placeholder="DNI de 8 dígitos o correo"
        />
        {/^\d{1,7}$/.test(usuario) ? (
          <small className="authHint">
            Faltan {USUARIO_LONGITUD - usuario.length} de {USUARIO_LONGITUD} dígitos.
          </small>
        ) : null}
      </label>

      <label className="authField">
        <span>Contrasena</span>
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimo 6 caracteres"
        />
      </label>

      {error ? <p className="authError">{error}</p> : null}
      {info ? <p className="authInfo">{info}</p> : null}

      <button className="primaryButton" type="submit" disabled={loading}>
        {mode === "signin" ? <LogIn size={18} /> : <UserPlus size={18} />}
        {loading ? "Procesando..." : mode === "signin" ? "Entrar" : "Crear cuenta"}
      </button>
    </form>
  );
}
