import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerTools } from '../src/tool';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from 'node-zookeeper-client';
import { getData, setData, makeDirs } from '../src/zk';
import type { Stat } from 'node-zookeeper-client';

// Mock dependencies
vi.mock('../src/zk', () => ({
    getData: vi.fn(),
    setData: vi.fn(),
    makeDirs: vi.fn(),
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
    czxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
    mzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
    ctime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
    mtime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
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

    beforeEach(() => {
        mockClient = {} as Client;
        mockServer = {
            tool: vi.fn(),
        } as unknown as McpServer;
    });

    describe('registerTools', () => {
        it('should register all tools with the server', () => {
            registerTools(mockClient, mockServer);

            expect(mockServer.tool).toHaveBeenCalledTimes(6);
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
    });
});
