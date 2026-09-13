// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads open pull requests for a repo via GitHub's REST API. Inside GitHub
// Actions, GITHUB_TOKEN and GITHUB_REPOSITORY are already set — no extra
// secret to create for this part. The token needs no scopes beyond what
// Actions grants by default (contents: read, pull-requests: read) as long
// as the workflow's `permissions:` block allows it — see the template.

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

/**
 * @param {object} [options]
 * @param {string} [options.token]
 * @param {number} [options.staleDays=3]  a PR with no activity for this long is flagged stale
 * @returns {Promise<Array<{number:number, title:string, author:string, url:string,
 *   draft:boolean, reviewDecision:string|null, ageDays:number, updatedDaysAgo:number}>>}
 */
export async function listOpenPRs(options = {}) {
  const staleDays = options.staleDays ?? 3
  const repo = repoSlug()
  const headers = authHeaders(options.token)

  const res = await fetch(`${API}/repos/${repo}/pulls?state=open&per_page=50&sort=updated&direction=asc`, { headers })
  if (!res.ok) throw new Error(`GitHub API returned HTTP ${res.status} listing PRs for ${repo}`)
  const prs = await res.json()

  const now = Date.now()
  const withReviews = await Promise.all(
    prs.map(async (pr) => {
      let reviewDecision = null
      try {
        const reviewsRes = await fetch(`${API}/repos/${repo}/pulls/${pr.number}/reviews?per_page=20`, { headers })
        if (reviewsRes.ok) {
          const reviews = await reviewsRes.json()
          const latest = reviews[reviews.length - 1]
          reviewDecision = latest?.state ?? null
        }
      } catch {
        // Best-effort — a digest missing one PR's review state is still useful.
      }
      const ageDays = Math.floor((now - new Date(pr.created_at).getTime()) / 86_400_000)
      const updatedDaysAgo = Math.floor((now - new Date(pr.updated_at).getTime()) / 86_400_000)
      return {
        number: pr.number,
        title: pr.title,
        author: pr.user?.login ?? 'unknown',
        url: pr.html_url,
        draft: pr.draft ?? false,
        reviewDecision,
        ageDays,
        updatedDaysAgo,
        stale: updatedDaysAgo >= staleDays,
      }
    }),
  )

  return withReviews
}
