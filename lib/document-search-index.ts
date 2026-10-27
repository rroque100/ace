/** Compatibility only for a migration that is absent; outages must stay errors. */
export function missingSearchIndex(error:unknown) {
  return error instanceof Error && /PGRST202|42883/.test(error.message) && /ace_search_(?:document|library)/.test(error.message);
}
