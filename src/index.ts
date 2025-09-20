import { parseArgs } from 'node:util';

import { Server } from "./lib.js";

const { values, positionals } = parseArgs({
    args: process.argv,
    options: {
        help: { type: "boolean" as const, short: "h", default: false },
        host: { type: "string" as const, short: "h", default: "127.0.0.1" },
        port: { type: "string" as const, short: "p" },
        zkServers: { type: "string" as const, short: "s", default: process.env.ZK_SERVERS ?? "localhost:2181" },
        zkSessionTimeout: { type: "string" as const, short: "t", default: process.env.ZK_SESSION_TIMEOUT ?? "30000" },
        zkSpinDelay: { type: "string" as const, short: "d", default: process.env.ZK_SPIN_DELAY ?? "100" },
        zkRetries: { type: "string" as const, short: "r", default: process.env.ZK_RETRIES ?? "3" },
    },
    allowPositionals: true,
});

console.error("parsed", values, positionals);

const { help, host, port, zkServers, zkSessionTimeout, zkSpinDelay, zkRetries } = values;

if (help) {
    console.error("Usage: mcp-server-zookeeper [options]");
    console.error("Options:");
    console.error("  -h, --host=HOST            The host to listen on (default: 127.0.0.1)");
    console.error("  -p, --port=PORT            The port to listen on");
    console.error("  -s, --zkServers=SERVERS    The ZooKeeper servers (default: localhost:2181)");
    console.error("  -t, --zkSessionTimeout=MS  The ZooKeeper session timeout (default: 30000)");
    console.error("  -d, --zkSpinDelay=MS       The ZooKeeper spin delay (default: 100)");
    console.error("  -r, --zkRetries=RETRIES    The ZooKeeper retries (default: 3)");
    process.exit(0);
}

// Start server
async function runServer() {
    const server = new Server(zkServers, {
        name: "zookeeper",
        version: "0.1.0",
        sessionTimeout: parseInt(zkSessionTimeout),
        spinDelay: parseInt(zkSpinDelay),
        retries: parseInt(zkRetries),
    });

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
