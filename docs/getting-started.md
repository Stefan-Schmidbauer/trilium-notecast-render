# Getting Started

Notecast Render turns a Trilium note into a print-ready A4 document and hands it
to your browser's print dialog — save as PDF, or print on paper.

## Install

Import the plugin's `.zip` into Trilium (**Note tree → … → Import into note**).
That creates one subtree containing:

- the **widget** (the note labelled `#widget`) — the code that does the work
- six **note types** (`#notecastType=…`) — the formats an AI assistant writes to
- one **print theme** per type (`#notecastTheme=…`) — the CSS each is printed with
- this documentation

**Then enable the widget.** Trilium neutralises executable labels in anything you
import — an archive must not be able to run code just by being opened — so the
widget note arrives carrying `#disabled:widget` instead of `#widget`. Until you
rename it back, the plugin is installed but inert and no widget appears:

1. Open the **Widget** note and switch to its *Owned attributes*.
2. Rename `#disabled:widget` to `#widget` and save.
3. Reload Trilium (widgets are only loaded at startup).

## Print a note

1. Open the note you want to print.
2. The render widget appears in the right-hand pane, with a theme dropdown.
3. Pick a theme and press **Print / PDF**.

The widget opens a new window with the note rendered in the chosen theme and
calls the print dialog. From there, "Save as PDF" and printing on paper are the
same path.

## Print a whole subtree

When the open note has children, an **Include subtree** checkbox appears under
the theme dropdown. Tick it and Print produces one document containing the note
and every note below it, **one page per note**, in the order the tree shows
them.

This works for any type, not just one: a folder of meeting notes prints as a
booklet, a deck of slides prints as a handout, a set of checklists prints as a
stack of sheets.

Three things worth knowing:

- **The theme applies to the whole document.** Children may carry a different
  `#notecastInstance`, but one print job produces one stylesheet — the dropdown
  is filled from the note you pressed Print on. To print mixed types each in
  their own theme, print them separately.
- **Container notes are skipped.** A Trilium folder is an empty text note;
  printing it literally would put a blank sheet between the notes you want.
- **Image and file notes are skipped**, but the notes beneath them are not.

Handouts for a presentation used to be the presenter plugin's job. They are here
now, because this plugin already prints every type and the presenter should only
present.

## Which themes are offered

The dropdown is filtered by the note's type. A note authored by the MCP server
carries `#notecastInstance=<typeId>`, and the widget then offers exactly the
themes bound to that type (`#notecastTheme=<typeId>`).

A note without that label — anything you wrote by hand — gets **all** themes,
because there is nothing to filter on. Picking a letter theme for a checklist
will not break anything; it will just look wrong.

To make a hand-written note behave like a typed one, add the label yourself:
`#notecastInstance=checklist`.

## Print settings

Two settings in the browser's print dialog decide whether the output matches
what the theme intends:

- **Margins: Default.** The theme sets its own margins via `@page`. Overriding
  them in the dialog fights the theme — the letter's envelope window position is
  the first thing that breaks.
- **Background graphics: on.** Without it, table headers, the metadata block on
  meeting notes and the highlight on irreversible checklist steps print white on
  white.

Paper size follows the theme (`A4 portrait`, or landscape for slides).

## Where the content comes from

This plugin only *renders*. It does not create or change notes.

Notes are written either by you, in Trilium, or by an AI assistant through
[trilium-notecast-mcp](https://github.com/Stefan-Schmidbauer/trilium-notecast-mcp),
which reads the same type definitions this plugin ships and writes notes that
conform to them. The two never talk to each other directly — they meet in the
Trilium notes and in the shared `#notecast…` labels.

## Next

- [Note Types](note-types.md) — what ships, and how to add your own
- [Themes](themes.md) — adapting the print CSS, or writing a new theme
