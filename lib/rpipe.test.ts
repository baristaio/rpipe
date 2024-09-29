// Removed the incorrect import
import { connect } from "./redisClient";
import { RedisClientType } from 'redis';
import { describe, expect, it, beforeAll } from '@jest/globals';
import {Message} from "./types";
import { RPipe } from './rpipe';


const options = {
    host: 'localhost',
    port: 6379
};

describe('R-Pipe', () => {
    let redisClient: RedisClientType;
    let rPipe: RPipe;

    beforeAll(async () => {
        redisClient = await connect(options);
        rPipe = new RPipe('testAggregator', redisClient, {
            states: ['processing', 'done', 'failed'],
            postFix: 'testAggregator'
        });
    });

    it('should return the correct collector name', () => {
        expect(rPipe.getCollectoreName()).toBe('collector');
    });

    it('should register messages correctly', async () => {
        const messages:  Message[] = [
          {receiver: {id: '123', name: 'test' }, action: {type: 'testAction'}}
        ];
        await rPipe.registerMessages(messages);
        // Verify the message was added to the correct set
        const members = await redisClient.sMembers('rpipe:group:testAggregator:id:123:state:collector:testAggregator');
        expect(members).toContain(JSON.stringify({type:"testAction"}));
    });

    it('should throw an error for invalid messages', async () => {
        const invalidMessages = [{ receiver: { id: '123' }, action: { type: '' } }]; // Assuming this is invalid
        await expect(rPipe.registerMessages(invalidMessages as Message[])).rejects.toThrow('Invalid message');
    });

    it('should correctly generate a Redis key', () => {
        const key = rPipe.getKey('123', 'processing');
        expect(key).toBe('rpipe:group:testAggregator:id:123:state:processing:testAggregator');
    });

    it('should throw an error when generating a key with an invalid state', () => {
        expect(() => rPipe.getKey('123', 'invalidState')).toThrow('Invalid state name - invalidState');
    });

    it('should parse a Redis key into its constituent parts', () => {
        const parsedKey = rPipe.parseKey('rpipe:group:testAggregator:id:123:state:processing:testAggregator');
        expect(parsedKey).toEqual({ id: '123', state: 'processing' });
    });

    it('should throw an error when parsing an invalid Redis key format', () => {
        expect(() => rPipe.parseKey('invalidKeyFormat')).toThrow('Invalid key format');
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
        const members = await rPipe.getMembers('123', 'processing');
        expect(members).toContain('value1');
    });

    it('should retrieve all members of the set stored at a key representing a specific state', async () => {
        await rPipe.add('123', 'done', 'value2');
        const members = await rPipe.getMembers('123', 'done');
        expect(members).toEqual(expect.arrayContaining(['value2']));
    });

    it('should clear all data associated with a specific identifier and state', async () => {
        await rPipe.add('123', 'failed', 'value3');
        await rPipe.clear('123', 'failed');
        const members = await rPipe.getMembers('123', 'failed');
        expect(members).toEqual([]);
    });

    it('should throw an error when clearing data with an invalid state', async () => {
        await expect(rPipe.clear('123', 'invalidState')).rejects.toThrow('Invalid state name');
    });


    it('should move data from one Redis key to another', async () => {
        // Setup initial state
        await redisClient.sAdd('fromKey', 'value1');
        await rPipe.move('fromKey', 'toKey');
        // Verify data was moved
        const members = await redisClient.sMembers('toKey');
        expect(members).toContain('value1');
    });

    it('should move data from one state to another for a given identifier', async () => {
        // Setup initial state
        await rPipe.add('123', 'processing', 'value2');
        await rPipe.moveId('123', 'processing', 'done');
        // Verify data was moved
        const members = await rPipe.getMembers('123', 'done');
        expect(members).toContain('value2');
    });

    it('should move data to its next state based on the current state', async () => {
        // Setup initial state
        await rPipe.add('123', 'processing', 'value3');
        await rPipe.next('123', 'processing');
        // Verify data was moved to the next state
        const members = await rPipe.getMembers('123', 'done');
        expect(members).toContain('value3');
    });

    it('should retrieve all data in the "collected" state', async () => {
        // Setup initial state
        await rPipe.add('123', 'collector', 'value4');
        const collected = await rPipe.getCollected('123');
        // Verify data was retrieved
        expect(collected).toContain('value4');
    });

    it('should combine data from multiple states into a single state', async () => {
        // Setup initial state
        await rPipe.add('123', 'processing', 'value5');
        await rPipe.add('123', 'done', 'value6');
        await rPipe.merge('123', 'collector', ['processing', 'done']);
        // Verify data was combined
        const members = await rPipe.getMembers('123', 'collector');
        expect(members).toEqual(expect.arrayContaining(['value5', 'value6']));
    });
});

