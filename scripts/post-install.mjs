import { spawn } from "node:child_process";

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

await run("pnpm", ["db:migrate"]);
await run("pnpm", ["seed"]);
console.log("Post-install complete. Run `/narad open` or `pnpm dev` to start.");
