# make-freightutils

Make.com custom app for [FreightUtils](https://www.freightutils.com) — free freight tools API. **Currently private v0.1.0** on the EU2 Make zone. Public App Directory listing via the Technology Partner programme is queued for v0.2.0+.

## What's in this release

17 modules wrapping the FreightUtils REST API, matching the Zapier sibling's split:

**Actions (9)**
- Calculate CBM · LDM · Chargeable Weight · Consignment · Pallet Fitting · Convert Units
- Check ADR LQ/EQ Eligibility · Calculate ADR 1.1.3.6 Exemption · Calculate UK Import Duty

**Searches (8)**
- Find ADR Entry · HS Code · Incoterm · Airline · UN/LOCODE Location · ULD · Sea-Freight Container · Road-Freight Vehicle

Parity with `scripts/smoke-test.mjs` in the main monorepo minus `/api/health` and `/api/tools` — deliberately excluded as non-workflow operations.

## App coordinates

| | |
|---|---|
| Make zone | `eu2.make.com` |
| App name (generated) | `freightutils-gb5f0g` |
| Version | `1` (displayed as `1.0.0`) |
| Module type | Custom (SDK) app, private |
| Studio URL | <https://eu2.make.com/sdk/apps/freightutils-gb5f0g/1> |

## Install

The app is **private** — the owner (Soap) generates an invite URL from the Make Studio UI:

1. Open <https://eu2.make.com/sdk/apps/freightutils-gb5f0g/1>
2. Click **Invite** (top-right of the Studio page)
3. Copy the generated invitation link and paste to an invitee

The invitee visits the link while logged into their Make account; the app then appears in the module picker when they build a scenario.

Make does not expose invite URL generation through the SDK API at this time, so this step is UI-only — one click.

## Credentials

1. Generate a free FreightUtils API key (100 req/day) at <https://www.freightutils.com/api-docs>. Pro tier (50,000 req/month, £19) via <https://www.freightutils.com/pricing>.
2. In Make: **Scenarios → Add → FreightUtils → any module → Add connection → FreightUtils API Key**. Paste the key.
3. Make validates the key by hitting `/api/health` with `X-API-Key` — green tick means auth works end to end.

## Worked scenario A — Airtable row → chargeable weight → Airtable

1. **Airtable → Watch Records** (trigger): new row in `Incoming Bookings` table with fields `length_cm`, `width_cm`, `height_cm`, `gross_weight_kg`.
2. **FreightUtils → Calculate Chargeable Weight** (action): map the four numeric fields.
3. **Airtable → Update a Record**: write `chargeable_weight_kg` and `volumetric_weight_kg` back to the source row.

## Worked scenario B — Webhook → HS code → UK duty → Slack

1. **Webhooks → Custom webhook** (trigger) receiving `{ "sku": "...", "origin": "BR", "value_gbp": 5000 }`.
2. **FreightUtils → Find HS Code** (search): `Query = {{webhook.sku}}` — returns an iterable list of candidate HS commodity codes.
3. **FreightUtils → Calculate UK Import Duty** (action): `Commodity Code = {{hsResults[1].commodity_code}}`, `Origin Country = {{webhook.origin}}`, `Customs Value = {{webhook.value_gbp}}`.
4. **Slack → Create a Message**: `HS {{commodity_code}} · Duty £{{duty_gbp}} · VAT £{{vat_gbp}} · Total £{{total_gbp}}`.

## Rate limits

| Tier | Limit |
|------|-------|
| Anonymous | 25 req/day per IP |
| Free key | 100 req/day |
| Pro key | 50,000 req/month (£19) |

Every response includes `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers.

## Roadmap

- **v0.2.0** — Technology Partner programme application for public App Directory listing
- **v0.3.0** — Dynamic RPCs (e.g. live HS chapter dropdown, airline-prefix lookup by carrier name)
- Later — webhooks / triggers if/when FreightUtils emits events

## Repo layout

```
make-freightutils/
├── app/
│   ├── app.json              # app meta + base section
│   ├── connection.json       # apiKey connection: parameters + validation api
│   └── modules/              # 17 modules — one JSON file each, all sections inline
│       ├── cbm.json
│       ├── ldm.json
│       └── … (17 total)
├── scripts/
│   └── push.mjs              # one-shot orchestrator: create app + connection +
│                             # modules, upload all sections via @makehq/cli
├── README.md
├── LICENSE.md
└── package.json              # @makehq/cli devDependency only
```

Make's Apps SDK is API-driven (unlike Zapier's file-based model) — the authoritative app state lives in Make's registry, not in this repo. Treat the JSON files as source-of-truth definitions that the orchestrator deploys. To redeploy: `MAKE_API_KEY=... MAKE_ZONE=eu2.make.com node scripts/push.mjs` (note: will create a NEW app instance with suffix — delete the old one first, or adapt the script to update rather than create).

## Links

- FreightUtils: <https://www.freightutils.com>
- API docs: <https://www.freightutils.com/api-docs>
- Pricing: <https://www.freightutils.com/pricing>
- Siblings: [n8n-nodes-freightutils](https://www.npmjs.com/package/n8n-nodes-freightutils) · [zapier-freightutils](https://github.com/SoapyRED/zapier-freightutils)
- Repo: <https://github.com/SoapyRED/make-freightutils>
- Issues: <https://github.com/SoapyRED/make-freightutils/issues>

## Licence

MIT — see [LICENSE.md](LICENSE.md).

Built by [Marius Cristoiu](https://www.linkedin.com/in/marius-cristoiu-a853812a2/), ADR-certified freight transport planner.
