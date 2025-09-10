import { z } from "zod";
import { fileTypeFromBuffer } from 'file-type';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "node-zookeeper-client";
import { diff_match_patch, type Diff } from "diff-match-patch";

import { getData, setData, makeDirs } from "./zk.js";


export function registerTools(client: Client, server: McpServer) {
    server.tool("read_text_node",
        "Read the complete contents of a node from the ZooKeeper as text. " +
        "Handles various text encodings and provides detailed error messages if the node cannot be read. " +
        "Use this tool when you need to examine the contents of a single node. " +
        "Use the 'head' parameter to read only the first N lines of a node, " +
        "or the 'tail' parameter to read only the last N lines of a node. " +
        "Operates on the node as text regardless of extension. " +
        "Only works within allowed directories.",
        {
            path: z.string().describe("The path to the node to read as text"),
            tail: z.number().optional().describe('If provided, returns only the last N lines of the node'),
            head: z.number().optional().describe('If provided, returns only the first N lines of the node')
        },
        async ({ path, tail, head }) => {
            try {
                const [data] = await getData(client, path);
                const text = data.toString('utf-8');

                let content;

                if (tail) {
                    content = text.split('\n').slice(-tail).join('\n');
                } else if (head) {
                    content = text.split('\n').slice(0, head).join('\n');
                } else {
                    content = text;
                }

                return { content: [{ type: "text", text: content }] };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text", text: `Error: ${msg}` }],
                    isError: true,
                };
            }
        });

    server.tool("read_binary_node",
        "Read a binary node. " +
        "Returns the base64 encoded data and MIME type. " +
        "Only works within allowed directories.",
        {
            path: z.string().describe("The path to the node to read as binary")
        },
        async ({ path }) => {
            try {
                const [data] = await getData(client, path);
                const fileType = await fileTypeFromBuffer(data);

                return {
                    content: [{
                        type: "resource",
                        resource: {
                            uri: `zk:///${path}`,
                            mimeType: fileType?.mime || "application/octet-stream",
                            text: data.toString("base64"),
                        }
                    }]
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text", text: `Error: ${msg}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool("write_node",
        "Create a new node or completely overwrite an existing node with new content. " +
        "Use with caution as it will overwrite existing node without warning. " +
        "Handles text content with the given encoding. " +
        "Only works within allowed directories.",
        {
            path: z.string().describe("The path to the node to write"),
            content: z.string().describe("The content to write to the node"),
            encoding: z.string().optional().describe("The encoding to use for the content"),
        },
        async ({ path, content, encoding }) => {
            try {
                await setData(client, path, Buffer.from(content, (encoding as BufferEncoding) ?? "utf-8"));
                return { content: [{ type: "text", text: "Node written successfully" }] };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
            }
        }
    )

    server.tool("edit_node",
        "Apply diffs to a text file. " +
        "Each diff can be an insertion, deletion, or equality operation. " +
        "Returns the patches showing the changes, which looks extremely similar to the standard GNU diff/patch format" +
        "Only works within allowed directories.",
        {
            path: z.string().describe("The path to the node to edit"),
            diffs: z.array(z.object({
                op: z.number().int().describe('Operation is an insertion (1), a deletion (-1) or an equality (0)'),
                text: z.string().describe('Text to insert, delete or equal'),
            })).describe("List of diff operations"),
            dryRun: z.boolean().default(false).describe('Preview changes using git-style diff format')
        },
        async ({ path, diffs, dryRun }) => {
            try {
                const [data] = await getData(client, path);
                const text = data.toString('utf-8');

                const dmp = new diff_match_patch();

                const patches = dmp.patch_make(text, diffs as unknown as Diff[]);
                const [content] = dmp.patch_apply(patches, text);

                if (!dryRun) {
                    await setData(client, path, Buffer.from(content, "utf-8"));
                }

                return { content: [{ type: "text", text: dmp.patch_toText(patches) }] };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
            }
        }
    )

    server.tool("create_directory",
        "Create a new directory or ensure a directory exists. " +
        "Can create multiple nested directories in one operation. " +
        "If the directory already exists, this operation will succeed silently. " +
        "Perfect for setting up directory structures for projects or ensuring required paths exist. " +
        "Only works within allowed directories.",
        {
            path: z.string(),
        },
        async ({ path }) => {
            try {
                await makeDirs(client, path);

                return { content: [{ type: "text", text: `Successfully created directory ${path}` }] };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
            }
        }
    )
}

