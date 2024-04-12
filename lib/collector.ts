import { Message} from './types';
import {validateMessage} from "./messageValidator";

const grouping =  (messages: Message[]) =>  messages.reduce((total: any, message) => {
    if (!validateMessage(message)) {
        throw new Error('Invalid message');
    }

    const {receiver, action} = message;
    if (!total[receiver.name]) {
        total[receiver.name] = [];
    }
    total[receiver.name].push(message);
    return total;
  }, {});

