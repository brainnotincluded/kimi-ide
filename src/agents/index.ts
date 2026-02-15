/**
 * Multi-Agent System for Kimi VS Code Extension
 * 
 * Экспорт всех агентов и типов для системы мульти-агентов.
 * Превосходит Codebuff через:
 * - Интеграцию с VS Code API (AST, workspace.fs, language services)
 * - Wire Protocol для связи между агентами
 * - Параллельное выполнение стратегий
 * - Специализированных агентов для каждой задачи
 */

// ============================================================================
// Base Classes
// ============================================================================

export { BaseAgent, AgentRegistry } from './baseAgent';
export type { BaseAgentOptions } from './baseAgent';

// ============================================================================
// Agent Types
// ============================================================================

export * from './types';

// ============================================================================
// Specialized Agents
// ============================================================================

export { OrchestratorAgent } from './orchestrator';
export type { OrchestratorOptions, WorkflowResult } from './orchestrator';

export { FileDiscoveryAgent } from './fileDiscoveryAgent';
export type { FileDiscoveryOptions } from './fileDiscoveryAgent';

export { PlannerAgent } from './plannerAgent';
export type { PlannerOptions } from './plannerAgent';

export { EditorAgent } from './editorAgent';
export type { EditorOptions } from './editorAgent';

export { ReviewerAgent } from './reviewerAgent';
export type { ReviewerOptions } from './reviewerAgent';

export { TestingAgent } from './testingAgent';
export type { TestingOptions } from './testingAgent';

// ============================================================================
// Factory & Utilities
// ============================================================================

import * as vscode from 'vscode';
import { BaseAgent, AgentRegistry } from './baseAgent';
import { OrchestratorAgent } from './orchestrator';
import { FileDiscoveryAgent } from './fileDiscoveryAgent';
import { PlannerAgent } from './plannerAgent';
import { EditorAgent } from './editorAgent';
import { ReviewerAgent } from './reviewerAgent';
import { TestingAgent } from './testingAgent';

/**
 * Конфигурация для создания Multi-Agent System
 */
export interface MultiAgentSystemConfig {
    /** VS Code API context */
    vscode: {
        workspace: typeof vscode.workspace;
        window: typeof vscode.window;
        commands: typeof vscode.commands;
        languages: typeof vscode.languages;
    };
    /** Максимальное количество параллельных агентов */
    maxConcurrentAgents?: number;
    /** Таймаут по умолчанию для агентов (мс) */
    defaultTimeoutMs?: number;
}

/**
 * Multi-Agent System
 * Центральная точка управления всеми агентами
 */
export class MultiAgentSystem {
    private registry: AgentRegistry;
    private orchestrator: OrchestratorAgent;
    private config: MultiAgentSystemConfig;
    
    constructor(config: MultiAgentSystemConfig) {
        this.config = config;
        this.registry = new AgentRegistry();
        
        // Create orchestrator
        this.orchestrator = new OrchestratorAgent({
            vscodeContext: {
                workspace: config.vscode.workspace,
                window: config.vscode.window,
            },
            registry: this.registry,
            maxConcurrentAgents: config.maxConcurrentAgents,
        });
        
        // Register orchestrator
        this.registry.register(this.orchestrator);
    }
    
    /**
     * Инициализация системы
     */
    async initialize(): Promise<void> {
        await this.orchestrator.initialize();
    }
    
    /**
     * Получение orchestrator
     */
    getOrchestrator(): OrchestratorAgent {
        return this.orchestrator;
    }
    
    /**
     * Получение registry
     */
    getRegistry(): AgentRegistry {
        return this.registry;
    }
    
    /**
     * Создание FileDiscoveryAgent
     */
    createFileDiscoveryAgent(): FileDiscoveryAgent {
        const agent = new FileDiscoveryAgent({
            vscodeContext: {
                workspace: this.config.vscode.workspace,
            },
            model: 'kimi-k2.5-lite',
        });
        this.registry.register(agent as unknown as BaseAgent);
        return agent;
    }
    
    /**
     * Создание PlannerAgent
     */
    createPlannerAgent(): PlannerAgent {
        const agent = new PlannerAgent({
            vscodeContext: {
                workspace: this.config.vscode.workspace,
            },
        });
        this.registry.register(agent as unknown as BaseAgent);
        return agent;
    }
    
    /**
     * Создание EditorAgent
     */
    createEditorAgent(): EditorAgent {
        const agent = new EditorAgent({
            vscodeContext: {
                workspace: this.config.vscode.workspace,
                window: this.config.vscode.window,
            },
        });
        this.registry.register(agent as unknown as BaseAgent);
        return agent;
    }
    
    /**
     * Создание ReviewerAgent
     */
    createReviewerAgent(): ReviewerAgent {
        const agent = new ReviewerAgent({
            vscodeContext: {
                workspace: this.config.vscode.workspace,
                window: this.config.vscode.window,
                languages: this.config.vscode.languages,
            },
        });
        this.registry.register(agent as unknown as BaseAgent);
        return agent;
    }
    
    /**
     * Создание TestingAgent
     */
    createTestingAgent(): TestingAgent {
        const agent = new TestingAgent({
            vscodeContext: {
                workspace: this.config.vscode.workspace,
                window: this.config.vscode.window,
            },
        });
        this.registry.register(agent as unknown as BaseAgent);
        return agent;
    }
    
    /**
     * Очистка всех агентов
     */
    async dispose(): Promise<void> {
        await this.registry.clear();
    }
}

/**
 * Создание Multi-Agent System с настройками по умолчанию
 */
export function createMultiAgentSystem(
    vscodeContext: MultiAgentSystemConfig['vscode']
): MultiAgentSystem {
    return new MultiAgentSystem({
        vscode: vscodeContext,
        maxConcurrentAgents: 5,
        defaultTimeoutMs: 60000,
    });
}

// ============================================================================
// Advantages over Codebuff (JSDoc documentation)
// ============================================================================

/**
 * @fileoverview
 * 
 * Multi-Agent System для Kimi VS Code Extension
 * 
 * ## Преимущества над Codebuff:
 * 
 * ### 1. Интеграция с VS Code API
 * - Прямой доступ к AST через TypeScript Compiler API
 * - Быстрый доступ к файлам через workspace.fs
 * - Интеграция с language services (символы, диагностики)
 * - Нативные диагностики в UI
 * 
 * ### 2. Wire Protocol
 * - JSON-RPC поверх событий EventEmitter
 * - Типизированные сообщения между агентами
 * - Корреляция запросов/ответов
 * - Graceful cancellation
 * 
 * ### 3. Параллельное выполнение
 * - 3 стратегии редактирования одновременно
 * - Параллельные проверки (typecheck, lint, test, security)
 * - DAG-based execution для зависимостей
 * - Resource pooling
 * 
 * ### 4. Специализированные агенты
 * - **Orchestrator**: Координация workflow, spawn decisions
 * - **FileDiscovery**: Быстрый поиск файлов (1-2 вызова модели)
 * - **Planner**: Dependency graph, risk assessment
 * - **Editor**: 3 стратегии (AST, Text, Semantic)
 * - **Reviewer**: Параллельные проверки качества
 * - **Testing**: Генерация и запуск тестов
 * 
 * ### 5. VS Code Integration
 * - Диагностики в Problems panel
 * - DecorationProvider для diff
 * - CodeLens для тестов
 * - Progress notifications
 */

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';

// ============================================================================
// Default Export
// ============================================================================

export default {
    MultiAgentSystem,
    createMultiAgentSystem,
    VERSION,
};
