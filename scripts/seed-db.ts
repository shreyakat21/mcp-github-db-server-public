import { loadConfig } from "../src/config.js";
import { getDb } from "../src/db/client.js";

const config = loadConfig();
const db = getDb(config.databasePath);

const insert = db.prepare(
  `INSERT INTO projects (name, repo_full_name, notes)
   VALUES (@name, @repoFullName, @notes)
   ON CONFLICT(name) DO NOTHING`
);

const seedProjects = [
  {
    name: "mcp-github-db-server",
    repoFullName: "your-username/mcp-github-db-server",
    notes: "This project — an MCP server bridging AI agents, GitHub, and SQLite.",
  },
];

const insertMany = db.transaction((rows: typeof seedProjects) => {
  for (const row of rows) insert.run(row);
});

insertMany(seedProjects);

console.log(`Seeded ${seedProjects.length} project row(s) into ${config.databasePath}`);
