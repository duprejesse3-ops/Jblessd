// buildIndex.js
// Walks a folder of docs, chunks each one, builds a BM25 index, computes
// local embeddings per chunk, and writes one index file to disk. This
// replaces/extends MultiVault's existing indexer — same "watcher" concept
// (re-run on file change), just with an extra embedding step per chunk.

const fs = require('fs');
const path = require('path');
const { chunkText } = require('./chunker');
const { BM25Index } = require('./bm25');
const { embed } = require('./embeddings');

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.ics', '.log']);

function walkDocs(rootDir) {
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        stack.push(full);
      } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(full);
      }
    }
  }
  return files;
}

/**
 * Build a hybrid index for a folder.
 * @param {string} rootDir - folder to index (the local "vault" contents)
 * @param {string} outIndexPath - where to write the index JSON
 */
async function buildIndex(rootDir, outIndexPath) {
  const files = walkDocs(rootDir);
  const chunks = []; // {id, docPath, text, start, end}

  let chunkCounter = 0;
  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const fileChunks = chunkText(raw);
    for (const c of fileChunks) {
      chunks.push({
        id: `c${chunkCounter++}`,
        docPath: path.relative(rootDir, filePath),
        text: c.text,
      });
    }
  }

  if (chunks.length === 0) {
    const emptyIndex = { rootDir, builtAt: new Date().toISOString(), chunks: [], vectors: {} };
    fs.writeFileSync(outIndexPath, JSON.stringify(emptyIndex));
    return emptyIndex;
  }

  // BM25 index built from raw chunk text — stored separately since it's
  // cheap to rebuild, but we persist doc ids + text so search.js doesn't
  // need the original files at query time.
  const bm25 = new BM25Index();
  bm25.addDocuments(chunks.map(c => ({ id: c.id, text: c.text })));

  // Embeddings: batch through the local model.
  const vectors = await embed(chunks.map(c => c.text));

  const index = {
    rootDir,
    builtAt: new Date().toISOString(),
    chunks: chunks.map((c, i) => ({
      id: c.id,
      docPath: c.docPath,
      text: c.text,
      vector: Array.from(vectors[i]), // stored as plain array for JSON portability
    })),
    bm25Params: { k1: bm25.k1, b: bm25.b },
  };

  fs.mkdirSync(path.dirname(outIndexPath), { recursive: true });
  fs.writeFileSync(outIndexPath, JSON.stringify(index));
  return index;
}

module.exports = { buildIndex, walkDocs };
