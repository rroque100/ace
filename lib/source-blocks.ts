import JSZip from "jszip";
import { createHash } from "node:crypto";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export type SourceBlock = {
  id: string;
  label: string;
  content: string;
  ordinal: number;
  kind: "paragraph" | "heading" | "table";
};
const decodeXml = (text: string) =>
  text
    .replace(/&#x([\da-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
function block(
  content: string,
  label: string,
  kind: SourceBlock["kind"],
  ordinal: number,
): SourceBlock {
  return {
    id: `b${ordinal}-${createHash("sha256").update(content).digest("hex").slice(0, 12)}`,
    content,
    label,
    kind,
    ordinal,
  };
}
export async function extractSourceBlocks(
  bytes: Uint8Array,
  mime: string,
): Promise<SourceBlock[]> {
  if (bytes.length > 30 * 1024 * 1024)
    throw Error("El original supera el límite de 30 MiB.");
  const blocks: SourceBlock[] = [];
  if (mime.split(";")[0] === DOCX_MIME) {
    const zip = await JSZip.loadAsync(bytes);
    const entry = zip.file("word/document.xml");
    if (
      !entry ||
      Object.keys(zip.files).length > 2000 ||
      Object.keys(zip.files).some((name) => /vbaProject\.bin$/i.test(name))
    )
      throw Error("El archivo no es un DOCX admitido sin macros.");
    const declared = (
      entry as unknown as { _data?: { uncompressedSize?: number } }
    )._data?.uncompressedSize;
    if (declared && declared > 50 * 1024 * 1024)
      throw Error("El contenido XML supera el límite permitido.");
    const xml = await entry.async("string");
    if (xml.length > 50 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml))
      throw Error("El XML contiene declaraciones no admitidas.");
    let table = 0,
      row = 0,
      inTable = false,
      section = "";
    // Only OOXML text nodes are read. Relationships and embedded resources are never fetched or executed.
    for (const token of xml.matchAll(
      /<w:tbl\b[^>]*>|<\/w:tbl>|<w:tr\b[^>]*>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g,
    )) {
      const value = token[0];
      if (/^<w:tbl\b/.test(value)) {
        table++;
        row = 0;
        inTable = true;
        continue;
      }
      if (value === "</w:tbl>") {
        inTable = false;
        continue;
      }
      if (/^<w:tr\b/.test(value)) {
        row++;
        continue;
      }
      const text = [
        ...value.matchAll(
          /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b[^>]*\/>/g,
        ),
      ]
        .map((m) => (m[1] === undefined ? " " : decodeXml(m[1])))
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const heading =
        /<w:pStyle[^>]*w:val="(?:Heading|Titulo|T[ií]tulo|title)\d*"/i.test(
          value,
        );
      if (heading) section = text.slice(0, 160);
      const ordinal = blocks.length + 1;
      const label = inTable
        ? `Tabla ${table}, fila ${row} · bloque ${ordinal}`
        : heading
          ? `Sección: ${text.slice(0, 160)}`
          : `${section ? section + " · " : ""}Párrafo ${ordinal}`;
      blocks.push(
        block(
          text,
          label,
          inTable ? "table" : heading ? "heading" : "paragraph",
          ordinal,
        ),
      );
    }
    let supplementaryBytes = 0;
    for (const name of Object.keys(zip.files)
      .filter((name) =>
        /^word\/(?:footnotes|endnotes|header\d+|footer\d+)\.xml$/.test(name),
      )
      .sort()) {
      const part = zip.file(name)!;
      const size =
        (part as unknown as { _data?: { uncompressedSize?: number } })._data
          ?.uncompressedSize ?? 0;
      supplementaryBytes += size;
      if (supplementaryBytes > 30 * 1024 * 1024)
        throw Error("Las notas y encabezados superan el límite permitido.");
      const content = await part.async("string");
      if (/<!DOCTYPE|<!ENTITY/i.test(content))
        throw Error("El XML contiene declaraciones no admitidas.");
      const section = name.includes("footnotes")
        ? "Notas a pie"
        : name.includes("endnotes")
          ? "Notas finales"
          : name.includes("header")
            ? "Encabezado"
            : "Pie del documento";
      for (const match of content.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)) {
        const text = [
          ...match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),
        ]
          .map((m) => decodeXml(m[1]))
          .join("")
          .replace(/\s+/g, " ")
          .trim();
        if (text) {
          const ordinal = blocks.length + 1;
          blocks.push(
            block(text, `${section} · bloque ${ordinal}`, "paragraph", ordinal),
          );
        }
      }
    }
  } else if (mime.startsWith("text/plain")) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\u0000"))
      throw Error("El archivo no es texto plano válido.");
    for (const content of text
      .split(/\r?\n\s*\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean))
      blocks.push(
        block(
          content,
          `Párrafo ${blocks.length + 1}`,
          "paragraph",
          blocks.length + 1,
        ),
      );
  } else throw Error("El formato no admite lectura por bloques.");
  if (blocks.reduce((n, b) => n + b.content.length, 0) < 120)
    throw Error("No se extrajo contenido suficiente del original.");
  if (blocks.length > 20000)
    throw Error("Demasiados bloques; requiere revisión del documento.");
  return blocks;
}

export function splitSourceBlocks(blocks: SourceBlock[], max = 2600) {
  const pieces: Array<{
    content: string;
    locator: string;
    locatorLabel: string;
    sectionTitle: string;
    pageStart: null;
    pageEnd: null;
  }> = [];
  let pending: SourceBlock[] = [];
  let length = 0;
  const flush = () => {
    if (!pending.length) return;
    const first = pending[0],
      last = pending.at(-1)!;
    const label =
      first === last ? first.label : `${first.label} — hasta ${last.label}`;
    pieces.push({
      content: pending.map((b) => b.content).join("\n\n"),
      locator: first.id,
      locatorLabel: label,
      sectionTitle: label,
      pageStart: null,
      pageEnd: null,
    });
    pending = [];
    length = 0;
  };
  for (const b of blocks) {
    if (b.content.length > max) {
      flush();
      for (let start = 0; start < b.content.length; start += max)
        pieces.push({
          content: b.content.slice(start, start + max),
          locator: b.id,
          locatorLabel: b.label,
          sectionTitle: b.label,
          pageStart: null,
          pageEnd: null,
        });
      continue;
    }
    if (length + b.content.length + 2 > max) flush();
    pending.push(b);
    length += b.content.length + 2;
  }
  flush();
  return pieces;
}
