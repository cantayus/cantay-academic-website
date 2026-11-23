# Editing Cantay’s website

The site keeps content separate from layout. You can ask Codex to change the relevant file and publish the existing Site; no redesign is needed for routine edits.

| What to change | File |
| --- | --- |
| Biography, current role, education, books, software, talks, games and their addresses | `content/profile.json` |
| Each paper’s title, authors, status, year, description, topic, methods and full-text links | `content/research.json` |
| Figures, source captions, descriptions and source-paper page links | `content/figures.json` |
| Your research and teaching narrative | `content/statements.json` |
| Typography, light/dark colors and spacing | `app/globals.css` |

Each research entry has a permanent `id`, which is also its page address: `/research/ID`. Keep that ID when updating a title or publication status. Add a new object for a genuinely new paper. Use only confirmed publication statuses and do not delete a project merely because it disappears from a shorter CV. Keep source captions and legends with figures.

The homepage’s Recent research section follows `featuredResearch` in `profile.json`, from top to bottom and left to right. Keep the most recent studies first. The four newest supplied manuscripts lead the current selection; check actual manuscript or posting dates when adding another paper rather than relying on publication year alone.

Game links are stored in the `games` array in `profile.json`. The Missing Variable uses `https://themissingvariable.net/`, which the owner connected to the game. Its underlying source is `https://cantayus.github.io/the-missing-variable/`. Changing its one `url` field updates the homepage and Games page. Its existing screenshots are local website assets and are independent of the game’s address.

The current Google Drive résumé file ID is `1BrqPNXyQPgYKTzKbj5nD-EmhQlvbMIeq`. In Drive, use **Manage versions → Upload new version** to keep its link. The CV page displays that file directly in an embedded preview. Do not add separate CV download links or display an update date.

Whole-site synchronization is implemented as a validated content API and optional updater. Its exact setup and current limits are described in `docs/resume-sync.md`. Do not label it active until the actual unattended update path has been configured and tested.

Analytics is currently inactive. Create a GA4 web property for the final domain and configure its `GA4_MEASUREMENT_ID` in the Site’s runtime environment, then deploy the current saved version to apply it. The website requests consent before loading the analytics script. Keep advertising features and enhanced form-interaction collection disabled. Verify page views and the website’s custom events in GA4 before relying on reports.

The deployed review site begins private. Its robots configuration blocks indexing while under review. Connecting the existing public domain and allowing indexing are separate launch steps.

## Verification before publication

Run the project’s TypeScript check, `node scripts/verify-site.mjs` against a running preview, and the supported Sites build helper. Visually inspect representative pages in both themes and at desktop and mobile widths. Check new source links and PDF files. Publish through the Sites workflow using the exact built source commit.


## Owner’s editorial requirements

Do not add grants or academic service as website sections; those belong in the linked CV. Keep page and section headings in a single ink color. Do not add a decorative period after the name. Keep homepage introduction focused on academic background, current role, portrait, and SICSS, with research below. Use plain professional language without promotional slogans. Do not include the detailed teaching paragraph about unfinished projects, presenting a paper to enter the research group, or continued contact after courses. Preserve these decisions during all automatic updates.

Teaching totals are editable under `profile.metrics`: `teachingSections`, `studentsTaughtLabel`, and `researchStudentsLabel`. The supplied teaching statement supports 41 course sections (including five SICSS offerings) and approximately 1,760 students, excluding planned 2027 offerings; the current CV supports 75+ research students in total. These are lifetime totals, including historical Capstone sections, though Capstone is excluded from the displayed portfolio at the owner’s request. Do not restore the two removed generative-AI teaching paragraphs.

Use plain, upright headings throughout. Do not mix italic and regular text within titles or add promotional subtitles such as “From class to research.” Keep “Explore research opportunities” prominent on the homepage and Research page. Both links lead to the standalone Research opportunities page at `/research-with-me`, which retains the research-interest form.

Primary navigation stays visible at the top at every screen width. On narrow screens, links wrap below the name and theme control; do not replace them with a dropdown or hamburger menu.
