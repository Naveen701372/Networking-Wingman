/**
 * Tracks card IDs that have been deleted via merge operations.
 * Used by useAutoPersist to avoid re-creating deleted cards.
 * Extracted into its own module to avoid circular imports between
 * useAppStore and useAutoPersist.
 */

const deletedCardIds = new Set<string>();

/** Mark a card as deleted so autoPersist never re-creates it */
export function markCardDeleted(cardId: string) {
  deletedCardIds.add(cardId);
}

/** Check if a card has been deleted */
export function isCardDeleted(cardId: string): boolean {
  return deletedCardIds.has(cardId);
}
