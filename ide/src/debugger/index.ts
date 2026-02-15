/**
 * Debugger Module
 * IDE Kimi IDE - Debugger Framework
 * 
 * Экспортирует все компоненты для интеграции отладчика на основе DAP
 * 
 * @example
 * ```typescript
 * import { 
 *   DebugSession, 
 *   DebugConfigurationFactory,
 *   SourceMapper,
 *   DebugToolbar
 * } from './debugger';
 * 
 * // Создать конфигурацию
 * const config = DebugConfigurationFactory.createPython(
 *   'Python: Current File',
 *   '/path/to/file.py'
 * );
 * 
 * // Создать сессию
 * const session = new DebugSession('session-1', config);
 * await session.start();
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================

export {
    // Base DAP types
    DAPMessage,
    DAPRequest,
    DAPResponse,
    DAPEvent,
    
    // Debug configuration
    DebugConfiguration,
    DebugConfigurationType,
    DebugRequestType,
    
    // Stack trace
    StackFrame,
    Source,
    
    // Variables
    Variable,
    Scope,
    
    // Breakpoints
    Breakpoint,
    SourceBreakpoint,
    FunctionBreakpoint,
    
    // Threads
    Thread,
    
    // Events
    StoppedReason,
    StoppedEventBody,
    ExceptionDetails,
    EvaluateResult,
    
    // Capabilities
    DebugAdapterCapabilities,
    ExceptionBreakpointFilter,
    
    // Session state
    DebugSessionState,
    
    // Event system
    EventEmitter,
    EventHandler,
    Disposable
} from './types';

// ============================================================================
// Debug Adapter Client
// ============================================================================

export {
    DebugAdapterClient,
    DebugAdapterClientOptions,
    ConnectionState,
    ConnectionType,
    ConnectionStateChangedEvent,
    MessageReceivedEvent,
    EventReceivedEvent,
    InitializeRequestArguments
} from './DebugAdapterClient';

// ============================================================================
// Debug Configuration
// ============================================================================

export {
    DebugConfigurationFactory,
    ConfigurationValidator,
    ConfigurationValidationResult,
    DebugConfigurationManager
} from './DebugConfiguration';

// ============================================================================
// Debug Session
// ============================================================================

export {
    DebugSession,
    DebugSessionStateChangedEvent,
    StoppedEvent,
    ContinuedEvent,
    ThreadEvent,
    BreakpointEvent,
    OutputEvent,
    TerminatedEvent,
    ModuleEvent,
    LaunchRequestArguments,
    AttachRequestArguments
} from './DebugSession';

// ============================================================================
// Source Mapper
// ============================================================================

export {
    SourceMapper,
    SourceLocation,
    BreakpointInfo,
    CurrentLineInfo,
    LineHighlightType,
    CurrentLineChangedEvent,
    BreakpointsChangedEvent,
    SourceCache
} from './SourceMapper';

// ============================================================================
// Debug UI
// ============================================================================

export {
    // Toolbar
    DebugToolbar,
    ToolbarState,
    ToolbarActionEvent,
    
    // Variables
    VariablesPanel,
    VariableNode,
    VariableExpandedEvent,
    
    // Watch
    WatchPanel,
    WatchExpression,
    WatchExpressionChangedEvent,
    
    // Call Stack
    CallStackPanel,
    CallStackNode,
    CallStackSelectionEvent,
    
    // Breakpoints
    BreakpointsPanel,
    BreakpointNode,
    BreakpointToggledEvent
} from './DebugUI';

// ============================================================================
// IPC
// ============================================================================

export {
    DebuggerIPCChannels,
    DebuggerMainIPCHandler,
    DebuggerRendererIPC,
    StartDebugPayload,
    SetBreakpointPayload,
    EvaluatePayload,
    SetCurrentLinePayload
} from './DebuggerIPC';

// ============================================================================
// Version
// ============================================================================

export const DEBUGGER_VERSION = '1.0.0';
