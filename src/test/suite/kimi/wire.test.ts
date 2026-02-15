/**
 * Wire Protocol Tests
 * Tests for JSON-RPC wire protocol communication
 */

import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
    WireMessageEnvelope,
    WireError,
    TurnBeginPayload,
    TurnEndPayload,
    StepBeginPayload,
    StepEndPayload,
    ContentPart,
    TextPart,
    ThinkPart,
    ToolCall,
    ToolResult,
    ApprovalRequestPayload,
    StatusUpdatePayload,
} from '../../../kimi/wireTypes';

describe('Wire Protocol', () => {
    describe('Message Envelope Serialization', () => {
        it('should create valid request envelope', () => {
            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                id: 1,
                method: 'sendMessage',
                params: {
                    content: 'Hello, Kimi!',
                    context: { current_file: 'test.ts' }
                }
            };

            assert.strictEqual(envelope.jsonrpc, '2.0');
            assert.strictEqual(envelope.id, 1);
            assert.strictEqual(envelope.method, 'sendMessage');
            assert.ok(envelope.params);
            assert.strictEqual((envelope.params as any).content, 'Hello, Kimi!');
        });

        it('should create valid response envelope', () => {
            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                id: 1,
                result: { success: true, message: 'Response received' }
            };

            assert.strictEqual(envelope.jsonrpc, '2.0');
            assert.strictEqual(envelope.id, 1);
            assert.ok(envelope.result);
            assert.strictEqual((envelope.result as any).success, true);
            assert.strictEqual(envelope.method, undefined);
        });

        it('should create valid error envelope', () => {
            const error: WireError = {
                code: -32600,
                message: 'Invalid Request',
                data: { details: 'Missing required field' }
            };

            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                id: 1,
                error
            };

            assert.strictEqual(envelope.jsonrpc, '2.0');
            assert.strictEqual(envelope.id, 1);
            assert.ok(envelope.error);
            assert.strictEqual(envelope.error?.code, -32600);
            assert.strictEqual(envelope.error?.message, 'Invalid Request');
        });

        it('should create valid notification envelope (no id)', () => {
            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                method: 'StatusUpdate',
                params: { type: 'connected', message: 'Ready' }
            };

            assert.strictEqual(envelope.jsonrpc, '2.0');
            assert.strictEqual(envelope.id, undefined);
            assert.strictEqual(envelope.method, 'StatusUpdate');
            assert.strictEqual((envelope.params as any).type, 'connected');
        });

        it('should serialize to valid JSON', () => {
            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                id: 'test-id-123',
                method: 'ping',
                params: {}
            };

            const json = JSON.stringify(envelope);
            const parsed = JSON.parse(json);

            assert.strictEqual(parsed.jsonrpc, '2.0');
            assert.strictEqual(parsed.id, 'test-id-123');
            assert.strictEqual(parsed.method, 'ping');
        });
    });

    describe('Message Parsing', () => {
        it('should parse TurnBegin event', () => {
            const payload: TurnBeginPayload = {
                turn_id: 'turn-123',
                user_input: 'Explain this code',
                context: {
                    files: ['src/test.ts'],
                    selections: [{
                        file_path: 'src/test.ts',
                        start_line: 10,
                        start_column: 0,
                        end_line: 20,
                        end_column: 5,
                        content: 'function test() {}'
                    }]
                }
            };

            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                method: 'TurnBegin',
                params: payload
            };

            assert.strictEqual((envelope.params as TurnBeginPayload).turn_id, 'turn-123');
            assert.strictEqual((envelope.params as TurnBeginPayload).user_input, 'Explain this code');
            assert.strictEqual((envelope.params as TurnBeginPayload).context?.files?.length, 1);
        });

        it('should parse TurnEnd event', () => {
            const payload: TurnEndPayload = {
                turn_id: 'turn-123',
                finish_reason: 'completed'
            };

            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                method: 'TurnEnd',
                params: payload
            };

            assert.strictEqual((envelope.params as TurnEndPayload).turn_id, 'turn-123');
            assert.strictEqual((envelope.params as TurnEndPayload).finish_reason, 'completed');
        });

        it('should parse TurnEnd with error', () => {
            const payload: TurnEndPayload = {
                turn_id: 'turn-456',
                finish_reason: 'error',
                error: 'API rate limit exceeded'
            };

            assert.strictEqual(payload.finish_reason, 'error');
            assert.ok(payload.error);
            assert.ok(payload.error?.includes('rate limit'));
        });

        it('should parse StepBegin event', () => {
            const payload: StepBeginPayload = {
                step_id: 'step-1',
                turn_id: 'turn-123',
                type: 'thinking'
            };

            assert.strictEqual(payload.step_id, 'step-1');
            assert.strictEqual(payload.type, 'thinking');
        });

        it('should parse StepEnd event', () => {
            const payload: StepEndPayload = {
                step_id: 'step-1',
                turn_id: 'turn-123',
                status: 'success'
            };

            assert.strictEqual(payload.status, 'success');
        });

        it('should parse ContentPart with text', () => {
            const textPart: TextPart = {
                type: 'text',
                text: 'Here is the explanation...'
            };

            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                method: 'ContentPart',
                params: textPart
            };

            const part = envelope.params as ContentPart;
            assert.strictEqual(part.type, 'text');
            if (part.type === 'text') {
                assert.strictEqual(part.text, 'Here is the explanation...');
            }
        });

        it('should parse ContentPart with think', () => {
            const thinkPart: ThinkPart = {
                type: 'think',
                content: 'Let me analyze this step by step...'
            };

            assert.strictEqual(thinkPart.type, 'think');
            assert.ok(thinkPart.content.length > 0);
        });
    });

    describe('Tool Events', () => {
        it('should parse ToolCall event', () => {
            const toolCall: ToolCall = {
                id: 'tool-1',
                name: 'read_file',
                arguments: {
                    path: '/workspace/src/test.ts'
                }
            };

            assert.strictEqual(toolCall.id, 'tool-1');
            assert.strictEqual(toolCall.name, 'read_file');
            assert.strictEqual((toolCall.arguments as any).path, '/workspace/src/test.ts');
        });

        it('should parse ToolResult event', () => {
            const toolResult: ToolResult = {
                tool_call_id: 'tool-1',
                name: 'read_file',
                content: 'file content here',
                execution_time_ms: 150
            };

            assert.strictEqual(toolResult.tool_call_id, 'tool-1');
            assert.strictEqual(toolResult.name, 'read_file');
            assert.strictEqual(toolResult.execution_time_ms, 150);
        });

        it('should parse ToolResult with error', () => {
            const toolResult: ToolResult = {
                tool_call_id: 'tool-2',
                name: 'write_file',
                content: 'Permission denied',
                is_error: true,
                execution_time_ms: 50
            };

            assert.strictEqual(toolResult.is_error, true);
            assert.ok((toolResult.content as string).includes('Permission'));
        });
    });

    describe('Approval System', () => {
        it('should parse file write approval request', () => {
            const payload: ApprovalRequestPayload = {
                request_id: 'req-1',
                turn_id: 'turn-123',
                type: 'file_write',
                description: 'Write to file: src/test.ts',
                details: {
                    file_path: '/workspace/src/test.ts',
                    content_preview: 'function hello() { return "world"; }',
                    is_create: false,
                    is_delete: false
                }
            };

            assert.strictEqual(payload.type, 'file_write');
            assert.strictEqual((payload.details as any).file_path, '/workspace/src/test.ts');
            assert.strictEqual((payload.details as any).is_create, false);
        });

        it('should parse command execution approval request', () => {
            const payload: ApprovalRequestPayload = {
                request_id: 'req-2',
                turn_id: 'turn-123',
                type: 'command_execute',
                description: 'Execute command: npm install',
                details: {
                    command: 'npm install',
                    cwd: '/workspace',
                    env: { NODE_ENV: 'development' }
                },
                timeout_ms: 30000
            };

            assert.strictEqual(payload.type, 'command_execute');
            assert.strictEqual((payload.details as any).command, 'npm install');
            assert.strictEqual(payload.timeout_ms, 30000);
        });

        it('should parse external request approval', () => {
            const payload: ApprovalRequestPayload = {
                request_id: 'req-3',
                turn_id: 'turn-123',
                type: 'external_request',
                description: 'HTTP request to api.example.com',
                details: {
                    url: 'https://api.example.com/data',
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer token' },
                    body_preview: '{"key": "value"}'
                }
            };

            assert.strictEqual(payload.type, 'external_request');
            assert.strictEqual((payload.details as any).method, 'POST');
        });
    });

    describe('Status Updates', () => {
        it('should parse connected status', () => {
            const payload: StatusUpdatePayload = {
                type: 'connected',
                message: 'Connected to Kimi CLI'
            };

            assert.strictEqual(payload.type, 'connected');
        });

        it('should parse busy status with progress', () => {
            const payload: StatusUpdatePayload = {
                type: 'busy',
                message: 'Indexing files...',
                progress: {
                    current: 50,
                    total: 100,
                    message: 'Processing src/utils.ts'
                }
            };

            assert.strictEqual(payload.type, 'busy');
            assert.ok(payload.progress);
            assert.strictEqual(payload.progress?.current, 50);
            assert.strictEqual(payload.progress?.total, 100);
            assert.strictEqual((payload.progress!.current / payload.progress!.total) * 100, 50);
        });

        it('should parse error status', () => {
            const payload: StatusUpdatePayload = {
                type: 'error',
                message: 'Connection lost'
            };

            assert.strictEqual(payload.type, 'error');
        });
    });

    describe('JSON-RPC 2.0 Compliance', () => {
        it('should always include jsonrpc field', () => {
            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                method: 'ping',
                params: {}
            };

            const json = JSON.stringify(envelope);
            assert.ok(json.includes('"jsonrpc":"2.0"'));
        });

        it('should handle string IDs', () => {
            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                id: 'uuid-123-abc',
                method: 'test'
            };

            assert.strictEqual(envelope.id, 'uuid-123-abc');
        });

        it('should handle null ID for notifications', () => {
            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                id: null,
                method: 'notification'
            };

            assert.strictEqual(envelope.id, null);
        });

        it('should not have both result and error', () => {
            // This is a protocol rule - envelopes should not have both
            const validResponse: WireMessageEnvelope = {
                jsonrpc: '2.0',
                id: 1,
                result: { data: 'ok' }
            };

            assert.ok(validResponse.result);
            assert.strictEqual(validResponse.error, undefined);
        });
    });

    describe('Message Types', () => {
        it('should handle batch requests', () => {
            const batch: WireMessageEnvelope[] = [
                { jsonrpc: '2.0', id: 1, method: 'method1', params: {} },
                { jsonrpc: '2.0', id: 2, method: 'method2', params: {} }
            ];

            assert.strictEqual(batch.length, 2);
            assert.strictEqual(batch[0].id, 1);
            assert.strictEqual(batch[1].id, 2);
        });

        it('should handle nested params', () => {
            const envelope: WireMessageEnvelope = {
                jsonrpc: '2.0',
                id: 1,
                method: 'complexMethod',
                params: {
                    nested: {
                        deeply: {
                            value: 123
                        }
                    },
                    array: [1, 2, 3],
                    nullValue: null
                }
            };

            const params = envelope.params as any;
            assert.strictEqual(params.nested.deeply.value, 123);
            assert.strictEqual(params.array.length, 3);
            assert.strictEqual(params.nullValue, null);
        });
    });
});
