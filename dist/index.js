import fs from "fs/promises";
import path from "path";
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"];
const ROUTE_METHOD_REGEX = /\b(get|post|put|delete)\s*\(\s*[`"']([^`"']+)[`"']/gi;
const FASTIFY_ROUTE_REGEX = /\broute\s*\(\s*\{[\s\S]*?method\s*:\s*[`"'](GET|POST|PUT|DELETE)[`"'][\s\S]*?url\s*:\s*[`"']([^`"']+)[`"'][\s\S]*?\}\s*\)/gi;
const NEST_DECORATOR_REGEX = /@(Get|Post|Put|Delete)\s*\(\s*[`"']([^`"']*)[`"']?\s*\)/g;
const PARAM_JSDOC_REGEX = /@param\s+\{([^}]+)\}\s+(\w+)/g;
const RESPONSE_EXAMPLE_REGEX = /@responseExample\s+(\d{3})\s+([\s\S]*?)(?=@|\*\/)/g;
const REQUEST_SCHEMA_REGEX = /@requestBody\s+([\s\S]*?)(?=@|\*\/)/g;
const COMMENT_BLOCK_REGEX = /\/\*\*[\s\S]*?\*\//g;
function detectParameterType(raw) {
    const value = raw.toLowerCase();
    if (value.includes("string"))
        return "string";
    if (value.includes("number") || value.includes("int") || value.includes("float"))
        return "number";
    if (value.includes("boolean") || value.includes("bool"))
        return "boolean";
    if (value.includes("array"))
        return "array";
    if (value.includes("object"))
        return "object";
    return "unknown";
}
function extractDocBlock(content, index) {
    const upToIndex = content.slice(0, index);
    const matches = upToIndex.match(COMMENT_BLOCK_REGEX);
    if (!matches || matches.length === 0)
        return null;
    return matches[matches.length - 1] ?? null;
}
function parseDocBlock(block) {
    if (!block) {
        return {
            description: undefined,
            params: [],
            requestBodySchema: null,
            response: null
        };
    }
    const descriptionLines = block
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, "").trim())
        .filter((line) => line && !line.startsWith("@"));
    const description = descriptionLines.join(" ").trim() || undefined;
    const params = [];
    let match;
    while ((match = PARAM_JSDOC_REGEX.exec(block))) {
        const typeRaw = match[1] ?? "";
        const name = match[2] ?? "";
        if (!name)
            continue;
        params.push({
            name,
            type: detectParameterType(typeRaw),
            required: !typeRaw.includes("=")
        });
    }
    let response = null;
    const responseMatch = RESPONSE_EXAMPLE_REGEX.exec(block);
    if (responseMatch) {
        const status = Number(responseMatch[1]);
        const exampleRaw = responseMatch[2].trim();
        let example = exampleRaw;
        try {
            example = JSON.parse(exampleRaw);
        }
        catch {
            example = exampleRaw;
        }
        response = { status, example };
    }
    let requestBodySchema = null;
    const requestMatch = REQUEST_SCHEMA_REGEX.exec(block);
    if (requestMatch) {
        const schemaRaw = requestMatch[1].trim();
        try {
            requestBodySchema = JSON.parse(schemaRaw);
        }
        catch {
            requestBodySchema = { schema: schemaRaw };
        }
    }
    return { description, params, requestBodySchema, response };
}
function extractExpressRoutes(filePath, content) {
    const endpoints = [];
    let match;
    while ((match = ROUTE_METHOD_REGEX.exec(content))) {
        const method = match[1]?.toUpperCase();
        const routePath = match[2] ?? "";
        if (!HTTP_METHODS.includes(method) || !routePath)
            continue;
        const docBlock = extractDocBlock(content, match.index);
        const doc = parseDocBlock(docBlock);
        endpoints.push({
            method,
            path: routePath,
            description: doc.description,
            parameters: doc.params,
            requestBodySchema: doc.requestBodySchema,
            response: doc.response,
            framework: "express",
            sourceFile: filePath
        });
    }
    return endpoints;
}
function extractFastifyRoutes(filePath, content) {
    const endpoints = [];
    let match;
    while ((match = FASTIFY_ROUTE_REGEX.exec(content))) {
        const method = match[1]?.toUpperCase();
        const routePath = match[2] ?? "";
        if (!HTTP_METHODS.includes(method) || !routePath)
            continue;
        const docBlock = extractDocBlock(content, match.index);
        const doc = parseDocBlock(docBlock);
        endpoints.push({
            method,
            path: routePath,
            description: doc.description,
            parameters: doc.params,
            requestBodySchema: doc.requestBodySchema,
            response: doc.response,
            framework: "fastify",
            sourceFile: filePath
        });
    }
    return endpoints;
}
function extractNestRoutes(filePath, content) {
    const endpoints = [];
    let match;
    while ((match = NEST_DECORATOR_REGEX.exec(content))) {
        const method = match[1]?.toUpperCase();
        const routePath = match[2] ?? "";
        if (!HTTP_METHODS.includes(method))
            continue;
        const docBlock = extractDocBlock(content, match.index);
        const doc = parseDocBlock(docBlock);
        endpoints.push({
            method,
            path: routePath || "/",
            description: doc.description,
            parameters: doc.params,
            requestBodySchema: doc.requestBodySchema,
            response: doc.response,
            framework: "nestjs",
            sourceFile: filePath
        });
    }
    return endpoints;
}
export function createDefaultPlugins() {
    return [
        {
            name: "express",
            match: (_filePath, content) => /\bexpress\b|\bRouter\b/.test(content) && ROUTE_METHOD_REGEX.test(content),
            extract: extractExpressRoutes
        },
        {
            name: "fastify",
            match: (_filePath, content) => /\bfastify\b/.test(content) && FASTIFY_ROUTE_REGEX.test(content),
            extract: extractFastifyRoutes
        },
        {
            name: "nestjs",
            match: (filePath, content) => filePath.endsWith(".ts") && /@Controller\b/.test(content),
            extract: extractNestRoutes
        }
    ];
}
async function readAllFiles(rootDir) {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    const files = [];
    await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            const nested = await readAllFiles(fullPath);
            files.push(...nested);
        }
        else if (entry.isFile() && (fullPath.endsWith(".ts") || fullPath.endsWith(".js"))) {
            files.push(fullPath);
        }
    }));
    return files;
}
export async function scanBackendProject(rootDir, plugins = createDefaultPlugins()) {
    const files = await readAllFiles(rootDir);
    const endpoints = [];
    const warnings = [];
    for (const filePath of files) {
        const content = await fs.readFile(filePath, "utf8");
        const matchedPlugins = plugins.filter((plugin) => plugin.match(filePath, content));
        if (matchedPlugins.length === 0)
            continue;
        for (const plugin of matchedPlugins) {
            try {
                const extracted = plugin.extract(filePath, content);
                endpoints.push(...extracted);
            }
            catch (error) {
                warnings.push(`Failed to parse ${filePath} with ${plugin.name}`);
            }
        }
    }
    return {
        scannedAt: new Date().toISOString(),
        rootDir,
        endpoints,
        warnings
    };
}
export async function generateOutputJson(rootDir, plugins = createDefaultPlugins()) {
    const result = await scanBackendProject(rootDir, plugins);
    return JSON.stringify(result, null, 2);
}
