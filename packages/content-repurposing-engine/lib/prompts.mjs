// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The three prompts this product runs against one transcript: a blog post
// draft, a newsletter blurb, and a batch of short social clips/quotes.
// Kept as small, pure string builders so each has a test independent of the
// Claude call itself.

const MAX_TRANSCRIPT_CHARS = 40_000

function truncate(transcript) {
  return transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n[transcript truncated]'
    : transcript
}

/**
 * @param {string} transcript
 * @param {string} [title]
 * @returns {string}
 */
export function buildBlogPrompt(transcript, title) {
  return [
    'You are turning a podcast/video transcript into a blog post draft, in Markdown.',
    title ? `Working title: ${title}` : null,
    '',
    'Transcript:',
    '"""',
    truncate(transcript),
    '"""',
    '',
    'Write a blog post draft that:',
    '- Opens with a hook that does not just restate the episode title',
    '- Is organized under a handful of Markdown ## subheadings pulled from the actual',
    '  topics discussed, not a generic "Introduction / Body / Conclusion" structure',
    '- Quotes the transcript directly (in blockquotes) for its 2-3 most quotable moments',
    '- Stays grounded in what was actually said — do not invent facts, statistics, or',
    '  claims the transcript does not support',
    '- Ends with a short takeaway, not a generic summary restating the whole post',
    '',
    'Reply with only the Markdown blog post — no preamble, no "Here is a blog post:".',
  ].filter(Boolean).join('\n')
}

/**
 * @param {string} transcript
 * @param {string} [title]
 * @returns {string}
 */
export function buildNewsletterPrompt(transcript, title) {
  return [
    'You are writing a short newsletter blurb (120-180 words) promoting this episode.',
    title ? `Episode title: ${title}` : null,
    '',
    'Transcript:',
    '"""',
    truncate(transcript),
    '"""',
    '',
    'Write a blurb that names the single most useful or surprising idea from the',
    'episode in the first sentence, gives one concrete reason to listen/read further,',
    'and ends with a one-line call to action. Plain text, no Markdown headers, no',
    'subject line, no "Hi there" greeting — this is the body copy only.',
    '',
    'Reply with only the blurb text — no preamble.',
  ].filter(Boolean).join('\n')
}

/**
 * @param {string} transcript
 * @param {number} [count]
 * @returns {string}
 */
export function buildSocialClipsPrompt(transcript, count = 5) {
  return [
    `You are pulling ${count} short, standalone social-media clips from this transcript —`,
    'each one a real quote or tightly paraphrased moment that works on its own without',
    'the surrounding context, the kind of line someone would screenshot or quote-tweet.',
    '',
    'Transcript:',
    '"""',
    truncate(transcript),
    '"""',
    '',
    `Reply with exactly ${count} numbered lines, "1." through "${count}.", each one a`,
    'single clip under 240 characters. No hashtags, no emoji, no commentary — just the',
    'clips themselves, one per line.',
  ].join('\n')
}
