import { legalValidity } from "@/lib/legal-center";

export function LegalValidityBadge({ value, status }: { value?: string | null; status?: string | null }) {
  const validity = legalValidity(value, status);
  return <span className={`normTag legalValidity ${validity.tone}`} title="Estado registrado del documento; comprueba su aplicabilidad al caso.">{validity.label}</span>;
}
