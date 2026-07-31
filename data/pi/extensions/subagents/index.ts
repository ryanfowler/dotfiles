import { realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { StringEnum, type Model, type Usage } from "@earendil-works/pi-ai";
import {
  createAgentSession,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  getAgentDir,
  getMarkdownTheme,
  keyHint,
  ModelRuntime,
  ProjectTrustStore,
  SessionManager,
  SettingsManager,
  truncateHead,
  type AgentSessionEvent,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { resolveAvailableModel } from "./model-selection.js";
import { resolveSubagentProjectTrust } from "./trust.js";
import { ExpandedUpdateGate } from "./update-gate.js";

const ModelSchema = Type.String({
  description: "Override with any available model. Use provider/model-id when the model ID is not unique.",
});
const EffortSchema = StringEnum(["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const, {
  description: "Override the current agent's thinking level when the user requests a different level.",
});
const EXCLUDED_TOOLS = ["subagent", "subagent_spawn", "subagent_manage", "workflow", "ask_user", "ask_question"];
const COLLAPSED_ACTIVITY_COUNT = 8;
const MAX_TOOL_OUTPUT_CHARS = 1_200;

type Activity =
  | { type: "assistant"; text: string }
  | {
      type: "tool";
      id: string;
      name: string;
      args: Record<string, unknown>;
      status: "running" | "success" | "error";
      output?: string;
    };

interface SubagentDetails {
  status: "running" | "completed" | "error";
  model?: string;
  reasoningEffort?: string;
  readOnly: boolean;
  startedAt: number;
  completedAt?: number;
  stopReason?: string;
  activities: Activity[];
  usage?: Usage;
}

interface SubagentRenderState {
  durationTimer?: ReturnType<typeof setInterval>;
  expandedDuration?: string;
}

function resultText(result: any): string {
  if (!Array.isArray(result?.content)) return "";
  return result.content
    .filter((part: any) => part?.type === "text")
    .map((part: any) => part.text)
    .join("\n");
}

function previewToolOutput(result: any): string | undefined {
  const text = resultText(result).trim();
  if (!text) return undefined;
  if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
  const half = Math.floor((MAX_TOOL_OUTPUT_CHARS - 40) / 2);
  return `${text.slice(0, half)}\n… output omitted …\n${text.slice(-half)}`;
}

function snapshotDetails(details: SubagentDetails): SubagentDetails {
  return {
    ...details,
    activities: details.activities.map((activity) =>
      activity.type === "tool" ? { ...activity, args: { ...activity.args } } : { ...activity },
    ),
  };
}

function formatTokens(count: number): string {
  if (count < 1_000) return String(count);
  if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

function formatUsage(usage: Usage | undefined): string {
  if (!usage) return "";
  const parts: string[] = [];
  if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
  if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
  if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
  if (usage.cost.total) parts.push(`$${usage.cost.total.toFixed(4)}`);
  return parts.join(" ");
}

function formatDuration(startedAt: number, completedAt = Date.now()): string {
  const seconds = Math.max(0, Math.round((completedAt - startedAt) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function compactText(text: string, maxLines: number, maxChars: number): string {
  const lines = text.trim().split("\n");
  let result = lines.slice(0, maxLines).join("\n");
  if (result.length > maxChars) result = `${result.slice(0, Math.max(0, maxChars - 1))}…`;
  if (lines.length > maxLines) result += `\n… ${lines.length - maxLines} more lines`;
  return result;
}

function stringifyArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args);
  } catch {
    return "{…}";
  }
}

function displayToolArgs(name: string, input: unknown): Record<string, unknown> {
  const args = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const pathArgs = { path: args.path, file_path: args.file_path };
  switch (name) {
    case "bash":
      return { command: String(args.command ?? "").slice(0, 2_000) };
    case "read":
      return { ...pathArgs, offset: args.offset, limit: args.limit };
    case "write":
      return {
        ...pathArgs,
        lines: typeof args.content === "string" ? args.content.split("\n").length : undefined,
      };
    case "edit":
      return {
        ...pathArgs,
        editCount: Array.isArray(args.edits) ? args.edits.length : undefined,
      };
    case "grep":
      return { pattern: args.pattern, path: args.path, glob: args.glob, limit: args.limit };
    case "find":
      return { pattern: args.pattern, path: args.path, limit: args.limit };
    case "ls":
      return { path: args.path, limit: args.limit };
    case "web_search":
      return { query: String(args.query ?? "").slice(0, 1_000), limit: args.limit };
    case "web_fetch":
      return { url: String(args.url ?? "").slice(0, 2_000) };
    default:
      return { preview: stringifyArgs(args).slice(0, 2_000) };
  }
}

function formatToolCall(
  activity: Extract<Activity, { type: "tool" }>,
  theme: any,
  expanded: boolean,
): string {
  const { args, name } = activity;
  const path = String(args.path ?? args.file_path ?? ".");
  const limit = expanded ? 500 : 120;
  const shorten = (text: string) => (text.length > limit ? `${text.slice(0, limit - 1)}…` : text);

  switch (name) {
    case "bash":
      return theme.fg("muted", "$ ") + theme.fg("toolOutput", shorten(String(args.command ?? "…")));
    case "read": {
      let suffix = "";
      if (args.offset !== undefined) suffix += `:${args.offset}`;
      if (args.limit !== undefined) suffix += `+${args.limit}`;
      return theme.fg("muted", "read ") + theme.fg("accent", `${path}${suffix}`);
    }
    case "write": {
      const lines = typeof args.lines === "number" ? ` (${args.lines} lines)` : "";
      return theme.fg("muted", "write ") + theme.fg("accent", path) + theme.fg("dim", lines);
    }
    case "edit": {
      const count = typeof args.editCount === "number" ? ` (${args.editCount} changes)` : "";
      return theme.fg("muted", "edit ") + theme.fg("accent", path) + theme.fg("dim", count);
    }
    case "grep":
      return (
        theme.fg("muted", "grep ") +
        theme.fg("accent", `/${shorten(String(args.pattern ?? ""))}/`) +
        theme.fg("dim", ` in ${path}`)
      );
    case "find":
      return (
        theme.fg("muted", "find ") +
        theme.fg("accent", shorten(String(args.pattern ?? "*"))) +
        theme.fg("dim", ` in ${path}`)
      );
    case "ls":
      return theme.fg("muted", "ls ") + theme.fg("accent", path);
    case "web_search":
      return theme.fg("muted", "search ") + theme.fg("accent", shorten(String(args.query ?? "…")));
    case "web_fetch":
      return theme.fg("muted", "fetch ") + theme.fg("accent", shorten(String(args.url ?? "…")));
    default:
      return theme.fg("accent", name) + theme.fg("dim", ` ${shorten(String(args.preview ?? "{…}"))}`);
  }
}

async function workingDirectory(input: string | undefined, ctx: ExtensionContext): Promise<string> {
  const path = input?.startsWith("@") ? input.slice(1) : input;
  const cwd = resolve(ctx.cwd, path || ".");
  const info = await stat(cwd).catch(() => undefined);
  if (!info?.isDirectory()) throw new Error(`Working directory does not exist: ${cwd}`);
  return realpath(cwd);
}

async function createChildModelRuntime(ctx: ExtensionContext, model: Model<any> | undefined): Promise<ModelRuntime> {
  const runtime = await ModelRuntime.create();
  if (!model) return runtime;

  const provider = ctx.modelRegistry.getProvider(model.provider);
  if (provider) runtime.registerNativeProvider(provider);

  if (!ctx.modelRegistry.isUsingOAuth(model)) {
    const auth = await ctx.modelRegistry.getProviderAuth(model.provider);
    if (auth?.auth.apiKey) await runtime.setRuntimeApiKey(model.provider, auth.auth.apiKey);
  }
  return runtime;
}

function messageText(message: any): string {
  if (typeof message?.content === "string") return message.content;
  if (!Array.isArray(message?.content)) return "";
  return message.content
    .filter((part: any) => part?.type === "text")
    .map((part: any) => part.text)
    .join("");
}

function finalAssistant(session: any): any {
  return [...session.messages].reverse().find((message: any) => message.role === "assistant");
}

function truncateOutput(text: string): string {
  const result = truncateHead(text, { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES });
  if (!result.truncated) return result.content;
  const notice = result.firstLineExceedsLimit
    ? `[Output truncated: first line exceeds the ${formatSize(DEFAULT_MAX_BYTES)} limit.]`
    : result.truncatedBy === "lines"
      ? `[Output truncated: showing ${result.outputLines} of ${result.totalLines} lines.]`
      : `[Output truncated: ${result.outputLines} lines shown (${formatSize(DEFAULT_MAX_BYTES)} limit).]`;
  return result.content ? `${result.content}\n\n${notice}` : notice;
}

function aggregateUsage(session: any): Usage | undefined {
  const usages: Usage[] = [];
  for (const entry of session.sessionManager.getEntries()) {
    if (entry.type === "message" && entry.message?.usage) usages.push(entry.message.usage);
    else if ((entry.type === "compaction" || entry.type === "branch_summary") && entry.usage) usages.push(entry.usage);
  }
  if (!usages.length) return undefined;
  const hasReasoning = usages.some((usage) => usage.reasoning !== undefined);
  const hasCacheWrite1h = usages.some((usage) => usage.cacheWrite1h !== undefined);
  return {
    input: usages.reduce((total, usage) => total + usage.input, 0),
    output: usages.reduce((total, usage) => total + usage.output, 0),
    cacheRead: usages.reduce((total, usage) => total + usage.cacheRead, 0),
    cacheWrite: usages.reduce((total, usage) => total + usage.cacheWrite, 0),
    totalTokens: usages.reduce((total, usage) => total + usage.totalTokens, 0),
    reasoning: hasReasoning ? usages.reduce((total, usage) => total + (usage.reasoning ?? 0), 0) : undefined,
    cacheWrite1h: hasCacheWrite1h ? usages.reduce((total, usage) => total + (usage.cacheWrite1h ?? 0), 0) : undefined,
    cost: {
      input: usages.reduce((total, usage) => total + usage.cost.input, 0),
      output: usages.reduce((total, usage) => total + usage.cost.output, 0),
      cacheRead: usages.reduce((total, usage) => total + usage.cost.cacheRead, 0),
      cacheWrite: usages.reduce((total, usage) => total + usage.cost.cacheWrite, 0),
      total: usages.reduce((total, usage) => total + usage.cost.total, 0),
    },
  };
}

export default function (pi: ExtensionAPI) {
  const updateGate = new ExpandedUpdateGate();

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: "Run one isolated pi agent and wait for its result. Multiple sibling calls can run in parallel. The subagent uses the current agent's model and thinking level by default. Set `model` to any available model or set `reasoning_effort` only when the user explicitly requests an override. All subagents can search and fetch the web. Inspection mode (`read_only`) removes edit/write tools, but bash is not sandboxed, so prompts must restrict it to inspection commands.",
    promptSnippet: "Run an isolated pi agent synchronously",
    promptGuidelines: [
      "Only use the subagent tool when the user explicitly asks you to use subagents.",
      "Omit the subagent model and reasoning_effort unless the user explicitly requests an override.",
    ],
    parameters: Type.Object({
      prompt: Type.String({ description: "Complete task for the child agent" }),
      working_dir: Type.Optional(Type.String({ description: "Working directory, relative to the parent by default" })),
      model: Type.Optional(ModelSchema),
      reasoning_effort: Type.Optional(EffortSchema),
      read_only: Type.Optional(Type.Boolean({ description: "Enable inspection mode: remove edit/write tools. Web search/fetch and bash remain available; bash is not sandboxed." })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) throw new Error("Subagent aborted");
      const cwd = await workingDirectory(params.working_dir, ctx);
      const settingsManager = SettingsManager.create(cwd, getAgentDir());
      const parentCwd = await realpath(resolve(ctx.cwd));
      const trustStore = new ProjectTrustStore(getAgentDir());
      const trusted = resolveSubagentProjectTrust({
        parentCwd,
        cwd,
        parentTrusted: ctx.isProjectTrusted(),
        getTrustEntry: (directory) => trustStore.getEntry(directory),
      });
      settingsManager.setProjectTrusted(trusted);

      const model = params.model
        ? resolveAvailableModel(ctx.modelRegistry.getAvailable(), params.model)
        : ctx.model;
      const reasoningEffort = params.reasoning_effort ?? ctx.thinkingLevel ?? pi.getThinkingLevel();
      const modelRuntime = await createChildModelRuntime(ctx, model);
      const { session } = await createAgentSession({
        cwd,
        model,
        modelRuntime,
        thinkingLevel: reasoningEffort,
        tools: params.read_only
          ? ["read", "bash", "web_search", "web_fetch"]
          : ["read", "bash", "edit", "write", "web_search", "web_fetch"],
        excludeTools: EXCLUDED_TOOLS,
        sessionManager: SessionManager.inMemory(cwd),
        settingsManager,
      });

      const details: SubagentDetails = {
        status: "running",
        model: session.model ? `${session.model.provider}/${session.model.id}` : undefined,
        reasoningEffort,
        readOnly: params.read_only ?? false,
        startedAt: Date.now(),
        activities: [],
      };
      const toolActivities = new Map<string, Extract<Activity, { type: "tool" }>>();
      let currentAssistant: Extract<Activity, { type: "assistant" }> | undefined;
      let streamedText = "";
      let unsubscribe = () => {};
      let updateTimer: ReturnType<typeof setTimeout> | undefined;
      let pendingUpdate: string | undefined;
      const abort = () => { void session.abort(); };
      const flushUpdate = () => {
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = undefined;
        if (pendingUpdate === undefined) return;
        const text = pendingUpdate;
        pendingUpdate = undefined;
        // Updating content below the terminal viewport forces the terminal back
        // to the bottom. Pause partial updates while the user reads the expanded
        // output. The final result still renders when execution completes.
        if (updateGate.isPaused(toolCallId)) return;
        onUpdate?.({
          content: [{ type: "text", text }],
          details: snapshotDetails(details),
        });
      };
      const emitUpdate = (text: string, immediate = false) => {
        if (!onUpdate || updateGate.isPaused(toolCallId)) return;
        pendingUpdate = text;
        if (immediate) {
          flushUpdate();
        } else if (!updateTimer) {
          updateTimer = setTimeout(flushUpdate, 80);
        }
      };

      try {
        unsubscribe = session.subscribe((event: AgentSessionEvent) => {
          if (event.type === "message_start" && event.message.role === "assistant") {
            currentAssistant = { type: "assistant", text: "" };
            details.activities.push(currentAssistant);
          } else if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
            if (!currentAssistant) {
              currentAssistant = { type: "assistant", text: "" };
              details.activities.push(currentAssistant);
            }
            currentAssistant.text += event.assistantMessageEvent.delta;
            streamedText += event.assistantMessageEvent.delta;
            emitUpdate(currentAssistant.text || "Subagent is thinking…");
          } else if (event.type === "message_end" && event.message.role === "assistant") {
            const text = messageText(event.message);
            details.usage = aggregateUsage(session);
            if (text) {
              if (!currentAssistant) {
                currentAssistant = { type: "assistant", text };
                details.activities.push(currentAssistant);
              } else {
                currentAssistant.text = text;
              }
            }
            if (currentAssistant && !currentAssistant.text) details.activities.pop();
            currentAssistant = undefined;
            if (text) emitUpdate(text, true);
          } else if (event.type === "tool_execution_start") {
            const activity: Extract<Activity, { type: "tool" }> = {
              type: "tool",
              id: event.toolCallId,
              name: event.toolName,
              args: displayToolArgs(event.toolName, event.args),
              status: "running",
            };
            toolActivities.set(event.toolCallId, activity);
            details.activities.push(activity);
            emitUpdate(`Running ${event.toolName}…`, true);
          } else if (event.type === "tool_execution_update") {
            const activity = toolActivities.get(event.toolCallId);
            if (activity) {
              activity.output = previewToolOutput(event.partialResult);
              emitUpdate(`Running ${event.toolName}…`);
            }
          } else if (event.type === "tool_execution_end") {
            const activity = toolActivities.get(event.toolCallId);
            if (activity) {
              activity.status = event.isError ? "error" : "success";
              activity.output = previewToolOutput(event.result);
              emitUpdate(`${event.toolName} ${event.isError ? "failed" : "completed"}`, true);
            }
          }
        });
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) {
          await session.abort();
          throw new Error("Subagent aborted");
        }

        emitUpdate("Starting subagent…", true);
        await session.prompt(params.prompt);
        const assistant = finalAssistant(session);
        const failed =
          assistant?.stopReason === "error" ||
          assistant?.stopReason === "aborted" ||
          assistant?.stopReason === "length";
        if (failed) {
          const errorMessage = assistant.errorMessage || (assistant.stopReason === "length"
            ? "Subagent reached its output limit before completing the task"
            : `Subagent ${assistant.stopReason}`);
          const usage = aggregateUsage(session);
          details.status = "error";
          details.stopReason = assistant.stopReason;
          details.completedAt = Date.now();
          details.usage = usage;
          emitUpdate(errorMessage, true);
          return {
            content: [{ type: "text", text: errorMessage }],
            details: snapshotDetails(details),
            usage,
          };
        }

        const usage = aggregateUsage(session);
        const output = messageText(assistant) || streamedText || "(no output)";
        details.status = "completed";
        details.stopReason = assistant?.stopReason;
        details.completedAt = Date.now();
        details.usage = usage;
        return {
          content: [{ type: "text", text: truncateOutput(output) }],
          details: snapshotDetails(details),
          usage,
        };
      } finally {
        if (updateTimer) clearTimeout(updateTimer);
        updateGate.delete(toolCallId);
        signal?.removeEventListener("abort", abort);
        unsubscribe();
        session.dispose();
      }
    },

    renderCall(args, theme, context) {
      const mode = args.read_only ? "inspection" : "write-enabled";
      const model = args.model ? ` · ${args.model}` : "";
      const effort = args.reasoning_effort ? ` · ${args.reasoning_effort}` : "";
      let text =
        theme.fg("toolTitle", theme.bold("subagent ")) +
        theme.fg(args.read_only ? "success" : "warning", mode) +
        theme.fg("muted", `${model}${effort}`);
      if (args.working_dir) text += `\n${theme.fg("muted", "in ")}${theme.fg("accent", args.working_dir)}`;
      const rawPrompt = typeof args.prompt === "string" ? args.prompt : "…";
      const prompt = context.expanded ? rawPrompt : compactText(rawPrompt, 2, 180);
      text += `\n${theme.fg("dim", prompt)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded, isPartial }, theme, context) {
      const state = context.state as SubagentRenderState;
      updateGate.sync(context.toolCallId, {
        expanded,
        isPartial,
        isError: context.isError,
      });
      // A changing line above the terminal viewport makes the TUI redraw the full
      // screen. Keep the expanded header stable so users can scroll through a
      // running subagent without each duration tick returning them to the bottom.
      if (isPartial && !context.isError && !expanded && !state.durationTimer) {
        state.durationTimer = setInterval(context.invalidate, 1_000);
      }
      if ((!isPartial || context.isError || expanded) && state.durationTimer) {
        clearInterval(state.durationTimer);
        state.durationTimer = undefined;
      }
      if (!expanded) state.expandedDuration = undefined;

      const details = result.details as SubagentDetails | undefined;
      if (!details || !Array.isArray(details.activities)) {
        const content = result.content[0];
        return new Text(content?.type === "text" ? content.text : "(no output)", 0, 0);
      }

      const running = isPartial || details.status === "running";
      const failed = details.status === "error";
      const icon = running
        ? theme.fg("warning", "●")
        : failed
          ? theme.fg("error", "✗")
          : theme.fg("success", "✓");
      const toolCount = details.activities.filter((activity) => activity.type === "tool").length;
      const duration = running && expanded
        ? state.expandedDuration ??= formatDuration(details.startedAt, details.completedAt)
        : formatDuration(details.startedAt, details.completedAt);
      const metadata = [
        details.model,
        details.reasoningEffort,
        details.readOnly ? "inspection" : undefined,
        `${toolCount} tool${toolCount === 1 ? "" : "s"}`,
        duration,
      ].filter(Boolean);
      const container = context.lastComponent instanceof Container
        ? context.lastComponent
        : new Container();
      container.clear();
      container.addChild(
        new Text(
          `${icon} ${theme.fg("toolTitle", theme.bold(running ? "Subagent running" : failed ? "Subagent failed" : "Subagent complete"))}` +
            theme.fg("muted", ` · ${metadata.join(" · ")}`),
          0,
          0,
        ),
      );

      const activities = expanded ? details.activities : details.activities.slice(-COLLAPSED_ACTIVITY_COUNT);
      const skipped = details.activities.length - activities.length;
      if (activities.length === 0) {
        container.addChild(new Text(theme.fg("muted", "Waiting for the first response…"), 0, 0));
      } else {
        container.addChild(new Spacer(1));
        if (skipped > 0) {
          container.addChild(new Text(theme.fg("muted", `… ${skipped} earlier activities`), 0, 0));
        }
        for (const activity of activities) {
          if (activity.type === "assistant") {
            if (!activity.text.trim()) continue;
            const text = expanded ? activity.text.trim() : compactText(activity.text, 3, 500);
            if (expanded) container.addChild(new Markdown(text, 0, 0, getMarkdownTheme()));
            else container.addChild(new Text(theme.fg("toolOutput", text), 0, 0));
            continue;
          }

          const statusIcon =
            activity.status === "running"
              ? theme.fg("warning", "●")
              : activity.status === "error"
                ? theme.fg("error", "✗")
                : theme.fg("success", "✓");
          container.addChild(
            new Text(`${statusIcon} ${formatToolCall(activity, theme, expanded)}`, 0, 0),
          );
          if (expanded && activity.output) {
            container.addChild(new Text(theme.fg("dim", compactText(activity.output, 12, MAX_TOOL_OUTPUT_CHARS)), 1, 0));
          } else if (activity.status === "error" && activity.output) {
            container.addChild(new Text(theme.fg("error", compactText(activity.output, 2, 240)), 1, 0));
          }
        }
      }

      const usage = formatUsage(details.usage);
      const hint = !expanded && details.activities.length > 0 ? keyHint("app.tools.expand", "to expand") : "";
      const footer = [usage, hint].filter(Boolean).join(" · ");
      if (footer) {
        container.addChild(new Spacer(1));
        container.addChild(new Text(theme.fg("dim", footer), 0, 0));
      }
      return container;
    },
  });
}
