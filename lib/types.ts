export type Group = {
    name: string;
    id?: string | number;
}

export type AggregatorOptions = {
    states: string[];
    prefix: string;
    postFix: string;
}

export type Action = {
    type: string;
    payload: object;
}
type Receiver = {
    name: string;
    id: string | number;
}

export type Message = {
    receiver: Receiver
    action: Action
}

