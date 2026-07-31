import assert from "node:assert/strict";
import test from "node:test";
import { resolveAvailableModel } from "./model-selection.js";

const models = [
  { provider: "openai-codex", id: "gpt-5.6-sol" },
  { provider: "anthropic", id: "claude-opus-4-6" },
  { provider: "openrouter", id: "anthropic/claude-opus-4-6" },
  { provider: "proxy", id: "gpt-5.6-sol" },
];

test("resolves any available model by provider-qualified name", () => {
  assert.equal(resolveAvailableModel(models, "anthropic/claude-opus-4-6"), models[1]);
  assert.equal(resolveAvailableModel(models, "openrouter/anthropic/claude-opus-4-6"), models[2]);
});

test("resolves a unique model ID", () => {
  assert.equal(resolveAvailableModel(models, "claude-opus-4-6"), models[1]);
});

test("requires a provider when a model ID is ambiguous", () => {
  assert.throws(
    () => resolveAvailableModel(models, "gpt-5.6-sol"),
    /Use one of: openai-codex\/gpt-5\.6-sol, proxy\/gpt-5\.6-sol/,
  );
});

test("rejects unavailable models", () => {
  assert.throws(() => resolveAvailableModel(models, "missing/model"), /Model override is unavailable/);
});
