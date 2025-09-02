import { parseArgs } from 'node:util';

import { Server } from "./lib.js";

const { values, positionals } = parseArgs({
    args: process.argv,
    options: {
        help: { type: "boolean" as const, short: "h", default: false },
        host: { type: "string" as const, short: "h", default: "127.0.0.1" },
        port: { type: "string" as const, short: "p" },
        zkServers: { type: "string" as const, short: "z", default: process.env.ZOOKEEPER_SERVERS ?? "localhost:2181" },
    },
    allowPositionals: true,
});

console.error("parsed", values, positionals);

const { help, host, port, zkServers } = values;

if (help) {
    console.error("Usage: mcp-server-zookeeper [options]");
    console.error("Options:");
    console.error("  -h, --host=HOST            The host to listen on (default: 127.0.0.1)");
    console.error("  -p, --port=PORT            The port to listen on");
    console.error("  -z, --zkServers=SERVERS    The ZooKeeper servers (default: localhost:2181)");
    process.exit(0);
}

// Start server
async function runServer() {
    const server = new Server(zkServers);

    if (port) {
        server.serveHttp({ host, port: parseInt(port) });
    } else {
        await server.serveStdio();
    }
}

runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
