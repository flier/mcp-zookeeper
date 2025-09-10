import { z } from "zod";
import { fileTypeFromBuffer } from 'file-type';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "node-zookeeper-client";
import { diff_match_patch, type Diff } from "diff-match-patch";

import { getData, setData, makeDirs } from "./zk.js";

// Schema definitions for tool arguments
const ReadTextNodeArgsSchema = z.object({
    path: z.string().describe("The path to the node to read as text"),
    tail: z.number().optional().describe('If provided, returns only the last N lines of the node'),
    head: z.number().optional().describe('If provided, returns only the first N lines of the node')
});

const ReadBinaryNodeArgsSchema = z.object({
    path: z.string().describe("The path to the node to read as binary")
});

const WriteNodeArgsSchema = z.object({
    path: z.string().describe("The path to the node to write"),
    content: z.string().describe("The content to write to the node"),
    encoding: z.string().optional().describe("The encoding to use for the content"),
});

const DiffSchema = z.object({
    op: z.number().int().describe('Operation is an insertion (1), a deletion (-1) or an equality (0)'),
    text: z.string().describe('Text to insert, delete or equal'),
});

const EditNodeArgsSchema = z.object({
    path: z.string().describe("The path to the node to edit"),
    diffs: z.array(DiffSchema).describe("List of diff operations"),
    dryRun: z.boolean().default(false).describe('Preview changes using git-style diff format')
});

const CreateDirectoryArgsSchema = z.object({
    path: z.string().describe("The path to the directory to create")
});

/**
 * Registers all available tools with the MCP server.
 *
 * @param client - The ZooKeeper client instance
 * @param server - The MCP server instance
 */
export function registerTools(client: Client, server: McpServer): void {
    server.tool(
        "read_text_node",
        "Read the complete contents of a node from the ZooKeeper as text. " +
        "Handles various text encodings and provides detailed error messages if the node cannot be read. " +
        "Use this tool when you need to examine the contents of a single node. " +
        "Use the 'head' parameter to read only the first N lines of a node, " +
        "or the 'tail' parameter to read only the last N lines of a node. " +
        "Operates on the node as text regardless of extension. " +
        "Only works within allowed directories.",
        ReadTextNodeArgsSchema.shape,
        async ({ path, tail, head }) => {
            return await callTool(readTextNode, client, { path, tail, head });
        }
    );

    server.tool(
        "read_binary_node",
        "Read a binary node. " +
        "Returns the base64 encoded data and MIME type. " +
        "Only works within allowed directories.",
        ReadBinaryNodeArgsSchema.shape,
        async ({ path }) => {
            return await callTool(readBinaryNode, client, { path });
        }
    );

    server.tool(
        "write_node",
        "Create a new node or completely overwrite an existing node with new content. " +
        "Use with caution as it will overwrite existing node without warning. " +
        "Handles text content with the given encoding. " +
        "Only works within allowed directories.",
        WriteNodeArgsSchema.shape,
        async ({ path, content, encoding }) => {
            return await callTool(writeNode, client, { path, content, encoding });
        }
    );

    server.tool(
        "edit_node",
        "Apply diffs to a text file. " +
        "Each diff can be an insertion, deletion, or equality operation. " +
        "Returns the patches showing the changes, which looks extremely similar to the standard GNU diff/patch format. " +
        "Only works within allowed directories.",
        EditNodeArgsSchema.shape,
        async ({ path, diffs, dryRun }) => {
            return await callTool(editNode, client, { path, diffs, dryRun });
        }
    );

    server.tool(
        "create_directory",
        "Create a new directory or ensure a directory exists. " +
        "Can create multiple nested directories in one operation. " +
        "If the directory already exists, this operation will succeed silently. " +
        "Perfect for setting up directory structures for projects or ensuring required paths exist. " +
        "Only works within allowed directories.",
        CreateDirectoryArgsSchema.shape,
        async ({ path }) => {
            return await callTool(createDirectory, client, { path });
        }
    );
}

/**
 * Represents a binary resource with URI, MIME type, and base64-encoded data.
 */
interface Resource {
    uri: string;
    mimeType: string;
    blob: string;
}

/**
 * Generic tool wrapper that handles errors and formats responses.
 *
 * @param fn - The tool function to execute
 * @param client - The ZooKeeper client instance
 * @param args - The arguments for the tool function
 * @returns A formatted tool result
 */
async function callTool<Args>(
    fn: (client: Client, args: Args) => Promise<string | Resource>,
    client: Client,
    args: Args
): Promise<CallToolResult> {
    try {
        const result = await fn(client, args);

        if (typeof result === "string") {
            return { content: [{ type: "text", text: result }] };
        }

        const { uri, mimeType, blob } = result;
        return {
            content: [{ type: "resource", resource: { uri, mimeType, blob } }]
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
}

// Type definitions inferred from schemas
type ReadTextNodeArgs = z.infer<typeof ReadTextNodeArgsSchema>;
type ReadBinaryNodeArgs = z.infer<typeof ReadBinaryNodeArgsSchema>;
type WriteNodeArgs = z.infer<typeof WriteNodeArgsSchema>;
type EditNodeArgs = z.infer<typeof EditNodeArgsSchema>;
type CreateDirectoryArgs = z.infer<typeof CreateDirectoryArgsSchema>;

/**
 * Reads a node as text with optional line filtering.
 *
 * @param client - The ZooKeeper client instance
 * @param args - The read text node arguments
 * @returns The text content of the node
 */
async function readTextNode(client: Client, { path, tail, head }: ReadTextNodeArgs): Promise<string> {
    const [data] = await getData(client, path);
    const text = data.toString('utf-8');

    if (tail) {
        return text.split('\n').slice(-tail).join('\n');
    }

    if (head) {
        return text.split('\n').slice(0, head).join('\n');
    }

    return text;
}

/**
 * Reads a node as binary data with MIME type detection.
 *
 * @param client - The ZooKeeper client instance
 * @param args - The read binary node arguments
 * @returns A resource object with URI, MIME type, and base64 data
 */
async function readBinaryNode(client: Client, { path }: ReadBinaryNodeArgs): Promise<Resource> {
    const [data] = await getData(client, path);
    const fileType = await fileTypeFromBuffer(data);

    return {
        uri: `zk:///${path}`,
        mimeType: fileType?.mime || "application/octet-stream",
        blob: data.toString("base64"),
    };
}

/**
 * Writes text content to a node.
 *
 * @param client - The ZooKeeper client instance
 * @param args - The write node arguments
 * @returns Success message
 */
async function writeNode(client: Client, { path, content, encoding }: WriteNodeArgs): Promise<string> {
    const buffer = Buffer.from(content, (encoding as BufferEncoding) ?? "utf-8");
    await setData(client, path, buffer);

    return "Node written successfully";
}

/**
 * Applies diff operations to a text node.
 *
 * @param client - The ZooKeeper client instance
 * @param args - The edit node arguments
 * @returns The patch text showing changes made
 */
async function editNode(client: Client, { path, diffs, dryRun }: EditNodeArgs): Promise<string> {
    const [data] = await getData(client, path);
    const text = data.toString('utf-8');

    const dmp = new diff_match_patch();
    const patches = dmp.patch_make(text, diffs as unknown as Diff[]);
    const [content] = dmp.patch_apply(patches, text);

    if (!dryRun) {
        await setData(client, path, Buffer.from(content, "utf-8"));
    }

    return dmp.patch_toText(patches);
}

/**
 * Creates a directory and all necessary parent directories.
 *
 * @param client - The ZooKeeper client instance
 * @param args - The create directory arguments
 * @returns Success message with the created path
 */
async function createDirectory(client: Client, { path }: CreateDirectoryArgs): Promise<string> {
    await makeDirs(client, path);
    return `Successfully created directory ${path}`;
}