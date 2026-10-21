// Slugify compartido para nombres de archivo y URLs.
// Quita acentos, espacios y caracteres no alfanumericos.

export function slugify(value: string, maxLen = 60): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, maxLen) || "documento"
  );
}
