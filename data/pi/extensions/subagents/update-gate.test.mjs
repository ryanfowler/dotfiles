import assert from "node:assert/strict";
import test from "node:test";
import { ExpandedUpdateGate } from "./update-gate.js";

test("pauses partial updates only while the running result is expanded", () => {
  const gate = new ExpandedUpdateGate();

  gate.sync("call-1", { expanded: true, isPartial: true, isError: false });
  assert.equal(gate.isPaused("call-1"), true);

  gate.sync("call-1", { expanded: false, isPartial: true, isError: false });
  assert.equal(gate.isPaused("call-1"), false);
});

test("allows final and error results while expanded", () => {
  const gate = new ExpandedUpdateGate();

  gate.sync("final", { expanded: true, isPartial: true, isError: false });
  gate.sync("final", { expanded: true, isPartial: false, isError: false });
  assert.equal(gate.isPaused("final"), false);

  gate.sync("error", { expanded: true, isPartial: true, isError: false });
  gate.sync("error", { expanded: true, isPartial: true, isError: true });
  assert.equal(gate.isPaused("error"), false);
});

test("tracks concurrent tool calls independently and supports cleanup", () => {
  const gate = new ExpandedUpdateGate();

  gate.sync("expanded", { expanded: true, isPartial: true, isError: false });
  gate.sync("collapsed", { expanded: false, isPartial: true, isError: false });
  assert.equal(gate.isPaused("expanded"), true);
  assert.equal(gate.isPaused("collapsed"), false);

  gate.delete("expanded");
  assert.equal(gate.isPaused("expanded"), false);
});
