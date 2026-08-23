# Meeting Note (Besprechungsnotiz)

A record of one meeting: what was discussed, what was decided, who does what
next. Created as a Trilium **code** note with mime `text/x-markdown`.

Written to be printed and handed round, so the reader may have no screen and no
way to ask a follow-up question. Everything needed to act must be on the page.

## Format
- Start with a single `# H1` naming the meeting and its date, e.g.
  `# Sprint Review — 2026-08-07`.
- A short **metadata block** directly under the title: date, participants,
  and who chaired or took the notes. Write it as a **`-` list**, one item per
  line, so it survives narrow print margins. It has to be a list: consecutive
  markdown lines collapse into a single paragraph, and the print theme then has
  one long line to wrap wherever it fits — which is what the per-line rule is
  there to prevent.
- Then `## Topics`, one `###` per agenda item. Under each: what was discussed,
  compressed to the substance. Not a transcript.
- `## Decisions` — the outcomes, each as one sentence in the past tense
  ("Agreed to postpone the migration to Q4"). A decision with no owner and no
  date is not a decision; say so rather than inventing one.
- `## Actions` — a table with the columns *Action*, *Owner*, *Due*. Leave a cell
  empty rather than guessing a name or a date.
- If something was raised but not settled, put it under `## Open questions`. Do
  not quietly promote it to a decision.

## Conventions & Voice
Write in **German** unless the author has asked for another language.

Minutes record what happened; they are not addressed to anyone, so there is no
address form to settle — do not ask for one. Keep the tone neutral even where
the meeting was not, and keep decisions in the past tense.

Never invent participants, decisions, owners or dates. If the source material
does not say who owns an action, write the action with an empty owner and flag
it to the author.

## Skeleton
```markdown
# <Meeting> — <YYYY-MM-DD>

- **Date:** <YYYY-MM-DD>
- **Participants:** <names>
- **Notes by:** <name>

## Topics

### <Agenda item>
<What was discussed, in substance.>

## Decisions
- <Outcome, past tense.>

## Actions

| Action | Owner | Due |
|---|---|---|
| <what> | <who> | <YYYY-MM-DD> |

## Open questions
- <Unresolved point.>
```

## Attributes

The definition note carries these labels. They are the mechanics — what a
note of this type is *created as*, which the MCP reads before it writes one.
They belong to the definition, not to documentation about it: the build
stamps the note from this table.

| Label | Value |
|---|---|
| `#notecastType` | `meetingNote` |
| `#notecastTargetType` | `code` |
| `#notecastMime` | `text/x-markdown` |
