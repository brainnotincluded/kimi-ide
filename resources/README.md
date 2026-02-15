# Kimi IDE Resources

This folder contains resource files used by the Kimi IDE extension.

## Folder Structure

```
resources/
├── README.md           # This file
├── welcome.md          # Welcome message shown in new chats
├── system-prompt.md    # Default system prompt for AI
└── snippets/           # Code snippets for various languages
    ├── README.md
    ├── typescript.json
    ├── python.json
    ├── javascript.json
    ├── rust.json
    ├── go.json
    └── java.json
```

## Files

### welcome.md
The welcome message displayed when users start a new chat with Kimi. Includes:
- Feature overview
- Quick start guide
- Keyboard shortcuts
- Context commands reference

### system-prompt.md
The default system prompt that guides Kimi's behavior. Defines:
- Core principles
- Response guidelines
- Code formatting rules
- VS Code integration capabilities

### snippets/
VS Code code snippets for quick Kimi commands. Type `kimi-` to see available snippets.

## Customization

Users can override these resources by placing custom versions in:
- Windows: `%APPDATA%/Kimi IDE/`
- macOS: `~/Library/Application Support/Kimi IDE/`
- Linux: `~/.config/Kimi IDE/`

## Localization

To add support for other languages:
1. Create `welcome.{locale}.md` (e.g., `welcome.ru.md`)
2. Create `system-prompt.{locale}.md`
3. The extension will use the appropriate file based on VS Code locale
