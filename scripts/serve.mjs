import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fromRoot } from "./lib.mjs";

const directory = fromRoot("dist");
const port = Number(process.env.PORT ?? "4173");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");
const types = {
  ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json",
  ".md": "text/markdown; charset=utf-8", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }
  let path;
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname.includes("\0") || pathname.includes("\\")) throw new Error("Invalid path");
    path = resolve(directory, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (path !== directory && !path.startsWith(`${directory}${sep}`)) throw new Error("Path outside site");
  } catch {
    response.writeHead(400);
    response.end("Invalid request path");
    return;
  }
  try {
    const info = await stat(path);
    if (!info.isFile()) throw Object.assign(new Error("Not a file"), { code: "ENOENT" });
    const body = await readFile(path);
    response.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") console.error("Site request failed:", error.message);
    response.writeHead(error.code === "ENOENT" || error.code === "ENOTDIR" ? 404 : 500);
    response.end(error.code === "ENOENT" || error.code === "ENOTDIR" ? "Not found" : "Request failed");
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Runway ready at http://127.0.0.1:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
