# Kimi IDE Enhancement Plan: Beat Cursor

## Current State
- Multi-Agent System ✅
- Tree-based Discovery ✅
- Parallel Editing ✅
- Inline Completions ✅
- Chat Panel ✅

## What's Missing vs Cursor

### 1. Tab Completion (Ghost Text) - HIGH PRIORITY
Cursor shows predictive completions as you type. Kimi IDE has the provider but needs:
- Better triggering logic
- Smarter context awareness
- Faster response times

### 2. Composer UI - HIGH PRIORITY
Cursor's Composer is a dedicated multi-file editing interface. Need:
- New webview panel for multi-file edits
- File selection with @ mentions
- Streaming diff view
- Apply/reject per file

### 3. @ Symbol Context - HIGH PRIORITY
Cursor allows @file, @folder, @codebase, @web. Need:
- Mention provider in chat input
- File/folder picker integration
- Web search integration
- Symbol references

### 4. Agent Mode UI - MEDIUM PRIORITY
Cursor has a dedicated Agent tab that can:
- Run terminal commands
- Read/write multiple files
- Iterate on tasks

### 5. Image Input - MEDIUM PRIORITY
Cursor allows dragging images into chat for:
- UI generation from screenshots
- Diagram understanding
- Error screenshot analysis

## Implementation Plan

### Phase 1: Enhanced Tab Completion
1. Improve InlineCompletionProvider
2. Add better triggering (debounce, context)
3. Cache common completions
4. Add partial acceptance (word-by-word)

### Phase 2: @ Symbol System
1. Create MentionProvider
2. Add file/folder search
3. Integrate with chat input
4. Add web search capability

### Phase 3: Composer Panel
1. Create ComposerWebviewPanel
2. Multi-file diff view
3. Streaming updates
4. File tree with checkboxes

### Phase 4: Agent Mode
1. Terminal command execution
2. File operation tools
3. Iterative task loop
4. Progress tracking UI

## Files to Modify

1. `src/providers/InlineCompletionProvider.ts` - Enhance completions
2. `src/panels/ChatPanel.ts` - Add @ mentions
3. `src/panels/ComposerPanel.ts` - NEW: Multi-file editing
4. `src/providers/MentionProvider.ts` - NEW: @ symbol support
5. `src/agents/AgentModeAgent.ts` - NEW: Autonomous agent
6. `package.json` - Add new commands and configuration

## Success Criteria
- [ ] Tab completion feels as smooth as Cursor
- [ ] @ symbols work for files, folders, web
- [ ] Composer can edit 5+ files in one session
- [ ] Agent mode can run commands and iterate
