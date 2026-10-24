import { legalValidity } from "@/lib/legal-center";

export function LegalValidityBadge({ value, status }: { value?: string | null; status?: string | null }) {
  const validity = legalValidity(value, status);
  return <span className={`normTag legalValidity ${validity.state === "current" ? "neutral" : validity.tone}`} title="Registro documental; la etiqueta no acredita una revisión de vigencia, revisor ni fecha. Comprueba esta versión y su aplicabilidad al caso.">{validity.state === "current" ? "Registro: vigente · revisión por comprobar" : validity.label}</span>;
}
