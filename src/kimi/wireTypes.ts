/**
 * Wire Protocol Types
 * JSON-RPC поверх stdio для связи с kimi-code-cli
 */

// ============================================================================
// Base Message Types
// ============================================================================

export interface WireMessageEnvelope<T = unknown> {
	jsonrpc: "2.0";
	id?: string | number | null;
	method?: string;
	params?: T;
	result?: T;
	error?: WireError;
}

export interface WireError {
	code: number;
	message: string;
	data?: unknown;
}

// ============================================================================
// Turn Events
// ============================================================================

export interface TurnBeginPayload {
	turn_id: string;
	user_input: string;
	context?: {
		files?: string[];
		selections?: SelectionContext[];
	};
}

export interface TurnEndPayload {
	turn_id: string;
	finish_reason: "completed" | "interrupted" | "error";
	error?: string;
}

export interface TurnInterruptedPayload {
	turn_id: string;
	reason: string;
}

export interface SelectionContext {
	file_path: string;
	start_line: number;
	start_column: number;
	end_line: number;
	end_column: number;
	content?: string;
}

// ============================================================================
// Step Events
// ============================================================================

export interface StepBeginPayload {
	step_id: string;
	turn_id: string;
	type: "thinking" | "tool_call" | "response";
}

export interface StepEndPayload {
	step_id: string;
	turn_id: string;
	status: "success" | "error" | "cancelled";
}

// ============================================================================
// Content Parts
// ============================================================================

export type ContentPart =
	| TextPart
	| ThinkPart
	| ImageURLPart
	| ImageDataPart
	| ToolCallPart
	| ToolResultPart
	| ErrorPart;

export interface TextPart {
	type: "text";
	text: string;
}

export interface ThinkPart {
	type: "think";
	content: string;
}

export interface ImageURLPart {
	type: "image_url";
	url: string;
	mime_type?: string;
}

export interface ImageDataPart {
	type: "image_data";
	data: string; // base64 encoded
	mime_type: string;
}

export interface ErrorPart {
	type: "error";
	message: string;
	code?: string;
}

// ============================================================================
// Tool Events
// ============================================================================

export interface ToolCallPart {
	type: "tool_call";
	tool_call: ToolCall;
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface ToolResultPart {
	type: "tool_result";
	tool_call_id: string;
	content: unknown;
	is_error?: boolean;
}

export interface ToolResult {
	tool_call_id: string;
	name: string;
	content: unknown;
	is_error?: boolean;
	execution_time_ms?: number;
}

// ============================================================================
// Approval System
// ============================================================================

export interface ApprovalRequestPayload {
	request_id: string;
	turn_id: string;
	type: "tool_call" | "file_write" | "command_execute" | "external_request";
	description: string;
	details: ToolApprovalDetails | FileWriteApprovalDetails | CommandApprovalDetails | ExternalRequestDetails;
	timeout_ms?: number;
}

export interface ToolApprovalDetails {
	tool_name: string;
	arguments: Record<string, unknown>;
}

export interface FileWriteApprovalDetails {
	file_path: string;
	content_preview: string;
	is_create: boolean;
	is_delete: boolean;
}

export interface CommandApprovalDetails {
	command: string;
	cwd: string;
	env?: Record<string, string>;
}

export interface ExternalRequestDetails {
	url: string;
	method: string;
	headers?: Record<string, string>;
	body_preview?: string;
}

export interface ApprovalResponsePayload {
	request_id: string;
	approved: boolean;
	reason?: string;
	modifications?: Record<string, unknown>;
}

// ============================================================================
// Status Updates
// ============================================================================

export interface StatusUpdatePayload {
	type: "connected" | "disconnected" | "busy" | "idle" | "error";
	message?: string;
	progress?: {
		current: number;
		total: number;
		message?: string;
	};
}

// ============================================================================
// Method Params
// ============================================================================

export interface SendMessageParams {
	content: string;
	context?: MessageContext;
}

export interface MessageContext {
	current_file?: string;
	selected_text?: string;
	selection_range?: {
		start_line: number;
		start_column: number;
		end_line: number;
		end_column: number;
	};
	open_files?: string[];
	workspace_root?: string;
}

export interface InterruptTurnParams {
	turn_id: string;
}

export interface SubmitApprovalParams extends ApprovalResponsePayload {}

// ============================================================================
// Event Types Map
// ============================================================================

export interface WireEventMap {
	TurnBegin: TurnBeginPayload;
	TurnEnd: TurnEndPayload;
	TurnInterrupted: TurnInterruptedPayload;
	StepBegin: StepBeginPayload;
	StepEnd: StepEndPayload;
	ContentPart: ContentPart;
	ToolCall: ToolCall;
	ToolResult: ToolResult;
	ApprovalRequest: ApprovalRequestPayload;
	StatusUpdate: StatusUpdatePayload;
	Error: WireError;
}

export type WireEventType = keyof WireEventMap;
