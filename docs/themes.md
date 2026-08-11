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
themes/_base-print.css     — shared base: page box, typography, tables, breaks
themes/letter.css          — what makes a letter a letter
themes/checklist.css       — …
themes/_page-us-letter.css — an override fragment: US Letter instead of A4
```

`build-zip.py` concatenates `_base-print.css` with one per-type file to produce
each theme note. `_base-print.css` is never a theme by itself.

A theme may append **further fragments** after the type file — CSS cascades, so
a later file wins. That is how the US Letter variants are built:

```python
theme("US Letter Note", "note", "note.css", "_page-us-letter.css"),
```

`_page-us-letter.css` contains nothing but `@page { size: Letter portrait; }`.
The type keeps its own margins, typography and margin boxes; only the sheet
changes. It works because Letter (216 × 279 mm) differs from A4 (210 × 297 mm)
by 6 mm of width and 18 mm of height — margins stated in millimetres still hold.
It would **not** work for `letter.css`, which positions the recipient block from
the top of the sheet for a DIN window envelope; a US envelope needs its own
measurements, not a size swap.

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
screen" or "this is for print", nor one saying which paper it is for — both live
in the **name**.

The consequence is deliberate: the dropdown cannot filter, so the name is the
only guide for the person choosing. Hence the paper size leads every title
shipped here — `A4 Note`, `US Letter Note`. Two themes bound to the same type
appear side by side in the dropdown and are told apart by that prefix alone.

`US Letter` is spelled out rather than shortened to `Letter`, because `letter`
is also one of the shipped **types** — a formal letter. `Letter Letter` is not a
name anyone should have to parse.

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

## Page numbers and anything else that repeats on every sheet

Use the **margin boxes of `@page`**. They sit outside the text column, so they
never collide with content, and they are the only construct here that can count
pages:

```css
@page {
    margin: 24mm 20mm 22mm 25mm;

    @bottom-right {
        content: counter(page) ' / ' counter(pages);
        vertical-align: top;
        padding-top: 4mm;
    }
}
```

`handout.css` does exactly this. Measured against Chrome 151: `@top-*` and
`@bottom-*` render on every sheet including the first, and both `counter(page)`
and `counter(pages)` resolve. Engines without the feature — Firefox, older
Chrome — ignore the block, and the document prints without the furniture.
Nothing else shifts, which is why it is safe to use.

The two obvious-looking alternatives both fail, so do not spend an afternoon on
them:

- **`position: fixed`** *does* repeat on every sheet, but it is positioned
  against the **text column**, not the paper. `top: 0` puts a header on the same
  baseline as the first line of body text and overprints it — measured, both at
  y = 70.3 pt with a 25 mm margin.
- **A negative offset to escape into the margin** breaks the first sheet. Past
  roughly −4 mm Chrome defers the overflowing box to the *next* page: the footer
  belonging to sheet 1 is painted at the top of sheet 2, and sheet 1 has none at
  all. Measured at −6, −10, −15 and −24 mm.
- **A background image on `html`** tiles down the whole document, not per sheet.
  From page 2 on it drifts through the middle of the text.

## Debugging a theme

The print preview is the only honest test — screen rendering will lie to you
about margins and breaks. Two settings in the print dialog change the result and
are the usual culprits when a theme "does not work": **margins must be Default**
(otherwise the dialog overrides your `@page`), and **background graphics must be
on** (otherwise every shaded block prints white).
