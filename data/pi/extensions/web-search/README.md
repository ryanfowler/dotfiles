# pi web-search extension

Project-local source for a pi extension that registers two composable tools:

- `web_search` — DuckDuckGo HTML search results only
- `read_url` — fetch one public HTML page, extract with Readability, convert to Markdown

The dotfiles installer installs this extension's npm dependencies, then links this directory to `~/.pi/agent/extensions/web-search`.
The implementation lives in `index.ts`; dependencies are declared and locked in this directory.
