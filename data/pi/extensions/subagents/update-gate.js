export class ExpandedUpdateGate {
  #toolCallIds = new Set();

  sync(toolCallId, { expanded, isPartial, isError }) {
    if (expanded && isPartial && !isError) this.#toolCallIds.add(toolCallId);
    else this.#toolCallIds.delete(toolCallId);
  }

  isPaused(toolCallId) {
    return this.#toolCallIds.has(toolCallId);
  }

  delete(toolCallId) {
    this.#toolCallIds.delete(toolCallId);
  }
}
