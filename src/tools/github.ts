import { Octokit } from "@octokit/rest";
import { z } from "zod";
import type { ServerConfig } from "../config.js";
import { defineTool, type ToolDefinition } from "./types.js";

function resolveOwnerRepo(
  config: ServerConfig,
  owner?: string,
  repo?: string
): { owner: string; repo: string } {
  const resolvedOwner = owner || config.githubDefaultOwner;
  const resolvedRepo = repo || config.githubDefaultRepo;
  if (!resolvedOwner || !resolvedRepo) {
    throw new Error(
      "owner/repo not provided and no GITHUB_DEFAULT_OWNER/GITHUB_DEFAULT_REPO configured"
    );
  }
  return { owner: resolvedOwner, repo: resolvedRepo };
}

export function createGithubTools(config: ServerConfig): ToolDefinition[] {
  const getClient = () => {
    if (!config.githubToken) {
      throw new Error("GITHUB_TOKEN is not set. Add it to your .env file.");
    }
    return new Octokit({ auth: config.githubToken });
  };

  return [
    defineTool({
      name: "github_list_repos",
      description:
        "List repositories visible to the authenticated GitHub token (own repos, plus any orgs the token can see).",
      inputSchema: z.object({
        type: z
          .enum(["all", "owner", "member"])
          .default("owner")
          .describe("Which repos to return, mirroring the GitHub API's `type` filter."),
        perPage: z.number().int().min(1).max(100).default(30),
      }),
      handler: async ({ type, perPage }) => {
        const octokit = getClient();
        const { data } = await octokit.repos.listForAuthenticatedUser({
          type,
          per_page: perPage,
          sort: "updated",
        });
        return data.map((r) => ({
          fullName: r.full_name,
          private: r.private,
          description: r.description,
          defaultBranch: r.default_branch,
          updatedAt: r.updated_at,
          url: r.html_url,
        }));
      },
    }),

    defineTool({
      name: "github_get_file",
      description: "Read a file's contents from a GitHub repository at a given ref.",
      inputSchema: z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        path: z.string().describe("Path to the file within the repo, e.g. src/index.ts"),
        ref: z.string().optional().describe("Branch, tag, or commit SHA. Defaults to the default branch."),
      }),
      handler: async ({ owner, repo, path, ref }) => {
        const octokit = getClient();
        const resolved = resolveOwnerRepo(config, owner, repo);
        const { data } = await octokit.repos.getContent({ ...resolved, path, ref });
        if (Array.isArray(data) || data.type !== "file") {
          throw new Error(`${path} is not a file (it's a directory or submodule).`);
        }
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return { path, sha: data.sha, size: data.size, content };
      },
    }),

    defineTool({
      name: "github_list_directory",
      description: "List files and subdirectories at a given path in a GitHub repository.",
      inputSchema: z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        path: z.string().default("").describe("Directory path. Empty string for repo root."),
        ref: z.string().optional(),
      }),
      handler: async ({ owner, repo, path, ref }) => {
        const octokit = getClient();
        const resolved = resolveOwnerRepo(config, owner, repo);
        const { data } = await octokit.repos.getContent({ ...resolved, path, ref });
        if (!Array.isArray(data)) {
          throw new Error(`${path} is a file, not a directory.`);
        }
        return data.map((entry) => ({
          name: entry.name,
          path: entry.path,
          type: entry.type,
          size: entry.size,
        }));
      },
    }),

    defineTool({
      name: "github_search_code",
      description: "Search code across GitHub (or scoped to one repo) using GitHub's code search syntax.",
      inputSchema: z.object({
        query: z.string().describe("Search query, e.g. 'useEffect repo:owner/repo language:typescript'"),
        owner: z.string().optional(),
        repo: z.string().optional(),
        perPage: z.number().int().min(1).max(50).default(10),
      }),
      handler: async ({ query, owner, repo, perPage }) => {
        const octokit = getClient();
        let q = query;
        if (owner && repo) {
          q = `${q} repo:${owner}/${repo}`;
        }
        const { data } = await octokit.search.code({ q, per_page: perPage });
        return {
          totalCount: data.total_count,
          items: data.items.map((item) => ({
            path: item.path,
            repository: item.repository.full_name,
            url: item.html_url,
          })),
        };
      },
    }),

    defineTool({
      name: "github_list_issues",
      description: "List issues for a repository, optionally filtered by state.",
      inputSchema: z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        state: z.enum(["open", "closed", "all"]).default("open"),
        perPage: z.number().int().min(1).max(100).default(30),
      }),
      handler: async ({ owner, repo, state, perPage }) => {
        const octokit = getClient();
        const resolved = resolveOwnerRepo(config, owner, repo);
        const { data } = await octokit.issues.listForRepo({
          ...resolved,
          state,
          per_page: perPage,
        });
        return data
          .filter((issue) => !issue.pull_request)
          .map((issue) => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
            url: issue.html_url,
          }));
      },
    }),

    defineTool({
      name: "github_create_issue",
      description: "Create a new issue in a GitHub repository.",
      inputSchema: z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        title: z.string(),
        body: z.string().optional(),
        labels: z.array(z.string()).optional(),
      }),
      handler: async ({ owner, repo, title, body, labels }) => {
        const octokit = getClient();
        const resolved = resolveOwnerRepo(config, owner, repo);
        const { data } = await octokit.issues.create({
          ...resolved,
          title,
          body,
          labels,
        });
        return { number: data.number, url: data.html_url };
      },
    }),

    defineTool({
      name: "github_list_pull_requests",
      description: "List pull requests for a repository, optionally filtered by state.",
      inputSchema: z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        state: z.enum(["open", "closed", "all"]).default("open"),
        perPage: z.number().int().min(1).max(100).default(30),
      }),
      handler: async ({ owner, repo, state, perPage }) => {
        const octokit = getClient();
        const resolved = resolveOwnerRepo(config, owner, repo);
        const { data } = await octokit.pulls.list({
          ...resolved,
          state,
          per_page: perPage,
        });
        return data.map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          draft: pr.draft,
          headRef: pr.head.ref,
          baseRef: pr.base.ref,
          url: pr.html_url,
        }));
      },
    }),
  ];
}
