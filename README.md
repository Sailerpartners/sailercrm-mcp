# SailerCRM MCP

An [MCP](https://modelcontextprotocol.io) server that lets any MCP client (Claude Code, Claude Desktop, Cursor, …) connect to **SailerCRM (出海咨询)** and work with its records — submit leads, opportunities and customers, and read/update/delete customer data.

What it **can** do: create, read, update, and delete data records over a fixed whitelist of tables and columns.

What it **cannot** do:

- **Change the system itself** — no schema/DDL, no code, no new tables or columns.
- **Bulk-download** — a query returns **at most 100 records per call** (enforced by the server, not just this client).

## Resources

| Resource | Notes |
|---|---|
| `leads` | 线索池 |
| `customers` | 客户 |
| `opportunities` | 商机(含 `segment` 板块、`track` 子流程、`stage` 阶段) |
| `partners` | 合作伙伴 |
| `contacts` | 联系人 |
| `activities` | 活动时间线 |
| `customer_intelligence` | 客户情报(主键是 `customer_id`) |

Call the `list_resources` tool to get the live list of resources and their writable columns.

## Tools

| Tool | What it does |
|---|---|
| `list_resources` | List resources and their writable columns. |
| `get_schema` | Controlled vocabularies: segments, sub-tracks, funnel stages, lead/activity sources, roles. |
| `query_records` | List records with equality filters + `limit`/`offset`/`order` (max **100** rows per call). |
| `get_record` | Fetch one record by id. |
| `create_record` | Create a record (returns new id). |
| `update_record` | Update columns of a record by id. |
| `delete_record` | Hard-delete a record by id. |

## Configuration

The server reads three environment variables:

| Variable | Required | Default |
|---|---|---|
| `SAILERCRM_OPEN_API_KEY` | ✅ | — (Bearer key for the chosen CRM's Open API) |
| `SAILERCRM_BASE_URL` | ❌ | `https://sailer-crm.ai-da2.workers.dev` |
| `SAILERCRM_CRM` | ❌ | `chuhai` — which CRM on the portal: `chuhai` (出海) or `china-entry` (入华) |

The Open API is reached at `${SAILERCRM_BASE_URL}/api/${SAILERCRM_CRM}/open`. Each CRM on the portal is fully isolated — separate data and separate API keys — so connect one MCP server per CRM you need.

> **Never commit your API key.** It is passed at runtime via the environment only. This repository contains no secrets.

## Install & build

```bash
git clone https://github.com/Sailerpartners/sailercrm-mcp.git
cd sailercrm-mcp
npm install
npm run build
```

This produces `dist/index.js` (an executable stdio MCP server).

## Use with Claude Code

```bash
claude mcp add sailercrm \
  --env SAILERCRM_OPEN_API_KEY=your_key_here \
  -- node /absolute/path/to/sailercrm-mcp/dist/index.js
```

## Use with Claude Desktop / Cursor

Add to your MCP config (`claude_desktop_config.json` or the client's `mcp.json`):

```json
{
  "mcpServers": {
    "sailercrm": {
      "command": "node",
      "args": ["/absolute/path/to/sailercrm-mcp/dist/index.js"],
      "env": {
        "SAILERCRM_OPEN_API_KEY": "your_key_here"
      }
    }
  }
}
```

Restart the client. You should see the `sailercrm` tools available.

## Example prompts

- "List the SailerCRM resources and their columns."
- "Query the 10 most recent leads with status `new`."
- "Create an opportunity for customer 326: segment `ma`, track `buy`, stage `mab_dd`, title 'X 并购'."
- "Update customer 326's `flag` to `key`."

## Skill: clean & import transcripts

This repo ships a Claude Code skill, [`skills/sailercrm-intake`](skills/sailercrm-intake/SKILL.md), that drives the full workflow: drop raw meeting/call/chat transcripts into the chat → Claude cleans and classifies them into leads / opportunities / customers / partners → shows you a table to confirm → then imports (or updates existing records / changes an opportunity's stage) via these MCP tools.

Install it (with the MCP connected):

```bash
mkdir -p ~/.claude/skills
cp -r skills/sailercrm-intake ~/.claude/skills/
```

Then in Claude Code just paste or attach your notes and ask to "import these into SailerCRM".

## Security model

- Bearer auth on every request; a missing/invalid key returns `401`.
- Only whitelisted tables and columns are reachable; unknown keys are ignored server-side.
- All values are parameterized on the server — no SQL injection, no schema changes.
- Queries return **at most 100 rows per call** — enforced by the CRM server, so it holds even if a client ignores the limit.
- `delete_record` is a hard delete — use with care.

## License

MIT — see [LICENSE](LICENSE).
