# Changelog

This document records all significant changes to MCP ZooKeeper Server.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added detailed usage examples documentation (EXAMPLES.md)
- Improved README.md structure and content organization
- Added missing tool documentation (remove_node, list_directory_tree, get_node_stat)
- Added troubleshooting and common issues section
- Added more detailed configuration instructions
- Added resource support documentation
- Improved development guidelines and testing instructions

### Improved
- Translated all documentation to English for better accessibility
- Optimized tool parameter descriptions and examples
- Enhanced error handling documentation
- Improved installation and usage instructions

### Documentation
- Created comprehensive usage examples documentation
- Added best practices guide
- Provided troubleshooting examples
- Updated API reference documentation

## [1.0.0] - 2024-01-01

### Added
- Initial version release
- Support for basic ZooKeeper node operations
- MCP tools and resource interface
- Full TypeScript support
- Support for the following tools:
  - read_text_node: Read text nodes
  - read_binary_node: Read binary nodes
  - write_node: Write nodes
  - edit_node: Edit nodes
  - remove_node: Remove nodes
  - create_directory: Create directories
  - list_directory: List directories
  - list_directory_with_sizes: List directories with sizes
  - list_directory_tree: Recursive directory tree
  - get_node_stat: Get node statistics
- Support for ZooKeeper nodes as MCP resources
- HTTP and stdio transport modes
- Complete error handling and type safety
- Human-readable file size formatting
- Flexible directory sorting options
