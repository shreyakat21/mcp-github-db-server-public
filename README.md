# mcp-github-db-server

An [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server that
gives AI agents — Claude Code, Claude Desktop, or any other MCP client —
structured, tool-based access to **GitHub repositories** and a **local SQLite
database**, plus a set of **custom Claude Code skills** built on top of it.

Instead of an agent shelling out to `git`/`curl` or hallucinating repo
structure, it gets a small, well-typed toolset: browse a repo's file tree,
read files, search code, list/create issues and PRs, and query or update a
local database — all with Zod-validated inputs and JSON-safe outputs.

## Why this exists

Agents are most useful when they have narrow, auditable tools instead of raw
shell access. This project is a small, readable reference for that pattern:

- **One MCP server, two backends.** GitHub (via Octokit) and SQLite (via
  `better-sqlite3`) are exposed through the same tool-calling interface, so an
  agent can cross-reference "what's in this repo" with "what have I already
  recorded about it" in one conversation.
- **Claude Code skills on top.** Three skills (`github-explorer`,
  `db-assistant`, `repo-health-check`) show how to turn a raw toolset into
  guided workflows — when to call which tool, how to summarize results, and
  where to stop and ask before taking a write action.

## Architecture

```
                 ┌─────────────────────────┐
  Claude Code /  │   MCP Client (stdio)     │
  Claude Desktop ├─────────────────────────┤
                 │  Claude Code Skills      │
                 │  • github-explorer       │
                 │  • db-assistant          │
                 │  • repo-health-check     │
                 └───────────┬─────────────┘
                             │ MCP (tools/list, tools/call)
                 ┌───────────▼─────────────┐
                 │   mcp-github-db-server   │
                 │  ┌─────────┐ ┌─────────┐ │
                 │  │ github  │ │database │ │
                 │  │ tools   │ │ tools   │ │
                 │  └────┬────┘ └────┬────┘ │
                 └───────┼───────────┼──────┘
                         │           │
                  ┌──────▼───┐  ┌────▼──────┐
                  │ GitHub   │  │  SQLite   │
                  │ REST API │  │  (local)  │
                  └──────────┘  └───────────┘
```

## Tools

### GitHub (`src/tools/github.ts`)

| Tool | Description |
| --- | --- |
| `github_list_repos` | List repos visible to the authenticated token |
| `github_get_file` | Read a file's contents at a given ref |
| `github_list_directory` | List entries at a path (directory listing) |
| `github_search_code` | Search code via GitHub's code search |
| `github_list_issues` | List issues, filtered by state |
| `github_create_issue` | Create a new issue |
| `github_list_pull_requests` | List pull requests, filtered by state |

### Database (`src/tools/database.ts`)

| Tool | Description |
| --- | --- |
| `db_list_tables` | List tables in the local SQLite database |
| `db_describe_table` | Show a table's columns/types |
| `db_query` | Run a read-only `SELECT`/`WITH`/`EXPLAIN` query |
| `db_execute` | Run a write statement (`INSERT`/`UPDATE`/`DELETE`/DDL) |
| `db_upsert_project` | Idempotent insert/update into the `projects` table |

`db_query` and `db_execute` are intentionally split so a client can offer
"read-only mode" by only ever calling the former.

## Claude Code skills (`.claude/skills/`)

- **`github-explorer`** — browsing, searching, and summarizing a GitHub repo.
- **`db-assistant`** — querying and safely writing to the local database.
- **`repo-health-check`** — a composite workflow that pulls live GitHub signal
  (open issues/PRs, missing hygiene files) and snapshots it into the database
  so repeat checks can show a trend over time.

Each `SKILL.md` documents *when* to use which tool, not just what the tool
does — e.g. preferring `github_search_code` over guessing file paths, or
narrating a `DELETE` before running it.

## Setup

```bash
git clone https://github.com/<your-username>/mcp-github-db-server.git
cd mcp-github-db-server
npm install
cp .env.example .env   # then fill in GITHUB_TOKEN
npm run build
```

`GITHUB_TOKEN` needs `repo` scope (classic PAT) or equivalent fine-grained
read/write access to whichever repositories you want the agent to touch.
`GITHUB_DEFAULT_OWNER` / `GITHUB_DEFAULT_REPO` are optional — set them to
avoid passing `owner`/`repo` on every call.

### Running standalone

```bash
npm start
```

The server speaks MCP over stdio and logs a one-line startup message to
stderr (stdout is reserved for the protocol).

### Connecting to Claude Code / Claude Desktop

Copy `.mcp.json.example` to `.mcp.json` (project-scoped) or merge it into your
global Claude Desktop config, filling in your token:

```json
{
  "mcpServers": {
    "github-db": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "DATABASE_PATH": "./data/app.sqlite"
      }
    }
  }
}
```

The `.claude/skills/` directory in this repo is picked up automatically by
Claude Code when you open this folder as a project, so the three skills above
become available alongside the MCP tools.

### Seeding the database

```bash
npm run db:seed
```

Creates `data/app.sqlite` (if it doesn't exist) and inserts a starter row into
the `projects` table.

## Development

```bash
npm run dev         # run the server directly with tsx (no build step)
npm run typecheck   # tsc --noEmit
```

## Security notes

- `db_query` rejects anything that isn't `SELECT`/`WITH`/`EXPLAIN`; writes must
  go through `db_execute`.
- All table/column identifiers used in dynamic SQL are validated against
  `^[A-Za-z_][A-Za-z0-9_]*$` before being interpolated — user-supplied values
  always go through parameterized placeholders instead.
- `GITHUB_TOKEN` is read from the environment only; it's never logged or
  echoed back through a tool response.
- `.env` and the SQLite data directory are git-ignored by default.

## License

MIT — see [LICENSE](LICENSE).
