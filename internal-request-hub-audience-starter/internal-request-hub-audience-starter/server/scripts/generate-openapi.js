// Builds docs/openapi.json from the @openapi JSDoc blocks in src/app.js.
// Build-time only: the running server never imports swagger-jsdoc.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = path.resolve(serverDir, "../docs/openapi.json");
const packageJson = JSON.parse(fs.readFileSync(path.join(serverDir, "package.json"), "utf8"));

const spec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Internal Request Hub API",
      version: packageJson.version ?? "0.0.0",
      description: "Generated from the @openapi annotations in server/src/app.js. Do not edit by hand; run `npm run docs:openapi` in server/.",
    },
  },
  apis: [path.join(serverDir, "src/app.js")],
  failOnErrors: true,
});

if (!spec.paths || Object.keys(spec.paths).length === 0) {
  throw new Error("No @openapi paths found in src/app.js.");
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote ${path.relative(process.cwd(), outputFile)} (${Object.keys(spec.paths).length} paths)`);
