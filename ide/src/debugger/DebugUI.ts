/**
 * Debug UI Components
 * IDE Kimi IDE - Debugger Framework
 */

import { EventEmitter, Disposable } from './types';
import { Variable, Scope, StackFrame, Thread, Breakpoint, EvaluateResult } from './types';
import { DebugSession, DebugSessionState } from './DebugSession';

// ============================================================================
// Events
// ============================================================================

export interface ToolbarActionEvent {
    action: 'continue' | 'pause' | 'stepOver' | 'stepInto' | 'stepOut' | 'stop' | 'restart';
}

export interface WatchExpressionChangedEvent {
    id: string;
    expression: string;
    result?: EvaluateResult;
    error?: string;
}

export interface CallStackSelectionEvent {
    threadId: number;
    frameId: number;
    frame: StackFrame;
}

export interface BreakpointToggledEvent {
    path: string;
    line: number;
    enabled: boolean;
}

export interface VariableExpandedEvent {
    variable: Variable;
    expanded: boolean;
}

// ============================================================================
// Debug Toolbar
// ============================================================================

export interface ToolbarState {
    canContinue: boolean;
    canPause: boolean;
    canStep: boolean;
    canStop: boolean;
    canRestart: boolean;
    isRunning: boolean;
}

/**
 * Debug Toolbar - управление кнопками отладки
 */
export class DebugToolbar implements Disposable {
    private session: DebugSession | null = null;
    private state: ToolbarState = {
        canContinue: false,
        canPause: false,
        canStep: false,
        canStop: false,
        canRestart: false,
        isRunning: false
    };

    private onActionEmitter = new EventEmitter<ToolbarActionEvent>();
    private disposables: Disposable[] = [];

    constructor() {}

    get onAction(): EventEmitter<ToolbarActionEvent> {
        return this.onActionEmitter;
    }

    get currentState(): ToolbarState {
        return { ...this.state };
    }

    /**
     * Привязать к сессии
     */
    attachToSession(session: DebugSession): void {
        this.detach();
        
        this.session = session;
        this.updateState();

        this.disposables.push(
            session.onStateChanged.on(() => this.updateState())
        );
    }

    /**
     * Отвязать от сессии
     */
    detach(): void {
        this.session = null;
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.updateState();
    }

    /**
     * Continue
     */
    async continue(): Promise<void> {
        if (this.session && this.state.canContinue) {
            await this.session.continue();
            this.onActionEmitter.emit({ action: 'continue' });
        }
    }

    /**
     * Pause
     */
    async pause(): Promise<void> {
        if (this.session && this.state.canPause) {
            await this.session.pause();
            this.onActionEmitter.emit({ action: 'pause' });
        }
    }

    /**
     * Step over
     */
    async stepOver(): Promise<void> {
        if (this.session && this.state.canStep) {
            await this.session.stepOver();
            this.onActionEmitter.emit({ action: 'stepOver' });
        }
    }

    /**
     * Step into
     */
    async stepInto(): Promise<void> {
        if (this.session && this.state.canStep) {
            await this.session.stepInto();
            this.onActionEmitter.emit({ action: 'stepInto' });
        }
    }

    /**
     * Step out
     */
    async stepOut(): Promise<void> {
        if (this.session && this.state.canStep) {
            await this.session.stepOut();
            this.onActionEmitter.emit({ action: 'stepOut' });
        }
    }

    /**
     * Stop
     */
    async stop(): Promise<void> {
        if (this.session && this.state.canStop) {
            await this.session.stop();
            this.onActionEmitter.emit({ action: 'stop' });
        }
    }

    /**
     * Restart
     */
    async restart(): Promise<void> {
        if (this.session && this.state.canRestart) {
            await this.session.restart();
            this.onActionEmitter.emit({ action: 'restart' });
        }
    }

    private updateState(): void {
        if (!this.session) {
            this.state = {
                canContinue: false,
                canPause: false,
                canStep: false,
                canStop: false,
                canRestart: false,
                isRunning: false
            };
        } else {
            const state = this.session.currentState;
            const isStopped = state === DebugSessionState.Stopped;
            const isRunning = state === DebugSessionState.Running;
            const isActive = !this.session.isTerminated;

            this.state = {
                canContinue: isStopped,
                canPause: isRunning,
                canStep: isStopped,
                canStop: isActive,
                canRestart: isActive,
                isRunning: isRunning
            };
        }
    }

    dispose(): void {
        this.detach();
        this.onActionEmitter.dispose();
    }
}

// ============================================================================
// Variables Panel
// ============================================================================

export interface VariableNode {
    variable: Variable;
    children: VariableNode[];
    expanded: boolean;
    loading: boolean;
}

/**
 * Variables Panel - отображение переменных
 */
export class VariablesPanel implements Disposable {
    private session: DebugSession | null = null;
    private scopes: Scope[] = [];
    private variables: Map<number, VariableNode[]> = new Map(); // variablesReference -> variables
    private expandedScopes: Set<number> = new Set();
    private expandedVariables: Set<number> = new Set();

    private onVariableExpandedEmitter = new EventEmitter<VariableExpandedEvent>();
    private disposables: Disposable[] = [];

    get onVariableExpanded(): EventEmitter<VariableExpandedEvent> {
        return this.onVariableExpandedEmitter;
    }

    /**
     * Привязать к сессии
     */
    attachToSession(session: DebugSession): void {
        this.detach();
        
        this.session = session;

        this.disposables.push(
            session.onStopped.on(() => this.refresh())
        );
    }

    /**
     * Отвязать от сессии
     */
    detach(): void {
        this.session = null;
        this.scopes = [];
        this.variables.clear();
        this.expandedScopes.clear();
        this.expandedVariables.clear();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    /**
     * Получить scopes
     */
    getScopes(): Scope[] {
        return [...this.scopes];
    }

    /**
     * Получить переменные для scope
     */
    getVariablesForScope(scopeId: number): VariableNode[] {
        return this.variables.get(scopeId) ?? [];
    }

    /**
     * Развернуть/свернуть scope
     */
    async toggleScope(variablesReference: number): Promise<void> {
        if (this.expandedScopes.has(variablesReference)) {
            this.expandedScopes.delete(variablesReference);
        } else {
            this.expandedScopes.add(variablesReference);
            await this.loadVariables(variablesReference);
        }
    }

    /**
     * Развернуть/свернуть переменную
     */
    async toggleVariable(variable: Variable): Promise<void> {
        if (variable.variablesReference === 0) {
            return;
        }

        if (this.expandedVariables.has(variable.variablesReference)) {
            this.expandedVariables.delete(variable.variablesReference);
            this.onVariableExpandedEmitter.emit({ variable, expanded: false });
        } else {
            this.expandedVariables.add(variable.variablesReference);
            await this.loadVariables(variable.variablesReference);
            this.onVariableExpandedEmitter.emit({ variable, expanded: true });
        }
    }

    /**
     * Проверить, развёрнут ли scope
     */
    isScopeExpanded(variablesReference: number): boolean {
        return this.expandedScopes.has(variablesReference);
    }

    /**
     * Проверить, развёрнута ли переменная
     */
    isVariableExpanded(variablesReference: number): boolean {
        return this.expandedVariables.has(variablesReference);
    }

    /**
     * Обновить данные
     */
    async refresh(): Promise<void> {
        if (!this.session) {
            return;
        }

        // Get current frame ID from session
        const frameId = this.session.activeThread?.id;
        if (!frameId) {
            return;
        }

        try {
            // Get stack frames to find current frame
            const frames = await this.session.getStackTrace();
            if (frames.length === 0) {
                return;
            }

            const currentFrame = frames[0];
            this.scopes = await this.session.getScopes(currentFrame.id);

            // Load variables for expanded scopes
            for (const scope of this.scopes) {
                if (this.expandedScopes.has(scope.variablesReference)) {
                    await this.loadVariables(scope.variablesReference);
                }
            }
        } catch (error) {
            console.error('Failed to refresh variables:', error);
        }
    }

    /**
     * Установить значение переменной
     */
    async setVariable(variablesReference: number, name: string, value: string): Promise<void> {
        if (!this.session) {
            return;
        }

        try {
            await this.session.setVariable(variablesReference, name, value);
            await this.refresh();
        } catch (error) {
            console.error('Failed to set variable:', error);
            throw error;
        }
    }

    private async loadVariables(variablesReference: number): Promise<void> {
        if (!this.session) {
            return;
        }

        try {
            const vars = await this.session.getVariables(variablesReference);
            const nodes: VariableNode[] = vars.map(v => ({
                variable: v,
                children: [],
                expanded: false,
                loading: false
            }));
            this.variables.set(variablesReference, nodes);
        } catch (error) {
            console.error('Failed to load variables:', error);
        }
    }

    dispose(): void {
        this.detach();
        this.onVariableExpandedEmitter.dispose();
    }
}

// ============================================================================
// Watch Panel
// ============================================================================

export interface WatchExpression {
    id: string;
    expression: string;
    result?: EvaluateResult;
    error?: string;
    enabled: boolean;
}

/**
 * Watch Panel - отслеживание выражений
 */
export class WatchPanel implements Disposable {
    private session: DebugSession | null = null;
    private expressions: Map<string, WatchExpression> = new Map();
    private disposables: Disposable[] = [];

    private onExpressionChangedEmitter = new EventEmitter<WatchExpressionChangedEvent>();

    get onExpressionChanged(): EventEmitter<WatchExpressionChangedEvent> {
        return this.onExpressionChangedEmitter;
    }

    getExpressions(): WatchExpression[] {
        return Array.from(this.expressions.values());
    }

    /**
     * Привязать к сессии
     */
    attachToSession(session: DebugSession): void {
        this.detach();
        
        this.session = session;

        this.disposables.push(
            session.onStopped.on(() => this.refresh())
        );
    }

    /**
     * Отвязать от сессии
     */
    detach(): void {
        this.session = null;
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    /**
     * Добавить выражение
     */
    addExpression(expression: string): WatchExpression {
        const id = `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const watchExpr: WatchExpression = {
            id,
            expression,
            enabled: true
        };
        
        this.expressions.set(id, watchExpr);
        this.evaluateExpression(watchExpr);
        
        return watchExpr;
    }

    /**
     * Удалить выражение
     */
    removeExpression(id: string): boolean {
        return this.expressions.delete(id);
    }

    /**
     * Обновить выражение
     */
    updateExpression(id: string, newExpression: string): void {
        const expr = this.expressions.get(id);
        if (expr) {
            expr.expression = newExpression;
            expr.result = undefined;
            expr.error = undefined;
            this.evaluateExpression(expr);
        }
    }

    /**
     * Включить/выключить выражение
     */
    toggleExpression(id: string): void {
        const expr = this.expressions.get(id);
        if (expr) {
            expr.enabled = !expr.enabled;
            if (expr.enabled) {
                this.evaluateExpression(expr);
            }
        }
    }

    /**
     * Очистить все выражения
     */
    clear(): void {
        this.expressions.clear();
    }

    /**
     * Обновить значения
     */
    async refresh(): Promise<void> {
        for (const expr of this.expressions.values()) {
            if (expr.enabled) {
                await this.evaluateExpression(expr);
            }
        }
    }

    private async evaluateExpression(expr: WatchExpression): Promise<void> {
        if (!this.session || !this.session.isStopped) {
            expr.result = undefined;
            expr.error = 'Session not stopped';
            this.onExpressionChangedEmitter.emit({
                id: expr.id,
                expression: expr.expression,
                error: expr.error
            });
            return;
        }

        try {
            const result = await this.session.evaluate(expr.expression, 'watch');
            expr.result = result;
            expr.error = undefined;
            this.onExpressionChangedEmitter.emit({
                id: expr.id,
                expression: expr.expression,
                result
            });
        } catch (error) {
            expr.result = undefined;
            expr.error = String(error);
            this.onExpressionChangedEmitter.emit({
                id: expr.id,
                expression: expr.expression,
                error: expr.error
            });
        }
    }

    dispose(): void {
        this.detach();
        this.clear();
        this.onExpressionChangedEmitter.dispose();
    }
}

// ============================================================================
// Call Stack Panel
// ============================================================================

export interface CallStackNode {
    thread: Thread;
    frames: StackFrame[];
    selectedFrameId?: number;
}

/**
 * Call Stack Panel - стек вызовов
 */
export class CallStackPanel implements Disposable {
    private session: DebugSession | null = null;
    private threads: Map<number, CallStackNode> = new Map();
    private selectedThreadId: number | null = null;

    private onSelectionChangedEmitter = new EventEmitter<CallStackSelectionEvent>();
    private disposables: Disposable[] = [];

    get onSelectionChanged(): EventEmitter<CallStackSelectionEvent> {
        return this.onSelectionChangedEmitter;
    }

    /**
     * Привязать к сессии
     */
    attachToSession(session: DebugSession): void {
        this.detach();
        
        this.session = session;

        this.disposables.push(
            session.onStopped.on(() => this.refresh()),
            session.onThread.on(() => this.refresh())
        );

        this.refresh();
    }

    /**
     * Отвязать от сессии
     */
    detach(): void {
        this.session = null;
        this.threads.clear();
        this.selectedThreadId = null;
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    /**
     * Получить все потоки
     */
    getThreads(): CallStackNode[] {
        return Array.from(this.threads.values());
    }

    /**
     * Получить выбранный поток
     */
    getSelectedThread(): CallStackNode | null {
        if (this.selectedThreadId === null) {
            return null;
        }
        return this.threads.get(this.selectedThreadId) || null;
    }

    /**
     * Выбрать поток
     */
    selectThread(threadId: number): void {
        this.selectedThreadId = threadId;
        this.session?.setActiveThread(threadId);
    }

    /**
     * Выбрать фрейм
     */
    selectFrame(threadId: number, frameId: number): void {
        const node = this.threads.get(threadId);
        if (node) {
            node.selectedFrameId = frameId;
            const frame = node.frames.find(f => f.id === frameId);
            if (frame) {
                this.onSelectionChangedEmitter.emit({
                    threadId,
                    frameId,
                    frame
                });
            }
        }
    }

    /**
     * Обновить данные
     */
    async refresh(): Promise<void> {
        if (!this.session) {
            return;
        }

        try {
            const threads = await this.session.getThreads();
            
            for (const thread of threads) {
                try {
                    const frames = await this.session.getStackTrace(thread.id);
                    const existingNode = this.threads.get(thread.id);
                    
                    this.threads.set(thread.id, {
                        thread,
                        frames,
                        selectedFrameId: existingNode?.selectedFrameId ?? (frames[0]?.id)
                    });
                } catch (error) {
                    console.error(`Failed to get stack trace for thread ${thread.id}:`, error);
                }
            }

            // Auto-select first thread if none selected
            if (this.selectedThreadId === null && threads.length > 0) {
                this.selectThread(threads[0].id);
            }
        } catch (error) {
            console.error('Failed to refresh call stack:', error);
        }
    }

    dispose(): void {
        this.detach();
        this.onSelectionChangedEmitter.dispose();
    }
}

// ============================================================================
// Breakpoints Panel
// ============================================================================

export interface BreakpointNode {
    breakpoint: Breakpoint;
    source: string;
}

/**
 * Breakpoints Panel - список точек останова
 */
export class BreakpointsPanel implements Disposable {
    private breakpoints: Map<number, BreakpointNode> = new Map();

    private onBreakpointToggledEmitter = new EventEmitter<BreakpointToggledEvent>();
    private onBreakpointRemovedEmitter = new EventEmitter<{ breakpointId: number }>();

    get onBreakpointToggled(): EventEmitter<BreakpointToggledEvent> {
        return this.onBreakpointToggledEmitter;
    }

    get onBreakpointRemoved(): EventEmitter<{ breakpointId: number }> {
        return this.onBreakpointRemovedEmitter;
    }

    /**
     * Получить все breakpoints
     */
    getBreakpoints(): BreakpointNode[] {
        return Array.from(this.breakpoints.values());
    }

    /**
     * Добавить breakpoint
     */
    addBreakpoint(breakpoint: Breakpoint): void {
        this.breakpoints.set(breakpoint.id, {
            breakpoint,
            source: breakpoint.path
        });
    }

    /**
     * Удалить breakpoint
     */
    removeBreakpoint(breakpointId: number): boolean {
        const removed = this.breakpoints.delete(breakpointId);
        if (removed) {
            this.onBreakpointRemovedEmitter.emit({ breakpointId });
        }
        return removed;
    }

    /**
     * Обновить breakpoint
     */
    updateBreakpoint(breakpoint: Breakpoint): void {
        if (this.breakpoints.has(breakpoint.id)) {
            this.breakpoints.set(breakpoint.id, {
                breakpoint,
                source: breakpoint.path
            });
        }
    }

    /**
     * Очистить все breakpoints
     */
    clear(): void {
        this.breakpoints.clear();
    }

    /**
     * Включить/выключить breakpoint
     */
    toggleBreakpoint(breakpointId: number): void {
        const node = this.breakpoints.get(breakpointId);
        if (node) {
            // Note: DAP doesn't have direct enable/disable, so we might need to
            // remove and re-add the breakpoint
            const bp = node.breakpoint;
            this.onBreakpointToggledEmitter.emit({
                path: bp.path,
                line: bp.line,
                enabled: true // Toggle logic depends on implementation
            });
        }
    }

    dispose(): void {
        this.clear();
        this.onBreakpointToggledEmitter.dispose();
        this.onBreakpointRemovedEmitter.dispose();
    }
}
