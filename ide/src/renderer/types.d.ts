declare global {
  interface Window {
    electron: {
      workspace: {
        openFolder: () => Promise<string | null>;
        readDirectory: (path: string) => Promise<Array<{
          name: string;
          isDirectory: boolean;
        }>>;
        readFile: (path: string) => Promise<string>;
        writeFile: (path: string, content: string) => Promise<void>;
      };
      ai: {
        chat: (messages: Array<{role: string; content: string}>) => Promise<any>;
      };
      terminal: {
        execute: (command: string) => Promise<{stdout: string; stderr: string}>;
      };
      git: {
        status: () => Promise<any>;
      };
    };
  }
}

export {};
