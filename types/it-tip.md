# IT Tip (IT-Tipp)

One problem, one fix, one page. Created as a Trilium **code** note with mime
`text/x-markdown`, so write the body in Markdown.

A tip is read by someone sitting in front of the problem right now, often from a
printout passed across a desk. That is what separates it from a Knowledge Base
entry: if the answer needs background, weighs alternatives, or offers more than
one route, write a `kbEntry` instead. **If it does not fit on one printed page,
it is not a tip.**

## Format
- Start with a single `# H1` that **states the problem**, it does not ask about
  it: "Outlook stops syncing after a password change", not "Why does Outlook
  stop syncing?". Someone leafing through a stack of printed tips has to
  recognise their own problem in that one line.
- Directly under the title, one **bold single-sentence answer** — the fix, not a
  promise of one. A reader who already knows the product should be able to stop
  reading there. The print theme sets this line apart, so it must be exactly one
  paragraph and it must come first.
- Then the sections below, **in this order**. The theme keys off their position,
  not their wording, so the order is not cosmetic:

  1. **Applies to** — a bullet list, and always the first section. State the
     product **with its version**, the operating system, and the rights needed
     (admin, mailbox owner, none). Required.
  2. **Steps** — a numbered list (`1.`, `2.`), one action per step, phrased as an
     imperative. Name menu items and buttons exactly as they appear on screen,
     in the UI's own wording. Required.
  3. **Why** — at most two sentences on the cause, and only when knowing it helps
     the reader recognise the problem next time. Optional.
  4. **Caveat** — what breaks, what needs a restart, what cannot be undone. Put
     the text in a blockquote (`>`); the theme frames it. Optional — leave the
     section out entirely rather than writing "none".

- Use fenced code blocks with a language tag for commands, and inline `` `code` ``
  for paths, file names, registry keys and keyboard shortcuts.
- Headings are free wording in the document's language — write "Gilt für" or
  "Applies to" as fits. What is fixed is the order and the shape (list, numbered
  list, blockquote).

## Conventions & Voice
Language, address form (formal or informal) and tone are NOT fixed here. If the
author has not told you which to use, ask before writing — do not guess.

Never invent a command, path, registry key, menu item, group policy name,
version number or setting. An IT tip is followed literally, by someone who
cannot tell a plausible path from a real one — and a printed one carries an
authority it has not earned. If the source material does not give you the exact
wording, leave a blank and tell the author what is missing.

The version in "Applies to" is part of the fix, not decoration. A tip whose
dialog was renamed two releases ago costs its reader more time than no tip at
all. If you do not know which version the fix was verified against, say so there
instead of naming one.

## Skeleton
```markdown
# <The problem, stated>

**<The fix, in one sentence.>**

## <Applies to>
- <Product and version>
- <Operating system>
- <Rights required>

## <Steps>
1. <Imperative action, naming the UI element exactly.>
2. <Imperative action.>

## <Why>
<At most two sentences on the cause.>

## <Caveat>
> <What breaks, what needs a restart, what cannot be undone.>
```
