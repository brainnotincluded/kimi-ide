/**
 * Kimi Wire Protocol
 * Message protocol for communication between extension and Kimi API
 */

/**
 * Wire message types
 */
export enum WireMessageType {
    CONNECT = 'CONNECT',
    DISCONNECT = 'DISCONNECT',
    CHAT = 'CHAT',
    COMPLETION = 'COMPLETION',
    RESPONSE = 'RESPONSE',
    ERROR = 'ERROR',
    PING = 'PING',
    PONG = 'PONG',
    STREAM_CHUNK = 'STREAM_CHUNK',
    STREAM_END = 'STREAM_END',
}

/**
 * Wire message interface
 */
export interface WireMessage {
    id: string;
    type: WireMessageType;
    timestamp: number;
    payload: any;
    requestId?: string;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a connect message
 */
export function createConnectMessage(payload: any): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.CONNECT,
        timestamp: Date.now(),
        payload,
    };
}

/**
 * Create a disconnect message
 */
export function createDisconnectMessage(payload: any): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.DISCONNECT,
        timestamp: Date.now(),
        payload,
    };
}

/**
 * Create a chat message
 */
export function createChatMessage(payload: any): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.CHAT,
        timestamp: Date.now(),
        payload,
    };
}

/**
 * Create a completion message
 */
export function createCompletionMessage(payload: any): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.COMPLETION,
        timestamp: Date.now(),
        payload,
    };
}

/**
 * Create a response message
 */
export function createResponseMessage(payload: any, requestId: string): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.RESPONSE,
        timestamp: Date.now(),
        payload,
        requestId,
    };
}

/**
 * Create an error message
 */
export function createErrorMessage(payload: { code: string; message: string }): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.ERROR,
        timestamp: Date.now(),
        payload,
    };
}

/**
 * Serialize a message to string
 */
export function serializeMessage(message: WireMessage): string {
    return JSON.stringify(message);
}

/**
 * Deserialize a message from string
 */
export function deserializeMessage(data: string): WireMessage {
    const parsed = JSON.parse(data);
    
    if (!validateMessage(parsed)) {
        throw new Error('Invalid message format');
    }
    
    return parsed;
}

/**
 * Validate a message structure
 */
export function validateMessage(message: any): message is WireMessage {
    if (!message || typeof message !== 'object') {
        return false;
    }
    
    // Check required fields
    if (!message.id || typeof message.id !== 'string') {
        return false;
    }
    
    if (!message.type || !Object.values(WireMessageType).includes(message.type)) {
        return false;
    }
    
    if (typeof message.timestamp !== 'number') {
        return false;
    }
    
    if (!message.payload || typeof message.payload !== 'object') {
        return false;
    }
    
    return true;
}

/**
 * Create a ping message
 */
export function createPingMessage(): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.PING,
        timestamp: Date.now(),
        payload: {},
    };
}

/**
 * Create a pong message
 */
export function createPongMessage(pingId: string): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.PONG,
        timestamp: Date.now(),
        payload: { pingId },
    };
}

/**
 * Create a stream chunk message
 */
export function createStreamChunkMessage(payload: any, requestId: string): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.STREAM_CHUNK,
        timestamp: Date.now(),
        payload,
        requestId,
    };
}

/**
 * Create a stream end message
 */
export function createStreamEndMessage(requestId: string): WireMessage {
    return {
        id: generateMessageId(),
        type: WireMessageType.STREAM_END,
        timestamp: Date.now(),
        payload: {},
        requestId,
    };
}
