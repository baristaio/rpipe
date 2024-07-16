import {AggregatorOptions, Message} from "./types";
import {RedisClientType} from "redis";
import {validateMessage} from "./messageValidator";
const defaultCollectorName = 'collector';
const defaultStates = ['processing', 'done', 'failed'];

export class Aggregator {
  private _name: string; // the aggregation group name
  private _client: RedisClientType;
  private _prefix: string;
  private _postFix: string | null | undefined = null;
  private _states: string[];
  private _collectorName: string;
  private _separator: string;
  private _partsNo: number;

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

  private keyFormula(key: string, state: string) {
    //  `${this._prefix}:group:${this._name}:id:${key}:state:${state}:${this._postFix}`
    return `${this._prefix}${this._separator}group${this._separator}${this._name}${this._separator}id${this._separator}${key}${this._separator}state${this._separator}${state}${this._separator}${this._postFix}`;
  };

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

  public nextState(state: string): string | null {
    const index = this._states.indexOf(state);
    if (index === -1) {
      throw new Error('Invalid source state name');
    }
    if (index === this._states.length - 1) {
      return null;
    }
    return this._states[index + 1];
  }


  public getKey(id:string, state: string) {
    if (!this._states.includes(state)) {
      throw new Error(`Invalid state name - ${state}`);
    }
    return this.keyFormula(id, state)
  }

  public getCollectoreName(): string {
    return this._collectorName;
  }

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

  public async moveId(id: string, fromState: string, toState: string) {
    const fromKey = this.getKey(id, fromState);
    const toKey = this.getKey(id, toState);
    return this.move(fromKey, toKey);
  }

  // public async next(key: string) {
  //   const {id, state} = this.parseKey(key);
  //   const nextState = this.nextState(state);
  //   if (!nextState) {
  //     return null;
  //   }
  //   const nextKey = this.getKey(id, nextState);
  //   return this.move(key, nextKey);
  // }
  //

  public async next(id: string, fromState: string) {
    const key = this.getKey(id, fromState)
    const toState = this.nextState(fromState);
    if (!toState) {
      // todo: what to do if it's the last state in the pipeline
      return null;
    }
    const nextKey = this.getKey(id, toState);
    return this.move(key, nextKey);
  }


  public states(): string[] {
    return this._states;
  }

  public async add(key: string, state: string, value: string) {
    const multi = this._client.multi();
    const toKey = this.getKey(key, state);
    multi.sAdd(toKey, value);
    await multi.exec();
  }

  public async getMembers(key: string, state: string) {
    const aggregatorKey = this.getKey(key, state);
    // @ts-ignore
    return this._client.sMembers(aggregatorKey);
  }

  public async getCollected(key: string) {
    return this.getMembers(key, this._collectorName);
  }

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
    // return the members of the new set
    return result[1];
  }

  public async clear(id: string, state: string) {
    if (!this._states.includes(state)) {
      throw new Error('Invalid state name');
    }

    const key = this.getKey(id, state);
    return this._client.del(key);
  }
}
