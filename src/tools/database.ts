import { z } from "zod";
import type { ServerConfig } from "../config.js";
import { describeTable, getDb, isReadOnlyQuery, listTables, quoteIdent } from "../db/client.js";
import { defineTool, type ToolDefinition } from "./types.js";

export function createDatabaseTools(config: ServerConfig): ToolDefinition[] {
  const db = () => getDb(config.databasePath);

  return [
    defineTool({
      name: "db_list_tables",
      description: "List all tables in the local SQLite database.",
      inputSchema: z.object({}),
      handler: async () => listTables(db()),
    }),

    defineTool({
      name: "db_describe_table",
      description: "Show column names, types, and constraints for a table.",
      inputSchema: z.object({
        table: z.string(),
      }),
      handler: async ({ table }) => {
        const database = db();
        if (!listTables(database).includes(table)) {
          throw new Error(`Unknown table: ${table}`);
        }
        return describeTable(database, table);
      },
    }),

    defineTool({
      name: "db_query",
      description:
        "Run a read-only SQL query (SELECT/WITH/EXPLAIN only) against the local database and return the rows.",
      inputSchema: z.object({
        sql: z.string(),
        params: z.array(z.union([z.string(), z.number(), z.null()])).optional(),
        limit: z.number().int().min(1).max(1000).default(200),
      }),
      handler: async ({ sql, params, limit }) => {
        if (!isReadOnlyQuery(sql)) {
          throw new Error(
            "db_query only accepts read-only statements (SELECT/WITH/EXPLAIN). Use db_execute for writes."
          );
        }
        const database = db();
        const stmt = database.prepare(sql);
        const rows = stmt.all(...(params ?? []));
        return Array.isArray(rows) ? rows.slice(0, limit) : rows;
      },
    }),

    defineTool({
      name: "db_execute",
      description:
        "Run a write statement (INSERT/UPDATE/DELETE/CREATE TABLE) against the local database. Returns affected row count.",
      inputSchema: z.object({
        sql: z.string(),
        params: z.array(z.union([z.string(), z.number(), z.null()])).optional(),
      }),
      handler: async ({ sql, params }) => {
        if (isReadOnlyQuery(sql)) {
          throw new Error("db_execute is for writes; use db_query for SELECT statements.");
        }
        const database = db();
        const result = database.prepare(sql).run(...(params ?? []));
        return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
      },
    }),

    defineTool({
      name: "db_upsert_project",
      description:
        "Convenience helper: insert or update a row in the `projects` table by unique project name.",
      inputSchema: z.object({
        name: z.string(),
        repoFullName: z.string().optional(),
        notes: z.string().optional(),
      }),
      handler: async ({ name, repoFullName, notes }) => {
        const database = db();
        const result = database
          .prepare(
            `INSERT INTO projects (name, repo_full_name, notes)
             VALUES (@name, @repoFullName, @notes)
             ON CONFLICT(name) DO UPDATE SET
               repo_full_name = excluded.repo_full_name,
               notes = excluded.notes`
          )
          .run({ name, repoFullName: repoFullName ?? null, notes: notes ?? null });
        return { changes: result.changes };
      },
    }),
  ];
}

// Exported for tooling/tests that want to validate identifiers independently.
export { quoteIdent };
