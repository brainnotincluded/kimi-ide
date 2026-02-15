# Kimi IDE Code Snippets

This folder contains code snippets for various programming languages to quickly interact with Kimi IDE.

## Usage

Type the snippet prefix and press `Tab` to insert the Kimi command comment.

## Available Snippets

| Language | File | Snippets |
|----------|------|----------|
| TypeScript | `typescript.json` | explain, refactor, test, document, fix, optimize, review |
| Python | `python.json` | explain, refactor, test, document, fix, optimize, types, docstring |
| JavaScript | `javascript.json` | explain, refactor, test, document, fix, modernize, jsdoc |
| Rust | `rust.json` | explain, refactor, test, fix, optimize, docs, errors |
| Go | `go.json` | explain, refactor, test, fix, comments, errors, optimize |
| Java | `java.json` | explain, refactor, test, document, fix, modernize, stream |

## Common Snippets

### explain
Ask Kimi to explain the selected code or current context.

### refactor
Ask Kimi to suggest refactoring improvements.

### test
Ask Kimi to generate unit tests for the code.

### document
Ask Kimi to add documentation comments.

### fix
Ask Kimi to identify and fix issues.

### optimize
Ask Kimi to optimize for performance.

## How it works

The snippets insert special comments that Kimi IDE recognizes:
```typescript
// @kimi explain
```

When you run "Ask Kimi" command, it will detect these comments and perform the requested action.

## Adding New Snippets

To add snippets for a new language:
1. Create `{language}.json` file
2. Follow VS Code snippet format
3. Register in `package.json` contributes.snippets
