import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type RateLimitWindow = {
  used_percent?: number;
  limit_window_seconds?: number;
  reset_after_seconds?: number;
  reset_at?: number;
};

type CodexUsageResponse = {
  plan_type?: string;
  rate_limit?: {
    allowed?: boolean;
    limit_reached?: boolean;
    primary_window?: RateLimitWindow | null;
    secondary_window?: RateLimitWindow | null;
  } | null;
  credits?: {
    has_credits?: boolean;
    unlimited?: boolean;
    balance?: string;
  } | null;
  rate_limit_reset_credits?: {
    available_count?: number;
  } | null;
};

type PiAuthFile = {
  "openai-codex"?: {
    type: "oauth";
    access?: string;
    refresh?: string;
    expires?: number;
    accountId?: string;
  };
};

const authPath = () => join(homedir(), ".pi", "agent", "auth.json");

const readPiAuth = async () => JSON.parse(await readFile(authPath(), "utf8")) as PiAuthFile;

const formatReset = (window: RateLimitWindow | undefined | null) => {
  if (!window?.reset_at) return "unknown";
  return new Date(window.reset_at * 1000).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDuration = (seconds: number | undefined) => {
  if (typeof seconds !== "number") return undefined;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const progressBar = (remainingPercent: number) => {
  const width = 18;
  const filled = Math.round((remainingPercent / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
};

const formatWindow = (label: string, window: RateLimitWindow | undefined | null) => {
  if (typeof window?.used_percent !== "number") return `${label.padEnd(6)} unavailable`;
  const remaining = Math.max(0, Math.round(100 - window.used_percent));
  const resetAfter = formatDuration(window.reset_after_seconds);
  const reset = resetAfter ? `in ${resetAfter}` : `at ${formatReset(window)}`;
  return `${label.padEnd(6)} ${progressBar(remaining)}  ${String(remaining).padStart(3)}% left  resets ${reset}`;
};

const formatCodexUsage = (usage: CodexUsageResponse) => {
  const lines = [
    "OpenAI Codex Rate Limits",
    "",
    formatWindow("5h", usage.rate_limit?.primary_window),
    formatWindow("weekly", usage.rate_limit?.secondary_window),
    "",
    `Plan: ${usage.plan_type ?? "unknown"}`,
  ];

  if (typeof usage.rate_limit_reset_credits?.available_count === "number") {
    lines.push(`Reset credits: ${usage.rate_limit_reset_credits.available_count}`);
  }
  if (usage.credits) {
    lines.push(`Credits: ${usage.credits.unlimited ? "unlimited" : usage.credits.has_credits ? `balance ${usage.credits.balance ?? "unknown"}` : "none"}`);
  }
  if (usage.rate_limit?.limit_reached) {
    lines.push("Status: limit reached");
  }

  return lines.join("\n");
};

const fetchOpenAICodexUsage = async (signal?: AbortSignal): Promise<CodexUsageResponse> => {
  const auth = await readPiAuth();
  const credentials = auth["openai-codex"];
  if (!credentials?.access || !credentials.accountId) {
    throw new Error("openai-codex is not logged in; run /login openai-codex");
  }
  if (credentials.expires && credentials.expires <= Date.now()) {
    throw new Error("openai-codex OAuth token is expired; run /login openai-codex or make a normal pi request to refresh it");
  }

  const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${credentials.access}`,
      "ChatGPT-Account-Id": credentials.accountId,
      "User-Agent": "codex-cli",
    },
    signal,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`openai-codex usage request failed: HTTP ${response.status} ${text}`);
  }
  return JSON.parse(text) as CodexUsageResponse;
};

export default function (pi: ExtensionAPI) {
  pi.registerCommand("rate-limits", {
    description: "Show OpenAI Codex rate-limit status",
    handler: async (_args, ctx) => {
      let codexLine: string;
      try {
        codexLine = formatCodexUsage(await fetchOpenAICodexUsage(ctx.signal));
      } catch (error) {
        codexLine = `openai-codex: ${error instanceof Error ? error.message : String(error)}`;
      }
      ctx.ui.notify(codexLine, "info");
    },
  });
}
