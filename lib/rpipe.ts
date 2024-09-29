import { AggregatorOptions, Message } from "./types";
import { RedisClientType } from "redis";
import { validateMessage } from "./messageValidator";

const defaultCollectorName = 'collector';
const defaultStates = ['processing', 'done', 'failed'];
const DEFAULT_PARTS_NO = 8;
const ID_POSITION = 4;
const STATE_POSITION = 6;

/**
 * The `RPipe` class provides functionality for managing and manipulating data within a Redis database.
 * It supports operations such as collecting, moving, and merging data based on state transitions.
 */
export class RPipe {
  private _name: string; // The aggregation group name
  private _client: RedisClientType; // Redis client instance
  private _prefix: string; // Prefix for Redis keys
  private _postFix: string | null | undefined = null; // Optional postfix for Redis keys
  private _states: string[]; // List of states for data aggregation
  private _collectorName: string; // Name of the collector
  private _separator: string; // Separator used in Redis keys
  private _partsNo: number; // Expected number of parts in a parsed Redis key

  /**
   * Constructs an instance of the `RPipe` class.
   * @param {string} name - The name of the aggregation group.
   * @param {RedisClientType} redisClient - The Redis client instance.
   * @param {AggregatorOptions} options - Configuration options for the aggregator.
   */
  constructor(name: string, redisClient: RedisClientType, options: AggregatorOptions) {
    this._client = redisClient;
    this._name = name;
    this._postFix = name || options.postFix;
    this._prefix = 'pipe' || options.prefix;
    this._collectorName = options?.collectorName || defaultCollectorName;
    this._states = [defaultCollectorName, ...(options?.states ?? defaultStates)];
    this._separator = ':';
    this._partsNo = DEFAULT_PARTS_NO;
  }

  /**
   * Generates a Redis key based on the provided key and state.
   * @param {string} key - The key to be included in the Redis key.
   * @param {string} state - The state to be included in the Redis key.
   * @returns {string} The generated Redis key.
   */
  private keyFormula(key: string, state: string): string {
    return `${this._prefix}${this._separator}group${this._separator}${this._name}${this._separator}id${this._separator}${key}${this._separator}state${this._separator}${state}${this._separator}${this._postFix}`;
  }

  /**
   * Parses a Redis key into its components.
   * @param {string} key - The Redis key to be parsed.
   * @returns {object} An object containing the id and state extracted from the key.
   * @throws {Error} If the key format is invalid.
   */
  public parseKey(key: string): { id: string, state: string } {
    const parts = key.split(this._separator);
    if (parts.length !== this._partsNo) {
      throw new Error('Invalid key format');
    }

    return {
      id: parts[ID_POSITION],
      state: parts[STATE_POSITION]
    };
  }

  /**
   * Returns the name of the next state related to the current state.
   * @param {string} state - The current state.
   * @returns {string | null} The next state name, or null if there is no next state.
   * @throws {Error} If the source state name is invalid.
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
   * Generates a Redis key for the given id and state.
   * @param {string} id - The id to be included in the Redis key.
   * @param {string} state - The state to be included in the Redis key.
   * @returns {string} The generated Redis key.
   * @throws {Error} If the state name is invalid.
   */
  public getKey(id: string, state: string): string {
    if (!this._states.includes(state)) {
      throw new Error(`Invalid state name - ${state}`);
    }
    return this.keyFormula(id, state);
  }

  /**
   * Returns the name of the collector.
   * @returns {string} The collector name.
   */
  public getCollectoreName(): string {
    return this._collectorName;
  }

  /**
   * Registers an array of messages in Redis.
   * @param {Message[]} messages - The messages to be registered.
   * @throws {Error} If a message is invalid.
   */
  public async registerMessages(messages: Message[]): Promise<void> {
    const multi = this._client.multi();
    for (const message of messages) {
      if (!validateMessage(message)) {
        throw new Error('Invalid message');
      }
      const { receiver, action } = message;
      const key = this.getKey(receiver.id.toString(), this._collectorName);

      // @ts-ignore
      multi.sAdd(key, JSON.stringify(action));
    }
    await multi.exec();
  }

  /**
   * Moves data from one Redis key to another.
   * @param {string} from - The source Redis key.
   * @param {string} to - The destination Redis key.
   * @throws {Error} If an error occurs during the move operation.
   */
  public async move(from: string, to: string): Promise<void> {
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
   * Moves data for a specific id from one state to another.
   * @param {string} id - The id of the data to be moved.
   * @param {string} fromState - The source state.
   * @param {string} toState - The destination state.
   * @returns {Promise<void>} A promise that resolves when the move operation is complete.
   */
  public async moveId(id: string, fromState: string, toState: string): Promise<void> {
    const fromKey = this.getKey(id, fromState);
    const toKey = this.getKey(id, toState);
    return this.move(fromKey, toKey);
  }

  /**
   * Moves data for a specific id to the next state.
   * @param {string} id - The id of the data to be moved.
   * @param {string} fromState - The current state.
   * @returns {Promise<void | null>} A promise that resolves when the move operation is complete, or null if there is no next state.
   */
  public async next(id: string, fromState: string): Promise<void | null> {
    const key = this.getKey(id, fromState);
    const toState = this.getNextStateName(fromState);
    if (!toState) {
      return null;
    }
    const nextKey = this.getKey(id, toState);
    return this.move(key, nextKey);
  }

  /**
   * Returns the list of states for data aggregation.
   * @returns {string[]} The list of states.
   */
  public states(): string[] {
    return this._states;
  }

  /**
   * Adds a value to a Redis set for a specific key and state.
   * @param {string} key - The key to be included in the Redis set.
   * @param {string} state - The state to be included in the Redis set.
   * @param {string} value - The value to be added to the Redis set.
   * @returns {Promise<void>} A promise that resolves when the add operation is complete.
   */
  public async add(key: string, state: string, value: string): Promise<void> {
    const multi = this._client.multi();
    const toKey = this.getKey(key, state);
    multi.sAdd(toKey, value);
    await multi.exec();
  }

  /**
   * Retrieves the members of a Redis set for a specific key and state.
   * @param {string} key - The key to be included in the Redis set.
   * @param {string} state - The state to be included in the Redis set.
   * @returns {Promise<string[]>} A promise that resolves with the members of the Redis set.
   */
  public async getMembers(key: string, state: string): Promise<string[]> {
    const aggregatorKey = this.getKey(key, state);
    // @ts-ignore
    return this._client.sMembers(aggregatorKey);
  }

  /**
   * Retrieves the collected members for a specific key.
   * @param {string} key - The key to be included in the Redis set.
   * @returns {Promise<string[]>} A promise that resolves with the collected members.
   */
  public async getCollected(key: string): Promise<string[]> {
    return this.getMembers(key, this._collectorName);
  }

  /**
   * Merges data from multiple states into a single state for a specific key.
   * @param {string} key - The key to be included in the Redis set.
   * @param {string} to - The destination state.
   * @param {string[]} from - The source states.
   * @returns {Promise<string[]>} A promise that resolves with the members of the merged Redis set.
   * @throws {Error} If a state name is invalid.
   */
  public async merge(key: string, to: string, from: string[]): Promise<string[]> {
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
    const result = await this._client
      .multi()
      .sUnionStore(toKey, fromKeys)
      .sMembers(toKey)
      .exec();

    return result[1] as string[];
  }

  /**
   * Clears data for a specific id and state.
   * @param {string} id - The id of the data to be cleared.
   * @param {string} state - The state of the data to be cleared.
   * @returns {Promise<number>} A promise that resolves with the number of keys that were removed.
   * @throws {Error} If the state name is invalid.
   */
  public async clear(id: string, state: string): Promise<number> {
    if (!this._states.includes(state)) {
      throw new Error('Invalid state name');
    }

    const key = this.getKey(id, state);
    return this._client.del(key);
  }
}
