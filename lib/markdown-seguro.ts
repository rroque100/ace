import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

/**
 * Markdown → HTML SANEADO, listo para `dangerouslySetInnerHTML`.
 *
 * `marked` no sanea desde v5, y este HTML se pinta en la ficha del requerimiento
 * a partir de contenido que MEZCLA fuentes poco fiables: lo que teclea el
 * usuario, la propuesta del copiloto (LLM) y —vía el prompt— el texto de PDFs de
 * TDR. Un `<script>` o un `<img onerror>` colado ahí se ejecutaría en el
 * navegador de quien abra la ficha (posible cadena: TDR malicioso → prompt
 * injection → HTML en el campo → XSS). DOMPurify lo neutraliza dejando la tabla,
 * las viñetas y el formato.
 *
 * `gfm` + `breaks` para que las tablas GitHub-flavored (la matriz de riesgos) y
 * los saltos de línea se rendericen igual en los tres sitios que lo usan
 * (edición, lectura y copiloto). Las opciones van por llamada, no por
 * `marked.setOptions` global, para no depender del orden de carga de módulos.
 *
 * Si `marked` falla, se devuelve el texto ORIGINAL saneado (nunca HTML sin
 * sanear): el peor caso es que se vea el Markdown crudo, no un XSS.
 */
export function markdownAHtmlSeguro(md: string | null | undefined): string {
  const texto = md ?? "";
  try {
    const html = marked.parse(texto, { async: false, gfm: true, breaks: true }) as string;
    return DOMPurify.sanitize(html);
  } catch {
    return DOMPurify.sanitize(texto);
  }
}
