import { isAbsolute, relative, sep } from "node:path";

/**
 * Return true when candidate is root or one of its descendants.
 * Both paths must be canonical absolute paths.
 *
 * @param {string} root
 * @param {string} candidate
 */
export function isWithinDirectory(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

/**
 * Resolve trust for a subagent working directory.
 * The active parent-session decision overrides saved decisions at or above the
 * parent. A more-specific saved decision applies to a nested project.
 *
 * @param {{
 *   parentCwd: string,
 *   cwd: string,
 *   parentTrusted: boolean,
 *   getTrustEntry: (cwd: string) => { path: string, decision: boolean } | null,
 * }} options
 */
export function resolveSubagentProjectTrust({ parentCwd, cwd, parentTrusted, getTrustEntry }) {
  const entry = getTrustEntry(cwd);
  if (!isWithinDirectory(parentCwd, cwd)) return entry?.decision === true;

  const hasNestedDecision =
    entry !== null &&
    entry.path !== parentCwd &&
    isWithinDirectory(parentCwd, entry.path);
  return hasNestedDecision ? entry.decision : parentTrusted;
}
