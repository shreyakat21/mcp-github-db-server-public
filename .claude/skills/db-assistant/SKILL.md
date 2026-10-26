---
name: db-assistant
description: Use when the user wants to inspect or modify the local SQLite database through the mcp-github-db-server MCP tools (db_list_tables, db_describe_table, db_query, db_execute, db_upsert_project) — e.g. "what's in the database", "show me the projects table", "add a row for X".
---

# Database Assistant

Use this skill when the user wants to read or write the local SQLite database
exposed by `mcp-github-db-server`.

## Workflow

1. **Orient first.** If you haven't seen the schema yet this session, call
   `db_list_tables` then `db_describe_table` for any table you're about to
   query, instead of guessing column names.
2. **Reads vs writes.**
   - Use `db_query` for anything read-only (`SELECT`/`WITH`/`EXPLAIN`). It
     rejects write statements by design — don't try to route writes through it.
   - Use `db_execute` for `INSERT`/`UPDATE`/`DELETE`/`CREATE TABLE`. Narrate
     what the statement will change before running it if it's destructive
     (`DELETE`, `DROP`, unscoped `UPDATE`).
   - Prefer `db_upsert_project` over hand-written SQL when the user just wants
     to record/update a project entry by name — it's idempotent and avoids
     constraint errors.
3. **Parameterize.** Always pass user-provided values via the `params` array
   rather than string-interpolating them into `sql` — both `db_query` and
   `db_execute` accept positional `?` placeholders.
4. **Large results.** `db_query` caps rows at `limit` (default 200, max 1000).
   If the user needs more, say so explicitly rather than silently truncating
   without comment.

## Output style

Render query results as a markdown table or concise bullet list, not raw JSON,
unless the user is clearly debugging and wants the raw shape.
