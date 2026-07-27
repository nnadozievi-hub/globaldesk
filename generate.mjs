// Generates the daily global markets briefing as JSON.
// Runs in GitHub Actions (server-side) so the API key is never exposed to the browser.
//
// Env:
//   ANTHROPIC_API_KEY  (required)  – set as a GitHub Actions secret
//   ANTHROPIC_MODEL    (optional)  – defaults to claude-sonnet-5; swap for claude-opus-4-8 for max quality
//   OUT_PATH           (optional)  – defaults to public/data/briefing.json

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const OUT = process.env.OUT_PATH || "public/data/briefing.json";
const MAX_SEARCHES = 20;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const nowISO = new Date().toISOString();
const nowUK = new Date().toLocaleString("en-GB", {
  timeZone: "Europe/London",
  weekday: "long", year: "numeric", month: "long", day: "numeric",
  hour: "2-digit", minute: "2-digit",
});

// The exact shape app.js expects. Keep field names stable.
const SCHEMA = `{
  "asOf": "short label for the data point, e.g. 'Fri 24 Jul close' or 'pre-market, 27 Jul'",
  "marketStatus": "one of: 'Markets closed — weekend', 'Pre-market', 'Market hours', 'After the close'",
  "headline": "one plain sentence summarising the single most important thing across all regions",
  "tape": [
    { "n": "S&P 500", "v": "7,411.98", "c": "+0.05%", "d": "up|down|flat" }
    // 8–10 flagship instruments spanning regions: major equity indices, UST 10Y, Gilt 10Y, Brent, Gold, Bitcoin
  ],
  "regions": [
    {
      "code": "US", "name": "United States",
      "lede": "one sharp sentence; you may wrap up to two key phrases in <b>...</b>",
      "meta": "compact one-line stat strip (index level, policy rate, 10Y, VIX, weekly move)",
      "snapshot": [
        { "asset": "S&P 500", "level": "7,411.98", "session": "+0.05%", "trend": "wk -1.3%", "d": "up|down|flat" }
        // 5–7 rows: key indices + yields + vol/fx for the region
      ],
      "developments": [
        {
          "title": "short title",
          "stance": "bullish|bearish|neutral|hawkish|catalyst|developing",
          "body": "2–3 sentences: what happened, why it matters, what to watch. Paraphrase sources; no long quotes."
        }
        // 3–5 items, ORDERED by market impact (most important first)
      ],
      "calendar": [
        { "date": "Wed 29", "event": "FOMC decision + Microsoft & Meta earnings", "hot": true }
        // key scheduled catalysts for the next 1–2 weeks; hot=true for the biggest
      ],
      "watch": [ "short forward-looking item", "..." ]
    }
    // EXACTLY four regions in this order: US (United States), UK (United Kingdom), EU (Europe), AS (Asia-Pacific)
  ]
}`;

const SYSTEM = `You are an institutional-grade macro strategist, equity analyst and market-news editor writing a concise daily global markets briefing for a sophisticated finance professional.

Rules:
- Use the web_search tool aggressively to gather CURRENT data for all four regions before writing. Cover indices, government bond yields, central-bank policy, inflation/jobs/GDP where fresh, currencies, commodities (esp. oil), crypto, notable earnings and the biggest movers, plus the next 1–2 weeks of catalysts.
- Work out the market status from the current UK date/time given to you (weekend/pre-market/market hours/after the close) and set marketStatus accordingly.
- Prioritise institutional-quality information over headlines or social-media noise. Distinguish fact from interpretation: the "stance" field and framing are your interpretation; keep the "body" grounded in what actually happened.
- Be concise and specific. Use real, current figures from your searches — never invent numbers. If something is genuinely unavailable, omit it rather than guessing.
- Respect copyright: paraphrase everything, do not reproduce long quotes.

OUTPUT CONTRACT (critical):
- Output NOTHING but a single minified JSON object matching the schema. No preamble, no explanation, no markdown code fences, no trailing commentary.
- The JSON must be valid and parseable, with exactly four regions in the order US, UK, EU, AS.`;

const USER = `Current date & time: ${nowUK} (UK time).

Produce today's briefing now. Return ONLY the JSON object, matching this schema exactly:

${SCHEMA}`;

const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }];

async function run() {
  const messages = [{ role: "user", content: USER }];
  let resp = await client.messages.create({
    model: MODEL, max_tokens: 8000, system: SYSTEM, messages, tools,
  });

  // The server-side search tool can pause a long turn; continue until it's done.
  let guard = 0;
  while (resp.stop_reason === "pause_turn" && guard++ < 6) {
    messages.push({ role: "assistant", content: resp.content });
    resp = await client.messages.create({
      model: MODEL, max_tokens: 8000, system: SYSTEM, messages, tools,
    });
  }

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // Extract the JSON object even if the model added stray characters or fences.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in model output. First 500 chars:\n" + text.slice(0, 500));
  }
  const data = JSON.parse(text.slice(start, end + 1));

  // Minimal shape validation — fail loudly so a bad run doesn't overwrite good data.
  if (!Array.isArray(data.tape) || data.tape.length === 0) throw new Error("Invalid briefing: 'tape' missing/empty");
  if (!Array.isArray(data.regions) || data.regions.length !== 4) throw new Error("Invalid briefing: expected 4 regions");
  for (const r of data.regions) {
    if (!r.code || !Array.isArray(r.developments) || !Array.isArray(r.snapshot)) {
      throw new Error(`Invalid briefing: region '${r.code || "?"}' is malformed`);
    }
  }

  data.generatedAt = nowISO;

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`✓ Wrote ${OUT} — ${data.regions.length} regions, generatedAt ${data.generatedAt}`);
}

run().catch((err) => {
  console.error("✗ Generation failed:", err.message);
  // Non-zero exit: the workflow's deploy step will be skipped, so the last good briefing stays live.
  process.exit(1);
});
