import { ipcMain, BrowserWindow } from 'electron';
import * as os from 'os';
import * as fs from 'fs';

// Try to import node-pty
let pty: any;
try {
  pty = require('node-pty');
} catch {
  console.log('node-pty not available, using fallback');
}

// Detect available shell
function getShell(): { shell: string; args: string[] } {
  if (os.platform() === 'win32') {
    return { shell: 'powershell.exe', args: ['-NoLogo'] };
  }
  
  const shells = [
    { shell: '/bin/zsh', args: ['-l'] },
    { shell: '/bin/bash', args: ['-l'] },
    { shell: '/bin/sh', args: [] }
  ];
  
  for (const { shell, args } of shells) {
    if (fs.existsSync(shell)) {
      return { shell, args };
    }
  }
  
  return { shell: '/bin/sh', args: [] };
}

const { shell, args } = getShell();

interface TerminalSession {
  pty?: any;
  process?: any;
  window: BrowserWindow;
  usePty: boolean;
}

const terminals = new Map<string, TerminalSession>();

export function initTerminalManager(): void {
  ipcMain.handle('terminal:create', (event, id: string, cwd?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { success: false, error: 'No window found' };

    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '/';
      const workingDir = cwd || homeDir;
      
      const usePty = !!pty;
      
      if (usePty) {
        // Use node-pty for full PTY support
        const ptyProcess = pty.spawn(shell, args, {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: workingDir,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor'
          }
        });

        ptyProcess.onData((data: string) => {
          if (!window.isDestroyed()) {
            window.webContents.send(`terminal:data:${id}`, data);
          }
        });

        ptyProcess.onExit(() => {
          terminals.delete(id);
          if (!window.isDestroyed()) {
            window.webContents.send(`terminal:exit:${id}`);
          }
        });

        terminals.set(id, { pty: ptyProcess, window, usePty: true });

        return { success: true, usePty: true, pid: ptyProcess.pid };
      } else {
        // Fallback to child_process
        const { spawn } = require('child_process');
        const childProcess = spawn(shell, args, {
          cwd: workingDir,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            FORCE_COLOR: '1'
          },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        setTimeout(() => {
          if (!window.isDestroyed()) {
            window.webContents.send(`terminal:data:${id}`, 
              `\r\n\x1b[32m${shell}\x1b[0m on \x1b[34m${workingDir}\x1b[0m\r\n\r\n`
            );
            const prompt = `\x1b[32m${workingDir.split('/').pop() || '~'}\x1b[0m $ `;
            window.webContents.send(`terminal:data:${id}`, prompt);
          }
        }, 100);

        childProcess.stdout?.on('data', (data: Buffer) => {
          if (!window.isDestroyed()) {
            window.webContents.send(`terminal:data:${id}`, data.toString('utf-8'));
          }
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          if (!window.isDestroyed()) {
            window.webContents.send(`terminal:data:${id}`, data.toString('utf-8'));
          }
        });

        childProcess.on('exit', (code) => {
          terminals.delete(id);
          if (!window.isDestroyed()) {
            window.webContents.send(`terminal:data:${id}`, 
              `\r\n\x1b[31m[Process exited with code ${code}]\x1b[0m\r\n`
            );
            window.webContents.send(`terminal:exit:${id}`, { code });
          }
        });

        childProcess.on('error', (err: Error) => {
          terminals.delete(id);
          if (!window.isDestroyed()) {
            window.webContents.send(`terminal:data:${id}`, 
              `\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`
            );
          }
        });

        terminals.set(id, { process: childProcess, window, usePty: false });

        return { success: true, usePty: false, pid: childProcess.pid };
      }
    } catch (error) {
      console.error('Terminal creation error:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('terminal:write', (_, id: string, data: string) => {
    const terminal = terminals.get(id);
    if (!terminal) return { success: false, error: 'Terminal not found' };

    try {
      if (terminal.usePty && terminal.pty) {
        terminal.pty.write(data);
      } else if (terminal.process?.stdin) {
        terminal.process.stdin.write(data);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('terminal:resize', (_, id: string, cols: number, rows: number) => {
    const terminal = terminals.get(id);
    if (!terminal) return { success: false, error: 'Terminal not found' };

    try {
      if (terminal.usePty && terminal.pty) {
        terminal.pty.resize(cols, rows);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('terminal:kill', (_, id: string) => {
    const terminal = terminals.get(id);
    if (!terminal) return { success: false, error: 'Terminal not found' };

    try {
      if (terminal.usePty && terminal.pty) {
        terminal.pty.kill();
      } else if (terminal.process) {
        terminal.process.kill();
      }
      terminals.delete(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });
}
