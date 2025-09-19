import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerTools, formatSize } from '../src/tool';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from 'node-zookeeper-client';
import { getData, setData, makeDirs, getChildren, exists } from '../src/zk';
import type { Stat } from 'node-zookeeper-client';

// Mock dependencies
vi.mock('../src/zk', () => ({
    getData: vi.fn(),
    setData: vi.fn(),
    makeDirs: vi.fn(),
    getChildren: vi.fn(),
    exists: vi.fn(),
}));

vi.mock('file-type', () => ({
    fileTypeFromBuffer: vi.fn(),
}));

vi.mock('diff-match-patch', () => ({
    diff_match_patch: vi.fn().mockImplementation(() => ({
        patch_make: vi.fn(),
        patch_apply: vi.fn(),
        patch_toText: vi.fn(),
    })),
}));

const mockStat: Stat = {
    czxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 3]), // 3
    mzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 4]), // 4
    ctime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]), // 0 (epoch)
    mtime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]), // 0 (epoch)
    version: 0,
    cversion: 0,
    aversion: 0,
    ephemeralOwner: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
    dataLength: 0,
    numChildren: 0,
    pzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1])
};

describe('Tool Functions', () => {
    let mockClient: Client;
    let mockServer: McpServer;

    beforeEach(async () => {
        mockClient = {} as Client;
        mockServer = {
            tool: vi.fn(),
        } as unknown as McpServer;

        // Reset all mocks
        vi.clearAllMocks();
    });

    describe('registerTools', () => {
        it('should register all tools with the server', () => {
            registerTools(mockClient, mockServer);

            expect(mockServer.tool).toHaveBeenCalledTimes(9);
            expect(mockServer.tool).toHaveBeenCalledWith(
                'read_text_node',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'read_binary_node',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'write_node',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'edit_node',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'create_directory',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'list_directory',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'list_directory_with_sizes',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'list_directory_tree',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'get_node_stat',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
        });
    });

    describe('Tool Handlers', () => {
        let toolHandlers: Array<{ name: string; handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text?: string; resource?: { uri: string; mimeType: string; blob: string } }>; isError?: boolean }> }>;

        beforeEach(() => {
            registerTools(mockClient, mockServer);
            toolHandlers = (mockServer.tool as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call: unknown[]) => ({
                name: call[0] as string,
                handler: call[3] as (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text?: string; resource?: { uri: string; mimeType: string; blob: string } }>; isError?: boolean }>,
            }));
        });

        describe('read_text_node', () => {
            it('should read text content without filtering', async () => {
                const mockData = Buffer.from('line1\nline2\nline3');
                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);

                const handler = toolHandlers.find(h => h.name === 'read_text_node')!.handler;
                const result = await handler({ path: '/test/node' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'line1\nline2\nline3' }]
                });
                expect(getData).toHaveBeenCalledWith(mockClient, '/test/node');
            });

            it('should read text content with head filtering', async () => {
                const mockData = Buffer.from('line1\nline2\nline3\nline4');
                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);

                const handler = toolHandlers.find(h => h.name === 'read_text_node')!.handler;
                const result = await handler({ path: '/test/node', head: 2 });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'line1\nline2' }]
                });
            });

            it('should read text content with tail filtering', async () => {
                const mockData = Buffer.from('line1\nline2\nline3\nline4');
                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);

                const handler = toolHandlers.find(h => h.name === 'read_text_node')!.handler;
                const result = await handler({ path: '/test/node', tail: 2 });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'line3\nline4' }]
                });
            });

            it('should handle errors gracefully', async () => {
                const error = new Error('Node not found');
                vi.mocked(getData).mockRejectedValue(error);

                const handler = toolHandlers.find(h => h.name === 'read_text_node')!.handler;
                const result = await handler({ path: '/test/node' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Error: Node not found' }],
                    isError: true
                });
            });
        });

        describe('read_binary_node', () => {
            it('should read binary content with MIME type detection', async () => {
                const mockData = Buffer.from('binary data');
                const mockFileType = { mime: 'image/png' };

                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);
                const { fileTypeFromBuffer } = await import('file-type');
                vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType as unknown as { mime: string; ext: string });

                const handler = toolHandlers.find(h => h.name === 'read_binary_node')!.handler;
                const result = await handler({ path: '/test/binary' });

                expect(result).toEqual({
                    content: [{
                        type: 'resource',
                        resource: {
                            uri: 'zk:////test/binary',
                            mimeType: 'image/png',
                            blob: mockData.toString('base64')
                        }
                    }]
                });
            });

            it('should handle unknown MIME type', async () => {
                const mockData = Buffer.from('binary data');

                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);
                const { fileTypeFromBuffer } = await import('file-type');
                vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined);

                const handler = toolHandlers.find(h => h.name === 'read_binary_node')!.handler;
                const result = await handler({ path: '/test/binary' });

                expect(result).toEqual({
                    content: [{
                        type: 'resource',
                        resource: {
                            uri: 'zk:////test/binary',
                            mimeType: 'application/octet-stream',
                            blob: mockData.toString('base64')
                        }
                    }]
                });
            });
        });

        describe('write_node', () => {
            it('should write text content with default encoding', async () => {
                vi.mocked(setData).mockResolvedValue(mockStat);

                const handler = toolHandlers.find(h => h.name === 'write_node')!.handler;
                const result = await handler({
                    path: '/test/node',
                    content: 'test content'
                });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Node written successfully' }]
                });
                expect(setData).toHaveBeenCalledWith(
                    mockClient,
                    '/test/node',
                    Buffer.from('test content', 'utf-8')
                );
            });

            it('should write text content with custom encoding', async () => {
                vi.mocked(setData).mockResolvedValue(mockStat);

                const handler = toolHandlers.find(h => h.name === 'write_node')!.handler;
                const result = await handler({
                    path: '/test/node',
                    content: 'test content',
                    encoding: 'utf16le'
                });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Node written successfully' }]
                });
                expect(setData).toHaveBeenCalledWith(
                    mockClient,
                    '/test/node',
                    Buffer.from('test content', 'utf16le')
                );
            });
        });

        describe('edit_node', () => {
            it('should apply diffs and update node', async () => {
                const mockData = Buffer.from('original text');
                const mockPatches = ['patch1', 'patch2'];
                const mockContent = 'modified text';

                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);
                vi.mocked(setData).mockResolvedValue(mockStat);

                const { diff_match_patch } = await import('diff-match-patch');
                const mockDmp = {
                    patch_make: vi.fn().mockReturnValue(mockPatches),
                    patch_apply: vi.fn().mockReturnValue([mockContent, [true]]),
                    patch_toText: vi.fn().mockReturnValue('patch text')
                } as unknown as InstanceType<typeof diff_match_patch>;
                vi.mocked(diff_match_patch).mockImplementation(() => mockDmp);

                const handler = toolHandlers.find(h => h.name === 'edit_node')!.handler;
                const result = await handler({
                    path: '/test/node',
                    diffs: [{ op: 1, text: 'modified' }],
                    dryRun: false
                });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'patch text' }]
                });
                expect(setData).toHaveBeenCalledWith(
                    mockClient,
                    '/test/node',
                    Buffer.from(mockContent, 'utf-8')
                );
            });

            it('should preview changes in dry run mode', async () => {
                const mockData = Buffer.from('original text');
                const mockPatches = ['patch1', 'patch2'];
                const mockContent = 'modified text';

                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);

                const { diff_match_patch } = await import('diff-match-patch');
                const mockDmp = {
                    patch_make: vi.fn().mockReturnValue(mockPatches),
                    patch_apply: vi.fn().mockReturnValue([mockContent, [true]]),
                    patch_toText: vi.fn().mockReturnValue('patch text')
                } as unknown as InstanceType<typeof diff_match_patch>;
                vi.mocked(diff_match_patch).mockImplementation(() => mockDmp);

                const handler = toolHandlers.find(h => h.name === 'edit_node')!.handler;
                const result = await handler({
                    path: '/test/node',
                    diffs: [{ op: 1, text: 'modified' }],
                    dryRun: true
                });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'patch text' }]
                });
                expect(setData).not.toHaveBeenCalled();
            });
        });

        describe('create_directory', () => {
            it('should create directory successfully', async () => {
                vi.mocked(makeDirs).mockResolvedValue('/test/dir');

                const handler = toolHandlers.find(h => h.name === 'create_directory')!.handler;
                const result = await handler({ path: '/test/dir' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Successfully created directory /test/dir' }]
                });
                expect(makeDirs).toHaveBeenCalledWith(mockClient, '/test/dir');
            });

            it('should handle directory creation errors', async () => {
                const error = new Error('Permission denied');
                vi.mocked(makeDirs).mockRejectedValue(error);

                const handler = toolHandlers.find(h => h.name === 'create_directory')!.handler;
                const result = await handler({ path: '/test/dir' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Error: Permission denied' }],
                    isError: true
                });
            });
        });

        describe('list_directory', () => {
            it('should list directory contents with nodes and directories', async () => {
                const mockChildren = ['file1.txt', 'dir1', 'file2.txt'];
                const mockDirStat = { ...mockStat, numChildren: 2 };
                const mockFileStat = { ...mockStat, numChildren: 0 };

                vi.mocked(getChildren).mockResolvedValue([mockChildren, mockDirStat]);
                vi.mocked(exists)
                    .mockResolvedValueOnce(mockFileStat) // file1.txt
                    .mockResolvedValueOnce(mockDirStat)  // dir1
                    .mockResolvedValueOnce(mockFileStat); // file2.txt

                const handler = toolHandlers.find(h => h.name === 'list_directory')!.handler;
                const result = await handler({ path: '/test' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: '[NODE] file1.txt\n[DIR] dir1\n[NODE] file2.txt' }]
                });
                expect(getChildren).toHaveBeenCalledWith(mockClient, '/test');
                expect(exists).toHaveBeenCalledWith(mockClient, '/test/file1.txt');
                expect(exists).toHaveBeenCalledWith(mockClient, '/test/dir1');
                expect(exists).toHaveBeenCalledWith(mockClient, '/test/file2.txt');
            });

            it('should handle empty directory', async () => {
                const mockChildren: string[] = [];
                const mockDirStat = { ...mockStat, numChildren: 0 };

                vi.mocked(getChildren).mockResolvedValue([mockChildren, mockDirStat]);

                const handler = toolHandlers.find(h => h.name === 'list_directory')!.handler;
                const result = await handler({ path: '/test' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: '' }]
                });
            });

            it('should handle errors gracefully', async () => {
                const error = new Error('Directory not found');
                vi.mocked(getChildren).mockRejectedValue(error);

                const handler = toolHandlers.find(h => h.name === 'list_directory')!.handler;
                const result = await handler({ path: '/test' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Error: Directory not found' }],
                    isError: true
                });
            });
        });

        describe('list_directory_with_sizes', () => {
            it('should list directory contents with sizes sorted by name', async () => {
                const mockChildren = ['file1.txt', 'dir1', 'file2.txt'];
                const mockDirStat = { ...mockStat, numChildren: 2, dataLength: 0 };
                const mockFileStat1 = { ...mockStat, numChildren: 0, dataLength: 100 };
                const mockFileStat2 = { ...mockStat, numChildren: 0, dataLength: 200 };

                vi.mocked(getChildren).mockResolvedValue([mockChildren, mockDirStat]);
                vi.mocked(exists)
                    .mockResolvedValueOnce(mockFileStat1) // file1.txt
                    .mockResolvedValueOnce(mockDirStat)   // dir1
                    .mockResolvedValueOnce(mockFileStat2); // file2.txt

                const handler = toolHandlers.find(h => h.name === 'list_directory_with_sizes')!.handler;
                const result = await handler({ path: '/test', sortBy: 'name' });

                expect(result.content[0].text).toContain('[DIR] dir1');
                expect(result.content[0].text).toContain('[FILE] file1.txt');
                expect(result.content[0].text).toContain('[FILE] file2.txt');
                expect(result.content[0].text).toContain('Total: 2 files, 1 directories');
                expect(result.content[0].text).toContain('Combined size: 300 B');

                // Verify specific size formatting
                expect(result.content[0].text).toContain('100 B'); // file1.txt size
                expect(result.content[0].text).toContain('200 B'); // file2.txt size
                expect(result.content[0].text).toContain('dir1'); // directory without size

                // 修正断言，移除多余的内容，只断言格式化输出的内容
                expect(result.content[0].text).toBe(
                    [
                        '[DIR] dir1                           ',
                        '[FILE] file1.txt                           100 B',
                        '[FILE] file2.txt                           200 B',
                        '',
                        'Total: 2 files, 1 directories',
                        'Combined size: 300 B'
                    ].join('\n')
                );
            });

            it('should list directory contents with sizes sorted by size', async () => {
                const mockChildren = ['file1.txt', 'dir1', 'file2.txt'];
                const mockDirStat = { ...mockStat, numChildren: 2, dataLength: 0 };
                const mockFileStat1 = { ...mockStat, numChildren: 0, dataLength: 100 };
                const mockFileStat2 = { ...mockStat, numChildren: 0, dataLength: 200 };

                vi.mocked(getChildren).mockResolvedValue([mockChildren, mockDirStat]);
                vi.mocked(exists)
                    .mockResolvedValueOnce(mockFileStat1) // file1.txt
                    .mockResolvedValueOnce(mockDirStat)   // dir1
                    .mockResolvedValueOnce(mockFileStat2); // file2.txt

                const handler = toolHandlers.find(h => h.name === 'list_directory_with_sizes')!.handler;
                const result = await handler({ path: '/test', sortBy: 'size' });

                expect(result.content[0].text).toContain('[FILE] file2.txt');
                expect(result.content[0].text).toContain('[FILE] file1.txt');
                expect(result.content[0].text).toContain('[DIR] dir1');

                expect(result.content[0].text).toBe(
                    [
                        '[FILE] file2.txt                           200 B',
                        '[FILE] file1.txt                           100 B',
                        '[DIR] dir1                           ',
                        '',
                        'Total: 2 files, 1 directories',
                        'Combined size: 300 B'
                    ].join('\n')
                );
            });

            it('should handle empty directory', async () => {
                const mockChildren: string[] = [];
                const mockDirStat = { ...mockStat, numChildren: 0, dataLength: 0 };

                vi.mocked(getChildren).mockResolvedValue([mockChildren, mockDirStat]);

                const handler = toolHandlers.find(h => h.name === 'list_directory_with_sizes')!.handler;
                const result = await handler({ path: '/test' });

                expect(result.content[0].text).toContain('Total: 0 files, 0 directories');
                expect(result.content[0].text).toContain('Combined size: 0 B');

                expect(result.content[0].text).toBe(
                    [
                        '',
                        'Total: 0 files, 0 directories',
                        'Combined size: 0 B'
                    ].join('\n')
                );
            });

            it('should format different size units correctly', async () => {
                const mockChildren = ['small.txt', 'medium.txt', 'large.txt', 'dir1'];
                const mockDirStat = { ...mockStat, numChildren: 1, dataLength: 0 };
                const mockSmallFile = { ...mockStat, numChildren: 0, dataLength: 512 }; // 512 B
                const mockMediumFile = { ...mockStat, numChildren: 0, dataLength: 1024 * 1.5 }; // 1.5 KB
                const mockLargeFile = { ...mockStat, numChildren: 0, dataLength: 1024 * 1024 * 2 }; // 2 MB

                vi.mocked(getChildren).mockResolvedValue([mockChildren, mockDirStat]);
                vi.mocked(exists)
                    .mockResolvedValueOnce(mockSmallFile)  // small.txt
                    .mockResolvedValueOnce(mockMediumFile) // medium.txt
                    .mockResolvedValueOnce(mockLargeFile)  // large.txt
                    .mockResolvedValueOnce(mockDirStat);   // dir1

                const handler = toolHandlers.find(h => h.name === 'list_directory_with_sizes')!.handler;
                const result = await handler({ path: '/test', sortBy: 'name' });

                expect(result.content[0].text).toContain('512 B'); // small.txt
                expect(result.content[0].text).toContain('1.50 KB'); // medium.txt
                expect(result.content[0].text).toContain('2.00 MB'); // large.txt
                expect(result.content[0].text).toContain('[DIR] dir1'); // directory without size
                expect(result.content[0].text).toContain('Total: 3 files, 1 directories');
                expect(result.content[0].text).toContain('Combined size: 2.00 MB');

                expect(result.content[0].text).toBe(
                    [
                        '[DIR] dir1                           ',
                        '[FILE] large.txt                         2.00 MB',
                        '[FILE] medium.txt                        1.50 KB',
                        '[FILE] small.txt                           512 B',
                        '',
                        'Total: 3 files, 1 directories',
                        'Combined size: 2.00 MB'
                    ].join('\n')
                );
            });

            it('should handle errors gracefully', async () => {
                const error = new Error('Directory not found');
                vi.mocked(getChildren).mockRejectedValue(error);

                const handler = toolHandlers.find(h => h.name === 'list_directory_with_sizes')!.handler;
                const result = await handler({ path: '/test' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Error: Directory not found' }],
                    isError: true
                });
            });
        });

        describe('list_directory_tree', () => {
            it('should return tree structure for directory with files and subdirectories', async () => {
                // Mock root directory children
                vi.mocked(getChildren).mockResolvedValueOnce([['file1.txt', 'dir1', 'file2.txt'], mockStat]);

                // Mock file stats
                const mockFileStat = { ...mockStat, numChildren: 0 };
                const mockDirStat = { ...mockStat, numChildren: 2 };

                // Mock exists calls for root level
                vi.mocked(exists)
                    .mockResolvedValueOnce(mockFileStat)  // file1.txt
                    .mockResolvedValueOnce(mockDirStat)   // dir1
                    .mockResolvedValueOnce(mockFileStat); // file2.txt

                // Mock subdirectory children
                vi.mocked(getChildren).mockResolvedValueOnce([['subfile.txt'], mockStat]);

                // Mock exists calls for subdirectory
                vi.mocked(exists).mockResolvedValueOnce(mockFileStat); // subfile.txt

                const handler = toolHandlers.find(h => h.name === 'list_directory_tree')!.handler;
                const result = await handler({ path: '/test' });

                const expectedTree = [
                    {
                        name: 'file1.txt',
                        type: 'file'
                    },
                    {
                        name: 'dir1',
                        type: 'directory',
                        children: [
                            {
                                name: 'subfile.txt',
                                type: 'file'
                            }
                        ]
                    },
                    {
                        name: 'file2.txt',
                        type: 'file'
                    }
                ];

                expect(result).toEqual({
                    content: [{ type: 'text', text: JSON.stringify(expectedTree, null, 2) }]
                });

                expect(getChildren).toHaveBeenCalledWith(mockClient, '/test');
                expect(getChildren).toHaveBeenCalledWith(mockClient, '/test/dir1');
            });

            it('should handle empty directory', async () => {
                vi.mocked(getChildren).mockResolvedValue([[], mockStat]);

                const handler = toolHandlers.find(h => h.name === 'list_directory_tree')!.handler;
                const result = await handler({ path: '/test' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: '[]' }]
                });
            });

            it('should exclude files and directories based on patterns', async () => {
                // Mock root directory children
                vi.mocked(getChildren).mockResolvedValueOnce([['file1.txt', 'temp.log', 'dir1', 'cache'], mockStat]);

                const mockFileStat = { ...mockStat, numChildren: 0 };
                const mockDirStat = { ...mockStat, numChildren: 1 };

                // Mock exists calls for root level (only for non-excluded items)
                vi.mocked(exists)
                    .mockResolvedValueOnce(mockFileStat)  // file1.txt (not excluded)
                    .mockResolvedValueOnce(mockDirStat);  // dir1 (not excluded)
                // temp.log and cache are excluded, so no exists calls for them

                // Mock subdirectory children (only dir1 should be processed)
                vi.mocked(getChildren).mockResolvedValueOnce([['subfile.txt'], mockStat]);
                vi.mocked(exists).mockResolvedValueOnce(mockFileStat); // subfile.txt

                const handler = toolHandlers.find(h => h.name === 'list_directory_tree')!.handler;
                const result = await handler({
                    path: '/test',
                    excludePatterns: ['*.log', 'cache']
                });

                const expectedTree = [
                    {
                        name: 'file1.txt',
                        type: 'file'
                    },
                    {
                        name: 'dir1',
                        type: 'directory',
                        children: [
                            {
                                name: 'subfile.txt',
                                type: 'file'
                            }
                        ]
                    }
                ];

                expect(result).toEqual({
                    content: [{ type: 'text', text: JSON.stringify(expectedTree, null, 2) }]
                });
            });

            it('should handle wildcard exclusion patterns', async () => {
                // Mock root directory children
                vi.mocked(getChildren).mockResolvedValueOnce([['file1.txt', 'temp.log', 'backup.tmp'], mockStat]);

                const mockFileStat = { ...mockStat, numChildren: 0 };

                // Mock exists calls for root level
                vi.mocked(exists)
                    .mockResolvedValueOnce(mockFileStat)  // file1.txt
                    .mockResolvedValueOnce(mockFileStat)  // temp.log
                    .mockResolvedValueOnce(mockFileStat); // backup.tmp

                const handler = toolHandlers.find(h => h.name === 'list_directory_tree')!.handler;
                const result = await handler({
                    path: '/test',
                    excludePatterns: ['*.log', '*.tmp']
                });

                const expectedTree = [
                    {
                        name: 'file1.txt',
                        type: 'file'
                    }
                ];

                expect(result).toEqual({
                    content: [{ type: 'text', text: JSON.stringify(expectedTree, null, 2) }]
                });
            });

            it('should handle nested directory exclusion patterns', async () => {
                // Mock root directory children
                vi.mocked(getChildren).mockResolvedValueOnce([['dir1', 'dir2'], mockStat]);

                const mockDirStat = { ...mockStat, numChildren: 1 };

                // Mock exists calls for root level (only for non-excluded items)
                vi.mocked(exists)
                    .mockResolvedValueOnce(mockDirStat); // dir2 (dir1 is excluded)

                // Mock subdirectory children (only dir2 should be processed)
                vi.mocked(getChildren).mockResolvedValueOnce([['file2.txt'], mockStat]); // dir2

                vi.mocked(exists).mockResolvedValueOnce({ ...mockStat, numChildren: 0 }); // dir2/file2.txt

                const handler = toolHandlers.find(h => h.name === 'list_directory_tree')!.handler;
                const result = await handler({
                    path: '/test',
                    excludePatterns: ['dir1/**']
                });

                const expectedTree = [
                    {
                        name: 'dir2',
                        type: 'directory',
                        children: [
                            {
                                name: 'file2.txt',
                                type: 'file'
                            }
                        ]
                    }
                ];

                expect(result).toEqual({
                    content: [{ type: 'text', text: JSON.stringify(expectedTree, null, 2) }]
                });
            });

            it('should handle errors gracefully', async () => {
                const error = new Error('Directory not found');
                vi.mocked(getChildren).mockRejectedValue(error);

                const handler = toolHandlers.find(h => h.name === 'list_directory_tree')!.handler;
                const result = await handler({ path: '/test' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Error: Directory not found' }],
                    isError: true
                });
            });

            it('should handle missing files gracefully', async () => {
                // Mock root directory children
                vi.mocked(getChildren).mockResolvedValueOnce([['file1.txt', 'missing.txt'], mockStat]);

                const mockFileStat = { ...mockStat, numChildren: 0 };

                // Mock exists calls - one file exists, one doesn't
                vi.mocked(exists)
                    .mockResolvedValueOnce(mockFileStat)  // file1.txt
                    .mockResolvedValueOnce(null);         // missing.txt (should be skipped)

                const handler = toolHandlers.find(h => h.name === 'list_directory_tree')!.handler;
                const result = await handler({ path: '/test' });

                const expectedTree = [
                    {
                        name: 'file1.txt',
                        type: 'file'
                    }
                ];

                expect(result).toEqual({
                    content: [{ type: 'text', text: JSON.stringify(expectedTree, null, 2) }]
                });
            });
        });

        describe('get_node_stat', () => {
            it('should return formatted stat for existing node', async () => {
                const stat = {
                    ...mockStat,
                    mtime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    ctime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 2]),
                    czxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 3]),
                    mzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 4]),
                    dataLength: 123,
                    numChildren: 2,
                    version: 0,
                    cversion: 0,
                } as Stat;

                vi.mocked(exists).mockResolvedValue(stat);

                const handler = toolHandlers.find(h => h.name === 'get_node_stat')!.handler;
                const result = await handler({ path: '/test/node' });

                expect(result.content[0].text as string).toBe(
                    [
                        'Node: /test/node',
                        'Creation Zxid: 3',
                        'Last Modified Zxid: 4',
                        'Creation Time: Thu, 01 Jan 1970 00:00:00 GMT',
                        'Last Modified Time: Thu, 01 Jan 1970 00:00:00 GMT',
                        'Version: 0',
                        'Creation Version: 0',
                        'Children: 2',
                        'Size: 123'
                    ].join('\n')
                );

                expect(exists).toHaveBeenCalledWith(mockClient, '/test/node');
            });

            it('should return not exist message when node is missing', async () => {
                vi.mocked(exists).mockResolvedValue(null);

                const handler = toolHandlers.find(h => h.name === 'get_node_stat')!.handler;
                const result = await handler({ path: '/missing' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Node does not exist' }]
                });
            });

            it('should handle errors gracefully', async () => {
                vi.mocked(exists).mockRejectedValue(new Error('Stat error'));

                const handler = toolHandlers.find(h => h.name === 'get_node_stat')!.handler;
                const result = await handler({ path: '/error' });

                expect(result).toEqual({
                    content: [{ type: 'text', text: 'Error: Stat error' }],
                    isError: true
                });
            });
        });
    });

    describe('formatSize', () => {
        it('should format bytes correctly', () => {
            expect(formatSize(0)).toBe('0 B');
            expect(formatSize(1)).toBe('1 B');
            expect(formatSize(1023)).toBe('1023 B');
        });

        it('should format kilobytes correctly', () => {
            expect(formatSize(1024)).toBe('1.00 KB');
            expect(formatSize(1536)).toBe('1.50 KB');
            expect(formatSize(2048)).toBe('2.00 KB');
        });

        it('should format megabytes correctly', () => {
            expect(formatSize(1024 * 1024)).toBe('1.00 MB');
            expect(formatSize(1024 * 1024 * 1.5)).toBe('1.50 MB');
            expect(formatSize(1024 * 1024 * 2)).toBe('2.00 MB');
        });

        it('should format gigabytes correctly', () => {
            expect(formatSize(1024 * 1024 * 1024)).toBe('1.00 GB');
            expect(formatSize(1024 * 1024 * 1024 * 1.5)).toBe('1.50 GB');
        });

        it('should format terabytes correctly', () => {
            expect(formatSize(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
            expect(formatSize(1024 * 1024 * 1024 * 1024 * 2.5)).toBe('2.50 TB');
        });

        it('should handle very large numbers', () => {
            const veryLarge = 1024 * 1024 * 1024 * 1024 * 1024; // 1 PB
            expect(formatSize(veryLarge)).toBe('1024.00 TB');
        });

        it('should handle negative numbers', () => {
            expect(formatSize(-1)).toBe('0 B');
            expect(formatSize(-1024)).toBe('0 B');
        });
    });
});
