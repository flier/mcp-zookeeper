import { z } from "zod";
import { fileTypeFromBuffer } from 'file-type';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "node-zookeeper-client";
import { diff_match_patch, type Diff } from "diff-match-patch";

import { getData, setData, makeDirs, getChildren, exists } from "./zk.js";

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

const ListDirectoryArgsSchema = z.object({
    path: z.string().describe("The path to the directory to list"),
});

const ListDirectoryWithSizesArgsSchema = z.object({
    path: z.string().describe("The path to the directory to list"),
    sortBy: z.enum(['name', 'size']).optional().default('name').describe('Sort entries by name (ascending) or size (descending)'),
});

const GetNodeStatArgsSchema = z.object({
    path: z.string().describe("The path to the node to get the stat of"),
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

    server.tool(
        "list_directory",
        "Get a detailed listing of all nodes and directories in a specified path. " +
        "Results clearly distinguish between nodes and directories with [NODE] and [DIR] prefixes. " +
        "This tool is essential for understanding directory structure and finding specific files within a directory. " +
        "Returns a simple list format without size information. " +
        "Only works within allowed directories.",
        ListDirectoryArgsSchema.shape,
        async ({ path }) => {
            return await callTool(listDirectory, client, { path });
        }
    )

    server.tool(
        "list_directory_with_sizes",
        "Get a detailed listing of all nodes and directories in a specified path, including sizes. " +
        "Results clearly distinguish between nodes and directories with [FILE] and [DIR] " +
        "prefixes. Shows file sizes in human-readable format (B, KB, MB, GB, TB). " +
        "Supports sorting by name (ascending) or size (descending). " +
        "Includes summary statistics with total file count, directory count, and combined size. " +
        "This tool is useful for understanding directory structure and " +
        "finding specific nodes within a directory. Only works within allowed directories.",
        ListDirectoryWithSizesArgsSchema.shape,
        async ({ path, sortBy }) => {
            return await callTool(listDirectoryWithSizes, client, { path, sortBy });
        }
    )

    server.tool(
        "get_node_stat",
        "Retrieve detailed metadata about a node or directory. " +
        "Returns comprehensive information including size, creation time, last modified time, permissions, and type. " +
        "This tool is perfect for understanding file characteristics without reading the actual content. " +
        "Only works within allowed directories.",
        GetNodeStatArgsSchema.shape,
        async ({ path }) => {
            return await callTool(getNodeStat, client, { path });
        }
    )
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
type ListDirectoryArgs = z.infer<typeof ListDirectoryArgsSchema>;
type ListDirectoryWithSizesArgs = z.infer<typeof ListDirectoryWithSizesArgsSchema>;
type GetNodeStatArgs = z.infer<typeof GetNodeStatArgsSchema>;

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

/**
 * Lists the contents of a directory in a simple format.
 *
 * Returns a list of entries with [NODE] or [DIR] prefixes to distinguish
 * between files and directories. This is a lightweight alternative to
 * listDirectoryWithSizes when size information is not needed.
 *
 * @param client - The ZooKeeper client instance
 * @param args - The list directory arguments
 * @returns A newline-separated string of directory entries with type prefixes
 *
 * @example
 * ```
 * // Returns:
 * // [NODE] file1.txt
 * // [DIR] subdirectory
 * // [NODE] file2.txt
 * ```
 */
async function listDirectory(client: Client, { path }: ListDirectoryArgs): Promise<string> {
    const [children] = await getChildren(client, path);

    const s = [];

    for (const child of children) {
        const stat = await exists(client, path + "/" + child);

        if (stat) {
            s.push(`${stat.numChildren > 0 ? "[DIR]" : "[NODE]"} ${child}`);
        }
    }

    return s.join("\n");
}

/**
 * Represents a directory entry with metadata.
 */
interface Entry {
    /** The name of the entry */
    name: string;
    /** Whether this entry is a directory */
    isDirectory: boolean;
    /** The size of the entry in bytes (0 for directories) */
    size: number;
    /** The modification time of the entry */
    mtime: Date;
}

/**
 * Lists the contents of a directory with detailed size information and sorting options.
 *
 * Returns a formatted listing with file sizes, directory counts, and summary statistics.
 * Supports sorting by name (ascending) or size (descending). File sizes are displayed
 * in human-readable format (B, KB, MB, GB, TB).
 *
 * @param client - The ZooKeeper client instance
 * @param args - The list directory with sizes arguments
 * @returns A formatted string with directory contents, sizes, and summary statistics
 *
 * @example
 * ```
 * // Returns (sorted by name):
 * // [DIR] subdirectory
 * // [FILE] file1.txt                       100 B
 * // [FILE] file2.txt                       2.00 MB
 * //
 * // Total: 2 files, 1 directories
 * // Combined size: 2.00 MB
 * ```
 */
async function listDirectoryWithSizes(client: Client, { path, sortBy }: ListDirectoryWithSizesArgs): Promise<string> {
    const [children] = await getChildren(client, path);

    const detailedEntries: Entry[] = [];

    for (const child of children) {
        const stat = await exists(client, path + "/" + child);

        if (stat) {
            detailedEntries.push({
                name: child,
                isDirectory: stat.numChildren > 0,
                size: stat.dataLength,
                mtime: new Date(Number(stat.mtime))
            });
        } else {
            detailedEntries.push({
                name: child,
                isDirectory: false,
                size: 0,
                mtime: new Date(0)
            });
        }
    }

    // Sort entries based on sortBy parameter
    const sortedEntries = [...detailedEntries].sort((a, b) => {
        if (sortBy === 'size') {
            return b.size - a.size; // Descending by size
        }
        // Default sort by name
        return a.name.localeCompare(b.name);
    });

    // Format the output
    const formattedEntries = sortedEntries.map(entry =>
        `${entry.isDirectory ? "[DIR]" : "[FILE]"} ${entry.name.padEnd(30)} ${entry.isDirectory ? "" : formatSize(entry.size).padStart(10)}`
    );

    // Add summary
    const totalFiles = detailedEntries.filter(e => !e.isDirectory).length;
    const totalDirs = detailedEntries.filter(e => e.isDirectory).length;
    const totalSize = detailedEntries.reduce((sum, entry) => sum + (entry.isDirectory ? 0 : entry.size), 0);

    const summary = [
        "",
        `Total: ${totalFiles} files, ${totalDirs} directories`,
        `Combined size: ${formatSize(totalSize)}`
    ];

    return [...formattedEntries, ...summary].join("\n")
}

/** Supported size units for human-readable formatting */
const sizeUnits = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Formats a byte count into a human-readable string with appropriate units.
 *
 * Converts bytes to the most appropriate unit (B, KB, MB, GB, TB) and formats
 * the number with 2 decimal places for units larger than bytes. Handles edge
 * cases like zero and negative numbers.
 *
 * @param bytes - The number of bytes to format
 * @returns A formatted string with the size and unit
 *
 * @example
 * ```
 * formatSize(0)        // "0 B"
 * formatSize(1024)     // "1.00 KB"
 * formatSize(1536)     // "1.50 KB"
 * formatSize(1048576)  // "1.00 MB"
 * formatSize(-100)     // "0 B" (negative numbers treated as 0)
 * ```
 */
export function formatSize(bytes: number): string {
    if (bytes <= 0) return '0 B';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    if (i < 0 || i === 0) return `${bytes} ${sizeUnits[0]}`;

    const unitIndex = Math.min(i, sizeUnits.length - 1);
    return `${(bytes / Math.pow(1024, unitIndex)).toFixed(2)} ${sizeUnits[unitIndex]}`;
}

/**
 * Retrieves detailed metadata about a node or directory.
 *
 * @param client - The ZooKeeper client instance
 * @param args - The get node stat arguments
 * @returns A formatted string with the node stat
 */
async function getNodeStat(client: Client, { path }: GetNodeStatArgs): Promise<string> {
    const stat = await exists(client, path);

    if (!stat) {
        return "Node does not exist";
    }

    return [
        `Node: ${path}`,
        `Creation Zxid: ${stat.czxid.readBigInt64BE()}`,
        `Last Modified Zxid: ${stat.mzxid.readBigInt64BE()}`,
        `Creation Time: ${new Date(Number(stat.ctime.readBigInt64BE())).toUTCString()}`,
        `Last Modified Time: ${new Date(Number(stat.mtime.readBigInt64BE())).toUTCString()}`,
        `Version: ${stat.version}`,
        `Creation Version: ${stat.cversion}`,
        `Children: ${stat.numChildren}`,
        `Size: ${stat.dataLength}`,
    ].join('\n');
}