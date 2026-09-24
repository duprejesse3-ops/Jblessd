# Fieldhand

Draft contractor correspondence — claim responses, RFIs, RFPs, change orders,
notices, punch-list follow-ups — that reads like you wrote it, not like a
chatbot did.

## What's in this package

A single self-contained file: `fieldhand.html`. No install, no build step,
no dependencies. Open it in any modern browser.

## What works offline, right out of this zip

- The job-ticket form (letter type, tone, parties, project, facts, the ask)
- The Upload tab — any file type; text files are read in, images are staged,
  everything else attaches for your own record
- The scrub pass that strips stock AI phrasing, em dashes, curly quotes, and
  hidden Unicode characters from a draft
- Copy / download of a finished letter as `.txt`
- The Recent list (kept in your browser's local storage on this machine)

## What needs Claude

The **Draft Letter** button asks Claude to write the first pass from your
ticket. That call only works when this page is opened as a Claude artifact
(claude.ai), signed in — it is not bundled into this offline file, because
it runs on Claude's own infrastructure, not in your browser.

Two ways to use the AI drafting step:

1. Open the hosted copy at the link on your order confirmation page and work
   from there directly — the Upload tab, the scrub pass, and the Recent list
   all work there too.
2. Or draft the letter in any chat model you already use, paste the result
   into this offline copy, and run it through the scrub pass here before you
   send it — the scrub pass itself needs nothing but the browser.

## License

One-time license, for your own use. Not for resale or redistribution as a
standalone product.
