# CSE445_quiz

Browser-based quiz builder for CSE445 content. The app lets you choose the module(s) and number of questions, runs the quiz with timers per prompt, then produces an exportable PDF that captures the user response, the correct answer, and the time spent on every item.

## Getting started

1. Ensure you have Node.js 18+ installed.
2. Install dependencies (none beyond Node core) and launch the local server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:4173` in a browser to use the quiz builder.

The `dev` script spins up the lightweight Node server in `server.js`. It serves everything in `public/` and exposes the `/api/questions` endpoint so the frontend can fetch/update the bank.

## Project layout

```
.
├── data/questions.json   # Authoritative question bank
├── public/
│   ├── index.html        # UI shell
│   ├── styles.css        # Tailored styling
│   └── app.js            # Quiz orchestration, timers, PDF export
├── server.js             # Static file server + question API
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
- `type`: Use `multiple_choice` for standard prompts or `code_dropdown` when the question references a code snippet and should be answered via a dropdown.
- `prompt`: The actual question text.
- `answer`: The option id (string) that represents the correct choice.
- `options`: Array of option objects—each needs a stable `id` and human-readable `label`.

You can keep adding derived metadata such as `difficulty`, `tags`, or `expectedDurationSec`—the frontend renders them when present.

Optional fields:

- `code`: String containing the code snippet for `code_dropdown` questions (displayed in a formatted block above the dropdown).
- `generated`: Set to `true` on any prompt that was synthesized (instead of sourced directly from the provided question bank). Generated items display in the summary/PDF via the “Source” column, and the builder’s “Include generated questions” toggle uses this flag to filter them out.

## API overview

- `GET /api/questions` → returns `{ "questions": [...] }` from the JSON file.
- `POST /api/questions` → accepts `{ "question": { ... } }`, validates the payload, assigns an `id` if one is not supplied, and appends it to `data/questions.json`.

Both routes send CORS-friendly responses so you can automate uploads from scripts or REST clients.

## Uploading more questions

When you are ready:

1. Drop your curated questions into `data/questions.json` (matching the schema above) **or** POST them to `/api/questions`.
2. Reload the browser—filters and quiz generation logic will pick up the fresh bank instantly.
3. If you want me to help convert raw prompts into this schema or synthesize new ones, just provide the source material and we can extend the JSON file together.

## Deploying with GitHub Pages + remote API

If you want the frontend hosted on GitHub Pages while the API runs elsewhere:

1. **Host the API** – deploy `server.js` (plus `data/questions.json`) to a tiny Node host such as Render, Railway, Fly.io, or Azure App Service. Set `HOST=0.0.0.0` and use the platform-provided `PORT`. The server already serves CORS-friendly JSON responses, so no extra config is necessary.
2. **Publish the static UI** – enable GitHub Pages for this repo and point it at the `/public` directory (or copy that folder into a `gh-pages` branch). Pages will serve the HTML/CSS/JS without the Node backend.
3. **Tell the UI where the API lives** – open your Pages URL with `?apiBase=https://your-api-host.example.com` appended. The app stores that base URL in `localStorage` and uses it for every `/api/...` request. To revert to same-origin requests, visit the site with `?apiBase=.` once.

With this setup you can update questions on the remote Node host while the static UI stays cached on GitHub Pages.

## Implementation guide

See [`IMPLEMENTATION.md`](IMPLEMENTATION.md) for a deeper look at the architecture, data flow, milestones, and step-by-step instructions for adding future module banks.

## Next steps

- Expand the bank with the real module questions you plan to upload.
- Configure grading rules per module/topic if needed.
- Hook the PDF export into your preferred storage or notification flow if automatic distribution is required.
