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
    mkdirp: ReturnType<typeof vi.fn>;
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
            mkdirp: vi.fn(),
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
        it('should create directory using mkdirp', async () => {
            const path = '/test/dir1/dir2/dir3';
            mockClient.mkdirp.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe(path);
            expect(mockClient.mkdirp).toHaveBeenCalledWith(path, expect.any(Function));
        });

        it('should reject if mkdirp fails', async () => {
            const path = '/test/dir1/dir2';
            const error = new Error('mkdirp failed');
            mockClient.mkdirp.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(error, '');
            });

            await expect(makeDirs(mockClient as unknown as Client, path)).rejects.toThrow('mkdirp failed');
        });

        it('should handle empty path', async () => {
            const path = '';
            mockClient.mkdirp.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe('');
            expect(mockClient.mkdirp).toHaveBeenCalledWith('', expect.any(Function));
        });

        it('should handle root path', async () => {
            const path = '/';
            mockClient.mkdirp.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe('/');
            expect(mockClient.mkdirp).toHaveBeenCalledWith('/', expect.any(Function));
        });

        it('should handle single level path', async () => {
            const path = '/test';
            mockClient.mkdirp.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe('/test');
            expect(mockClient.mkdirp).toHaveBeenCalledWith('/test', expect.any(Function));
        });

        it('should handle very long path', async () => {
            const longPath = '/very/long/path/with/many/segments/that/goes/on/and/on/and/on/and/continues/for/a/very/long/time';
            mockClient.mkdirp.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const result = await makeDirs(mockClient as unknown as Client, longPath);

            expect(result).toBe(longPath);
            expect(mockClient.mkdirp).toHaveBeenCalledWith(longPath, expect.any(Function));
        });

        it('should handle path with special characters', async () => {
            const path = '/test-dir_with.special+chars';
            mockClient.mkdirp.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const result = await makeDirs(mockClient as unknown as Client, path);

            expect(result).toBe(path);
            expect(mockClient.mkdirp).toHaveBeenCalledWith(path, expect.any(Function));
        });

        it('should handle concurrent mkdirp calls', async () => {
            const path1 = '/test/dir1';
            const path2 = '/test/dir2';

            mockClient.mkdirp.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const [result1, result2] = await Promise.all([
                makeDirs(mockClient as unknown as Client, path1),
                makeDirs(mockClient as unknown as Client, path2)
            ]);

            expect(result1).toBe(path1);
            expect(result2).toBe(path2);
            expect(mockClient.mkdirp).toHaveBeenCalledTimes(2);
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

        it('should handle getChildren with many children', async () => {
            const path = '/test';
            const manyChildren = Array.from({ length: 1000 }, (_, i) => `child${i}`);
            mockClient.getChildren.mockImplementation((path: string, callback: (error: Error | null, children: string[], stat: Stat) => void) => {
                callback(null, manyChildren, mockStat);
            });

            const [children, stat] = await getChildren(mockClient as unknown as Client, path);

            expect(children).toEqual(manyChildren);
            expect(children).toHaveLength(1000);
            expect(stat).toBe(mockStat);
        });

        it('should handle getData with large buffer', async () => {
            const path = '/test';
            const largeBuffer = Buffer.alloc(1024 * 1024, 'x'); // 1MB buffer
            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callback(null, largeBuffer, mockStat);
            });

            const [data, stat] = await getData(mockClient as unknown as Client, path);

            expect(data).toBe(largeBuffer);
            expect(data.length).toBe(1024 * 1024);
            expect(stat).toBe(mockStat);
        });

        it('should handle setData with large buffer', async () => {
            const path = '/test';
            const largeBuffer = Buffer.alloc(1024 * 1024, 'y'); // 1MB buffer
            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                callback(null, mockStat);
            });

            await setData(mockClient as unknown as Client, path, largeBuffer);

            expect(mockClient.setData).toHaveBeenCalledWith(path, largeBuffer, expect.any(Function));
        });

        it('should handle create with special characters in path', async () => {
            const specialPath = '/test-node_with.special+chars@123';
            mockClient.create.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            const result = await create(mockClient as unknown as Client, specialPath);

            expect(result).toBe(specialPath);
            expect(mockClient.create).toHaveBeenCalledWith(specialPath, expect.any(Function));
        });

        it('should handle exists with non-existent node', async () => {
            const path = '/non-existent';
            mockClient.exists.mockImplementation((path: string, callback: (error: Error | null, stat: Stat | null) => void) => {
                callback(null, null);
            });

            const result = await exists(mockClient as unknown as Client, path);

            expect(result).toBeNull();
            expect(mockClient.exists).toHaveBeenCalledWith(path, expect.any(Function));
        });

        it('should handle concurrent operations', async () => {
            const path = '/test';
            const data = Buffer.from('test data');

            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callback(null, data, mockStat);
            });

            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                callback(null, mockStat);
            });

            const [getResult, setResult] = await Promise.all([
                getData(mockClient as unknown as Client, path),
                setData(mockClient as unknown as Client, path, data)
            ]);

            expect(getResult[0]).toBe(data);
            expect(setResult).toBe(mockStat);
        });

        it('should handle network timeout errors', async () => {
            const path = '/test';
            const timeoutError = new Error('Connection timeout');
            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callback(timeoutError, Buffer.alloc(0), mockStat);
            });

            await expect(getData(mockClient as unknown as Client, path)).rejects.toThrow('Connection timeout');
        });

        it('should handle permission denied errors', async () => {
            const path = '/protected';
            const permissionError = new Error('Permission denied');
            mockClient.create.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(permissionError, '');
            });

            await expect(create(mockClient as unknown as Client, path)).rejects.toThrow('Permission denied');
        });

        it('should handle node already exists errors', async () => {
            const path = '/existing';
            const existsError = new Error('Node already exists');
            mockClient.create.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(existsError, '');
            });

            await expect(create(mockClient as unknown as Client, path)).rejects.toThrow('Node already exists');
        });
    });

    describe('Integration tests', () => {
        it('should handle complete workflow: create, set data, get data, get children', async () => {
            const path = '/test/integration';
            const data = Buffer.from('integration test data');

            // Mock create
            mockClient.create.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            // Mock setData
            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                callback(null, mockStat);
            });

            // Mock getData
            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callback(null, data, mockStat);
            });

            // Mock getChildren
            mockClient.getChildren.mockImplementation((path: string, callback: (error: Error | null, children: string[], stat: Stat) => void) => {
                callback(null, ['child1', 'child2'], mockStat);
            });

            // Execute workflow
            const createdPath = await create(mockClient as unknown as Client, path);
            await setData(mockClient as unknown as Client, path, data);
            const [retrievedData, dataStat] = await getData(mockClient as unknown as Client, path);
            const [children, childrenStat] = await getChildren(mockClient as unknown as Client, path);

            // Verify results
            expect(createdPath).toBe(path);
            expect(retrievedData).toEqual(data);
            expect(dataStat).toBe(mockStat);
            expect(children).toEqual(['child1', 'child2']);
            expect(childrenStat).toBe(mockStat);
        });

        it('should handle batch operations', async () => {
            const paths = ['/test/batch1', '/test/batch2', '/test/batch3'];
            const data = Buffer.from('batch data');

            mockClient.create.mockImplementation((path: string, callback: (error: Error | null, path: string) => void) => {
                callback(null, path);
            });

            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                callback(null, mockStat);
            });

            // Execute batch operations
            const createPromises = paths.map(path => create(mockClient as unknown as Client, path));
            const setDataPromises = paths.map(path => setData(mockClient as unknown as Client, path, data));

            const createdPaths = await Promise.all(createPromises);
            await Promise.all(setDataPromises);

            expect(createdPaths).toEqual(paths);
            expect(mockClient.create).toHaveBeenCalledTimes(3);
            expect(mockClient.setData).toHaveBeenCalledTimes(3);
        });
    });

    describe('Performance tests', () => {
        it('should handle high-frequency operations', async () => {
            const path = '/test/performance';
            const data = Buffer.from('performance test data');

            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callback(null, data, mockStat);
            });

            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                callback(null, mockStat);
            });

            const startTime = Date.now();
            const operations = Array.from({ length: 100 }, (_, i) =>
                i % 2 === 0
                    ? getData(mockClient as unknown as Client, `${path}${i}`)
                    : setData(mockClient as unknown as Client, `${path}${i}`, data)
            );

            await Promise.all(operations);
            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(1000); // Should complete within 1 second
            expect(mockClient.getData).toHaveBeenCalledTimes(50);
            expect(mockClient.setData).toHaveBeenCalledTimes(50);
        });

        it('should handle memory-efficient large data operations', async () => {
            const path = '/test/large-data';
            const largeData = Buffer.alloc(10 * 1024 * 1024, 'x'); // 10MB buffer

            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                callback(null, mockStat);
            });

            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callback(null, largeData, mockStat);
            });

            await setData(mockClient as unknown as Client, path, largeData);
            const [retrievedData] = await getData(mockClient as unknown as Client, path);

            expect(retrievedData).toBe(largeData);
            expect(retrievedData.length).toBe(10 * 1024 * 1024);
        });
    });

    describe('Error recovery tests', () => {
        it('should handle transient errors with retry logic', async () => {
            const path = '/test/retry';
            let callCount = 0;

            mockClient.getData.mockImplementation((path: string, callback: (error: Error | null, data: Buffer, stat: Stat) => void) => {
                callCount++;
                if (callCount === 1) {
                    callback(new Error('Temporary network error'), Buffer.alloc(0), mockStat);
                } else {
                    callback(null, Buffer.from('success'), mockStat);
                }
            });

            // First call should fail
            await expect(getData(mockClient as unknown as Client, path)).rejects.toThrow('Temporary network error');

            // Second call should succeed
            const [data] = await getData(mockClient as unknown as Client, path);
            expect(data).toEqual(Buffer.from('success'));
            expect(callCount).toBe(2);
        });

        it('should handle partial failures in batch operations', async () => {
            const paths = ['/test/success', '/test/failure', '/test/success2'];
            const data = Buffer.from('batch data');

            mockClient.setData.mockImplementation((path: string, data: Buffer, callback: (error: Error | null, stat: Stat) => void) => {
                if (path === '/test/failure') {
                    callback(new Error('Set data failed'), mockStat);
                } else {
                    callback(null, mockStat);
                }
            });

            const promises = paths.map(path => setData(mockClient as unknown as Client, path, data));
            const results = await Promise.allSettled(promises);

            expect(results[0].status).toBe('fulfilled');
            expect(results[1].status).toBe('rejected');
            expect(results[2].status).toBe('fulfilled');
        });
    });
});