import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "node-zookeeper-client";

import { runHttpServer, HttpServerOptions } from "./http.js";
import { connectToZooKeeper, ZookeeperOptions } from "./zk.js";
import { registerResources } from "./resource.js";

export class Server extends McpServer {
    readonly client: Client;

    constructor(connStr: string, opts?: ZookeeperOptions) {
        super({
            name: "zookeeper",
            version: "0.1.0",
            capabilities: {
                resources: {},
                tools: {},
            },
        });

        this.client = connectToZooKeeper(connStr, opts);

        registerResources(this.client, this);
    }

    async serveStdio() {
        const transport = new StdioServerTransport();

        await this.connect(transport);

        console.error("MCP Zookeeper Server running on stdio");
    }

    async serveHttp(options: HttpServerOptions) {
        runHttpServer(this, options);
    }
}
