// Scheduled function: writes a real, product-specific benchmark scenario for
// every product that only has the generic per-category default.
//
// The seed migrations gave every product in a category the exact same bland
// prompt (e.g. every "agents" product got "Handle one representative task
// end to end in character..."). That's why scorecards and the velocity
// engine's posts about them read as generic — the underlying test was never
// about that specific product. This writes a concrete, product-specific
// scenario instead: a realistic worked example that actually exercises what
// that product does.
//
// A product is "generic" if its only active scenario's prompt matches one of
// the four category templates verbatim. Once rewritten, its prompt is
// specific enough that it will never match a template again, so this is
// naturally idempotent — safe to run repeatedly (e.g. picking up new
// products) without regenerating scenarios that are already good.
//
// Runs weekly, well before scorecard-runner.mts's Sunday run, so newly
// specific scenarios get benchmarked on their first real pass rather than
// waiting a full extra week.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-4-8'
const BATCH_
