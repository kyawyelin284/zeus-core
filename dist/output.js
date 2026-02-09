import fs from "fs/promises";
import path from "path";
const OUTPUT_DIR = ".zeus-core";
const OUTPUT_FILE = "output.json";
function endpointKey(endpoint) {
    return `${endpoint.method} ${endpoint.path}`;
}
function normalizeForCompare(endpoint) {
    return JSON.stringify(endpoint);
}
async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
async function readExisting(outputPath) {
    try {
        const raw = await fs.readFile(outputPath, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function writeOutputJson(data, options) {
    const outputDir = path.join(options.rootDir, OUTPUT_DIR);
    const outputPath = path.join(outputDir, OUTPUT_FILE);
    await ensureDir(outputDir);
    let endpointsWritten = data.endpoints.length;
    let endpointsUnchanged = 0;
    if (options.incremental) {
        const existing = await readExisting(outputPath);
        if (existing?.endpoints) {
            const existingMap = new Map(existing.endpoints.map((endpoint) => [
                endpointKey(endpoint),
                normalizeForCompare(endpoint)
            ]));
            const nextEndpoints = [];
            for (const endpoint of data.endpoints) {
                const key = endpointKey(endpoint);
                const serialized = normalizeForCompare(endpoint);
                const existingSerialized = existingMap.get(key);
                if (existingSerialized && existingSerialized === serialized) {
                    endpointsUnchanged += 1;
                    nextEndpoints.push(endpoint);
                }
                else {
                    nextEndpoints.push(endpoint);
                }
            }
            data = {
                ...data,
                endpoints: nextEndpoints
            };
            endpointsWritten = nextEndpoints.length;
        }
    }
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), "utf8");
    return {
        outputPath,
        wroteFile: true,
        endpointsWritten,
        endpointsUnchanged
    };
}
