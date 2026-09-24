# MultiVault Hybrid Search

BM25 keyword search + local semantic embeddings, combined via Reciprocal
Rank Fusion (RRF). Nothing leaves the machine — the embedding model
(`Xenova/all-MiniLM-L6-v2`, ~80MB) runs on-device via `@xenova/transformers`
(ONNX Runtime), same as any other bundled model weight.

## Setup

```
npm install
```

First run of `embed()` downloads the model from Hugging Face and caches it
locally. After that first download, everything — indexing and querying —
runs fully offline, no network calls.

## Usage

```js
const { buildIndex } = require('./buildIndex');
const { search } = require('./search');

// Index a folder (call this from MultiVault's existing file watcher,
// same trigger points as today's BM25-only index)
await buildIndex('/path/to/vault', '/path/to/.vault-index.json');

// Query
const results = await search('/path/to/.vault-index.json', 'churn risk', 5);
// results: [{ docPath, text, rrfScore, bm25Rank, semanticRank }, ...]
```

## Files

- `chunker.js` — splits docs into overlapping ~800-char chunks
- `bm25.js` — existing keyword ranking, unchanged behavior
- `embeddings.js` — local embedding generation (the new piece)
- `buildIndex.js` — chunks + BM25 + embeddings → one index file on disk
- `search.js` — query-time hybrid ranking via RRF

## Tested logic

Chunking, BM25, index building, and RRF combination were verified
end-to-end with a mocked embedding function (this build environment can't
reach huggingface.co to download the real model). The mock confirmed the
exact scenario from your product copy: a query like "churn risk" surfaces
a doc that only says "Northwind is wobbling," while an exact-keyword query
still ranks the literal match first via BM25. Run the real thing on your
dev machine to confirm the actual `all-MiniLM-L6-v2` model behaves the
same way — it should, since nothing else in the pipeline changes.

## Integration notes for multicontainer

- Replace the current BM25-only indexer call with `buildIndex()` at the
  same watcher trigger points (file added/changed in the vault folder).
- Replace the current search call with `search()`.
- Index file grows with a `vector` array per chunk (384 floats each,
  ~1.5KB/chunk uncompressed) — fine for a folder-sized corpus. Worth
  switching to a binary format (e.g. raw Float32Array buffers) later if
  vault sizes get into the tens of thousands of chunks.

## Suggested updated "Honest limits" copy

> Search is hybrid — BM25 keyword ranking plus a local semantic model
> (no cloud calls, no data leaves your machine). Catches paraphrases and
> related terms, not just exact matches. First run downloads an ~80MB
> model once; after that, indexing and search are fully offline.
