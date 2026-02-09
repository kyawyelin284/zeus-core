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
    response?: {
        status: number;
        example: Record<string, unknown> | string | null;
    } | null;
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
export declare function writeOutputJson(data: ScanResult, options: OutputWriteOptions): Promise<OutputWriteResult>;
