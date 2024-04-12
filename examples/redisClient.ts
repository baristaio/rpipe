import redis from 'redis';
/* eslint-disable no-inline-comments */
import type { RedisClientType, RedisClientOptions} from 'redis'
import { createClient } from 'redis';
import {IClient} from "./client";


export function connect(clients: IClient[], options: RedisClientOptions): Promise<RedisClientType> {
    const client: RedisClientType = createClient(options) as RedisClientType;
    return new Promise((resolve, reject) => {
        client.on('connect', () => {
            clients.forEach((client: IClient) => {
                client.client = client;
            });
            resolve(client);
        });
        client.on('error', (err) => {
            clients.forEach((connector: IClient) => {
                connector.client = null;
            });
            reject(err);
        });
        client.on('end', (err) => {
            clients.forEach((connector: IClient) => {
                connector.client = null;
            });
            reject(err);
        });
    });
}

