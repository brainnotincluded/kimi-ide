/**
 * IDE Automation Server - WebSocket server for CLI control
 * Runs inside Electron main process
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import * as WebSocket from 'ws';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

interface AutomationServerOptions {
  port?: number;
  window: BrowserWindow;
}

export class AutomationServer {
  private wss: WebSocket.Server | null = null;
  private window: BrowserWindow;
  private port: number;
  private isRunning = false;

  constructor(options: AutomationServerOptions) {
    this.window = options.window;
    this.port = options.port || 9977;
  }

  start(): void {
    if (this.isRunning) return;

    const server = http.createServer();
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws) => {
      console.log('[Automation] CLI connected');
      
      ws.on('message', (data) => {
        this.handleMessage(ws, data.toString());
      });

      ws.on('close', () => {
        console.log('[Automation] CLI disconnected');
      });

      ws.on('error', (error) => {
        console.error('[Automation] WebSocket error:', error);
      });
    });

    server.listen(this.port, () => {
      this.isRunning = true;
      console.log(`[Automation] Server running on port ${this.port}`);
      console.log(`[Automation] Connect with: traitor connect --port ${this.port}`);
    });
  }

  stop(): void {
    this.wss?.close();
    this.isRunning = false;
  }

  private async handleMessage(ws: WebSocket, data: string): Promise<void> {
    try {
      const message = JSON.parse(data);
      const { id, method, params } = message;

      let result: any;
      
      switch (method) {
        case 'ping':
          result = { pong: true };
          break;

        case 'getVersion':
          result = '1.0.0';
          break;

        case 'screenshot':
          result = await this.captureScreenshot(params);
          break;

        case 'click':
          result = await this.click(params.x, params.y, params);
          break;

        case 'clickElement':
          result = await this.clickElement(params.selector, params);
          break;

        case 'type':
          result = await this.typeText(params.text, params);
          break;

        case 'key':
          result = await this.pressKey(params.keys);
          break;

        case 'scroll':
          result = await this.scroll(params.x, params.y, params.deltaX, params.deltaY);
          break;

        case 'scrollElement':
          result = await this.scrollElement(params.selector, params.deltaX, params.deltaY);
          break;

        case 'menu':
          result = await this.openMenu(params.path);
          break;

        case 'execute':
          result = await this.executeCommand(params.command, params.args);
          break;

        case 'getState':
          result = await this.getUIState();
          break;

        case 'find':
          result = await this.findElements(params.selector, params);
          break;

        case 'focusElement':
          result = await this.focusElement(params.selector);
          break;

        case 'focusWindow':
          result = await this.focusWindow();
          break;

        case 'openFile':
          result = await this.openFile(params.path, params.line);
          break;

        case 'runAgent':
          result = await this.runAgent(params.agentId, params.prompt);
          break;

        case 'getAgentStatus':
          result = await this.getAgentStatus(params.agentId);
          break;

        default:
          throw new Error(`Unknown method: ${method}`);
      }

      ws.send(JSON.stringify({ id, result }));
    } catch (error: any) {
      ws.send(JSON.stringify({ id: JSON.parse(data).id, error: error.message }));
    }
  }

  // =============================================================================
  // Actions
  // =============================================================================

  private async captureScreenshot(options?: { full?: boolean; element?: string }): Promise<any> {
    // Focus window first
    this.window.focus();
    
    let image: Electron.NativeImage;
    
    if (options?.element) {
      // Capture specific element
      const rect = await this.getElementRect(options.element);
      image = await this.window.webContents.capturePage(rect);
    } else {
      // Capture full window
      image = await this.window.capturePage();
    }

    return {
      data: image.toPNG().toString('base64'),
      width: image.getSize().width,
      height: image.getSize().height
    };
  }

  private async click(x: number, y: number, options?: any): Promise<void> {
    const winPosition = this.window.getPosition();
    const winContentPosition = this.window.getContentPosition();
    
    // Convert to screen coordinates
    const screenX = winPosition[0] + winContentPosition[0] + x;
    const screenY = winPosition[1] + winContentPosition[1] + y;

    // Move mouse and click via IPC to renderer
    this.window.webContents.send('automation:click', { x, y, ...options });
    
    // Also use robotjs if available for native clicks
    // For now, just notify renderer
  }

  private async clickElement(selector: string, options?: any): Promise<void> {
    this.window.webContents.send('automation:clickElement', { selector, ...options });
  }

  private async typeText(text: string, options?: any): Promise<void> {
    this.window.webContents.send('automation:type', { text, ...options });
  }

  private async pressKey(keys: string): Promise<void> {
    // Parse key combination (e.g., "cmd+s", "ctrl+shift+p")
    const parts = keys.toLowerCase().split('+');
    const key = parts.pop(); // Last part is the key
    const modifiers = parts;

    this.window.webContents.send('automation:key', { key, modifiers });
  }

  private async scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void> {
    this.window.webContents.send('automation:scroll', { x, y, deltaX, deltaY });
  }

  private async scrollElement(selector: string, deltaX: number, deltaY: number): Promise<void> {
    this.window.webContents.send('automation:scrollElement', { selector, deltaX, deltaY });
  }

  private async openMenu(menuPath: string): Promise<void> {
    const parts = menuPath.split(/[>\/]/).map(p => p.trim());
    this.window.webContents.send('automation:menu', { path: parts });
  }

  private async executeCommand(command: string, args?: any): Promise<any> {
    this.window.webContents.send('automation:execute', { command, args });
    return { executed: true };
  }

  private async getUIState(): Promise<any> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({}), 5000);
      
      this.window.webContents.once('ipc-message', (event, channel, data) => {
        if (channel === 'automation:state') {
          clearTimeout(timeout);
          resolve(data);
        }
      });
      
      this.window.webContents.send('automation:getState');
    });
  }

  private async findElements(selector: string, options?: any): Promise<any[]> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve([]), 5000);
      
      this.window.webContents.once('ipc-message', (event, channel, data) => {
        if (channel === 'automation:found') {
          clearTimeout(timeout);
          resolve(data.elements);
        }
      });
      
      this.window.webContents.send('automation:find', { selector, ...options });
    });
  }

  private async focusElement(selector: string): Promise<void> {
    this.window.webContents.send('automation:focus', { selector });
  }

  private async focusWindow(): Promise<void> {
    this.window.focus();
    this.window.show();
  }

  private async openFile(filePath: string, line?: number): Promise<void> {
    this.window.webContents.send('automation:openFile', { path: filePath, line });
  }

  private async runAgent(agentId: string, prompt: string): Promise<any> {
    this.window.webContents.send('automation:runAgent', { agentId, prompt });
    return { started: true };
  }

  private async getAgentStatus(agentId: string): Promise<any> {
    return { status: 'unknown' };
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  private async getElementRect(selector: string): Promise<Electron.Rectangle> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
      
      this.window.webContents.once('ipc-message', (event, channel, data) => {
        if (channel === 'automation:elementRect') {
          clearTimeout(timeout);
          resolve(data);
        }
      });
      
      this.window.webContents.send('automation:getElementRect', { selector });
    });
  }
}
