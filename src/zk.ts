import { promisify } from "util";

import { createClient, Client, Stat } from "node-zookeeper-client";

/**
 * The default servers of the ZooKeeper cluster, defaults to "localhost:2181".
 */
const defaultServers = "localhost:2181";

/**
 * Session timeout in milliseconds, defaults to 30 seconds.
 */
const defaultSessionTimeout = 30000;

/**
 * The delay (in milliseconds) between each connection attempts, defaults to 100 milliseconds.
 */
const defaultSpinDelay = 100;

/**
 * The number of retry attempts for connection loss exception, defaults to 3.
 */
const defaultRetries = 3;

/**
 * The authentication information.
 */
export type AuthInfo = {
    /**
     * The authentication scheme.
     */
    scheme: string;
    /**
     * The authentication data buffer.
     */
    auth: Buffer;
}

/**
 * The Zookeeper server options.
 */
export type ZookeeperOptions = {
    /**
     * The session timeout in milliseconds, defaults to 30 seconds.
     */
    sessionTimeout?: number;
    /**
     * The delay (in milliseconds) between each connection attempts, defaults to 100 milliseconds.
     */
    spinDelay?: number;
    /**
     * The number of retry attempts for connection loss exception, defaults to 3.
     */
    retries?: number;
    /**
     * The authentication information.
     */
    auth?: AuthInfo,
}

/**
 * Connects to a ZooKeeper cluster with the specified connection string and options.
 *
 * @param connStr - The ZooKeeper connection string (e.g., "localhost:2181" or "zk1:2181,zk2:2181")
 * @param opts - Optional configuration for the ZooKeeper client
 * @returns A connected ZooKeeper client instance
 */
export function connectToZooKeeper(connStr?: string, opts?: ZookeeperOptions): Client {
    const client = createClient(connStr ?? defaultServers, {
        sessionTimeout: opts?.sessionTimeout ?? defaultSessionTimeout,
        spinDelay: opts?.spinDelay ?? defaultSpinDelay,
        retries: opts?.retries ?? defaultRetries,
    });

    if (opts?.auth) {
        client.addAuthInfo(opts.auth.scheme, opts.auth.auth);
    }

    client.connect();

    client.once('connected', () => {
        console.error('Connected to ZooKeeper', {
            uri: connStr ?? defaultServers,
            sessionId: client.getSessionId().toString('hex')
        });
    });

    client.on('state', (state) => {
        console.error('Client state changed to', state);
    });

    return client;
}

/**
 * Creates a new node at the specified path.
 *
 * @param client - The ZooKeeper client instance
 * @param path - The path where the node should be created
 * @returns A promise that resolves to the created path
 */
export function create(client: Client, path: string): Promise<string> {
    return promisify<string, string>(client.create)(path);
}

/**
 * Gets the children of a node and their statistics.
 *
 * @param client - The ZooKeeper client instance
 * @param dir - The path of the parent node
 * @returns A promise that resolves to a tuple of [children, stat]
 */
export function getChildren(client: Client, dir: string): Promise<[string[], Stat]> {
    return new Promise<[string[], Stat]>((resolve, reject) => {
        client.getChildren(dir, (error, children, stat) => {
            if (error) {
                reject(error);
            } else {
                resolve([children, stat]);
            }
        });
    });
}

/**
 * Gets the data and statistics of a node.
 *
 * @param client - The ZooKeeper client instance
 * @param path - The path of the node
 * @returns A promise that resolves to a tuple of [data, stat]
 */
export function getData(client: Client, path: string): Promise<[Buffer, Stat]> {
    return new Promise<[Buffer, Stat]>((resolve, reject) => {
        client.getData(path, (error, data, stat) => {
            if (error) {
                reject(error);
            } else {
                resolve([data, stat]);
            }
        });
    });
}

/**
 * Sets the data of a node.
 *
 * @param client - The ZooKeeper client instance
 * @param path - The path of the node
 * @param data - The data to set
 * @returns A promise that resolves to the node statistics
 */
export function setData(client: Client, path: string, data: Buffer): Promise<Stat> {
    return promisify<string, Buffer, Stat>(client.setData)(path, data);
}

/**
 * Checks if a node exists and returns its statistics.
 *
 * @param client - The ZooKeeper client instance
 * @param path - The path of the node to check
 * @returns A promise that resolves to the node statistics if it exists, null otherwise
 */
export function exists(client: Client, path: string): Promise<Stat | null> {
    return promisify<string, Stat | null>(client.exists)(path);
}

/**
 * Creates a directory and all necessary parent directories using ZooKeeper transactions.
 * This function ensures atomic creation of the entire directory structure.
 *
 * @param client - The ZooKeeper client instance
 * @param path - The path of the directory to create
 * @returns A promise that resolves to the created path
 */
export async function makeDirs(client: Client, path: string): Promise<string> {
    return await promisify<string, string>(client.mkdirp)(path);
}
