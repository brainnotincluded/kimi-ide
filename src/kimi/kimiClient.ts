/**
 * Kimi High-Level Client
 * Управление сессией и интеграция с VS Code UI
 */

import * as vscode from "vscode";
import { WireClient } from "./wire";
import {
	TurnBeginPayload,
	TurnEndPayload,
	StepBeginPayload,
	StepEndPayload,
	ContentPart,
	ApprovalRequestPayload,
	ToolApprovalDetails,
	FileWriteApprovalDetails,
	CommandApprovalDetails,
	ExternalRequestDetails,
	StatusUpdatePayload,
	ToolCall,
	ToolResult,
	WireError,
} from "./wireTypes";

interface KimiClientOptions {
	cliPath: string;
	cwd?: string;
	debug?: boolean;
}

interface Turn {
	id: string;
	userInput: string;
	startTime: Date;
	endTime?: Date;
	content: ContentPart[];
	isActive: boolean;
}

interface SessionState {
	currentTurn: Turn | null;
	turns: Turn[];
	isProcessing: boolean;
}

export class KimiClient {
	private wire: WireClient;
	private context: vscode.ExtensionContext;
	private state: SessionState = {
		currentTurn: null,
		turns: [],
		isProcessing: false,
	};
	private outputChannel: vscode.OutputChannel;
	private statusBarItem: vscode.StatusBarItem;
	private readonly disposables: vscode.Disposable[] = [];

	constructor(context: vscode.ExtensionContext, options: KimiClientOptions) {
		this.context = context;
		this.outputChannel = vscode.window.createOutputChannel("Kimi");
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100
		);

		this.wire = new WireClient({
			cliPath: options.cliPath,
			cwd: options.cwd,
			debug: options.debug,
		});

		this.setupEventHandlers();
		this.setupStatusBar();
	}

	/**
	 * Запуск сессии
	 */
	async start(): Promise<void> {
		try {
			this.log("Starting Kimi session...");
			await this.wire.connect();
			this.updateStatus("connected");
			this.showInfo("Kimi session started");
		} catch (error) {
			this.updateStatus("error", String(error));
			throw error;
		}
	}

	/**
	 * Остановка сессии
	 */
	async stop(): Promise<void> {
		this.log("Stopping Kimi session...");
		await this.wire.disconnect();
		this.updateStatus("disconnected");
		this.dispose();
	}

	/**
	 * Отправка сообщения
	 */
	async sendMessage(content: string): Promise<void> {
		if (!this.wire.getStatus()) {
			throw new Error("Kimi session is not active");
		}

		if (this.state.isProcessing) {
			const action = await vscode.window.showWarningMessage(
				"Kimi is currently processing. What would you like to do?",
				"Queue",
				"Cancel Current",
				"Cancel"
			);

			if (action === "Cancel") {
				return;
			} else if (action === "Cancel Current") {
				if (this.state.currentTurn) {
					await this.wire.interruptTurn(this.state.currentTurn.id);
				}
			}
			// "Queue" continues to send the message
		}

		// Build context from current editor state
		const context = this.buildContext();

		this.log("Sending message:", content);
		await this.wire.sendMessage(content, context);
	}

	/**
	 * Прервать текущий turn
	 */
	async interrupt(): Promise<void> {
		if (this.state.currentTurn) {
			this.log("Interrupting turn:", this.state.currentTurn.id);
			await this.wire.interruptTurn(this.state.currentTurn.id);
		}
	}

	/**
	 * Проверка активности сессии
	 */
	isActive(): boolean {
		return this.wire.getStatus();
	}

	/**
	 * Получение истории turns
	 */
	getTurns(): Turn[] {
		return [...this.state.turns];
	}

	/**
	 * Получение текущего turn
	 */
	getCurrentTurn(): Turn | null {
		return this.state.currentTurn;
	}

	/**
	 * Очистка ресурсов
	 */
	dispose(): void {
		this.disposables.forEach((d) => d.dispose());
		this.statusBarItem.dispose();
		this.outputChannel.dispose();
	}

	// ============================================================================
	// Event Handlers
	// ============================================================================

	private setupEventHandlers(): void {
		this.wire.on("TurnBegin", this.handleTurnBegin.bind(this));
		this.wire.on("TurnEnd", this.handleTurnEnd.bind(this));
		this.wire.on("StepBegin", this.handleStepBegin.bind(this));
		this.wire.on("StepEnd", this.handleStepEnd.bind(this));
		this.wire.on("ContentPart", this.handleContentPart.bind(this));
		this.wire.on("ToolCall", this.handleToolCall.bind(this));
		this.wire.on("ToolResult", this.handleToolResult.bind(this));
		this.wire.on("ApprovalRequest", this.handleApprovalRequest.bind(this));
		this.wire.on("StatusUpdate", this.handleStatusUpdate.bind(this));
		this.wire.on("Error", this.handleError.bind(this));
		this.wire.on("connected", () => this.updateStatus("connected"));
		this.wire.on("disconnected", () => this.updateStatus("disconnected"));
	}

	private handleTurnBegin(payload: TurnBeginPayload): void {
		this.log("Turn began:", payload.turn_id);

		const turn: Turn = {
			id: payload.turn_id,
			userInput: payload.user_input,
			startTime: new Date(),
			content: [],
			isActive: true,
		};

		this.state.currentTurn = turn;
		this.state.isProcessing = true;
		this.state.turns.push(turn);

		this.emit("turnBegin", turn);
		this.updateStatus("processing");
	}

	private handleTurnEnd(payload: TurnEndPayload): void {
		this.log("Turn ended:", payload.turn_id, payload.finish_reason);

		if (this.state.currentTurn?.id === payload.turn_id) {
			this.state.currentTurn.isActive = false;
			this.state.currentTurn.endTime = new Date();
			this.state.isProcessing = false;
		}

		this.emit("turnEnd", {
			turnId: payload.turn_id,
			finishReason: payload.finish_reason,
			error: payload.error,
		});

		this.updateStatus("connected");
	}

	private handleStepBegin(payload: StepBeginPayload): void {
		this.log("Step began:", payload.step_id, payload.type);
		this.emit("stepBegin", payload);
	}

	private handleStepEnd(payload: StepEndPayload): void {
		this.log("Step ended:", payload.step_id, payload.status);
		this.emit("stepEnd", payload);
	}

	private handleContentPart(payload: ContentPart): void {
		if (this.state.currentTurn) {
			this.state.currentTurn.content.push(payload);
		}

		switch (payload.type) {
			case "text":
				this.emit("text", payload.text);
				break;
			case "think":
				this.emit("thinking", payload.content);
				break;
			case "tool_call":
				this.emit("toolCall", payload.tool_call);
				break;
			case "tool_result":
				this.emit("toolResult", payload);
				break;
			case "error":
				this.showError(payload.message);
				break;
		}
	}

	private handleToolCall(payload: ToolCall): void {
		this.log("Tool call:", payload.name);
		this.emit("toolCall", payload);
	}

	private handleToolResult(payload: ToolResult): void {
		this.log("Tool result:", payload.tool_call_id, payload.is_error ? "error" : "success");
		this.emit("toolResult", payload);
	}

	private async handleApprovalRequest(payload: ApprovalRequestPayload): Promise<void> {
		this.log("Approval request:", payload.request_id, payload.type);

		const approved = await this.showApprovalDialog(payload);

		await this.wire.submitApproval(
			payload.request_id,
			approved,
			approved ? undefined : "User declined",
			undefined
		);
	}

	private handleStatusUpdate(payload: StatusUpdatePayload): void {
		this.updateStatus(payload.type, payload.message);

		if (payload.progress) {
			this.emit("progress", payload.progress);
		}
	}

	private handleError(error: WireError): void {
		this.log("Error:", error.message);
		this.showError(error.message);
		this.emit("error", error as any);
	}

	// ============================================================================
	// VS Code UI Integration
	// ============================================================================

	private async showApprovalDialog(request: ApprovalRequestPayload): Promise<boolean> {
		const typeLabels: Record<string, string> = {
			tool_call: "Tool Call",
			file_write: "File Write",
			command_execute: "Command Execution",
			external_request: "External Request",
		};

		const title = `${typeLabels[request.type] || request.type}: ${request.description}`;
		const detail = this.formatApprovalDetails(request.type, request.details);

		const result = await vscode.window.showWarningMessage(
			title,
			{ modal: true, detail },
			"Approve",
			"Deny"
		);

		return result === "Approve";
	}

	private formatApprovalDetails(
		type: string,
		details: unknown
	): string {
		switch (type) {
			case "tool_call": {
				const d = details as ToolApprovalDetails;
				return `Tool: ${d.tool_name}\nArguments: ${JSON.stringify(d.arguments, null, 2)}`;
			}
			case "file_write": {
				const d = details as FileWriteApprovalDetails;
				if (d.is_delete) {
					return `Delete file: ${d.file_path}`;
				}
				const action = d.is_create ? "Create" : "Modify";
				return `${action} file: ${d.file_path}\n\nPreview:\n${d.content_preview}`;
			}
			case "command_execute": {
				const d = details as CommandApprovalDetails;
				return `Command: ${d.command}\nDirectory: ${d.cwd}`;
			}
			case "external_request": {
				const d = details as ExternalRequestDetails;
				return `${d.method} ${d.url}`;
			}
			default:
				return JSON.stringify(details, null, 2);
		}
	}

	private setupStatusBar(): void {
		this.statusBarItem.text = "$(circle-outline) Kimi";
		this.statusBarItem.tooltip = "Kimi is disconnected";
		this.statusBarItem.command = "kimi.showMenu";
		this.statusBarItem.show();
	}

	private updateStatus(
		status: "connected" | "disconnected" | "processing" | "error" | "busy" | "idle",
		message?: string
	): void {
		const icons: Record<string, string> = {
			connected: "$(check)",
			disconnected: "$(circle-outline)",
			processing: "$(sync~spin)",
			error: "$(error)",
			busy: "$(sync~spin)",
			idle: "$(check)",
		};

		const labels: Record<string, string> = {
			connected: "Connected",
			disconnected: "Disconnected",
			processing: "Processing",
			error: "Error",
			busy: "Busy",
			idle: "Ready",
		};

		this.statusBarItem.text = `${icons[status] || "$(circle-outline)"} Kimi`;
		this.statusBarItem.tooltip = message || labels[status] || status;

		if (status === "error") {
			this.statusBarItem.backgroundColor = new vscode.ThemeColor(
				"statusBarItem.errorBackground"
			);
		} else {
			this.statusBarItem.backgroundColor = undefined;
		}
	}

	private buildContext(): unknown {
		const editor = vscode.window.activeTextEditor;
		const context: {
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
		} = {};

		if (editor) {
			context.current_file = editor.document.uri.fsPath;

			const selection = editor.selection;
			if (!selection.isEmpty) {
				context.selected_text = editor.document.getText(selection);
				context.selection_range = {
					start_line: selection.start.line,
					start_column: selection.start.character,
					end_line: selection.end.line,
					end_column: selection.end.character,
				};
			}
		}

		context.open_files = vscode.workspace.textDocuments
			.filter((doc) => !doc.isUntitled)
			.map((doc) => doc.uri.fsPath);

		if (vscode.workspace.workspaceFolders?.[0]) {
			context.workspace_root = vscode.workspace.workspaceFolders[0].uri.fsPath;
		}

		return context;
	}

	private log(...args: unknown[]): void {
		const message = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
		this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
	}

	private showInfo(message: string): void {
		vscode.window.showInformationMessage(`Kimi: ${message}`);
	}

	private showError(message: string): void {
		vscode.window.showErrorMessage(`Kimi: ${message}`);
	}

	// ============================================================================
	// Event Emitter for UI Components
	// ============================================================================

	private eventEmitter = new vscode.EventEmitter<unknown>();

	onDidChange = this.eventEmitter.event;

	private emit(event: string, data?: unknown): void {
		this.eventEmitter.fire({ event, data });
	}

	/**
	 * Subscribe to events from Kimi client
	 */
	on(event: "turnBegin", listener: (turn: Turn) => void): vscode.Disposable;
	on(event: "turnEnd", listener: (result: { turnId: string; finishReason: string; error?: string }) => void): vscode.Disposable;
	on(event: "stepBegin", listener: (payload: StepBeginPayload) => void): vscode.Disposable;
	on(event: "stepEnd", listener: (payload: StepEndPayload) => void): vscode.Disposable;
	on(event: "text", listener: (text: string) => void): vscode.Disposable;
	on(event: "thinking", listener: (content: string) => void): vscode.Disposable;
	on(event: "toolCall", listener: (toolCall: ToolCall) => void): vscode.Disposable;
	on(event: "toolResult", listener: (result: ToolResult | ContentPart) => void): vscode.Disposable;
	on(event: "progress", listener: (progress: { current: number; total: number; message?: string }) => void): vscode.Disposable;
	on(event: "error", listener: (error: WireError) => void): vscode.Disposable;
	on(event: string, listener: (data: any) => void): vscode.Disposable {
		const disposable = {
			dispose: () => {
				// Event cleanup handled by main dispose()
			},
		};
		// Store listener for custom event handling
		return disposable;
	}
}
