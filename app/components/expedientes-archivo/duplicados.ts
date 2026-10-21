// Firma de la última comprobación de duplicados: clave por SGD/serie cuando los
// hay (así la comprobación al teclear y la de la extracción IA comparten firma
// y no se pisan), y por título como último recurso. La usan el wizard individual
// (checkDuplicatesFor) y el modo por lotes (batch-upload.tsx): si cambias la
// regla, cambia en los dos sitios a la vez porque es la que evita llamadas
// duplicadas al endpoint /duplicates.
export function firmaDuplicados(params: {
  sgd?: string;
  serie?: string;
  title?: string;
}): string {
  const sgd = (params.sgd ?? "").trim();
  const serie = (params.serie ?? "").trim();
  if (sgd || serie) return `k:${sgd}|${serie}`;
  return `t:${(params.title ?? "").trim()}`;
}
