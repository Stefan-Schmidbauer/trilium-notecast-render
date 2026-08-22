# Handout

The document a participant takes home from a talk, a workshop or a course.
Created as a Trilium **code** note with mime `text/x-markdown`, so write the body
in Markdown.

A handout is **not** a printed deck. The slides carried a speaker; this does not.
Write for the person who reads it a fortnight later, alone, with no way to ask
what a bullet point meant. It runs over several pages and that is normal — the
constraint that shapes a slide (one screen, read at a distance) does not apply
here, and copying slide bullets into a handout produces a document that says
nothing.

## Format
- Start with a single `# H1` matching the note title.
- A **lead paragraph** directly under the title: what this covers and which
  event it belongs to. The print themes set this paragraph larger — they match
  it by position, so it has to be the first paragraph and it has to be prose,
  not a list.
- Then `## sections` in the order the material was taught, `###` beneath them
  where a section needs parts. Prefer headings that name a thing or a task
  ("Vorgehen in vier Schritten", "Was die Werkzeuge unterscheiden") over
  headings that name a phase ("Teil 2").
- Explain in **full sentences**. A handout may summarise, but a summary is still
  prose; a page of fragments is a slide that lost its speaker.
- Use fenced code blocks with a language tag for anything the reader is meant to
  type or copy.
- Close with a section saying where to ask questions and where the material
  lives.

## What the renderer can set
The print path converts a deliberately small Markdown, and anything outside it
reaches paper as literal characters. Stay inside:

- headings `#`, `##`, `###` — there is **no** `####` or deeper
- paragraphs, `-` and `1.` lists — indent by two spaces to nest one under
  another — `>` quotes, ``` fences
- pipe tables: a header row, a `|---|---|` row beneath it, then the rows.
  Alignment with `|:--|:-:|--:|`; a `\|` inside a cell is a literal pipe
- `**bold**`, `*italic*`, `` `code` ``, links, and images as
  `![alt](filename.png)` against the note's own attachments
- the block forms `::: {.columns}` / `::: {.column}` and `::: {.notes}`

A table is for data that really is a grid — a schedule, a comparison of two
tools over the same three criteria. It is not the right shape for prose: on A4
three columns of sentences leave a column about twenty characters wide. Where
the rows are explanations rather than values, write a list with a bold lead-in
(`- **Chat-Oberfläche** — schnell, aber ohne Zugriff auf eigene Dateien`), which
reads better and survives a narrow column.

## Conventions & Voice
Write in **German**, unless the author has asked for another language or the
handout belongs to an event held in one — then match the event. Take that from
the material the handout is built from; it is a rule, not a guess.

A handout explains a subject to someone who was there, so it needs no address
form settled up front — do not ask for one. Where a procedure section does speak
to the reader, use the formal *Sie* unless the author has already established
otherwise.

Never invent what was taught. If the source material — slides, notes, a
recording — does not cover a point, leave the gap and flag it to the author
rather than filling it plausibly. A handout is read as the authoritative record
of what was said, long after anyone can check.

Do not promise anything on the trainer's behalf: no follow-up sessions, no
material "that will be sent", no availability. Those are the author's to offer.

## Skeleton
```markdown
# <Titel der Unterlage>

<Ein Absatz: worum es geht und zu welchem Termin diese Unterlage gehört.>

## <Erstes Thema>

<Fließtext, der den Punkt vollständig erklärt.>

- <Ein Aspekt, mit Erläuterung.>
- <Noch einer.>

### <Ein Unterpunkt, wo nötig>

<Fließtext.>

## <Vorgehen>

1. <Schritt, als vollständiger Satz.>
2. <Schritt.>

## <Beispiel>

​```bash
<Befehl oder Prompt zum Nachmachen>
​```

<Warum das Beispiel so aussieht, wie es aussieht.>

## Fragen und Material

<Wo die Folien liegen, an wen Fragen gehen.>
```
