/**
 * Debug Adapter Protocol (DAP) Types
 * IDE Kimi IDE - Debugger Framework
 */

// ============================================================================
// DAP Base Types
// ============================================================================

export interface DAPMessage {
    seq: number;
    type: 'request' | 'response' | 'event';
}

export interface DAPRequest extends DAPMessage {
    type: 'request';
    command: string;
    arguments?: any;
}

export interface DAPResponse extends DAPMessage {
    type: 'response';
    request_seq: number;
    success: boolean;
    command: string;
    message?: string;
    body?: any;
}

export interface DAPEvent extends DAPMessage {
    type: 'event';
    event: string;
    body?: any;
}

// ============================================================================
// Debug Configuration Types
// ============================================================================

export type DebugConfigurationType = 'python' | 'node' | 'cppdbg' | 'go' | 'rust';
export type DebugRequestType = 'launch' | 'attach';

export interface DebugConfiguration {
    /** Название конфигурации */
    name: string;
    /** Тип отладчика */
    type: DebugConfigurationType;
    /** Режим запуска */
    request: DebugRequestType;
    /** Путь к программе */
    program: string;
    /** Аргументы командной строки */
    args?: string[];
    /** Переменные окружения */
    env?: Record<string, string>;
    /** Рабочая директория */
    cwd?: string;
    /** Остановка на входе */
    stopOnEntry?: boolean;
    /** Порт для attach */
    port?: number;
    /** Хост для attach */
    host?: string;
    /** Дополнительные опции */
    [key: string]: any;
}

// ============================================================================
// Stack Frame Types
// ============================================================================

export interface StackFrame {
    /** Уникальный ID фрейма */
    id: number;
    /** Название функции */
    name: string;
    /** Источник */
    source?: Source;
    /** Номер строки */
    line: number;
    /** Номер колонки */
    column: number;
    /** Индекс в стеке */
    presentationHint?: 'normal' | 'label' | 'subtle';
}

export interface Source {
    /** Имя файла */
    name?: string;
    /** Путь к файлу */
    path?: string;
    /** Source reference */
    sourceReference?: number;
    /** Является ли файл из памяти */
    origin?: string;
}

// ============================================================================
// Variable Types
// ============================================================================

export interface Variable {
    /** Имя переменной */
    name: string;
    /** Значение в строковом представлении */
    value: string;
    /** Тип переменной */
    type?: string;
    /** Дочерние переменные */
    variablesReference: number;
    /** Число дочерних переменных */
    namedVariables?: number;
    /** Число индексированных дочерних переменных */
    indexedVariables?: number;
}

export interface Scope {
    /** Имя scope */
    name: string;
    /** Reference для получения переменных */
    variablesReference: number;
    /** Число именованных переменных */
    namedVariables?: number;
    /** Число индексированных переменных */
    indexedVariables?: number;
    /** Дорогая операция получения переменных */
    expensive: boolean;
}

// ============================================================================
// Breakpoint Types
// ============================================================================

export interface Breakpoint {
    /** ID breakpoint */
    id?: number;
    /** Проверка пройдена */
    verified: boolean;
    /** Сообщение если не verified */
    message?: string;
    /** Источник */
    source?: Source;
    /** Номер строки */
    line?: number;
    /** Номер колонки */
    column?: number;
    /** Конечная строка */
    endLine?: number;
    /** Конечная колонка */
    endColumn?: number;
}

export interface SourceBreakpoint {
    /** Номер строки */
    line: number;
    /** Номер колонки */
    column?: number;
    /** Условие */
    condition?: string;
    /** Hit condition */
    hitCondition?: string;
    /** Log message */
    logMessage?: string;
}

export interface FunctionBreakpoint {
    /** Имя функции */
    name: string;
    /** Условие */
    condition?: string;
    /** Hit condition */
    hitCondition?: string;
}

// ============================================================================
// Thread Types
// ============================================================================

export interface Thread {
    /** ID потока */
    id: number;
    /** Имя потока */
    name: string;
}

// ============================================================================
// Stopped Event Types
// ============================================================================

export type StoppedReason = 'step' | 'breakpoint' | 'exception' | 'pause' | 'entry' | 'goto' | 'function breakpoint' | 'data breakpoint';

export interface StoppedEventBody {
    /** Причина остановки */
    reason: StoppedReason;
    /** Описание */
    description?: string;
    /** ID потока */
    threadId?: number;
    /** Preserve focus hint */
    preserveFocusHint?: boolean;
    /** Текст для отображения */
    text?: string;
    /** Показать все потоки */
    allThreadsStopped?: boolean;
    /** IDs связанных breakpoints */
    hitBreakpointIds?: number[];
}

// ============================================================================
// Exception Types
// ============================================================================

export interface ExceptionDetails {
    /** ID исключения */
    exceptionId?: string;
    /** Описание */
    description?: string;
    /** Подробности */
    breakMode: 'never' | 'always' | 'unhandled' | 'userUnhandled';
    /** Stack trace */
    stackTrace?: string;
    /** Cause исключения */
    innerException?: ExceptionDetails[];
}

// ============================================================================
// Evaluate Types
// ============================================================================

export interface EvaluateResult {
    /** Результат в строковом виде */
    result: string;
    /** Тип */
    type?: string;
    /** Reference для дочерних переменных */
    variablesReference: number;
    /** Число именованных переменных */
    namedVariables?: number;
    /** Число индексированных переменных */
    indexedVariables?: number;
}

// ============================================================================
// Capabilities
// ============================================================================

export interface DebugAdapterCapabilities {
    /** Поддержка conditional breakpoints */
    supportsConditionalBreakpoints?: boolean;
    /** Поддержка hit conditional breakpoints */
    supportsHitConditionalBreakpoints?: boolean;
    /** Поддержка function breakpoints */
    supportsFunctionBreakpoints?: boolean;
    /** Поддержка exception options */
    supportsExceptionOptions?: boolean;
    /** Поддержка exception filters */
    exceptionBreakpointFilters?: ExceptionBreakpointFilter[];
    /** Поддержка single step execution */
    supportsStepBack?: boolean;
    /** Поддержка setVariable */
    supportsSetVariable?: boolean;
    /** Поддержка restartFrame */
    supportsRestartFrame?: boolean;
    /** Поддержка goto */
    supportsGotoTargetsRequest?: boolean;
    /** Поддержка stepInTargets */
    supportsStepInTargetsRequest?: boolean;
    /** Поддержка completions */
    supportsCompletionsRequest?: boolean;
    /** Поддержка modules */
    supportsModulesRequest?: boolean;
    /** Поддержка restart request */
    supportsRestartRequest?: boolean;
    /** Поддержка exception info */
    supportsExceptionInfoRequest?: boolean;
    /** Поддержка data breakpoints */
    supportsDataBreakpoints?: boolean;
    /** Поддержка readMemory */
    supportsReadMemoryRequest?: boolean;
    /** Поддержка writeMemory */
    supportsWriteMemoryRequest?: boolean;
    /** Поддержка disassemble */
    supportsDisassembleRequest?: boolean;
    /** Поддержка cancel */
    supportsCancelRequest?: boolean;
    /** Поддержка clipboard context */
    supportsClipboardContext?: boolean;
    /** Поддержка lazy variables */
    supportsLazyVariables?: boolean;
}

export interface ExceptionBreakpointFilter {
    /** ID фильтра */
    filter: string;
    /** Название */
    label: string;
    /** Описание */
    description?: string;
    /** По умолчанию включён */
    default?: boolean;
    /** Условие поддерживается */
    supportsCondition?: boolean;
    /** Описание условия */
    conditionDescription?: string;
}

// ============================================================================
// Debug Session State
// ============================================================================

export enum DebugSessionState {
    Initializing = 'initializing',
    Running = 'running',
    Stopped = 'stopped',
    Stepping = 'stepping',
    Terminating = 'terminating',
    Terminated = 'terminated'
}

// ============================================================================
// Event Types
// ============================================================================

export type EventHandler<T> = (data: T) => void;

export interface Disposable {
    dispose(): void;
}

export class EventEmitter<T> {
    private handlers: EventHandler<T>[] = [];

    on(handler: EventHandler<T>): Disposable {
        this.handlers.push(handler);
        return {
            dispose: () => {
                const index = this.handlers.indexOf(handler);
                if (index !== -1) {
                    this.handlers.splice(index, 1);
                }
            }
        };
    }

    emit(data: T): void {
        this.handlers.forEach(handler => handler(data));
    }

    dispose(): void {
        this.handlers = [];
    }
}
