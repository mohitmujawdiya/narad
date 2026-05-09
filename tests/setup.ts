import { afterEach, beforeAll } from "vitest";
import { config } from "dotenv";
import path from "node:path";

beforeAll(() => {
  config({ path: path.resolve(__dirname, "../.env.local") });
});

afterEach(() => {
  // cleanup hooks per-test if needed
});
