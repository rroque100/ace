import { documentFacts } from "@/lib/document-facts";
export function DocumentFacts({
  document,
}: {
  document: Parameters<typeof documentFacts>[0];
}) {
  const facts = documentFacts(document);
  if (!facts.length) return null;
  return (
    <dl className="tw my-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {facts.map((f) => (
        <div key={f.label}>
          <dt className="text-xs font-semibold text-slate-500">
            {f.label}
            {f.detected ? " · dato detectado" : ""}
          </dt>
          <dd className="mt-1 break-words text-slate-800">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
