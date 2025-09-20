import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { connectToZooKeeper, ZkClient, ZookeeperOptions } from "./zk.js";
import { registerPrompts } from "./prompt.js";
import { registerResources } from "./resource.js";
import { registerTools } from "./tool.js";
import { runHttpServer, HttpServerOptions } from "./http.js";

interface ServerOptions extends ZookeeperOptions {
    name?: string;
    version?: string;
}

/**
 * MCP ZooKeeper Server that provides tools and resources for interacting with ZooKeeper.
 */
export class Server extends McpServer {
    readonly client: ZkClient;

    /**
     * Creates a new MCP ZooKeeper Server instance.
     *
     * @param connStr - The ZooKeeper connection string
     * @param opts - Optional ZooKeeper client configuration
     */
    constructor(connStr: string, opts?: ServerOptions) {
        super({
            name: opts?.name ?? "zookeeper",
            version: opts?.version ?? "0.1.0",
            capabilities: {
                resources: {},
                tools: {},
            },
        });

        this.client = connectToZooKeeper(connStr, opts);

        // Register all MCP capabilities
        registerResources(this.client, this);
        registerTools(this.client, this);
        registerPrompts(this.client, this);
    }

    /**
     * Starts the server using stdio transport.
     */
    async serveStdio(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.connect(transport);
        console.error("MCP ZooKeeper Server running on stdio");
    }

    /**
     * Starts the server using HTTP transport.
     *
     * @param options - HTTP server configuration options
     */
    async serveHttp(options: HttpServerOptions): Promise<void> {
        runHttpServer(this, options);
    }
}
