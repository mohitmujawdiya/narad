import { config } from "dotenv";
import path from "node:path";

// Load env synchronously at setup file evaluation, BEFORE any test file
// imports server modules that read process.env at import time (e.g., db.ts).
config({ path: path.resolve(__dirname, "../.env.local"), override: true });
