import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runHttpServer, defaultHttpServerOptions, HttpServerOptions, transports } from '../src/http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

// Mock dependencies
vi.mock('express', () => {
    const mockApp = {
        use: vi.fn(),
        post: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        listen: vi.fn(),
    };
    const mockExpress = vi.fn(() => mockApp);
    (mockExpress as unknown as { json: ReturnType<typeof vi.fn> }).json = vi.fn(() => (req: Request, res: Response, next: NextFunction) => next());
    return {
        default: mockExpress,
    };
});

vi.mock('cors', () => ({
    default: vi.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

vi.mock('morgan', () => ({
    default: vi.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

vi.mock('errorhandler', () => ({
    default: vi.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

vi.mock('fs', () => ({
    default: {
        createWriteStream: vi.fn(() => ({ write: vi.fn() })),
    },
    createWriteStream: vi.fn(() => ({ write: vi.fn() })),
}));

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
    StreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
        onclose: null,
        sessionId: 'test-session-id',
        handleRequest: vi.fn(),
    })),
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
    isInitializeRequest: vi.fn(),
}));

vi.mock('node:crypto', () => ({
    randomUUID: vi.fn(() => 'test-uuid'),
}));


interface MockApp {
    use: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    listen: ReturnType<typeof vi.fn>;
}

interface MockExpress {
    (): MockApp;
    json: ReturnType<typeof vi.fn>;
    mockReturnValue: ReturnType<typeof vi.fn>;
}

describe('HTTP Server', () => {
    let mockServer: McpServer;
    let mockApp: MockApp;
    let mockExpress: MockExpress;

    beforeEach(() => {
        mockServer = {
            connect: vi.fn(),
        } as unknown as McpServer;

        mockApp = {
            use: vi.fn(),
            post: vi.fn(),
            get: vi.fn(),
            delete: vi.fn(),
            listen: vi.fn(),
        };

        mockExpress = vi.mocked(express) as unknown as MockExpress;
        mockExpress.mockReturnValue(mockApp);
    });

    afterEach(() => {
        // Clear transports object
        Object.keys(transports).forEach(key => delete transports[key]);
    });

    describe('runHttpServer', () => {
        it('should create Express app with default options', () => {
            runHttpServer(mockServer);

            expect(mockExpress).toHaveBeenCalled();
            expect(mockApp.listen).toHaveBeenCalledWith(
                defaultHttpServerOptions.port,
                defaultHttpServerOptions.host,
                expect.any(Function)
            );
        });

        it('should create Express app with custom options', () => {
            const options: HttpServerOptions = {
                host: '0.0.0.0',
                port: 3000,
            };

            runHttpServer(mockServer, options);

            expect(mockApp.listen).toHaveBeenCalledWith(
                options.port,
                options.host,
                expect.any(Function)
            );
        });

        it('should set up middleware', () => {
            runHttpServer(mockServer);

            // Check that middleware is set up
            expect(mockApp.use).toHaveBeenCalled();
            expect(mockApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
            expect(mockApp.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
            expect(mockApp.delete).toHaveBeenCalledWith('/mcp', expect.any(Function));
        });

        it('should handle development environment', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            runHttpServer(mockServer);

            expect(mockApp.use).toHaveBeenCalled();

            process.env.NODE_ENV = originalEnv;
        });

        it('should handle production environment', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            runHttpServer(mockServer);

            expect(mockApp.use).toHaveBeenCalled();

            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('defaultHttpServerOptions', () => {
        it('should have correct default values', () => {
            expect(defaultHttpServerOptions).toEqual({
                host: '127.0.0.1',
                port: 8080,
            });
        });
    });

    describe('POST /mcp handler', () => {
        let postHandler: (req: Request, res: Response) => Promise<void>;

        beforeEach(() => {
            runHttpServer(mockServer);
            const postCall = mockApp.post.mock.calls.find((call: unknown[]) => call[0] === '/mcp');
            postHandler = postCall?.[1] as (req: Request, res: Response) => Promise<void>;
        });

        it('should handle new initialization request', async () => {
            const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
            const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');

            vi.mocked(isInitializeRequest).mockReturnValue(true);

            // Mock the transport with handleRequest method
            const mockTransport = {
                handleRequest: vi.fn(),
                sessionId: 'test-session-id',
                onclose: null,
            };
            vi.mocked(StreamableHTTPServerTransport).mockImplementation(() => mockTransport as unknown as InstanceType<typeof StreamableHTTPServerTransport>);

            const mockReq = {
                headers: {},
                body: { method: 'initialize' },
            } as unknown as Request;
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            } as unknown as Response;

            await postHandler(mockReq, mockRes);

            expect(mockServer.connect).toHaveBeenCalled();
            expect(mockTransport.handleRequest).toHaveBeenCalledWith(mockReq, mockRes, mockReq.body);
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should handle existing session', async () => {
            const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
            const mockTransport = {
                handleRequest: vi.fn(),
                sessionId: 'existing-session',
            };
            vi.mocked(StreamableHTTPServerTransport).mockImplementation(() => mockTransport as unknown as InstanceType<typeof StreamableHTTPServerTransport>);

            // Set up the transport in the transports object
            transports['existing-session'] = mockTransport as unknown as InstanceType<typeof StreamableHTTPServerTransport>;

            const mockReq = {
                headers: { 'mcp-session-id': 'existing-session' },
                body: { method: 'test' },
            } as unknown as Request;
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            } as unknown as Response;

            await postHandler(mockReq, mockRes);

            expect(mockTransport.handleRequest).toHaveBeenCalledWith(mockReq, mockRes, mockReq.body);
        });

        it('should handle invalid request without session ID', async () => {
            const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
            vi.mocked(isInitializeRequest).mockReturnValue(false);

            const mockReq = {
                headers: {},
                body: { method: 'test' },
            } as unknown as Request;
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            } as unknown as Response;

            await postHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Bad Request: No valid session ID provided',
                },
                id: null,
            });
        });
    });

    describe('GET /mcp handler', () => {
        let getHandler: (req: Request, res: Response) => Promise<void>;

        beforeEach(() => {
            runHttpServer(mockServer);
            const getCall = mockApp.get.mock.calls.find((call: unknown[]) => call[0] === '/mcp');
            getHandler = getCall?.[1] as (req: Request, res: Response) => Promise<void>;
        });

        it('should handle valid session request', async () => {
            const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
            const mockTransport = {
                handleRequest: vi.fn(),
                sessionId: 'test-session',
            };
            vi.mocked(StreamableHTTPServerTransport).mockImplementation(() => mockTransport as unknown as InstanceType<typeof StreamableHTTPServerTransport>);

            // Set up the transport in the transports object
            transports['test-session'] = mockTransport as unknown as InstanceType<typeof StreamableHTTPServerTransport>;

            const mockReq = {
                headers: { 'mcp-session-id': 'test-session' },
            } as unknown as Request;
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
            } as unknown as Response;

            await getHandler(mockReq, mockRes);

            expect(mockTransport.handleRequest).toHaveBeenCalledWith(mockReq, mockRes);
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should handle invalid session request', async () => {
            const mockReq = {
                headers: {},
            } as unknown as Request;
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
            } as unknown as Response;

            await getHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith('Invalid or missing session ID');
        });
    });

    describe('DELETE /mcp handler', () => {
        let deleteHandler: (req: Request, res: Response) => Promise<void>;

        beforeEach(() => {
            runHttpServer(mockServer);
            const deleteCall = mockApp.delete.mock.calls.find((call: unknown[]) => call[0] === '/mcp');
            deleteHandler = deleteCall?.[1] as (req: Request, res: Response) => Promise<void>;
        });

        it('should handle valid session request', async () => {
            const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
            const mockTransport = {
                handleRequest: vi.fn(),
                sessionId: 'test-session',
            };
            vi.mocked(StreamableHTTPServerTransport).mockImplementation(() => mockTransport as unknown as InstanceType<typeof StreamableHTTPServerTransport>);

            // Set up the transport in the transports object
            transports['test-session'] = mockTransport as unknown as InstanceType<typeof StreamableHTTPServerTransport>;

            const mockReq = {
                headers: { 'mcp-session-id': 'test-session' },
            } as unknown as Request;
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
            } as unknown as Response;

            await deleteHandler(mockReq, mockRes);

            expect(mockTransport.handleRequest).toHaveBeenCalledWith(mockReq, mockRes);
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should handle invalid session request', async () => {
            const mockReq = {
                headers: {},
            } as unknown as Request;
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
            } as unknown as Response;

            await deleteHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith('Invalid or missing session ID');
        });
    });
});
