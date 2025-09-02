import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";
import errorhandler from "errorhandler";
import morgan from "morgan";
import fs from "fs";

export type HttpServerOptions = {
    host: string,
    port: number,
}

export const defaultHttpServerOptions: HttpServerOptions = {
    host: "127.0.0.1",
    port: 8080,
}

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

export function runHttpServer(server: McpServer, options?: HttpServerOptions) {
    const { host, port } = options ?? defaultHttpServerOptions;

    const app = express();

    app.use(morgan('combined', { stream: fs.createWriteStream('access.log', { flags: 'a' }) }))
    app.use(express.json());

    if (process.env.NODE_ENV === 'development') {
        app.use(errorhandler());
    }

    // Add CORS middleware before your MCP routes
    app.use(cors({
        origin: "*",
        exposedHeaders: ['Mcp-Session-Id'],
        allowedHeaders: ['Content-Type', 'mcp-session-id'],
    }));

    // Handle POST requests for client-to-server communication
    app.post('/mcp', async (req: express.Request, res: express.Response) => {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
            // Reuse existing transport
            transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
            // New initialization request
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (sessionId) => {
                    // Store the transport by session ID
                    transports[sessionId] = transport;
                },
            });

            // Clean up transport when closed
            transport.onclose = () => {
                if (transport.sessionId) {
                    delete transports[transport.sessionId];
                }
            };

            // Connect to the MCP server
            await server.connect(transport);
        } else {
            // Invalid request
            res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Bad Request: No valid session ID provided',
                },
                id: null,
            });

            return;
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
    });

    // Reusable handler for GET and DELETE requests
    const handleSessionRequest = async (req: express.Request, res: express.Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }

        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
    };

    app.get('/mcp', handleSessionRequest);
    app.delete('/mcp', handleSessionRequest);

    app.listen(port, host, () => {
        console.info(`MCP Zookeeper Server running on http://${host}:${port}/mcp`);
    });
}