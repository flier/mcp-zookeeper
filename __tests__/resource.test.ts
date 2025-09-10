import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerResources } from '../src/resource';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from 'node-zookeeper-client';
import { getChildren, getData } from '../src/zk';

// Mock dependencies
vi.mock('../src/zk', () => ({
    getChildren: vi.fn(),
    getData: vi.fn(),
}));

describe('Resource Functions', () => {
    let mockClient: Client;
    let mockServer: McpServer;
    let mockApp: { resource: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockClient = {} as Client;
        mockApp = {
            resource: vi.fn(),
        };
        mockServer = mockApp as unknown as McpServer;
    });

    describe('registerResources', () => {
        it('should register node resource with the server', () => {
            registerResources(mockClient, mockServer);

            expect(mockServer.resource).toHaveBeenCalledTimes(1);
            expect(mockServer.resource).toHaveBeenCalledWith(
                'node',
                expect.any(Object),
                expect.any(Object),
                expect.any(Function)
            );
        });
    });

    describe('Node Resource Handler', () => {
        let resourceHandler: (uri: URL, args: { node: string | string[] }, context: Record<string, unknown>) => Promise<{ contents: Array<{ uri: string; blob: string }> }>;
        let completionHandler: (path: string, context: Record<string, unknown>) => Promise<string[]>;

        beforeEach(() => {
            registerResources(mockClient, mockServer);
            const resourceCall = mockApp.resource.mock.calls[0] as unknown[];
            const resourceTemplate = resourceCall[1] as { _callbacks: { complete: { node: (value: string, context: Record<string, unknown>) => Promise<string[]> } } };
            resourceHandler = resourceCall[3] as (uri: URL, args: { node: string | string[] }, context: Record<string, unknown>) => Promise<{ contents: Array<{ uri: string; blob: string }> }>;
            // ResourceTemplate has _callbacks.complete.node structure
            completionHandler = resourceTemplate?._callbacks?.complete?.node || (() => Promise.resolve([]));
        });

        describe('completion handler', () => {
            it('should complete node paths correctly', async () => {
                const mockChildren = ['file1.txt', 'file2.txt', 'dir1', 'dir2'];
                vi.mocked(getChildren).mockResolvedValue([mockChildren, {} as unknown as { version: number; ctime: Buffer; mtime: Buffer; cversion: number; aversion: number; ephemeralOwner: Buffer; dataLength: number; numChildren: number; pzxid: Buffer; mzxid: Buffer; czxid: Buffer }]);

                const result = await completionHandler('test/', {});

                expect(result).toEqual([
                    'test/file1.txt',
                    'test/file2.txt',
                    'test/dir1',
                    'test/dir2'
                ]);
                expect(getChildren).toHaveBeenCalledWith(mockClient, 'test');
            });

            it('should filter children by base name', async () => {
                const mockChildren = ['file1.txt', 'file2.txt', 'file3.log', 'dir1'];
                vi.mocked(getChildren).mockResolvedValue([mockChildren, {} as unknown as { version: number; ctime: Buffer; mtime: Buffer; cversion: number; aversion: number; ephemeralOwner: Buffer; dataLength: number; numChildren: number; pzxid: Buffer; mzxid: Buffer; czxid: Buffer }]);

                const result = await completionHandler('test/fi', {});

                expect(result).toEqual([
                    'test/file1.txt',
                    'test/file2.txt',
                    'test/file3.log'
                ]);
                expect(getChildren).toHaveBeenCalledWith(mockClient, 'test');
            });

            it('should handle root path completion', async () => {
                const mockChildren = ['root1', 'root2', 'root3'];
                vi.mocked(getChildren).mockResolvedValue([mockChildren, {} as unknown as { version: number; ctime: Buffer; mtime: Buffer; cversion: number; aversion: number; ephemeralOwner: Buffer; dataLength: number; numChildren: number; pzxid: Buffer; mzxid: Buffer; czxid: Buffer }]);

                const result = await completionHandler('/', {});

                expect(result).toEqual([
                    'root1',
                    'root2',
                    'root3'
                ]);
                expect(getChildren).toHaveBeenCalledWith(mockClient, '');
            });

            it('should handle empty children list', async () => {
                vi.mocked(getChildren).mockResolvedValue([[], {} as unknown as { version: number; ctime: Buffer; mtime: Buffer; cversion: number; aversion: number; ephemeralOwner: Buffer; dataLength: number; numChildren: number; pzxid: Buffer; mzxid: Buffer; czxid: Buffer }]);

                const result = await completionHandler('test/', {});

                expect(result).toEqual([]);
                expect(getChildren).toHaveBeenCalledWith(mockClient, 'test');
            });

            it('should handle completion errors gracefully', async () => {
                const error = new Error('Connection failed');
                vi.mocked(getChildren).mockRejectedValue(error);

                await expect(completionHandler('test/', {})).rejects.toThrow('Connection failed');
            });
        });

        describe('resource handler', () => {
            it('should read node content for single node path', async () => {
                const mockData = Buffer.from('node content');
                const mockStat = {
                    version: 1,
                    czxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    mzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    ctime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    mtime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    cversion: 0,
                    aversion: 0,
                    ephemeralOwner: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
                    dataLength: 0,
                    numChildren: 0,
                    pzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1])
                };
                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);

                const uri = new URL('zk:///test/node');
                const result = await resourceHandler(uri, { node: 'test/node' }, {});

                expect(result).toEqual({
                    contents: [{
                        uri: 'zk:///test/node',
                        blob: mockData.toString('base64')
                    }]
                });
                expect(getData).toHaveBeenCalledWith(mockClient, 'test/node');
            });

            it('should read node content for array node path', async () => {
                const mockData = Buffer.from('node content');
                const mockStat = {
                    version: 1,
                    czxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    mzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    ctime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    mtime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    cversion: 0,
                    aversion: 0,
                    ephemeralOwner: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
                    dataLength: 0,
                    numChildren: 0,
                    pzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1])
                };
                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);

                const uri = new URL('zk:///test/node');
                const result = await resourceHandler(uri, { node: ['test', 'node'] }, {});

                expect(result).toEqual({
                    contents: [{
                        uri: 'zk:///test/node',
                        blob: mockData.toString('base64')
                    }]
                });
                expect(getData).toHaveBeenCalledWith(mockClient, 'test/node');
            });

            it('should handle URL-encoded node paths', async () => {
                const mockData = Buffer.from('encoded content');
                const mockStat = {
                    version: 1,
                    czxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    mzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    ctime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    mtime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    cversion: 0,
                    aversion: 0,
                    ephemeralOwner: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
                    dataLength: 0,
                    numChildren: 0,
                    pzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1])
                };
                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);

                const uri = new URL('zk:///test%20node');
                const result = await resourceHandler(uri, { node: 'test%20node' }, {});

                expect(result).toEqual({
                    contents: [{
                        uri: 'zk:///test%20node',
                        blob: mockData.toString('base64')
                    }]
                });
                expect(getData).toHaveBeenCalledWith(mockClient, 'test node');
            });

            it('should handle binary node content', async () => {
                const mockData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
                const mockStat = {
                    version: 1,
                    czxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    mzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    ctime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    mtime: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
                    cversion: 0,
                    aversion: 0,
                    ephemeralOwner: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
                    dataLength: 0,
                    numChildren: 0,
                    pzxid: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1])
                };
                vi.mocked(getData).mockResolvedValue([mockData, mockStat]);

                const uri = new URL('zk:///test/image.png');
                const result = await resourceHandler(uri, { node: 'test/image.png' }, {});

                expect(result).toEqual({
                    contents: [{
                        uri: 'zk:///test/image.png',
                        blob: mockData.toString('base64')
                    }]
                });
            });

            it('should handle resource reading errors gracefully', async () => {
                const error = new Error('Node not found');
                vi.mocked(getData).mockRejectedValue(error);

                const uri = new URL('zk:///test/node');
                await expect(resourceHandler(uri, { node: 'test/node' }, {})).rejects.toThrow('Node not found');
            });
        });
    });
});
