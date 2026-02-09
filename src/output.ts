import fs from "fs/promises";
import path from "path";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type ParameterInfo = {
  name: string;
  type: string;
  required: boolean;
};

export type EndpointInfo = {
  method: HttpMethod;
  path: string;
  description?: string;
  parameters: ParameterInfo[];
  requestBodySchema?: Record<string, unknown> | null;
  response?: { status: number; example: Record<string, unknown> | string | null } | null;
  framework?: string;
  sourceFile?: string;
  line?: number;
};

export type ScanResult = {
  scannedAt?: string;
  rootDir?: string;
  endpoints: EndpointInfo[];
  warnings?: string[];
};

export type OutputWriteOptions = {
  rootDir: string;
  incremental?: boolean;
};

export type OutputWriteResult = {
  outputPath: string;
  wroteFile: boolean;
  endpointsWritten: number;
  endpointsUnchanged: number;
};

const OUTPUT_DIR = ".zeus-core";
const OUTPUT_FILE = "output.json";

function endpointKey(endpoint: EndpointInfo) {
  return `${endpoint.method} ${endpoint.path}`;
}

function normalizeForCompare(endpoint: EndpointInfo) {
  return JSON.stringify(endpoint);
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readExisting(outputPath: string): Promise<ScanResult | null> {
  try {
    const raw = await fs.readFile(outputPath, "utf8");
    return JSON.parse(raw) as ScanResult;
  } catch {
    return null;
  }
}

export async function writeOutputJson(
  data: ScanResult,
  options: OutputWriteOptions
): Promise<OutputWriteResult> {
  const outputDir = path.join(options.rootDir, OUTPUT_DIR);
  const outputPath = path.join(outputDir, OUTPUT_FILE);
  await ensureDir(outputDir);

  let endpointsWritten = data.endpoints.length;
  let endpointsUnchanged = 0;

  if (options.incremental) {
    const existing = await readExisting(outputPath);
    if (existing?.endpoints) {
      const existingMap = new Map(
        existing.endpoints.map((endpoint) => [
          endpointKey(endpoint),
          normalizeForCompare(endpoint)
        ])
      );

      const nextEndpoints: EndpointInfo[] = [];
      for (const endpoint of data.endpoints) {
        const key = endpointKey(endpoint);
        const serialized = normalizeForCompare(endpoint);
        const existingSerialized = existingMap.get(key);
        if (existingSerialized && existingSerialized === serialized) {
          endpointsUnchanged += 1;
          nextEndpoints.push(endpoint);
        } else {
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
