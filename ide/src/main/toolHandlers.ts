/**
 * Tool IPC Handlers - All 28 tool handlers for the agent system
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { promisify } from 'util';
import * as glob from 'glob';

const execAsync = promisify(cp.exec);

// Store workspace root
let workspaceRoot = process.cwd();

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
}

// ============================================================================
// File Operations
// ============================================================================

ipcMain.handle('tool:readFiles', async (_, { paths }: { paths: string[] }) => {
  try {
    const results = await Promise.all(
      paths.map(async (filePath) => {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        return {
          path: filePath,
          content,
          language: path.extname(filePath).slice(1)
        };
      })
    );
    return { files: results };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('tool:writeFile', async (_, { path: filePath, instructions, content }: { 
  path: string; 
  instructions: string; 
  content: string 
}) => {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
    
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    
    await fs.promises.writeFile(fullPath, content, 'utf-8');
    
    return {
      path: filePath,
      change: fs.existsSync(fullPath) ? 'updated' : 'created',
      content
    };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('tool:strReplace', async (_, { path: filePath, replacements }: {
  path: string;
  replacements: Array<{ old: string; new: string; allowMultiple?: boolean }>;
}) => {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
    let content = await fs.promises.readFile(fullPath, 'utf-8');
    
    for (const { old: oldStr, new: newStr, allowMultiple } of replacements) {
      if (allowMultiple) {
        content = content.split(oldStr).join(newStr);
      } else {
        content = content.replace(oldStr, newStr);
      }
    }
    
    await fs.promises.writeFile(fullPath, content, 'utf-8');
    
    return {
      path: filePath,
      changes: replacements
    };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('tool:proposeStrReplace', async (_, params) => {
  // Proposals are handled in renderer - just return the proposal
  return { proposed: params, status: 'pending' };
});

ipcMain.handle('tool:proposeWriteFile', async (_, params) => {
  return { proposed: params, status: 'pending' };
});

ipcMain.handle('tool:listDirectory', async (_, { path: dirPath }: { path: string }) => {
  try {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(workspaceRoot, dirPath);
    const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
    
    return {
      path: dirPath,
      files: entries.filter(e => e.isFile()).map(e => e.name),
      directories: entries.filter(e => e.isDirectory()).map(e => e.name)
    };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('tool:glob', async (_, { pattern, cwd }: { pattern: string; cwd?: string }) => {
  try {
    const searchDir = cwd ? path.join(workspaceRoot, cwd) : workspaceRoot;
    const files = await glob.glob(pattern, { 
      cwd: searchDir,
      absolute: false,
      nodir: true
    });
    
    // Sort by modification time
    const filesWithStats = await Promise.all(
      files.map(async (f) => {
        const fullPath = path.join(searchDir, f);
        try {
          const stat = await fs.promises.stat(fullPath);
          return { path: f, mtime: stat.mtime };
        } catch {
          return { path: f, mtime: new Date(0) };
        }
      })
    );
    
    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    return filesWithStats.map(f => cwd ? path.join(cwd, f.path) : f.path);
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('tool:readSubtree', async (_, { paths, maxTokens }: { paths?: string[]; maxTokens?: number }) => {
  try {
    // Simplified implementation - returns file tree
    const targetPaths = paths?.length 
      ? paths.map(p => path.isAbsolute(p) ? p : path.join(workspaceRoot, p))
      : [workspaceRoot];
    
    const results: any[] = [];
    
    for (const targetPath of targetPaths) {
      const stat = await fs.promises.stat(targetPath);
      
      if (stat.isDirectory()) {
        const tree = await buildFileTree(targetPath);
        results.push({ path: targetPath, type: 'directory', tree });
      } else {
        const content = await fs.promises.readFile(targetPath, 'utf-8');
        results.push({ path: targetPath, type: 'file', content });
      }
    }
    
    return results;
  } catch (error: any) {
    return { error: error.message };
  }
});

async function buildFileTree(dirPath: string, depth = 0, maxDepth = 5): Promise<any> {
  if (depth > maxDepth) return { truncated: true };
  
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const result: any[] = [];
  
  for (const entry of entries.slice(0, 100)) { // Limit to 100 entries per dir
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      result.push({
        name: entry.name,
        type: 'directory',
        children: await buildFileTree(fullPath, depth + 1, maxDepth)
      });
    } else if (entry.isFile()) {
      result.push({ name: entry.name, type: 'file' });
    }
  }
  
  return result;
}

// ============================================================================
// Code Analysis
// ============================================================================

ipcMain.handle('tool:codeSearch', async (_, { pattern, flags, cwd, maxResults = 15 }: {
  pattern: string;
  flags?: string;
  cwd?: string;
  maxResults?: number;
}) => {
  try {
    const searchDir = cwd ? path.join(workspaceRoot, cwd) : workspaceRoot;
    
    // Build ripgrep command
    let cmd = `rg --json -n`;
    if (flags) cmd += ` ${flags}`;
    cmd += ` -m ${maxResults}`;
    cmd += ` "${pattern.replace(/"/g, '\\"')}" "${searchDir}"`;
    
    const { stdout } = await execAsync(cmd);
    
    const results: any[] = [];
    for (const line of stdout.split('\n').filter(Boolean)) {
      try {
        const data = JSON.parse(line);
        if (data.type === 'match') {
          results.push({
            file: path.relative(workspaceRoot, data.data.path.text),
            line: data.data.line_number,
            content: data.data.lines.text.trim(),
            matches: data.data.submatches.map((m: any) => m.match.text)
          });
        }
      } catch {}
    }
    
    return results;
  } catch (error: any) {
    // rg exits with 1 if no matches found
    if (error.code === 1) return [];
    return { error: error.message };
  }
});

ipcMain.handle('tool:findFiles', async (_, { prompt }: { prompt: string }) => {
  try {
    // Simple heuristic-based file finding
    const keywords = prompt.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(' ')
      .filter(w => w.length > 2);
    
    const allFiles = await glob.glob('**/*', { 
      cwd: workspaceRoot,
      nodir: true,
      ignore: ['node_modules/**', '.*', 'dist/**', 'build/**']
    });
    
    const scored = allFiles.map(file => {
      const lowerFile = file.toLowerCase();
      let score = 0;
      for (const keyword of keywords) {
        if (lowerFile.includes(keyword)) score += 1;
      }
      return { file, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, 10).filter(s => s.score > 0).map(s => s.file);
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('tool:runFileChangeHooks', async (_, { files }: { files: string[] }) => {
  try {
    // Run linting/formatting if config exists
    const hasEslint = fs.existsSync(path.join(workspaceRoot, '.eslintrc*')) ||
                     fs.existsSync(path.join(workspaceRoot, 'eslint.config.*'));
    const hasPrettier = fs.existsSync(path.join(workspaceRoot, '.prettierrc*')) ||
                       fs.existsSync(path.join(workspaceRoot, 'prettier.config.*'));
    
    const results: any[] = [];
    
    if (hasEslint) {
      try {
        const { stdout } = await execAsync(
          `npx eslint --fix ${files.map(f => `"${f}"`).join(' ')}`,
          { cwd: workspaceRoot }
        );
        results.push({ tool: 'eslint', output: stdout });
      } catch (e: any) {
        results.push({ tool: 'eslint', output: e.stdout || e.message });
      }
    }
    
    if (hasPrettier) {
      try {
        const { stdout } = await execAsync(
          `npx prettier --write ${files.map(f => `"${f}"`).join(' ')}`,
          { cwd: workspaceRoot }
        );
        results.push({ tool: 'prettier', output: stdout });
      } catch (e: any) {
        results.push({ tool: 'prettier', output: e.stdout || e.message });
      }
    }
    
    return { success: true, results };
  } catch (error: any) {
    return { error: error.message };
  }
});

// ============================================================================
// Terminal
// ============================================================================

ipcMain.handle('terminal:run', async (_, { command, process_type = 'SYNC', cwd, timeout_seconds = 30 }: {
  command: string;
  process_type?: 'SYNC' | 'BACKGROUND';
  cwd?: string;
  timeout_seconds?: number;
}) => {
  const startTime = Date.now();
  const workingDir = cwd ? path.join(workspaceRoot, cwd) : workspaceRoot;
  
  try {
    if (process_type === 'BACKGROUND') {
      cp.spawn(command, [], { 
        cwd: workingDir, 
        shell: true,
        detached: true,
        stdio: 'ignore'
      }).unref();
      
      return {
        command,
        cwd: cwd || '.',
        output: 'Process started in background',
        exitCode: 0,
        duration: Date.now() - startTime
      };
    }
    
    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDir,
      timeout: timeout_seconds === -1 ? undefined : timeout_seconds * 1000
    });
    
    return {
      command,
      cwd: cwd || '.',
      output: stdout + (stderr ? `\n${stderr}` : ''),
      exitCode: 0,
      duration: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      command,
      cwd: cwd || '.',
      output: error.stdout || '' + (error.stderr || error.message),
      exitCode: error.code || 1,
      duration: Date.now() - startTime
    };
  }
});

// ============================================================================
// Web & Research (Mock implementations - would need real API keys)
// ============================================================================

ipcMain.handle('tool:webSearch', async (_, { query, depth = 'standard' }: {
  query: string;
  depth?: 'standard' | 'deep';
}) => {
  // This would integrate with Linkup API or similar
  // For now, return mock results
  return [
    {
      title: 'Search results would appear here',
      url: '#',
      snippet: 'Web search requires API integration (Linkup, Serper, etc.)'
    }
  ];
});

ipcMain.handle('tool:readDocs', async (_, { libraryTitle, topic }: {
  libraryTitle: string;
  topic: string;
}) => {
  // This would integrate with Context7 API
  return {
    content: `Documentation for ${libraryTitle} - ${topic} would appear here. Context7 API integration required.`
  };
});

// ============================================================================
// Thinking & Planning
// ============================================================================

ipcMain.handle('tool:thinkDeeply', async (_, { thought }: { thought: string }) => {
  // This is handled in the AI - just echo back
  return { thought };
});

ipcMain.handle('tool:writeTodos', async (_, { todos }: { todos: Array<{ task: string; completed: boolean }> }) => {
  // Just echo back - state is managed by AI
  return { todos };
});

// ============================================================================
// Agent Management
// ============================================================================

ipcMain.handle('tool:spawnAgents', async (_, { agents }: {
  agents: Array<{ agent_type: string; prompt?: string; params?: any }>;
}) => {
  // Return spawn info - actual spawning handled by orchestrator
  return {
    spawned: agents.map(a => ({
      id: a.agent_type,
      status: 'running',
      prompt: a.prompt
    }))
  };
});

ipcMain.handle('tool:lookupAgentInfo', async (_, { agentId }: { agentId: string }) => {
  // Would look up agent from registry
  return {
    id: agentId,
    name: agentId,
    description: 'Agent info would be retrieved from registry'
  };
});

// ============================================================================
// Output & Control
// ============================================================================

ipcMain.handle('tool:setOutput', async (_, output: any) => {
  return { output };
});

ipcMain.handle('tool:setMessages', async (_, { messages }: { messages: any[] }) => {
  return { success: true, messageCount: messages.length };
});

ipcMain.handle('tool:addMessage', async (_, { role, content }: { role: string; content: string }) => {
  return { success: true, role, content };
});

ipcMain.handle('tool:endTurn', async () => {
  return { ended: true };
});

ipcMain.handle('tool:taskCompleted', async () => {
  return { completed: true };
});

// ============================================================================
// User Interaction
// ============================================================================

ipcMain.handle('tool:askUser', async (_, { questions }: {
  questions: Array<any>;
}) => {
  // Return questions - UI would handle actual asking
  return { questions, awaitingResponse: true };
});

ipcMain.handle('tool:suggestFollowups', async (_, { followups }: {
  followups: Array<{ prompt: string; label?: string }>;
}) => {
  return { followups };
});

// ============================================================================
// Skills
// ============================================================================

ipcMain.handle('tool:skill', async (_, { name }: { name: string }) => {
  // Return skill content
  return {
    name,
    content: `Skill ${name} content would be loaded from registry`
  };
});
