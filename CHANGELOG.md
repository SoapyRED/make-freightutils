# Changelog

## [0.2.2] — 2026-04-30

### Fixed

- **`shipmentSummary`: normalise `compliance.*` output when the API omits the conditional `compliance` block.** Downstream Make scenarios can now reliably map `compliance.hasDangerousGoods` (and friends) even when no UN numbers were in the input. Pre-fix: a no-DG shipment produced a response with no `compliance` field at all, which made downstream `compliance.hasDangerousGoods` references in mapping panels throw "field not present in sample" errors during scenario builds.
- IML normalisation applied at the response layer: `output` rewritten from `{{body}}` to `{{merge(body; {compliance: ifempty(body.compliance; {hasDangerousGoods: false, adrFlags: null})})}}`. Uses Make's standard `merge()` and `ifempty()` helpers — when the API response includes `compliance` it passes through unchanged; when it doesn't, the merge fills a stable default (`{hasDangerousGoods: false, adrFlags: null}`) so downstream typing stays valid.
- The `interface` schema's `compliance.*` fields are already optional — Make's interface schema treats `required` as a per-field opt-in (default false), and these fields were never marked required. No schema change needed; the IML normalisation alone is sufficient. Belt-and-braces assertion: verified by inspection of `app/modules/shipmentSummary.json:interface[3]` — no `required: true` anywhere under the `compliance` collection.

### Notes

- Single section pushed to Make: `api`. The `interface` / `expect` / `samples` sections were left untouched — `set-section` was called for `api` only.
- API readback confirms 560-byte stored payload matches local 560-byte spec character-for-character (including IML quoting of the `merge` / `ifempty` calls).
- Sample stays as captured 2026-04-29 (a 2-item DG shipment with `compliance.hasDangerousGoods: true` populated). A no-DG sample re-capture would require running the module inside a real Make scenario via UI, which is outside the SDK API surface; this is dogfood-only verification for Soap to confirm in the next session.
- App still PRIVATE (`audience: global`, `private: true` in `app/app.json` — unchanged). No Publish action triggered.
- Other 17 modules untouched. `git diff 3365b1b..HEAD --name-only` shows only `app/modules/shipmentSummary.json`, `CHANGELOG.md`, and `package.json`.

## [0.2.1] — 2026-04-30

### Fixed

- **Per-module connection wiring across all 18 modules.** Previously the app-level connection type (`freightutils-gb5f0g`, label "FreightUtils API Key", validated via `GET /api/health`) was defined but **not attached per-module**, causing the Make scenario builder to skip the API-key prompt when a user added a FreightUtils module to a scenario, and Make's runtime to send requests with no `X-API-Key` header. Discovered during dogfood Day 1 (2026-04-29). All 18 modules now attached via `sdk-modules update --connection=freightutils-gb5f0g` (CLI calls `PATCH /api/v2/sdk/apps/freightutils-gb5f0g/1/modules/<name>` under the hood).
- API readback post-fix confirms 18/18 modules report `connection: "freightutils-gb5f0g"` (was `null`).

### Notes

- No spec-file changes — `app/modules/*.json` files unchanged. The connection link is held in Make's app-state registry, not in the per-module JSON. The local spec files do carry `"connection": "apiKey"` at the top level (cosmetic / informational — `scripts/push.mjs` v0.1.0 ignored that key when calling `sdk-modules create`, which is why the wiring was missing in the first place).
- App still PRIVATE (`audience: global`, `private: true` in `app/app.json` — unchanged). No Publish action triggered.
- Follow-up: `scripts/push.mjs` should be updated to also call `sdk-modules update --connection=…` after creating each module, so future first-run pushes don't reproduce this gap. Out of scope for this patch.

## [0.2.0] — 2026-04-29

### Added

- **`shipmentSummary` module** — composite Action that wraps `POST /api/shipment/summary`, the FreightUtils endpoint chaining CBM + chargeable weight + LDM + ADR compliance + UK-duty estimation into a single call. One Make scenario step replaces what previously required 4–5 chained module calls.
  - Per-item line items via Make's `type: "array"` parameter with typed `spec` — `length`, `width`, `height`, `weight`, `quantity`, `description`, `stackable`, `pallet_type`, `hs_code`, `un_number`, `customs_value`. Users add as many entries as needed in the scenario builder.
  - Top-level shipment fields: `mode` (road / air / sea / multimodal), `origin_country`, `destination_country`, `incoterm`, `freight_cost`, `insurance_cost`.
  - Input field keys are `snake_case`, matching the canonical FreightUtils REST API and the Zapier v0.3.0 sibling. (Existing 17 modules still use `camelCase` parameter names from the v0.1.0 release; this divergence is intentional — `shipmentSummary` is the first module authored after the FreightUtils-side snake_case migration.)
  - Output interface mirrors the live response verbatim — `mode`, `itemCount`, `totals.{pieces,grossWeight,volumeCBM,chargeableWeight,billingBasis}`, `modeSpecific.*` (mode-dependent), `compliance.{hasDangerousGoods,adrFlags.{unNumbers,totalPoints,exemptionApplicable}}`, `customs.{hsCodesPresent,canEstimateUkDuty}`, plus `warnings[]` and `disclaimer`.
  - Sample data captured from a live `POST /api/shipment/summary` invocation (2-item road shipment with one DG/UN 1203 item) — same payload used in the Zapier v0.3.0 release for sample parity.

### Changed

- Module count 17 → 18 (9 actions + 8 searches + 1 composite action = 10 actions + 8 searches).

### No breaking changes

- Existing 17 module specs unmodified. Only `app/modules/shipmentSummary.json` is new.
- App still PRIVATE (`audience: global`, `private: true` in `app/app.json` — unchanged). No Publish action triggered.
- Connection (`apiKey`) unchanged.
- `app/app.json` and `app/connection.json` unchanged.

### Verified

- `/users/me` 200 with the active EU2 token.
- Pre-flight: 17 modules, no `shipmentSummary` collision.
- Live `POST /api/shipment/summary` smoke (2-item composite payload) returned 200 with the documented response shape.
- Module created via `@makehq/cli sdk-modules create` + 4× `set-section`. Post-create module list count = **18**, `shipmentSummary` present with `typeId: 4`, `archived: false`, `public: false`.
- Section readback: all 4 sections (`api`, `expect`, `interface`, `samples`) round-tripped via Make's storage layer; IML interpolations preserved verbatim.
- Make-runtime smoke (i.e. running the module inside a real Make scenario) is UI-only — Make's SDK Apps API does not expose a `/modules/{name}/test` or equivalent execute endpoint (probed: 404 across `test` / `invoke` / `execute` / `run` / `iml-test`). UI-runtime verification happens during the dogfood window using the private invite link on the Studio page.

## [0.1.0] — 2026-04-24

### Added

- Initial release — 17 modules wrapping the FreightUtils REST API. 9 Action modules (CBM, LDM, chargeable weight, consignment, pallet fitting, unit conversion, ADR LQ/EQ check, ADR 1.1.3.6 exemption, UK duty) and 8 Search modules (ADR entry, HS code, Incoterm, airline, UN/LOCODE, ULD, container, vehicle).
- App `freightutils` (auto-suffixed by Make to `freightutils-gb5f0g`), version 1, hosted on EU2 zone.
- API-key connection with single `apiKey` parameter, validated via `GET /api/health`.
- `scripts/push.mjs` first-run orchestrator using `@makehq/cli`.
- Studio: <https://eu2.make.com/sdk/apps/freightutils-gb5f0g/1>.
