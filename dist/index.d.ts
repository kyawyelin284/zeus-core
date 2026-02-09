export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
export type ParameterType = "string" | "number" | "boolean" | "object" | "array" | "unknown";
export type ParameterInfo = {
    name: string;
    type: ParameterType;
    required: boolean;
};
export type ResponseExample = {
    status: number;
    example: Record<string, unknown> | string | null;
};
export type EndpointInfo = {
    method: HttpMethod;
    path: string;
    description?: string;
    parameters: ParameterInfo[];
    requestBodySchema?: Record<string, unknown> | null;
    response?: ResponseExample | null;
    framework: string;
    sourceFile: string;
    line?: number;
};
export type ScanResult = {
    scannedAt: string;
    rootDir: string;
    endpoints: EndpointInfo[];
    warnings: string[];
};
export type FrameworkPlugin = {
    name: string;
    match: (filePath: string, content: string) => boolean;
    extract: (filePath: string, content: string) => EndpointInfo[];
};
export declare function createDefaultPlugins(): FrameworkPlugin[];
export declare function scanBackendProject(rootDir: string, plugins?: FrameworkPlugin[]): Promise<ScanResult>;
export declare function generateOutputJson(rootDir: string, plugins?: FrameworkPlugin[]): Promise<string>;
