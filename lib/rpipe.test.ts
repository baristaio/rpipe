import { RedisClientType } from 'redis';
import { RPipe } from './rpipe';
import { Message } from './types';
import { mock } from 'jest-mock-extended';

describe('RPipe', () => {
    let redisClient: RedisClientType;
    let rPipe: RPipe;

    beforeEach(() => {
        // redisClient = mock<RedisClientType>();
        // rPipe = new RPipe('testAggregator', redisClient, {
        //     states: ['processing', 'done', 'failed'],
        //     postfix: 'testAggregator'
        // });

        redisClient = mock<RedisClientType>();
        const multiMock = mock<ReturnType<RedisClientType['multi']>>();
        (redisClient.multi as jest.Mock).mockReturnValue(multiMock);
        rPipe = new RPipe('testAggregator', redisClient, {
            states: ['processing', 'done', 'failed'],
            postfix: 'testAggregator'
        });
    });

    it('should initialize correctly with prefix and postfix', () => {
        const pipe = new RPipe('test', redisClient, {
            states: ['processing', 'done'],
            prefix: 'prefix',
            postfix: 'postfix'
        });
        expect(pipe.getKey('123', 'processing')).toBe('prefix:test:123:state:processing:postfix');
    });

    it('should initialize correctly with only prefix', () => {
        const pipe = new RPipe('test', redisClient, {
            states: ['processing', 'done'],
            prefix: 'prefix'
        });
        expect(pipe.getKey('123', 'processing')).toBe('prefix:test:123:state:processing');
    });

    it('should initialize correctly with only postfix', () => {
        const pipe = new RPipe('test', redisClient, {
            states: ['processing', 'done'],
            postfix: 'postfix'
        });
        expect(pipe.getKey('123', 'processing')).toBe('test:123:state:processing:postfix');
    });

    it('should handle errors in move method', async () => {
        jest.spyOn(redisClient, 'multi').mockImplementation(() => {
            throw new Error('Mocked error');
        });
        await expect(rPipe.move('fromKey', 'toKey')).rejects.toThrow('Error moving data: Error: Mocked error');
    });

    it('should return the correct collector name', () => {
        expect(rPipe.getCollectoreName()).toBe('collector');
    });

    it('should register messages correctly', async () => {
        const messages: Message[] = [
            { receiver: { id: '123', name: 'test' }, action: { type: 'testAction' } }
        ];
        await rPipe.registerMessages(messages);
        const multi = redisClient.multi() as jest.Mocked<ReturnType<RedisClientType['multi']>>;
        expect(multi.sAdd).toHaveBeenCalledWith('testAggregator:123:state:collector:testAggregator', JSON.stringify({ type: 'testAction' }));
    });

    it('should throw an error for invalid messages', async () => {
        const invalidMessages = [{ receiver: { id: '123' }, action: { type: '' } }]; // Assuming this is invalid
        await expect(rPipe.registerMessages(invalidMessages as Message[])).rejects.toThrow('Invalid message');
    });

    it('should correctly generate a Redis key', () => {
        const key = rPipe.getKey('123', 'processing');
        expect(key).toBe('testAggregator:123:state:processing:testAggregator');
    });

    it('should throw an error when generating a key with an invalid state', () => {
        expect(() => rPipe.getKey('123', 'invalidState')).toThrow('Invalid state name - invalidState');
    });

    it('should return the next state name correctly', () => {
        const nextState = rPipe.getNextStateName('processing');
        expect(nextState).toBe('done');
    });

    it('should return null when requesting next state name for the last state', () => {
        const nextState = rPipe.getNextStateName('failed');
        expect(nextState).toBeNull();
    });

    it('should throw an error when requesting next state name for an invalid state', () => {
        expect(() => rPipe.getNextStateName('invalidState')).toThrow('Invalid source state name');
    });

    it('should return the correct list of configured states', () => {
        const states = rPipe.states();
        expect(states).toEqual(['collector', 'processing', 'done', 'failed']);
    });

    it('should add a value to the set stored at a key representing a specific state', async () => {
        await rPipe.add('123', 'processing', 'value1');
        const multi = redisClient.multi();
        expect(multi.sAdd).toHaveBeenCalledWith('testAggregator:123:state:processing:testAggregator', 'value1');
    });

    it('should retrieve all members of the set stored at a key representing a specific state', async () => {
        (redisClient.sMembers as jest.Mock).mockReturnValue(Promise.resolve(['value2']));
        const members = await rPipe.getMembers('123', 'done');
        expect(members).toEqual(['value2']);
    });

    it('should clear all data associated with a specific identifier and state', async () => {
        await rPipe.clear('123', 'failed');
        expect(redisClient.del).toHaveBeenCalledWith('testAggregator:123:state:failed:testAggregator');
    });

    it('should throw an error when clearing data with an invalid state', async () => {
        await expect(rPipe.clear('123', 'invalidState')).rejects.toThrow('Invalid state name');
    });

    it('should move data from one state to another for a given identifier', async () => {
        await rPipe.add('123', 'processing', 'value2');
        await rPipe.moveId('123', 'processing', 'done');
        const multi = redisClient.multi();
        expect(multi.sUnionStore).toHaveBeenCalledWith('testAggregator:123:state:done:testAggregator', ['testAggregator:123:state:done:testAggregator', 'testAggregator:123:state:processing:testAggregator']);
        expect(multi.del).toHaveBeenCalledWith('testAggregator:123:state:processing:testAggregator');
    });

    it('should move data to its next state based on the current state', async () => {
        await rPipe.add('123', 'processing', 'value3');
        await rPipe.next('123', 'processing');
        const multi = redisClient.multi();
        expect(multi.sUnionStore).toHaveBeenCalledWith('testAggregator:123:state:done:testAggregator', ['testAggregator:123:state:done:testAggregator', 'testAggregator:123:state:processing:testAggregator']);
        expect(multi.del).toHaveBeenCalledWith('testAggregator:123:state:processing:testAggregator');
    });

    it('should retrieve all data in the "collected" state', async () => {
        (redisClient.sMembers as jest.Mock).mockReturnValue(Promise.resolve(['value4']));
        const collected = await rPipe.getCollected('123');
        expect(collected).toEqual(['value4']);
    });

    // it('should combine data from multiple states into a single state', async () => {
    //     (redisClient.sMembers as jest.Mock).mockResolvedValue(['value5', 'value6']);
    //     await rPipe.merge('123', 'collector', ['processing', 'done']);
    //     const multi = redisClient.multi();
    //     expect(multi.sUnionStore).toHaveBeenCalledWith('testAggregator:123:state:collector:testAggregator', ['testAggregator:123:state:processing:testAggregator', 'testAggregator:123:state:done:testAggregator']);
    //     expect(multi.sMembers).toHaveBeenCalledWith('testAggregator:123:state:collector:testAggregator');
    // });
});
