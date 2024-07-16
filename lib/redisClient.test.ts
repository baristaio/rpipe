import { connect } from './redisClient';
import {RedisClientOptions, createClient } from 'redis';
import { RedisClientType } from 'redis';
import { mock } from 'jest-mock-extended';

const options: RedisClientOptions = {
  host: 'localhost',
  port: 6379
} as RedisClientOptions;

jest.mock('redis');

describe('redisClient', () => {
  let mockClient: RedisClientType & { on: jest.Mock };

  beforeEach(() => {
    mockClient = mock<RedisClientType & { on: jest.Mock }>();
    (createClient as jest.Mock).mockReturnValue(mockClient);
  });

  it('resolves with client on connect', async () => {
    mockClient.on.mockImplementation((event, callback) => {
      if (event === 'connect') {
        callback();
      }
    });

    await expect(connect(options)).resolves.toBe(mockClient);
  });

  it('rejects with error on error', async () => {
    const error = new Error('Connection error');
    mockClient.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        callback(error);
      }
    });

    await expect(connect(options)).rejects.toBe(error);
  });

  it('rejects with error on end', async () => {
    const error = new Error('Connection ended');

    mockClient.on.mockImplementation((event, callback) => {
      if (event === 'end') {
        callback(error);
      }
    });

    await expect(connect(options)).rejects.toBe(error);
  });
});
