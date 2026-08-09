# Knowledge Base Entry

A durable, reference-style article for the knowledge base. Created as a Trilium
**code** note with mime `text/x-markdown`, so write the body in Markdown.

## Format
- Start with a single `# H1` title matching the note title.
- One-paragraph **summary** directly under the title: what this covers and when
  it is relevant, in plain terms.
- Then `## sections`. Prefer task- or question-shaped headings
  ("How to rotate the token", "Why the build needs BuildKit").
- Use fenced code blocks with a language tag for commands and snippets.
- Close with a `## See also` section linking related entries.
- Write for a reader who lands here cold in six months, not for someone who
  already has today's context.

## Conventions & Voice
Language, address form (formal/informal) and tone are NOT fixed here. If the
author has not told you which to use, ask before writing — do not guess.

## Skeleton
```markdown
# <Title>

<One-paragraph summary.>

## Background
<Context a newcomer needs.>

## How to <task>
​```bash
<commands>
​```

## See also
- <related entry>
```
