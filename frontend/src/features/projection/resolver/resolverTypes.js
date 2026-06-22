/**
 * @typedef {Object} ResolverCard
 * @property {string} cardId Unique resolver card id used by links, conflicts, and layouts.
 * @property {'appearance'|'hole'} type Card kind.
 * @property {string} columnId Immutable instrument column id.
 * @property {?string} participantId Participant id for appearance cards, otherwise null.
 * @property {?string} participationId Participation id for appearance cards, otherwise null.
 * @property {?string} appearanceId Canonical appearance id when `type` is `appearance`, otherwise null.
 * @property {?string} holeId Canonical hole id when `type` is `hole`, otherwise null.
 * @property {?number} appearanceIndex Business round index; metadata only and never an ordering priority.
 * @property {number} createdAtOrder Stable creation/replay order.
 * @property {number} baseOrder Historical fallback order used only when previous layout is absent.
 * @property {?number} previousResolvedRow Resolved row from the previous active transaction layout.
 * @property {?number} resolvedRow Incoming cached resolved row, recalculated by resolver output.
 * @property {?number} visualIndex Incoming visual index, ignored for constraints and recalculated in output.
 * @property {?number} cardIndexInColumn Incoming local column index, ignored for constraints and recalculated in output.
 * @property {boolean} played True when the card is played and fixed.
 * @property {boolean} locked True when the card is locked and fixed until unlocked.
 * @property {boolean} deleted True when the card is deleted/removed from visible resolution.
 * @property {boolean} hidden True when the card is hidden from visible resolution.
 * @property {?string} sourceEventId Event that created or last materially affected this card, when known.
 * @property {?string} sourceTransactionId Transaction that created or last materially affected this card, when known.
 */

/**
 * @typedef {Object} ResolverLink
 * @property {string} linkId Stable link id.
 * @property {string[]} targetCardIds Concrete resolver card ids in the link group.
 * @property {boolean} active True when this link participates in resolution.
 * @property {'move_to_first'|'move_to_last'|'average_position'} reorderStrategy Strategy copied from the `link_created` event.
 * @property {number} createdAtOrder Stable creation/replay order.
 * @property {string} transactionId Transaction that created this link.
 * @property {string} eventId Event that created this link.
 */

/**
 * @typedef {Object} ResolverConflict
 * @property {string} conflictId Stable conflict id.
 * @property {'appearance'|'participation'} scope Conflict scope before participation expansion.
 * @property {string[]} [targetCardIds] Concrete target card ids for `scope: 'appearance'` or expanded conflicts.
 * @property {string[]} [targetParticipationIds] Participation ids for `scope: 'participation'` before expansion.
 * @property {'instrument_constraint'|'manual'} reason Business reason for this conflict.
 * @property {boolean} active True when this conflict participates in resolution.
 * @property {number} createdAtOrder Stable creation/replay order.
 * @property {string} transactionId Transaction that created this conflict.
 * @property {string} eventId Event that created this conflict.
 */

/**
 * @typedef {Object} ResolverLayoutEntry
 * @property {string} cardId Card id for this layout entry.
 * @property {string} columnId Immutable column id for this card.
 * @property {number} resolvedRow Logical row used for constraints.
 * @property {number} visualIndex Globally compact visual index derived from visible resolved rows.
 * @property {number} cardIndexInColumn One-based local rank in the rendered column, derived from resolved rows.
 */

/**
 * @typedef {Object} TransactionContext
 * @property {string} transactionId Current transaction id.
 * @property {string[]} eventIds Event ids contained in the current transaction.
 * @property {'move'|'card_created'|'link_created'|'conflict_created'|'skip'|'lock'|'unlock'|'play'|'unplay'|'visibility_changed'|'neutral'} intent Canonical transaction intent.
 * @property {?string} anchorCardId Main card id for user intent, or null.
 * @property {string[]} affectedCardIds Card ids directly affected by the transaction.
 * @property {?string} afterTargetCardId Move lower bound target, or null.
 * @property {?string} beforeTargetCardId Move upper bound target, or null.
 * @property {?number} preferredResolvedRow Preferred row from payload/context, or null.
 * @property {?number} playedResolvedRow Fixed played row from play payload/context, or null.
 * @property {?('move_to_first'|'move_to_last'|'average_position')} linkStrategy Link strategy copied from link creation, or null.
 * @property {Object} metadata Stable extra context specific to the canonical intent.
 */

/**
 * @typedef {Object} ProjectionWarning
 * @property {'link_unresolvable'|'conflict_unresolvable'|'column_collision_unresolvable'|'invalid_action_replayed'|'missing_target'|'resolver_max_passes_reached'|'resolver_cycle_detected'|'hidden_column_constraint_ignored'|'skip_unresolvable'} type Closed-catalog warning type.
 * @property {'info'|'warning'|'error'} severity Warning severity.
 * @property {string} reason Closed-catalog reason for this warning type.
 * @property {string} transactionId Transaction id associated with the warning, or empty string when unavailable.
 * @property {string} [eventId] Event id associated with the warning, when available.
 * @property {string[]} cardIds Card ids associated with the warning.
 * @property {string[]} [linkIds] Link ids associated with the warning, when available.
 * @property {string[]} [conflictIds] Conflict ids associated with the warning, when available.
 * @property {string[]} [columnIds] Column ids associated with the warning, when available.
 * @property {string} message Stable human-readable message.
 */

/**
 * @typedef {Object} ResolverInput
 * @property {ResolverCard[]} cards Candidate cards known by projection before hidden-column filtering.
 * @property {ResolverLink[]} links Active and inactive links known by projection.
 * @property {ResolverConflict[]} conflicts Active and inactive conflicts known by projection.
 * @property {Set<string>} hiddenColumnIds Hidden instrument column ids excluded from visible resolution.
 * @property {{byCardId: Object<string, ResolverLayoutEntry>}} previousLayout Layout from the previous active transaction in replay.
 * @property {TransactionContext} transactionContext Canonical current transaction intent.
 * @property {{defaultLinkReorderStrategy: 'move_to_first'|'move_to_last'|'average_position', costs: Object<string, number>, priorities: Object<string, number>, limits: Object<string, number>}} config Resolver configuration and canonical constants.
 */

/**
 * @typedef {Object} ResolverOutput
 * @property {Object<string, ResolverLayoutEntry>} layoutByCardId Main resolver output indexed by card id.
 * @property {Object<string, string[]>} orderedCardIdsByColumnId Card ids by visible column, sorted by resolved row then stable fallback.
 * @property {number[]} visibleResolvedRows Globally visible resolved rows, sorted ascending before visual compression.
 * @property {ProjectionWarning[]} projectionWarnings Deterministic resolver warnings from the closed catalog.
 */

export {};
