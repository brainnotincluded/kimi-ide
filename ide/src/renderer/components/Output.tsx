import React, { useState, useEffect } from 'react';
import './Output.css';

const { ipcRenderer } = window.require('electron');

interface OutputChannel {
  id: string;
  name: string;
  content: string[];
}

export const Output: React.FC = () => {
  const [channels, setChannels] = useState<OutputChannel[]>([
    { id: 'main', name: 'Main', content: [] },
    { id: 'build', name: 'Build', content: [] },
    { id: 'extension', name: 'Extension Host', content: [] },
    { id: 'git', name: 'Git', content: [] },
  ]);
  const [activeChannel, setActiveChannel] = useState('main');

  useEffect(() => {
    // Listen for output messages
    const handleOutput = (_: any, { channel, message }: { channel: string; message: string }) => {
      setChannels(prev => {
        const existing = prev.find(c => c.id === channel);
        if (existing) {
          return prev.map(c => 
            c.id === channel 
              ? { ...c, content: [...c.content.slice(-499), message] }
              : c
          );
        }
        return [...prev, { id: channel, name: channel, content: [message] }];
      });
    };

    ipcRenderer.on('output:append', handleOutput);

    return () => {
      ipcRenderer.off('output:append', handleOutput);
    };
  }, []);

  const activeContent = channels.find(c => c.id === activeChannel)?.content || [];

  const handleClear = () => {
    setChannels(prev => prev.map(c => 
      c.id === activeChannel ? { ...c, content: [] } : c
    ));
  };

  return (
    <div className="output-panel">
      <div className="output-header">
        <div className="output-tabs">
          {channels.map(channel => (
            <button
              key={channel.id}
              className={`output-tab ${activeChannel === channel.id ? 'active' : ''}`}
              onClick={() => setActiveChannel(channel.id)}
            >
              {channel.name}
            </button>
          ))}
        </div>
        <button className="clear-btn" onClick={handleClear}>
          Clear
        </button>
      </div>
      <div className="output-content">
        {activeContent.length === 0 ? (
          <div className="output-empty">
            No output for {channels.find(c => c.id === activeChannel)?.name}
          </div>
        ) : (
          activeContent.map((line, i) => (
            <div key={i} className="output-line">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
