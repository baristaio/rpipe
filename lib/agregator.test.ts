// Removed the incorrect import
import { connect } from "./redisClient";
import { RedisClientType } from 'redis';
import { describe, expect, it, beforeAll } from '@jest/globals';
import { Aggregator } from './aggregator';


const options = {
    host: 'localhost',
    port: 6379
};



describe('Aggregator', () => {
        let redisClient: RedisClientType;
        // let mockClient: RedisClientType & { on: jest.Mock };

        beforeAll( async () => {
            redisClient = await connect(options);
        });

        it('Should register valid messages', async () => {
            const aggregator = new Aggregator('test', redisClient, {});
            const messages = [
                {
                    receiver: {name: 'John Doe', id: '1234'},
                    action: {type: 'greeting', payload: {}}
                }
            ];
            const result = await aggregator.registerMessages(messages);
            console.log(result);

            const collected = await aggregator.getCollected('1234');
            console.log(collected);
            // Add assertions here
        });

        it('Should move data between states', async () => {
            const aggregator = new Aggregator('test', redisClient, {});
            const messages = [
                {
                    receiver: {name: 'John Doe', id: '1234'},
                    action: {type: 'greeting', payload: {}}
                }
            ];
            await aggregator.registerMessages(messages);
            const collectorName = aggregator.getCollectoreName();
            const key = aggregator.getKey('1234', collectorName)
            await aggregator.next(key, 'processing');
            const collected = await aggregator.getCollected('1234');
            console.log(collected);
            // Add assertions here
        });

        it('Should throw error for invalid states', async () => {
            const aggregator = new Aggregator('test', redisClient, {});
            const messages = [
                {
                    receiver: {name: 'John Doe', id: '1234'},
                    action: {type: 'greeting', payload: {}}
                }
            ];
            await aggregator.registerMessages(messages);
            await expect(aggregator.moveId('1234', 'default', 'invalid')).rejects.toThrow('Invalid state name - invalid');
        });


        it('Should return the list of states', async () => {
            const aggregator = new Aggregator('test', redisClient, {});
            const states = aggregator.states();
            expect(states).toEqual(['default', 'processed']);
        });


        it('Should get collected messages', async () => {
            const aggregator = new Aggregator('test', redisClient, {});
            const messages = [
                {
                    receiver: {name: 'John Doe', id: '1234'},
                    action: {type: 'greeting', payload: {}}
                }
            ];
            await aggregator.registerMessages(messages);
            const collected = await aggregator.getCollected('1234');
            expect(collected).toEqual(messages);
        });

        it('Should clear messages', async () => {
            const aggregator = new Aggregator('test', redisClient, {});
            const messages = [
                {
                    receiver: {name: 'John Doe', id: '1234'},
                    action: {type: 'greeting', payload: {}}
                }
            ];
            await aggregator.registerMessages(messages);
            await aggregator.clear('1234', 'test');
            const collected = await aggregator.getCollected('1234');
            expect(collected).toEqual([]);
        });
    });

