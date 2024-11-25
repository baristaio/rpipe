```markdown
# RPipe

RPipe is a TypeScript library designed to manage and manipulate data within a Redis database. It supports operations such as collecting, moving, and merging data based on state transitions.

## Features

- **State Management**: Easily manage data states and transitions.
- **Redis Integration**: Seamlessly integrates with Redis for data storage and manipulation.
- **Atomic Operations**: Ensures atomicity with Redis transactions.
- **Flexible Configuration**: Customizable options for prefixes, postfixes, and states.

### key structure

- prefix: `pipe`
- pipeName: `exampleGroup`
- pipeId: `1`
- state: `positing in the pipe`  
- postfix: `example`


pipe:exampleGroup:1:collector:example
exampleGroup:1:processing

## Installation

To install the RPipe library, use npm:

```sh
npm install @baristaio/rpipe
```

## Usage

### Importing the Library

```typescript
import { RPipe } from '@baristaio/rpipe';
import { RedisClientType } from 'redis';
import redisClient from '@baristaio/rpipe/redisClient';
```

### Creating an Instance

```typescript
const redisClient: RedisClientType = await redisClient.connect(config.redis); /* initialize your Redis client */;
const pipe = new RPipe('exampleGroup', redisClient, {
  prefix: 'pipe',
  postFix: 'example',
  collectorName: 'collector',
  states: ['processing', 'done', 'failed']
});
```

### Registering Messages

```typescript
const messages = [
  { receiver: { id: 1, name: 'receiver1' }, action: { type: 'actionType', payload: { data: 'example' } } }
];
await pipe.registerMessages(messages);
```

### Moving Data Between States

```typescript
await pipe.moveId('1', 'collector', 'processing');
await pipe.moveId('1', 'processing', 'done');
```

### Retrieving Data

```typescript
const members = await pipe.getMembers('1', 'done');
console.log(members);
```

### Clearing Data

```typescript
await pipe.clear('1', 'done');
```

## API Reference

### `RPipe`

#### Constructor

```
constructor(name: string, redisClient: RedisClientType, options: PipeOptions)
```

- `name`: The name of the aggregation group.
- `redisClient`: The Redis client instance.
- `options`: Configuration options for the aggregator.

#### Methods

- `registerMessages(messages: Message[]): Promise<void>`
- `moveId(id: string, fromState: string, toState: string): Promise<void>`
- `next(id: string, fromState: string): Promise<void | null>`
- `getMembers(key: string, state: string): Promise<string[]>`
- `clear(id: string, state: string): Promise<number>`

## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## Contact

For any questions or issues, please open an issue on [GitHub](https://github.com/baristaio/rpipe/issues).
```
