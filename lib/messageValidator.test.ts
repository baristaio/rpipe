import { validateMessage } from './messageValidator';
import {describe, expect, it } from '@jest/globals';

describe('Message Validation', () => {
    it('Should validate when message structure is correct', () => {
        const message = {
            receiver: {
                name: 'John Doe',
                id: '1234'
            },
            action: {
                type: 'greeting',
                payload: {}
            }
        };
        const valid = validateMessage(message);
        expect(valid).toBe(true);
    });

    it('Should invalidate when message lacks receiver', () => {
        const message = {
            action: {
                type: 'greeting',
                payload: {}
            }
        };
        const valid = validateMessage(message);
        expect(valid).toBe(false);
    });

    it('Should invalidate when message lacks action', () => {
        const message = {
            receiver: {
                name: 'John Doe',
                id: '1234'
            }
        };
        const valid = validateMessage(message);
        expect(valid).toBe(false);
    });

    it('Should invalidate when receiver structure is incorrect', () => {
        const message = {
            receiver: {
                name: 'John Doe'
            },
            action: {
                type: 'greeting',
                payload: {}
            }
        };
        const valid = validateMessage(message);
        expect(valid).toBe(false);
    });

    it('Should invalidate when action structure is incorrect', () => {
        const message = {
            receiver: {
                name: 'John Doe',
                id: '1234'
            },
            action: {
                payload: 'greeting'
            }
        };
        const valid = validateMessage(message);
        expect(valid).toBe(false);
    });
});
