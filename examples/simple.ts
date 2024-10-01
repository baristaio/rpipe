import {connect } from '../lib/redisClient';
const config = require('./config');
import {type Action, Message, Receiver} from '@baristaio/rpipe/lib/types';
import { RPipe }  from '../lib/rpipe';
import {RedisClientType} from "redis";
const modules: string[] = ['test1', 'test2', 'test3'];

const createAggregator = (name:string, client: any) => {
    return new RPipe(name, client, {
        prefix: 'pipe',
        postFix: name
    });
};

const messageGenerator = (name: string, id: number,  action: Action):Message => {
    const receiver: Receiver = {
        name,
        id
    }
   return {
       receiver,
       action
   };
};

// connect(config.redis).then((client:any) =>  {
//     console.log('client connected');
//     const aggregator = createAggregator('test', client);
//     console.log('aggregator created');
//     const message: Message = messageGenerator('test', 2, {type: 'test', payload: {data: 'test'}});
//     aggregator.registerMessages([message]);
//     console.log('messages registered');
//     await aggregator.move('collector', 'processing');
//     await aggregator.move('processing', 'done');
//     await aggregator.move('done', 'failed');
//     console.log('message moved');
// });


async function main() {
    const client: RedisClientType = await connect(config.redis);
    const pipe = createAggregator('test', client);
    const message: Message = messageGenerator('test', 2, {type: 'test', payload: {data: 'test'}});
    await pipe.registerMessages([message]);
    await pipe.moveId("2",'collector', 'processing');
    await pipe.moveId('2', 'processing', 'done');
    await pipe.moveId('2', 'done', 'failed');

    const messages: Message[] = [];
    for (let i = 0; i < 1000; i++) {
        messages.push(messageGenerator('test', 3, {type: `test-${i}`, payload: {count: i + 10000000}}));
    }

    const startTime = performance.now();
    await pipe.registerMessages(messages);
    await pipe.next("3", 'collector');
    let state: string | null = pipe.getNextStateName('collector');
    await pipe.next('3', state as string);
    state = pipe.getNextStateName(state as string) as string;
    await pipe.next('3', state as string);
    const endTime = performance.now()
    console.log(`Data moved successfully: ${endTime - startTime} [ms]`);
}


main().catch(console.error);
