# Editing Cantay's website

Edit the source in `cantayus/cantay-academic-website`, then commit the reviewed change to `main`. The Pages workflow builds and publishes that commit. Routine content edits do not require a redesign.

## Where to edit

| Change | File |
| --- | --- |
| Biography, current role, education, books, software, talks, games and their URLs | `content/profile.json` |
| Paper titles, authors, publication categories, years, summaries, findings and full-text links | `content/research.json` |
| Figures, captions, credits, alternative text and source-page links | `content/figures.json` |
| Research and teaching narrative | `content/statements.json` and `profile.writing` |
| Verified CV checksum and reconciliation provenance | `content/resume-sync.json` |
| Optional GA4 measurement ID | `content/site-config.json` |
| Typography, themes and spacing | `app/globals.css` |
| Layout and interactions | `src/` and `app/site.tsx` |

Content is bundled into the static build. Edit these source files rather than generated HTML in `dist/`. GitHub is the authority for manual and automatic content edits; a separate service must not overwrite it with an older snapshot.

## Research and figures

Each paper's stable `id` is its address at `/research/ID/`, relative to the configured Pages base path. Keep it when a title or publication status changes. Add a record only for a genuinely new work. Preserve `formerTitles`, `legacyIds`, DOI and SSRN identifiers so renamed papers are not duplicated. The build generates the existing legacy redirects.

Use confirmed publication categories. A forthcoming paper is not yet a published article; a work in progress is not a reviewed manuscript. Keep all existing reviewed summaries, questions, methods, findings, source provenance, stories and full-text-review flags unless new primary evidence supports a correction. A shorter CV is not evidence that a paper should be deleted. Do not guess expanded coauthor names.

Keep source captions, axes, legends, credits and paper-page references with figures. Use original repository examples or paper figures. Preserve actual source resolution; do not upscale an image merely to label it 4K. Clearly identify synthetic images when they are study material. Never publish private application documents or unverified repository links.

The homepage research order follows `profile.featuredResearch`. Place new studies using verified manuscript or posting dates rather than publication year alone.

## Games, software and the CV

Game URLs are in `profile.games`; changing the appropriate `url` updates the homepage and Games page after deployment. The Missing Variable uses `https://themissingvariable.net/`. Its existing screenshots are independent of its address.

The Software page and homepage feature use `profile.software`. Keep verified public links, exact install names, feature descriptions, related-paper IDs, visuals and credits. Use `devise-greenness`, not the unrelated `devise`. Distinguish published Python packages from research implementations. Keep Playable Past linked to `https://playablepast.com/`.

The CV's public Drive file ID is `1BrqPNXyQPgYKTzKbj5nD-EmhQlvbMIeq`. Replace its PDF through **Manage versions → Upload new version** to preserve the direct preview. Do not add CV download links or display an update date. Updating that PDF does not by itself rewrite the website's biography or paper entries; follow [automatic updates](automatic-updates.md) for structured reconciliation. Do not change the recorded checksum until that exact PDF has actually been checked and reconciled.

## Owner's editorial requirements

Preserve `profile.editorialPreferences` during every edit and automatic update:

- Do not add grants or academic-service website sections; they remain in the CV.
- Use plain, upright titles in one ink color. Do not mix italic and regular text within a title, add a decorative period after the name, or add promotional slogans/subtitles.
- Keep research topics concise: show category names, paper counts and related papers. Do not add abstract topic descriptions, taglines or repeated instructions.
- Keep the homepage introduction focused on academic background, current role, portrait and SICSS, with research below.
- Keep Research, Software, Games, Teaching, About, CV and Do research with Cantay visible in the top navigation on desktop and mobile. Narrow-screen links wrap; do not hide them in a dropdown or hamburger menu.
- Keep a prominent **Do research with Cantay** link on the homepage and Research page. It leads to `/research-with-me/`, which retains the existing research-interest form.
- Do not display Data Science Capstone in the teaching portfolio. Do not restore the paragraphs about permitting generative AI on assignments or the profession-description bias exercise. Omit the detailed narrative about unfinished projects, paper-presentation admission steps and continued contact after a course.

Teaching totals are editable under `profile.metrics`. The supplied teaching statement supports **41 course sections**, including five SICSS offerings, and **approximately 1,760 students**, excluding planned 2027 offerings. The CV supports **75+ research students in total**, not 75 alumni plus the current group. Lifetime totals include historical Capstone sections even though the course is omitted from the displayed portfolio. These are sections/offerings, not a count of individual class meetings.

## Verify and publish

```sh
npm ci
npm run check
npm run build
npm run verify
npm run preview
```

Inspect representative pages in both themes at desktop and mobile widths. Test the research filters, a paper's direct URL, new links, figure enlargement, the Drive CV and the research form. Preserve navigation and asset base-path handling; a project Pages site lives under `/cantay-academic-website/` unless configured otherwise.

Commit source files rather than generated `dist/` output. Check the **Deploy website to GitHub Pages** workflow for that exact commit, then inspect the resulting public pages. A successful build is not proof that deployment has completed. Custom-domain/DNS changes and optional analytics activation require their own verification.

Analytics remains inactive while `content/site-config.json` has a null `measurementId`. If the owner enables it, configure the public GA4 measurement ID there, retain consent before loading analytics, keep advertising features and enhanced form-interaction collection disabled, and verify collection on the final domain. Never add tokens or private credentials to this configuration.
