import "./src/env"; // load env first
import { runMigrations } from "./src/db/migrate";
import { startCLI } from "./src/cli/prompt";

await runMigrations();
await startCLI();