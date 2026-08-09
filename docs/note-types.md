# Note Types

A **type** is a kind of document — a letter, a checklist, a set of minutes. In
Notecast a type is not code: it is one Trilium note, labelled `#notecastType=<id>`,
whose *content* is the authoring format and whose *labels* carry the mechanics.

That single note is read by two different consumers:

- the **MCP server** reads it to know how to write notes of that type
- this **render plugin** reads `#notecastTheme=<id>` themes bound to that id, to
  know how to print them

## What this plugin ships

| Type id | Document | Created as | Print theme |
|---|---|---|---|
| `note` | A short captured thought | Trilium text (HTML) | A4 Note |
| `kbEntry` | A knowledge base article | Markdown code note | A4 Knowledge Base |
| `meetingNote` | Minutes of one meeting | Markdown code note | A4 Meeting Note |
| `checklist` | Steps to tick off on paper | Markdown code note | A4 Checklist |
| `itTip` | One problem, one fix, one page | Markdown code note | A4 IT Tip |
| `letter` | A formal letter for a window envelope | Trilium text (HTML) | A4 Letter |

They deliberately differ in target type, so you can see the mechanics doing
different things: `note` and `letter` become HTML text notes, the rest become
Markdown code notes.

`slide` is **not** in this list — that type belongs to
[trilium-presenter-plugin](https://github.com/Stefan-Schmidbauer/trilium-presenter-plugin),
which owns and ships it. This plugin only adds a print theme for it, so a slide
prints as a landscape sheet — and a whole deck prints as a handout via **Include
subtree**. The presenter presents; printing is this plugin's job, whatever the
type.

## Adding your own type

Nothing here needs changing — you tag a note and you are done.

1. Create a note. Its **content** is the authoring format: the rules whoever
   writes this type has to follow (structure, sections, conventions, tone).
2. Label it `#notecastType=<id>`, e.g. `#notecastType=expenseReport`. The id is
   what you pass to the assistant.
3. Add the mechanics labels you need:

| Label | Meaning | Default |
|---|---|---|
| `#notecastTargetType=text\|code` | Trilium note type of created notes | `text` |
| `#notecastMime=<mime>` | MIME for code notes, e.g. `text/x-markdown` | — |
| `#notecastApplyLabels=<name>=<value>` | A label stamped on every created note; repeatable | — |
| `#notecastParent=<noteId>` | Default parent for created notes | — |
| `#notecastPrefix=<prefix>` | Branch prefix for created notes | — |

4. Add at least one print theme for it — a note labelled `#notecastTheme=<id>`
   whose content is the CSS. See [Themes](themes.md).

The MCP picks the new type up on its next connection; no restart and no redeploy.
A type is cached for a minute, so a change to the format note reaches the
assistant when it reconnects.

## What the format note should say

The content of a type definition is not documentation *about* the type — it is
the instruction that reaches the AI writing it. Two things are worth copying
from the types shipped here:

**Say what must not be invented.** A printed document carries authority it has
not earned. The `meetingNote` type states that participants, decisions, owners
and dates are never to be made up; `checklist` says the same about safety steps
and threshold values, and asks for a blank instead. Without that, a model fills
gaps plausibly — and on paper, plausible and correct are indistinguishable.

`itTip` extends that to versions: a tip whose dialog was renamed two releases ago
costs its reader more time than no tip would have, so the type asks for the
version it was verified against — or for an admission that it is unknown.

**Keep the theme's hooks structural.** A theme cannot match on words if the type
leaves the language open. `itTip` is the case to copy: the print theme finds the
fix as "the paragraph after the `h1`", the environment as "the first list", the
caveat as "the blockquote". The format therefore fixes the *order and shape* of
the sections and lets their headings be written in whatever language the
document uses. Match on a heading's text and you have quietly decided that every
future document of that type is written in one language.

**Leave language and tone open.** Every shipped type says that language and
address form are not fixed and must be asked about rather than guessed. Which
form of address a letter uses is not a detail a format should decide for every
future letter.

## Two ids, one contract

`#notecastType=<id>` marks the **definition**. Notes *of* that type carry
`#notecastInstance=<id>` instead, stamped automatically by the MCP when it
creates them — that is what this plugin reads to filter the theme dropdown.

They are deliberately different labels. If instances carried `#notecastType`,
the MCP's lookup for the definition would find hundreds of notes and refuse as
ambiguous. Exactly one note may define a type; any number may be instances of it.
