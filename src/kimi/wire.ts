/**
 * Wire Protocol Client
 * JSON-RPC поверх stdio для связи с kimi-code-cli
 */

import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";
import {
	WireMessageEnvelope,
	WireEventMap,
	WireEventType,
	TurnBeginPayload,
	TurnEndPayload,
	StepBeginPayload,
	StepEndPayload,
	ContentPart,
	ToolCall,
	ToolResult,
	ApprovalRequestPayload,
	StatusUpdatePayload,
	WireError,
} from "./wireTypes";

interface WireClientOptions {
	/** Path to kimi-cli executable */
	cliPath: string;
	/** Working directory for kimi-cli */
	cwd?: string;
	/** Environment variables */
	env?: NodeJS.ProcessEnv;
	/** Enable debug logging */
	debug?: boolean;
}

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
}

export class WireClient extends EventEmitter {
	private process: ChildProcess | null = null;
	private rl: readline.Interface | null = null;
	private requestId = 0;
	private pendingRequests = new Map<string | number, PendingRequest>();
	private isConnected = false;
	private options: WireClientOptions;
	private reconnectAttempts = 0;
	private readonly maxReconnectAttempts = 3;

	constructor(options: WireClientOptions) {
		super();
		this.options = {
			debug: false,
			...options,
		};
	}

	/**
	 * Spawn kimi-cli process и установка соединения
	 */
	async connect(): Promise<void> {
		if (this.isConnected) {
			this.log("Already connected");
			return;
		}

		try {
			this.log("Spawning kimi-cli process...");

			this.process = spawn(this.options.cliPath, ["--wire-stdio"], {
				cwd: this.options.cwd,
				env: { ...process.env, ...this.options.env },
				stdio: ["pipe", "pipe", "pipe"],
			});

			// Handle stderr for logging
			this.process.stderr?.on("data", (data: Buffer) => {
				const message = data.toString().trim();
				this.log("CLI stderr:", message);
				this.emit("stderr", message);
			});

			// Handle process exit
			this.process.on("exit", (code, signal) => {
				this.log(`Process exited with code ${code}, signal ${signal}`);
				this.handleDisconnect();
			});

			this.process.on("error", (error) => {
				this.log("Process error:", error.message);
				this.emit("error", error);
			});

			// Setup readline interface for stdout
			if (this.process.stdout) {
				this.rl = readline.createInterface({
					input: this.process.stdout,
					crlfDelay: Infinity,
				});

				this.rl.on("line", (line) => {
					this.handleMessage(line);
				});

				this.rl.on("close", () => {
					this.log("Readline interface closed");
					this.handleDisconnect();
				});
			}

			// Wait for process to be ready
			await this.waitForReady();
			this.isConnected = true;
			this.reconnectAttempts = 0;
			this.emit("connected");
			this.log("Connected to kimi-cli");
		} catch (error) {
			this.log("Failed to connect:", error);
			throw error;
		}
	}

	/**
	 * Отключение от kimi-cli
	 */
	async disconnect(): Promise<void> {
		if (!this.isConnected && !this.process) {
			return;
		}

		this.log("Disconnecting...");

		// Reject all pending requests
		for (const [id, request] of this.pendingRequests) {
			clearTimeout(request.timer);
			request.reject(new Error("Connection closed"));
		}
		this.pendingRequests.clear();

		// Close readline interface
		if (this.rl) {
			this.rl.close();
			this.rl = null;
		}

		// Kill process
		if (this.process) {
			this.process.kill("SIGTERM");
			
			// Force kill after timeout
			setTimeout(() => {
				if (this.process && !this.process.killed) {
					this.process.kill("SIGKILL");
				}
			}, 5000);

			this.process = null;
		}

		this.isConnected = false;
		this.emit("disconnected");
		this.log("Disconnected");
	}

	/**
	 * Отправка сообщения пользователя
	 */
	async sendMessage(content: string, context?: unknown): Promise<unknown> {
		this.ensureConnected();
		return this.sendRequest("sendMessage", { content, context });
	}

	/**
	 * Прервать текущий turn
	 */
	async interruptTurn(turnId: string): Promise<void> {
		this.ensureConnected();
		await this.sendRequest("interruptTurn", { turn_id: turnId });
	}

	/**
	 * Отправить ответ на approval request
	 */
	async submitApproval(
		requestId: string,
		approved: boolean,
		reason?: string,
		modifications?: Record<string, unknown>
	): Promise<void> {
		this.ensureConnected();
		await this.sendNotification("submitApproval", {
			request_id: requestId,
			approved,
			reason,
			modifications,
		});
	}

	/**
	 * Проверка соединения
	 */
	ping(): Promise<unknown> {
		this.ensureConnected();
		return this.sendRequest("ping", {});
	}

	/**
	 * Получение статуса
	 */
	getStatus(): boolean {
		return this.isConnected;
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private ensureConnected(): void {
		if (!this.isConnected) {
			throw new Error("WireClient is not connected");
		}
	}

	private async waitForReady(): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("Timeout waiting for kimi-cli to be ready"));
			}, 30000);

			const checkReady = () => {
				if (this.process?.stdin?.writable) {
					clearTimeout(timeout);
					resolve();
				} else {
					setTimeout(checkReady, 100);
				}
			};

			checkReady();
		});
	}

	private handleMessage(line: string): void {
		if (!line.trim()) {
			return;
		}

		this.log("Received:", line.substring(0, 200));

		try {
			const message: WireMessageEnvelope = JSON.parse(line);
			this.processMessage(message);
		} catch (error) {
			this.log("Failed to parse message:", line);
			this.emit("parseError", { line, error });
		}
	}

	private processMessage(message: WireMessageEnvelope): void {
		// Handle response to a request
		if (message.id !== undefined && message.id !== null && this.pendingRequests.has(message.id)) {
			const request = this.pendingRequests.get(message.id as string | number)!;
			clearTimeout(request.timer);
			this.pendingRequests.delete(message.id as string | number);

			if (message.error) {
				const error = new Error(message.error.message);
				(error as Error & { code: number }).code = message.error.code;
				request.reject(error);
			} else {
				request.resolve(message.result);
			}
			return;
		}

		// Handle notification/event
		if (message.method) {
			this.handleEvent(message.method, message.params);
		}
	}

	private handleEvent(method: string, params: unknown): void {
		this.log("Event:", method, params);

		switch (method) {
			case "TurnBegin":
				this.emit("TurnBegin", params as TurnBeginPayload);
				break;
			case "TurnEnd":
				this.emit("TurnEnd", params as TurnEndPayload);
				break;
			case "StepBegin":
				this.emit("StepBegin", params as StepBeginPayload);
				break;
			case "StepEnd":
				this.emit("StepEnd", params as StepEndPayload);
				break;
			case "ContentPart":
				this.emit("ContentPart", params as ContentPart);
				break;
			case "ToolCall":
				this.emit("ToolCall", params as ToolCall);
				break;
			case "ToolResult":
				this.emit("ToolResult", params as ToolResult);
				break;
			case "ApprovalRequest":
				this.emit("ApprovalRequest", params as ApprovalRequestPayload);
				break;
			case "StatusUpdate":
				this.emit("StatusUpdate", params as StatusUpdatePayload);
				break;
			case "Error":
				this.emit("Error", params as WireError);
				break;
			default:
				this.log("Unknown event:", method);
				this.emit("unknownEvent", { method, params });
		}
	}

	private handleDisconnect(): void {
		if (!this.isConnected) {
			return;
		}

		this.isConnected = false;
		this.emit("disconnected");

		// Attempt reconnection if not manually disconnected
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			this.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
			setTimeout(() => {
				this.connect().catch((err) => {
					this.log("Reconnection failed:", err.message);
				});
			}, 1000 * this.reconnectAttempts);
		}
	}

	private sendRequest(method: string, params: unknown): Promise<unknown> {
		const id = ++this.requestId;
		const message: WireMessageEnvelope = {
			jsonrpc: "2.0",
			id,
			method,
			params,
		};

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`Request timeout: ${method}`));
			}, 60000);

			this.pendingRequests.set(id, { resolve, reject, timer });
			this.sendMessageRaw(message);
		});
	}

	private sendNotification(method: string, params: unknown): void {
		const message: WireMessageEnvelope = {
			jsonrpc: "2.0",
			method,
			params,
		};
		this.sendMessageRaw(message);
	}

	private sendMessageRaw(message: WireMessageEnvelope): void {
		if (!this.process?.stdin?.writable) {
			throw new Error("Process stdin is not writable");
		}

		const line = JSON.stringify(message);
		this.log("Sending:", line.substring(0, 200));
		this.process.stdin.write(line + "\n");
	}

	private log(...args: unknown[]): void {
		if (this.options.debug) {
			console.log("[WireClient]", ...args);
		}
	}
}

// Type augmentation for EventEmitter
declare module "events" {
	interface EventEmitter {
		on<K extends keyof WireEventMap>(
			event: K,
			listener: (payload: WireEventMap[K]) => void
		): this;
		on(event: string | symbol, listener: (...args: unknown[]) => void): this;

		emit<K extends keyof WireEventMap>(
			event: K,
			payload: WireEventMap[K]
		): boolean;
		emit(event: string | symbol, ...args: unknown[]): boolean;

		once<K extends keyof WireEventMap>(
			event: K,
			listener: (payload: WireEventMap[K]) => void
		): this;
		once(event: string | symbol, listener: (...args: unknown[]) => void): this;

		off<K extends keyof WireEventMap>(
			event: K,
			listener: (payload: WireEventMap[K]) => void
		): this;
		off(event: string | symbol, listener: (...args: unknown[]) => void): this;
	}
}
