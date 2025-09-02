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

    client.once('connected', function () {
        console.error('connected to ZooKeeper', { uri: connStr, session_id: client.getSessionId().toString('hex') });
    });

    client.on('state', function (state) {
        console.error('client state changed to', state);
    });

    return client
}

export function getChildren(client: Client, dir: string): Promise<[string[], Stat]> {
    return new Promise<[string[], Stat]>((resolve, reject) => {
        client.getChildren(dir, (error, children, stat) => {
            if (error) {
                reject(error)
            } else {
                resolve([children, stat])
            }
        })
    })
}

export function getData(client: Client, dir: string): Promise<[Buffer, Stat]> {
    return new Promise<[Buffer, Stat]>((resolve, reject) => {
        client.getData(dir, (error, data, stat) => {
            if (error) {
                reject(error)
            } else {
                resolve([data, stat])
            }
        })
    })
}