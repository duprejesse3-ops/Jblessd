// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Finds every PR merged between the previous release tag and the one just
// published, via GitHub's compare API plus a search for merged PRs whose
// merge commit falls in that range. Runs inside Actions with GITHUB_TOKEN;
// no extra secret needed for this part.

const API = 'https://api.github.com'

function repoSlug() {
  const slug = process.env.GITHUB_REPOSITORY
  if (!slug) throw new Error('GITHUB_REPOSITORY is not set — this is meant to run inside GitHub Actions.')
  return slug
}

function authHeaders(token) {
  const t = token ?? process.env.GITHUB_TOKEN
  if (!t) throw new Error('GITHUB_TOKEN is not set. In a workflow it is provided automatically via ${{ secrets.GITHUB_TOKEN }}.')
  return { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
}

/** A Linear issue key like ENG-123, if one appears in the text. */
function linearKey(text) {
  const m = text.match(/\b([A-Z]{2,10}-\d+)\b/)
  return m ? m[1] : null
}

/**
 * @param {string} previousTag   the tag/ref of the last release (empty string
 *   or falsy means "everything on the default branch", used for a first release)
 * @param {string} currentTag    the tag/ref just published
 * @param {object} [options]
 * @returns {Promise<Array<{number:number, title:string, author:string, url:string, linearKey:string|null}>>}
 */
export async function mergedSince(previousTag, currentTag, options = {}) {
  if (!previousTag) {
    // First release: nothing to compare against, so just report the tag itself.
    return []
  }

  const repo = repoSlug()
  const headers = authHeaders(options.token)

  const res = await fetch(`${API}/repos/${repo}/compare/${previousTag}...${currentTag}`, { headers })
  if (!res.ok) throw new Error(`GitHub API returned HTTP ${res.status} comparing ${previousTag}...${currentTag}`)
  const data = await res.json()
  const shas = new Set((data.commits ?? []).map((c) => c.sha))

  // Pull requests aren't in the compare payload directly — look up each
  // commit's associated PR. Capped at 100 commits: past that, list what was
  // found rather than making an unbounded number of API calls per release.
  const commits = [...shas].slice(0, 100)
  const prsByNumber = new Map()

  for (const sha of commits) {
    const prRes = await fetch(`${API}/repos/${repo}/commits/${sha}/pulls`, {
      headers: { ...headers, Accept: 'application/vnd.github.groot-preview+json' },
    })
    if (!prRes.ok) continue
    const prs = await prRes.json()
    for (const pr of prs) {
      if (pr.merged_at && !prsByNumber.has(pr.number)) {
        prsByNumber.set(pr.number, {
          number: pr.number,
          title: pr.title,
          author: pr.user?.login ?? 'unknown',
          url: pr.html_url,
          linearKey: linearKey(pr.title) ?? linearKey(pr.head?.ref ?? ''),
        })
      }
    }
  }

  return [...prsByNumber.values()].sort((a, b) => a.number - b.number)
}
