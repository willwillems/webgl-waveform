
import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v3.11.7/middleware.ts";

const app = new Hono();

// Middleware to set headers for SharedArrayBuffer
app.use("*", async (c, next) => {
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Embedder-Policy", "require-corp");
  await next();
});

// Serve static files from the current directory
app.use("*", serveStatic({ root: "./" }));

// Fallback route for the root path
app.get("/", (c) => c.text("Welcome to the file server!"));

Deno.serve(app.fetch)
