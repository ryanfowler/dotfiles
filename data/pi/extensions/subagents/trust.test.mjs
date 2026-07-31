import assert from "node:assert/strict";
import test from "node:test";
import { isWithinDirectory, resolveSubagentProjectTrust } from "./trust.js";

const parentCwd = "/work/project";

function resolve(cwd, parentTrusted, entry = null) {
  return resolveSubagentProjectTrust({
    parentCwd,
    cwd,
    parentTrusted,
    getTrustEntry: () => entry,
  });
}

test("recognizes only the root and its descendants", () => {
  assert.equal(isWithinDirectory(parentCwd, parentCwd), true);
  assert.equal(isWithinDirectory(parentCwd, "/work/project/src"), true);
  assert.equal(isWithinDirectory(parentCwd, "/work/project-other"), false);
  assert.equal(isWithinDirectory(parentCwd, "/work"), false);
});

test("inherits the active session decision without a nested decision", () => {
  assert.equal(resolve(parentCwd, true), true);
  assert.equal(resolve("/work/project/src", false), false);
  assert.equal(resolve("/work/project/src", false, { path: parentCwd, decision: true }), false);
  assert.equal(resolve("/work/project/src", true, { path: "/work", decision: false }), true);
});

test("honors a more-specific nested trust decision", () => {
  const nested = "/work/project/vendor/repository";
  assert.equal(resolve(`${nested}/src`, true, { path: nested, decision: false }), false);
  assert.equal(resolve(`${nested}/src`, false, { path: nested, decision: true }), true);
});

test("uses only persisted trust for an unrelated directory", () => {
  const external = "/other/project";
  assert.equal(resolve(external, true), false);
  assert.equal(resolve(external, false, { path: external, decision: true }), true);
  assert.equal(resolve(external, true, { path: external, decision: false }), false);
});
