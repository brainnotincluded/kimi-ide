# Trench AI System Prompts

Advanced system prompts for the Trench multi-agent system. These prompts incorporate best practices from leading AI systems (Claude Code, Cursor, Perplexity, Devin, etc.) with innovations in chain-of-thought reasoning, self-verification, and structured outputs.

## Prompt Overview

| Agent | Purpose | Key Features |
|-------|---------|--------------|
| [research-agent](./research-agent.md) | Deep information gathering | Multi-source verification, confidence levels, source quality tiers |
| [code-generation-agent](./code-generation-agent.md) | Production-ready code | Safety-first approach, self-verification, language-specific guidelines |
| [analysis-synthesis-agent](./analysis-synthesis-agent.md) | Pattern recognition & insights | MECE framework, root cause analysis, logical fallacy detection |
| [browser-automation-agent](./browser-automation-agent.md) | Web interaction & extraction | Rate limiting, error recovery, polite scraping |

## Design Principles

### 1. Structured Chain-of-Thought
Each prompt includes explicit phases for reasoning:
```
<phase_name>
- Step 1
- Step 2
- Step 3
</phase_name>
```

### 2. Self-Verification Protocols
Built-in checklists ensure quality before output:
```
<self_check>
□ Item 1
□ Item 2
□ Item 3
</self_check>
```

### 3. Clear Constraints
Explicit DO/DON'T sections prevent common errors:
```
MUST:
- Required behavior

MUST NOT:
- Prohibited behavior
```

### 4. Tool-Specific Guidance
Each prompt includes detailed tool usage patterns:
```
WHEN TO USE:
- Appropriate scenarios

WHEN NOT TO USE:
- Avoid these cases

BEST PRACTICES:
- Optimization tips
```

## Comparison with Industry Standards

### Improvements Over Claude Code
- More explicit chain-of-thought phases
- Built-in self-verification checklists
- Confidence level tracking for research
- Specialized output templates

### Improvements Over Cursor
- Pre-generation requirements analysis
- Post-generation quality review
- Security checklist integration
- Test-driven mindset

### Improvements Over Perplexity
- Source quality tiers
- Multi-dimensional confidence assessment
- Knowledge gap documentation
- Recommended next steps

### Improvements Over Devin
- Explicit planning phases
- Structured error recovery
- Progress reporting templates
- Constraint violation detection

## Usage Guidelines

### Selecting the Right Agent

```
Need to gather information from multiple sources?
→ Use research-agent

Need to write or modify code?
→ Use code-generation-agent

Need to analyze data, code, or documents for insights?
→ Use analysis-synthesis-agent

Need to interact with websites or extract web data?
→ Use browser-automation-agent
```

### Combining Agents

For complex tasks, agents can be chained:

1. **Research → Analysis**: Gather information, then analyze patterns
2. **Analysis → Code**: Understand requirements, then implement
3. **Browser → Research**: Extract data, then synthesize findings
4. **Code → Analysis**: Generate code, then review quality

### Customization

Each prompt can be adapted for specific use cases:

1. **Add domain-specific knowledge**: Insert relevant technical details
2. **Adjust verbosity**: Modify output length guidelines
3. **Customize tools**: Add/remove tool descriptions
4. **Add project conventions**: Include coding standards or templates

## Prompt Structure

Each prompt follows a consistent structure:

```
# Identity & Mission
[Who the agent is and what it does]

# Core Operating Principles
[Fundamental approaches and philosophies]

# Chain-of-Thought Protocol
[Structured reasoning phases]

# Tool Usage Guidelines
[When and how to use tools]

# Self-Verification Protocol
[Quality assurance checklists]

# Output Structure
[Response templates and formats]

# Constraints & Safety
[Rules and limitations]

# Specialized Modes
[Variants for specific use cases]
```

## Best Practices

### For Prompt Engineers

1. **Maintain consistency**: Keep similar sections aligned across prompts
2. **Document changes**: Note modifications in version control
3. **Test thoroughly**: Verify prompts with real tasks before deployment
4. **Iterate based on results**: Refine based on actual performance

### For Agent Users

1. **Provide clear goals**: Specific objectives yield better results
2. **Include context**: Relevant background improves accuracy
3. **Set boundaries**: Constraints help avoid unwanted behaviors
4. **Review outputs**: Always verify critical information

## Future Enhancements

Planned improvements to the prompt system:

- [ ] Multi-agent coordination protocols
- [ ] Dynamic prompt composition
- [ ] Performance metrics integration
- [ ] A/B testing framework
- [ ] User feedback integration

## License

These prompts are part of the Trench project and follow the project's licensing terms.
