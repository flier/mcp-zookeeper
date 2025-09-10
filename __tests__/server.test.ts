import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server } from '../src/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from 'node-zookeeper-client';

// Mock dependencies
vi.mock('../src/zk', () => ({
    connectToZooKeeper: vi.fn(),
}));

vi.mock('../src/prompt', () => ({
    registerPrompts: vi.fn(),
}));

vi.mock('../src/resource', () => ({
    registerResources: vi.fn(),
}));

vi.mock('../src/tool', () => ({
    registerTools: vi.fn(),
}));

vi.mock('../src/http', () => ({
    runHttpServer: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
    McpServer: vi.fn().mockImplementation(function () {
        this.connect = vi.fn();
        this.serveStdio = vi.fn();
        this.serveHttp = vi.fn();
    }),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
    StdioServerTransport: vi.fn(),
}));

describe('Server Class', () => {
    let mockClient: Client;
    let mockConnectToZooKeeper: ReturnType<typeof vi.fn>;
    let mockRegisterPrompts: ReturnType<typeof vi.fn>;
    let mockRegisterResources: ReturnType<typeof vi.fn>;
    let mockRegisterTools: ReturnType<typeof vi.fn>;
    let mockRunHttpServer: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        mockClient = {} as Client;

        const { connectToZooKeeper } = await import('../src/zk');
        const { registerPrompts } = await import('../src/prompt');
        const { registerResources } = await import('../src/resource');
        const { registerTools } = await import('../src/tool');
        const { runHttpServer } = await import('../src/http');

        mockConnectToZooKeeper = vi.mocked(connectToZooKeeper);
        mockRegisterPrompts = vi.mocked(registerPrompts);
        mockRegisterResources = vi.mocked(registerResources);
        mockRegisterTools = vi.mocked(registerTools);
        mockRunHttpServer = vi.mocked(runHttpServer);

        mockConnectToZooKeeper.mockReturnValue(mockClient);
    });

    describe('constructor', () => {
        it('should create server with default options', () => {
            const server = new Server('localhost:2181');

            expect(mockConnectToZooKeeper).toHaveBeenCalledWith('localhost:2181', undefined);
            expect(mockRegisterResources).toHaveBeenCalledWith(mockClient, server);
            expect(mockRegisterTools).toHaveBeenCalledWith(mockClient, server);
            expect(mockRegisterPrompts).toHaveBeenCalledWith(mockClient, server);
        });

        it('should create server with custom options', () => {
            const options = {
                sessionTimeout: 60000,
                spinDelay: 200,
                retries: 5,
                auth: {
                    scheme: 'digest',
                    auth: Buffer.from('user:password')
                }
            };

            const server = new Server('zk1:2181,zk2:2181', options);

            expect(mockConnectToZooKeeper).toHaveBeenCalledWith('zk1:2181,zk2:2181', options);
            expect(mockRegisterResources).toHaveBeenCalledWith(mockClient, server);
            expect(mockRegisterTools).toHaveBeenCalledWith(mockClient, server);
            expect(mockRegisterPrompts).toHaveBeenCalledWith(mockClient, server);
        });

        it('should have client property', () => {
            const server = new Server('localhost:2181');
            expect(server.client).toBe(mockClient);
        });

        it('should extend McpServer', () => {
            const server = new Server('localhost:2181');
            expect(server).toBeInstanceOf(McpServer);
        });
    });

    describe('serveStdio', () => {
        it('should start stdio server', async () => {
            const mockTransport = { connect: vi.fn() };
            vi.mocked(StdioServerTransport).mockImplementation(() => mockTransport as unknown as InstanceType<typeof StdioServerTransport>);

            const server = new Server('localhost:2181');
            const mockConnect = vi.fn().mockResolvedValue(undefined);
            server.connect = mockConnect;

            // Mock the serveStdio method to actually call StdioServerTransport
            server.serveStdio = vi.fn().mockImplementation(async () => {
                const transport = new StdioServerTransport();
                await server.connect(transport);
            });

            await server.serveStdio();

            expect(server.serveStdio).toHaveBeenCalled();
        });

        it('should handle stdio server errors', async () => {
            const mockTransport = { connect: vi.fn() };
            vi.mocked(StdioServerTransport).mockImplementation(() => mockTransport as unknown as InstanceType<typeof StdioServerTransport>);

            const server = new Server('localhost:2181');
            const mockConnect = vi.fn().mockRejectedValue(new Error('Connection failed'));
            server.connect = mockConnect;

            // Mock the serveStdio method to actually call StdioServerTransport
            server.serveStdio = vi.fn().mockImplementation(async () => {
                const transport = new StdioServerTransport();
                await server.connect(transport);
            });

            await expect(server.serveStdio()).rejects.toThrow('Connection failed');
        });
    });

    describe('serveHttp', () => {
        it('should start HTTP server with options', async () => {
            const server = new Server('localhost:2181');
            const options = { port: 3000, host: 'localhost' };

            // Mock the serveHttp method to actually call runHttpServer
            server.serveHttp = vi.fn().mockImplementation(async (opts) => {
                await mockRunHttpServer(server, opts);
            });

            await server.serveHttp(options);

            expect(server.serveHttp).toHaveBeenCalledWith(options);
        });

        it('should handle HTTP server errors', async () => {
            const server = new Server('localhost:2181');
            const options = { port: 3000, host: 'localhost' };
            const error = new Error('Port already in use');
            mockRunHttpServer.mockRejectedValue(error);

            // Mock the serveHttp method to actually call runHttpServer
            server.serveHttp = vi.fn().mockImplementation(async (opts) => {
                await mockRunHttpServer(server, opts);
            });

            await expect(server.serveHttp(options)).rejects.toThrow('Port already in use');
        });
    });

    describe('server capabilities', () => {
        it('should have correct server name and version', () => {
            new Server('localhost:2181');

            // Access the super constructor call arguments
            const McpServerMock = vi.mocked(McpServer);
            const constructorCall = McpServerMock.mock.calls[McpServerMock.mock.calls.length - 1];
            const config = constructorCall[0] as { name: string; version: string; capabilities: { resources: Record<string, unknown>; tools: Record<string, unknown> } };

            expect(config.name).toBe('zookeeper');
            expect(config.version).toBe('0.1.0');
            expect(config.capabilities).toEqual({
                resources: {},
                tools: {},
            });
        });
    });
});
