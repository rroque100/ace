"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { buttonClasses } from "@/app/components/ui/button";

// Empieza la prueba diagnóstica y lleva al simulador, que es quien la toma y la califica.
export function BotonDiagnostico({ texto, variante = "primary" }: { texto: string; variante?: "primary" | "secondary" }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  async function empezar() {
    setOcupado(true);
    setError("");
    try {
      const r = await fetch("/api/cursos/diagnostico", { method: "POST" });
      const x = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!r.ok || !x.id) throw new Error(x.error ?? "No se pudo empezar la prueba diagnóstica.");
      router.push(`/simulador?seccion=banco&attempt=${encodeURIComponent(x.id)}`);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className={buttonClasses({ variant: variante })} disabled={ocupado} onClick={() => void empezar()}>
        <ClipboardCheck size={17} aria-hidden /> {ocupado ? "Preparando la prueba…" : texto}
      </button>
      {error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
