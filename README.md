# CSE445_quiz

Browser-based quiz builder for CSE445 content. The app lets you choose the module(s) and number of questions, runs the quiz with timers per prompt, then produces an exportable PDF that captures the user response, the correct answer, and the time spent on every item.

## Getting started

1. Open `docs/index.html` directly in your browser **or** serve the `docs/` folder with any static file host (e.g., `python -m http.server 4173 docs`).
2. The app loads `docs/questions.json`, so any change to that file is picked up on the next refresh—no backend required.

## Project layout

```
.
├── docs/
│   ├── index.html        # UI shell
│   ├── styles.css        # Tailored styling
│   ├── app.js            # Quiz orchestration, timers, PDF export
│   └── questions.json    # Authoritative question bank (served statically)
└── Notes/                # Provided module PDFs (reference material)
```

## Quiz features already in place

- Configurable quiz builder: pick how many questions to include, which modules to draw from, and filter by question type.
- Multiple question types supported out of the box: multiple choice, multi-select, true/false, and short answer.
- Per-question timers with cumulative tracking, navigation controls, and a running completion indicator.
- Summary table that highlights correctness, user response vs. answer key, and time spent per question.
- PDF export built without external libraries so summaries can be downloaded immediately after each quiz.
- Builder toggle to include/exclude generated placeholder questions so you can focus on officially uploaded material.
- Module selectors default to Modules 8–14 (the tested range) and show disabled placeholders until each module’s bank is populated.
- Code-practice questions render inline snippets with dropdown answers so you can rehearse code-reading prompts without losing context.

## Question bank format

Questions live in `data/questions.json` under a top-level `questions` array. Each record supports metadata you can extend later. Example:

```json
{
  "id": "mod8-001",
  "module": "Module 8",
  "topic": "Distributed Systems",
  "type": "multiple_choice",
  "prompt": "Which quality allows a distributed system to keep operating even if one node crashes?",
  "options": [
    { "id": "a", "label": "Fault tolerance" },
    { "id": "b", "label": "Loose coupling" },
    { "id": "c", "label": "Increased latency" },
    { "id": "d", "label": "Central coordination" }
  ],
  "answer": "a",
  "difficulty": "medium",
  "expectedDurationSec": 45,
  "tags": ["resilience", "availability"],
  "explanation": "Fault tolerance keeps the experience stable when a node fails."
}
```

Required fields are:

- `module`: Module label shown in the filters.
- `topic`: Topic name shown below each prompt.
- `type`: Use `multiple_choice` for single-answer prompts, `multi_select` for “select all that apply” questions, or `code_dropdown` when the question references a code snippet with a dropdown response.
- `prompt`: The actual question text.
- `answer`: The option id (string) that represents the correct choice.
- `options`: Array of option objects—each needs a stable `id` and human-readable `label`.

You can keep adding derived metadata such as `difficulty`, `tags`, or `expectedDurationSec`—the frontend renders them when present.

Optional fields:

- `code`: String containing the code snippet for `code_dropdown` questions (displayed in a formatted block above the dropdown).
- `generated`: Set to `true` on any prompt that was synthesized (instead of sourced directly from the provided question bank). Generated items display in the summary/PDF via the “Source” column, and the builder’s “Include generated questions” toggle uses this flag to filter them out.

## Updating the question bank

- Edit `docs/questions.json` and add/remove entries using the schema above.
- Reload the browser; the builder fetches that file on each load, so the new content appears immediately.
- Generated placeholders should keep `generated: true` so the builder toggle and summary “Source” column remain accurate.

## Deploying with GitHub Pages + remote API
The app is now 100% static, so deployment is as simple as:

1. In your repo settings, set GitHub Pages to “Deploy from branch → main → `/docs` folder”.
2. Push your changes—GitHub serves whatever lives in `/docs`.
3. Share the Pages URL; it will fetch `questions.json` from the same folder without needing any backend.

## Implementation guide

See [`IMPLEMENTATION.md`](IMPLEMENTATION.md) for a deeper look at the architecture, data flow, milestones, and step-by-step instructions for adding future module banks.

## Next steps

- Expand the bank with the real module questions you plan to upload.
- Configure grading rules per module/topic if needed.
- Hook the PDF export into your preferred storage or notification flow if automatic distribution is required.
