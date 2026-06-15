export function addProjectionWarning(state, code, message, details = {}) {
  state.projectionWarnings.push({ code, message, details });
  state.debugWarnings.push({ code, message, details });
}
