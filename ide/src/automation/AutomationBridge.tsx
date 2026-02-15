/**
 * Automation Bridge - Renderer-side automation handlers
 * Connects CLI commands to React UI
 */

import { useEffect, useCallback, useRef } from 'react';

interface AutomationBridgeProps {
  // References to IDE state/setters
  onOpenFile?: (path: string, line?: number) => void;
  onExecuteCommand?: (command: string, args?: any) => any;
  onGetState?: () => any;
  onMenuOpen?: (path: string[]) => void;
}

export function useAutomationBridge(props: AutomationBridgeProps) {
  const stateRef = useRef(props);
  stateRef.current = props;

  useEffect(() => {
    const { ipcRenderer } = window.require('electron');

    const handleClick = (event: any, data: any) => {
      // Dispatch click event to document
      const element = document.elementFromPoint(data.x, data.y);
      if (element) {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: data.x,
          clientY: data.y,
          button: data.button === 'right' ? 2 : 0
        });
        element.dispatchEvent(clickEvent);
      }
    };

    const handleClickElement = (event: any, data: any) => {
      const element = document.querySelector(data.selector);
      if (element) {
        (element as HTMLElement).click();
      }
    };

    const handleType = (event: any, data: any) => {
      const activeElement = document.activeElement as HTMLElement;
      if (!activeElement) return;

      if (data.clear) {
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          activeElement.value = '';
        }
      }

      // Simulate typing
      const text = data.text;
      const delay = data.delay || 0;

      if (delay > 0) {
        let i = 0;
        const typeChar = () => {
          if (i < text.length) {
            const char = text[i];
            simulateKey(activeElement, char);
            i++;
            setTimeout(typeChar, delay);
          }
        };
        typeChar();
      } else {
        // Instant typing
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          activeElement.value += text;
        } else if (activeElement.isContentEditable) {
          activeElement.textContent += text;
        }
        
        // Dispatch input event
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    const handleKey = (event: any, data: any) => {
      const { key, modifiers } = data;
      
      // Map modifier names
      const modMap: Record<string, string> = {
        'cmd': 'Meta',
        'ctrl': 'Control',
        'alt': 'Alt',
        'shift': 'Shift'
      };

      const keyEvent = new KeyboardEvent('keydown', {
        key: key.length === 1 ? key.toUpperCase() : key,
        code: `Key${key.toUpperCase()}`,
        ctrlKey: modifiers?.includes('ctrl'),
        metaKey: modifiers?.includes('cmd'),
        altKey: modifiers?.includes('alt'),
        shiftKey: modifiers?.includes('shift') || key.length === 1 && key === key.toUpperCase(),
        bubbles: true
      });

      document.dispatchEvent(keyEvent);

      // Also trigger shortcut if it's a single key
      if (!modifiers?.length) {
        const activeElement = document.activeElement;
        simulateKey(activeElement || document.body, key);
      }
    };

    const handleScroll = (event: any, data: any) => {
      const element = document.elementFromPoint(data.x, data.y);
      if (element) {
        element.scrollBy(data.deltaX, data.deltaY);
      }
    };

    const handleScrollElement = (event: any, data: any) => {
      const element = document.querySelector(data.selector);
      if (element) {
        element.scrollBy(data.deltaX, data.deltaY);
      }
    };

    const handleMenu = (event: any, data: any) => {
      stateRef.current.onMenuOpen?.(data.path);
    };

    const handleExecute = (event: any, data: any) => {
      const result = stateRef.current.onExecuteCommand?.(data.command, data.args);
      
      // Send result back
      ipcRenderer.send('automation:executeResult', {
        command: data.command,
        result
      });
    };

    const handleGetState = (event: any) => {
      const state = stateRef.current.onGetState?.() || getDefaultState();
      ipcRenderer.send('automation:state', state);
    };

    const handleFind = (event: any, data: any) => {
      let elements: any[] = [];

      if (data.byText) {
        // Find by text content
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent?.toLowerCase().includes(data.selector.toLowerCase())) {
            textNodes.push(node);
          }
        }
        elements = textNodes.map(n => elementToJson(n.parentElement!));
      } else {
        // Find by selector
        const found = document.querySelectorAll(data.selector);
        elements = Array.from(found).map(elementToJson);
      }

      ipcRenderer.send('automation:found', { elements });
    };

    const handleFocus = (event: any, data: any) => {
      const element = document.querySelector(data.selector) as HTMLElement;
      if (element) {
        element.focus();
      }
    };

    const handleOpenFile = (event: any, data: any) => {
      stateRef.current.onOpenFile?.(data.path, data.line);
    };

    const handleRunAgent = (event: any, data: any) => {
      // This would trigger the agent system
      console.log('Run agent:', data);
    };

    const handleGetElementRect = (event: any, data: any) => {
      const element = document.querySelector(data.selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        ipcRenderer.send('automation:elementRect', {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        });
      }
    };

    // Register all handlers
    const handlers: Record<string, any> = {
      'automation:click': handleClick,
      'automation:clickElement': handleClickElement,
      'automation:type': handleType,
      'automation:key': handleKey,
      'automation:scroll': handleScroll,
      'automation:scrollElement': handleScrollElement,
      'automation:menu': handleMenu,
      'automation:execute': handleExecute,
      'automation:getState': handleGetState,
      'automation:find': handleFind,
      'automation:focus': handleFocus,
      'automation:openFile': handleOpenFile,
      'automation:runAgent': handleRunAgent,
      'automation:getElementRect': handleGetElementRect
    };

    // Subscribe to all events
    Object.entries(handlers).forEach(([channel, handler]) => {
      ipcRenderer.on(channel, handler);
    });

    // Cleanup
    return () => {
      Object.entries(handlers).forEach(([channel, handler]) => {
        ipcRenderer.removeListener(channel, handler);
      });
    };
  }, []);

  // Expose automation API to window for debugging
  useEffect(() => {
    (window as any).traitor = {
      click: (x: number, y: number) => {
        const element = document.elementFromPoint(x, y);
        element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      },
      type: (text: string) => {
        const active = document.activeElement as HTMLInputElement;
        if (active) active.value = text;
      },
      key: (key: string) => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key }));
      },
      find: (selector: string) => document.querySelector(selector),
      findAll: (selector: string) => Array.from(document.querySelectorAll(selector)),
      state: () => props.onGetState?.()
    };
  }, []);
}

// =============================================================================
// Helpers
// =============================================================================

function simulateKey(element: HTMLElement, char: string) {
  // Key down
  element.dispatchEvent(new KeyboardEvent('keydown', {
    key: char,
    bubbles: true
  }));

  // Key press
  element.dispatchEvent(new KeyboardEvent('keypress', {
    key: char,
    bubbles: true
  }));

  // Input
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value += char;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Key up
  element.dispatchEvent(new KeyboardEvent('keyup', {
    key: char,
    bubbles: true
  }));
}

function elementToJson(element: Element): any {
  const rect = element.getBoundingClientRect();
  const computed = window.getComputedStyle(element);
  
  return {
    selector: getSelector(element),
    type: element.tagName.toLowerCase(),
    text: element.textContent?.trim(),
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    visible: computed.display !== 'none' && computed.visibility !== 'hidden',
    enabled: !(element as any).disabled,
    attributes: Array.from(element.attributes).reduce((acc, attr) => {
      acc[attr.name] = attr.value;
      return acc;
    }, {} as Record<string, string>)
  };
}

function getSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  if (element.className) {
    const classes = element.className.toString().split(' ').join('.');
    return `.${classes}`;
  }
  
  // Build path
  const path: string[] = [];
  let current: Element | null = element;
  
  while (current && current.tagName !== 'BODY') {
    let selector = current.tagName.toLowerCase();
    if (current.className) {
      selector += '.' + current.className.toString().split(' ').join('.');
    }
    
    const siblings = Array.from(current.parentElement?.children || []);
    const sameTag = siblings.filter(s => s.tagName === current!.tagName);
    if (sameTag.length > 1) {
      const index = sameTag.indexOf(current) + 1;
      selector += `:nth-of-type(${index})`;
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

function getDefaultState() {
  return {
    window: {
      width: window.innerWidth,
      height: window.innerHeight,
      focused: document.hasFocus()
    },
    workspace: {
      path: null,
      fileCount: 0
    },
    editor: {
      activeFile: null,
      cursor: { line: 0, column: 0 },
      selection: null
    },
    panels: {
      sidebar: { visible: true, width: 250 },
      terminal: { visible: false, height: 200 },
      problems: { visible: false }
    }
  };
}
