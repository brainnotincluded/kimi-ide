import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import './Terminal.css';

const { ipcRenderer } = window.require('electron');

interface TerminalProps {
  workspace: string | null;
  terminalId?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ workspace, terminalId: propTerminalId }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [usePty, setUsePty] = useState(false);
  const terminalId = useRef(propTerminalId || `term-${Date.now()}`);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a18',
        foreground: '#d4d4d0',
        cursor: '#7c9a6d',
        selectionBackground: '#3a3a38',
        black: '#1a1a18',
        red: '#b85c57',
        green: '#7c9a6d',
        yellow: '#a89984',
        blue: '#7daea3',
        magenta: '#b48ead',
        cyan: '#7daea3',
        white: '#d4d4d0',
        brightBlack: '#6a6a62',
        brightRed: '#c97b75',
        brightGreen: '#8aaa7d',
        brightYellow: '#d5c4a1',
        brightBlue: '#8fbfba',
        brightMagenta: '#c4a0bd',
        brightCyan: '#8fbfba',
        brightWhite: '#f5f5f0'
      },
      scrollback: 10000,
      allowProposedApi: true,
      cursorStyle: 'block',
      convertEol: true
    });

    // Add addons
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    // Open terminal
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Create PTY via IPC
    const initTerminal = async () => {
      const result = await ipcRenderer.invoke('terminal:create', terminalId.current, workspace || undefined);
      
      if (result.success) {
        setIsReady(true);
        setUsePty(true);

        // Handle data from PTY
        ipcRenderer.on(`terminal:data:${terminalId.current}`, (_, data: string) => {
          term.write(data);
        });

        // Handle exit
        ipcRenderer.on(`terminal:exit:${terminalId.current}`, () => {
          term.writeln('');
          term.writeln('\x1b[31mProcess exited. Press Enter to restart.\x1b[0m');
        });

        // Send input to PTY - ALL data goes directly to shell
        term.onData((data) => {
          ipcRenderer.invoke('terminal:write', terminalId.current, data);
        });

        // Handle resize
        const handleResize = () => {
          fitAddon.fit();
          const { cols, rows } = term;
          ipcRenderer.invoke('terminal:resize', terminalId.current, cols, rows);
        };

        window.addEventListener('resize', handleResize);
        
        // Initial resize
        setTimeout(handleResize, 100);

        // Setup resize observer for container
        const resizeObserver = new ResizeObserver(() => {
          fitAddon.fit();
          const { cols, rows } = term;
          ipcRenderer.invoke('terminal:resize', terminalId.current, cols, rows);
        });
        
        if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current);
        }

        return () => {
          window.removeEventListener('resize', handleResize);
          resizeObserver.disconnect();
        };
      } else {
        setIsReady(true);
        term.writeln('');
        term.writeln(`\x1b[31mFailed to create terminal: ${result.error}\x1b[0m`);
        term.writeln('');
        term.writeln('Run: npm run rebuild');
      }
    };

    initTerminal();

    return () => {
      ipcRenderer.invoke('terminal:kill', terminalId.current);
      term.dispose();
    };
  }, [workspace]);

  const handleClear = () => {
    xtermRef.current?.clear();
  };

  return (
    <div className="terminal-instance">
      <div className="terminal-content">
        <div ref={terminalRef} className="xterm-wrapper" />
        {!isReady && (
          <div className="terminal-loading">
            <span className="loading-spinner" />
            Starting terminal...
          </div>
        )}
      </div>
    </div>
  );
};
