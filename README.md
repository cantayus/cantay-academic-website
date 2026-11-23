# Cantay Caliskan — academic website

Source for Cantay Caliskan’s personal academic website: research, Python software, original paper figures, educational games, teaching, background, and an embedded Google Drive CV. The interface includes light and dark themes and a searchable research index.

## Run locally

Requires Node.js 22.13 or newer and npm.

```sh
npm ci
npm run dev -- --port 5173 --hostname 127.0.0.1
```

Open the local address printed by the development server.

```sh
npx tsc --noEmit
npm run build
```

## Edit content

| Content | File |
| --- | --- |
| Biography, education, games, CV source, homepage research order | `content/profile.json` |
| Paper entries, authors, publication status, findings and links | `content/research.json` |
| Original figures, captions and source-paper links | `content/figures.json` |
| Research and teaching narrative | `content/statements.json` and `profile.writing` |
| Typography, spacing and theme colors | `app/globals.css` |

Keep each paper’s stable `id` when updating a title or publication status. The homepage follows `profile.featuredResearch`. Keep new studies near the top. See [the editing guide](docs/EDITING.md) for the owner’s editorial requirements.

## CV and updates

The CV displays directly from its Google Drive file. Replace that file using Drive’s Manage versions feature to retain its file ID. Do not add CV download links or display an update date on the page.

The server supports validated content revisions stored in R2. Automatic changes to the rest of the website require an owner-authorized updater to be connected, verified, and scheduled. Its implementation is present, but uploading this repository does not activate that updater. See [automatic updates](docs/automatic-updates.md) and [résumé synchronization](docs/resume-sync.md).

## Hosting

This project runs Vinext as a Cloudflare Worker and uses an R2 `BUCKET` binding for live content. The existing Site identity is recorded in `.openai/hosting.json`; preserve it when continuing work on that Site. Runtime secrets and access settings are configured in the hosting platform, outside Git.

GitHub stores the editable source. GitHub Pages alone cannot run the Worker, R2 storage, résumé APIs, or owner-authenticated MCP tools. Uploading this source does not change the existing live website or its domain.

For a different hosting platform, configure a compatible Worker and storage deployment and implement trusted owner authentication before enabling content writes. The `oai-authenticated-user-email` header is supplied by Sites; another host must not trust a client-supplied copy of that header.

## Configuration

The included `.env.example` lists configuration names without credentials. Do not commit local `.env` or `.dev.vars` files. Keep `SITE_OWNER_EMAIL`, `CONTENT_SYNC_TOKEN`, and any provider credentials in host-managed configuration. GA4 remains inactive until a valid measurement ID is configured.

## Assets and attribution

Paper figures and full-text links retain their source captions and credits. Preserve those credits and the font/vendor license files. This repository does not grant a blanket reuse license for the author’s papers, portrait, or third-party research figures.

The `docs/verification` and `docs/research-review` directories record the research review and verification work. Their file paths have been generalized for portability. Generated builds, caches, local tool state, credentials, and live R2 content are excluded.
