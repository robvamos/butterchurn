import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = process.cwd();
const requestedPage = process.argv[2] || "examples/demo.html";
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = cleanPath === "/" ? requestedPage : cleanPath.slice(1);
  const absolutePath = path.resolve(root, relativePath);

  if (!absolutePath.startsWith(root)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer((req, res) => {
  const filePath = resolveRequestPath(req.url || "/");

  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
    });
    res.end(data);
  });
});

server.listen(port, () => {
  const pageUrl = `http://localhost:${port}/${requestedPage.replace(/\\/g, "/")}`;
  console.log(`Serving ${root}`);
  console.log(pageUrl);
});
