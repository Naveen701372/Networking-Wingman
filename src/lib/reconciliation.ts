export type RoutingAction = 'auto-apply' | 'suggest' | 'discard';

export interface ReconciliationUpdate {
  cardId: string;
  changes: Record<string, string | string[] | null>;
  confidence: number;
  reason: string;
}

export interface ReconciliationMerge {
  sourceCardId: string;
  targetCardId: string;
  confidence: number;
  reason: string;
}

export interface RoutedUpdate {
  update: ReconciliationUpdate;
  action: RoutingAction;
}

export interface RoutedMerge {
  merge: ReconciliationMerge;
  action: RoutingAction;
}

/**
 * Routes a reconciliation update based on confidence score.
 * >90 → auto-apply, 60–90 → suggest, <60 → discard
 */
export function routeUpdate(update: ReconciliationUpdate): RoutedUpdate {
  return {
    update,
    action: routeByConfidence(update.confidence),
  };
}

/**
 * Routes a reconciliation merge based on confidence score.
 */
export function routeMerge(merge: ReconciliationMerge): RoutedMerge {
  return {
    merge,
    action: routeByConfidence(merge.confidence),
  };
}

/**
 * Pure confidence → action mapping.
 */
export function routeByConfidence(confidence: number): RoutingAction {
  if (confidence > 90) return 'auto-apply';
  if (confidence >= 60) return 'suggest';
  return 'discard';
}
