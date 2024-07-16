import type {RedisClientType, RedisClientOptions} from 'redis'
import {createClient} from 'redis';

export function connect(config: any): Promise<RedisClientType> {
  const options = {
    socket: {
      host: config.host,
      port: config.port
    },
    password: config.password,
    legacyMode: config.legacyMode
  };


  return new Promise((resolve, reject) => {
    const client: any = createClient(options);
    client.connect();// as RedisClientType;
    client.on('connect', () => {
      resolve(client);
    });
    client.on('error', (err: any) => {
      reject(err);
    });
    client.on('end', (end: any) => {
      reject(end);
    });
  });
}


module.exports = {
  connect
}
