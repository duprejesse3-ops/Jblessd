// Client-side extraction of PDF/DOCX/XLSX into plain text, for the "drop a
// file" inputs on proof-home.html and the product modal/app panel in
// Index.html. Shared as one file rather than tripled across those three
// places — this is real extraction logic (three different libraries, three
// different APIs), not simple UI wiring, and one authoritative copy is worth
// having even on a static site with no build step.
//
// Each library loads from jsdelivr (the standard CDN for npm packages) only
// the first time a matching file type is actually dropped — not on page
// load — so visitors who never use this feature never pay for it. Versions
// are pinned to what was verified working against real PDF/DOCX/XLSX files
// during development (see the extraction tests run before this shipped):
// pdfjs-dist 6.3.289, mammoth 1.12.2, xlsx 0.18.5. If a future bump changes
// any library's API shape, this is the one file that needs updating.
//
// HONESTY FLAG: the exact jsdelivr URLs below were built from those
// packages' real published file paths (verified locally), not guessed —
// but I can't load a URL in a browser from here to confirm jsdelivr itself
// resolves them at deploy time. If a file-drop of one of these types fails
// immediately with a network-style error, that's the first thing to check.
(function (global) {
  var PDFJS_VERSION = '6.3.289';
  var MAMMOTH_VERSION = '1.12.2';
  var XLSX_VERSION = '0.18.5';

  var loaders = {}; // cache each library's load promise so a second drop doesn't refetch

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function loadPdfJs() {
    if (!loaders.pdf) {
      loaders.pdf = import(
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + PDFJS_VERSION + '/build/pdf.min.mjs'
      ).then(function (mod) {
        mod.GlobalWorkerOptions.workerSrc =
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + PDFJS_VERSION + '/build/pdf.worker.min.mjs';
        return mod;
      });
    }
    return loaders.pdf;
  }

  function loadMammoth() {
    if (!loaders.mammoth) {
      loaders.mammoth = loadScript(
        'https://cdn.jsdelivr.net/npm/mammoth@' + MAMMOTH_VERSION + '/mammoth.browser.min.js',
      ).then(function () { return global.mammoth; });
    }
    return loaders.mammoth;
  }

  function loadXlsx() {
    if (!loaders.xlsx) {
      loaders.xlsx = loadScript(
        'https://cdn.jsdelivr.net/npm/xlsx@' + XLSX_VERSION + '/dist/xlsx.full.min.js',
      ).then(function () { return global.XLSX; });
    }
    return loaders.xlsx;
  }

  async function extractPdf(file) {
    var pdfjsLib = await loadPdfJs();
    var buf = await file.arrayBuffer();
    var doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + PDFJS_VERSION + '/standard_fonts/',
    }).promise;
    var text = '';
    for (var i = 1; i <= doc.numPages; i++) {
      var page = await doc.getPage(i);
      var content = await page.getTextContent();
      text += content.items.map(function (it) { return it.str; }).join(' ') + '\n\n';
    }
    return text.trim();
  }

  async function extractDocx(file) {
    var mammoth = await loadMammoth();
    var buf = await file.arrayBuffer();
    var result = await mammoth.extractRawText({ arrayBuffer: buf });
    return (result.value || '').trim();
  }

  async function extractXlsx(file) {
    var XLSX = await loadXlsx();
    var buf = await file.arrayBuffer();
    var wb = XLSX.read(buf, { type: 'array' });
    var out = '';
    wb.SheetNames.forEach(function (name) {
      out += '--- ' + name + ' ---\n' + XLSX.utils.sheet_to_csv(wb.Sheets[name]) + '\n\n';
    });
    return out.trim();
  }

  var EXTRACTABLE = { '.pdf': extractPdf, '.docx': extractDocx, '.xlsx': extractXlsx };

  function extensionOf(name) {
    var i = (name || '').toLowerCase().lastIndexOf('.');
    return i === -1 ? '' : name.toLowerCase().slice(i);
  }

  global.FILE_EXTRACT_SUPPORTED = Object.keys(EXTRACTABLE);

  // Returns { text, warning }. Throws only on a genuine failure to load the
  // library or read the file — a file that parses but has nothing useful in
  // it (a scanned PDF with no text layer) comes back as a warning, not a
  // thrown error, since that's a normal, expected outcome to explain rather
  // than a bug to report.
  global.extractFileText = async function (file) {
    var ext = extensionOf(file.name);
    var fn = EXTRACTABLE[ext];
    if (!fn) throw new Error('Unsupported file type for extraction: ' + ext);
    var text = await fn(file);
    if (!text) {
      return {
        text: '',
        warning:
          ext === '.pdf'
            ? 'This PDF has no extractable text — it looks scanned or image-only. Try a text-based export, or paste the content directly.'
            : 'Nothing readable came out of that file. Try pasting the content directly instead.',
      };
    }
    return { text: text, warning: null };
  };
})(window);
