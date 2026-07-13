# Building a DuckDuckGo + Readability Web Search Extension for pi

## Goal

Build a small pi extension that provides lightweight web discovery and webpage extraction using:

- DuckDuckGo HTML for search
- Readability.js for article extraction
- Turndown for HTML-to-Markdown conversion

The extension should stay simple and composable: pi gets one tool for discovery and one tool for reading a known URL.

## Exposed Tools

### `web_search`

Searches DuckDuckGo and returns result metadata only.

Input:

```json
{
  "query": "rust async runtime",
  "max_results": 5
}
```

Output:

```json
{
  "results": [
    {
      "title": "...",
      "url": "...",
      "snippet": "..."
    }
  ]
}
```

### `web_fetch`

Downloads one URL and returns content according to its Content-Type. HTML is extracted and converted to Markdown, Markdown is passed through unchanged, other text is passed through, and binary content is base64-encoded.

Input:

```json
{
  "url": "https://example.com/article"
}
```

Output:

```json
{
  "url": "...",
  "contentType": "text/html; charset=utf-8",
  "contentFormat": "markdown",
  "content": "...",
  "bytes": 12345,
  "title": "...",
  "excerpt": "...",
  "byline": "...",
  "length": 12000
}
```

## Non-goals

- No browser automation.
- No JavaScript rendering.
- No combined `search_and_fetch` tool; agents can compose `web_search` and `web_fetch` explicitly.
- No cache or provider abstraction until the basic extension proves useful.

## Pipeline

```text
web_search:
DuckDuckGo HTML -> parse results -> title/url/snippet

web_fetch:
URL -> inspect Content-Type -> HTML: Readability/Turndown; Markdown/text: pass through; binary: base64
```

## Safety and Reliability

Keep the implementation bounded:

- timeout network requests
- cap response size
- follow a small number of redirects
- reject non-HTTP(S) schemes
- handle HTML, Markdown, text, and binary responses explicitly and report the source Content-Type
- honor cancellation signals

## Agent Usage Guidance

- Use `web_search` when discovering relevant public URLs.
- Use `web_fetch` when detailed source content is needed from a known URL.
- Prefer reading only the minimum number of pages needed to answer the question.
- Always preserve source URLs in returned data so downstream answers can cite them.
