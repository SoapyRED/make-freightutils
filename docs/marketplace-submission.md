# Make App Directory submission package — prepared 2026-08-19 (parity sprint)

**Status: PREPARED, NOT SUBMITTED.** Submission is Soap-manual (Chrome-assisted), gated on
the dogfood run below. Publishing is **irreversible** (STATE.md rule); "Do NOT publish
reactively" stands. The Technology Partner programme application is the vehicle (queued
since v0.3.0 roadmap note).

## Hard gates before submission

1. **Dogfood run (live-engine-test rule).** One real scenario against the private app via
   the invite link — module output visible end-to-end, mapping panel clean. UI-only; no
   SDK test endpoint exists (CHANGELOG 0.2.2 probe: 404 across test/invoke/execute/run).
2. **Platform in sync with this repo.** As of 2026-08-19 the platform lags the repo:
   adrExemption is missing the four scope-verdict interface fields + samples;
   resolveReference does not exist on the platform yet. Apply with
   `scripts/update-module.mjs` once `MAKE_API_KEY` exists (Soap generates it in
   eu2.make.com → profile → API access), or paste per-section in Studio
   (https://eu2.make.com/sdk/apps/freightutils-gb5f0g/1).
3. **Base UA push** (pending since 0.2.3): `node scripts/update-base.mjs` — same key.

## What the submission needs (gap checklist)

| Item | State | Action |
|---|---|---|
| App label + description | ✅ live (`app.json`) | — |
| Theme colour `#EF9F27` | ✅ | — |
| Language/audience/countries | ✅ `en` / `global` / `gb,eu` | — |
| **Icon** | ❌ none in repo or platform | Use the brand slash-on-white icon: `https://www.freightutils.com/brand/icon-512.png` (512×512 PNG, shipped 2026-08-08). Upload via Studio → app → icon. |
| **Keywords on platform** | ❌ empty (`keywords: ""`) | Paste from `package.json` keywords: freight, logistics, shipping, dangerous-goods, adr, customs, hs-codes, api. Studio → app → settings. |
| **App documentation page** | ❌ "not available" | Draft below — paste into Studio → app → docs. |
| Per-module help text | ⚠️ thin | Acceptable for v1; connection help is good. |
| `private: true` → public | pending decision | Flip only at actual submission. |
| Support/contact + licence | ✅ MIT, contact in package.json | — |
| Worked scenarios | ✅ two in README | Reuse in the docs page. |
| Module count parity | 22 repo (21 platform + resolveReference pending) of 25 website tools | emissions / validate / ics2 / airports / nearest-airport remain unmapped — acceptable for v1 listing; note in submission or close first (Zapier now has all six — parity debt is Make-only). |
| Dogfood evidence | ❌ | Gate 1 above. |

## Draft app documentation page (paste into Studio)

> **FreightUtils — free freight tools API**
>
> Neutral freight reference + calculation layer: ADR 2025 dangerous goods (2,939 entries),
> HS 2022 codes (6,937), UN/LOCODE locations (116,232), airline codes, ULDs, container
> specs, CBM/LDM/chargeable-weight/pallet calculators, UK duty estimation, and an
> identifier resolver. Every response cites its source: authority, edition, licence where
> held, and a verification status.
>
> **Connection:** create a free API key at https://www.freightutils.com (100 requests/day;
> Pro 50,000/month). Paste it into the FreightUtils connection — validated against
> /health on save.
>
> **Modules:** 13 actions (calculators + checks) and 9 searches (reference lookups).
> Search modules output one bundle per matching record. "Resolve Freight Identifier"
> accepts any identifier ("176", "UN1845", "NLRTM", "FOB") and outputs ranked, cited
> candidates — ambiguity produces multiple bundles, never a guess.
>
> **Reference only** — never filing, booking, or legal advice; results state when human
> review is required. Full API docs: https://www.freightutils.com/api-docs

## Submission-day sequence (Soap, Chrome-assisted)

1. Confirm gates 1–3 above are green.
2. Studio: upload icon, paste keywords, paste docs page.
3. Partner programme application form (link from Make's Technology Partner page) —
   app `freightutils-gb5f0g`, zone eu2.
4. Do NOT flip `private` until Make review asks for it.
