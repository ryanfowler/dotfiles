import { Readability } from "@mozilla/readability";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type ReadUrlResult = {
  title: string;
  url: string;
  excerpt?: string | null;
  byline?: string | null;
  markdown: string;
  length: number;
};

const DDG_SEARCH_URL = "https://html.duckduckgo.com/html/";
const USER_AGENT = "pi-web-tools/0.1 (+https://github.com/ryanfowler/dotfiles)";
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function jsonToolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    details: value as Record<string, unknown>,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function throwIfAborted(signal?: AbortSignal) {
  signal?.throwIfAborted();
}

function timeoutSignal(message: string, signal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  throwIfAborted(signal);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(message)), TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) onAbort();

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

function duckDuckGoResultUrl(href: string): string {
  const absolute = new URL(href, DDG_SEARCH_URL);
  const redirected = absolute.searchParams.get("uddg") ?? absolute.searchParams.get("rut") ?? absolute.toString();
  const parsed = new URL(redirected);
  parsed.hash = "";
  return parsed.toString();
}

function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    for (const result of document.querySelectorAll(".result, article")) {
      const link = result.querySelector<HTMLAnchorElement>(".result__a, a[data-testid='result-title-a'], h2 a, a");
      const title = text(link);
      const href = link?.getAttribute("href");
      if (!title || !href) continue;

      let url: string;
      try {
        url = duckDuckGoResultUrl(href);
      } catch {
        continue;
      }

      if (seen.has(url)) continue;
      seen.add(url);
      results.push({
        title,
        url,
        snippet: text(result.querySelector(".result__snippet, [data-result='snippet'], .snippet")),
      });
      if (results.length >= Math.min(Math.max(Math.trunc(maxResults), 1), 20)) break;
    }

    dom.window.close();
    return results;
  } catch (error) {
    throw new Error(`failed to parse DuckDuckGo results: ${errorMessage(error)}`);
  }
}

async function webSearch(query: string, maxResults = 5, signal?: AbortSignal): Promise<SearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) throw new Error("query is required");

  const timeout = timeoutSignal("search timeout", signal);
  try {
    const response = await fetch(DDG_SEARCH_URL, {
      method: "POST",
      body: new URLSearchParams({ q: normalizedQuery }),
      signal: timeout.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`DuckDuckGo search failed: HTTP ${response.status}`);
    }

    return parseDuckDuckGoResults(await readResponseText(response, signal), maxResults);
  } finally {
    timeout.cleanup();
  }
}

function validateHttpUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`unsupported URL scheme: ${url.protocol}`);
  return url;
}

async function readResponseText(response: Response, signal?: AbortSignal): Promise<string> {
  return new TextDecoder().decode(await readResponseBytes(response, signal));
}

async function readResponseBytes(response: Response, signal?: AbortSignal): Promise<Uint8Array> {
  throwIfAborted(signal);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("response body is not readable");

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    throwIfAborted(signal);
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`response exceeds ${MAX_BYTES} bytes`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchHtml(rawUrl: string, signal?: AbortSignal): Promise<{ url: string; html: string }> {
  throwIfAborted(signal);
  let currentUrl = validateHttpUrl(rawUrl).toString();
  const timeout = timeoutSignal("fetch timeout", signal);

  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      throwIfAborted(signal);
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal: timeout.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": USER_AGENT,
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        const location = response.headers.get("location");
        if (!location) throw new Error(`redirect without Location from ${currentUrl}`);
        currentUrl = validateHttpUrl(new URL(location, currentUrl).toString()).toString();
        throwIfAborted(signal);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`HTTP ${response.status} fetching ${currentUrl}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/\b(text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`non-HTML content type: ${contentType || "unknown"}`);
      }

      return { url: currentUrl, html: await readResponseText(response, signal) };
    }
    throw new Error(`too many redirects fetching ${rawUrl}`);
  } finally {
    timeout.cleanup();
  }
}

async function readUrl(url: string, signal?: AbortSignal): Promise<ReadUrlResult> {
  throwIfAborted(signal);
  const fetched = await fetchHtml(url, signal);
  throwIfAborted(signal);
  const dom = new JSDOM(fetched.html, { url: fetched.url });
  const article = new Readability(dom.window.document).parse();
  dom.window.close();
  if (!article?.content) throw new Error("Readability could not extract article content");

  throwIfAborted(signal);
  const articleDom = new JSDOM(`<article>${article.content}</article>`);
  for (const element of articleDom.window.document.querySelectorAll("script,style,iframe,noscript")) {
    element.remove();
  }
  const turndown = new TurndownService({ codeBlockStyle: "fenced", headingStyle: "atx", bulletListMarker: "-" });
  turndown.use(gfm);
  const markdown = turndown.turndown(articleDom.window.document.body.innerHTML).trim();
  articleDom.window.close();

  return {
    title: article.title || new URL(fetched.url).hostname,
    url: fetched.url,
    excerpt: article.excerpt,
    byline: article.byline,
    markdown,
    length: article.length ?? article.textContent?.length ?? 0,
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web and return results without fetching pages.",
    promptSnippet: "Search public web pages; returns titles, URLs, and snippets only.",
    promptGuidelines: ["Use web_search for web discovery when you need relevant public URLs before reading pages."],
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "Maximum results to return, 1-20", minimum: 1, maximum: 20 },
      },
      required: ["query"],
    } as any,
    async execute(_toolCallId, params, signal) {
      return jsonToolResult({ results: await webSearch(params.query, params.max_results ?? 5, signal) });
    },
  });

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description: "Fetch a public HTML page, extract the main article with Readability, and return Markdown.",
    promptSnippet: "Read a specific public URL and return cleaned Markdown article content.",
    promptGuidelines: ["Use web_fetch when the user provides a URL or when detailed source content is needed from a known URL."],
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Public http(s) URL to read" },
      },
      required: ["url"],
    } as any,
    async execute(_toolCallId, params, signal) {
      return jsonToolResult(await readUrl(params.url, signal));
    },
  });
}
