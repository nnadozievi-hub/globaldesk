# The Desk — daily global markets briefing

A static site (US / UK / Europe / Asia) that **regenerates itself every weekday morning**. A scheduled GitHub Action calls the Anthropic API with web search, writes a fresh `public/data/briefing.json`, and deploys the site to GitHub Pages. No server to run — GitHub does the work.

```
global-desk/
├─ public/                 ← the site (this is what gets published)
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js               ← fetches ./data/briefing.json and renders it
│  └─ data/briefing.json   ← regenerated each morning (a seed is included so it works day one)
├─ scripts/generate.mjs    ← the generator (runs in the Action, never in the browser)
├─ .github/workflows/daily.yml
├─ package.json / package-lock.json
└─ README.md
```

## Setup (about 10 minutes)

**1. Create the repo (make it public).**
Public repos get free unlimited Actions minutes and free Pages — and GitHub Pages on the free plan requires a public repo. Your API key stays hidden either way (it lives in Secrets, not the code, and secret values are masked in logs).

**2. Push these files** to the `main` branch of that repo.

**3. Add your Anthropic API key as a secret.**
Get a key from the [Anthropic Console](https://console.anthropic.com/). Then in the repo: **Settings → Secrets and variables → Actions → New repository secret**
- Name: `ANTHROPIC_API_KEY`
- Value: your key

**4. Give Actions permission to commit.**
**Settings → Actions → General → Workflow permissions → “Read and write permissions” → Save.**

**5. Turn on Pages (Actions mode).**
**Settings → Pages → Build and deployment → Source: “GitHub Actions”.**

**6. Run it once by hand.**
**Actions → “Daily briefing” → Run workflow.** When it finishes, your site is live at:
`https://<your-username>.github.io/<repo-name>/`

That's it — it now runs automatically every weekday morning.

## When it runs

`daily.yml` is set to **06:00 UTC, Mon–Fri**. Two things worth knowing:
- **GitHub cron is always UTC and ignores British Summer Time.** So it fires at **07:00 London in summer (BST)** and **06:00 in winter (GMT)**. Change the `cron:` hour in `daily.yml` to move it.
- Scheduled runs can be **delayed a few minutes** under load, and GitHub **disables schedules after 60 days with no repo activity** — a manual run or any commit resets that.

Trigger it any time from the Actions tab (the `workflow_dispatch` button).

## Cost

You pay only for the model call itself — one request per run, with web search. On `claude-sonnet-5` that's roughly a few US cents per day depending on how much it searches. Web-search tool calls are billed per search on top of tokens. Actions minutes and Pages hosting are free for a public repo.

## Options you'll actually touch

- **Model.** Defaults to `claude-sonnet-5`. For sharper analysis, uncomment `ANTHROPIC_MODEL: claude-opus-4-8` in `daily.yml` (costs more). Model names change over time — if one is rejected, check the current list in the [API docs](https://docs.claude.com/en/api/overview).
- **What it covers / house style.** Edit the `SYSTEM` and `SCHEMA` strings in `scripts/generate.mjs`. Want a fifth region, a different section, or a house tone? Change them there — `app.js` renders whatever the schema produces.
- **Regions/order.** The generator is told to return US → UK → EU → AS. Adjust in the prompt and the tabs follow.

## Local preview

`app.js` uses `fetch()`, which browsers block over `file://`. So don't just double-click `index.html` — serve it:

```bash
cd public && python3 -m http.server 8000   # then open http://localhost:8000
```

To preview a freshly generated briefing locally, set your key and run the generator first:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm install
npm run generate            # writes public/data/briefing.json
```

## How the pieces fit

- **Secrets never reach the browser.** Generation happens inside the Action (server-side). Only the resulting JSON — which contains no key — is published. Safe even though the repo is public.
- **A bad run won't wipe a good site.** If the model returns something invalid, `generate.mjs` exits non-zero, the deploy step is skipped, and yesterday's briefing stays live.

## Honest limitations

- **The numbers are model-sourced from public reporting.** They're usually right, but an LLM can occasionally misstate a figure. Treat this as a fast morning read, not a data-of-record — verify anything you'd trade on. For bulletproof figures, feed the tape/snapshot from a licensed market-data API and let the model write only the narrative.
- **Redistributing real-time quotes usually needs a licence.** Personal/delayed use is fine; if this ever goes public-facing at scale, check your data source's terms.

*Stance tags and framing are interpretation, not fact. Nothing here is investment advice.*
