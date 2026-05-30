import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const outboxDir = path.join(projectRoot, "MiloTalks", "tasks", "outbox");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const key = item.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : "true";
    args[key] = value;
    if (value !== "true") {
      index += 1;
    }
  }
  return args;
}

function parseList(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
const taskId = args.taskId || "TASK-0000";
const status = args.status || "accepted";
const payload = {
  taskId,
  correlationId: args.correlationId || taskId.toLowerCase(),
  projectId: "audioreactor",
  status,
  summary: args.summary || "AudioReactor acknowledged the task.",
  details: args.details || "",
  artifacts: parseList(args.artifacts),
  blockingReasons: parseList(args.blockingReasons),
  references: parseList(args.references),
  updatedAt: new Date().toISOString(),
};

fs.mkdirSync(outboxDir, { recursive: true });
const safeStatus = status.replace(/[^a-z_]/gi, "-").toLowerCase();
const filePath = path.join(outboxDir, `${taskId.toLowerCase()}-${safeStatus}.json`);
fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(filePath);
