import assert from "node:assert/strict";
import test from "node:test";
import { readUrl } from "./index.ts";

const PUBLIC_BASE = "https://8.8.8.8";
const originalFetch = globalThis.fetch;

function response(body, contentType, init = {}) {
  const headers = new Headers(init.headers);
  if (contentType) headers.set("Content-Type", contentType);
  return new Response(body, { ...init, headers });
}

async function withFetch(fetchImpl, callback) {
  globalThis.fetch = fetchImpl;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("converts mixed-case, parameterized HTML to Markdown and retains metadata", async () => {
  const html = `<!doctype html><html><head><title>Test article</title></head><body><main>
    <h1>Hello</h1><p>This article has enough meaningful text for Readability to extract the main content.</p>
  </main></body></html>`;

  await withFetch(async () => response(html, 'TeXt/HTML; Charset="utf-8"'), async () => {
    const result = await readUrl(`${PUBLIC_BASE}/article`);
    assert.equal(result.contentType, 'TeXt/HTML; Charset="utf-8"');
    assert.equal(result.contentFormat, "markdown");
    assert.match(result.content, /# Hello/);
    assert.equal(result.title, "Test article");
    assert.equal(result.bytes, Buffer.byteLength(html));
  });
});

test("passes Markdown through using a quoted, mixed-case charset parameter", async () => {
  const markdown = "# Héllo\n\nExact markdown.\n";
  const encoded = Buffer.from(markdown, "utf16le");

  await withFetch(async () => response(encoded, 'TeXt/MaRkDoWn; version=1; CHARSET="utf-16le"'), async () => {
    const result = await readUrl(`${PUBLIC_BASE}/readme.md`);
    assert.equal(result.contentFormat, "markdown");
    assert.equal(result.content, markdown);
  });
});

test("handles JSON/XML suffix MIME types as text", async () => {
  const bodies = [
    ["application/problem+json", '{"error":"nope"}'],
    ["application/atom+xml; charset=utf-8", "<feed><title>News</title></feed>"],
  ];
  let index = 0;

  await withFetch(async () => response(bodies[index][1], bodies[index++][0]), async () => {
    for (const [contentType, content] of bodies) {
      const result = await readUrl(`${PUBLIC_BASE}/${index}`);
      assert.equal(result.contentType, contentType);
      assert.equal(result.contentFormat, "text");
      assert.equal(result.content, content);
    }
  });
});

test("defaults missing charsets to UTF-8 and falls back from unsupported charsets", async () => {
  const content = "héllo";
  let call = 0;

  await withFetch(
    async () => response(Buffer.from(content), call++ === 0 ? "text/plain" : "text/plain; charset=not-a-charset"),
    async () => {
      assert.equal((await readUrl(`${PUBLIC_BASE}/missing`)).content, content);
      assert.equal((await readUrl(`${PUBLIC_BASE}/unsupported`)).content, content);
    },
  );
});

test("returns binary and missing Content-Type responses as base64", async () => {
  const bytes = Buffer.from([0, 1, 2, 255]);
  let call = 0;

  await withFetch(async () => response(bytes, call++ === 0 ? "application/pdf" : undefined), async () => {
    const binary = await readUrl(`${PUBLIC_BASE}/file.pdf`);
    assert.equal(binary.contentFormat, "base64");
    assert.equal(binary.content, "AAEC/w==");

    const missing = await readUrl(`${PUBLIC_BASE}/unknown`);
    assert.equal(missing.contentType, "application/octet-stream");
    assert.equal(missing.contentFormat, "base64");
  });
});

test("follows relative redirects and reports the final URL and Content-Type", async () => {
  const seen = [];
  await withFetch(async (url) => {
    seen.push(url);
    if (seen.length === 1) return response(null, undefined, { status: 302, headers: { Location: "/final" } });
    return response("done", "text/plain");
  }, async () => {
    const result = await readUrl(`${PUBLIC_BASE}/start`);
    assert.deepEqual(seen, [`${PUBLIC_BASE}/start`, `${PUBLIC_BASE}/final`]);
    assert.equal(result.url, `${PUBLIC_BASE}/final`);
    assert.equal(result.contentType, "text/plain");
    assert.equal(result.content, "done");
  });
});

test("rejects redirects to private addresses before the redirected fetch", async () => {
  let calls = 0;
  await withFetch(async () => {
    calls++;
    return response(null, undefined, { status: 302, headers: { Location: "http://127.0.0.1/secret" } });
  }, async () => {
    await assert.rejects(readUrl(`${PUBLIC_BASE}/start`), /non-public address/);
    assert.equal(calls, 1);
  });
});

test("rejects redirect chains beyond the configured limit", async () => {
  let calls = 0;
  await withFetch(async () => {
    calls++;
    return response(null, undefined, { status: 302, headers: { Location: `/redirect-${calls}` } });
  }, async () => {
    await assert.rejects(readUrl(`${PUBLIC_BASE}/start`), /too many redirects/);
    assert.equal(calls, 6);
  });
});

test("rejects responses exceeding MAX_BYTES", async () => {
  const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
  await withFetch(async () => response(oversized, "text/plain"), async () => {
    await assert.rejects(readUrl(`${PUBLIC_BASE}/large`), /response exceeds 5242880 bytes/);
  });
});

test("honors caller cancellation", async () => {
  await withFetch((_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }), async () => {
    const controller = new AbortController();
    const pending = readUrl(`${PUBLIC_BASE}/slow`, controller.signal);
    controller.abort(new Error("cancelled by test"));
    await assert.rejects(pending, /cancelled by test/);
  });
});

test("times out stalled fetches", async () => {
  await withFetch((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }), async () => {
    await assert.rejects(readUrl(`${PUBLIC_BASE}/slow`, undefined, { timeoutMs: 5 }), /fetch timeout/);
  });
});

test("rejects private literal and resolved addresses before fetching", async () => {
  let called = false;
  await withFetch(async () => {
    called = true;
    return response("secret", "text/plain");
  }, async () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://10.0.0.1/",
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://localhost/",
    ]) {
      await assert.rejects(readUrl(url), /non-public address/);
    }
    assert.equal(called, false);
  });
});
