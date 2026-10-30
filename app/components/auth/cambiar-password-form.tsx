"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Eye, EyeOff, KeyRound, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { credencialAIdentificador } from "@/lib/usuario-credencial";
import { fortalezaPassword, problemasPassword, requisitosPassword } from "@/lib/password-politica";
import { AuthAlert, authBoton, authErrorCampo, authInput, authInputError, authLabel, authTitulo } from "./auth-ui";

type Props = {
  /** El DNI de la cuenta: no puede formar parte de la contraseña. */
  usuario: string | null;
  /** Adónde ir al terminar: el inicio de su primer módulo. */
  destino: string;
};

const ETIQUETAS_FORTALEZA = ["Muy débil", "Débil", "Aceptable", "Buena", "Muy buena"] as const;
const COLORES_FORTALEZA = ["bg-line", "bg-danger", "bg-warning", "bg-brand", "bg-success"] as const;

// El cambio lo guarda el servidor (/api/auth/cambiar-password): es quien quita el aviso «contraseña temporal» de
// `app_metadata`, que la persona no puede escribir. Aquí solo se pide y se enseña, con cada requisito a la vista mientras
// se escribe para que nadie tenga que adivinar por qué se rechaza.
export function CambiarPasswordForm({ usuario, destino }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const requisitos = requisitosPassword(password, usuario);
  const cumple = problemasPassword(password, usuario).length === 0;
  const coincide = password === repetir;
  const fortaleza = fortalezaPassword(password);
  const puedeGuardar = cumple && coincide && repetir.length > 0 && !guardando;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!puedeGuardar) return;
    setError(null);
    setGuardando(true);
    try {
      const respuesta = await fetch("/api/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as { error?: string; destino?: string };
      if (!respuesta.ok) {
        setError(datos.error ?? "No se pudo guardar la contraseña. Inténtalo de nuevo.");
        setGuardando(false);
        return;
      }
      // El token de la sesión todavía dice «contraseña temporal»: se renueva para que el proxy deje pasar. Si Auth cerró la
      // sesión al cambiar la contraseña, se entra de nuevo con la nueva (la persona ya la escribió: no se le pide otra vez).
      const supabase = createClient();
      const { error: errorRenovar } = await supabase.auth.refreshSession();
      if (errorRenovar && usuario) {
        await supabase.auth.signInWithPassword({ email: credencialAIdentificador(usuario), password });
      }
      router.replace(datos.destino ?? destino);
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisa tu conexión a internet e inténtalo otra vez.");
      setGuardando(false);
    }
  }

  return (
    <div>
    <form onSubmit={enviar} noValidate>
      <div className="mb-5 grid size-14 place-items-center rounded-full bg-brand-soft text-brand-dark"><KeyRound size={26} aria-hidden /></div>
      <h1 className={authTitulo}>Elige tu contraseña</h1>
      <p className="mb-6 text-md text-muted">
        Entraste con una contraseña temporal. Crea una propia para proteger tu cuenta; después podrás usar ACE con normalidad.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label className={authLabel} htmlFor="nueva-password">Nueva contraseña</label>
          <div className="relative">
            <input
              id="nueva-password"
              className={`${authInput} pr-11`}
              type={ver ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              maxLength={120}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="requisitos-password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-1.5 my-auto grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:shadow-focus"
              onClick={() => setVer((visible) => !visible)}
              aria-label={ver ? "Ocultar contraseñas" : "Mostrar contraseñas"}
              aria-pressed={ver}
            >
              {ver ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>

          <div className="mt-2.5 flex items-center gap-2" aria-hidden={password === ""}>
            <div className="flex flex-1 gap-1">
              {[1, 2, 3, 4].map((tramo) => (
                <span key={tramo} className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${fortaleza >= tramo ? COLORES_FORTALEZA[fortaleza] : "bg-line"}`} />
              ))}
            </div>
            <span className="w-[74px] text-right text-xs text-muted" aria-live="polite">{password ? ETIQUETAS_FORTALEZA[fortaleza] : ""}</span>
          </div>

          <ul id="requisitos-password" className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
            {requisitos.map((requisito) => (
              <li key={requisito.clave} className={`flex items-center gap-2 text-sm transition-colors ${requisito.cumple ? "text-success" : "text-muted"}`}>
                {requisito.cumple ? <Check size={15} aria-hidden /> : <Circle size={15} aria-hidden />}
                <span>{requisito.texto}<span className="sr-only">{requisito.cumple ? ": cumple" : ": falta"}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className={authLabel} htmlFor="repetir-password">Repite la contraseña</label>
          <input
            id="repetir-password"
            className={`${authInput} ${repetir && !coincide ? authInputError : ""}`}
            type={ver ? "text" : "password"}
            autoComplete="new-password"
            maxLength={120}
            value={repetir}
            onChange={(event) => setRepetir(event.target.value)}
            aria-invalid={repetir && !coincide ? true : undefined}
            aria-describedby={repetir && !coincide ? "repetir-error" : undefined}
          />
          {repetir && !coincide ? <p id="repetir-error" className={authErrorCampo}>Las contraseñas no coinciden.</p> : null}
        </div>

        {error ? <AuthAlert tono="error">{error}</AuthAlert> : null}

        <button className={authBoton} type="submit" disabled={!puedeGuardar}>
          {guardando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <KeyRound size={18} aria-hidden />}
          {guardando ? "Guardando…" : "Guardar y continuar"}
        </button>
      </div>
    </form>

    {/* Fuera del formulario de arriba: un <form> dentro de otro no es HTML válido. */}
    <form action="/auth/signout" method="post" className="mt-6 border-t border-line pt-4 text-center">
      <button type="submit" className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
        <LogOut size={14} aria-hidden /> Cerrar sesión
      </button>
    </form>
    </div>
  );
}
