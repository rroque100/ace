"use client";

import Link from "next/link";
import { Bot, FileSearch, Library } from "lucide-react";
import { legalCenterHref, legalCenterViews, type LegalCenterFilters, type LegalCenterView } from "@/lib/legal-center";

const icons = { chat: Bot, busqueda: FileSearch, normas: Library };
const hints = { chat: "Pregunta y revisa las fuentes", busqueda: "Encuentra el documento", normas: "Lee y contrasta versiones" };

export function LegalCenterNav({ active, filters }: { active: LegalCenterView; filters?: LegalCenterFilters }) {
  return (
    <section className="legalCenterNav" aria-label="Centro Jurídico">
      <nav aria-label="Herramientas del Centro Jurídico">
        {legalCenterViews.map((view) => {
          const Icon = icons[view.id];
          const label = <span className="min-w-0"><span className="legalNavLabel">{view.label}</span><span className="legalNavHint">{hints[view.id]}</span></span>;
          if (active === view.id) return <span key={view.id} className="legalCenterItem" aria-current="page"><Icon size={18} aria-hidden="true" />{label}</span>;
          return <Link key={view.id} className="legalCenterItem" href={legalCenterHref(view.id, filters)}>
            <Icon size={18} aria-hidden="true" />{label}
          </Link>;
        })}
      </nav>
      <p className="legalNavScope">Comprueba la versión y la aplicación de las fuentes a tu caso.</p>
    </section>
  );
}
