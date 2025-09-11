# MCP ZooKeeper Server

A Model Context Protocol (MCP) server that provides tools for interacting with Apache ZooKeeper. This server allows you to read, write, and manage ZooKeeper nodes and directories through a standardized MCP interface.

## Features

### File Operations
- **Read Text Nodes**: Read node contents as text with optional line filtering (head/tail)
- **Read Binary Nodes**: Read binary node contents with MIME type detection
- **Write Nodes**: Create or overwrite nodes with text content
- **Edit Nodes**: Apply diff operations to text nodes with dry-run support

### Directory Operations
- **List Directory**: Simple directory listing with [NODE]/[DIR] prefixes
- **List Directory with Sizes**: Detailed directory listing with file sizes and sorting options
- **Create Directory**: Create directories and parent directories recursively

### Advanced Features
- **Human-readable file sizes**: Automatic formatting (B, KB, MB, GB, TB)
- **Flexible sorting**: Sort directory contents by name or size
- **Error handling**: Comprehensive error messages and graceful failure handling
- **Type safety**: Full TypeScript support with Zod schema validation

## Installation

```bash
npm install -g mcp-zookeeper
```

## Usage

### Starting the Server

```bash
mcp-server-zookeeper
```

### Configuration

The server connects to ZooKeeper using the following default settings:
- **Host**: localhost:2181
- **Session Timeout**: 30 seconds
- **Retry Attempts**: 3

You can customize these settings by setting environment variables:
- `ZK_CONNECTION_STRING`: ZooKeeper connection string (default: "localhost:2181")
- `ZK_SESSION_TIMEOUT`: Session timeout in milliseconds (default: 30000)
- `ZK_RETRIES`: Number of retry attempts (default: 3)

## Available Tools

### `read_text_node`
Read the complete contents of a node as text.

**Parameters:**
- `path` (string): The path to the node to read
- `head` (number, optional): Return only the first N lines
- `tail` (number, optional): Return only the last N lines

**Example:**
```json
{
  "path": "/config/app.properties",
  "head": 10
}
```

### `read_binary_node`
Read a binary node and return base64-encoded data with MIME type.

**Parameters:**
- `path` (string): The path to the binary node to read

**Example:**
```json
{
  "path": "/data/image.png"
}
```

### `write_node`
Create a new node or overwrite an existing node with new content.

**Parameters:**
- `path` (string): The path to the node to write
- `content` (string): The content to write
- `encoding` (string, optional): Text encoding (default: "utf-8")

**Example:**
```json
{
  "path": "/config/settings.json",
  "content": "{\"debug\": true, \"port\": 8080}",
  "encoding": "utf-8"
}
```

### `edit_node`
Apply diff operations to a text node.

**Parameters:**
- `path` (string): The path to the node to edit
- `diffs` (array): List of diff operations
- `dryRun` (boolean): Preview changes without applying them (default: false)

**Example:**
```json
{
  "path": "/config/app.properties",
  "diffs": [
    {"op": 1, "text": "debug=true\n"},
    {"op": -1, "text": "debug=false\n"}
  ],
  "dryRun": true
}
```

### `create_directory`
Create a directory and all necessary parent directories.

**Parameters:**
- `path` (string): The path to the directory to create

**Example:**
```json
{
  "path": "/data/logs/2024/01"
}
```

### `list_directory`
Get a simple listing of directory contents.

**Parameters:**
- `path` (string): The path to the directory to list

**Example Output:**
```
[NODE] file1.txt
[DIR] subdirectory
[NODE] file2.txt
```

### `list_directory_with_sizes`
Get a detailed listing with file sizes and sorting options.

**Parameters:**
- `path` (string): The path to the directory to list
- `sortBy` (string, optional): Sort by "name" or "size" (default: "name")

**Example Output:**
```
[DIR] subdirectory
[FILE] file1.txt                       100 B
[FILE] file2.txt                       2.00 MB

Total: 2 files, 1 directories
Combined size: 2.00 MB
```

## Development

### Prerequisites
- Node.js 18+
- pnpm
- TypeScript

### Setup
```bash
git clone https://github.com/flier/mcp-zookeeper.git
cd mcp-zookeeper
pnpm install
```

### Building
```bash
pnpm build
```

### Testing
```bash
pnpm test
```

### Linting
```bash
pnpm lint
```

## API Reference

### Utility Functions

#### `formatSize(bytes: number): string`
Formats a byte count into a human-readable string.

**Parameters:**
- `bytes`: The number of bytes to format

**Returns:**
- A formatted string with the size and unit (e.g., "1.50 KB", "2.00 MB")

**Examples:**
```typescript
formatSize(0)        // "0 B"
formatSize(1024)     // "1.00 KB"
formatSize(1536)     // "1.50 KB"
formatSize(1048576)  // "1.00 MB"
formatSize(-100)     // "0 B"
```

## Error Handling

The server provides comprehensive error handling with descriptive error messages:

- **Node not found**: Clear indication when a node doesn't exist
- **Permission denied**: Authentication and authorization errors
- **Connection issues**: ZooKeeper connectivity problems
- **Invalid parameters**: Schema validation errors

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## Support

- **Issues**: [GitHub Issues](https://github.com/flier/mcp-zookeeper/issues)
- **Documentation**: [GitHub Wiki](https://github.com/flier/mcp-zookeeper/wiki)
- **Email**: flier.lu@gmail.com
