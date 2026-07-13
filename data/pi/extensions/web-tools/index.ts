import { Readability } from "@mozilla/readability";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type ReadUrlResult = {
  url: string;
  contentType: string;
  contentFormat: "markdown" | "text" | "base64";
  content: string;
  bytes: number;
  title?: string;
  excerpt?: string | null;
  byline?: string | null;
  length?: number;
};

type FetchedResource = {
  url: string;
  contentType: string;
  mediaType: string;
  charset?: string;
  bytes: Uint8Array;
};

type ReadUrlOptions = {
  maxBytes?: number;
  timeoutMs?: number;
};

const DDG_SEARCH_URL = "https://html.duckduckgo.com/html/";
const USER_AGENT = "pi-web-tools/0.1 (+https://github.com/ryanfowler/dotfiles)";
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

const NON_PUBLIC_ADDRESSES = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, "ipv4");
  NON_PUBLIC_ADDRESSES.addSubnet(`::ffff:${network}`, 96 + prefix, "ipv6");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, "ipv6");
}

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

function timeoutSignal(
  message: string,
  signal?: AbortSignal,
  timeoutMs = TIMEOUT_MS,
): { signal: AbortSignal; cleanup: () => void } {
  throwIfAborted(signal);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(message)), timeoutMs);
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

function isNonPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family !== 0 && NON_PUBLIC_ADDRESSES.check(address, family === 4 ? "ipv4" : "ipv6");
}

async function validatePublicHttpUrl(rawUrl: string): Promise<URL> {
  const url = validateHttpUrl(rawUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(hostname);
  const addresses = family ? [hostname] : (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);

  if (addresses.length === 0 || addresses.some(isNonPublicAddress)) {
    throw new Error(`URL resolves to a non-public address: ${url.hostname}`);
  }
  return url;
}

async function readResponseText(response: Response, signal?: AbortSignal): Promise<string> {
  return new TextDecoder().decode(await readResponseBytes(response, signal));
}

function parseContentType(header: string | null): { contentType: string; mediaType: string; charset?: string } {
  const contentType = header?.trim() || "application/octet-stream";
  const [type = "", ...parameters] = contentType.split(";");
  const mediaType = type.trim().toLowerCase() || "application/octet-stream";
  const charsetParameter = parameters.find((parameter) => /^\s*charset\s*=/i.test(parameter));
  const charset = charsetParameter?.replace(/^\s*charset\s*=\s*/i, "").trim().replace(/^(["'])(.*)\1$/, "$2");
  return { contentType, mediaType, ...(charset ? { charset } : {}) };
}

function decodeText(bytes: Uint8Array, charset?: string): string {
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function isHtml(mediaType: string): boolean {
  return mediaType === "text/html" || mediaType === "application/xhtml+xml";
}

function isMarkdown(mediaType: string): boolean {
  return ["text/markdown", "text/x-markdown", "application/markdown", "application/x-markdown"].includes(mediaType);
}

function isText(mediaType: string): boolean {
  if (mediaType.startsWith("text/")) return true;
  if (mediaType.endsWith("+json") || mediaType.endsWith("+xml")) return true;
  return [
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-javascript",
    "application/yaml",
    "application/x-yaml",
    "application/toml",
    "application/graphql",
    "application/sql",
    "application/x-www-form-urlencoded",
    "image/svg+xml",
  ].includes(mediaType);
}

async function readResponseBytes(response: Response, signal?: AbortSignal, maxBytes = MAX_BYTES): Promise<Uint8Array> {
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
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`response exceeds ${maxBytes} bytes`);
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

async function fetchResource(rawUrl: string, signal?: AbortSignal, options: ReadUrlOptions = {}): Promise<FetchedResource> {
  throwIfAborted(signal);
  let currentUrl = validateHttpUrl(rawUrl).toString();
  const timeout = timeoutSignal("fetch timeout", signal, options.timeoutMs);

  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      throwIfAborted(timeout.signal);
      currentUrl = (await validatePublicHttpUrl(currentUrl)).toString();
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal: timeout.signal,
        headers: {
          Accept: "text/html,text/markdown;q=0.9,text/*;q=0.8,*/*;q=0.7",
          "User-Agent": USER_AGENT,
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        const location = response.headers.get("location");
        if (!location) throw new Error(`redirect without Location from ${currentUrl}`);
        currentUrl = validateHttpUrl(new URL(location, currentUrl).toString()).toString();
        throwIfAborted(timeout.signal);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`HTTP ${response.status} fetching ${currentUrl}`);
      }

      const contentType = parseContentType(response.headers.get("content-type"));
      return {
        url: currentUrl,
        ...contentType,
        bytes: await readResponseBytes(response, timeout.signal, options.maxBytes),
      };
    }
    throw new Error(`too many redirects fetching ${rawUrl}`);
  } finally {
    timeout.cleanup();
  }
}

export async function readUrl(url: string, signal?: AbortSignal, options: ReadUrlOptions = {}): Promise<ReadUrlResult> {
  throwIfAborted(signal);
  const fetched = await fetchResource(url, signal, options);
  throwIfAborted(signal);

  const metadata = {
    url: fetched.url,
    contentType: fetched.contentType,
    bytes: fetched.bytes.byteLength,
  };

  if (isHtml(fetched.mediaType)) {
    const html = decodeText(fetched.bytes, fetched.charset);
    const dom = new JSDOM(html, { url: fetched.url });
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
    const content = turndown.turndown(articleDom.window.document.body.innerHTML).trim();
    articleDom.window.close();

    return {
      ...metadata,
      contentFormat: "markdown",
      content,
      title: article.title || new URL(fetched.url).hostname,
      excerpt: article.excerpt,
      byline: article.byline,
      length: article.length ?? article.textContent?.length ?? 0,
    };
  }

  if (isMarkdown(fetched.mediaType)) {
    return {
      ...metadata,
      contentFormat: "markdown",
      content: decodeText(fetched.bytes, fetched.charset),
    };
  }

  if (isText(fetched.mediaType)) {
    return {
      ...metadata,
      contentFormat: "text",
      content: decodeText(fetched.bytes, fetched.charset),
    };
  }

  return {
    ...metadata,
    contentFormat: "base64",
    content: Buffer.from(fetched.bytes).toString("base64"),
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
    description: "Fetch a public URL. HTML is extracted with Readability and returned as Markdown; Markdown and text are passed through; other content is returned as base64. The result includes the source Content-Type.",
    promptSnippet: "Fetch a public URL with content-type-aware handling; HTML becomes Markdown and other content is passed through.",
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
