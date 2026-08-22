/**
 * Trilium Notecast Render — a NoteContextAwareWidget that renders the active
 * note to a print-ready A4 document in a selectable theme, via the browser's
 * print dialog.
 *
 * FRONTEND ONLY — no api.runOnBackend (backend scripting is off by default in
 * TriliumNext v0.104+). All note access goes through froca.
 *
 * Contract (docs/notecast-contract.md in the trilium-notecast-mcp repo):
 *   - the active note's type is read from #notecastInstance
 *   - themes are notes labelled #notecastTheme=<typeId>, title = theme name,
 *     content = print CSS
 *   - an image is an attachment of the note that shows it, and a bare file name
 *     in the content is matched against the attachment titles
 *   - #notecastIgnore keeps a note (bare) or a branch (=subtree) out of a
 *     subtree print; it is this plugin's label, not the presenter's #slideIgnore
 *
 * The markdown renderer here is deliberately NOT the presenter's, even though
 * both emit the same structure for Pandoc fenced divs. The presenter parks
 * column blocks behind HTML comments and substitutes them back after conversion,
 * which relies on HTML surviving the converter untouched — true there, false
 * here, because this file escapes everything. See CLAUDE.md, "Pandoc fenced
 * divs", before reaching for a shared implementation.
 */

// Body only — no heading, padding or separator here. As a RightPanelWidget this
// markup is placed inside Trilium's own collapsible card, which supplies the
// title (from widgetTitle) and the frame; adding our own would duplicate both
// and look unlike every other right-pane panel.
//
// Order: settings first (theme, scope), the action last, so the button that
// opens the print dialog is not above the options it uses. Every element is
// reached by class via find(), so this block can be rearranged freely.
const TPL = `
<div class="notecast-render-widget">
    <div style="margin-bottom: 8px;">
        <label style="font-size: 0.85em; color: var(--muted-text-color); display: block; margin-bottom: 2px;">Theme</label>
        <select class="ncr-theme-select form-control" style="width: 100%; font-size: 0.9em;"></select>
    </div>
    <label class="ncr-subtree-row" style="display:block; margin-bottom:8px; font-size:0.85em; font-weight:normal;">
        <input type="checkbox" class="ncr-subtree-check"> Include subtree
    </label>
    <button class="ncr-print-btn btn btn-primary btn-sm" style="width: 100%;">
        🖨️ Print / PDF
    </button>
</div>`;

// RightPanelWidget, not NoteContextAwareWidget: it is the base class Trilium
// documents for 'right-pane'. It builds the collapsible card — heading, expand
// arrow, the panel frame — puts widgetTitle into the header, and calls
// doRenderBody() to fill this.$body. Extending NoteContextAwareWidget instead
// left that header rendered but empty, so the title had to be faked with an h4
// inside the panel and the panel could not be collapsed like every other one.
class NotecastRenderWidget extends api.RightPanelWidget {
    // Shown in the card header by the base class.
    get widgetTitle() { return 'Notecast Render'; }

    // 100, ahead of trilium-presenter-plugin's widget at 110 — both mount in
    // this same 'right-pane'. Equal positions would leave their order to the
    // order the widget notes load in, so it has to be decided here: printing a
    // page is the more frequent action, so this panel sits on top.
    // The two values belong together: change them in both repos or not at all.
    get position() { return 100; }
    get parentWidget() { return 'right-pane'; }

    // Fills this.$body — must NOT assign this.$widget. The base class owns that
    // property and has already built the card around this body; overwriting it
    // hands Trilium a widget with no header and detaches what it mounted.
    doRenderBody() {
        this.$body.empty();
        this.$body.append($(TPL));
        this.$btn = this.$body.find('.ncr-print-btn');
        this.$select = this.$body.find('.ncr-theme-select');
        this.$subtreeRow = this.$body.find('.ncr-subtree-row');
        this.$subtree = this.$body.find('.ncr-subtree-check');
        this.$btn.on('click', () => this.printNote());
    }

    async refreshWithNote(note) {
        this.toggleInt(!!note);
        if (!note) return;

        // The subtree option is offered only where there is a subtree. Clearing
        // it on the way out is not cosmetic: one widget instance serves every
        // note, so a box left ticked on a tree would silently pull in the next
        // note's children — and the print window is the first place you'd see it.
        const hasChildren = note.hasChildren();
        this.$subtreeRow.toggle(hasChildren);
        if (!hasChildren) this.$subtree.prop('checked', false);

        await this.loadThemes(note);
    }

    /**
     * The search that finds a type's themes.
     *
     * The value is quoted because Trilium's search grammar reads a bare `note`
     * as an identifier rather than a string: `#notecastTheme=note` matched
     * almost every note in the instance, so a document of the registered type
     * `note` offered a dropdown full of ordinary notes instead of its themes.
     *
     * A type id that is not a plain token cannot be quoted safely — it would be
     * building a query out of arbitrary label text — and it is not a valid
     * Notecast id either (the MCP enforces the same shape). Such a note falls
     * back to "all themes", which is what an untyped note already does.
     */
    themeQuery(typeId) {
        return /^[A-Za-z0-9_-]+$/.test(typeId || '')
            ? `#notecastTheme="${typeId}"`
            : '#notecastTheme';
    }

    /**
     * Fill the theme dropdown. The active note's #notecastInstance fixes the
     * type, so we offer that type's themes; a note without it falls back to all
     * #notecastTheme notes.
     */
    async loadThemes(note) {
        this.$select.empty();
        try {
            const typeId = note.getLabelValue('notecastInstance');
            const themeNotes = await api.searchForNotes(this.themeQuery(typeId));

            if (themeNotes.length === 0) {
                const msg = typeId
                    ? `No themes for type "${typeId}"`
                    : 'No print themes found';
                this.$select.append($('<option>', { value: '', text: msg }));
                this.$btn.prop('disabled', true);
                return;
            }
            this.$btn.prop('disabled', false);
            for (const t of themeNotes) {
                // Built as an element, not an HTML string: a note title is
                // arbitrary text, and interpolating it would let `<` or `&`
                // mangle the dropdown.
                this.$select.append($('<option>', { value: t.noteId, text: t.title }));
            }
        } catch (e) {
            console.error('Notecast Render: failed to load themes', e);
            this.$select.append($('<option>', { value: '', text: 'Error loading themes' }));
            this.$btn.prop('disabled', true);
        }
    }

    /**
     * NOT named `render()`. That is BasicWidget's public mount entry point —
     * Trilium calls it to build the widget, and overriding it meant mounting ran
     * the print routine instead: no `$widget` was ever created, and the failure
     * took the whole frontend down with it (the note tree never loaded). The
     * presenter widget shares this base class and was fine precisely because it
     * has no method by that name.
     */
    async printNote() {
        try {
            const note = this.note;
            if (!note) { api.showError('No active note'); return; }

            const themeNoteId = this.$select.val();
            let css = '';
            if (themeNoteId) {
                const themeNote = await api.getNote(themeNoteId);
                if (themeNote) css = await themeNote.getContent() || '';
            }

            const subtree = !!this.$subtree.prop('checked');
            const bodyHtml = subtree
                ? await this.renderSubtree(note)
                : this.page(await this.renderContent(note));
            if (!bodyHtml) {
                api.showError('Nothing to print — the subtree holds no content.');
                return;
            }
            const doc = this.buildPrintDocument(note.title, css, bodyHtml);

            // A blob: URL rather than document.write — the latter is deprecated,
            // and assigning `win.onload` after document.close() races the very
            // load event it waits for. The print call now lives inside the
            // document (see buildPrintDocument), so it cannot be missed.
            const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
            const win = window.open(url, 'notecast-render');
            if (!win) {
                URL.revokeObjectURL(url);
                api.showError('Popup blocked — allow popups to print.');
                return;
            }
            // Long enough that a reload in the print window still resolves.
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (e) {
            api.showError(`Render failed: ${e.message}`);
            console.error('Notecast Render error:', e);
        }
    }

    /** One printed page. Always wrapped, single note or not — the break rules
     *  in buildPrintDocument make the wrapper inert when there is only one. */
    page(html) {
        return `<section class="notecast-page">${html}</section>`;
    }

    /**
     * The active note and its descendants, each on its own page.
     *
     * This is what the presenter's handout used to do for slides, generalised:
     * the renderer already prints any type, so "one page per note" costs one
     * checkbox and works for a folder of meeting notes exactly as it does for a
     * deck. The presenter now only presents.
     *
     * The chosen theme applies to the whole document. Children may carry a
     * different #notecastInstance, but a print job produces one stylesheet, and
     * a document that switched typography partway down is worse than one that
     * does not — the dropdown is filled from the note you pressed Print on.
     *
     * `true` is the root flag: #notecastIgnore on the note you pressed Print on
     * does not exclude that note. Honouring it there would answer a deliberate
     * Print with "Nothing to print", which reads as a broken plugin.
     */
    async renderSubtree(note) {
        const collected = [];
        await this.collectNotes(note, new Set(), collected, true);

        const pages = [];
        for (const n of collected) {
            const html = await this.renderContent(n);
            // Container notes — the empty text notes Trilium's tree is built
            // from — would otherwise each cost a blank sheet. Emptiness is
            // judged on the rendered HTML because that is what reaches paper.
            if (!this.hasVisibleContent(html)) continue;
            pages.push(this.page(html));
        }
        return pages.join('\n');
    }

    /**
     * Depth-first, pre-order: the note itself, then its children in tree order.
     *
     * `visited` guards against clones — the same note can appear twice in a
     * Trilium tree, and a cycle would otherwise recurse until the tab dies.
     * Image and file notes are skipped: their content is binary, and the
     * fallback path would print it as a wall of `<pre>`.
     *
     * `isRoot` marks the note Print was pressed on, which is exempt from
     * #notecastIgnore — see ignoreMode. Recursive calls leave it at its default,
     * so only the entry point from renderSubtree is ever the root.
     */
    async collectNotes(note, visited, out, isRoot = false) {
        if (visited.has(note.noteId)) return;
        visited.add(note.noteId);

        const ignore = isRoot ? null : this.ignoreMode(note);
        if (ignore === 'subtree') return;

        const printable = note.type !== 'image' && note.type !== 'file';
        if (printable && ignore !== 'note') out.push(note);

        for (const child of await this.getSortedChildren(note)) {
            await this.collectNotes(child, visited, out);
        }
    }

    /**
     * How #notecastIgnore applies to this note: 'subtree', 'note', or null.
     *
     * Contract, "Print exclusion": bare keeps the note off paper but still walks
     * its children — that is what makes it usable on a container, which can be
     * dropped without hiding what it holds. `=subtree` drops the branch. Any
     * other value reads as bare, matching the presenter's #slideIgnore.
     *
     * It is deliberately NOT #slideIgnore. The paradigm case for that label is a
     * "Handouts" folder kept off screen precisely because it belongs on paper;
     * reading it here would suppress exactly the branch the print job is for.
     * A note that means both carries both labels.
     *
     * Trilium returns '' for a bare label and null when it is absent, so the
     * test is presence, not truthiness — `if (value)` would ignore every bare
     * one, which is the common form.
     */
    ignoreMode(note) {
        const value = note.getLabelValue('notecastIgnore');
        if (value === null || value === undefined) return null;
        return String(value).trim().toLowerCase() === 'subtree' ? 'subtree' : 'note';
    }

    /**
     * Child notes in the order the tree shows them.
     *
     * `getChildNotes()` does not promise that order; the position lives on the
     * branch, not the note. Printing a deck or a numbered set of steps in
     * froca's order rather than the author's would be silently wrong.
     */
    async getSortedChildren(note) {
        const children = await note.getChildNotes() || [];
        const pos = {};
        for (const b of note.getChildBranches() || []) pos[b.noteId] = b.notePosition;
        return [...children].sort((a, b) => (pos[a.noteId] || 0) - (pos[b.noteId] || 0));
    }

    /** Would this HTML put anything on a page? Tags that carry no text still
     *  count — a note holding only a figure is not an empty note. */
    hasVisibleContent(html) {
        const s = String(html ?? '');
        if (/<(img|hr|svg|table|video|pre)\b/i.test(s)) return true;
        return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0;
    }

    /** Note content → HTML. Text notes are already HTML; markdown gets a
     *  minimal conversion (baseline — extend / share the presenter renderer). */
    async renderContent(note) {
        const raw = await note.getContent() || '';
        // The print document is opened from a blob: URL, so a relative
        // `api/attachments/…` resolves against the blob origin and 404s. Every
        // image URL has to be made absolute, whichever path produced it.
        const baseUrl = window.location.origin;
        // A text note's content *is* HTML — Trilium sanitises it on input, and
        // passing it through is the whole point. Everything else is escaped.
        if (note.type === 'text') return this.absolutiseUrls(raw, baseUrl);
        if (note.mime === 'text/x-markdown') {
            const { html, notes } = this.processPandocDivs(
                raw, await this.attachmentUrls(note), baseUrl);
            // Notes go at the end in their own div; slide.css already styles
            // `.notes` as a set-apart handout block, and says there that hiding
            // them is a `display: none` in the theme. So this emits, the theme
            // decides — no visibility policy belongs here.
            return notes ? `${html}\n<div class="notes">${notes}</div>` : html;
        }
        return `<pre>${this.escapeHtml(raw)}</pre>`;
    }

    /**
     * Pandoc-style fenced divs: `::: {.columns}`, `::: {.column}`,
     * `::: {.notes}`, `::: {.page-break}`. The slide type is written with them,
     * and without this they reached paper as literal `::: {.columns}` lines.
     *
     * Parsed as a nested block structure rather than by pattern-replacement:
     * a `:::` line opens when it carries a class and closes when it is bare, so
     * a block's body is simply rendered by this same function one level down.
     * `.column` then needs no rule of its own — it is a div inside `.columns`.
     *
     * Notes bubble up instead of being emitted in place: they belong at the end
     * of the printed page, not where the author happened to write them.
     */
    processPandocDivs(md, urls = {}, baseUrl = '') {
        const lines = String(md ?? '').replace(/\r\n/g, '\n').split('\n');
        const out = [];
        const notes = [];
        let plain = [];
        let inCode = false;
        // Each level numbers its own `.column` children, matching the presenter's
        // `column column-1` / `column-2`. Themes can then be written against one
        // structure and used with either renderer.
        let columnIndex = 0;

        const flushPlain = () => {
            if (plain.join('').trim()) out.push(this.markdownToHtml(plain.join('\n'), urls, baseUrl));
            plain = [];
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // A fence toggles code mode, so a ::: inside a code block stays text.
            if (/^\s*```/.test(line)) { inCode = !inCode; plain.push(line); continue; }
            const open = inCode ? null : line.match(/^:::+\s*\{\.([A-Za-z0-9_-]+)\}\s*$/);
            if (!open) { plain.push(line); continue; }

            // Collect the body, tracking nesting so the matching close is found.
            const body = [];
            let depth = 1;
            let columns = 0;
            while (++i < lines.length && depth > 0) {
                const inner = lines[i];
                const innerOpen = inner.match(/^:::+\s*\{\.([A-Za-z0-9_-]+)\}\s*$/);
                if (innerOpen) {
                    if (depth === 1 && innerOpen[1] === 'column') columns++;
                    depth++;
                } else if (/^:::+\s*$/.test(inner)) {
                    depth--;
                    if (depth === 0) break;
                }
                body.push(inner);
            }

            flushPlain();
            const name = open[1];
            if (name === 'page-break') { out.push('<div class="page-break"></div>'); continue; }

            const inner = this.processPandocDivs(body.join('\n'), urls, baseUrl);
            // Notes from any depth end up at the end of the document.
            if (inner.notes) notes.push(inner.notes);
            if (name === 'notes') { notes.push(inner.html); continue; }
            let extra = '';
            if (name === 'columns' && columns) extra = ` columns-${columns}`;
            if (name === 'column') extra = ` column-${++columnIndex}`;
            out.push(`<div class="${name}${extra}">${inner.html}</div>`);
        }

        flushPlain();
        return { html: out.join('\n'), notes: notes.join('\n') };
    }

    /**
     * Map the note's own attachment titles to their URLs.
     *
     * The contract (docs/notecast-contract.md, "Images"): an image belongs to
     * the note that shows it, as an attachment whose *title is the file name*,
     * and a reference target that is a bare file name is looked up here. The
     * presenter implements the same lookup — a note authored by the MCP has to
     * render the same in print as it does on screen.
     */
    async attachmentUrls(note) {
        const urls = {};
        try {
            for (const att of (await note.getAttachments()) || []) {
                urls[att.title] = `api/attachments/${att.attachmentId}/image/${encodeURIComponent(att.title)}`;
            }
        } catch (e) {
            // A note without attachments is the normal case, and a failure here
            // must not cost the whole document — images degrade to a placeholder.
            console.error('Notecast Render: failed to read attachments', e);
        }
        return urls;
    }

    /** Make Trilium's relative attachment URLs absolute (see renderContent). */
    absolutiseUrls(html, baseUrl) {
        return String(html ?? '').replace(/(src=["'])api\//g, `$1${baseUrl}/api/`);
    }

    /**
     * A markdown image target → a URL, or null if it cannot be resolved.
     *
     * A bare file name is the contract's form and is matched against the note's
     * attachment titles; anything with a slash is left to the two explicit
     * forms. Note what is *not* here: an unresolvable target does not become an
     * `<img>` with a dead src. On paper a broken image is invisible, so the
     * caller prints a visible placeholder instead — a missing figure has to be
     * noticeable before the document is handed to someone.
     */
    resolveImageSrc(src, urls, baseUrl) {
        if (/^https?:\/\//i.test(src)) return src;
        if (src.startsWith('api/')) return `${baseUrl}/${src}`;
        if (!src.includes('/') && urls[src]) return `${baseUrl}/${urls[src]}`;
        return null;
    }

    /** One `![alt](src){.classes}` → an <img>, or a visible placeholder. */
    imageTag(alt, src, classes, urls, baseUrl) {
        const url = this.resolveImageSrc(src, urls, baseUrl);
        if (!url) return `<span class="ncr-missing-image">[missing image: ${this.escapeHtml(alt || src)}]</span>`;
        // Pandoc-style classes are what the slide templates carry; keep them so
        // a print theme can size figures. Restricted to name characters — the
        // value lands in an attribute.
        const names = (classes || '').match(/[.][A-Za-z0-9_-]+/g) || [];
        const cls = names.map(n => n.slice(1)).join(' ');
        return `<img src="${this.escapeHtml(url)}" alt="${this.escapeHtml(alt)}"`
            + `${cls ? ` class="${this.escapeHtml(cls)}"` : ''}>`;
    }

    buildPrintDocument(title, css, bodyHtml) {
        // In its own <style>, ahead of the theme: one page per note is the
        // widget's promise, not a thing each theme has to remember to honour.
        // A theme can still override it — it comes later and wins on equal
        // specificity — but it has to say so deliberately.
        const layoutCss = `
.notecast-page { page-break-before: always; break-before: page; }
.notecast-page:first-child { page-break-before: avoid; break-before: avoid; }`;
        return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${this.escapeHtml(title)}</title>
<style>${layoutCss}</style>
<style>${this.escapeStyle(css)}</style>
</head>
<body>
<div class="notecast-doc">${bodyHtml}</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 150));<\/script>
</body>
</html>`;
    }

    escapeHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Neutralise the only sequence that can end a `<style>` element early.
     *
     * The CSS comes from a #notecastTheme note, and the print window is
     * same-origin with Trilium — so a theme containing `</style><script>…`
     * would execute with the user's session. `<\/style` does not close the
     * element, and CSS reads `\/` as an escaped slash, so legitimate CSS
     * (a `content:` string, a comment) survives unchanged.
     */
    escapeStyle(css) {
        return String(css ?? '').replace(/<\/(style|script)/gi, '<\\/$1');
    }

    /** Minimal Markdown → HTML. Headings, fenced code, nested unordered and
     *  ordered lists, pipe tables, blockquotes, bold/italic/inline-code, images,
     *  paragraphs. Deliberately small — but everything the shipped types are
     *  written in has to be in it.
     *
     *  Ordered lists and blockquotes are here because `_base-print.css` styles
     *  both and no type could produce either: a numbered step came out as
     *  running text, and `> caveat` printed the literal angle bracket. The
     *  `itTip` type depends on the two — its theme finds the caveat as "the
     *  blockquote" — but `kbEntry` and `meetingNote` were quietly losing their
     *  numbering to this as well.
     *
     *  Nesting and tables joined them for the same reason: `meetingNote`'s
     *  skeleton *is* a table (`## Actions`, columns Action/Owner/Due) and a
     *  handout that indents a sub-point is ordinary prose. Both printed as
     *  literal pipes and as a flat list — see CLAUDE.md, "Lists and tables". */
    markdownToHtml(md, urls = {}, baseUrl = '') {
        const lines = md.replace(/\r\n/g, '\n').split('\n');
        const out = [];
        const inl = (text) => this.inline(text, urls, baseUrl);
        let inCode = false, para = [], quote = [];
        // One entry per open list level, innermost last, each remembering where
        // its open item's content sits in `out`. A level's <li> stays open until
        // the next sibling or the end of the list, because a nested list belongs
        // *inside* the item it hangs off.
        const stack = [];
        const indentOf = (s) => s.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
        const flushPara = () => {
            if (para.length) { out.push(`<p>${inl(para.join(' '))}</p>`); para = []; }
        };
        // A quote is one block: its lines join into a single paragraph, the
        // same way consecutive lines join into one outside a quote.
        const flushQuote = () => {
            if (quote.length) {
                out.push(`<blockquote><p>${inl(quote.join(' '))}</p></blockquote>`);
                quote = [];
            }
        };
        // Closing tag onto the item's own line while nothing has been emitted
        // since — a flat list then reads `<li>a</li>`. Once a nested list has
        // opened inside the item, `</li>` has to follow that list instead.
        const endItem = () => {
            const top = stack[stack.length - 1];
            if (!top || top.itemAt < 0) return;
            if (top.itemAt === out.length - 1) out[top.itemAt] += '</li>';
            else out.push('</li>');
            top.itemAt = -1;
        };
        const closeList = () => {
            while (stack.length) { endItem(); out.push(`</${stack.pop().tag}>`); }
        };
        const addItem = (indent, tag, content, cls = '') => {
            // Anything indented deeper than this item ended with it.
            while (stack.length && indent < stack[stack.length - 1].indent) {
                endItem(); out.push(`</${stack.pop().tag}>`);
            }
            const top = stack[stack.length - 1];
            if (!top || indent > top.indent) {
                // Deeper than the open item: a list inside it, which is why
                // that item's <li> was left open.
                out.push(`<${tag}>`);
                stack.push({ tag, indent, itemAt: -1 });
            } else if (top.tag !== tag) {
                // Switching marker style starts a new list rather than
                // continuing the old one under the wrong tag.
                endItem(); out.push(`</${stack.pop().tag}>`);
                out.push(`<${tag}>`);
                stack.push({ tag, indent, itemAt: -1 });
            } else {
                endItem();
            }
            out.push(`<li${cls ? ` class="${cls}"` : ''}>${content}`);
            stack[stack.length - 1].itemAt = out.length - 1;
        };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('```')) {
                flushPara(); flushQuote(); closeList();
                out.push(inCode ? '</code></pre>' : '<pre><code>');
                inCode = !inCode;
                continue;
            }
            if (inCode) { out.push(this.escapeHtml(line)); continue; }
            const q = line.match(/^\s*>\s?(.*)$/);
            if (q) { flushPara(); closeList(); quote.push(q[1]); continue; }
            flushQuote();
            const h = line.match(/^(#{1,3})\s+(.*)$/);
            if (h) { flushPara(); closeList(); out.push(`<h${h[1].length}>${inl(h[2])}</h${h[1].length}>`); continue; }
            const table = this.tableAt(lines, i, urls, baseUrl);
            if (table) { flushPara(); closeList(); out.push(table.html); i = table.last; continue; }
            const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
            if (ol) { flushPara(); addItem(indentOf(line), 'ol', inl(ol[1])); continue; }
            const li = line.match(/^\s*[-*]\s+(.*)$/);
            if (li) {
                flushPara();
                // `- [ ] step` is the whole of how the `checklist` type is
                // written, so the box has to become an element. Without this the
                // brackets survived escaping as literal text *and* the theme drew
                // its own box beside them — every printed item read "[ ] step"
                // next to an empty square.
                const task = li[1].match(/^\[([ xX])\](?=\s|$)\s*(.*)$/);
                if (task) {
                    const checked = task[1] !== ' ' ? ' checked' : '';
                    addItem(indentOf(line), 'ul',
                        `<input type="checkbox" disabled${checked}> ${inl(task[2])}`,
                        'task');
                } else {
                    addItem(indentOf(line), 'ul', inl(li[1]));
                }
                continue;
            }
            if (line.trim() === '') { flushPara(); closeList(); continue; }
            // A wrapped item continues the item, not the document: without this
            // the second line of a bullet became a <p> sitting between two <li>.
            const open = stack[stack.length - 1];
            if (open && open.itemAt === out.length - 1) {
                out[open.itemAt] += ` ${inl(line.trim())}`;
                continue;
            }
            para.push(line.trim());
        }
        flushPara(); flushQuote(); closeList(); if (inCode) out.push('</code></pre>');
        return out.join('\n');
    }

    /**
     * A pipe table starting at `lines[i]` — `{ html, last }` — or null.
     *
     * GitHub's shape, and its rule for what counts: a header row, then a
     * delimiter row of dashes with *the same number of cells*. That count is
     * what keeps an ordinary paragraph containing a pipe, or a `---` rule under
     * a line of prose, from being swallowed as a table.
     *
     * A row shorter than the header is padded and a longer one cut, so a table
     * with one ragged row still prints as a table — on paper a missing cell is
     * a gap the reader can see, while a dropped table is not.
     */
    tableAt(lines, i, urls = {}, baseUrl = '') {
        const head = lines[i];
        const delim = lines[i + 1];
        if (typeof head !== 'string' || typeof delim !== 'string') return null;
        if (!head.includes('|') || !/^\s*\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/.test(delim)) return null;
        const header = this.tableCells(head);
        const marks = this.tableCells(delim);
        if (header.length < 1 || marks.length !== header.length) return null;

        const aligns = marks.map((m) => {
            const left = m.startsWith(':'), right = m.endsWith(':');
            if (left && right) return 'center';
            if (right) return 'right';
            if (left) return 'left';
            return '';
        });
        // The alignment is one of four strings this function produced itself;
        // the cell text goes through inline(), which escapes.
        const cell = (tag, text, align) =>
            `<${tag}${align ? ` style="text-align:${align}"` : ''}>` +
            `${this.inline(text, urls, baseUrl)}</${tag}>`;
        const row = (cells, tag) => '<tr>' + aligns
            .map((align, c) => cell(tag, cells[c] ?? '', align)).join('') + '</tr>';

        const body = [];
        let last = i + 1;
        while (last + 1 < lines.length) {
            const next = lines[last + 1];
            if (next.trim() === '' || !next.includes('|') || /^\s*```/.test(next)) break;
            body.push(row(this.tableCells(next), 'td'));
            last++;
        }
        const html = `<table>\n<thead>${row(header, 'th')}</thead>\n` +
            (body.length ? `<tbody>\n${body.join('\n')}\n</tbody>\n` : '') + '</table>';
        return { html, last };
    }

    /** One table row → its cells. The outer pipes are optional, and `\|` is a
     *  pipe inside a cell rather than a cell boundary. */
    tableCells(row) {
        const s = String(row ?? '').trim()
            .replace(/^\|/, '')
            .replace(/(?<!\\)\|\s*$/, '');
        return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
    }

    /**
     * Inline formatting, images included.
     *
     * Images are pulled out *before* escaping and parked as placeholders, for
     * two reasons: the lookup key has to be the file name as written (escaping
     * would turn `a&b.png` into `a&amp;b.png` and miss the attachment), and a
     * finished `<img>` tag must not then be chewed on by the emphasis rules — a
     * file name containing `*` or a backtick would otherwise break the tag.
     */
    inline(s, urls = {}, baseUrl = '') {
        const parked = [];
        const withPlaceholders = String(s ?? '').replace(
            /!\[([^\]]*)\]\(([^)]+)\)(\{[^}]*\})?/g,
            (_m, alt, src, classes) => {
                parked.push(this.imageTag(alt, src, classes, urls, baseUrl));
                // NUL delimits the slot: escapeHtml leaves it untouched and
                // note text cannot contain one, so no content can forge a slot.
                // Written as an escape rather than a literal byte — this file
                // is stored as a Trilium note.
                return `\u0000IMG${parked.length - 1}\u0000`;
            });
        return this.escapeHtml(withPlaceholders)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\u0000IMG(\d+)\u0000/g, (_m, i) => parked[Number(i)]);
    }
}

module.exports = new NotecastRenderWidget();
