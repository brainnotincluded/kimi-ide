/**
 * Debugger IPC - IPC handlers for debugger integration
 * IDE Kimi IDE - Debugger Framework
 */

import { ipcMain, ipcRenderer, IpcMainInvokeEvent } from 'electron';
import { DebugSession } from './DebugSession';
import { DebugConfiguration } from './types';
import { DebugConfigurationManager } from './DebugConfiguration';
import { SourceMapper, SourceLocation } from './SourceMapper';
import {
    DebugToolbar,
    VariablesPanel,
    WatchPanel,
    CallStackPanel,
    BreakpointsPanel
} from './DebugUI';

// ============================================================================
// IPC Channel Names
// ============================================================================

export const DebuggerIPCChannels = {
    // Session control
    START: 'debugger:start',
    STOP: 'debugger:stop',
    PAUSE: 'debugger:pause',
    CONTINUE: 'debugger:continue',
    STEP_OVER: 'debugger:stepOver',
    STEP_INTO: 'debugger:stepInto',
    STEP_OUT: 'debugger:stepOut',
    RESTART: 'debugger:restart',

    // Configuration
    GET_CONFIGURATIONS: 'debugger:getConfigurations',
    ADD_CONFIGURATION: 'debugger:addConfiguration',
    REMOVE_CONFIGURATION: 'debugger:removeConfiguration',
    SET_ACTIVE_CONFIGURATION: 'debugger:setActiveConfiguration',

    // Breakpoints
    SET_BREAKPOINT: 'debugger:setBreakpoint',
    REMOVE_BREAKPOINT: 'debugger:removeBreakpoint',
    CLEAR_BREAKPOINTS: 'debugger:clearBreakpoints',
    GET_BREAKPOINTS: 'debugger:getBreakpoints',

    // Source
    SET_CURRENT_LINE: 'debugger:setCurrentLine',
    CLEAR_CURRENT_LINE: 'debugger:clearCurrentLine',

    // Evaluation
    EVALUATE: 'debugger:evaluate',

    // UI State
    GET_STATE: 'debugger:getState',

    // Events (main -> renderer)
    STATE_CHANGED: 'debugger:stateChanged',
    STOPPED: 'debugger:stopped',
    CONTINUED: 'debugger:continued',
    OUTPUT: 'debugger:output',
    TERMINATED: 'debugger:terminated',
    BREAKPOINT_CHANGED: 'debugger:breakpointChanged',
    CURRENT_LINE_CHANGED: 'debugger:currentLineChanged'
} as const;

// ============================================================================
// IPC Payload Types
// ============================================================================

export interface StartDebugPayload {
    configuration?: DebugConfiguration;
    configurationName?: string;
}

export interface SetBreakpointPayload {
    path: string;
    line: number;
    condition?: string;
    hitCondition?: string;
    logMessage?: string;
}

export interface EvaluatePayload {
    expression: string;
    context?: 'watch' | 'repl' | 'hover';
    frameId?: number;
}

export interface SetCurrentLinePayload {
    path: string;
    line: number;
    column?: number;
    threadId?: number;
    frameId?: number;
}

// ============================================================================
// Main Process IPC Handler
// ============================================================================

/**
 * IPC Handler for main process
 */
export class DebuggerMainIPCHandler {
    private session: DebugSession | null = null;
    private configManager: DebugConfigurationManager;
    private sourceMapper: SourceMapper;

    // UI components
    private toolbar: DebugToolbar;
    private variablesPanel: VariablesPanel;
    private watchPanel: WatchPanel;
    private callStackPanel: CallStackPanel;
    private breakpointsPanel: BreakpointsPanel;

    constructor(
        configManager: DebugConfigurationManager,
        sourceMapper: SourceMapper
    ) {
        this.configManager = configManager;
        this.sourceMapper = sourceMapper;

        // Initialize UI components
        this.toolbar = new DebugToolbar();
        this.variablesPanel = new VariablesPanel();
        this.watchPanel = new WatchPanel();
        this.callStackPanel = new CallStackPanel();
        this.breakpointsPanel = new BreakpointsPanel();

        this.registerHandlers();
    }

    private registerHandlers(): void {
        // Session control
        ipcMain.handle(DebuggerIPCChannels.START, this.handleStart.bind(this));
        ipcMain.handle(DebuggerIPCChannels.STOP, this.handleStop.bind(this));
        ipcMain.handle(DebuggerIPCChannels.PAUSE, this.handlePause.bind(this));
        ipcMain.handle(DebuggerIPCChannels.CONTINUE, this.handleContinue.bind(this));
        ipcMain.handle(DebuggerIPCChannels.STEP_OVER, this.handleStepOver.bind(this));
        ipcMain.handle(DebuggerIPCChannels.STEP_INTO, this.handleStepInto.bind(this));
        ipcMain.handle(DebuggerIPCChannels.STEP_OUT, this.handleStepOut.bind(this));
        ipcMain.handle(DebuggerIPCChannels.RESTART, this.handleRestart.bind(this));

        // Configuration
        ipcMain.handle(DebuggerIPCChannels.GET_CONFIGURATIONS, this.handleGetConfigurations.bind(this));
        ipcMain.handle(DebuggerIPCChannels.ADD_CONFIGURATION, this.handleAddConfiguration.bind(this));
        ipcMain.handle(DebuggerIPCChannels.REMOVE_CONFIGURATION, this.handleRemoveConfiguration.bind(this));
        ipcMain.handle(DebuggerIPCChannels.SET_ACTIVE_CONFIGURATION, this.handleSetActiveConfiguration.bind(this));

        // Breakpoints
        ipcMain.handle(DebuggerIPCChannels.SET_BREAKPOINT, this.handleSetBreakpoint.bind(this));
        ipcMain.handle(DebuggerIPCChannels.REMOVE_BREAKPOINT, this.handleRemoveBreakpoint.bind(this));
        ipcMain.handle(DebuggerIPCChannels.CLEAR_BREAKPOINTS, this.handleClearBreakpoints.bind(this));
        ipcMain.handle(DebuggerIPCChannels.GET_BREAKPOINTS, this.handleGetBreakpoints.bind(this));

        // Source
        ipcMain.handle(DebuggerIPCChannels.SET_CURRENT_LINE, this.handleSetCurrentLine.bind(this));
        ipcMain.handle(DebuggerIPCChannels.CLEAR_CURRENT_LINE, this.handleClearCurrentLine.bind(this));

        // Evaluation
        ipcMain.handle(DebuggerIPCChannels.EVALUATE, this.handleEvaluate.bind(this));

        // State
        ipcMain.handle(DebuggerIPCChannels.GET_STATE, this.handleGetState.bind(this));
    }

    // ============================================================================
    // Session Handlers
    // ============================================================================

    private async handleStart(_event: IpcMainInvokeEvent, payload: StartDebugPayload): Promise<{ success: boolean; error?: string }> {
        try {
            if (this.session) {
                await this.session.stop();
                this.cleanupSession();
            }

            let config: DebugConfiguration | undefined;
            
            if (payload.configuration) {
                config = payload.configuration;
            } else if (payload.configurationName) {
                config = this.configManager.getConfiguration(payload.configurationName);
            } else {
                config = this.configManager.getActiveConfiguration();
            }

            if (!config) {
                return { success: false, error: 'No debug configuration found' };
            }

            this.session = new DebugSession(`session-${Date.now()}`, config);
            this.attachSessionHandlers();
            this.attachUIToSession();

            await this.session.start();
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    private async handleStop(): Promise<{ success: boolean }> {
        if (!this.session) {
            return { success: false };
        }

        await this.session.stop();
        this.cleanupSession();
        return { success: true };
    }

    private async handlePause(): Promise<{ success: boolean }> {
        if (!this.session) {
            return { success: false };
        }

        await this.session.pause();
        return { success: true };
    }

    private async handleContinue(): Promise<{ success: boolean }> {
        if (!this.session) {
            return { success: false };
        }

        await this.session.continue();
        return { success: true };
    }

    private async handleStepOver(): Promise<{ success: boolean }> {
        if (!this.session) {
            return { success: false };
        }

        await this.session.stepOver();
        return { success: true };
    }

    private async handleStepInto(): Promise<{ success: boolean }> {
        if (!this.session) {
            return { success: false };
        }

        await this.session.stepInto();
        return { success: true };
    }

    private async handleStepOut(): Promise<{ success: boolean }> {
        if (!this.session) {
            return { success: false };
        }

        await this.session.stepOut();
        return { success: true };
    }

    private async handleRestart(): Promise<{ success: boolean }> {
        if (!this.session) {
            return { success: false };
        }

        await this.session.restart();
        return { success: true };
    }

    // ============================================================================
    // Configuration Handlers
    // ============================================================================

    private handleGetConfigurations(): DebugConfiguration[] {
        return this.configManager.getAllConfigurations();
    }

    private handleAddConfiguration(_event: IpcMainInvokeEvent, config: DebugConfiguration): { success: boolean; error?: string } {
        try {
            this.configManager.addConfiguration(config);
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    private handleRemoveConfiguration(_event: IpcMainInvokeEvent, name: string): { success: boolean } {
        const removed = this.configManager.removeConfiguration(name);
        return { success: removed };
    }

    private handleSetActiveConfiguration(_event: IpcMainInvokeEvent, name: string): { success: boolean } {
        const set = this.configManager.setActiveConfiguration(name);
        return { success: set };
    }

    // ============================================================================
    // Breakpoint Handlers
    // ============================================================================

    private async handleSetBreakpoint(_event: IpcMainInvokeEvent, payload: SetBreakpointPayload): Promise<{ success: boolean; breakpointId?: number }> {
        try {
            // Add to source mapper
            const bp = this.sourceMapper.addBreakpoint(payload.path, payload.line, {
                condition: payload.condition,
                hitCondition: payload.hitCondition,
                logMessage: payload.logMessage
            });

            // Add to breakpoints panel
            this.breakpointsPanel.addBreakpoint(bp);

            // If session is running, send to debug adapter
            if (this.session) {
                const result = await this.session.setBreakpoints(payload.path, [{
                    line: payload.line,
                    column: bp.column,
                    condition: payload.condition,
                    hitCondition: payload.hitCondition,
                    logMessage: payload.logMessage
                }]);

                // Update verified status
                if (result[0]?.verified) {
                    this.sourceMapper.setBreakpointVerified(bp.id, true);
                }
            }

            return { success: true, breakpointId: bp.id };
        } catch (error) {
            return { success: false };
        }
    }

    private handleRemoveBreakpoint(_event: IpcMainInvokeEvent, breakpointId: number): { success: boolean } {
        const bp = this.sourceMapper.getBreakpointById(breakpointId);
        if (bp) {
            this.sourceMapper.removeBreakpoint(bp.path, bp.line);
            this.breakpointsPanel.removeBreakpoint(breakpointId);
            
            // If session is running, remove from debug adapter
            if (this.session) {
                this.session.setBreakpoints(bp.path, []).catch(console.error);
            }
        }
        
        return { success: bp !== null };
    }

    private handleClearBreakpoints(): { success: boolean } {
        this.sourceMapper.clearAllBreakpoints();
        this.breakpointsPanel.clear();
        return { success: true };
    }

    private handleGetBreakpoints(): { path: string; line: number; verified: boolean }[] {
        const breakpoints = this.sourceMapper.getAllBreakpoints();
        return breakpoints.map(bp => ({
            path: bp.path,
            line: bp.line,
            verified: bp.verified
        }));
    }

    // ============================================================================
    // Source Handlers
    // ============================================================================

    private handleSetCurrentLine(_event: IpcMainInvokeEvent, payload: SetCurrentLinePayload): { success: boolean } {
        this.sourceMapper.setCurrentLine(
            { path: payload.path, line: payload.line, column: payload.column },
            payload.threadId,
            payload.frameId
        );
        return { success: true };
    }

    private handleClearCurrentLine(): { success: boolean } {
        this.sourceMapper.clearCurrentLine();
        return { success: true };
    }

    // ============================================================================
    // Evaluation Handler
    // ============================================================================

    private async handleEvaluate(_event: IpcMainInvokeEvent, payload: EvaluatePayload): Promise<{ success: boolean; result?: any; error?: string }> {
        if (!this.session) {
            return { success: false, error: 'No active debug session' };
        }

        try {
            const result = await this.session.evaluate(
                payload.expression,
                payload.context || 'repl',
                payload.frameId
            );
            return { success: true, result };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    // ============================================================================
    // State Handler
    // ============================================================================

    private handleGetState(): {
        hasSession: boolean;
        sessionState: string | null;
        configuration: DebugConfiguration | null;
    } {
        return {
            hasSession: this.session !== null,
            sessionState: this.session?.currentState ?? null,
            configuration: this.session?.configuration ?? null
        };
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private attachSessionHandlers(): void {
        if (!this.session) return;

        this.session.onStateChanged.on((event) => {
            this.sendToRenderer(DebuggerIPCChannels.STATE_CHANGED, event);
        });

        this.session.onStopped.on((event) => {
            this.sendToRenderer(DebuggerIPCChannels.STOPPED, event);
            
            // Update current line from stopped event
            if (event.body.threadId) {
                this.session?.getStackTrace(event.body.threadId).then(frames => {
                    if (frames[0]?.source?.path) {
                        this.sourceMapper.setCurrentLine({
                            path: frames[0].source.path,
                            line: frames[0].line,
                            column: frames[0].column
                        }, event.body.threadId, frames[0].id);
                    }
                }).catch(console.error);
            }
        });

        this.session.onContinued.on((event) => {
            this.sendToRenderer(DebuggerIPCChannels.CONTINUED, event);
            this.sourceMapper.clearCurrentLine();
        });

        this.session.onOutput.on((event) => {
            this.sendToRenderer(DebuggerIPCChannels.OUTPUT, event);
        });

        this.session.onTerminated.on((event) => {
            this.sendToRenderer(DebuggerIPCChannels.TERMINATED, event);
            this.cleanupSession();
        });

        this.session.onBreakpoint.on((event) => {
            this.sendToRenderer(DebuggerIPCChannels.BREAKPOINT_CHANGED, event);
        });
    }

    private attachUIToSession(): void {
        if (!this.session) return;

        this.toolbar.attachToSession(this.session);
        this.variablesPanel.attachToSession(this.session);
        this.watchPanel.attachToSession(this.session);
        this.callStackPanel.attachToSession(this.session);
    }

    private cleanupSession(): void {
        this.toolbar.detach();
        this.variablesPanel.detach();
        this.watchPanel.detach();
        this.callStackPanel.detach();

        this.session?.dispose();
        this.session = null;
    }

    private sendToRenderer(channel: string, ...args: any[]): void {
        // This would typically use a window manager to send to renderer
        // For now, we'll emit an event that can be listened to
        if (typeof process !== 'undefined' && process.send) {
            process.send({ channel, args });
        }
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.cleanupSession();
        this.toolbar.dispose();
        this.variablesPanel.dispose();
        this.watchPanel.dispose();
        this.callStackPanel.dispose();
        this.breakpointsPanel.dispose();
    }
}

// ============================================================================
// Renderer Process IPC API
// ============================================================================

/**
 * IPC API for renderer process
 */
export class DebuggerRendererIPC {
    /**
     * Start debugging
     */
    static async start(payload: StartDebugPayload): Promise<{ success: boolean; error?: string }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.START, payload);
    }

    /**
     * Stop debugging
     */
    static async stop(): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.STOP);
    }

    /**
     * Pause execution
     */
    static async pause(): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.PAUSE);
    }

    /**
     * Continue execution
     */
    static async continue(): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.CONTINUE);
    }

    /**
     * Step over
     */
    static async stepOver(): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.STEP_OVER);
    }

    /**
     * Step into
     */
    static async stepInto(): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.STEP_INTO);
    }

    /**
     * Step out
     */
    static async stepOut(): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.STEP_OUT);
    }

    /**
     * Restart
     */
    static async restart(): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.RESTART);
    }

    /**
     * Get configurations
     */
    static async getConfigurations(): Promise<DebugConfiguration[]> {
        return ipcRenderer.invoke(DebuggerIPCChannels.GET_CONFIGURATIONS);
    }

    /**
     * Add configuration
     */
    static async addConfiguration(config: DebugConfiguration): Promise<{ success: boolean; error?: string }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.ADD_CONFIGURATION, config);
    }

    /**
     * Remove configuration
     */
    static async removeConfiguration(name: string): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.REMOVE_CONFIGURATION, name);
    }

    /**
     * Set active configuration
     */
    static async setActiveConfiguration(name: string): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.SET_ACTIVE_CONFIGURATION, name);
    }

    /**
     * Set breakpoint
     */
    static async setBreakpoint(payload: SetBreakpointPayload): Promise<{ success: boolean; breakpointId?: number }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.SET_BREAKPOINT, payload);
    }

    /**
     * Remove breakpoint
     */
    static async removeBreakpoint(breakpointId: number): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.REMOVE_BREAKPOINT, breakpointId);
    }

    /**
     * Clear breakpoints
     */
    static async clearBreakpoints(): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.CLEAR_BREAKPOINTS);
    }

    /**
     * Get breakpoints
     */
    static async getBreakpoints(): Promise<{ path: string; line: number; verified: boolean }[]> {
        return ipcRenderer.invoke(DebuggerIPCChannels.GET_BREAKPOINTS);
    }

    /**
     * Set current line
     */
    static async setCurrentLine(payload: SetCurrentLinePayload): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.SET_CURRENT_LINE, payload);
    }

    /**
     * Clear current line
     */
    static async clearCurrentLine(): Promise<{ success: boolean }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.CLEAR_CURRENT_LINE);
    }

    /**
     * Evaluate expression
     */
    static async evaluate(payload: EvaluatePayload): Promise<{ success: boolean; result?: any; error?: string }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.EVALUATE, payload);
    }

    /**
     * Get state
     */
    static async getState(): Promise<{
        hasSession: boolean;
        sessionState: string | null;
        configuration: DebugConfiguration | null;
    }> {
        return ipcRenderer.invoke(DebuggerIPCChannels.GET_STATE);
    }

    // ============================================================================
    // Event Listeners
    // ============================================================================

    static onStateChanged(callback: (event: any) => void): () => void {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on(DebuggerIPCChannels.STATE_CHANGED, listener);
        return () => ipcRenderer.removeListener(DebuggerIPCChannels.STATE_CHANGED, listener);
    }

    static onStopped(callback: (event: any) => void): () => void {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on(DebuggerIPCChannels.STOPPED, listener);
        return () => ipcRenderer.removeListener(DebuggerIPCChannels.STOPPED, listener);
    }

    static onContinued(callback: (event: any) => void): () => void {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on(DebuggerIPCChannels.CONTINUED, listener);
        return () => ipcRenderer.removeListener(DebuggerIPCChannels.CONTINUED, listener);
    }

    static onOutput(callback: (event: any) => void): () => void {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on(DebuggerIPCChannels.OUTPUT, listener);
        return () => ipcRenderer.removeListener(DebuggerIPCChannels.OUTPUT, listener);
    }

    static onTerminated(callback: (event: any) => void): () => void {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on(DebuggerIPCChannels.TERMINATED, listener);
        return () => ipcRenderer.removeListener(DebuggerIPCChannels.TERMINATED, listener);
    }

    static onBreakpointChanged(callback: (event: any) => void): () => void {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on(DebuggerIPCChannels.BREAKPOINT_CHANGED, listener);
        return () => ipcRenderer.removeListener(DebuggerIPCChannels.BREAKPOINT_CHANGED, listener);
    }

    static onCurrentLineChanged(callback: (event: any) => void): () => void {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on(DebuggerIPCChannels.CURRENT_LINE_CHANGED, listener);
        return () => ipcRenderer.removeListener(DebuggerIPCChannels.CURRENT_LINE_CHANGED, listener);
    }
}
