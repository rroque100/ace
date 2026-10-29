// «¿Qué dice el artículo 9999 de la Ley 32069?» recibía una respuesta sobre el artículo 99 (y sobre el 99 del
// Reglamento), presentada como si contestara lo preguntado. El modelo recibe los fragmentos más parecidos, no
// los que tienen ese número, y rellena el hueco. Aquí se comprueba en código, después de recuperar y antes de
// publicar: si la pregunta pide un artículo concreto y ninguna fuente recuperada es ese artículo, se dice.
// Módulo puro: no afirma que el artículo no exista (solo que no se recuperó), porque no puede saberlo.

import { documentReferences } from "./legal-document-reference";

type SourceLike = { article?: string | null };

// «artículo 120», «art. 61», «artículos 5 y 6» (el primero). No toma «artículo» sin número.
const ARTICLE_MENTION = /\bart(?:iculo|iculos|\.)?\s*n?[.°º]*\s*(\d+(?:-?[a-z](?![a-z]))?)/gi;

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Número base de un artículo: «113.1» y «113» son el artículo 113; «61-A» y «61a» son el 61A. */
export function baseArticle(value: string | null | undefined): string {
  return plain(value ?? "").trim().replace(/^0+(?=\d)/, "").match(/^\d+(?:-?[a-z])?/)?.[0].replace("-", "") ?? "";
}

/** Artículos que la pregunta pide por su número (sin repetir). */
export function requestedArticles(question: string): string[] {
  const found = new Set<string>();
  for (const match of plain(question).matchAll(ARTICLE_MENTION)) {
    const article = baseArticle(match[1]);
    if (article) found.add(article);
  }
  return [...found].slice(0, 4);
}

/**
 * Artículos pedidos que no figuran entre las fuentes. Se omite cuando la pregunta nombra un documento concreto
 * (una opinión que «cita el artículo 5» no es una petición del artículo 5) o cuando no hay fuentes (ya hay otro aviso).
 */
export function missingRequestedArticles(question: string, sources: SourceLike[]): string[] {
  if (!sources.length || documentReferences(question).some((reference) => reference.documentType !== "ley")) return [];
  const present = new Set(sources.map((source) => baseArticle(source.article)).filter(Boolean));
  return requestedArticles(question).filter((article) => !present.has(article));
}

/** Aviso para anteponer a la respuesta, o null si no falta ninguno. */
export function missingArticleNotice(missing: string[]): string | null {
  if (!missing.length) return null;
  const numeros = missing.map((article) => article.toUpperCase());
  const lista = numeros.length === 1 ? numeros[0] : `${numeros.slice(0, -1).join(", ")} y ${numeros[numeros.length - 1]}`;
  const uno = missing.length === 1;
  return (
    `**${uno ? "No se recuperó el artículo" : "No se recuperaron los artículos"} ${lista}**\n` +
    `Pediste ${uno ? "ese artículo" : "esos artículos"} por su número y ninguna de las fuentes consultadas lo es. ` +
    "Lo que sigue corresponde a otros artículos relacionados, no a lo que pediste. " +
    "Comprueba el número y la norma, o selecciona el documento para buscarlo dentro de él.\n\n"
  );
}

// ── Norma pedida por su número ─────────────────────────────────────────────────────────────────────────────
// Lo mismo que con el artículo, un nivel más arriba: «¿Qué dice el Decreto Supremo 999-2099-EF?» recibió una
// respuesta sobre otro decreto (el 009-2025-EF) sin decir que el pedido no se encontró. El modelo a veces lo
// dice y a veces no; esto lo garantiza en código.

type NormSourceLike = { documentTitle?: string | null; documentNumber?: string | null; excerpt?: string | null };
export type RequestedNorm = { label: string; present: RegExp };

const DECRETO_SUPREMO = /\b(?:decreto supremo|d\.?\s?s\.?)\s*(?:n[.°º]*\s*)?(\d{1,4})\s*-\s*(20\d{2}|19\d{2})(?:\s*-\s*([a-z]{2,6}))?/g;
const DECRETO_LEGISLATIVO = /\b(?:decreto legislativo|d\.?\s?leg\.?)\s*(?:n[.°º]*\s*)?(\d{2,4})\b/g;
const LEY = /\bley\s*(?:n[.°º]*\s*)?(\d{4,6})\b/g;

/** Normas que la pregunta pide por su número, con cómo reconocerlas en una fuente. */
export function requestedNorms(question: string): RequestedNorm[] {
  const text = plain(question);
  const found = new Map<string, RequestedNorm>();
  for (const m of text.matchAll(DECRETO_SUPREMO)) {
    const number = String(Number(m[1]));
    found.set(`ds-${number}-${m[2]}`, { label: `Decreto Supremo N.° ${m[1].padStart(3, "0")}-${m[2]}${m[3] ? `-${m[3].toUpperCase()}` : ""}`, present: new RegExp(String.raw`(?<!\d)0*${number}\s*-\s*${m[2]}(?!\d)`) });
  }
  for (const m of text.matchAll(DECRETO_LEGISLATIVO)) {
    found.set(`dleg-${Number(m[1])}`, { label: `Decreto Legislativo N.° ${Number(m[1])}`, present: new RegExp(String.raw`decreto legislativo\s*(?:n[.°º]*\s*)?0*${Number(m[1])}(?!\d)|d\.?\s?leg\.?\s*(?:n[.°º]*\s*)?0*${Number(m[1])}(?!\d)`) });
  }
  for (const m of text.matchAll(LEY)) {
    found.set(`ley-${Number(m[1])}`, { label: `Ley N.° ${Number(m[1])}`, present: new RegExp(String.raw`(?<!\d)0*${Number(m[1])}(?!\d)`) });
  }
  return [...found.values()].slice(0, 4);
}

/** Normas pedidas por número de las que ninguna fuente recuperada lleva el número (en título, número o fragmento). */
export function missingRequestedNorms(question: string, sources: NormSourceLike[]): string[] {
  if (!sources.length) return [];
  const haystack = sources.map((source) => plain(`${source.documentTitle ?? ""} ${source.documentNumber ?? ""} ${source.excerpt ?? ""}`));
  return requestedNorms(question).filter((norm) => !haystack.some((text) => norm.present.test(text))).map((norm) => norm.label);
}

export function missingNormNotice(missing: string[]): string | null {
  if (!missing.length) return null;
  const uno = missing.length === 1;
  const lista = uno ? `«${missing[0]}»` : missing.map((label) => `«${label}»`).join(", ");
  return (
    `**${uno ? "No se recuperó la norma" : "No se recuperaron las normas"} ${lista}**\n` +
    `Pediste ${uno ? "esa norma" : "esas normas"} por su número y ninguna de las fuentes consultadas lleva ${uno ? "ese número" : "esos números"}. ` +
    "Lo que sigue corresponde a otras normas relacionadas, no a lo que pediste. " +
    "Comprueba el número, o incorpora el documento si no está en la biblioteca.\n\n"
  );
}
