# Checklist (Checkliste)

A list of steps to be worked through and ticked off, usually on paper. Created
as a Trilium **code** note with mime `text/x-markdown`.

The print theme renders each item with a box to tick, so this type is written
for someone standing in front of the thing, pen in hand — not reading at a desk.

## Format
- Start with a single `# H1` naming the checklist.
- One short paragraph under it: **when** this checklist is used and **when it is
  finished**. A checklist with no end condition is a wish list.
- Group items under `## sections` if there is a natural order (Preparation /
  Execution / Handover). Do not create sections for fewer than three items.
- Every item is a Markdown task box: `- [ ] <action>`.
- One action per item, phrased as an **imperative** and checkable in one pass:
  "Close the main valve", not "Ensure everything is safe". If you cannot tell
  whether an item is done by looking, it is too vague — split it.
- Put a value to be recorded in the item itself, e.g.
  `- [ ] Record the meter reading: ____`. The print theme leaves the rule blank.
- Order items so no item depends on a later one.
- If an item is dangerous or irreversible, mark it **bold** and say what happens
  if it is skipped.

## Conventions & Voice
Write in **German** unless the author has asked for another language.

Items are bare imperatives ("Hauptventil schließen"), a form that carries no
address at all in German — so there is no address form to settle, and you must
not ask for one. Stay terse; the reader is standing in front of the thing.

Never invent a safety step, a legal requirement, or a threshold value. If the
source material does not give one, leave a blank to be filled in and tell the
author it is missing — a plausible-looking wrong value on a printed checklist is
worse than an obvious gap.

## Skeleton
```markdown
# <Checklist name>

<When this is used, and when it counts as finished.>

## <Section>

- [ ] <Imperative action.>
- [ ] Record <value>: ____
- [ ] **<Irreversible step.>** <What happens if skipped.>
```

## Attributes

The definition note carries these labels. They are the mechanics — what a
note of this type is *created as*, which the MCP reads before it writes one.
They belong to the definition, not to documentation about it: the build
stamps the note from this table.

| Label | Value |
|---|---|
| `#notecastType` | `checklist` |
| `#notecastTargetType` | `code` |
| `#notecastMime` | `text/x-markdown` |
