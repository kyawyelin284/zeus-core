# zeus-core

CLI to scan backend projects (Express/Fastify/NestJS) and generate API endpoint metadata.

**Overview**
`zeus-core` crawls a backend codebase, detects routes, and emits a structured JSON file at `.zeus-core/output.json`. It supports JSDoc-style annotations to enrich endpoints with descriptions, parameters, request body schemas, and response examples. It also includes a tiny server to serve the generated JSON.

**Features**
- Scans Express, Fastify, and NestJS routes.
- Extracts HTTP method and path from source code.
- Reads JSDoc tags for descriptions, params, request body schema, and response examples.
- Writes a single JSON artifact for downstream tools.
- Optional incremental generation to avoid unnecessary churn.
- Local server to expose `output.json` for tooling.

**Install**
```bash
npm install -g zeus-core
```

**Quick Start**
```bash
zeus-core init
zeus-core generate
zeus-core serve
```

**CLI**
```bash
zeus-core init --root <path>
zeus-core generate --root <path> --incremental
zeus-core serve --root <path> --port 4173
```

**Config**
`zeus-core init` writes `.zeus-core/config.json` in the target project. You can edit it directly.

Default config:
```json
{
  "rootDir": ".",
  "outputFile": ".zeus-core/output.json",
  "incremental": true,
  "servePort": 4173
}
```

**JSDoc Tags**
Add JSDoc blocks immediately above route definitions.

Supported tags:
- `@param {type} name`
- `@requestBody { ... }` (JSON or text)
- `@responseExample 200 { ... }` (JSON or text)

Example (Express):
```ts
/**
 * List users
 * @param {string} status
 * @responseExample 200 {"users":[{"id":1,"name":"Ada"}]}
 */
app.get("/users", (req, res) => {
  res.json({ users: [{ id: 1, name: "Ada" }] });
});
```

Example (Fastify):
```ts
/**
 * Create user
 * @requestBody {"name":"string"}
 * @responseExample 201 {"id":1,"name":"Ada"}
 */
fastify.route({
  method: "POST",
  url: "/users",
  handler: async (req, res) => res.send({ id: 1, name: "Ada" })
});
```

Example (NestJS):
```ts
@Controller("users")
export class UsersController {
  /**
   * Get user
   * @param {number} id
   */
  @Get(":id")
  getUser() {}
}
```

**Output Format**
Output is written to `.zeus-core/output.json`.

Example:
```json
{
  "scannedAt": "2026-02-09T00:00:00.000Z",
  "rootDir": "/path/to/project",
  "endpoints": [
    {
      "method": "GET",
      "path": "/users",
      "description": "List users",
      "parameters": [
        { "name": "status", "type": "string", "required": true }
      ],
      "requestBodySchema": null,
      "response": { "status": 200, "example": {"users":[]} },
      "framework": "express",
      "sourceFile": "/path/to/project/src/users.ts"
    }
  ],
  "warnings": []
}
```

**Programmatic API**
```ts
import { scanBackendProject, generateOutputJson } from "zeus-core";

const result = await scanBackendProject(process.cwd());
const json = await generateOutputJson(process.cwd());
```

**Development**
```bash
npm install
npm run build
```

**License**
MIT
