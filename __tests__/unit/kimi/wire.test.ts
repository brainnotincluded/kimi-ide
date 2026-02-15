/**
 * Kimi Wire Protocol Unit Tests
 * Tests for the wire protocol implementation
 */

import {
    WireMessage,
    WireMessageType,
    createConnectMessage,
    createDisconnectMessage,
    createChatMessage,
    createCompletionMessage,
    createResponseMessage,
    createErrorMessage,
    serializeMessage,
    deserializeMessage,
    validateMessage,
} from '../../../src/kimi/wire';

describe('Kimi Wire Protocol', () => {
    describe('Message Creation', () => {
        it('should create connect message', () => {
            const message = createConnectMessage({ clientVersion: '1.0.0' });
            
            expect(message.type).toBe(WireMessageType.CONNECT);
            expect(message.payload).toEqual({ clientVersion: '1.0.0' });
            expect(message.id).toBeDefined();
            expect(message.timestamp).toBeDefined();
        });

        it('should create disconnect message', () => {
            const message = createDisconnectMessage({ reason: 'user_exit' });
            
            expect(message.type).toBe(WireMessageType.DISCONNECT);
            expect(message.payload).toEqual({ reason: 'user_exit' });
        });

        it('should create chat message', () => {
            const payload = {
                content: 'Hello, Kimi!',
                context: { files: ['/path/to/file.ts'] },
            };
            const message = createChatMessage(payload);
            
            expect(message.type).toBe(WireMessageType.CHAT);
            expect(message.payload).toEqual(payload);
        });

        it('should create completion message', () => {
            const payload = {
                prompt: 'function calculate() {',
                language: 'typescript',
                maxTokens: 100,
            };
            const message = createCompletionMessage(payload);
            
            expect(message.type).toBe(WireMessageType.COMPLETION);
            expect(message.payload).toEqual(payload);
        });

        it('should create response message', () => {
            const payload = { content: 'This is a response' };
            const requestId = 'req-123';
            const message = createResponseMessage(payload, requestId);
            
            expect(message.type).toBe(WireMessageType.RESPONSE);
            expect(message.payload).toEqual(payload);
            expect(message.requestId).toBe(requestId);
        });

        it('should create error message', () => {
            const payload = { code: 'INVALID_REQUEST', message: 'Invalid request format' };
            const message = createErrorMessage(payload);
            
            expect(message.type).toBe(WireMessageType.ERROR);
            expect(message.payload).toEqual(payload);
        });
    });

    describe('Serialization', () => {
        it('should serialize message to string', () => {
            const message: WireMessage = {
                id: 'msg-123',
                type: WireMessageType.CHAT,
                timestamp: 1234567890,
                payload: { content: 'Hello' },
            };
            
            const serialized = serializeMessage(message);
            expect(typeof serialized).toBe('string');
            
            const parsed = JSON.parse(serialized);
            expect(parsed.id).toBe('msg-123');
            expect(parsed.type).toBe(WireMessageType.CHAT);
        });

        it('should deserialize string to message', () => {
            const json = JSON.stringify({
                id: 'msg-123',
                type: WireMessageType.CHAT,
                timestamp: 1234567890,
                payload: { content: 'Hello' },
            });
            
            const message = deserializeMessage(json);
            expect(message.id).toBe('msg-123');
            expect(message.type).toBe(WireMessageType.CHAT);
            expect(message.payload).toEqual({ content: 'Hello' });
        });

        it('should handle serialization roundtrip', () => {
            const original: WireMessage = {
                id: 'msg-123',
                type: WireMessageType.COMPLETION,
                timestamp: 1234567890,
                payload: { prompt: 'test', maxTokens: 100 },
            };
            
            const serialized = serializeMessage(original);
            const deserialized = deserializeMessage(serialized);
            
            expect(deserialized).toEqual(original);
        });

        it('should throw error for invalid JSON', () => {
            expect(() => deserializeMessage('invalid json')).toThrow();
        });
    });

    describe('Validation', () => {
        it('should validate correct message', () => {
            const message: WireMessage = {
                id: 'msg-123',
                type: WireMessageType.CHAT,
                timestamp: 1234567890,
                payload: {},
            };
            
            expect(validateMessage(message)).toBe(true);
        });

        it('should reject message without id', () => {
            const message: any = {
                type: WireMessageType.CHAT,
                timestamp: 1234567890,
                payload: {},
            };
            
            expect(validateMessage(message)).toBe(false);
        });

        it('should reject message without type', () => {
            const message: any = {
                id: 'msg-123',
                timestamp: 1234567890,
                payload: {},
            };
            
            expect(validateMessage(message)).toBe(false);
        });

        it('should reject message with invalid type', () => {
            const message: any = {
                id: 'msg-123',
                type: 'INVALID_TYPE',
                timestamp: 1234567890,
                payload: {},
            };
            
            expect(validateMessage(message)).toBe(false);
        });

        it('should reject message without timestamp', () => {
            const message: any = {
                id: 'msg-123',
                type: WireMessageType.CHAT,
                payload: {},
            };
            
            expect(validateMessage(message)).toBe(false);
        });

        it('should reject message without payload', () => {
            const message: any = {
                id: 'msg-123',
                type: WireMessageType.CHAT,
                timestamp: 1234567890,
            };
            
            expect(validateMessage(message)).toBe(false);
        });

        it('should reject null message', () => {
            expect(validateMessage(null)).toBe(false);
        });

        it('should reject non-object message', () => {
            expect(validateMessage('string')).toBe(false);
            expect(validateMessage(123)).toBe(false);
        });
    });

    describe('Message Types', () => {
        it('should have all required message types', () => {
            const expectedTypes = [
                'CONNECT',
                'DISCONNECT',
                'CHAT',
                'COMPLETION',
                'RESPONSE',
                'ERROR',
                'PING',
                'PONG',
            ];
            
            expectedTypes.forEach(type => {
                expect(WireMessageType[type as keyof typeof WireMessageType]).toBeDefined();
            });
        });
    });
});
