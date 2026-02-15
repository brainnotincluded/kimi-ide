// Chat types for Kimi IDE

export interface CodeBlock {
  language: string;
  code: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  codeBlocks?: CodeBlock[];
  isEditing?: boolean;
  editRange?: {
    startLine: number;
    endLine: number;
    filePath: string;
  };
}

export interface ContextItem {
  type: 'file' | 'folder';
  path: string;
  name: string;
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, context?: ContextItem[]) => void;
  isLoading: boolean;
  onInsertAtCursor?: (code: string) => void;
  onCreateFile?: (name: string, content: string) => void;
  onApplyEdit?: (edit: { filePath: string; search: string; replace: string }) => void;
  availableFiles?: string[];
}

export interface InlineEdit {
  filePath: string;
  search: string;
  replace: string;
  lineRange?: {
    start: number;
    end: number;
  };
}
