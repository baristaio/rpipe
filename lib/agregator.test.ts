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
    let aggregator: Aggregator;

    beforeAll(async () => {
        redisClient = await connect(options);
        aggregator = new Aggregator('testAggregator', redisClient, {
            states: ['processing', 'done', 'failed'],
            postFix: 'testAggregator'
        });
    });

    it('should correctly generate a Redis key', () => {
        const key = aggregator.getKey('123', 'processing');
        expect(key).toBe('aggregator:group:testAggregator:id:123:state:processing:testAggregator');
    });

    it('should throw an error when generating a key with an invalid state', () => {
        expect(() => aggregator.getKey('123', 'invalidState')).toThrow('Invalid state name - invalidState');
    });

    it('should parse a Redis key into its constituent parts', () => {
        const parsedKey = aggregator.parseKey('aggregator:group:testAggregator:id:123:state:processing:testAggregator');
        expect(parsedKey).toEqual({ id: '123', state: 'processing' });
    });

    it('should throw an error when parsing an invalid Redis key format', () => {
        expect(() => aggregator.parseKey('invalidKeyFormat')).toThrow('Invalid key format');
    });

    it('should return the next state name correctly', () => {
        const nextState = aggregator.getNextStateName('processing');
        expect(nextState).toBe('done');
    });

    it('should return null when requesting next state name for the last state', () => {
        const nextState = aggregator.getNextStateName('failed');
        expect(nextState).toBeNull();
    });

    it('should throw an error when requesting next state name for an invalid state', () => {
        expect(() => aggregator.getNextStateName('invalidState')).toThrow('Invalid source state name');
    });

    it('should return the correct list of configured states', () => {
        const states = aggregator.states();
        expect(states).toEqual(['collector', 'processing', 'done', 'failed']);
    });

    it('should add a value to the set stored at a key representing a specific state', async () => {
        await aggregator.add('123', 'processing', 'value1');
        const members = await aggregator.getMembers('123', 'processing');
        expect(members).toContain('value1');
    });

    it('should retrieve all members of the set stored at a key representing a specific state', async () => {
        await aggregator.add('123', 'done', 'value2');
        const members = await aggregator.getMembers('123', 'done');
        expect(members).toEqual(expect.arrayContaining(['value2']));
    });

    it('should clear all data associated with a specific identifier and state', async () => {
        await aggregator.add('123', 'failed', 'value3');
        await aggregator.clear('123', 'failed');
        const members = await aggregator.getMembers('123', 'failed');
        expect(members).toEqual([]);
    });

    it('should throw an error when clearing data with an invalid state', async () => {
        await expect(aggregator.clear('123', 'invalidState')).rejects.toThrow('Invalid state name');
    });
});

