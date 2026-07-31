/**
 * Resolve an available model by its provider-qualified name or model ID.
 * A provider-qualified name takes precedence when another model's ID contains
 * the same slash-delimited text.
 */
export function resolveAvailableModel(models, requested) {
  const qualified = models.filter((model) => `${model.provider}/${model.id}` === requested);
  if (qualified.length === 1) return qualified[0];

  const byId = models.filter((model) => model.id === requested);
  if (byId.length === 1) return byId[0];
  if (byId.length > 1) {
    const choices = byId.map((model) => `${model.provider}/${model.id}`).join(", ");
    throw new Error(`Model override is ambiguous: ${requested}. Use one of: ${choices}`);
  }

  throw new Error(`Model override is unavailable: ${requested}`);
}
