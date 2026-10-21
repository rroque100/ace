"use client";

import * as Popover from "@radix-ui/react-popover";
import { useState, useEffect, useCallback, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Sparkles, HelpCircle } from "lucide-react";
import { expBtnClass } from "./estilos";
import { cn } from "@/lib/utils";

export type TourStep = {
  id: string;
  target: string;
  title: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  action?: string;
};

type Props = {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
};

export function OnboardingTour({ steps, open, onClose, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [objetivo, setObjetivo] = useState<Element | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  // Localiza el elemento del paso, lo trae a la vista y mantiene medido su
  // recuadro. Se remide también al hacer scroll —antes solo al redimensionar—,
  // porque el foco de luz se quedaba atrás en cuanto la página se movía.
  //
  // El elemento va en estado y no en una referencia a propósito: Radix lee el
  // ancla desde un efecto propio, y los efectos del hijo corren antes que los
  // del padre, así que una referencia mutada aquí llegaría un render tarde.
  useEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector(step.target);
    setObjetivo(el);
    if (!el) {
      setTargetRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const medir = () => setTargetRect(el.getBoundingClientRect());
    medir();
    // El desplazamiento suave sigue en marcha: cada evento de scroll corrige la
    // medida, así que no hace falta adivinar cuánto tarda con un temporizador.
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [open, step]);

  // Ancla para Radix: un elemento real vale tal cual, porque lo único que se le
  // pide es `getBoundingClientRect`. Sin objetivo, se ancla al centro de la
  // ventana. La identidad del objeto cambia con el paso, que es como Radix se
  // entera de que debe recolocarse.
  const anclaje = useMemo<React.RefObject<{ getBoundingClientRect(): DOMRect } | null>>(
    () => ({
      current:
        objetivo ??
        {
          getBoundingClientRect: () =>
            new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0),
        },
    }),
    [objetivo],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" && !isLast) {
        setCurrentStep((s) => s + 1);
      } else if (e.key === "ArrowLeft" && !isFirst) {
        setCurrentStep((s) => s - 1);
      } else if (e.key === "Enter" && isLast) {
        onComplete?.();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isLast, isFirst, onClose, onComplete]);

  if (!open || !step) return null;

  const padding = 8;
  const spotlightStyle: React.CSSProperties = targetRect
    ? {
        position: "fixed",
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
        boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.6)",
        borderRadius: 12,
        zIndex: 200,
        pointerEvents: "none",
        transition: "all 300ms ease",
      }
    : {};

  // La colocación la resuelve Radix (Floating UI): voltea de lado cuando no
  // cabe y se remide al hacer scroll. El cálculo a mano que había aquí daba por
  // hecho que la tarjeta medía 240px de alto —no es cierto, depende del texto de
  // cada paso— y, al no poder voltear, se limitaba a pegarse al borde de la
  // ventana, con lo que a veces tapaba justo el elemento que estaba señalando.
  return (
    <>
      {targetRect ? <div style={spotlightStyle} aria-hidden="true" /> : null}
      {/* Controlado sin `onOpenChange` a propósito: solo lo cierran el aspa, el
          Escape global y el último paso. Un clic fuera no debe cerrarlo, porque
          fuera está precisamente lo que el tour te pide que toques. */}
      <Popover.Root open>
        {/* El ancla real es `virtualRef`; el div que Radix renderiza aquí no se
            usa para medir, así que se oculta para no dejar una caja suelta. */}
        <Popover.Anchor style={{ display: "none" }} virtualRef={anclaje} />
        <Popover.Portal>
          <Popover.Content
            aria-label="Tutorial guiado"
            className="tw z-[201] w-[min(360px,calc(100vw-32px))] animate-exp-pop-in overflow-hidden rounded-exp-lg border border-exp-line bg-exp-panel shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
            collisionPadding={16}
            side={step.position ?? "bottom"}
            sideOffset={16}
          >
        <div className="flex items-center justify-between border-b border-exp-line bg-[linear-gradient(135deg,var(--color-exp-brand-soft)_0%,var(--color-exp-panel)_100%)] px-4 py-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-exp-brand bg-exp-panel px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.5px] text-exp-brand">
            <Sparkles size={12} /> Paso {currentStep + 1} de {steps.length}
          </div>
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md border-0 bg-transparent text-exp-muted transition-colors duration-[120ms] ease-linear hover:bg-exp-line-soft hover:text-exp-ink"
            onClick={() => {
              // Cerrar con X = descartar (no volver a mostrar)
              onComplete?.();
              onClose();
            }}
            aria-label="Cerrar tutorial"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-[18px] py-4">
          <h3 className="m-0 mb-2 text-base font-bold text-exp-ink">{step.title}</h3>
          <p className="m-0 mb-2 text-[13px] leading-relaxed text-exp-ink-soft">{step.content}</p>
          {step.action ? (
            <p className="m-0 rounded-exp bg-exp-brand-soft px-2.5 py-2 text-xs font-medium text-exp-brand">
              {step.action}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-exp-line bg-exp-line-soft px-4 py-3">
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-[120ms] ease-linear",
                  i <= currentStep ? "w-[18px] bg-exp-brand" : "w-1.5 bg-exp-line",
                )}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            {!isFirst ? (
              <button
                type="button"
                className={expBtnClass("ghost", "small")}
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
            ) : null}
            {isLast ? (
              <button
                type="button"
                className={expBtnClass("primary", "small")}
                onClick={() => {
                  onComplete?.();
                  onClose();
                }}
              >
                Finalizar <Sparkles size={14} />
              </button>
            ) : (
              <button
                type="button"
                className={expBtnClass("primary", "small")}
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Siguiente <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}

const TOUR_KEY = "exp-tour-completed-v1";

export function useTour(steps: TourStep[], storageKey = TOUR_KEY) {
  const [open, setOpen] = useState(false);
  // Inicializar desde localStorage de forma síncrona (solo en cliente)
  const [hasCompleted, setHasCompleted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (hasCompleted) return;
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, [hasCompleted, storageKey]);

  const complete = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "true");
      setHasCompleted(true);
    } catch {
      // Ignorar
    }
  }, [storageKey]);

  const close = useCallback(() => setOpen(false), []);

  // Cierra el tour Y lo marca como completado (para que no vuelva a aparecer)
  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(storageKey, "true");
      setHasCompleted(true);
    } catch {
      // Ignorar
    }
  }, [storageKey]);

  const restart = useCallback(() => {
    setOpen(true);
  }, []);

  return { open, close, dismiss, complete, restart, Tour: OnboardingTour, steps };
}

export function TourTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="tw inline-flex items-center gap-1 rounded-lg border border-exp-line bg-exp-panel px-2.5 py-[5px] text-xs font-semibold text-exp-muted transition-colors duration-[120ms] ease-linear hover:border-exp-brand hover:bg-exp-line-soft hover:text-exp-brand"
      onClick={onClick}
      title="Ver tutorial"
      aria-label="Ver tutorial guiado"
    >
      <HelpCircle size={14} /> Tutorial
    </button>
  );
}
