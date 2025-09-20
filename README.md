# MCP ZooKeeper Server

A Model Context Protocol (MCP) server that provides tools for interacting with Apache ZooKeeper. This server allows you to read, write, and manage ZooKeeper nodes and directories through a standardized MCP interface.

## Features

### Node Operations
- **Read Text Nodes**: Read node contents as text with optional line filtering (head/tail)
- **Read Binary Nodes**: Read binary node contents with MIME type detection
- **Write Nodes**: Create new nodes or overwrite existing node content
- **Edit Nodes**: Apply diff operations to text nodes with preview mode support
- **Remove Nodes**: Delete nodes with support for recursive deletion of child nodes
- **Get Node Statistics**: Retrieve detailed metadata information about nodes

### Directory Operations
- **Simple Directory Listing**: Simple directory listing with `[NODE]`/`[DIR]` prefixes
- **Detailed Directory Listing**: Detailed directory listing with file sizes and sorting options
- **Recursive Directory Tree**: Display recursive directory tree as JSON structure
- **Create Directory**: Create directories and all necessary parent directories

### Advanced Features
- **Human-readable file sizes**: Automatic formatting (B, KB, MB, GB, TB)
- **Flexible sorting**: Sort directory contents by name or size
- **Error handling**: Comprehensive error messages and graceful failure handling
- **Type safety**: Full TypeScript support with Zod schema validation
- **Resource support**: Support for ZooKeeper nodes as MCP resources

## Installation

```bash
npm install -g mcp-zookeeper
```

## Usage

### Starting the Server

#### Standard Input/Output Mode (Recommended for MCP clients)
```bash
mcp-server-zookeeper
```

#### HTTP Server Mode
```bash
mcp-server-zookeeper --host 0.0.0.0 --port 3000
```

#### Command Line Options
```bash
mcp-server-zookeeper [options]

Options:
  -h, --help              Show help information
  -H, --host=HOST         Host to listen on (default: 127.0.0.1)
  -p, --port=PORT         Port to listen on
  -s, --zkServers=SERVERS ZooKeeper servers address (default: localhost:2181)
```

### Configuration

The server connects to ZooKeeper using the following default settings:
- **Host**: localhost:2181
- **Session Timeout**: 30 seconds
- **Retry Attempts**: 3
- **Connection Delay**: 100 milliseconds

You can customize these settings using environment variables:
- `ZK_SERVERS`: ZooKeeper connection string (default: "localhost:2181")
- `ZK_SESSION_TIMEOUT`: Session timeout in milliseconds (default: 30000)
- `ZK_RETRIES`: Number of retry attempts (default: 3)
- `ZK_SPIN_DELAY`: Delay between connection attempts in milliseconds (default: 100)

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

### `remove_node`
Remove a node. Supports recursive deletion of child nodes.

**Parameters:**
- `path` (string): The path to the node to remove
- `version` (number, optional): The version of the node to remove
- `recursive` (boolean): Whether to recursively remove the node and all its children (default: false)

**Example:**
```json
{
  "path": "/temp/data",
  "recursive": true
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
```text
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
```text
[DIR] subdirectory
[FILE] file1.txt                       100 B
[FILE] file2.txt                       2.00 MB

Total: 2 files, 1 directories
Combined size: 2.00 MB
```

### `list_directory_tree`
Get a recursive tree view of directories as a JSON structure.

**Parameters:**
- `path` (string): The root directory path to list

**Example Output:**
```json
{
  "name": "root",
  "type": "directory",
  "children": [
    {
      "name": "file1.txt",
      "type": "file"
    },
    {
      "name": "subdir",
      "type": "directory",
      "children": [
        {
          "name": "file2.txt",
          "type": "file"
        }
      ]
    }
  ]
}
```

### `get_node_stat`
Retrieve detailed metadata information about a node or directory.

**Parameters:**
- `path` (string): The path to the node to get statistics for

**Example Output:**
```json
{
  "czxid": 1234567890,
  "mzxid": 1234567890,
  "ctime": 1640995200000,
  "mtime": 1640995200000,
  "version": 1,
  "cversion": 0,
  "aversion": 0,
  "ephemeralOwner": 0,
  "dataLength": 1024,
  "numChildren": 3,
  "pzxid": 1234567890
}
```

## Resource Support

This server supports ZooKeeper nodes as MCP resources, allowing clients to access node content through resource URIs:

- **Resource URI Format**: `zk:///{node}`
- **Auto-completion**: Supports node path auto-completion
- **Content Reading**: Direct node content access through resource interface

## Development

### Prerequisites
- Node.js 18+
- pnpm
- TypeScript
- ZooKeeper server (for testing)

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
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Start test UI
pnpm test:ui
```

### Linting
```bash
pnpm lint
```

### Development Server
```bash
# Start development server (watch mode)
pnpm watch

# Start MCP inspector
pnpm inspector
```

## Troubleshooting

### Common Issues

#### Connection Problems
**Issue**: Unable to connect to ZooKeeper server
**Solutions**:
1. Check if ZooKeeper server is running
2. Verify the connection string is correct
3. Check network connectivity and firewall settings
4. Ensure ZooKeeper server port (default 2181) is accessible

#### Permission Issues
**Issue**: Permission denied errors when accessing nodes
**Solutions**:
1. Check ZooKeeper ACL configuration
2. Ensure client has appropriate permissions
3. Verify node path is correct

#### Session Timeout
**Issue**: Session timeout causing operation failures
**Solutions**:
1. Increase session timeout duration
2. Check network stability
3. Reduce retry interval

### Debug Mode

Enable verbose logging:
```bash
DEBUG=mcp-zookeeper:* mcp-server-zookeeper
```

### Health Check

Use MCP inspector to verify server status:
```bash
pnpm inspector
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
- **Session timeout**: Session expiration errors
- **Version conflict**: Node version mismatch errors

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

We welcome community contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Ensure all tests pass
- Add tests for new functionality
- Follow existing code style
- Update relevant documentation

## Additional Documentation

- **[Usage Examples](EXAMPLES.md)**: Detailed usage examples and best practices
- **[Changelog](CHANGELOG.md)**: Version update records
- **[API Reference](README.md#api-reference)**: Complete API documentation
- **[Troubleshooting](README.md#troubleshooting)**: Common issue solutions

## Support

- **Issues**: [GitHub Issues](https://github.com/flier/mcp-zookeeper/issues)
- **Documentation**: [GitHub Wiki](https://github.com/flier/mcp-zookeeper/wiki)
- **Email**: flier.lu@gmail.com

## Changelog

### v1.0.0
- Initial version release
- Support for basic ZooKeeper node operations
- MCP tools and resource interface
- Full TypeScript support
