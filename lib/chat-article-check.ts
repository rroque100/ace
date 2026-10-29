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
    `**No se recuperó ${uno ? "el artículo" : "los artículos"} ${lista}**\n` +
    `Pediste ${uno ? "ese artículo" : "esos artículos"} por su número y ninguna de las fuentes consultadas lo es. ` +
    "Lo que sigue corresponde a otros artículos relacionados, no a lo que pediste. " +
    "Comprueba el número y la norma, o selecciona el documento para buscarlo dentro de él.\n\n"
  );
}
