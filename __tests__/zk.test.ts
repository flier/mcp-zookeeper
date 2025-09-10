import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { connectToZooKeeper, create, getChildren, getData, setData, exists, makeDirs, ZookeeperOptions } from '../src/zk';
import { createClient, Client } from 'node-zookeeper-client';
import type { Stat } from 'node-zookeeper-client';

// Mock node-zookeeper-client
vi.mock('node-zookeeper-client', () => ({
    createClient: vi.fn(),
    Client: vi.fn(),
    Stat: vi.fn(),
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

let mockTransaction: {
    create: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
};

type MockClient = {
    connect: ReturnType<typeof vi.fn>;
    addAuthInfo: ReturnType<typeof vi.fn>;
    getSessionId: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    getChildren: ReturnType<typeof vi.fn>;
    getData: ReturnType<typeof vi.fn>;
    setData: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
};

describe('zookeeper', () => {
    let mockClient: MockClient;

    beforeEach(() => {
        mockTransaction = {
            create: vi.fn(),
            commit: vi.fn()
        };

        mockClient = {
            connect: vi.fn(),
            addAuthInfo: vi.fn(),
            getSessionId: vi.fn().mockReturnValue(Buffer.from('test-session-id')),
            once: vi.fn(),
            on: vi.fn(),
            getChildren: vi.fn(),
            getData: vi.fn(),
            setData: vi.fn(),
            exists: vi.fn(),
            create: vi.fn(),
            transaction: vi.fn().mockReturnValue(mockTransaction),
        };

        vi.mocked(createClient).mockReturnValue(mockClient as unknown as Client);
    });

    afterEach(() => {
        // Reset mockTransaction mocks
        mockTransaction.create.mockClear();
        mockTransaction.commit.mockClear();
    });

    describe('connectToZooKeeper', () => {
        it('should create client with default options', () => {
            connectToZooKeeper();

            expect(createClient).toHaveBeenCalledWith('localhost:2181', {
                sessionTimeout: 30000,
                spinDelay: 100,
                retries: 3,
            });
            expect(mockClient.connect).toHaveBeenCalled();
        });

        it('should create client with custom connection string and options', () => {
            const customConnStr = 'zookeeper1:2181,zookeeper2:2181';
            const customOpts: ZookeeperOptions = {
                sessionTimeout: 60000,
                spinDelay: 200,
                retries: 5,
                auth: {
                    scheme: 'digest',
                    auth: Buffer.from('user:password')
                }
            };

            connectToZooKeeper(customConnStr, customOpts);

            expect(createClient).toHaveBeenCalledWith(customConnStr, {
                sessionTimeout: 60000,
                spinDelay: 200,
                retries: 5,
            });
            expect(mockClient.addAuthInfo).toHaveBeenCalledWith('digest', Buffer.from('user:password'));
            expect(mockClient.connect).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('should create a node and return the path', async () => {
            const path = '/test/node';
            mockClient.create.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const result = await create(mockClient as unknown as Client, path);

            expect(result).toBe(path);
            expect(mockClient.create).toHaveBeenCalledWith(path, expect.any(Function));
        });

        it('should reject on error', async () => {
            const path = '/test/node';
            const error = new Error('Create failed');
            mockClient.create.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(error, '');
            });

            await expect(create(mockClient as unknown as Client, path)).rejects.toThrow('Create failed');
        });
    });

    describe('getChildren', () => {
        it('should return children and stat', async () => {
            const dir = '/test';
            const children = ['child1', 'child2'];
            mockClient.getChildren.mockImplementation((dir: string, callback: (error: Error | null, children: string[], stat: Stat) => void) => {
                callback(null, children, mockStat);
            });

            const result = await getChildren(mockClient as unknown as Client, dir);

            expect(result).toEqual([children, mockStat]);
            expect(mockClient.getChildren).toHaveBeenCalledWith(dir, expect.any(Function));
        });

        it('should reject on error', async () => {
            const dir = '/test';
            const error = new Error('Get children failed');
            mockClient.getChildren.mockImplementation((dir: string, callback: (error: Error | null, children: string[], stat: Stat) => void) => {
                callback(error, [], mockStat);
            });

            await expect(getChildren(mockClient as unknown as Client, dir)).rejects.toThrow('Get children failed');
        });
    });

    describe('getData', () => {
        it('should return data and stat', async () => {
            const path = '/test/node';
            const data = Buffer.from('test data');
            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callback(null, data, mockStat);
            });

            const result = await getData(mockClient as unknown as Client, path);

            expect(result).toEqual([data, mockStat]);
            expect(mockClient.getData).toHaveBeenCalledWith(path, expect.any(Function));
        });

        it('should reject on error', async () => {
            const path = '/test/node';
            const error = new Error('Get data failed');
            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callback(error, Buffer.alloc(0), mockStat);
            });

            await expect(getData(mockClient as unknown as Client, path)).rejects.toThrow('Get data failed');
        });
    });

    describe('setData', () => {
        it('should set data and return stat', async () => {
            const path = '/test/node';
            const data = Buffer.from('new data');
            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                callback(null, mockStat);
            });

            const result = await setData(mockClient as unknown as Client, path, data);

            expect(result).toBe(mockStat);
            expect(mockClient.setData).toHaveBeenCalledWith(path, data, expect.any(Function));
        });

        it('should reject on error', async () => {
            const path = '/test/node';
            const data = Buffer.from('new data');
            const error = new Error('Set data failed');
            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                callback(error, mockStat);
            });

            await expect(setData(mockClient as unknown as Client, path, data)).rejects.toThrow('Set data failed');
        });
    });

    describe('exists', () => {
        it('should return stat if node exists', async () => {
            const path = '/test/node';
            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                callback(null, mockStat);
            });

            const result = await exists(mockClient as unknown as Client, path);

            expect(result).toBe(mockStat);
            expect(mockClient.exists).toHaveBeenCalledWith(path, expect.any(Function));
        });

        it('should return null if node does not exist', async () => {
            const path = '/test/node';
            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                callback(null, null);
            });

            const result = await exists(mockClient as unknown as Client, path);

            expect(result).toBeNull();
        });

        it('should reject on error', async () => {
            const path = '/test/node';
            const error = new Error('Exists check failed');
            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                callback(error, mockStat);
            });

            await expect(exists(mockClient as unknown as Client, path)).rejects.toThrow('Exists check failed');
        });
    });

    describe('makeDirs', () => {
        it('should create all directories in path', async () => {
            const path = '/test/dir1/dir2/dir3';

            // Mock exists to return null for all directories (they don't exist)
            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                callback(null, null);
            });

            // Mock transaction commit to succeed
            mockTransaction.commit.mockImplementation((callback: (error: Error | null) => void) => {
                callback(null);
            });
            mockClient.transaction.mockReturnValue(mockTransaction);

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe(path);
            expect(mockClient.exists).toHaveBeenCalledTimes(4);
            expect(mockClient.transaction).toHaveBeenCalledTimes(1);
            expect(mockTransaction.create).toHaveBeenCalledTimes(4);
            expect(mockTransaction.create).toHaveBeenCalledWith('/test/dir1/dir2/dir3');
            expect(mockTransaction.create).toHaveBeenCalledWith('/test/dir1/dir2');
            expect(mockTransaction.create).toHaveBeenCalledWith('/test/dir1');
            expect(mockTransaction.create).toHaveBeenCalledWith('/test');
        });

        it('should stop creating when existing directory is found', async () => {
            const path = '/test/dir1/dir2/dir3';

            // Mock exists to return stat for /test/dir1 (it exists)
            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                if (path === '/test/dir1') {
                    callback(null, mockStat);
                } else {
                    callback(null, null);
                }
            });

            // Mock transaction commit to succeed
            mockTransaction.commit.mockImplementation((callback: (error: Error | null) => void) => {
                callback(null);
            });
            mockClient.transaction.mockReturnValue(mockTransaction);

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe(path);
            // Should only create dir2 and dir3, not dir1
            expect(mockClient.exists).toHaveBeenCalledTimes(3);
            expect(mockClient.transaction).toHaveBeenCalledTimes(1);
            expect(mockTransaction.create).toHaveBeenCalledTimes(2);
            expect(mockTransaction.create).toHaveBeenCalledWith('/test/dir1/dir2');
            expect(mockTransaction.create).toHaveBeenCalledWith('/test/dir1/dir2/dir3');
        });

        it('should reject if exists check fails', async () => {
            const path = '/test/dir1/dir2';
            const error = new Error('Exists check failed');

            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                callback(error, mockStat);
            });

            await expect(makeDirs(mockClient as unknown as Client, path)).rejects.toThrow('Exists check failed');
        });

        it('should reject if create fails', async () => {
            const path = '/test/dir1/dir2';
            const error = new Error('Create failed');

            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                callback(null, null);
            });

            // Mock transaction commit to fail
            mockTransaction.commit.mockImplementation((callback: (error: Error | null) => void) => {
                callback(error);
            });
            mockClient.transaction.mockReturnValue(mockTransaction);

            await expect(makeDirs(mockClient as unknown as Client, path)).rejects.toThrow('Create failed');
        });

        it('should handle empty path', async () => {
            const path = '';

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe('');
            expect(mockClient.exists).not.toHaveBeenCalled();
            expect(mockClient.transaction).not.toHaveBeenCalled();
        });

        it('should handle root path', async () => {
            const path = '/';

            // Mock exists to return stat for root path (root always exists)
            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                callback(null, mockStat);
            });

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe('/');
            expect(mockClient.exists).toHaveBeenCalledWith('/', expect.any(Function));
            expect(mockClient.transaction).not.toHaveBeenCalled();
        });

        it('should handle single level path', async () => {
            const path = '/test';

            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                callback(null, null);
            });

            mockTransaction.commit.mockImplementation((callback: (error: Error | null) => void) => {
                callback(null);
            });
            mockClient.transaction.mockReturnValue(mockTransaction);

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe('/test');
            expect(mockClient.exists).toHaveBeenCalledWith('/test', expect.any(Function));
            expect(mockClient.transaction).toHaveBeenCalledTimes(1);
            expect(mockTransaction.create).toHaveBeenCalledWith('/test');
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle getChildren with empty children list', async () => {
            const path = '/test';
            mockClient.getChildren.mockImplementation((path: string, callback: (error: Error | null, children: string[], stat: Stat) => void) => {
                callback(null, [], mockStat);
            });

            const [children] = await getChildren(mockClient as unknown as Client, path);

            expect(children).toEqual([]);
            expect(mockClient.getChildren).toHaveBeenCalledWith(path, expect.any(Function));
        });

        it('should handle getData with empty buffer', async () => {
            const path = '/test';
            const emptyBuffer = Buffer.alloc(0);
            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callback(null, emptyBuffer, mockStat);
            });

            const [data] = await getData(mockClient as unknown as Client, path);

            expect(data).toEqual(emptyBuffer);
            expect(data.length).toBe(0);
        });

        it('should handle setData with empty buffer', async () => {
            const path = '/test';
            const emptyBuffer = Buffer.alloc(0);
            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                callback(null, mockStat);
            });

            await setData(mockClient as unknown as Client, path, emptyBuffer);

            expect(mockClient.setData).toHaveBeenCalledWith(path, emptyBuffer, expect.any(Function));
        });

        it('should handle create with very long path', async () => {
            const longPath = '/very/long/path/with/many/segments/that/goes/on/and/on/and/on';
            mockClient.create.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const result = await create(mockClient as unknown as Client, longPath);

            expect(result).toBe(longPath);
            expect(mockClient.create).toHaveBeenCalledWith(longPath, expect.any(Function));
        });
    });
});