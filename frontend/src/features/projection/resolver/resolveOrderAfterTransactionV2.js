import { buildVisibleCards } from "./buildVisibleCards";
import { buildLinkGroups } from "./buildLinkGroups";
import { buildActiveConflicts } from "./buildActiveConflicts";
import { buildInitialLayout } from "./buildInitialLayout";
import { applyTransactionIntent } from "./applyTransactionIntent";
import {
  layoutHash,
  RESOLUTION_LIMITS,
  runResolutionPass,
} from "./runResolutionPass";
import { normalizeVisualIndexes } from "./normalizeVisualIndexes";
import { createResolverWarning } from "./resolverWarnings";

export function resolveOrderAfterTransactionV2(input = {}) {
  const transactionContext = input.transactionContext ?? { transactionId: "" };
  const visibleCards = buildVisibleCards(input);
  const linkResult = buildLinkGroups({
    cards: visibleCards,
    links: input.links ?? [],
    hiddenColumnIds: input.hiddenColumnIds ?? [],
    transactionContext,
  });
  const conflictResult = buildActiveConflicts({
    cards: visibleCards,
    conflicts: input.conflicts ?? [],
    hiddenColumnIds: input.hiddenColumnIds ?? [],
    transactionContext,
  });
  let layout = applyTransactionIntent(
    buildInitialLayout({
      cards: visibleCards,
      previousLayout: input.previousLayout,
    }),
    transactionContext,
  );
  const warnings = [...linkResult.warnings, ...conflictResult.warnings];
  const anchorLayout = layout[transactionContext.anchorCardId];
  if (transactionContext.intent === "move" && anchorLayout?.fixed === true) {
    warnings.push(
      createResolverWarning("invalid_action_replayed", "fixed_card_move_refused", {
        transactionId: transactionContext.transactionId,
        cardIds: [transactionContext.anchorCardId],
      }),
    );
  }
  [transactionContext.afterTargetCardId, transactionContext.beforeTargetCardId]
    .filter(Boolean)
    .filter((cardId) => !layout[cardId])
    .forEach((cardId) => {
      warnings.push(
        createResolverWarning("missing_target", "move_target_missing", {
          transactionId: transactionContext.transactionId,
          cardIds: [cardId],
        }),
      );
    });
  const seen = new Set([layoutHash(layout)]);
  const maxPasses =
    input.config?.limits?.MAX_PASSES ?? RESOLUTION_LIMITS.MAX_PASSES;
  const maxRepairs =
    visibleCards.length *
    (input.config?.limits?.MAX_REPAIRS_PER_PASS_MULTIPLIER ??
      RESOLUTION_LIMITS.MAX_REPAIRS_PER_PASS_MULTIPLIER);
  const debug = { passes: 0, layoutHashes: [] };

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const result = runResolutionPass(layout, {
      links: linkResult.links,
      conflicts: conflictResult.conflicts,
      transactionContext,
    });
    debug.passes = pass + 1;
    debug.layoutHashes.push(layoutHash(result.layout));
    warnings.push(...result.warnings);
    layout = result.layout;
    if (result.repairCount > maxRepairs) {
      warnings.push(
        createResolverWarning(
          "resolver_max_passes_reached",
          "max_repairs_per_pass_reached",
          { transactionId: transactionContext.transactionId },
        ),
      );
      break;
    }
    const hash = layoutHash(layout);
    if (!result.changed) break;
    if (seen.has(hash)) {
      warnings.push(
        createResolverWarning(
          "resolver_cycle_detected",
          "layout_cycle_detected",
          { transactionId: transactionContext.transactionId },
        ),
      );
      break;
    }
    seen.add(hash);
    if (pass === maxPasses - 1)
      warnings.push(
        createResolverWarning(
          "resolver_max_passes_reached",
          "max_passes_reached",
          { transactionId: transactionContext.transactionId },
        ),
      );
  }
  return {
    ...normalizeVisualIndexes(layout),
    projectionWarnings: warnings,
    debug,
  };
}
