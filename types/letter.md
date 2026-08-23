# Letter (Brief)

A formal letter meant to be printed on A4, folded, and put in a window envelope.
Created as a Trilium **text** note, so write the body as HTML — a letter is a
layout document, and the print theme positions the blocks by their class.

## Format

Write exactly these blocks, in this order. The class names are what the print
theme hooks into, so keep them even when a block is short.

| Block | Class | Content |
|---|---|---|
| Sender | `letter-sender` | Your name and address, one line per element |
| Recipient | `letter-recipient` | Addressee and address — positioned for the envelope window |
| Date | `letter-date` | Place and date |
| Subject | `letter-subject` | One line, no trailing full stop |
| Salutation | `letter-salutation` | The opening address |
| Body | `letter-body` | `<p>` paragraphs |
| Closing | `letter-closing` | Closing formula, then the name |

Rules:
- Do **not** add a heading — a letter has a subject line, not an `<h1>`.
- Keep the recipient block to at most six lines; the envelope window is fixed.
- One thought per paragraph. First paragraph states the reason for writing.
- Do not include a signature image or a placeholder like `[signature]` — the
  print theme leaves vertical space for a handwritten one.

## Conventions & Voice
Write in **German** unless the author has asked for another language.

The **address form** (formal or informal) is NOT fixed here, and no type needs
it more: the wrong register is visible in the salutation, in the first line, and
the letter is going out on paper where nothing can be corrected afterwards. If
the author has not told you which to use, ask before writing — do not guess.

Never invent an address, a reference number, a customer number or a date. Leave
the block empty and tell the author what is missing.

## Skeleton
```html
<div class="letter-sender">
  <p>Name<br>Street<br>Postcode City</p>
</div>

<div class="letter-recipient">
  <p>Name<br>Street<br>Postcode City</p>
</div>

<div class="letter-date"><p>City, YYYY-MM-DD</p></div>

<div class="letter-subject"><p>Subject line</p></div>

<div class="letter-salutation"><p>Salutation,</p></div>

<div class="letter-body">
  <p>Reason for writing.</p>
  <p>Detail.</p>
</div>

<div class="letter-closing">
  <p>Closing formula,</p>
  <p>Name</p>
</div>
```

## Attributes

The definition note carries these labels. They are the mechanics — what a
note of this type is *created as*, which the MCP reads before it writes one.
They belong to the definition, not to documentation about it: the build
stamps the note from this table.

| Label | Value |
|---|---|
| `#notecastType` | `letter` |
| `#notecastTargetType` | `text` |
