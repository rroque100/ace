"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { Button } from "@/app/components/ui/button";

// «Pregúntame tus dudas»: no genera respuestas aquí. Abre el chat jurídico con la pregunta ya escrita y el tema de la
// clase como contexto, para que la respuesta pase por la misma recuperación y verificación de citas que cualquier otra.
// Solo se pinta si la cuenta tiene el Centro Jurídico (lo decide la página).
export function PanelDudas({ tema }: { tema: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const limpio = texto.trim();

  return (
    <form
      className="rounded-2xl border border-line bg-panel p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!limpio) return;
        router.push(`/chat?pregunta=${encodeURIComponent(`Sobre «${tema}»: ${limpio}`)}`);
      }}
    >
      <label htmlFor="duda-clase" className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <MessageCircleQuestion size={18} aria-hidden className="text-brand" />
        Pregúntame tus dudas
      </label>
      <textarea
        id="duda-clase"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        maxLength={600}
        placeholder="Por ejemplo: ¿quién aprueba el expediente si no hay autoridad de la gestión administrativa?"
        className="block w-full resize-y rounded-xl border border-line-strong bg-canvas px-3 py-2 text-sm text-ink placeholder:text-placeholder focus-visible:border-brand focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
      />
      <p className="mb-3 mt-2 text-xs leading-relaxed text-muted">
        Se abre el chat jurídico con tu pregunta; la respuesta cita la Ley y el Reglamento.
      </p>
      <Button type="submit" variant="secondary" size="sm" block disabled={!limpio}>
        Preguntar al chat jurídico
      </Button>
    </form>
  );
}
