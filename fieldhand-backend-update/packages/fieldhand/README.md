# Fieldhand

Draft contractor correspondence — claim responses, RFIs, RFPs, change orders,
notices, punch-list follow-ups — that reads like you wrote it, not like a
chatbot did.

## What's in this package

A single self-contained file: `fieldhand.html`. No install, no build step,
no dependencies. Open it in any modern browser.

## What works fully offline

- The job-ticket form (letter type, tone, length, parties, project, facts,
  the ask)
- The Upload tab — any file type; text files are read in, images are staged,
  everything else attaches for your own record
- The scrub pass that strips stock AI phrasing, em dashes, curly quotes, and
  hidden Unicode characters from a draft
- Copy / download of a finished letter as `.txt`
- The Recent list (kept in your browser's local storage on this machine)

## What needs an internet connection

The **Generate** button drafts the letter (and, when you upload a file,
fills in the ticket from it first). It calls a small drafting service
(`multinicheai.com/api/fieldhand-draft`) rather than running the model in
your browser, so it needs internet — but nothing else. No Claude account, no
sign-in, no dependency on this page being open inside claude.ai. It works the
same whether you're on the hosted copy or this file downloaded to your
phone or laptop.

Everything else in the list above runs entirely in the file itself, with no
connection at all.

## License

One-time license, for your own use. Not for resale or redistribution as a
standalone product.
