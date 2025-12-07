# Quiz Application Implementation Guide

## Current milestone
- **Milestone:** Module 8 question bank imported with 21 prompts (15 sourced from course material, 6 generated placeholders for Modules 9–13 to keep the UI demonstrable).
- **Status:** Frontend/Backend scaffolding complete, API endpoints stable, PDF export enabled, generated-question filtering in place.

## Architecture overview
- **Static frontend (`docs/`)**
  - `index.html` renders the builder, quiz view, and summary/export panels.
  - `app.js` loads `questions.json`, renders filters, runs quiz navigation and timers, evaluates results, builds the PDF summary, and handles generated-question filtering.
  - `styles.css` handles the glassmorphism theme, pill buttons, summary tables, responsive layout, and code dropdown widgets.
  - `questions.json` is fetched directly from the same folder, so GitHub Pages (or any static host) can serve the entire app without a backend.

## Question bank details
- Stored in `data/questions.json` under a single `questions` array.
- Required fields: `id`, `module`, `topic`, `type` (`multiple_choice`, `multi_select`, or `code_dropdown`), `prompt`, `options` (array of `{ id, label }`), and `answer` (option id string or array for multi-select).
- Optional metadata: `difficulty`, `expectedDurationSec`, `tags`, `explanation`, `code` (for code dropdown questions), and `generated`.
- The UI renders standard multiple-choice radio lists plus `code_dropdown` questions (dropdown selector paired with a code snippet). Convert any “select all” prompts into single-answer form before loading them.
- The `generated` flag controls:
  - Builder toggle (`Include generated questions`).
  - Summary/PDF “Source” column (“Generated” vs. “Course”).
  - Future automation (e.g., filtering out placeholders when exporting final exams).

## Adding more banks/modules
1. Gather the raw questions (PDF, text, etc.) and convert them into the JSON shape above.
2. Keep module labels aligned with the tested range (currently Modules 8–14). The UI shows disabled placeholders for modules with no content yet.
3. For each new question:
   - Choose a unique `id` (e.g., `mod9-quiz-001`).
   - Populate the `options` array with clear labels.
   - Set `generated: true` only if the question was synthesized rather than sourced from course material.
4. Append the new objects to `data/questions.json` and restart the server (or redeploy the API host). The frontend will pick up the additions on the next refresh.

## Deployment patterns
- **Local testing:** Open `docs/index.html` directly in a browser or serve the folder with `python -m http.server 4173 docs`.
- **GitHub Pages:** Configure Pages to publish the `/docs` folder and push your changes. That’s enough to host the entire app.
- **Other static hosts:** Drop the `docs/` folder into Netlify, Vercel (static export), Azure Static Web Apps, S3/CloudFront, etc.—no server code required.

## Feature reference
- **Module pills:** Placeholders for Modules 8–14 appear by default. Selected pills now display both the check mark and text in high-contrast colors.
- **Generated toggle:** Located under the builder form. Off = course-only questions.
- **Code dropdown questions:** Any prompt with `type: code_dropdown` surfaces the provided snippet and a dropdown selector so learners can practice code-specific items.
- **Summary report:** Shows Module, Source (Generated/Course), Topic, Prompt, user answer, correct answer, result, and time in seconds. The PDF mirrors the same metadata and adds Source per question.
- **PDF export:** Runs entirely in-browser via a minimal PDF writer (`buildSummaryPdf`).

Keep this guide nearby when extending the project or onboarding collaborators so everyone aligns on the data format, deployment expectations, and built-in tooling.
