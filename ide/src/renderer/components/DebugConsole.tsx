import React, { useState, useEffect, useRef } from 'react';
import './DebugConsole.css';

const { ipcRenderer } = window.require('electron');

interface ConsoleMessage {
  id: number;
  type: 'log' | 'error' | 'warn' | 'info' | 'eval';
  message: string;
  timestamp: number;
}

export const DebugConsole: React.FC = () => {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Listen for debug console messages
    const handleMessage = (_: any, { message, type, timestamp }: Omit<ConsoleMessage, 'id'>) => {
      const newMessage: ConsoleMessage = {
        id: messageIdRef.current++,
        type,
        message,
        timestamp
      };
      setMessages(prev => [...prev, newMessage]);
    };

    ipcRenderer.on('debug:console:message', handleMessage);

    return () => {
      ipcRenderer.off('debug:console:message', handleMessage);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add to console as eval
    const evalMessage: ConsoleMessage = {
      id: messageIdRef.current++,
      type: 'eval',
      message: `> ${input}`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, evalMessage]);

    // Send to main process for evaluation
    ipcRenderer.invoke('debugger:evaluate', input).then((result: any) => {
      const resultMessage: ConsoleMessage = {
        id: messageIdRef.current++,
        type: 'log',
        message: typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result),
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, resultMessage]);
    }).catch((err: Error) => {
      const errorMessage: ConsoleMessage = {
        id: messageIdRef.current++,
        type: 'error',
        message: err.message,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    });

    setInput('');
  };

  const handleClear = () => {
    setMessages([]);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getMessageClass = (type: string) => {
    return `console-message ${type}`;
  };

  return (
    <div className="debug-console">
      <div className="console-header">
        <span className="console-title">Debug Console</span>
        <button className="clear-btn" onClick={handleClear}>
          Clear
        </button>
      </div>
      <div className="console-messages">
        {messages.length === 0 ? (
          <div className="console-empty">
            Debug console ready. Use the input below to evaluate expressions.
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={getMessageClass(msg.type)}>
              <span className="console-timestamp">{formatTime(msg.timestamp)}</span>
              <span className="console-type">[{msg.type}]</span>
              <span className="console-content">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="console-input-form" onSubmit={handleSubmit}>
        <span className="console-prompt">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          className="console-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Evaluate expression..."
          spellCheck={false}
        />
      </form>
    </div>
  );
};
