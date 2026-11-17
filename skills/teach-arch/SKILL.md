---
name: teach-arch
description: Teach a software project system-design-first — arch map, one node per lesson, MCQ plus input practice with corrections. Use when the user invokes /teach-arch, wants arch-first instead of tech-first lessons, or asks for the arch lesson site.
argument-hint: "<stack e.g. nodejs-react-typescript> [project goal]"
---

# teach-arch — system-design-first course site

Extends `teach` (workspace state: MISSION.md, lessons/, reference/, learning-records/, NOTES.md)
plus `teach-site` (local site pipeline: server.py, buttons, practice-data/, prompts/).
`ARCHITECTURE.md` is the only lesson order. There is no `syllabus.md`.

## System map

```
course.json                { "project": "...", "stack": ["nodejs", "react", "typescript"] }
ARCHITECTURE.md            tech-free boxes + flows + lesson-mapping table + Tech-mapping (sole order)
lessons/NNNN-*.html        self-contained lessons, one arch node each (house format below)
practice-data/NNNN-inputs.md     answers saved on "Check answers"
practice-data/NNNN-correction.md agent-written correction (note: correction, not korrektur)
server.py                  stdlib HTTP server: serves lessons + injects sidebar,
                           saves inputs, spawns `cmd -p -t --yolo …` for buttons
start.sh                   ./start.sh → localhost:8000
prompts/check.md           template for the correction run
prompts/create.md          template for the next-lesson run
assets/                    style.css, site.js (+ shared lesson stylesheet)
```

Button flow (no chat interaction): Check button appears when every MCQ radio
group has a choice AND every input textarea has text → POSTs inputs → spawns
`cmd -p -t --yolo` with the filled prompt template → UI polls `/api/state` →
renders the correction MD beneath its own question. The "Create next lesson"
button appears only after a correction exists and builds the next unmarked row
of the ARCHITECTURE.md table.

## Step zero — ARCHITECTURE.md (always before lesson 0001)

Build it on first use, get user approval, then freeze the order:

- Brownfield (developed project): scan repo + MISSION.md, write a short
  analysis (what the system does, entry points, data flow) then draft
  ARCHITECTURE.md. Show the analysis back before lessons.
- Greenfield (empty repo): draft ARCHITECTURE.md from MISSION.md plus the
  declared stack only.
- No lessons before the table is approved.

ARCHITECTURE.md contents:

1. Purpose in 3 sentences max.
2. 5–9 boxes, tech-free names (e.g. "Invite flow", not "Express router").
   Each box: responsibility + inputs + outputs in one line each.
3. 2–4 end-to-end flows as numbered steps naming the boxes they cross.
4. Lesson-mapping table, one row per lesson: `| # | Arch node | Problem it resolves | Boxes touched | Status |`.
   Each row = one lesson. Status is `todo` / `done` / `stale`.
5. Tech-mapping: each box → the stack piece used there (one line per box).

Update rule: user asks OR a lesson reveals a gap → edit the table, mark
affected lessons `stale`, approval before the new order takes effect.

## Lesson template (all five sections, in this order)

1. Which arch box + what breaks without it (2–3 sentences).
2. One flow trace: max 2–3 files, real file/function names, why each step
   exists. Cross-flow file jumps are forbidden.
3. Tech note: one box max, only the stack piece used in this node.
4. Practice: 5–10 MCQ + 1–3 input questions, combining this lesson only.
5. Feedback + next-lesson area (`#practice-actions` block, verbatim copy).

Hard rules: 600–900 words of prose; simple everyday English, keep tech terms
as-is; one analogy max; no generic textbook definitions; MCQ options equal
length so format gives no clue; one new idea per lesson.

MCQ markup: each question is a fieldset with radios sharing one N:

```html
<fieldset class="mcq" data-practice="q" data-n="1">
  <legend>1. What creates the invite row?</legend>
  <label><input type="radio" name="q1" value="A"> …</label>
  <label><input type="radio" name="q1" value="B"> …</label>
</fieldset>
```

Input markup: `<textarea class="practice-ta" data-practice="w" data-n="1">`
per input question (1–3 per lesson). The `q`/`w` ids are structural: the
correction file repeats them as `<!-- group:q -->` / `<!-- group:w -->`
anchors, never matched by prose.

## The correction contract (do not break this)

`practice-data/NNNN-correction.md`:

```
<!-- group:q -->
## Correction — questions
**N.** "chosen option" → ✓ or ✗, correct option, 1–2 line why in simple
English, pointer back to the arch box/flow.
(e.g. **1.** "B" → ✗, correct A — the invite row is created in X, see Flow 2.)

<!-- group:w -->
## Correction — written answers
Per input answer: verdict + short correction + what to re-read.
```

Plus optional no-anchor opening (2–4 bullets, what went well) and closing
(2–3 sentences, what to review) — rendered at the bottom of the lesson.
A question may be missing from the correction (no errors found) — the site
then shows no box under it, which is correct. MCQ distractor rule: options
equal length.

## Other contracts

- Gating = every MCQ group answered AND every input textarea non-empty.
- Nav statuses come from practice-data file presence (corrected / progress /
  new) — the server scans on every request, no index file.
- Lessons served only through the server (nav injection + `/` redirect).
- Prompt templates use `{PLACEHOLDER}` substitution; the server raises on any
  unknown placeholder instead of silently sending a broken prompt.
- `course.json` holds the stack; lessons never teach stack pieces outside
  their node's Tech note.

## Setup for a new course

1. Copy `templates/` from this skill into the course root: `server.py`,
   `start.sh`, `prompts/`, `assets/site.css`, `assets/site.js`, plus
   `templates/tests/*.js` into the repo root.
2. Create `course.json` with `project` and `stack`, plus `practice-data/`
   and `lessons/`.
3. Write `ARCHITECTURE.md` per step zero above; get approval.
4. Create lesson `0001` from the first `todo` table row using the 5-section
   template: `#practice-actions` block before `<footer>`, MCQ + textarea
   contracts above, site.css + site.js includes.
5. Start with `./start.sh` and open http://127.0.0.1:8000/

## Verification

Run after any change to server.py, site.js, a prompt template, or a
correction file:

```
python3 server.py --check          # structural: lessons, blocks, templates, arch table
node test_correction_contract.js   # anchor parsing + placement (arch fixture)
node test_history_render.js        # every correction in practice-data maps to its lesson
node test_arch_order.js            # lessons follow the ARCHITECTURE.md table order
```

All exit non-zero on failure. `test_history_render.js` needs the real course
repo (lessons/ + practice-data/).

## Ongoing operation

- Corrections and next lessons come from the website buttons
  (headless `cmd -p --yolo` runs, 1500s timeout). Do not create lessons in
  chat unless the user asks — the buttons are the pipeline.
- Run state persists in `.teach-site-state.json`, so a restart does not
  orphan a run; the UI resumes polling after reload.
- Chat fallback: fill `practice-data/NNNN-inputs.md` manually (keep the
  `<!-- group:x -->` anchors), then `cmd -p -t --yolo < <filled prompts/check.md>`.
- Changing direction = edit `ARCHITECTURE.md` (add/move/withdraw rows);
  the create run marks the used row `done`.
- Patches to server.py / site.js / site.css / prompt templates in a course
  repo get mirrored into this skill's `templates/` so new courses get the fix.
