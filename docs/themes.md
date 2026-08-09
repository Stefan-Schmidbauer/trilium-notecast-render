# Themes

A print theme is **one Trilium note**:

| Element | Meaning |
|---|---|
| label `#notecastTheme=<typeId>` | Marks the note as a theme and binds it to a type |
| note **title** | The theme's name, as it appears in the dropdown |
| note **content** | The print CSS |

That is the whole mechanism. To add a theme, create a note, put CSS in it, label
it. To change one, edit the note.

## How the CSS is applied

The widget builds a fresh print window containing the note's rendered content
inside a wrapper:

```html
<div class="notecast-doc">
  <section class="notecast-page">
    … the note …
  </section>
</div>
```

There is one `.notecast-page` per printed note — a single note has exactly one,
and **Include subtree** produces one per note in the tree. It is always present,
so a theme never has to care which case it is in.

Your CSS is injected into that window. So every rule targets `.notecast-doc` or
its children, and `@page` governs the sheet itself:

```css
@page {
    size: A4 portrait;
    margin: 20mm 18mm;
}

.notecast-doc h1 { font-size: 20pt; }
```

Use **absolute units** — `pt` and `mm`, not `px` or `rem`. A printer has no
viewport, and relative units make the output depend on browser settings.

## Themes are self-contained

Trilium notes cannot `@import` one another, so each theme note must carry
complete CSS. In this repository that would mean one copy of the same base styles
per theme, so the source is split:

```
themes/_base-print.css   — shared base: page box, typography, tables, breaks
themes/letter.css        — what makes a letter a letter
themes/checklist.css     — …
```

`build-zip.py` concatenates `_base-print.css` with one per-type file to produce
each theme note. `_base-print.css` is never a theme by itself.

If you edit a theme **inside Trilium**, you are editing the concatenated result.
Fold the change back into the right source file, or the next build will overwrite
it.

## Writing a theme for a new type

1. Copy `_base-print.css` as your starting point — it already handles the page
   box, headings, lists, tables, code blocks and page-break behaviour.
2. Add only what makes your document different. The shipped themes are worth
   reading as examples of what "different" means in practice:
   - `letter.css` sets its own `@page` margins and positions blocks in millimetres
     so the recipient shows through an envelope window
   - `checklist.css` draws a tick box for each item, covering both the case where
     the Markdown converter produced a real checkbox and the case where it left
     the literal `[ ]` in the text
   - `slide.css` switches to landscape, because a slide in portrait wastes the page
   - `note.css` widens the right margin to leave room for handwritten remarks
   - `it-tip.css` matches its sections by position — the paragraph after the
     `h1`, the first list, the blockquote — because the type leaves the
     document's language open, and a selector keyed to the word "Caveat" would
     silently stop working on a tip written in German
3. Create the note in Trilium, label it `#notecastTheme=<typeId>`, and give it a
   title that says what it is — `A4 Compact`, `A4 Letter`, `A4 Slide (landscape)`.

## Naming, and why there is no medium label

A type simply has a set of named themes. There is no label saying "this is for
screen" or "this is for print" — the medium lives in the **name**.

The consequence is deliberate: the dropdown cannot filter by medium, so the name
is the only guide for the person choosing. Hence the `A4 …` prefix on everything
shipped here.

This matters because the presenter also has themes, and they are **not** in this
namespace. Screen themes for slides stay in the presenter under `#presenterTheme`;
they are container notes holding several CSS notes each, a shape that does not
fit "one note, one stylesheet". The two systems do not see each other's themes,
which is the intended separation rather than a gap.

## Page breaks

The base stylesheet already keeps headings with what follows them and refuses to
split code blocks, tables, images and quotes. To force a break, use the marker:

```html
<div class="page-break"></div>
```

Between notes of a subtree the break is automatic: each `.notecast-page` starts
on a fresh sheet. Those rules are injected in their own `<style>` *ahead* of the
theme, so one page per note holds whether or not a theme thought about it. A
theme that genuinely wants notes to run on can override it — it comes later and
wins on equal specificity — but it has to say so:

```css
.notecast-page { page-break-before: auto; break-before: auto; }
```

## Debugging a theme

The print preview is the only honest test — screen rendering will lie to you
about margins and breaks. Two settings in the print dialog change the result and
are the usual culprits when a theme "does not work": **margins must be Default**
(otherwise the dialog overrides your `@page`), and **background graphics must be
on** (otherwise every shaded block prints white).
