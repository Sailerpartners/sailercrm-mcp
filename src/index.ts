#!/usr/bin/env node
/**
 * SailerCRM MCP server
 *
 * Wraps the SailerCRM (出海咨询) Open API as Model Context Protocol tools.
 * The Open API is CRUD-only over a whitelist of data records — it cannot alter
 * table structure (no DDL). This server simply forwards MCP tool calls to it.
 *
 * Configuration (environment variables):
 *   SAILERCRM_OPEN_API_KEY   (required)  Bearer key for the Open API.
 *   SAILERCRM_BASE_URL       (optional)  CRM base URL.
 *                                        Default: https://sailer-crm.ai-da2.workers.dev
 *
 * The Open API lives at `${SAILERCRM_BASE_URL}/api/open`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.SAILERCRM_BASE_URL || "https://sailer-crm.ai-da2.workers.dev").replace(/\/+$/, "");
const KEY = process.env.SAILERCRM_OPEN_API_KEY || "";
const OPEN = `${BASE}/api/open`;

// Resource whitelist — must mirror the CRM Open API. Server-side is the source
// of truth; listed here only to constrain tool input and give better errors.
const RESOURCES = [
  "leads",
  "customers",
  "opportunities",
  "partners",
  "contacts",
  "activities",
  "customer_intelligence",
] as const;
const ResourceEnum = z.enum(RESOURCES);

type CallOpts = { query?: Record<string, unknown>; body?: unknown };

async function callApi(method: string, path: string, opts: CallOpts = {}): Promise<unknown> {
  if (!KEY) throw new Error("SAILERCRM_OPEN_API_KEY is not set in the environment.");
  const url = new URL(OPEN + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${detail}`);
  }
  return data;
}

const ok = (d: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(d, null, 2) }] });
const fail = (e: unknown) => ({
  content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

const server = new McpServer({ name: "sailercrm-mcp", version: "0.1.0" });

server.registerTool(
  "list_resources",
  {
    title: "List resources",
    description:
      "List the available SailerCRM data resources (tables) and their writable columns. " +
      "Call this first to learn what you can query and write. Read-only; cannot change structure.",
    inputSchema: {},
  },
  async () => {
    try {
      return ok(await callApi("GET", "/"));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "query_records",
  {
    title: "Query records",
    description:
      "List records from a resource with optional equality filters and pagination. " +
      "filters keys must be valid columns (see list_resources); each is matched exactly (col = value). " +
      "A maximum of 100 records is returned per call (server-enforced); use offset to page through more.",
    inputSchema: {
      resource: ResourceEnum,
      filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
        .describe("Equality filters, e.g. { status: 'new', region: 'US' }."),
      limit: z.number().int().min(1).max(100).optional().describe("Max rows, hard-capped at 100 (default 100)."),
      offset: z.number().int().min(0).optional().describe("Rows to skip for pagination (default 0)."),
      order: z.enum(["asc", "desc"]).optional().describe("Order by primary key (default desc)."),
    },
  },
  async ({ resource, filters, limit, offset, order }) => {
    try {
      return ok(await callApi("GET", `/${resource}`, { query: { ...(filters ?? {}), limit, offset, order } }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "get_record",
  {
    title: "Get record",
    description:
      "Fetch a single record by id. Note: for customer_intelligence the id is the customer_id (its primary key).",
    inputSchema: {
      resource: ResourceEnum,
      id: z.union([z.string(), z.number()]).describe("Primary key value."),
    },
  },
  async ({ resource, id }) => {
    try {
      return ok(await callApi("GET", `/${resource}/${encodeURIComponent(String(id))}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "create_record",
  {
    title: "Create record",
    description:
      "Create a new record. Only whitelisted columns are accepted; unknown keys are ignored server-side. " +
      "Returns the new row id.",
    inputSchema: {
      resource: ResourceEnum,
      fields: z.record(z.string(), z.any()).describe("Column → value map. Objects are JSON-stringified."),
    },
  },
  async ({ resource, fields }) => {
    try {
      return ok(await callApi("POST", `/${resource}`, { body: fields }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "update_record",
  {
    title: "Update record",
    description:
      "Update columns of an existing record by id. Only whitelisted columns are applied. " +
      "For customer_intelligence the id is the customer_id.",
    inputSchema: {
      resource: ResourceEnum,
      id: z.union([z.string(), z.number()]).describe("Primary key value."),
      fields: z.record(z.string(), z.any()).describe("Column → new value map."),
    },
  },
  async ({ resource, id, fields }) => {
    try {
      return ok(await callApi("PATCH", `/${resource}/${encodeURIComponent(String(id))}`, { body: fields }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "delete_record",
  {
    title: "Delete record",
    description:
      "Delete a record by id. This is a hard delete via the Open API — use with care. " +
      "Returns the number of rows changed.",
    inputSchema: {
      resource: ResourceEnum,
      id: z.union([z.string(), z.number()]).describe("Primary key value."),
    },
  },
  async ({ resource, id }) => {
    try {
      return ok(await callApi("DELETE", `/${resource}/${encodeURIComponent(String(id))}`));
    } catch (e) {
      return fail(e);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe for logging (stdout is the MCP channel).
  console.error(`sailercrm-mcp connected — Open API at ${OPEN}${KEY ? "" : "  [WARNING: SAILERCRM_OPEN_API_KEY not set]"}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
