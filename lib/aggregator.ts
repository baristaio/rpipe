import {AggregatorOptions, Message} from "./types";
import {RedisClientType} from "redis";
import {IClient} from "../examples/client";
import {validateMessage} from "./messageValidator";


enum AggregatorState {
    COLLECTOR = 'collector',
    PROCESSING = 'processing',
    DONE = 'done'
};

class Aggregator {
  private _name: string; // the aggregation group name
  private _client: RedisClientType;
  private _prefix: string = 'aggregator';
  private _postFix: string | null = null;

  constructor(name: string, redisClient: IClient, options: AggregatorOptions) {
    this._client = redisClient.client;
    this._name = name;
    this._postFix = name || options.postFix;
    this._prefix = this._prefix || options.prefix;
  }

  public async registerMessages(messages: Message[]) {
    const multi = this._client.multi();
    for (const message of messages) {
        if (!validateMessage(message)) {
            throw new Error('Invalid message');
        }
        const {receiver, action} = message;
        const key = this.getKey(receiver.id.toString(), AggregatorState.COLLECTOR);
        multi.sAdd(key, JSON.stringify(action));
    }
    await multi.exec();
  }


  private getKey(key:string, state: string) {
    return `${this._prefix}:group:${this._name}:id:${key}:state:${state}:${this._postFix}`;
  }

  public async moveState(key: string, from: AggregatorState, to: AggregatorState) {
    const multi = this._client.multi();
    const fromKey = this.getKey(key, from);
    const toKey = this.getKey(key, to);
    multi.sUnionStore(toKey, fromKey);
    multi.del(fromKey);
    await multi.exec();
  }

  public async addToState(key: string, state: AggregatorState, action: string) {
    const multi = this._client.multi();
    const toKey = this.getKey(key, state);
    multi.sAdd(toKey, action);
    await multi.exec();
  }

  public async getMembers(key: string, state: AggregatorState) {
    const aggregatorKey = this.getKey(key, state);
    return this._client.sMembers(aggregatorKey);
  }

  public async merge(key: string, to: AggregatorState, from: AggregatorState[]) {
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

  public async clear(id: string, state: AggregatorState) {
    const key = this.getKey(id, state);
    return this._client.del(key);
  }
}

export = Aggregator;
