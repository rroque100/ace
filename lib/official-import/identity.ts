type CorpusRecord = { id: string; es_institucional?: boolean; metadata: Record<string, unknown> };
type Identity = { documentId?: string; sha256?: string; publicationUrl: string; pdfUrl: string };
/** Solo reutiliza registros del corpus compartido con identidad conocida. */
export function findKnownOfficialDocument<T extends CorpusRecord>(records: T[], item: Identity): T | undefined {
  const record = records.find(doc => doc.id === item.documentId ||
    (Boolean(item.sha256) && doc.metadata.sha256 === item.sha256) ||
    (doc.metadata.officialPublicationUrl === item.publicationUrl && doc.metadata.sourceUrl === item.pdfUrl));
  if (record && !record.es_institucional) throw new Error("El registro coincidente es privado; no se reutiliza ni se lee su archivo");
  return record;
}
