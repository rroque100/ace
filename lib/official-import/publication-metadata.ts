/** Read only the official publication header, never dates mentioned in document prose. */
export function officialPublicationDate(html: string) {
  const legalHeader=html.match(/<div[^>]*class="[^"]*\binstitution-document__header\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const paragraphs=legalHeader?[...legalHeader.matchAll(/<p[^>]*>([^<]+)<\/p>/gi)].map(item=>item[1]):[];
  const header = (legalHeader ?? html).match(/institution-document__publication-type[^>]*>[^<]*<\/p>\s*<p[^>]*>([^<]+)<\/p>/i)?.[1] ?? paragraphs.at(-1);
  const match = header?.trim().match(/^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i);
  if (!match) return null;
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const month = months.indexOf(match[2].toLowerCase().replace("setiembre","septiembre")) + 1;
  if (!month) return null;
  const day = `${match[3]}-${String(month).padStart(2,"0")}-${match[1].padStart(2,"0")}`;
  return !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10) === day ? day : null;
}
