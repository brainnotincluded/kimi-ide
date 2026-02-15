import React, { useState, useEffect, useRef } from 'react';
import './OutputPanel.css';

const { ipcRenderer } = window.require('electron');

interface OutputMessage {
  id: number;
  channel: string;
  message: string;
  timestamp: number;
}

export const OutputPanel: React.FC = () => {
  const [messages, setMessages] = useState<OutputMessage[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [channels, setChannels] = useState<string[]>(['main', 'extension', 'git']);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);

  useEffect(() => {
    // Listen for output data
    const handleOutput = (_: any, channel: string, message: string) => {
      const newMessage: OutputMessage = {
        id: messageIdRef.current++,
        channel,
        message: message.replace(/\n$/, ''), // Remove trailing newline
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // Add channel if new
      if (!channels.includes(channel)) {
        setChannels(prev => [...prev, channel]);
      }
    };

    const handleClear = (_: any, channel: string) => {
      if (channel === 'all') {
        setMessages([]);
      } else {
        setMessages(prev => prev.filter(m => m.channel !== channel));
      }
    };

    ipcRenderer.on('output:data', handleOutput);
    ipcRenderer.on('output:clear', handleClear);

    return () => {
      ipcRenderer.off('output:data', handleOutput);
      ipcRenderer.off('output:clear', handleClear);
    };
  }, [channels]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredMessages = selectedChannel === 'all' 
    ? messages 
    : messages.filter(m => m.channel === selectedChannel);

  const handleClear = () => {
    ipcRenderer.invoke('output:clear', selectedChannel);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="output-panel">
      <div className="output-header">
        <div className="output-channels">
          <button 
            className={`channel-btn ${selectedChannel === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedChannel('all')}
          >
            All
          </button>
          {channels.map(channel => (
            <button 
              key={channel}
              className={`channel-btn ${selectedChannel === channel ? 'active' : ''}`}
              onClick={() => setSelectedChannel(channel)}
            >
              {channel}
            </button>
          ))}
        </div>
        <button className="clear-btn" onClick={handleClear}>
          Clear
        </button>
      </div>
      <div className="output-content">
        {filteredMessages.length === 0 ? (
          <div className="output-empty">
            No output
          </div>
        ) : (
          <div className="output-messages">
            {filteredMessages.map(msg => (
              <div key={msg.id} className="output-line">
                <span className="output-timestamp">{formatTime(msg.timestamp)}</span>
                {selectedChannel === 'all' && (
                  <span className="output-channel">[{msg.channel}]</span>
                )}
                <span className="output-message">{msg.message}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};
