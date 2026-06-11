/**
 * Retrieval metrics over chunk ids of the form `${filePath}#${name}`.
 *
 * A relevant id may be either an exact chunk id ("src/cart.ts#Cart.getTotal")
 * or a bare file path ("src/format.ts"), which matches any chunk of that file.
 */

export function matchesRelevant(chunkId: string, relevantId: string): boolean {
  if (relevantId.includes("#")) return chunkId === relevantId;
  return chunkId.startsWith(`${relevantId}#`);
}

function isRelevant(chunkId: string, relevantIds: string[]): boolean {
  return relevantIds.some((relevantId) => matchesRelevant(chunkId, relevantId));
}

/** Count distinct relevant ids matched within the top k retrieved results. */
function relevantHitsInTopK(
  retrievedIds: string[],
  relevantIds: string[],
  k: number,
): number {
  const topK = retrievedIds.slice(0, k);
  const matched = new Set<string>();
  for (const chunkId of topK) {
    for (const relevantId of relevantIds) {
      if (matchesRelevant(chunkId, relevantId)) matched.add(relevantId);
    }
  }
  return matched.size;
}

export function precisionAtK(
  retrievedIds: string[],
  relevantIds: string[],
  k: number,
): number {
  if (k < 1) throw new RangeError(`k must be >= 1, got ${k}`);
  return relevantHitsInTopK(retrievedIds, relevantIds, k) / k;
}

export function recallAtK(
  retrievedIds: string[],
  relevantIds: string[],
  k: number,
): number {
  if (k < 1) throw new RangeError(`k must be >= 1, got ${k}`);
  if (relevantIds.length === 0) return 0;
  return relevantHitsInTopK(retrievedIds, relevantIds, k) / relevantIds.length;
}

export function reciprocalRank(
  retrievedIds: string[],
  relevantIds: string[],
): number {
  const index = retrievedIds.findIndex((chunkId) =>
    isRelevant(chunkId, relevantIds),
  );
  return index === -1 ? 0 : 1 / (index + 1);
}

export function meanReciprocalRank(
  perQuery: { retrievedIds: string[]; relevantIds: string[] }[],
): number {
  return mean(
    perQuery.map(({ retrievedIds, relevantIds }) =>
      reciprocalRank(retrievedIds, relevantIds),
    ),
  );
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
