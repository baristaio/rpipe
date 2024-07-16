import { RedisClientType } from "redis";

export interface IClient {
    client: RedisClientType;
};

export class Client implements IClient {
    private _client:  RedisClientType | null = null;

    public set client(client: RedisClientType) {
        this._client = client;
    }

    public get client (): RedisClientType {
        if (this._client === null) {
            throw new Error('Client is not connected');
        };
        return this._client;
    }
}
