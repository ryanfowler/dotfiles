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

### `read_url`

Downloads one HTML page, extracts the main article, and returns Markdown.

Input:

```json
{
  "url": "https://example.com/article"
}
```

Output:

```json
{
  "title": "...",
  "url": "...",
  "excerpt": "...",
  "byline": "...",
  "markdown": "...",
  "length": 12345
}
```

## Non-goals

- No browser automation.
- No JavaScript rendering.
- No combined `search_and_read` tool; agents can compose `web_search` and `read_url` explicitly.
- No cache or provider abstraction until the basic extension proves useful.

## Pipeline

```text
web_search:
DuckDuckGo HTML -> parse results -> title/url/snippet

read_url:
URL -> fetch HTML -> Readability -> Turndown -> Markdown
```

## Safety and Reliability

Keep the implementation bounded:

- timeout network requests
- cap response size
- follow a small number of redirects
- reject non-HTTP(S) schemes
- only accept HTML-ish content types for `read_url`
- honor cancellation signals

## Agent Usage Guidance

- Use `web_search` when discovering relevant public URLs.
- Use `read_url` when detailed source content is needed from a known URL.
- Prefer reading only the minimum number of pages needed to answer the question.
- Always preserve source URLs in returned data so downstream answers can cite them.
