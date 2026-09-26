# Content Repurposing Engine

Turns one transcript — a podcast episode, a webinar, a recorded talk — into
a blog post draft, a newsletter blurb, and a batch of short social clips,
in one run. Not a Make/Zapier blueprint you assemble yourself: a working
script that reads your transcript and writes three ready-to-edit files.

## How this differs from pasting into a chat window yourself

Pasting a transcript into ChatGPT or Claude and asking for "a blog post"
works, but you're doing it three separate times, for three different
formats, and re-explaining what you want each time. This script has all
three prompts already tuned — grounded in what the transcript actually
says, structured for the format it's going into — and runs all three in
one command, writing each result to its own file.

## What it does, precisely

1. Reads `transcript.txt` — a plain-text transcript you've already
   exported from your podcast host, video platform, or transcription tool.
   This script does not transcribe audio or video itself.
2. Sends it to Claude three times, once per format:
   - **Blog post** (`output/blog-post.md`) — Markdown, organized under
     subheadings pulled from what was actually discussed, quoting the
     transcript directly for its most quotable moments, grounded in what
     was actually said rather than invented claims or statistics.
   - **Newsletter blurb** (`output/newsletter.md`) — a 120-180 word body
     paragraph leading with the single most useful or surprising idea,
     ending with a one-line call to action.
   - **Social clips** (`output/social-clips.md`) — a configurable number
     (default 5) of short, standalone quotes or tightly paraphrased
     moments, the kind of line someone would screenshot or quote-tweet.
3. Writes all three as separate files in `output/`, so each can be copied
   straight into a CMS, an email tool, or a social scheduler without
   editing the others out of one combined document.

It does not post anything anywhere on its own — no CMS, no email send, no
social API call. The output is drafts for a human to review, edit, and
publish; treat the blog post and newsletter especially as a first pass, not
finished, publish-ready copy.

## Install (5 minutes)

1. Copy `bin/` and `lib/` into your repo — anywhere, e.g.
   `tools/content-repurposing-engine/`.
2. Copy `.github-workflow-template/content-repurposing.yml` to
   `.github/workflows/content-repurposing.yml` (this exact path — GitHub
   only runs workflows from there).
3. If you put `bin/`/`lib/` somewhere other than
   `tools/content-repurposing-engine/`, edit the `working-directory:` line
   in the workflow to match.
4. Add the repo secret (**Settings → Secrets and variables → Actions**):
   - `ANTHROPIC_API_KEY` — from console.anthropic.com/settings/keys
5. Commit your transcript as `transcript.txt` in that same folder (or pass
   `REPURPOSE_TRANSCRIPT` to point elsewhere), then trigger the workflow
   from the **Actions** tab (optionally filling in the episode title input)
   and download the `repurposed-content` artifact it uploads.

## Testing without waiting for Actions

```sh
npm install --omit=dev
cp .env.example .env    # fill in ANTHROPIC_API_KEY
cp transcript.example.txt transcript.txt   # or your own real transcript
node bin/repurpose.mjs
```

```sh
npm test
```
Runs without any real API key or network call — checks prompt construction
(including transcript truncation for very long input), the numbered-clip
parser, and the output-file writer, not a live Claude call.

## Limits, honestly

- No transcription: bring your own plain-text transcript. Most podcast
  hosts, YouTube, and tools like Otter.ai or Whisper already produce one.
- A transcript longer than ~40,000 characters is truncated before it's
  sent — long enough for a typical hour-long episode, but a multi-hour
  recording may need trimming to its most relevant section first.
- The social-clips parser expects a numbered list back from the model.
  On the rare reply that doesn't come back numbered, `social-clips.md`
  is still written (empty) and the run logs a warning rather than
  failing outright — worth a manual look on that run.

## License

See `LICENSE.md`. One-time purchase, for your own use — run it against
unlimited transcripts, not for resale as a standalone product.
