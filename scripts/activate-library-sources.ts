import fs from "node:fs";
import { createHash } from "node:crypto";
import { libraryCollectionIds } from "../lib/library-workspace";
async function main() {
  process.loadEnvFile(".env.local");
  if (
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname !==
    "medmcaiskvtbckpakseo.supabase.co"
  )
    throw Error("El proyecto no coincide con el destino autorizado.");
  const { getSupabaseAdminClient, writeAuditLog } =
    await import("../lib/supabase-server");
  const { indexSourceDocument } = await import("../lib/source-indexing");
  const { processPdfForSearch, extractPdfText } =
    await import("../lib/pdf-processing");
  const { assertCompleteOfficialExtraction } =
    await import("../lib/official-import/extraction");
  const client = await getSupabaseAdminClient();
  const original = JSON.parse(
    fs.readFileSync(
      "docs/importaciones/celex-verificacion-2026-10-27.json",
      "utf8",
    ),
  );
  const selected = original.documents.filter(
    (d: { new: boolean; status: string; format: string }) =>
      d.new &&
      d.status !== "indexed" &&
      (!process.argv.includes("--refresh-blocks") ||
        d.format.includes("wordprocessing")),
  );
  const output = "docs/importaciones/celex-activacion-2026-10-27.json";
  const report: { startedAt: string; entries: Array<Record<string, unknown>> } =
    {
      startedAt: new Date().toISOString(),
      entries: fs.existsSync(output)
        ? JSON.parse(fs.readFileSync(output, "utf8")).entries
        : [],
    };
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
  for (const item of selected) {
    let result = report.entries.find((r) => r.id === item.id);
    if (
      result?.status === "indexed" &&
      !process.argv.includes("--refresh-blocks")
    )
      continue;
    if (!result) {
      result = { id: item.id, title: item.title };
      report.entries.push(result);
    }
    try {
      const { data: doc, error } = await client
        .from("documents")
        .select("*")
        .eq("id", item.id)
        .eq("es_institucional", true)
        .single();
      if (error) throw error;
      if (
        doc.status === "indexed" &&
        doc.metadata.indexedTextComplete === true &&
        (!process.argv.includes("--refresh-blocks") ||
          doc.metadata.indexingPipelineVersion === "source-blocks-v2")
      ) {
        result.status = "indexed";
        result.reused = true;
        save();
        continue;
      }
      const kind = doc.metadata.documentSubtype;
      const documentType = [
        "lineamiento",
        "codigo_etica",
        "comunicado",
        "indice_documental",
      ].includes(kind)
        ? kind
        : doc.document_type;
      const title = String(doc.title)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const object = /consultori/.test(title)
        ? "consultoria"
        : /bienes|vaso de leche/.test(title)
          ? "bienes"
          : /obra|arquitectonic/.test(title)
            ? "obras"
            : /servicio|expertos|gerentes/.test(title)
              ? "servicios"
              : null;
      const metadata = {
        ...doc.metadata,
        libraryCollections: {
          values: libraryCollectionIds(doc.title, doc.metadata),
          reviewed: false,
          origin: "title-and-registered-topic",
        },
        ...(object
          ? { contractObject: object, contractObjectReviewed: false }
          : {}),
        sourceLocatorKind:
          doc.mime_type === "application/pdf" ? "page" : "block",
      };
      await client
        .from("documents")
        .update({ document_type: documentType, metadata })
        .eq("id", doc.id)
        .throwOnError();
      const current = { ...doc, document_type: documentType, metadata };
      const { data: blob, error: read } = await client.storage
        .from(doc.storage_bucket)
        .download(doc.storage_path);
      if (read) throw read;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (
        createHash("sha256").update(bytes).digest("hex") !== doc.metadata.sha256
      )
        throw Error("El original no coincide con la huella registrada.");
      if (doc.mime_type === "application/pdf") {
        const file = new File([bytes], doc.file_name, {
          type: "application/pdf",
        });
        const extracted = await extractPdfText(file);
        assertCompleteOfficialExtraction(extracted);
        await processPdfForSearch(current, file);
      } else
        await indexSourceDocument(current, bytes, {
          force: process.argv.includes("--refresh-blocks"),
        });
      const { data: verified, error: verify } = await client
        .from("documents")
        .select("status,metadata")
        .eq("id", doc.id)
        .single();
      if (verify) throw verify;
      if (
        verified.status !== "indexed" ||
        verified.metadata.indexedTextComplete !== true
      )
        throw Error("No se acreditó la indexación completa.");
      result.status = "indexed";
      result.type = documentType;
      result.chunks = verified.metadata.chunkCount;
      result.blocks = verified.metadata.blockCount ?? null;
      result.pages = verified.metadata.pageCount ?? null;
      result.verifiedAt = new Date().toISOString();
      delete result.error;
      await writeAuditLog({
        action: "document.library.activate",
        entityType: "document",
        entityId: doc.id,
        details: {
          type: documentType,
          originalUnchanged: true,
          sha256: doc.metadata.sha256,
        },
      });
      console.log(
        "INDEXED",
        documentType,
        doc.title,
        JSON.stringify({
          chunks: result.chunks,
          blocks: result.blocks,
          pages: result.pages,
        }),
      );
    } catch (error) {
      result.status = "pending";
      result.error = error instanceof Error ? error.message : String(error);
      console.log("PENDING", item.title, result.error);
    }
    save();
  }
  console.log(
    "RESUMEN",
    JSON.stringify({
      selected: selected.length,
      indexed: report.entries.filter((r) => r.status === "indexed").length,
      pending: report.entries.filter((r) => r.status !== "indexed").length,
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
