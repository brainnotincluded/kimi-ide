# Code Review Guidelines

This document defines the code review process, standards, and best practices for Kimi IDE. Code review is a critical part of our development workflow to ensure code quality, maintainability, and knowledge sharing.

---

## Table of Contents

- [Philosophy](#philosophy)
- [Review Process](#review-process)
- [Review Checklist](#review-checklist)
- [Review Comments](#review-comments)
- [Author Responsibilities](#author-responsibilities)
- [Reviewer Responsibilities](#reviewer-responsibilities)
- [Automated Review Tools](#automated-review-tools)
- [Best Practices](#best-practices)
- [Common Issues](#common-issues)
- [Approval Criteria](#approval-criteria)
- [Metrics](#metrics)

---

## Philosophy

### Why We Do Code Review

1. **Quality Assurance** - Catch bugs, security issues, and performance problems early
2. **Knowledge Sharing** - Spread domain knowledge across the team
3. **Consistency** - Ensure adherence to coding standards
4. **Learning** - Both author and reviewer learn from each other
5. **Collective Ownership** - Everyone is responsible for the codebase

### Principles

- **Constructive Feedback** - Focus on the code, not the person
- **Timeliness** - Reviews should be prompt (within 24-48 hours)
- **Context Over Rules** - Understand the context before suggesting changes
- **Balance** - Don't be a gatekeeper, but don't compromise quality
- **Empathy** - Remember that behind every PR is a person trying to do good work

---

## Review Process

### Flow Overview

```
┌─────────────┐
│   Create    │
│     PR      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Automated  │◄───── CI Checks, Linting, Tests
│    Checks   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Assign    │
│  Reviewers  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Review    │◄───── Discussion, Feedback
│   & Discuss │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Address   │
│  Feedback   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Approve   │
│    & Merge  │
└─────────────┘
```

### Step-by-Step Process

#### 1. Before Creating PR

Author ensures:
- [ ] Self-review completed
- [ ] All tests pass locally
- [ ] TypeScript compiles without errors
- [ ] Linting passes
- [ ] PR description is complete
- [ ] Related issues are linked

#### 2. Automated Checks

CI must pass before human review:
| Check | Tool | Purpose |
|-------|------|---------|
| TypeScript | `tsc --noEmit` | Type checking |
| Linting | ESLint | Code style |
| Formatting | Prettier | Consistent formatting |
| Unit tests | Jest | Functionality |
| Integration tests | Jest | Component integration |
| Bundle size | webpack-bundle-analyzer | Performance |

#### 3. Review Assignment

- Auto-assign based on code ownership (CODEOWNERS)
- Minimum 1 reviewer required
- Complex changes require 2+ reviewers
- Security-sensitive changes require security team review

#### 4. Review Cycle

```
Reviewer feedback ────────┐
                          ▼
                    Author addresses
                          │
                          ▼
            ┌──────────────────────────┐
            │ Changes sufficient?       │
            └──────────────────────────┘
                   │              │
              Yes /              \ No
                  ▼                ▼
            Approve           More feedback
```

---

## Review Checklist

### General

- [ ] PR description is clear and complete
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Branch is up to date with target
- [ ] No unnecessary files included
- [ ] Documentation updated if needed

### Code Quality

- [ ] Code follows style guide
- [ ] Naming is clear and consistent
- [ ] Functions are focused and small
- [ ] No code duplication (DRY principle)
- [ ] Error handling is appropriate
- [ ] No obvious bugs or edge cases

### TypeScript

- [ ] Types are explicit and strict
- [ ] No `any` types without justification
- [ ] Interfaces/types are well-defined
- [ ] Generics used appropriately
- [ ] Null/undefined handling is correct

### React

- [ ] Components follow single responsibility
- [ ] Hooks rules are followed
- [ ] Props are properly typed
- [ ] Memoization used where beneficial
- [ ] No memory leaks (cleanup in useEffect)

### VS Code Extension

- [ ] Commands follow naming convention
- [ ] Activation events are correct
- [ ] Extension API usage is valid
- [ ] No breaking changes to public API
- [ ] Error handling for VS Code API calls

### Security

- [ ] No hardcoded secrets
- [ ] Input validation on all handlers
- [ ] No prototype pollution vulnerabilities
- [ ] Dependencies are from trusted sources
- [ ] No eval() or similar dangerous functions

### Performance

- [ ] No unnecessary re-renders
- [ ] Large dependencies justified
- [ ] Bundle size impact acceptable
- [ ] No blocking operations on main thread
- [ ] Memory usage considered

### Testing

- [ ] Unit tests for new functionality
- [ ] Edge cases covered
- [ ] Error paths tested
- [ ] Test names describe behavior
- [ ] No test flakes

### Documentation

- [ ] JSDoc for public APIs
- [ ] Complex logic is commented
- [ ] README updated if needed
- [ ] CHANGELOG updated for user-facing changes

---

## Review Comments

### Comment Prefixes

Use prefixes to indicate the nature of comments:

| Prefix | Meaning | Action Required | Example |
|--------|---------|-----------------|---------|
| `blocking:` | Must be fixed | Yes | `blocking: This doesn't handle the null case` |
| `suggestion:` | Recommended change | Optional | `suggestion: Consider extracting this function` |
| `nit:` | Minor style issue | Optional | `nit: Remove trailing whitespace here` |
| `question:` | Need clarification | Discussion | `question: Why are we using a Map here?` |
| `praise:` | Positive feedback | None | `praise: Nice use of destructuring!` |
| `thought:` | Idea for future | Optional | `thought: We might want to add caching here` |
| `todo:` | Future work | Optional | `todo: Add test coverage for this edge case` |

### Examples

**Good Comments:**
```
blocking: This doesn't handle the null case. 
Please add a guard clause before accessing filePath.

suggestion: Consider extracting this into a separate 
function for better readability.

nit: Remove trailing whitespace here.

question: Why are we using a Map here instead of a plain object?

praise: Nice use of destructuring! Very clean.

thought: We might want to add caching here in the future.
```

**Bad Comments:**
```
This is wrong.

Fix this.

Why did you do it this way?

:-1:
```

### Writing Good Comments

✅ **Good Example:**
```
The current implementation doesn't handle the case where 
the file doesn't exist. Consider adding:

```typescript
if (!fs.existsSync(path)) {
  throw new FileNotFoundError(path);
}
```

Also, we should probably log this for debugging purposes.
```

### Resolving Comments

Authors should:
1. Address all `blocking:` comments
2. Consider all `suggestion:` comments
3. Respond to `question:` comments
4. Mark comments as resolved when addressed
5. Explain reasoning if not implementing a suggestion

Reviewers should:
1. Be open to discussion
2. Re-review after changes
3. Unresolve if fix is insufficient
4. Approve when satisfied

---

## Author Responsibilities

### Before Submitting

1. **Self-Review**: Read your own PR diff first
2. **Test**: Verify all tests pass
3. **Document**: Update relevant documentation
4. **Describe**: Write clear PR description
5. **Scope**: Keep PRs focused and small

### During Review

1. **Respond Promptly**: Address feedback within 24-48 hours
2. **Explain**: Clarify decisions when needed
3. **Learn**: Be open to feedback
4. **Update**: Keep PR up to date with main branch
5. **Test Again**: Re-test after significant changes

### PR Description Template

```markdown
## Summary
Brief description of what this PR does

## Changes
- List of specific changes
- Another change
- One more change

## Type
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactoring
- [ ] Documentation

## Testing
- [ ] Unit tests added/updated
- [ ] Tested manually
- [ ] E2E tests (if applicable)

## Screenshots (if UI changes)
<!-- Before/After screenshots -->

## Related Issues
Fixes #123
Relates to #456

## Checklist
- [ ] Code follows style guide
- [ ] Self-review completed
- [ ] Changes are documented
- [ ] Tests pass locally
```

---

## Reviewer Responsibilities

### Before Reviewing

1. **Understand Context**: Read PR description and related issues
2. **Check CI**: Ensure automated checks pass
3. **Time Box**: Set aside dedicated time for review

### During Review

1. **Be Thorough**: Check logic, security, performance
2. **Be Constructive**: Provide suggestions, not just problems
3. **Be Timely**: Complete review within 24-48 hours
4. **Be Clear**: Use comment prefixes, explain reasoning
5. **Be Fair**: Apply standards consistently

### Review Approach

#### First Pass: High-Level (5 minutes)

- Does the change make sense?
- Is the architecture appropriate?
- Are there obvious issues?
- Is the PR size reasonable?

#### Second Pass: Detailed (15-30 minutes)

- Line-by-line code review
- Check for edge cases
- Verify error handling
- Review test coverage

#### Third Pass: Verification (5 minutes)

- Check tests
- Verify documentation
- Review for security issues
- Check performance implications

### Approval Criteria

**Approve when:**
- All blocking issues resolved
- Code meets quality standards
- Tests are adequate
- Documentation is complete
- No security concerns

**Request changes when:**
- Blocking issues exist
- Tests are missing
- Security issues found
- Major architectural concerns

---

## Automated Review Tools

### Static Analysis

#### ESLint

```javascript
// .eslintrc.json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["error", "warn"] }],
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off"
  }
}
```

Run: `npm run lint`

#### TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Run: `npx tsc --noEmit`

#### Prettier

```javascript
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

Run: `npm run format:check`

### Security Scanning

#### npm audit

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix
```

#### Snyk

```bash
# Install Snyk
npm install -g snyk

# Test for vulnerabilities
snyk test

# Monitor project
snyk monitor
```

### Testing

#### Jest

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

Coverage thresholds in `jest.config.js`:
```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Bundle Analysis

#### webpack-bundle-analyzer

```bash
# Analyze bundle size
npm run analyze
```

Configuration in `webpack.config.js`:
```javascript
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false
    })
  ]
};
```

### GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Test
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
      
      - name: Bundle size check
        run: npm run build && npm run analyze
```

### Code Review Bots

#### Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    reviewers:
      - "team-leads"
    open-pull-requests-limit: 10
```

#### Codecov

```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 80%
        threshold: 5%
    patch:
      default:
        target: 80%
```

### Pre-commit Hooks

```javascript
// .huskyrc.json
{
  "hooks": {
    "pre-commit": "lint-staged",
    "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
  }
}

// .lintstagedrc.json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

---

## Best Practices

### For Authors

1. **Keep PRs Small**
   - Ideal: < 100 lines
   - Acceptable: 100-400 lines
   - Large: 400+ lines (requires special justification)

2. **Write Clear Descriptions**
   - What changed
   - Why it changed
   - How to test
   - Related issues

3. **Self-Review First**
   - Read your diff before submitting
   - Check for obvious issues
   - Ensure tests pass

4. **Respond to Feedback**
   - Address comments promptly
   - Ask questions if unclear
   - Explain decisions

5. **Update Regularly**
   - Rebase on main branch
   - Resolve conflicts quickly
   - Keep PR fresh

### For Reviewers

1. **Review Promptly**
   - First review: within 4 hours
   - Full review: within 24 hours
   - Re-review: within 4 hours

2. **Be Constructive**
   - Explain why, not just what
   - Suggest improvements
   - Acknowledge good work

3. **Prioritize Issues**
   - Distinguish blocking vs. optional
   - Focus on high-impact issues
   - Don't nitpick everything

4. **Test When Needed**
   - Pull branch locally for complex changes
   - Test edge cases
   - Verify UI changes visually

5. **Approve When Ready**
   - Don't hold PRs hostage
   - Trust authors to address feedback
   - Approve with minor suggestions

### Communication Guidelines

✅ **Do:**
- Ask questions to understand intent
- Suggest alternatives with reasoning
- Link to documentation or examples
- Acknowledge when you learn something new

❌ **Don't:**
- Use harsh or judgmental language
- Dismiss approaches without explanation
- Block without clear reasoning
- Make it personal

---

## Common Issues

### TypeScript Issues

```typescript
// ❌ Using 'any' without justification
function process(data: any): any { }

// ❌ Implicit returns
function getValue() {
  if (condition) return 5;
  // Missing return
}

// ❌ Non-null assertions
const name = user!.name;

// ✅ Proper typing
interface ProcessOptions {
  input: string;
  encoding: BufferEncoding;
}

function process(options: ProcessOptions): string {
  // Implementation
}
```

### React Issues

```typescript
// ❌ Missing dependency in useEffect
useEffect(() => {
  doSomething(value);
}, []); // Missing 'value'

// ❌ Inline functions in render
<button onClick={() => handleClick()}>Click</button>

// ❌ Direct state mutation
setState(prev => {
  prev.value = 5; // Mutating!
  return prev;
});

// ✅ Proper patterns
useEffect(() => {
  doSomething(value);
}, [value]);

const handleClick = useCallback(() => {
  // Handle click
}, []);

<button onClick={handleClick}>Click</button>

setState(prev => ({
  ...prev,
  value: 5
}));
```

### Security Issues

```typescript
// ❌ Path traversal vulnerability
ipcMain.handle('file:read', (_, { path }) => {
  return fs.readFileSync(path); // Dangerous!
});

// ❌ Command injection
ipcMain.handle('run', (_, { command }) => {
  exec(command); // Dangerous!
});

// ❌ Hardcoded secrets
const API_KEY = 'sk-1234567890abcdef'; // Never do this!

// ✅ Secure implementations
ipcMain.handle('file:read', (_, { path: inputPath }) => {
  const resolvedPath = path.resolve(inputPath);
  const workspaceRoot = getWorkspaceRoot();
  
  if (!resolvedPath.startsWith(workspaceRoot)) {
    throw new SecurityError('Path outside workspace');
  }
  
  return fs.readFileSync(resolvedPath);
});

// ✅ Use environment variables
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error('API_KEY not configured');
}
```

### Performance Issues

```typescript
// ❌ Expensive calculations on every render
function Component({ items }) {
  const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
  // Sorts on every render!
  
  return <List items={sorted} />;
}

// ❌ Creating objects in render
function Component() {
  const config = { timeout: 5000 }; // New object every render
  useEffect(() => {
    api.fetch(config);
  }, [config]); // Runs every render!
}

// ✅ Optimized versions
function Component({ items }) {
  const sorted = useMemo(() => 
    items.sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  
  return <List items={sorted} />;
}

function Component() {
  const config = useMemo(() => ({ timeout: 5000 }), []);
  useEffect(() => {
    api.fetch(config);
  }, [config]);
}
```

---

## Approval Criteria

### Must Have (Blocking)

- [ ] No security vulnerabilities
- [ ] No breaking bugs
- [ ] Tests pass
- [ ] TypeScript compiles
- [ ] Critical functionality works

### Should Have (Suggestions)

- [ ] Code follows style guide
- [ ] Good test coverage
- [ ] Proper error handling
- [ ] Performance acceptable
- [ ] Documentation complete

### Nice to Have (Nits)

- [ ] Extra optimizations
- [ ] Additional comments
- [ ] Alternative implementations discussed

---

## Metrics

### Review Metrics to Track

| Metric | Target | Description |
|--------|--------|-------------|
| **Time to First Review** | < 4 hours | Time from PR creation to first review |
| **Time to Approval** | < 24 hours | Time from PR creation to approval |
| **Review Rounds** | < 3 rounds | Number of review cycles |
| **PR Size** | < 400 lines | Lines changed per PR |
| **Defect Escape Rate** | < 5% | Bugs that slip through review |

### Review Health Dashboard

```
Week of 2024-01-15
─────────────────────────────────
Avg Time to Review: 6 hours ✅
Avg Time to Approve: 18 hours ✅
Avg Review Rounds: 2.1 ✅
Avg PR Size: 280 lines ✅
Comments per PR: 8.5
Approval Rate: 94%
```

---

## Quick Reference

### For Authors

```
Before PR:
  □ Self-review
  □ Tests pass
  □ Documentation updated
  □ PR description complete

During Review:
  □ Respond within 24h
  □ Address blocking comments
  □ Explain decisions
  □ Re-test after changes
```

### For Reviewers

```
Before Review:
  □ Check CI passes
  □ Read PR description
  □ Understand context

During Review:
  □ Use comment prefixes
  □ Be constructive
  □ Complete within 24h

Approval:
  □ No blocking issues
  □ Tests adequate
  □ Security checked
```

---

## Resources

- [Code Style Guide](./CODE_STYLE.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [FAQ](./docs/FAQ.md)

---

**Remember**: Code review is a conversation, not a judgment. We're all working together to build the best possible IDE.

For questions about the review process, please open a discussion.

---

## 20 Automated Code Review Tools

> Comprehensive list of tools for automating code quality, security, and review processes.

### Quick Comparison Table

| # | Tool | Category | Languages | Integration | Pricing | Best For |
|---|------|----------|-----------|-------------|---------|----------|
| 1 | **ESLint** | Style/Linting | JS, TS, JSX | CLI, IDE, CI/CD | Free/OSS | Code style & best practices |
| 2 | **Prettier** | Style/Linting | JS, TS, CSS, MD | CLI, IDE, CI/CD | Free/OSS | Code formatting |
| 3 | **TypeScript Compiler** | Static Analysis | TS | CLI, IDE, CI/CD | Free/OSS | Type checking |
| 4 | **SonarQube/Cloud** | Static Analysis | 30+ languages | GitHub, GitLab, CI/CD | Freemium | Enterprise code quality |
| 5 | **CodeQL** | Security Scanning | JS, TS, Python, etc. | GitHub Advanced Security | Paid | Semantic security analysis |
| 6 | **Snyk Code** | Security Scanning | JS, TS, Python, etc. | IDE, GitHub, GitLab, CI/CD | Freemium | Developer-first security |
| 7 | **Semgrep** | Security Scanning | 20+ languages | CLI, GitHub, CI/CD | Freemium | Custom security rules |
| 8 | **Dependabot** | Dependency Check | All npm ecosystems | GitHub native | Free | Automated dependency updates |
| 9 | **Snyk Open Source** | Dependency Check | All npm ecosystems | IDE, GitHub, CI/CD | Freemium | Vulnerability scanning |
| 10 | **Socket.dev** | Dependency Check | npm, PyPI, Go | GitHub, CLI | Freemium | Supply chain security |
| 11 | **Lighthouse CI** | Performance | Web apps | CLI, CI/CD, GitHub | Free/OSS | Web performance auditing |
| 12 | **Webpack Bundle Analyzer** | Performance | JS, TS | CLI, Webpack plugin | Free/OSS | Bundle size analysis |
| 13 | **Chrome DevTools** | Performance | Web apps | Browser built-in | Free | Runtime profiling |
| 14 | **CodeRabbit** | AI-Powered | 10+ languages | GitHub, GitLab, Azure | $12/user/mo | Comprehensive AI review |
| 15 | **Graphite Agent** | AI-Powered | JS, TS, Python, etc. | GitHub | $20-40/user/mo | High-signal GitHub-native |
| 16 | **GitHub Copilot** | AI-Powered | 10+ languages | VS Code, JetBrains, Vim | $10-19/user/mo | IDE-integrated assistance |
| 17 | **Qodo (Codium)** | AI-Powered | JS, TS, Python, etc. | IDE, CLI, CI/CD | Freemium | Test generation & review |
| 18 | **DeepSource** | AI-Powered | Python, Go, JS, TS, etc. | GitHub, GitLab, Bitbucket | Freemium | Autofix & code quality |
| 19 | **Codacy** | All-in-One | 40+ languages | GitHub, GitLab, Bitbucket | Freemium | Unified quality platform |
| 20 | **Reviewable** | Workflow | All languages | GitHub | Free (OSS) / $39/mo | PR workflow automation |

### Recommended Tools for Kimi IDE

#### Phase 1: Foundation (Immediate)
- **ESLint** + **@typescript-eslint** - Code linting with TypeScript support
- **Prettier** - Code formatting
- **TypeScript Compiler** - Strict type checking
- **Dependabot** - Automated dependency updates

#### Phase 2: Security (Week 2-4)
- **Snyk Code** - SAST for vulnerability detection
- **Socket.dev** - Supply chain security
- **npm audit** - Built-in vulnerability scanning

#### Phase 3: Performance (Month 2)
- **Lighthouse CI** - Web performance auditing for Electron renderer
- **Webpack Bundle Analyzer** - Bundle size optimization

#### Phase 4: AI Enhancement (Month 3+)
- **CodeRabbit** or **Graphite Agent** - AI-powered PR reviews
- **GitHub Copilot** - IDE code assistance

### Integration Priority

```yaml
# .github/workflows/code-review.yml
name: Code Review

on: [pull_request]

jobs:
  lint-and-format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Check formatting
        run: npx prettier --check .
      - name: Type check
        run: npx tsc --noEmit

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run npm audit
        run: npm audit --audit-level=moderate
      - name: Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for SonarQube
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### Tool-Specific Configuration

#### ESLint + Prettier
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier eslint-plugin-react eslint-plugin-react-hooks
```

#### Snyk
```bash
npm install --save-dev snyk
npx snyk auth
npx snyk test
npx snyk monitor
```

#### Lighthouse CI
```bash
npm install --save-dev @lhci/cli
npx lhci autorun
```

For detailed information about each tool, see the full research document at `docs/github-cli/code-review-tools-research.md`.

