import {AggregatorOptions, Message} from "./types";
import {RedisClientType} from "redis";
import {validateMessage} from "./messageValidator";
const defaultCollectorName = 'collector';
const defaultStates = ['processing', 'done', 'failed'];

/**
 * The `Aggregator` class provides functionality for managing and manipulating data within a Redis database.
 * It supports operations such as collecting, moving, and merging data based on state transitions.
 */
export class Aggregator {
  private _name: string; // The aggregation group name
  private _client: RedisClientType; // Redis client instance
  private _prefix: string; // Prefix for Redis keys
  private _postFix: string | null | undefined = null; // Optional postfix for Redis keys
  private _states: string[]; // List of states for data aggregation
  private _collectorName: string; // Name of the collector
  private _separator: string; // Separator used in Redis keys
  private _partsNo: number; // Expected number of parts in a parsed Redis key

  /**
   * Constructs an `Aggregator` instance.
   * @param {string} name - The name of the aggregation group.
   * @param {RedisClientType} redisClient - An instance of a Redis client.
   * @param {AggregatorOptions} options - Configuration options for the aggregator.
   */
  constructor(name: string, redisClient: RedisClientType, options: AggregatorOptions) {
    this._client = redisClient;
    this._name = name;
    this._postFix = name || options.postFix;
    this._prefix = 'aggregator' || options.prefix;
    this._collectorName = options?.collectorName || defaultCollectorName;
    this._states =  [defaultCollectorName, ...(options?.states ?? defaultStates)];
    this._separator = ':';
    this._partsNo = 8;
  }

  /**
   * Generates a Redis key using the aggregator's configuration and specific state and identifier.
   * @param {string} key - The identifier for the data.
   * @param {string} state - The state of the data.
   * @returns {string} The generated Redis key.
   */
  private keyFormula(key: string, state: string) {
    return `${this._prefix}${this._separator}group${this._separator}${this._name}${this._separator}id${this._separator}${key}${this._separator}state${this._separator}${state}${this._separator}${this._postFix}`;
  };

  /**
   * Parses a Redis key into its constituent parts.
   * @param {string} key - The Redis key to parse.
   * @returns {{id: string, state: string}} An object containing the id and state extracted from the key.
   */
  public parseKey(key: string) {
    const parts = key.split(this._separator);
    if (parts.length !== this._partsNo) {
      throw new Error('Invalid key format');
    }

    return {
      id: parts[4],
      state: parts[6]
    };
  }

  /**
   * Returns the name of the next state relates the state.
   * @returns {string} The next state name.
   */
  public getNextStateName(state: string): string | null {
    const index = this._states.indexOf(state);
    if (index === -1) {
      throw new Error('Invalid source state name');
    }
    if (index === this._states.length - 1) {
      return null;
    }
    return this._states[index + 1];
  }

  /**
   * Generates a Redis key for storing data associated with a specific identifier and state.
   * @param {string} id - The identifier for the data.
   * @param {string} state - The state of the data.
   * @returns {string} The generated Redis key.
   */
  public getKey(id:string, state: string) {
    if (!this._states.includes(state)) {
      throw new Error(`Invalid state name - ${state}`);
    }
    return this.keyFormula(id, state)
  }

  /**
   * Returns the name of the collector.
   * @returns {string} The collector name.
   */
  public getCollectoreName(): string {
    return this._collectorName;
  }

  /**
   * Validates and registers an array of messages in Redis.
   * @param {Message[]} messages - An array of messages to be registered.
   */
  public async registerMessages(messages: Message[]) {
    const multi = this._client.multi();
    for (const message of messages) {
      if (!validateMessage(message)) {
        throw new Error('Invalid message');
      }
      const {receiver, action} = message;
      const key = this.getKey(receiver.id.toString(), this._collectorName);

      // @ts-ignore
      multi.sAdd(key, JSON.stringify(action));
    }
    await multi.exec();
  }

  /**
   * Moves data from one Redis key to another.
   * @param {string} from - The Redis key to move data from.
   * @param {string} to - The Redis key to move data to.
   */
  public async move(from: string, to: string) {
    try {
      const multi = this._client.multi();
      multi.sUnionStore(to, [to, from]);
      multi.del(from);
      await multi.exec();
    } catch (error) {
      throw new Error(`Error moving data: ${error}`);
    }
    console.log('Data moved successfully');
  }

  /**
   * Moves data from one state to another for a given identifier.
   * @param {string} id - The identifier for the data.
   * @param {string} fromState - The current state of the data.
   * @param {string} toState - The state to move the data to.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  public async moveId(id: string, fromState: string, toState: string) {
    const fromKey = this.getKey(id, fromState);
    const toKey = this.getKey(id, toState);
    return this.move(fromKey, toKey);
  }

  /**
   * Moves data to its next state based on the current state.
   * @param {string} id - The identifier for the data.
   * @param {string} fromState - The current state of the data.
   * @returns {Promise<void | null>} A promise that resolves with null if it's the last state, otherwise void.
   */
  public async next(id: string, fromState: string) {
    const key = this.getKey(id, fromState)
    const toState = this.getNextStateName(fromState);
    if (!toState) {
      return null;
    }
    const nextKey = this.getKey(id, toState);
    return this.move(key, nextKey);
  }

  /**
   * Returns the list of configured states.
   * @returns {string[]} The list of states.
   */
  public states(): string[] {
    return this._states;
  }

  /**
   * Adds a value to the set stored at a key representing a specific state.
   * @param {string} key - The identifier for the data.
   * @param {string} state - The state of the data.
   * @param {string} value - The value to add.
   */
  public async add(key: string, state: string, value: string) {
    const multi = this._client.multi();
    const toKey = this.getKey(key, state);
    multi.sAdd(toKey, value);
    await multi.exec();
  }

  /**
   * Retrieves all members of the set stored at a key representing a specific state.
   * @param {string} key - The identifier for the data.
   * @param {string} state - The state of the data.
   * @returns {Promise<string[]>} A promise that resolves with the members of the set.
   */
  public async getMembers(key: string, state: string) {
    const aggregatorKey = this.getKey(key, state);
    // @ts-ignore
    return this._client.sMembers(aggregatorKey);
  }

  /**
   * Retrieves all data in the "collected" state.
   * @param {string} key - The identifier for the data.
   * @returns {Promise<string[]>} A promise that resolves with the members of the set in the "collected" state.
   */
  public async getCollected(key: string) {
    return this.getMembers(key, this._collectorName);
  }

  /**
   * Combines data from multiple states into a single state and retrieves the resulting set of data.
   * @param {string} key - The identifier for the data.
   * @param {string} to - The state to combine data into.
   * @param {string[]} from - The states to combine data from.
   * @returns {Promise<string[]>} A promise that resolves with the members of the new set.
   */
  public async merge(key: string, to: string, from: string[]) {
    if (!this._states.includes(to)) {
      throw new Error(`Invalid state name - ${to}`);
    }
    for (const state of from) {
      if (!this._states.includes(state)) {
        throw new Error(`Invalid state name - ${state}`);
      }
    }

    const fromKeys: string[] =
      from.reduce((total: string[], state) => {
        total.push(this.getKey(key, state));
        return total;
      }, []);

    const toKey = this.getKey(key, to);
    const result  = await this._client
      .multi()
      .sUnionStore(toKey, fromKeys)
      .sMembers(toKey)
      .exec();
    return result[1];
  }

  /**
   * Deletes all data associated with a specific identifier and state.
   * @param {string} id - The identifier for the data.
   * @param {string} state - The state of the data.
   * @returns {Promise<number>} A promise that resolves with the number of keys removed.
   */
  public async clear(id: string, state: string) {
    if (!this._states.includes(state)) {
      throw new Error('Invalid state name');
    }

    const key = this.getKey(id, state);
    return this._client.del(key);
  }
}
