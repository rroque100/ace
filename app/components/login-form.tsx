"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  credencialAIdentificador,
  esUsuarioValido,
  USUARIO_LONGITUD,
} from "@/lib/usuario-credencial";

type LoginFormProps = {
  next: string;
};

// Aquí ya no hay «Registrarse»: las cuentas las crea el administrador (personal de la entidad y usuarios externos con
// los módulos que se les asignen). Con el registro abierto, cualquiera con un correo podía crearse una cuenta de
// consulta y gastar IA sin que nadie la hubiera autorizado.
export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

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
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw signInError;
      }
      // El inicio de sesión ocurre en el navegador, directo contra Supabase: el servidor no lo ve. Se le avisa para que
      // quede en la auditoría de las cuentas externas con su IP. Si falla no impide entrar.
      await fetch("/api/auth/registro-acceso", { method: "POST" }).catch(() => undefined);
      router.push(next);
      router.refresh();
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
        <span>Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mínimo 6 caracteres"
        />
      </label>

      {error ? <p className="authError">{error}</p> : null}

      <button className="primaryButton" type="submit" disabled={loading}>
        <LogIn size={18} />
        {loading ? "Procesando..." : "Entrar"}
      </button>

      <p className="authHint">
        Para proteger el sistema, ACE registra la dirección IP y la actividad de las cuentas externas y las conserva 12 meses.
      </p>
    </form>
  );
}
