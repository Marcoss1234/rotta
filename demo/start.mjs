// `npm run demo`: arranca el servidor de demo (club inventado, en memoria) y la web con los botones de "Entrar como".
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const venv = ["backend/.venv/Scripts/python.exe", "backend/.venv/bin/python"].map((file) => path.join(root, file)).find(existsSync);
const python = venv ?? (process.platform === "win32" ? "py" : "python3");

// Puertos propios: así la demo puede ir a la vez que la app normal (5173 y 8000).
const WEB_PORT = "5180";
const API_PORT = "8100";

const children = [];
const run = (command, args, env = {}) => {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" && command === "npx", env: { ...process.env, ...env } });
  child.on("exit", (code) => {
    if (code) console.error(`\n${command} se ha cerrado (código ${code}).`);
    stop();
  });
  children.push(child);
};

function stop() {
  children.forEach((child) => child.exitCode === null && child.kill());
  process.exit();
}
process.on("SIGINT", stop);

run(python, [path.join("demo", "demo_server.py")], { PYTHONIOENCODING: "utf-8", DEMO_API_PORT: API_PORT });
run("npx", ["vite", "--port", WEB_PORT, "--strictPort"], { VITE_DEMO: "1", API_PORT });
