import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const inboxDir = path.join(projectRoot, "MiloTalks", "tasks", "inbox");

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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nextTaskNumber(rootDir) {
  ensureDir(rootDir);
  const maxNumber = fs.readdirSync(rootDir)
    .map((name) => /^task-(\d{4,})\.json$/i.exec(name))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .reduce((max, value) => Math.max(max, value), 0);
  return maxNumber + 1;
}

function parseList(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
const counter = nextTaskNumber(inboxDir);
const taskId = `TASK-${String(counter).padStart(4, "0")}`;
const correlationId = args.correlationId || taskId.toLowerCase();
const repoUrl = args.repo || "https://github.com/robvamos/butterchurn";
const branch = args.branch || "feature/audio-reactive-recorder-mvp";

const payload = {
  taskId,
  createdAt: new Date().toISOString(),
  projectId: "audioreactor",
  repo: repoUrl,
  branch,
  requestedBy: args.requestedBy || "milo",
  sourceProject: args.sourceProject || "knowledge",
  userUtterance: args.userUtterance || "Hey Milo, ask Codex to improve AudioReactor.",
  goal: args.goal || "Improve AudioReactor while keeping the current recorder and JamPal flows stable.",
  constraints: parseList(args.constraints),
  acceptanceCriteria: parseList(args.acceptanceCriteria),
  riskLevel: args.riskLevel || "medium",
  requiresConfirmation: String(args.requiresConfirmation || "false").toLowerCase() === "true",
  deliveryMode: args.deliveryMode || "summary",
  status: args.status || "draft",
  replyChannel: args.replyChannel || "MiloTalks/tasks/outbox",
  correlationId,
};

ensureDir(inboxDir);
const filePath = path.join(inboxDir, `${taskId.toLowerCase()}.json`);
fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(filePath);
