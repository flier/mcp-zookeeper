import path from "path";
import querystring from "querystring";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "node-zookeeper-client";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getChildren, getData } from "./zk.js";

export function registerResources(client: Client, server: McpServer) {
    server.resource("node",
        new ResourceTemplate("zk:///{node}", {
            list: undefined,
            complete: {
                node: async (value: string, context) => {
                    const p = value ?? path.sep

                    const { dir, base } = p.endsWith(path.sep) ? { dir: p.slice(0, -1), base: "" } : path.parse(p);

                    console.debug("complete node", { value, dir, base }, context)

                    const [children] = await getChildren(client, dir);
                    const nodes = children
                        .filter(child => child.startsWith(base))
                        .map(child => path.join(dir, child));

                    console.debug("found completion", { nodes })

                    return nodes;
                }
            }
        }),
        {
            title: "ZooKeeper Node",
            description: "A ZooKeeper node",
        },
        async (uri: URL, { node }, extra) => {
            if (Array.isArray(node)) {
                node = node.join(path.sep);
            }

            node = querystring.unescape(node);

            console.debug("read node", { uri }, node, extra)

            const [blob] = await getData(client, node);

            return {
                contents: [{
                    uri: uri.href,
                    blob: blob.toString('base64'),
                }]
            };
        })
}