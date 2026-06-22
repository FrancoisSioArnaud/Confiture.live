const APPEARANCE_PREFIX = "appearance_";
const HOLE_PREFIX = "hole_";

/**
 * Build the canonical deterministic appearance id.
 *
 * @param {string} participationId
 * @param {number} appearanceIndex
 * @returns {string}
 */
export function makeAppearanceId(participationId, appearanceIndex) {
  if (!participationId)
    throw new Error("participationId is required to build an appearance id.");
  if (!Number.isInteger(appearanceIndex) || appearanceIndex < 1)
    throw new Error("appearanceIndex must be a positive integer.");
  return `${APPEARANCE_PREFIX}${participationId}_${appearanceIndex}`;
}

/**
 * Convert an appearance id to the resolver card id used in layouts.
 *
 * @param {string} appearanceId
 * @returns {string}
 */
export function makeCardIdFromAppearanceId(appearanceId) {
  if (!appearanceId || !String(appearanceId).startsWith(APPEARANCE_PREFIX))
    throw new Error('appearanceId must start with "appearance_".');
  return String(appearanceId);
}

/**
 * Convert a hole id to the resolver card id used in layouts.
 *
 * @param {string} holeId
 * @returns {string}
 */
export function makeCardIdFromHoleId(holeId) {
  if (!holeId || !String(holeId).startsWith(HOLE_PREFIX))
    throw new Error('holeId must start with "hole_".');
  return String(holeId);
}

/**
 * Parse a resolver card id into its canonical target metadata.
 *
 * @param {string} cardId
 * @returns {{ cardId: string, type: 'appearance', appearanceId: string, holeId: null } | { cardId: string, type: 'hole', appearanceId: null, holeId: string }}
 */
export function parseCardId(cardId) {
  const value = String(cardId ?? "");
  if (value.startsWith(APPEARANCE_PREFIX))
    return {
      cardId: value,
      type: "appearance",
      appearanceId: value,
      holeId: null,
    };
  if (value.startsWith(HOLE_PREFIX))
    return { cardId: value, type: "hole", appearanceId: null, holeId: value };
  throw new Error(`Unknown resolver card id: ${value}`);
}
