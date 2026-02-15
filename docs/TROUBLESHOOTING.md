# Troubleshooting Guide

Common issues and solutions for Kimi IDE.

---

## Table of Contents

- [Installation Issues](#installation-issues)
- [API Key Issues](#api-key-issues)
- [Extension Won't Activate](#extension-wont-activate)
- [Commands Not Working](#commands-not-working)
- [Performance Issues](#performance-issues)
- [Build Issues](#build-issues)
- [Development Issues](#development-issues)
- [Getting Help](#getting-help)

---

## Installation Issues

### Extension won't install from VSIX

**Problem:** Getting error when installing `.vsix` file

**Solutions:**

1. Check VS Code version (need 1.86.0+)
```bash
code --version
```

2. Verify VSIX file integrity:
```bash
unzip -t kimi-ide-x.x.x.vsix
```

3. Try installing via command line:
```bash
code --install-extension kimi-ide-x.x.x.vsix
```

4. Check VS Code logs:
- Help → Toggle Developer Tools → Console

### Dependencies installation fails

**Problem:** `npm install` fails with errors

**Solutions:**

1. Clear npm cache:
```bash
npm cache clean --force
```

2. Delete node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

3. Use specific Node version (see `.nvmrc`):
```bash
nvm use
# or
nvm install 18
```

4. Check for Python (required for native modules):
```bash
python --version  # Should be 3.x
```

---

## API Key Issues

### "API key not configured" error

**Problem:** Extension can't find your API key

**Solutions:**

1. **Configure via Command Palette:**
   - Press `Cmd+Shift+P`
   - Type "Kimi: Configure API Key"
   - Enter your key

2. **Configure via Settings:**
   - Press `Cmd+,` (or Ctrl+, on Windows/Linux)
   - Search "kimi apiKey"
   - Enter key in User settings (global)

3. **Configure via settings.json:**
```json
{
  "kimi.apiKey": "your-api-key-here"
}
```

4. **Use environment variable:**
```bash
export KIMI_API_KEY="your-key"
```

Then in settings.json:
```json
{
  "kimi.apiKey": "${env:KIMI_API_KEY}"
}
```

5. **Check settings level:**
   - User settings: Global, applies to all workspaces
   - Workspace settings: Only current project

### "Invalid API key" error

**Problem:** API key is rejected by Moonshot API

**Solutions:**

1. **Verify key at Moonshot AI Platform:**
   - Visit [platform.moonshot.cn](https://platform.moonshot.cn)
   - Check that key is active
   - Verify account has available credits

2. **Run validation command:**
   - `Cmd+Shift+P` → "Kimi: Validate API Key"

3. **Check for formatting issues:**
   - Remove extra spaces
   - Ensure no line breaks
   - Copy directly from platform

4. **Generate new key:**
   - Revoke old key
   - Create new key
   - Update in settings

### "Connection failed" error

**Problem:** Can't reach Moonshot API

**Solutions:**

1. **Check internet connection:**
```bash
ping api.moonshot.cn
```

2. **Test in browser:**
   - Open https://api.moonshot.cn in browser
   - Should return API status

3. **Check proxy settings:**
   - VS Code: `Cmd+,` → "proxy"
   - Configure HTTP_PROXY if behind corporate proxy

4. **Check firewall:**
   - Ensure api.moonshot.cn is not blocked
   - Port 443 must be open

5. **Try different network:**
   - Some networks may block the API
   - Try mobile hotspot

---

## Extension Won't Activate

### Extension shows as installed but not working

**Solutions:**

1. **Reload VS Code window:**
   - `Cmd+Shift+P` → "Developer: Reload Window"

2. **Check extension is enabled:**
   - Extensions view (`Cmd+Shift+X`)
   - Find "Kimi IDE"
   - Ensure it's enabled

3. **Check activation events:**
   - Extension activates on specific events
   - Open a TypeScript/JavaScript file
   - Or run any Kimi command

4. **Check for conflicting extensions:**
   - Disable other AI coding extensions temporarily
   - Test if Kimi IDE works

5. **View extension logs:**
   - Output panel (`Cmd+Shift+U`)
   - Select "Kimi IDE" from dropdown
   - Check for errors

### "Cannot activate extension" error

**Solutions:**

1. **Check VS Code version:**
```bash
code --version  # Need 1.86.0+
```

2. **Reinstall extension:**
```bash
# Uninstall
code --uninstall-extension kimi-ide.kimi-ide

# Reinstall
code --install-extension kimi-ide.kimi-ide
```

3. **Clear extension cache:**
```bash
rm -rf ~/.vscode/extensions/kimi-ide*
```

4. **Check extension host logs:**
   - Help → Toggle Developer Tools
   - Look for errors in Console

---

## Commands Not Working

### Cmd+K (inline edit) not working

**Common causes:**

1. **No code selected:**
   - Select some text first
   - Then press Cmd+K

2. **Keybinding conflict:**
   - Check VS Code keyboard shortcuts:
   ```
   Cmd+Shift+P → "Preferences: Open Keyboard Shortcuts"
   Search "kimi.inlineEdit"
   ```
   - Check for conflicts with other extensions

3. **Wrong file type:**
   - Ensure file is supported (TypeScript, JavaScript, etc.)
   - Check file has language mode set

4. **Extension not activated:**
   - Run any Kimi command first
   - Or open a supported file

### Commands not appearing in palette

**Solutions:**

1. **Wait for activation:**
   - Extension activates on first use
   - May take a few seconds

2. **Check context:**
   - Some commands need text selected
   - Some need specific file types

3. **Reload window:**
   - `Cmd+Shift+P` → "Developer: Reload Window"

4. **Check command IDs:**
   - All commands prefixed with `kimi.`
   - Example: `kimi.inlineEdit`

---

## Performance Issues

### VS Code slow after installing

**Solutions:**

1. **Disable LSP:**
```json
{
  "kimi.enableLSP": false
}
```

2. **Disable inline completions:**
```json
{
  "kimi.enableInlineCompletions": false
}
```

3. **Reduce context size:**
```json
{
  "kimi.context.maxTokens": 4000
}
```

4. **Check for errors:**
   - Output panel → "Kimi IDE"
   - Look for repeated errors

5. **Profile extension:**
   - Help → Toggle Developer Tools
   - Performance tab
   - Record and analyze

### Slow AI responses

**Possible causes:**

1. **Large context:**
   - Close unnecessary files
   - Select smaller code snippets
   - Use smaller model (8k instead of 128k)

2. **Network latency:**
   - Check internet connection
   - Try different network
   - Check Moonshot API status

3. **Model choice:**
   | Model | Speed | Quality |
   |-------|-------|---------|
   | 8k | Fastest | Good |
   | 32k | Medium | Better |
   | 128k | Slowest | Best |

4. **Rate limiting:**
   - Check API usage in Moonshot dashboard
   - May need to upgrade plan

### High memory usage

**Solutions:**

1. **Clear context:**
   - `Cmd+Shift+P` → "Kimi: Clear Context"

2. **Disable file watching:**
```json
{
  "kimi.discovery.enableFileWatching": false
}
```

3. **Reduce cache size:**
```json
{
  "kimi.cache.maxSize": 100
}
```

4. **Restart extension host:**
   - `Cmd+Shift+P` → "Developer: Restart Extension Host"

---

## Build Issues

### TypeScript compilation errors

**Common errors:**

1. **"Cannot find module"**
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

2. **"Type error in node_modules"**
```bash
# Solution: Update type definitions
npm update @types/node
```

3. **"Property does not exist"**
```bash
# Solution: Clean and rebuild
npm run clean
npm run compile
```

### Webpack build fails

**Solutions:**

1. **Clear webpack cache:**
```bash
rm -rf .webpack-cache
```

2. **Check for syntax errors:**
```bash
npm run lint
```

3. **Increase memory:**
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run compile
```

### VSIX packaging fails

**Solutions:**

1. **Ensure all files committed:**
```bash
git status
```

2. **Clean build first:**
```bash
npm run clean
npm run compile
npm run package
```

3. **Check vsce:**
```bash
npx vsce --version
npm install -g vsce@latest
```

---

## Development Issues

### Extension host won't start

**Solutions:**

1. **Check launch.json:**
   - Verify configuration in `.vscode/launch.json`

2. **Build first:**
```bash
npm run compile
```

3. **Check for syntax errors:**
```bash
npx tsc --noEmit
```

4. **Clear out folder:**
```bash
rm -rf out
npm run compile
```

### Breakpoints not hitting

**Solutions:**

1. **Ensure source maps:**
   - Check `tsconfig.json` has `"sourceMap": true`

2. **Rebuild:**
```bash
npm run compile
```

3. **Check launch configuration:**
```json
{
  "outFiles": ["${workspaceFolder}/out/**/*.js"]
}
```

4. **Use debugger statement:**
```typescript
debugger; // Add this line where you want to break
```

### Tests failing

**Solutions:**

1. **Run specific test:**
```bash
npm test -- --testNamePattern="should do something"
```

2. **Update snapshots:**
```bash
npm test -- --updateSnapshot
```

3. **Check for race conditions:**
   - Add `await` where needed
   - Use `async/await` consistently

4. **Clear Jest cache:**
```bash
npx jest --clearCache
```

---

## Getting Help

### Before Asking

1. **Check documentation:**
   - [README.md](../README.md)
   - [FAQ.md](./FAQ.md)
   - [API.md](./API.md)

2. **Search issues:**
   - [GitHub Issues](https://github.com/kimi-ai/kimi-ide/issues)
   - Use search with error message

3. **Enable debug mode:**
```json
{
  "kimi.debug": true
}
```

4. **Collect information:**
   - VS Code version
   - Extension version
   - Error messages
   - Steps to reproduce

### Creating an Issue

Include:

1. **Description:**
   - What happened?
   - What did you expect?

2. **Environment:**
```
VS Code: 1.x.x
Extension: 2.x.x
OS: macOS/Windows/Linux
Node: 18.x.x
```

3. **Steps to reproduce:**
```
1. Open file X
2. Select line Y
3. Press Cmd+K
4. See error
```

4. **Logs:**
   - Output panel → "Kimi IDE"
   - Developer Tools Console

5. **Screenshots:**
   - If UI-related

### Debug Mode

Enable detailed logging:

```json
{
  "kimi.debug": true,
  "kimi.logLevel": "verbose"
}
```

View logs:
1. Open Output panel (`Cmd+Shift+U`)
2. Select "Kimi IDE" from dropdown
3. Look for detailed messages

### Reset Extension

If all else fails, completely reset:

1. Uninstall extension
2. Remove settings:
```bash
# Remove from settings.json
# All kimi.* settings
```

3. Clear storage:
```bash
rm -rf ~/.vscode/extensions/kimi-ide*
```

4. Clear global state:
```bash
# On macOS
rm -rf ~/Library/Application\ Support/Code/User/globalStorage/kimi-ide*

# On Linux
rm -rf ~/.config/Code/User/globalStorage/kimi-ide*

# On Windows
rmdir /s "%APPDATA%\Code\User\globalStorage\kimi-ide*"
```

5. Reinstall extension

---

## Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Extension not working | `Cmd+Shift+P` → "Developer: Reload Window" |
| Commands not showing | Wait 5 seconds, then try again |
| Slow responses | Close unused files, select less code |
| Build errors | `rm -rf node_modules && npm install` |
| Test failures | `npx jest --clearCache && npm test` |
| API errors | Check key, check balance, try again |

---

Still having issues? [Open an issue](https://github.com/kimi-ai/kimi-ide/issues) with details!
