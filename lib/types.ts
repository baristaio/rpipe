export type Group = {
    name: string;
    id?: string | number;
};

export type PipeOptions = {
    prefix?: string;
    postFix?: string;
    states?: string[];
    collectorName?: string;
};

export type Action = {
    type: string;
    payload?: object;
};
export type Receiver = {
    name: string;
    id: string | number;
};

export type Message = {
    receiver: Receiver
    action: Action
};

export interface IMessage  {
    message: Message;
}
