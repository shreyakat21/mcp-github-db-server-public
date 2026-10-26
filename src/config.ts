import path from "node:path";

export interface ServerConfig {
  githubToken: string | undefined;
  githubDefaultOwner: string | undefined;
  githubDefaultRepo: string | undefined;
  databasePath: string;
}

export function loadConfig(): ServerConfig {
  return {
    githubToken: process.env.GITHUB_TOKEN,
    githubDefaultOwner: process.env.GITHUB_DEFAULT_OWNER || undefined,
    githubDefaultRepo: process.env.GITHUB_DEFAULT_REPO || undefined,
    databasePath: path.resolve(process.env.DATABASE_PATH || "./data/app.sqlite"),
  };
}
