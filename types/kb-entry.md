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
Write in **German** unless the author has asked for another language.

An entry is written *about* a subject, not *to* a person, so there is no address
form to settle — do not ask for one. Keep the tone neutral and factual; the
reader wants the subject explained, not addressed.

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
