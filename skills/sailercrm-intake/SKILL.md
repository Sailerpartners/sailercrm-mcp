---
name: sailercrm-intake
description: Turn raw meeting notes, call logs, chat/WeChat transcripts, emails, or business-card dumps into clean SailerCRM (出海咨询) records. Use whenever the user pastes or attaches unstructured contact/deal information and wants it cleaned, classified into leads / opportunities / customers / partners, confirmed, and then imported into SailerCRM — including updating existing records or changing an opportunity's stage/status. Requires the sailercrm MCP server (or the SailerCRM Open API) to be connected.
---

# SailerCRM Intake

Clean unstructured input, classify it into CRM records, **get the user's confirmation**, then write it into SailerCRM. Handles both new records and updates to existing ones (e.g. an opportunity moving to a new stage).

## Tools

Use the `sailercrm` MCP tools. If the MCP is not connected, fall back to `curl` against the Open API (`{BASE_URL}/api/open`, `Authorization: Bearer $SAILERCRM_OPEN_API_KEY`) — same shapes.

| Tool | Use |
|---|---|
| `get_schema` | **Call first.** Valid segments / sub-tracks / funnel stages / lead sources / activity sources. |
| `list_resources` | Tables and their writable columns. |
| `query_records` | Find existing records for dedup/update matching (≤100 rows/call; page with `offset`). |
| `get_record` | Read one record by id. |
| `create_record` | Insert a new record. |
| `update_record` | Patch an existing record (status/stage changes, enrichment). |

Never call `delete_record` during intake. Deletion is out of scope unless the user explicitly asks.

## The record model (what goes where)

Read `reference/data-model.md` for the full column list and every enum value. In short:

- **lead** — a raw prospect: someone we've merely made contact with (has contact info, maybe interest), but **no active deal yet**. Default landing spot for cold/new contacts from transcripts.
- **customer** — an organization we are actively working a deal with or have closed one for (`kind=customer`). An **opportunity requires a customer** (`customer_id`).
- **opportunity** — one deal in the funnel, attached to a customer. Has a `segment` (业务板块), sometimes a `track` (M&A 买方/卖方, channel 线上/线下), and a `stage` from **that segment/track's own funnel**. Money is CNY (use `currency:"USD"` only if the amount is genuinely in USD).
- **partner** — a channel/supplier/service partner, not a buying customer.
- **contact** — a person at a customer (`customer_id` + name/phone/email/wechat/title).
- **activity** — a timeline entry (meeting/call/message). Attach the source transcript here as evidence when useful (`source`, `content`, optional `occurred_at`, `opportunity_id`).
- **customer_intelligence** — durable profile of a customer (industry, revenue, headcount, decision makers, …). Its primary key is `customer_id`.

## Workflow

### 1. Clean
Read every attached/pasted file. Drop noise (pleasantries, scheduling chatter, signatures, duplicated quoted text). Keep anything of CRM value: company & person names, roles, contact handles, stated needs, budgets, timelines, deal stage signals, competitor mentions, next steps.

### 2. Classify + match against what already exists
Group the kept information into candidate records (leads / customers+opportunities / partners / contacts / activities / intelligence).

For **each** candidate, decide NEW vs UPDATE by searching the CRM first:
- `query_records` on `customers` (filter `name_cn`) and `leads` (filter `name`) by the org name; also try `external_ref` if the source has a stable id.
- If a match exists → this is an **UPDATE** (record the target `id` and only the changed fields). Common updates: opportunity moved to a new `stage`, `status` change, new activity, enriched intelligence, lead `status` change.
- If no match → **NEW**.

Assign valid values using `get_schema`: pick the right `segment`, then its `track` if it has one, then a `stage` that belongs to that segment/track. Pick a `source` from the lead-source list. Never invent keys.

### 3. Present for confirmation — **hard gate**
Show the user a compact, per-type table of everything you propose to write, **before writing anything**. For each row include: NEW/UPDATE, target resource, (for updates) the id + which fields change, and the key fields. Group by 线索 / 客户 / 商机 / 合作伙伴 / 联系人 / 活动 / 情报. See `reference/example.md` for a full worked example (raw transcript → confirmation table → writes).

Then stop and ask the user to confirm. Do not call any `create_record`/`update_record` until they explicitly approve. Let them edit the list first.

### 4. Import (only after approval)
Write in dependency order so foreign keys resolve:
1. **customers** (new) → capture each returned `id`.
2. **opportunities**, **contacts**, **customer_intelligence** (use the customer `id` from step 1 or a matched existing id).
3. **leads** (standalone).
4. **activities** (attach `customer_id` and, when relevant, `opportunity_id`).
5. **updates** — `update_record` for every UPDATE row (stage/status/enrichment).

After writing, report a short summary: N created, N updated, with their ids. If any call fails, surface the error and stop rather than half-importing silently.

## Status-change & upsert notes

- **Advance an opportunity**: `update_record` opportunities `{ stage: "<valid key for its segment/track>" }`. Optionally add an activity recording why.
- **Won / lost via Open API**: set `status:"won"` or `"lost"`. ⚠ The Open API does **not** run the app's win side-effects — if a deal is won, also set the customer's `kind:"customer"`, and if a matching lead exists set its `status:"converted"`. Do these as explicit updates and mention them in the confirmation table.
- **Lead progressing**: update the lead `status` (`reviewing`, `converted`, `discarded`). If it becomes a real deal, create the customer + opportunity (and set the lead `status:"converted"`, `customer_id`).
- **Dedup**: prefer updating an existing record over creating a duplicate. When unsure whether two names are the same org, ask the user in the confirmation step.

## Guardrails

- The confirmation gate in step 3 is mandatory — never import unconfirmed.
- Only whitelisted columns exist; unknown fields are ignored server-side (see `list_resources`).
- Queries return ≤100 rows per call — page with `offset` when scanning for matches.
- Money defaults to CNY. Keep amounts numeric.
- Never delete. Never guess enum keys — derive them from `get_schema`.
