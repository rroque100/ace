"use client";

import Link from "next/link";
import { Bot, FileSearch, Library } from "lucide-react";
import { legalCenterHref, legalCenterViews, type LegalCenterFilters, type LegalCenterView } from "@/lib/legal-center";

const icons = { chat: Bot, busqueda: FileSearch, normas: Library };

export function LegalCenterNav({ active, filters }: { active: LegalCenterView; filters?: LegalCenterFilters }) {
  return (
    <section className="legalCenterNav" aria-label="Centro Jurídico">
      <nav aria-label="Herramientas del Centro Jurídico">
        {legalCenterViews.map((view) => {
          const Icon = icons[view.id];
          if (active === view.id) return <span key={view.id} className="legalCenterItem" aria-current="page"><Icon size={18} aria-hidden="true" /><span>{view.label}</span></span>;
          return <Link key={view.id} className="legalCenterItem" href={legalCenterHref(view.id, filters)}>
            <Icon size={18} aria-hidden="true" /><span>{view.label}</span>
          </Link>;
        })}
      </nav>
      <p>{legalCenterViews.find((view) => view.id === active)?.description}</p>
    </section>
  );
}
