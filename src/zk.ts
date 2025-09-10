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

export function create(client: Client, path: string): Promise<string> {
    return promisify<string, string>(client.create)(path);
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

export function getData(client: Client, path: string): Promise<[Buffer, Stat]> {
    return new Promise<[Buffer, Stat]>((resolve, reject) => {
        client.getData(path, (error, data, stat) => {
            if (error) {
                reject(error)
            } else {
                resolve([data, stat])
            }
        })
    })
}

export function setData(client: Client, path: string, data: Buffer): Promise<Stat> {
    return promisify<string, Buffer, Stat>(client.setData)(path, data);
}

export function exists(client: Client, path: string): Promise<Stat> {
    return promisify<string, Stat>(client.exists)(path);
}

export async function makeDirs(client: Client, path: string): Promise<string> {
    const dirs: string[] = [];

    for (let parts = path.split('/'); parts.length > 0; parts.pop()) {
        const p = parts.join('/');

        if (p === '') {
            continue;
        }

        const stat = await exists(client, p);

        if (stat) {
            break;
        }

        dirs.push(p);
    }

    dirs.reverse();

    const trans = client.transaction();

    for (const dir of dirs) {
        trans.create(dir);
    }

    await promisify(trans.commit)();

    return path;
}