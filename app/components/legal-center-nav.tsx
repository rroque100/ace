"use client";

import Link from "next/link";
import { Bot, FileSearch, Library } from "lucide-react";
import { legalCenterHref, legalCenterViews, type LegalCenterFilters, type LegalCenterView } from "@/lib/legal-center";

const icons = { chat: Bot, busqueda: FileSearch, normas: Library };

// Utilidades de Tailwind directas, sin pasar por clases semánticas + `@apply`. Los puntos de corte son de
// CONTENEDOR (`@max-*`, contra `.legalWorkspace`, que declara `container-type: inline-size`), no de
// viewport: el menú se encoge según el ancho que le deja la página, que con el índice abierto de /normas
// no coincide con el de la ventana. La única regla de viewport (`max-[640px]`) es del chat: en móvil la
// barra puede desplazarse en horizontal. (El CSS antiguo pretendía además pasarla a `flex` con textos sin
// salto de línea, pero esas reglas perdían contra las del Centro Jurídico y nunca se vieron; aquí solo se
// conserva lo que de verdad se aplicaba.)
//
// El color del texto va en la barra y no en cada enlace: `styles.css` tiene `a { color: inherit }` FUERA de
// capa, y una regla sin capa gana siempre a las utilidades (que viven en `@layer utilities`) sin importar la
// especificidad. Los enlaces heredan el color; el elemento activo, que es un `<span>`, sí admite `text-brand`.
const nav = "mb-3";
const bar = "grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel p-1 text-ink [.chatAccessible_&]:max-[640px]:overflow-x-auto";
const item =
  "flex min-h-11 min-w-0 items-center gap-3 whitespace-normal rounded-lg border no-underline transition-colors px-3 py-2 " +
  "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand " +
  "@max-[720px]:flex-col @max-[720px]:justify-center @max-[720px]:gap-1 @max-[720px]:text-center";
const itemLink = "border-transparent hover:bg-surface";
const itemActive = "border-brand/20 bg-brand-soft text-brand";
const label = "block text-[14px] font-semibold leading-5 @max-[720px]:text-[12px]";

export function LegalCenterNav({ active, filters }: { active: LegalCenterView; filters?: LegalCenterFilters }) {
  return (
    <section className={nav} aria-label="Centro Jurídico">
      <nav className={bar} aria-label="Herramientas del Centro Jurídico">
        {legalCenterViews.map((view) => {
          const Icon = icons[view.id];
          const content = <><Icon className="size-5 shrink-0" aria-hidden="true" /><span className="min-w-0"><span className={label}>{view.label}</span></span></>;
          if (active === view.id) return <span key={view.id} className={`${item} ${itemActive}`} aria-current="page">{content}</span>;
          return <Link key={view.id} className={`${item} ${itemLink}`} href={legalCenterHref(view.id, filters)}>{content}</Link>;
        })}
      </nav>
    </section>
  );
}
