import React from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import App from './App';

const log = (msg: string) => {
  console.log(msg);
  try {
    const fs = window.require('fs');
    fs.appendFileSync('/tmp/renderer.log', msg + '\n');
  } catch(e) {}
};

log('[Renderer] Starting...');

const container = document.getElementById('root');
log('[Renderer] Root element: ' + (container ? 'found' : 'null'));

if (!container) {
  log('[Renderer] ERROR: Root element not found!');
  throw new Error('Root element not found');
}

try {
  const root = createRoot(container);
  log('[Renderer] Root created');
  root.render(<App />);
  log('[Renderer] App rendered');
} catch (err) {
  log('[Renderer] ERROR: ' + err);
}
