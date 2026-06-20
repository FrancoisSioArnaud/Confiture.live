export function addLink(state, payload) {
  const link = {
    id: payload.linkId,
    linkId: payload.linkId,
    targets: payload.targets.map((target) => ({ ...target })),
    reorderStrategy: payload.reorderStrategy ?? state.jam?.linkReorderStrategy ?? 'move_to_first',
    status: 'active',
    suppressedByConflict: false,
    suppressedBySameColumn: false,
    suppressedByInvalidTargets: payload.targets.length < 2,
  };
  state.links[payload.linkId] = link;
}

export function removeLink(state, linkId) {
  if (state.links[linkId]) state.links[linkId].status = 'removed';
}
