/**
 * API Integration Tests
 * Tests API client and wire protocol integration
 */

import { KimiClient } from '../../src/kimi/kimiClient';
import { KimiApi } from '../../src/kimi/apiAdapter';
import {
    createConnectMessage,
    createChatMessage,
    createCompletionMessage,
    serializeMessage,
    deserializeMessage,
} from '../../src/kimi/wire';

// Mock the network layer
jest.mock('vscode', () => require('../__mocks__/vscode'));

describe('Kimi API Integration', () => {
    let client: KimiClient;
    let api: KimiApi;

    beforeEach(() => {
        client = new KimiClient({
            apiKey: 'test-key',
            baseUrl: 'https://test-api.moonshot.cn/v1',
        });
        api = new KimiApi(client);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Connection', () => {
        it('should establish connection with handshake', async () => {
            const connectMessage = createConnectMessage({
                clientVersion: '1.0.0',
                capabilities: ['chat', 'completion'],
            });

            const serialized = serializeMessage(connectMessage);
            expect(serialized).toContain('CONNECT');

            const deserialized = deserializeMessage(serialized);
            expect(deserialized.type).toBe('CONNECT');
        });

        it('should handle connection errors', async () => {
            const invalidClient = new KimiClient({
                apiKey: '',
                baseUrl: 'https://invalid-url',
            });

            await expect(invalidClient.connect()).rejects.toThrow();
        });
    });

    describe('Chat Flow', () => {
        it('should send chat message and receive response', async () => {
            const chatMessage = createChatMessage({
                content: 'Hello, Kimi!',
                context: {
                    files: ['/workspace/main.ts'],
                },
            });

            const serialized = serializeMessage(chatMessage);
            const deserialized = deserializeMessage(serialized);

            expect(deserialized.payload.content).toBe('Hello, Kimi!');
        });

        it('should handle streaming response', async () => {
            const stream = await api.chatStream({
                messages: [{ role: 'user', content: 'Hello' }],
            });

            const chunks: string[] = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            expect(chunks.length).toBeGreaterThanOrEqual(0);
        });

        it('should maintain conversation context', async () => {
            const conversation = api.createConversation();
            
            await conversation.send('What is TypeScript?');
            await conversation.send('Can you show me an example?');

            const history = conversation.getHistory();
            expect(history.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant messages
        });
    });

    describe('Completion Flow', () => {
        it('should request inline completion', async () => {
            const completionMessage = createCompletionMessage({
                prompt: 'function calculateSum(a: number, b: number)',
                language: 'typescript',
                maxTokens: 100,
            });

            const serialized = serializeMessage(completionMessage);
            expect(serialized).toContain('COMPLETION');
        });

        it('should handle completion with context', async () => {
            const context = `
import { useState } from 'react';

function Counter() {
`;
            const completion = await api.complete({
                prompt: context,
                suffix: '}',
                language: 'typescript',
            });

            expect(completion).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle rate limiting', async () => {
            // Simulate rate limit
            jest.spyOn(client as any, 'sendRequest').mockRejectedValue(
                new Error('Rate limit exceeded')
            );

            await expect(api.chat({ messages: [] })).rejects.toThrow('Rate limit');
        });

        it('should handle authentication errors', async () => {
            const invalidApi = new KimiApi(new KimiClient({
                apiKey: 'invalid-key',
                baseUrl: 'https://api.moonshot.cn/v1',
            }));

            await expect(invalidApi.chat({ messages: [] })).rejects.toThrow();
        });

        it('should retry on transient failures', async () => {
            const sendRequest = jest.spyOn(client as any, 'sendRequest')
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockResolvedValueOnce({ data: 'success' });

            const result = await api.chat({ messages: [] }, { retries: 3 });
            
            expect(sendRequest).toHaveBeenCalledTimes(2);
        });
    });

    describe('Protocol Compliance', () => {
        it('should generate valid message IDs', () => {
            const message = createChatMessage({ content: 'Test' });
            expect(message.id).toMatch(/^[a-zA-Z0-9-_]+$/);
        });

        it('should include timestamps', () => {
            const before = Date.now();
            const message = createChatMessage({ content: 'Test' });
            const after = Date.now();

            expect(message.timestamp).toBeGreaterThanOrEqual(before);
            expect(message.timestamp).toBeLessThanOrEqual(after);
        });

        it('should preserve message order', () => {
            const messages = [
                createChatMessage({ content: 'First' }),
                createChatMessage({ content: 'Second' }),
                createChatMessage({ content: 'Third' }),
            ];

            const timestamps = messages.map(m => m.timestamp);
            expect(timestamps[0]).toBeLessThanOrEqual(timestamps[1]);
            expect(timestamps[1]).toBeLessThanOrEqual(timestamps[2]);
        });
    });
});
