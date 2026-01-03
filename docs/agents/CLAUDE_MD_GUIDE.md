# CLAUDE.md Maintenance Guide

## Overview
Following Boris Cherny's "Compounding Engineering" approach - maintain a living documentation file that improves over time.

## Philosophy

### Compounding Engineering
- Every mistake becomes a lesson
- Every lesson becomes documentation
- Documentation prevents future mistakes
- System improves automatically over time

### Key Principles
1. **Document mistakes immediately** - When Claude does something wrong, add it to CLAUDE.md
2. **Update during code review** - Tag @claude to update CLAUDE.md in PRs
3. **Team ownership** - Everyone contributes, everyone benefits
4. **Living document** - Grows and improves continuously

## How to Use CLAUDE.md

### When Claude Makes a Mistake
1. Identify what went wrong
2. Add to "Common Mistakes to Avoid" section
3. Provide correct example
4. Explain why it's wrong

### During Code Review
- Tag @claude to add guidance
- Update best practices
- Document new patterns
- Share learnings

### When Adding Features
1. Check CLAUDE.md for relevant patterns
2. Follow documented best practices
3. Update if you discover new patterns
4. Document edge cases

## Structure

### Sections
1. **Core Principles** - Fundamental rules
2. **Development Workflow** - Step-by-step process
3. **Common Mistakes** - What NOT to do (with examples)
4. **Best Practices** - What TO do
5. **Domain-Specific** - Traffic.cv, database, API patterns
6. **Testing Checklist** - Pre-deployment verification
7. **Common Fixes** - Solutions to frequent issues

## Examples from Our Experience

### What We've Learned
- Don't use www. in queries → Normalize domains
- Don't treat 0 traffic as error → It's valid data
- Don't scrape "No valid data" → Return 0 immediately
- Cache 0 traffic results → Avoid re-scraping
- Return cached instantly → Don't wait for scraping

### How It Helps
- Prevents repeating mistakes
- Speeds up development
- Improves code quality
- Reduces bugs
- Compounds knowledge

## Integration with Agents

### QA Agent
- Checks against CLAUDE.md patterns
- Flags violations
- Suggests fixes

### Auto-Fix Agent
- Uses CLAUDE.md for fix strategies
- Applies documented patterns
- Updates CLAUDE.md with new learnings

### Error Pattern Analysis
- Analyzes errors against CLAUDE.md
- Identifies undocumented patterns
- Suggests CLAUDE.md updates

## Maintenance

### Regular Updates
- After each bug fix
- During code reviews
- When adding features
- When discovering patterns

### Review Process
- Team reviews monthly
- Remove outdated patterns
- Consolidate similar mistakes
- Update best practices

## Benefits

1. **Compounding Knowledge** - Each mistake becomes prevention
2. **Faster Development** - Less back-and-forth with Claude
3. **Better Quality** - Fewer bugs, more consistency
4. **Team Alignment** - Shared understanding
5. **Onboarding** - New team members learn quickly

---

*"The best code is code that prevents mistakes before they happen."*

