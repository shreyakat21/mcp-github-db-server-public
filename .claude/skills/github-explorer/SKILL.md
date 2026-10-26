---
name: github-explorer
description: Use when the user wants to browse, search, or summarize a GitHub repository through the mcp-github-db-server MCP tools (github_list_repos, github_get_file, github_list_directory, github_search_code, github_list_issues, github_list_pull_requests) — e.g. "what's in this repo", "find where X is defined on GitHub", "summarize open issues/PRs".
---

# GitHub Explorer

Use this skill when the user wants information about a GitHub repository and the
`mcp-github-db-server` MCP tools are available in this session.

## Workflow

1. **Resolve the target repo.** If the user names `owner/repo`, use it directly.
   Otherwise call `github_list_repos` to find the right one, or rely on
   `GITHUB_DEFAULT_OWNER`/`GITHUB_DEFAULT_REPO` if the server was configured
   with defaults.
2. **Browsing a repo:**
   - Start with `github_list_directory` (empty path) to see the top-level layout.
   - Drill into subdirectories with the same tool and a `path` argument.
   - Use `github_get_file` to read a specific file's contents once you know its path.
3. **Finding code:** prefer `github_search_code` over guessing file paths when the
   user describes behavior rather than a location (e.g. "where do we handle
   retries?"). Scope the search with `owner`/`repo` to avoid noisy cross-repo
   results.
4. **Issues and PRs:** use `github_list_issues` / `github_list_pull_requests` with
   `state: "open"` by default; switch to `"all"` only if the user asks about
   history or closed items. Summarize titles and links — don't dump raw JSON
   back to the user.
5. **Creating issues:** only call `github_create_issue` after the user has
   explicitly confirmed the title/body they want filed — this is a write
   action against their GitHub account.

## Output style

Summarize findings in prose or a short list with links (`url` field from each
tool's response), rather than echoing raw tool JSON. If a tool call fails
because `GITHUB_TOKEN` is missing, tell the user to set it in `.env` rather
than retrying.
