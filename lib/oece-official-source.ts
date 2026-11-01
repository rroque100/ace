import { validateOfficialUrl } from "./official-import/download";
export const OECE_OFFICIAL_SOURCE =
  "https://www.gob.pe/institucion/oece/normas-legales";
export type OfficialListingItem = {
  url: string;
  title: string;
  publicationUrl: string;
  publicationDate: string | null;
  number: string | null;
  detectedType: string | null;
  summary: string;
};
function plain(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(
      /&(?:nbsp|amp|quot|lt|gt);/g,
      (m) =>
        ({
          "&nbsp;": " ",
          "&amp;": "&",
          "&quot;": '"',
          "&lt;": "<",
          "&gt;": ">",
        })[m] ?? m,
    )
    .replace(/\s+/g, " ")
    .trim();
}
export function isOeceCatalogue(value: string) {
  const u = validateOfficialUrl(value);
  return (
    u.hostname === "www.gob.pe" &&
    /^\/institucion\/oece\/(?:normas-legales(?:\/tipos\/\d+-[a-z-]+)?|informes-publicaciones(?:\/tipos\/65-opinion)?)$/.test(
      u.pathname,
    )
  );
}
export function proposedOfficialType(title: string) {
  const t = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/^informe(?:s)?\s+(?:de\s+)?(?:ivn\b|vicios?\s+de\s+nulidad\b)/.test(t))
    return "informe_vicio_nulidad";
  if (/^acuerdo de sala plena\b/.test(t)) return "acuerdo_sala_plena";
  if (/^directiva\b/.test(t)) return "directiva";
  if (/^lineamiento/.test(t)) return "lineamiento";
  if (/^ley\b|^decreto legislativo\b|^decreto de urgencia\b/.test(t))
    return "ley";
  if (/^resolucion\b/.test(t)) return "resolucion";
  if (/^opinion\b/.test(t)) return "opinion";
  return null;
}
export function parseOeceCatalogue(html: string, base: string) {
  if (!isOeceCatalogue(base))
    throw Error("Este adaptador solo consulta el catálogo oficial del OECE.");
  const requestedTerms = new URL(base).searchParams
    .get("filter[terms]")
    ?.trim();
  if (
    requestedTerms &&
    new URL(base).pathname.endsWith("/informes-publicaciones")
  ) {
    const input = [...html.matchAll(/<input\b[^>]*>/gi)]
      .map((m) => m[0])
      .find((tag) => /name=["']filter\[terms\]["']/i.test(tag));
    const appliedTerms = input?.match(/\bvalue=["']([^"']*)["']/i)?.[1];
    if (appliedTerms === undefined || plain(appliedTerms) !== requestedTerms)
      throw Error(
        "El catálogo no confirmó el filtro solicitado; revisión incompleta.",
      );
  }
  const resultList = html.match(
    /<ul\b[^>]*class=["'][^"']*js-(?:rules|reports)-search-results[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i,
  )?.[1];
  if (resultList === undefined)
    throw Error(
      "El catálogo oficial cambió de estructura; no se dará por revisado.",
    );
  const items: OfficialListingItem[] = [];
  let publications = 0,
    withoutPdf = 0;
  for (const li of resultList.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const anchors = [
      ...li[1].matchAll(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      ),
    ];
    const publication = anchors.find((a) => {
      try {
        const u = new URL(a[1], base);
        return (
          u.hostname === "www.gob.pe" &&
          /^\/institucion\/oece\/(?:normas-legales|informes-publicaciones)\/\d+/.test(
            u.pathname,
          )
        );
      } catch {
        return false;
      }
    });
    if (!publication) continue;
    publications++;
    const title = plain(publication[2]);
    const publicationUrl = new URL(publication[1], base).href;
    const date =
      li[1].match(
        /<time\b[^>]*datetime=["'](\d{4}-\d{2}-\d{2})[^"']*["']/i,
      )?.[1] ?? null;
    const summary = plain(
      li[1].match(
        /<div\b[^>]*id=["']p-filter-item-[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      )?.[1] ?? "",
    );
    const files = new Set<string>();
    for (const a of anchors) {
      try {
        const u = validateOfficialUrl(
          new URL(a[1].replaceAll("&amp;", "&"), base).href,
        );
        if (!/\.pdf$/i.test(u.pathname)) continue;
        u.hash = "";
        files.add(u.href);
      } catch {
        /* External and non-PDF links cannot become original files. */
      }
    }
    if (!files.size) withoutPdf++;
    for (const url of files)
      items.push({
        url,
        title: title || "Documento oficial sin título",
        publicationUrl,
        publicationDate: date,
        number:
          title.match(/\sN\.?\s*[°ºo]?\s*([D\d][\w./-]*)/i)?.[1]?.trim() ??
          null,
        detectedType: proposedOfficialType(title),
        summary,
      });
  }
  const nextHref =
    html.match(/<a\b[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
    html.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*rel=["']next["']/i)?.[1];
  let nextUrl: string | null = null;
  if (nextHref) {
    const u = new URL(nextHref.replaceAll("&amp;", "&"), base);
    if (!isOeceCatalogue(u.href))
      throw Error("Paginación oficial fuera del catálogo.");
    const sheet = Number(u.searchParams.get("sheet"));
    if (!Number.isSafeInteger(sheet) || sheet < 2 || sheet > 100000)
      throw Error("Página de continuación inválida.");
    nextUrl = u.href;
  }
  return {
    items: [...new Map(items.map((i) => [i.url, i])).values()],
    publications,
    withoutPdf,
    nextUrl,
  };
}
