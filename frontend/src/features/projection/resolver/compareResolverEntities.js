export function compareResolverEntities(a, b) {
  const previous =
    (a.previousResolvedRow ??
      a.resolvedRow ??
      a.baseOrder ??
      Number.MAX_SAFE_INTEGER) -
    (b.previousResolvedRow ??
      b.resolvedRow ??
      b.baseOrder ??
      Number.MAX_SAFE_INTEGER);
  if (previous !== 0) return previous;
  const created =
    (a.createdAtOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.createdAtOrder ?? Number.MAX_SAFE_INTEGER);
  if (created !== 0) return created;
  return String(a.cardId).localeCompare(String(b.cardId));
}

export function compareLayoutEntries(a, b) {
  const row =
    (a.resolvedRow ?? Number.MAX_SAFE_INTEGER) -
    (b.resolvedRow ?? Number.MAX_SAFE_INTEGER);
  if (row !== 0) return row;
  return compareResolverEntities(a.card, b.card);
}
