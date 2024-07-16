import {Message} from './types';
import Ajv, {JSONSchemaType} from "ajv"
const ajv = new Ajv({allowUnionTypes: true});

// @ts-ignore
export const schemaMessage: JSONSchemaType<Message> = {
    type: "object",
    properties: {
        receiver: {
            type: "object",
            properties: {
                name: {type: "string"},
                id: {type: ["string", "number"]}
            },
            required: ["name", "id"]
        },
        action: {
            type: "object",
            properties: {
                type: {type: "string"},
                payload: {type: "object"}
            },
            required: ["type", "payload"]
        }
    },
    required: ["receiver", "action"]
}

export const validateMessage = ajv.compile(schemaMessage);


