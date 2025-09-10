import path from "path";
import querystring from "querystring";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "node-zookeeper-client";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getChildren, getData } from "./zk.js";

/**
 * Registers ZooKeeper node resources with the MCP server.
 * Provides node completion and content reading capabilities.
 *
 * @param client - The ZooKeeper client instance
 * @param server - The MCP server instance
 */
export function registerResources(client: Client, server: McpServer): void {
    server.resource(
        "node",
        new ResourceTemplate("zk:///{node}", {
            list: undefined,
            complete: {
                node: async (value: string, context) => {
                    const nodePath = value ?? path.sep;
                    const { dir, base } = nodePath.endsWith(path.sep)
                        ? { dir: nodePath.slice(0, -1), base: "" }
                        : path.parse(nodePath);

                    console.debug("Complete node", { value: nodePath, dir, base }, context);

                    const [children] = await getChildren(client, dir);
                    const nodes = children
                        .filter(child => child.startsWith(base))
                        .map(child => path.join(dir, child));

                    console.debug("Found completion", { nodes });

                    return nodes;
                }
            }
        }),
        {
            title: "ZooKeeper Node",
            description: "A ZooKeeper node",
        },
        async (uri: URL, { node }, extra) => {
            let nodePath: string;

            if (Array.isArray(node)) {
                nodePath = node.join(path.sep);
            } else {
                nodePath = node;
            }

            nodePath = querystring.unescape(nodePath);

            console.debug("Read node", { uri: uri.href }, nodePath, extra);

            const [blob] = await getData(client, nodePath);

            return {
                contents: [{
                    uri: uri.href,
                    blob: blob.toString('base64'),
                }]
            };
        }
    );
}