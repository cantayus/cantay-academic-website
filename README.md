# Cantay Caliskan — academic website

A static React website built with Vite for GitHub Pages. It presents research, Python software, original paper figures, educational games, teaching, background, a Google Drive CV, and the research-interest form. It includes light and dark themes and a searchable research catalog.

## Run and verify

Requires Node.js 22.13 or newer and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The default development port is 5174.

```sh
npm run check
npm run build
npm run verify
npm run preview
```

`npm run build` runs `scripts/build-pages.mjs`, building the browser assets and prerendering complete HTML into `dist/`. The current catalog produces 58 canonical pages and two legacy paper redirects, two former website paths, plus a 404 page, sitemap and robots file. New research entries receive their own page on the next build. Do not edit generated `dist/` files.

## Edit content

| Content | Source |
| --- | --- |
| Biography, education, books, software, games, CV source and homepage research order | `content/profile.json` |
| Papers, authors, publication categories, findings and links | `content/research.json` |
| Original figures, captions, credits and paper links | `content/figures.json` |
| Research and teaching narrative | `content/statements.json` and `profile.writing` |
| Last reconciled CV checksum and source identity | `content/resume-sync.json` |
| Optional analytics measurement ID | `content/site-config.json` |
| Typography, spacing and themes | `app/globals.css` |
| Rendering and browser behavior | `src/` and `app/site.tsx` |

GitHub source files are authoritative. Keep stable IDs when updating an existing paper or project. See [the editing guide](docs/EDITING.md) for the owner's requirements.

## Publish on GitHub Pages

The repository is `cantayus/cantay-academic-website`. Select **GitHub Actions** as its Pages publishing source. `.github/workflows/deploy.yml` checks, builds, verifies and deploys `dist/` when `main` changes; it also supports manual dispatch. The workflow obtains the Pages origin and base path from GitHub, so links and assets work under the repository path or a configured custom domain.

The primary website address is `https://www.cantaycaliskan.net/`. For a local build, `SITE_BASE_PATH` defaults to `/` and `SITE_ORIGIN` to `https://www.cantaycaliskan.net`. The shorter `cantay.net` domain forwards to the primary address. A repository-path preview can still set `SITE_BASE_PATH=/cantay-academic-website/` and `SITE_ORIGIN=https://cantayus.github.io`. Domain and DNS configuration are separate from editing content. Verify the deployment and resulting public pages before describing a new version or domain as live.

GitHub Pages serves static files. This version has no Worker, R2 database, content-write API or MCP endpoint. Git commits and Pages deployments publish changes to the site's content.

## CV and automatic updates

The CV page embeds the existing public Google Drive file directly. Use Drive's **Manage versions → Upload new version** to keep its file ID. The embedded CV can stay current without a website build. Do not add CV download links or display an update date. The research application continues to use its existing Google Form.

Changes to biography, publications and other website facts require a content commit and Pages deployment. [The automatic-update workflow](docs/automatic-updates.md) describes how an authorized cloud agent can reconcile a changed CV with the latest GitHub content. The previous daily Site task must be retargeted and its GitHub write/deployment path verified; this migration alone does not establish that whole-site synchronization is active.

## Analytics and assets

Analytics is inactive while `content/site-config.json` has a null `measurementId`. A GA4 measurement ID is public configuration, not a credential. When configured, Analytics starts automatically unless the visitor has turned it off. The About page links to the Privacy & analytics controls. Verify automatic loading and opt-out on the final domain.

Preserve figure captions, source links, image credits, and font/vendor licenses. The repository does not grant a blanket reuse license for the author's papers, portrait, or third-party research imagery. Verification notes are in `docs/verification` and `docs/research-review`.

Do not commit credentials, private application materials, local environment files, caches or generated builds.
