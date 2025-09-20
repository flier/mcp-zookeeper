# MCP ZooKeeper Server Usage Examples

This document provides detailed usage examples for MCP ZooKeeper Server to help you get started quickly.

## Basic Usage Scenarios

### 1. Configuration Management

#### Read Configuration File
```json
{
  "tool": "read_text_node",
  "arguments": {
    "path": "/config/database.properties"
  }
}
```

#### Update Configuration
```json
{
  "tool": "write_node",
  "arguments": {
    "path": "/config/database.properties",
    "content": "host=localhost\nport=5432\ndatabase=myapp\nusername=admin\npassword=secret"
  }
}
```

#### Partial Configuration Update
```json
{
  "tool": "edit_node",
  "arguments": {
    "path": "/config/database.properties",
    "diffs": [
      {"op": 1, "text": "host=production-db.example.com\n"},
      {"op": -1, "text": "host=localhost\n"}
    ],
    "dryRun": false
  }
}
```

### 2. Service Discovery

#### Register Service
```json
{
  "tool": "write_node",
  "arguments": {
    "path": "/services/api-server/instance-1",
    "content": "{\"host\":\"192.168.1.100\",\"port\":8080,\"status\":\"healthy\"}"
  }
}
```

#### List All Services
```json
{
  "tool": "list_directory_with_sizes",
  "arguments": {
    "path": "/services",
    "sortBy": "name"
  }
}
```

#### Get Service Details
```json
{
  "tool": "get_node_stat",
  "arguments": {
    "path": "/services/api-server/instance-1"
  }
}
```

### 3. Distributed Locking

#### Create Lock Node
```json
{
  "tool": "write_node",
  "arguments": {
    "path": "/locks/resource-123",
    "content": "{\"owner\":\"process-456\",\"timestamp\":1640995200000}"
  }
}
```

#### Check Lock Status
```json
{
  "tool": "read_text_node",
  "arguments": {
    "path": "/locks/resource-123"
  }
}
```

#### Release Lock
```json
{
  "tool": "remove_node",
  "arguments": {
    "path": "/locks/resource-123"
  }
}
```

### 4. Data Storage

#### Store JSON Data
```json
{
  "tool": "write_node",
  "arguments": {
    "path": "/data/users/12345",
    "content": "{\"id\":12345,\"name\":\"John Doe\",\"email\":\"john@example.com\",\"created\":\"2024-01-01T00:00:00Z\"}"
  }
}
```

#### Store Binary Data
```json
{
  "tool": "write_node",
  "arguments": {
    "path": "/data/avatars/12345.png",
    "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "encoding": "base64"
  }
}
```

#### Read Binary Data
```json
{
  "tool": "read_binary_node",
  "arguments": {
    "path": "/data/avatars/12345.png"
  }
}
```

### 5. Directory Structure Management

#### Create Project Structure
```json
{
  "tool": "create_directory",
  "arguments": {
    "path": "/projects/my-app/config"
  }
}
```

#### View Directory Tree
```json
{
  "tool": "list_directory_tree",
  "arguments": {
    "path": "/projects/my-app"
  }
}
```

#### Clean Up Temporary Data
```json
{
  "tool": "remove_node",
  "arguments": {
    "path": "/temp/cache",
    "recursive": true
  }
}
```

## Advanced Usage Scenarios

### 1. Monitoring and Health Checks

#### Set Health Check Node
```json
{
  "tool": "write_node",
  "arguments": {
    "path": "/health/api-server",
    "content": "{\"status\":\"healthy\",\"timestamp\":1640995200000,\"version\":\"1.2.3\"}"
  }
}
```

#### Monitor Multiple Services
```json
{
  "tool": "list_directory_with_sizes",
  "arguments": {
    "path": "/health",
    "sortBy": "name"
  }
}
```

### 2. Configuration Version Management

#### Create Configuration Version
```json
{
  "tool": "write_node",
  "arguments": {
    "path": "/config/versions/v1.0.0",
    "content": "{\"version\":\"1.0.0\",\"config\":{\"debug\":false,\"port\":8080}}"
  }
}
```

#### Switch Configuration Version
```json
{
  "tool": "read_text_node",
  "arguments": {
    "path": "/config/versions/v1.0.0"
  }
}
```

### 3. Event Logging

#### Log Event
```json
{
  "tool": "write_node",
  "arguments": {
    "path": "/logs/events/2024-01-01/event-001",
    "content": "{\"timestamp\":1640995200000,\"level\":\"INFO\",\"message\":\"User login successful\",\"userId\":12345}"
  }
}
```

#### View Latest Events
```json
{
  "tool": "read_text_node",
  "arguments": {
    "path": "/logs/events/2024-01-01",
    "tail": 10
  }
}
```

## Best Practices

### 1. Path Naming Conventions
- Use meaningful path structures: `/services/{service-name}/{instance-id}`
- Avoid overly deep nesting: recommend no more than 5 levels
- Use consistent naming conventions

### 2. Data Formats
- For configuration data, use JSON format
- For simple values, use strings directly
- For binary data, use base64 encoding

### 3. Error Handling
- Always check operation results
- Use dry-run mode to preview changes
- Implement appropriate retry mechanisms

### 4. Performance Optimization
- Avoid frequent small operations
- Use batch operations when possible
- Set appropriate session timeout values

## Troubleshooting Examples

### Connection Issues
```bash
# Check ZooKeeper connection
echo "ruok" | nc localhost 2181

# Should return "imok"
```

### Permission Issues
```json
{
  "tool": "get_node_stat",
  "arguments": {
    "path": "/protected-node"
  }
}
```

### Session Timeout
```bash
# Increase session timeout
export ZK_SESSION_TIMEOUT=60000
mcp-server-zookeeper
```

## Additional Resources

- [ZooKeeper Official Documentation](https://zookeeper.apache.org/doc/current/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Project GitHub Repository](https://github.com/flier/mcp-zookeeper)
