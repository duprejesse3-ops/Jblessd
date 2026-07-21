-- Adds a fourth wave of products aimed at students (college coursework and
-- research) and at office / admin workers. It leans into the student audience
-- while opening a brand-new "office" niche. Like the earlier waves this is a
-- roll-forward migration — it never touches an existing seed, it only inserts
-- new SKUs. ON CONFLICT (sku) DO NOTHING keeps it idempotent and lets it coexist
-- with the founding catalog, waves two and three, and any products owners
-- listed themselves.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  -- Students & college
  ('AI-PP-043', 'Exam Study Prompt Pack', 'prompts', 'students', '55 prompts · PDF + Notion', 14, 'Active-recall and spaced-repetition prompts that turn a dense syllabus into a study plan you can actually finish.', 'Works with Claude, ChatGPT, Gemini'),
  ('AI-TP-044', 'Course Notes System', 'templates', 'students', 'Notion template', 12, 'A Cornell-style notes workspace with summaries, cue columns, and one-click review pages for every class.', 'Duplicate-and-go, one page per course'),
  ('AI-AG-045', 'Essay Feedback Agent', 'agents', 'students', 'Agent config + rubric library', 24, 'Reads your draft like a TA would and returns line-level feedback on argument, structure, and clarity — never writes it for you.', 'Rubric-scored, plagiarism-safe by design'),
  ('AI-PP-046', 'Lecture-to-Flashcards Prompts', 'prompts', 'students', '30 prompts · Anki-ready', 13, 'Paste a lecture transcript or your notes and get clean question-and-answer cards ready to import.', 'Anki + Quizlet CSV export'),
  ('AI-TP-047', 'Semester Planner Template', 'templates', 'students', 'Notion + Sheets template', 15, 'Track every course, deadline, and grade in one place, with a running GPA that updates as you go.', 'Assignment tracker + GPA calculator'),
  ('AI-AB-048', 'Citation Formatter Automation', 'automations', 'students', 'Make.com blueprint', 19, 'Drop in a link or DOI and get a clean, correctly formatted reference added to your bibliography automatically.', 'APA, MLA & Chicago · Zotero sync'),
  ('AI-AG-049', 'Study Buddy Tutor Agent', 'agents', 'students', 'Agent config + subject presets', 22, 'A Socratic tutor that asks the next question instead of handing you the answer, so the concept actually sticks.', 'Presets for STEM, humanities & languages'),
  -- Office & admin
  ('AI-PP-050', 'Professional Email Prompt Pack', 'prompts', 'office', '60 prompts · PDF + Notion', 16, 'Say the hard thing well — declines, follow-ups, and status updates that stay warm and get read.', 'Tone controls for every workplace situation'),
  ('AI-TP-051', 'Meeting Agenda & Minutes Template', 'templates', 'office', 'Notion + Docs template', 12, 'Walk in with a tight agenda and walk out with decisions, owners, and dates already written down.', 'Agenda + action-item tracker in one'),
  ('AI-AB-052', 'Expense Report Automation', 'automations', 'office', 'Zapier blueprint', 23, 'Turns a folder of receipts into a categorized, submission-ready expense report without the manual typing.', 'Gmail + Drive + Sheets · OCR line items'),
  ('AI-AG-053', 'Calendar Scheduling Agent', 'agents', 'office', 'Agent config + calendar hooks', 26, 'Handles the back-and-forth of finding a time, then books the meeting and sends the invite for you.', 'Google + Outlook calendar aware'),
  ('AI-TP-054', 'Standard Operating Procedure Kit', 'templates', 'office', 'Notion + Markdown template', 17, 'Capture how work actually gets done so a task survives vacations, handoffs, and new hires.', 'Step-by-step SOP + onboarding checklist')
ON CONFLICT (sku) DO NOTHING;
