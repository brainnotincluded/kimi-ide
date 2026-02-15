# Code Review Guidelines

This document defines the code review process, standards, and best practices for Traitor IDE. Code review is a critical part of our development workflow to ensure code quality, maintainability, and knowledge sharing.

## Table of Contents

- [Philosophy](#philosophy)
- [Review Process](#review-process)
- [Review Checklist](#review-checklist)
- [Review Comments](#review-comments)
- [Author Responsibilities](#author-responsibilities)
- [Reviewer Responsibilities](#reviewer-responsibilities)
- [Common Issues](#common-issues)
- [Approval Criteria](#approval-criteria)
- [Tools & Automation](#tools--automation)

## Philosophy

### Why We Do Code Review

1. **Quality Assurance**: Catch bugs, security issues, and performance problems early
2. **Knowledge Sharing**: Spread domain knowledge across the team
3. **Consistency**: Ensure adherence to coding standards
4. **Learning**: Both author and reviewer learn from each other
5. **Collective Ownership**: Everyone is responsible for the codebase

### Principles

- **Constructive Feedback**: Focus on the code, not the person
- **Timeliness**: Reviews should be prompt (within 24-48 hours)
- **Context Over Rules**: Understand the context before suggesting changes
- **Balance**: Don't be a gatekeeper, but don't compromise quality
- **Empathy**: Remember that behind every PR is a person trying to do good work

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
│  Automated  │◄───── CI Checks, Linting
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
- TypeScript compilation (`tsc --noEmit`)
- ESLint checks
- Unit tests
- Integration tests
- Bundle size checks

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

## Review Checklist

### General

- [ ] PR description is clear and complete
- [ ] Commit messages follow conventions
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

### Electron/IPC

- [ ] IPC channels follow naming convention
- [ ] Input validation on all IPC handlers
- [ ] No security vulnerabilities (path traversal, injection)
- [ ] Event listeners properly cleaned up
- [ ] Main/renderer separation respected

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
- [ ] Architecture Decision Records (ADRs) for significant changes

## Review Comments

### Comment Prefixes

Use prefixes to indicate the nature of comments:

| Prefix | Meaning | Action Required |
|--------|---------|-----------------|
| `blocking:` | Must be fixed | Yes |
| `suggestion:` | Recommended change | Optional |
| `nit:` | Minor style issue | Optional |
| `question:` | Need clarification | Discussion |
| `praise:` | Positive feedback | None |
| `thought:` | Idea for future | Optional |

### Examples

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

### Writing Good Comments

#### ❌ Bad Comments

```
This is wrong.

Fix this.

Why did you do it this way?

:-1:
```

#### ✅ Good Comments

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

#### First Pass: High-Level

- Does the change make sense?
- Is the architecture appropriate?
- Are there obvious issues?

#### Second Pass: Detailed

- Line-by-line code review
- Check for edge cases
- Verify error handling

#### Third Pass: Verification

- Check tests
- Verify documentation
- Review for security issues

### Approval Criteria

Approve when:
- All blocking issues resolved
- Code meets quality standards
- Tests are adequate
- Documentation is complete
- No security concerns

Request changes when:
- Blocking issues exist
- Tests are missing
- Security issues found
- Major architectural concerns

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

// ✅ Secure implementations
ipcMain.handle('file:read', (_, { path: inputPath }) => {
  const resolvedPath = path.resolve(inputPath);
  const workspaceRoot = getWorkspaceRoot();
  
  if (!resolvedPath.startsWith(workspaceRoot)) {
    throw new SecurityError('Path outside workspace');
  }
  
  return fs.readFileSync(resolvedPath);
});
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

## Tools & Automation

### Automated Checks

#### ESLint

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    'no-console': ['warn', { allow: ['error', 'warn'] }]
  }
};
```

#### TypeScript

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### Prettier

```javascript
// .prettierrc
module.exports = {
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  printWidth: 100
};
```

### GitHub Actions

```yaml
# .github/workflows/review.yml
name: Code Review Checks

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Test
        run: npm test
      
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
```

### GitHub Settings

#### Branch Protection

```
Settings > Branches > main:
- Require pull request reviews: 1
- Dismiss stale PR approvals: true
- Require status checks: true
  - CI checks must pass
- Include administrators: true
```

## Metrics

### Review Metrics to Track

1. **Time to First Review**: Target < 4 hours
2. **Time to Approval**: Target < 24 hours
3. **Review Rounds**: Target < 3 rounds
4. **PR Size**: Target < 400 lines
5. **Defect Escape Rate**: Track bugs that slip through

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

During Review:
  □ Respond within 24h
  □ Address blocking comments
  □ Explain decisions
  □ Re-test after changes
```

### For Reviewers

```
During Review:
  □ Check context first
  □ Use comment prefixes
  □ Be constructive
  □ Complete within 24h

Approval:
  □ No blocking issues
  □ Tests adequate
  □ Security checked
```

---

**Remember**: Code review is a conversation, not a judgment. We're all working together to build the best possible IDE.

For questions about the review process, please open a discussion.
