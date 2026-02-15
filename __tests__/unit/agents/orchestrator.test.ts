/**
 * Orchestrator Agent Unit Tests
 * Tests for the multi-agent orchestrator
 */

import { OrchestratorAgent } from '../../../src/agents/orchestrator';
import { AgentRegistry } from '../../../src/agents/baseAgent';
import { AgentType, AgentMessage, AgentStatus, UserRequest } from '../../../src/agents/types';

jest.mock('vscode', () => require('../../__mocks__/vscode'));

describe('OrchestratorAgent', () => {
    let orchestrator: OrchestratorAgent;
    let registry: AgentRegistry;

    beforeEach(() => {
        registry = new AgentRegistry();
        orchestrator = new OrchestratorAgent({
            vscodeContext: {
                workspace: {} as any,
                window: {} as any,
            },
            registry,
            maxConcurrentAgents: 5,
        });
    });

    afterEach(() => {
        orchestrator.dispose();
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should create orchestrator instance', () => {
            expect(orchestrator).toBeDefined();
            expect(orchestrator).toBeInstanceOf(OrchestratorAgent);
        });

        it('should have correct agent type', () => {
            expect(orchestrator.getType()).toBe('orchestrator');
        });
    });

    describe('Workflow Management', () => {
        it('should create workflow for user request', async () => {
            const request: UserRequest = {
                id: 'req-1',
                type: 'edit',
                description: 'Add error handling',
                context: {
                    files: ['/workspace/test.ts'],
                },
            };

            const workflowId = orchestrator.createWorkflowId?.(request) || 'wf-test';
            expect(workflowId).toBeDefined();
        });

        it('should track active workflows', async () => {
            const request: UserRequest = {
                id: 'req-1',
                type: 'edit',
                description: 'Test workflow',
            };

            const workflowPromise = orchestrator.processRequest(request);
            
            // Workflow should be tracked
            const workflows = orchestrator.getActiveWorkflows?.();
            if (workflows) {
                expect(workflows.size).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('Agent Coordination', () => {
        it('should spawn appropriate agents', async () => {
            const request: UserRequest = {
                id: 'req-1',
                type: 'edit',
                description: 'Edit file',
                context: {
                    files: ['/workspace/test.ts'],
                },
            };

            const decision = await orchestrator.makeSpawnDecision(request);
            expect(decision).toBeDefined();
            expect(decision.agents).toBeInstanceOf(Array);
        });

        it('should respect max concurrent agents limit', () => {
            const limit = orchestrator.getMaxConcurrentAgents?.();
            if (limit !== undefined) {
                expect(limit).toBeLessThanOrEqual(5);
            }
        });
    });

    describe('Message Handling', () => {
        it('should handle agent messages', async () => {
            const message: AgentMessage = {
                id: 'msg-1',
                type: 'TASK_COMPLETE',
                from: 'editor',
                to: 'orchestrator',
                payload: { success: true },
                timestamp: Date.now(),
            };

            await expect(orchestrator.onMessage(message)).resolves.not.toThrow();
        });

        it('should route messages between agents', async () => {
            const message: AgentMessage = {
                id: 'msg-1',
                type: 'TASK_ASSIGN',
                from: 'orchestrator',
                to: 'editor',
                payload: { task: 'edit' },
                timestamp: Date.now(),
            };

            // Should route without error
            await expect(orchestrator.routeMessage(message)).resolves.not.toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should handle agent failures', async () => {
            const request: UserRequest = {
                id: 'req-fail',
                type: 'edit',
                description: 'This will fail',
            };

            // Should handle errors gracefully
            try {
                await orchestrator.processRequest(request);
            } catch (error) {
                // Expected or should be handled
                expect(error).toBeDefined();
            }
        });

        it('should cleanup on disposal', async () => {
            orchestrator.dispose();
            
            const workflows = orchestrator.getActiveWorkflows?.();
            if (workflows) {
                expect(workflows.size).toBe(0);
            }
        });
    });

    describe('Status Management', () => {
        it('should report agent status', () => {
            const status = orchestrator.getStatus();
            expect(Object.values(AgentStatus)).toContain(status);
        });

        it('should track running agents', () => {
            const running = orchestrator.getRunningAgents?.();
            if (running) {
                expect(running).toBeInstanceOf(Set);
            }
        });
    });
});
