---
name: teach-site
description: Scaffold and maintain a local language-learning website — HTML lessons with writing textareas and speaking exercises, practice inputs/corrections as Markdown, a lesson sidebar, and website buttons that trigger agent runs for correction and auto-creating the next lesson. Use when the user invokes /teach-site, starts learning a new language with the local site, or when the site scaffolding (server.py, prompts, syllabus, course.json) is missing or broken.
argument-hint: <language> [level-or-goal]
---

# teach-site — local language-learning site

A course repo that runs as a website. The learner interacts with lessons in the
browser; the agent is only needed for setup and for runs the buttons trigger.

## System map

```
course.json          { "language": "German", "lang": "de-DE" }  — language + BCP-47 code
syllabus.md          curriculum; first topic NOT marked ✅ = next lesson
lessons/NNNN-*.html  self-contained lessons (house format, see style lesson)
practice-data/NNNN-inputs.md    answers saved on "Korrektur prüfen"
practice-data/NNNN-korrektur.md agent-written correction
server.py            stdlib HTTP server: serves lessons + injects sidebar,
                     saves inputs, spawns `cmd -p -t --yolo …` for buttons
start.sh             ./start.sh → localhost:8000 (mic requires localhost)
prompts/check.md     template for the correction run
prompts/create.md    template for the next-lesson run
assets/              style.css, speak.js, drill.js, sprechen.js + site.css/site.js
```

Button flow (no chat interaction): check button appears when every
`<textarea class="practice-ta">` has text → POSTs inputs → spawns
`cmd -p -t --yolo` with the filled prompt template → UI polls `/api/state` →
renders the korrektur MD beneath each practice. The "Auto create new lesson"
button appears only after a correction exists and builds the next syllabus
topic.

## The correction contract (do not break this)

Practice groups are identified **structurally**, never by prose. The lesson HTML
declares them with `data-practice` attributes; the correction Markdown repeats
them as HTML comment anchors on their own line, directly above the heading:

```
<!-- group:q -->   question feedback  (item per question: **N.** …)
<!-- group:w -->   writing-task feedback
<!-- group:s -->   speech feedback
```

The anchor binds to the **next heading only**. Sections without an anchor
(intro, "what already works", "next lesson") render at the bottom of the
lesson. Headings may be written in any language — the site matches on the
anchor, not the prose. This is what makes the site language-agnostic.

Accepted per-question formats inside a `group:q` section:
- `**N.** "answer"` + `→ *corrected*` + error bullets (the house format), or
- a table `| Nr. | Deine Antwort | Korrektur | Erklärung |` (one row per question).

A question may be missing from the correction (no errors found) — the site
then shows no box under it, which is correct.

## Other contracts

- Textareas: `data-practice="q" data-n="N"` per question, `data-practice="w"`
  for the writing task. Gating = all of them non-empty. Speaking textareas
  never gate.
- Nav statuses come from practice-data file presence (corrected / progress /
  new) — the server scans on every request, no index file.
- Speaking: `sprechen-item` elements with `data-say`, scored in-browser;
  transcripts go into the inputs MD.
- Lessons are served only through the server (nav injection + `/` redirect).
- `<html lang>` + `course.json` `lang` drive TTS and speech recognition.
- Prompt templates use `{PLACEHOLDER}` substitution; the server raises on any
  unknown placeholder instead of silently sending a broken prompt.

## Setup for a new language

1. Copy `templates/` from this skill into the course root: `server.py`,
   `start.sh`, `prompts/`, `assets/site.css`, `assets/site.js`, plus
   `templates/tests/*.js` into the repo root.
   An existing course repo (e.g. `~/Documents/learn-german-fast`) can be
   copied wholesale instead.
2. Create `course.json` with `language` and `lang` (BCP-47), plus
   `practice-data/` and `lessons/`.
3. Write `syllabus.md`: `# Syllabus — <language>`, a `## Done` list (empty)
   and a `## Planned` list of 8–12 topics — the agent builds the next lesson
   from the first unmarked one.
4. Create lesson `0001` yourself using the existing house format: set
   `<html lang="…">`, include site.css and the four scripts
   (speak/drill/sprechen/site.js), the `#practice-actions` block before
   `<footer>`, and the practice textarea contract above.
5. Start with `./start.sh` and open http://127.0.0.1:8000/

## Verification

Run these after any change to server.py, site.js, a prompt template, or a
correction file. The test files live in `templates/tests/` — copy them into the
course repo root:

```
python3 server.py --check          # structural check: lessons, blocks, templates
node test_correction_contract.js    # anchor parsing + placement (self-contained, Chinese fixture inline)
node test_history_render.js         # every korrektur in practice-data still maps to its lesson
```

All three exit non-zero on failure. `test_history_render.js` needs the real
course repo (lessons/ + practice-data/).

## Ongoing operation

- Corrections and next lessons are created by the website buttons
  (headless `cmd -p --yolo` runs, 1500s timeout). Do not create lessons in
  chat unless the user asks — the buttons are the pipeline.
- Run state is persisted in `.teach-site-state.json`, so a server restart does
  not orphan a run; the UI resumes polling after a reload.
- Chat fallback for a broken pipeline: fill `practice-data/NNNN-inputs.md`
  manually (keep the `<!-- group:x -->` anchors), then
  `cmd -p -t --yolo < <filled prompts/check.md>`.
- Changing direction = edit `syllabus.md` (add/move/withdraw topics).
- If you patch server.py / site.js / site.css / prompt templates in a course
  repo, mirror the change into this skill's `templates/` so new courses get
  the fix. The test files belong in the course repo root.
- Speech widgets follow `<html lang>`; CJK read-aloud scoring is
  character-level (see the shortcut note in `sprechen.js`).
