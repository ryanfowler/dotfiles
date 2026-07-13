# pi web-tools extension

Project-local source for a pi extension that registers two composable tools:

- `web_search` — search results only
- `web_fetch` — fetch one public URL with content-type-aware handling

`web_fetch` returns a uniform `content` field plus response metadata:

- HTML is extracted with Readability and converted to Markdown.
- Markdown is passed through unchanged.
- Other textual formats (including JSON, XML, YAML, JavaScript, and SVG) are passed through as text.
- Binary formats are passed through as base64.

`contentType` preserves the server's Content-Type header (or defaults to `application/octet-stream`), while `contentFormat` describes the returned representation: `markdown`, `text`, or `base64`. `url` is the final URL after redirects and `bytes` is the downloaded size. HTML results also include article metadata such as `title`, `excerpt`, and `byline` when available.

Only public HTTP(S) destinations are allowed. Hostnames are resolved and checked before the initial request and every redirect; loopback, private, link-local, reserved, and multicast addresses are rejected.

Run the automated tests with `npm test --prefix data/pi/extensions/web-tools`.

The dotfiles installer installs this extension's npm dependencies, then links this directory to `~/.pi/agent/extensions/web-tools`.
The implementation lives in `index.ts`; dependencies are declared and locked in this directory.
