---
name: repo-health-check
description: Use when the user asks for a "health check", "status snapshot", or "summary" of a GitHub repo that combines live GitHub data with the local database — e.g. "give me a health check on owner/repo", "snapshot this repo's open issues into the db". Builds on both github-explorer and db-assistant.
---

# Repo Health Check

A composite skill that pulls live signal from GitHub and records it locally via
`mcp-github-db-server`, so repeated checks can be compared over time.

## Workflow

1. **Gather live signal from GitHub:**
   - `github_list_issues` with `state: "open"` — note the count and any
     obviously stale or large-looking items (by title/labels).
   - `github_list_pull_requests` with `state: "open"` — note count and how many
     are drafts.
   - `github_list_directory` on the repo root — sanity-check that core files
     exist (README, LICENSE, CI config) and flag if they're missing.
2. **Record a snapshot:**
   - Ensure a row exists for this repo via `db_upsert_project`
     (`name` = repo short name, `repoFullName` = `owner/repo`).
   - If the user wants historical tracking, use `db_execute` to insert a row
     into `issues_cache` (or a table you create for this purpose) rather than
     only the `projects` table, so counts aren't overwritten each run.
3. **Compare to history (if asked):** use `db_query` against previously stored
   snapshots to show trend ("open issues went from 12 to 9 over the last
   three checks") instead of just a point-in-time number.
4. **Report:** a short summary — open issues/PRs, missing repo hygiene files,
   and (if available) the trend versus the last recorded snapshot. Link back
   to the repo and to any specific issues/PRs worth the user's attention.

## Notes

- This skill is read-mostly against GitHub (no issue/PR creation) and
  read+write against the local database. Don't call `github_create_issue`
  from this flow — that's out of scope and belongs to `github-explorer`.
- If `mcp-github-db-server` isn't connected in this session, say so and stop
  rather than guessing at repo state.
