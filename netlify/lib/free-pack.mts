// The actual free prompt pack delivered by /api/free-pack.
//
// Kept as data (not prose buried in the endpoint) so the pack is easy to edit
// and so both the JSON response and the Markdown download are built from one
// source of truth. These are real, ready-to-use prompts in the spirit of the
// storefront's flagship "Deep Work Prompt Pack" (AI-PP-001) — the free taste
// that the lead magnet promises.

export interface PromptEntry {
  title: string
  body: string
}

export interface FreePack {
  slug: string
  title: string
  intro: string
  prompts: PromptEntry[]
}

export const FREE_PACK: FreePack = {
  slug: 'deep-work-starter-pack',
  title: 'Deep Work Starter Pack',
  intro:
    'Five prompts to run your day like an operator. Paste any one into Claude, ChatGPT, or Gemini and fill in the brackets. Want the full 120-prompt set? That is the Deep Work Prompt Pack in the catalog.',
  prompts: [
    {
      title: 'Prioritize the day',
      body:
        "Here is everything on my plate today:\n[dump your tasks, meetings, and open loops]\n\nAct as a ruthless chief of staff. Sort these into: (1) the ONE thing that moves the needle most, (2) two supporting tasks, (3) what to delegate or defer, and (4) what to delete. For the top item, give me a first 25-minute action I can start right now.",
    },
    {
      title: 'Design a focus block',
      body:
        "I have [90] minutes and I need to make real progress on:\n[describe the task or deliverable]\n\nBreak this into a focus block: a one-sentence goal, a 3-step plan sized to the time I have, the single distraction most likely to derail me and how to pre-empt it, and a concrete definition of 'done' for this session.",
    },
    {
      title: 'Unstick a stalled task',
      body:
        "I have been avoiding this task and I am not sure why:\n[describe the task]\n\nAsk me up to 3 sharp diagnostic questions to find the real blocker (unclear next step, missing info, fear of the outcome, or it is secretly someone else's job). Then, based on typical answers, propose the smallest possible next action that would create momentum.",
    },
    {
      title: 'End-of-day reset',
      body:
        "Here is what happened today:\n[wins, unfinished work, and anything nagging at me]\n\nRun my shutdown ritual: summarize what actually got done, capture every open loop so I can stop holding them in my head, and set up tomorrow by naming the single first task I should open the laptop to. Keep it under 150 words and end on an encouraging note.",
    },
    {
      title: 'Weekly review in 10 minutes',
      body:
        "Notes from my week:\n[projects, meetings, metrics, and how I felt]\n\nFacilitate a fast weekly review. Tell me: what went well and why, what to stop doing, the one lesson worth carrying forward, and the top 3 priorities for next week ranked by impact. Be direct and specific — no generic productivity advice.",
    },
  ],
}

// Renders the pack as a self-contained Markdown document the storefront offers
// as an instant download, so the subscriber genuinely receives the prompts.
export function packToMarkdown(pack: FreePack): string {
  const lines: string[] = [`# ${pack.title}`, '', pack.intro, '']
  pack.prompts.forEach((p, i) => {
    lines.push(`## ${i + 1}. ${p.title}`, '', p.body, '')
  })
  lines.push('---', '', 'From MULTIVICE AI — jblessd.com')
  return lines.join('\n')
}
