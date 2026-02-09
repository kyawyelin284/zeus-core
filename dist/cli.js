#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { Command } from "commander";
import express from "express";
import { scanBackendProject } from "./index";
import { writeOutputJson } from "./output";
const DEFAULT_CONFIG = {
    rootDir: process.cwd(),
    outputFile: ".zeus-core/output.json",
    incremental: true,
    servePort: 4173
};
const CONFIG_FILE = ".zeus-core/config.json";
function logInfo(message) {
    // eslint-disable-next-line no-console
    console.log(`[zeus-core] ${message}`);
}
function logError(message) {
    // eslint-disable-next-line no-console
    console.error(`[zeus-core] ${message}`);
}
async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
async function writeConfig(config) {
    const configDir = path.dirname(CONFIG_FILE);
    await ensureDir(configDir);
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}
async function readConfig() {
    try {
        const raw = await fs.readFile(CONFIG_FILE, "utf8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
}
async function initCommand(rootDir) {
    const targetRoot = rootDir ? path.resolve(rootDir) : process.cwd();
    const config = {
        ...DEFAULT_CONFIG,
        rootDir: targetRoot
    };
    await ensureDir(path.join(targetRoot, ".zeus-core"));
    await writeConfig(config);
    logInfo(`Initialized in ${targetRoot}`);
    logInfo(`Config written to ${CONFIG_FILE}`);
}
async function generateCommand(options) {
    const config = await readConfig();
    const rootDir = options.root ? path.resolve(options.root) : config.rootDir;
    const incremental = options.incremental ?? config.incremental;
    logInfo(`Scanning ${rootDir}...`);
    const result = await scanBackendProject(rootDir);
    const writeResult = await writeOutputJson(result, {
        rootDir,
        incremental
    });
    logInfo(`Generated ${writeResult.endpointsWritten} endpoints (unchanged: ${writeResult.endpointsUnchanged})`);
    logInfo(`Output written to ${writeResult.outputPath}`);
    if (result.warnings.length > 0) {
        logInfo(`Warnings: ${result.warnings.length}`);
        result.warnings.forEach((warning) => logInfo(`- ${warning}`));
    }
}
async function serveCommand(options) {
    const config = await readConfig();
    const rootDir = options.root ? path.resolve(options.root) : config.rootDir;
    const port = options.port ?? config.servePort;
    const app = express();
    const outputPath = path.join(rootDir, ".zeus-core", "output.json");
    app.get("/output.json", async (_req, res) => {
        try {
            const raw = await fs.readFile(outputPath, "utf8");
            res.type("application/json").send(raw);
        }
        catch {
            res.status(404).json({ error: "output.json not found" });
        }
    });
    app.listen(port, () => {
        logInfo(`Serving ${outputPath}`);
        logInfo(`http://localhost:${port}/output.json`);
    });
}
async function main() {
    const program = new Command();
    program
        .name("zeus-core")
        .description("Zeus Core CLI")
        .version("0.1.0");
    program
        .command("init")
        .description("Initialize zeus-core in a backend project")
        .option("-r, --root <path>", "Project root directory")
        .action(async (options) => {
        try {
            await initCommand(options.root);
        }
        catch (error) {
            logError(error instanceof Error ? error.message : "Init failed");
            process.exit(1);
        }
    });
    program
        .command("generate")
        .description("Generate .zeus-core/output.json from backend project")
        .option("-r, --root <path>", "Project root directory")
        .option("--incremental", "Incremental update", false)
        .action(async (options) => {
        try {
            await generateCommand({ root: options.root, incremental: options.incremental });
        }
        catch (error) {
            logError(error instanceof Error ? error.message : "Generate failed");
            process.exit(1);
        }
    });
    program
        .command("serve")
        .description("Serve generated docs (output.json)")
        .option("-r, --root <path>", "Project root directory")
        .option("-p, --port <number>", "Port", (value) => Number(value))
        .action(async (options) => {
        try {
            await serveCommand({ root: options.root, port: options.port });
        }
        catch (error) {
            logError(error instanceof Error ? error.message : "Serve failed");
            process.exit(1);
        }
    });
    await program.parseAsync(process.argv);
}
void main();
