/**
 * Escaping and markdown rendering in the render widget.
 *
 * Why this matters more than it looks: the print document is opened from a
 * blob: URL, and a blob: URL inherits the origin of the document that created
 * it — so the print window is same-origin with Trilium. Anything that escapes
 * its context there runs with the user's session.
 *
 * Run with:  npm test   (node --test; a bare `node --test tests/` is read as
 * a module path by newer Node and fails)
 */
const { fakeNote } = require('./stub-trilium.js');

const test = require('node:test');
const assert = require('node:assert');

const widget = require('../src/widget.js');

// Payloads that try to leave the context they are interpolated into.
const BREAKOUTS = [
    '</style><script>alert(1)</script>',
    '</STYLE><SCRIPT>alert(1)</SCRIPT>',
    '</style   ><script>x</script>',
    '</script><img src=x onerror=alert(1)>',
];

test('escapeStyle neutralises anything that could close the style element', () => {
    for (const payload of BREAKOUTS) {
        const out = widget.escapeStyle(payload);
        assert.ok(!/<\/\s*style/i.test(out), `closed <style> with: ${payload}`);
        assert.ok(!/<\/\s*script/i.test(out), `closed <script> with: ${payload}`);
    }
});

test('escapeStyle leaves ordinary CSS untouched', () => {
    const css = '@page { size: A4 } .doc { color: #333; content: "a/b"; } /* note */';
    assert.strictEqual(widget.escapeStyle(css), css);
});

test('escapeStyle tolerates null and undefined', () => {
    assert.strictEqual(widget.escapeStyle(null), '');
    assert.strictEqual(widget.escapeStyle(undefined), '');
});

test('escapeHtml covers both quote characters', () => {
    // Not cosmetic: without these the helper is unsafe the moment a caller uses
    // it inside an attribute, which its name invites.
    assert.strictEqual(widget.escapeHtml('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
    assert.strictEqual(widget.escapeHtml("it's"), 'it&#39;s');
    assert.strictEqual(widget.escapeHtml('a & b'), 'a &amp; b');
});

test('escapeHtml escapes the ampersand first, so entities are not double-decoded', () => {
    assert.strictEqual(widget.escapeHtml('&lt;'), '&amp;lt;');
});

test('buildPrintDocument keeps a hostile theme from executing', () => {
    const doc = widget.buildPrintDocument('Title', BREAKOUTS[0], '<p>body</p>');

    // Two <style> elements opened, two closed — the layout rules and the theme.
    // The count is the assertion: a payload that closed its element early would
    // make a third, and the theme is the half that comes from note content.
    assert.strictEqual((doc.match(/<style>/g) || []).length, 2);
    assert.strictEqual((doc.match(/<\/style>/g) || []).length, 2);
    assert.ok(!doc.includes('<script>alert(1)</script>'));
});

test('buildPrintDocument escapes the note title', () => {
    const doc = widget.buildPrintDocument('</title><script>alert(1)</script>', '', '');
    assert.ok(!doc.includes('<script>alert(1)</script>'));
    assert.ok(doc.includes('&lt;/title&gt;'));
});

test('buildPrintDocument carries its own print trigger', () => {
    // The opener used to attach win.onload after document.close(), which races
    // the event it waits for. Keeping the call inside the document removes it.
    const doc = widget.buildPrintDocument('t', '', '');
    assert.ok(doc.includes('window.print()'));
    assert.ok(doc.includes("addEventListener('load'"));
});

// ── markdown ─────────────────────────────────────────────────────────────────

test('markdownToHtml renders the constructs it claims to', () => {
    const html = widget.markdownToHtml('# H1\n\n## H2\n\n- a\n- b\n\ntext');
    assert.ok(html.includes('<h1>H1</h1>'));
    assert.ok(html.includes('<h2>H2</h2>'));
    assert.ok(html.includes('<ul>') && html.includes('<li>a</li>'));
    assert.ok(html.includes('<p>text</p>'));
});

test('markdownToHtml renders inline emphasis and code', () => {
    const html = widget.markdownToHtml('**bold** *it* `c`');
    assert.ok(html.includes('<strong>bold</strong>'));
    assert.ok(html.includes('<em>it</em>'));
    assert.ok(html.includes('<code>c</code>'));
});

test('markdownToHtml escapes before applying the inline rules', () => {
    // The order is what makes this safe: escape first, then turn the markdown
    // markers into tags. Reversed, `**<img …>**` would emit a live element.
    const html = widget.markdownToHtml('**<img src=x onerror=alert(1)>**');
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img'));
    assert.ok(html.includes('<strong>'));
});

test('markdownToHtml escapes inside fenced code blocks', () => {
    const html = widget.markdownToHtml('```\n<script>alert(1)</script>\n```');
    assert.ok(html.includes('<pre><code>'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
});

test('markdownToHtml closes an unterminated code fence', () => {
    const html = widget.markdownToHtml('```\nstill open');
    assert.ok(html.trimEnd().endsWith('</code></pre>'));
});

test('markdownToHtml handles CRLF input', () => {
    assert.deepStrictEqual(
        widget.markdownToHtml('# T\r\n\r\n- a'),
        widget.markdownToHtml('# T\n\n- a'),
    );
});

test('markdownToHtml on empty input produces nothing', () => {
    assert.strictEqual(widget.markdownToHtml(''), '');
});

test('markdownToHtml numbers an ordered list instead of running it together', () => {
    // `itTip` prints its steps as an <ol>; before this, "1. Open …" arrived as
    // one paragraph of prose with the digits still in it.
    const html = widget.markdownToHtml('1. first\n2. second');
    assert.ok(html.includes('<ol>') && html.includes('</ol>'));
    assert.ok(html.includes('<li>first</li>'));
    assert.ok(html.includes('<li>second</li>'));
    assert.ok(!html.includes('1.'), `digits left in the output: ${html}`);
});

test('markdownToHtml accepts both ordered-list markers', () => {
    assert.ok(widget.markdownToHtml('1) only').includes('<li>only</li>'));
});

test('markdownToHtml starts a new list when the marker style changes', () => {
    // Continuing under the old tag would print bullets as numbers or vice versa.
    const html = widget.markdownToHtml('- a\n\n1. b');
    assert.ok(html.includes('</ul>'), `unordered list left open: ${html}`);
    assert.ok(html.indexOf('<ol>') > html.indexOf('</ul>'));
});

test('markdownToHtml renders a blockquote as one block', () => {
    // The `itTip` theme frames the caveat by matching the blockquote itself,
    // so the marker must not survive into the text.
    const html = widget.markdownToHtml('> needs a restart\n> to take effect');
    assert.ok(html.includes('<blockquote>'));
    assert.ok(html.includes('needs a restart to take effect'));
    assert.ok(!html.includes('&gt; needs'), `quote marker left in: ${html}`);
    assert.strictEqual(html.match(/<blockquote>/g).length, 1);
});

test('markdownToHtml closes a blockquote before whatever follows it', () => {
    const html = widget.markdownToHtml('> quoted\n\n## After');
    assert.ok(html.indexOf('</blockquote>') < html.indexOf('<h2>'));
});

test('markdownToHtml leaves quote markers inside a code fence alone', () => {
    const html = widget.markdownToHtml('```\n> git log\n1. not a step\n```');
    assert.ok(!html.includes('<blockquote>'));
    assert.ok(!html.includes('<ol>'));
    assert.ok(html.includes('&gt; git log'));
});

// ── images ───────────────────────────────────────────────────────────────────

/**
 * The contract (notecast-contract.md, "Images"): an image is an attachment of
 * the note that shows it, and its *title is the file name* a bare reference
 * target is matched against. The presenter implements the same lookup — the
 * point of these tests is that a note authored by the MCP prints the way it
 * presents. Before this, `![x](a.png)` reached paper as literal markdown.
 */

const ATT = [{ attachmentId: 'att01', title: 'diagram.png' }];
const URLS = { 'diagram.png': 'api/attachments/att01/image/diagram.png' };
const BASE = 'https://trilium.example';

test('a bare file name resolves against the note attachments', () => {
    const html = widget.markdownToHtml('![A diagram](diagram.png)', URLS, BASE);

    assert.ok(html.includes('<img src="https://trilium.example/api/attachments/att01/image/diagram.png"'),
        html);
    assert.ok(html.includes('alt="A diagram"'));
});

test('the URL is absolute, because the print window is a blob', () => {
    // A relative api/... resolves against the blob: origin and 404s. This is the
    // half the presenter does in processSlideContent and the renderer lacked.
    const html = widget.markdownToHtml('![x](diagram.png)', URLS, BASE);

    assert.ok(!/src="api\//.test(html), `left a relative URL: ${html}`);
});

test('an unresolvable file name prints a visible placeholder, not a dead image', () => {
    // On paper a broken <img> is invisible; a missing figure has to be
    // noticeable before the document is handed to someone.
    const html = widget.markdownToHtml('![The chart](missing.png)', URLS, BASE);

    assert.ok(!html.includes('<img'), html);
    assert.ok(html.includes('[missing image: The chart]'), html);
});

test('an explicit http URL is left alone', () => {
    const html = widget.markdownToHtml('![x](https://example.com/a.png)', URLS, BASE);

    assert.ok(html.includes('src="https://example.com/a.png"'), html);
});

test('an api/ target is made absolute', () => {
    const html = widget.markdownToHtml('![x](api/attachments/att09/image/b.png)', URLS, BASE);

    assert.ok(html.includes('src="https://trilium.example/api/attachments/att09/image/b.png"'), html);
});

test('pandoc size classes survive, so a print theme can size the figure', () => {
    const html = widget.markdownToHtml('![x](diagram.png){.img-large .center}', URLS, BASE);

    assert.ok(html.includes('class="img-large center"'), html);
});

test('a hostile class list cannot leave the attribute', () => {
    const html = widget.markdownToHtml('![x](diagram.png){." onerror="alert(1)}', URLS, BASE);

    assert.ok(!html.includes('onerror'), html);
});

test('the alt text is escaped', () => {
    const html = widget.markdownToHtml('![" onerror="alert(1)](diagram.png)', URLS, BASE);

    assert.ok(!html.includes('onerror="alert(1)"'), html);
    assert.ok(html.includes('&quot;'), html);
});

test('a file name containing & still matches its attachment', () => {
    // The reason images are lifted out before escaping: escaping first would
    // look up "a&amp;b.png" and never find the attachment.
    const urls = { 'a&b.png': 'api/attachments/att02/image/a%26b.png' };
    const html = widget.markdownToHtml('![x](a&b.png)', urls, BASE);

    assert.ok(html.includes('att02'), html);
});

test('a file name containing * does not get chewed up by the emphasis rules', () => {
    const urls = { 'a*b.png': 'api/attachments/att03/image/a%2Ab.png' };
    const html = widget.markdownToHtml('![x](a*b.png)', urls, BASE);

    assert.ok(html.includes('att03'), html);
    assert.ok(!html.includes('<em>'), html);
});

test('an image inside a list item is resolved too', () => {
    const html = widget.markdownToHtml('- see ![x](diagram.png)', URLS, BASE);

    assert.ok(html.includes('<li>') && html.includes('<img'), html);
});

test('markdown without images is unaffected by the placeholder machinery', () => {
    assert.strictEqual(
        widget.markdownToHtml('# T\n\n- a'),
        widget.markdownToHtml('# T\n\n- a', URLS, BASE),
    );
});

test('absolutiseUrls rewrites what Trilium puts in a text note', () => {
    const html = widget.absolutiseUrls('<img src="api/attachments/att01/image/a.png">', BASE);

    assert.ok(html.includes('src="https://trilium.example/api/attachments/att01/image/a.png"'), html);
});

test('absolutiseUrls handles single quotes and leaves other URLs alone', () => {
    assert.ok(widget.absolutiseUrls("<img src='api/x'>", BASE).includes("src='https://trilium.example/api/x'"));
    assert.strictEqual(widget.absolutiseUrls('<img src="https://e.com/api/x">', BASE),
        '<img src="https://e.com/api/x">');
});

test('renderContent resolves images for a markdown note end to end', async () => {
    const note = fakeNote({ content: '![A diagram](diagram.png)', attachments: ATT });

    const html = await widget.renderContent(note);

    assert.ok(html.includes('https://trilium.example/api/attachments/att01/image/diagram.png'), html);
});

test('renderContent absolutises the URLs a text note already carries', async () => {
    const note = fakeNote({
        type: 'text', mime: 'text/html',
        content: '<p><img src="api/attachments/att01/image/a.png"></p>',
    });

    const html = await widget.renderContent(note);

    assert.ok(html.includes('src="https://trilium.example/api/'), html);
});

test('renderContent survives a note whose attachments cannot be read', async () => {
    const note = fakeNote({ content: '![x](diagram.png)' });
    note.getAttachments = async () => { throw new Error('froca says no'); };

    const html = await widget.renderContent(note);

    // The document still prints; the figure degrades to the placeholder.
    assert.ok(html.includes('[missing image'), html);
});

// ── pandoc fenced divs ───────────────────────────────────────────────────────

/**
 * The slide type is written with `::: {.columns}` / `::: {.notes}`, and without
 * this they reached paper as literal `::: {.columns}` lines. The emitted
 * structure matches the presenter's — `columns columns-N`, `column column-N`,
 * notes in their own div — so a theme can be written once for both.
 */

const SLIDE = [
    '## Zwei Bilder',
    '',
    '::: {.columns}',
    '::: {.column}',
    'links',
    ':::',
    '::: {.column}',
    'rechts',
    ':::',
    ':::',
    '',
    '::: {.notes}',
    'Sprechernotiz.',
    ':::',
].join('\n');

test('columns become nested divs with the presenter class names', () => {
    const { html } = widget.processPandocDivs(SLIDE);

    assert.ok(html.includes('<div class="columns columns-2">'), html);
    assert.ok(html.includes('<div class="column column-1">'), html);
    assert.ok(html.includes('<div class="column column-2">'), html);
    assert.ok(!html.includes(':::'), `marker left in output: ${html}`);
});

test('notes are lifted out of the flow, not printed where they were written', () => {
    const { html, notes } = widget.processPandocDivs(SLIDE);

    assert.ok(notes.includes('Sprechernotiz.'), notes);
    assert.ok(!html.includes('Sprechernotiz.'), html);
});

test('markdown inside a column is still rendered', () => {
    const { html } = widget.processPandocDivs(
        '::: {.columns}\n::: {.column}\n- a\n- b\n:::\n:::');

    assert.ok(html.includes('<ul>') && html.includes('<li>a</li>'), html);
});

test('images inside a column are resolved', () => {
    const urls = { 'd.png': 'api/attachments/att01/image/d.png' };
    const { html } = widget.processPandocDivs(
        '::: {.columns}\n::: {.column}\n![x](d.png)\n:::\n:::', urls, 'https://t.example');

    assert.ok(html.includes('src="https://t.example/api/attachments/att01/image/d.png"'), html);
});

test('a page-break div becomes the element the base CSS breaks on', () => {
    const { html } = widget.processPandocDivs('a\n\n::: {.page-break}\n:::\n\nb');

    assert.ok(html.includes('<div class="page-break"></div>'), html);
});

test('fenced divs inside a code block stay literal', () => {
    const { html } = widget.processPandocDivs('```\n::: {.columns}\n:::\n```');

    assert.ok(!html.includes('<div class="columns'), html);
    assert.ok(html.includes(':::'), html);
});

test('an unknown div class still becomes a div of that name', () => {
    // Generic on purpose: a type may introduce its own block and a theme can
    // style it without a change here.
    const { html } = widget.processPandocDivs('::: {.warning}\ncareful\n:::');

    assert.ok(html.includes('<div class="warning">'), html);
});

test('a div class cannot inject into the class attribute', () => {
    // Not recognised as a div at all: the class must be a plain token, so the
    // line falls through to the markdown path and is escaped as ordinary text.
    // The word `onload` survives as *text* — what must not exist is an element
    // carrying it, or a class attribute that ended early.
    const { html } = widget.processPandocDivs('::: {.a" onload="x}\nbody\n:::');

    assert.ok(!/<div[^>]*onload/.test(html), html);
    assert.ok(!html.includes('class="a"'), html);
    assert.ok(html.includes('&quot;'), html);
});

test('text outside the divs keeps its place around them', () => {
    const { html } = widget.processPandocDivs('before\n\n::: {.columns}\n:::\n\nafter');

    assert.ok(html.indexOf('before') < html.indexOf('class="columns"'), html);
    assert.ok(html.indexOf('class="columns"') < html.indexOf('after'), html);
});

test('markdown with no fenced divs is unchanged by the block parser', () => {
    const { html, notes } = widget.processPandocDivs('# T\n\n- a');

    assert.strictEqual(html, widget.markdownToHtml('# T\n\n- a'));
    assert.strictEqual(notes, '');
});

test('renderContent appends the notes div for a slide', async () => {
    const html = await widget.renderContent(fakeNote({ content: SLIDE }));

    assert.ok(html.includes('<div class="notes">'), html);
    assert.ok(html.indexOf('class="columns') < html.indexOf('class="notes"'), html);
});

// ── theme lookup ─────────────────────────────────────────────────────────────

test('the theme query quotes the type id', () => {
    // Unquoted, Trilium parses a bare `note` as part of its search grammar:
    // `#notecastTheme=note` matched ~every note in the instance, so a document
    // of the registered type `note` got a dropdown full of ordinary notes.
    // Measured live: 20 hits unquoted, 1 quoted.
    assert.strictEqual(widget.themeQuery('note'), '#notecastTheme="note"');
    assert.strictEqual(widget.themeQuery('kbEntry'), '#notecastTheme="kbEntry"');
});

test('a type id that is not a plain token falls back to all themes', () => {
    // Building a query out of arbitrary label text is not something quoting
    // fixes; such an id is not a valid Notecast id in the first place.
    for (const bad of ['a"b', 'a b', '#x', '', null, undefined]) {
        assert.strictEqual(widget.themeQuery(bad), '#notecastTheme', `for: ${bad}`);
    }
});

// ── the widget must not shadow its base class ────────────────────────────────

/**
 * Names BasicWidget / NoteContextAwareWidget / RightPanelWidget own. Defining
 * any of them without meaning to override it hands Trilium our method where it
 * expects its own.
 *
 * This shipped: the print routine was called `render()`, which is BasicWidget's
 * public mount entry point. Trilium called it to build the widget, got the print
 * routine, and never received a `$widget` — the failure took the whole frontend
 * down, note tree included. The presenter widget survived on the same base class
 * only because it happens to have no method by that name.
 *
 * `doRender` matters twice over now that the base class is RightPanelWidget:
 * that is where the collapsible card, the header and `this.$body` are built, so
 * defining it here would leave doRenderBody with nothing to fill.
 *
 * `doRenderBody`, `refreshWithNote` and the `widgetTitle` / `position` /
 * `parentWidget` getters are the deliberate overrides and stay out of the list.
 */
const BASE_CLASS_METHODS = [
    'render', 'doRender', 'toggleInt', 'toggleExt', 'cleanup', 'remove',
    'isEnabled', 'refresh', 'noteSwitched', 'activeContextChanged',
    'isNote', 'isNoteContext', 'isActiveNoteContext',
];

test('the widget shadows no method of its base class', () => {
    const own = Object.getOwnPropertyNames(Object.getPrototypeOf(widget));
    const clashes = own.filter(name => BASE_CLASS_METHODS.includes(name));
    assert.deepStrictEqual(clashes, [],
        `these shadow the Trilium base class: ${clashes.join(', ')}`);
});

test('the print routine is still reachable under its own name', () => {
    assert.strictEqual(typeof widget.printNote, 'function');
});

// ── printing a subtree ───────────────────────────────────────────────────────

/**
 * One page per note is what the presenter's handout used to do for slides. It
 * lives here now, generalised to every type, because this plugin already prints
 * them all — the presenter only presents.
 */

test('a subtree prints one page per note, in tree order', async () => {
    const root = fakeNote({
        noteId: 'root', content: '# Root',
        // froca hands the children back in one order while the branches say
        // another: the second sits first in the tree. Sorting must follow the
        // tree, or a deck prints out of sequence.
        children: [
            fakeNote({ noteId: 'a', content: '# Alpha' }),
            fakeNote({ noteId: 'b', content: '# Beta' }),
        ],
        positions: { a: 20, b: 10 },
    });

    const html = await widget.renderSubtree(root);
    assert.strictEqual((html.match(/<section class="notecast-page">/g) || []).length, 3);
    assert.ok(html.indexOf('Beta') < html.indexOf('Alpha'),
        'children printed in froca order instead of tree order');
    assert.ok(html.indexOf('Root') < html.indexOf('Beta'), 'the root is not first');
});

test('container notes cost no blank page', async () => {
    // A Trilium folder is an empty text note. Printed literally it is a sheet
    // of nothing between the notes someone actually wants.
    const root = fakeNote({
        noteId: 'root', type: 'text', content: '<p>&nbsp;</p>',
        children: [fakeNote({ noteId: 'a', content: '# Alpha' })],
    });

    const html = await widget.renderSubtree(root);
    assert.strictEqual((html.match(/notecast-page/g) || []).length, 1);
    assert.ok(html.includes('Alpha'));
});

test('a note holding only a figure still gets its page', () => {
    // Emptiness is judged on rendered HTML, so it must not read "no text" as
    // "no content" — that would drop exactly the pages a handout is for.
    assert.ok(widget.hasVisibleContent('<p><img src="x.png" alt=""></p>'));
    assert.ok(widget.hasVisibleContent('<table><tr><td></td></tr></table>'));
    assert.ok(!widget.hasVisibleContent('<p>&nbsp;</p>\n<div>  </div>'));
    assert.ok(!widget.hasVisibleContent(''));
});

test('image and file notes are skipped, their children are not', async () => {
    // Their content is binary; the fallback path would print it as a wall of
    // <pre>. Skipping the note must not amputate the subtree below it.
    const root = fakeNote({
        noteId: 'root', content: '# Root',
        children: [fakeNote({
            noteId: 'img', type: 'image', content: 'PNG binary',
            children: [fakeNote({ noteId: 'a', content: '# Alpha' })],
        })],
    });

    const html = await widget.renderSubtree(root);
    assert.ok(!html.includes('PNG binary'));
    assert.ok(html.includes('Alpha'), 'a child under an image note was lost');
});

test('a clone cycle terminates instead of hanging the tab', async () => {
    // The same note can sit in a Trilium tree twice; two of them can point at
    // each other. Without the visited set this recurses until the tab dies.
    const a = fakeNote({ noteId: 'a', content: '# Alpha' });
    const b = fakeNote({ noteId: 'b', content: '# Beta', children: [a] });
    a.getChildNotes = async () => [b];
    a.getChildBranches = () => [{ noteId: 'b', notePosition: 0 }];

    const html = await widget.renderSubtree(a);
    assert.strictEqual((html.match(/notecast-page/g) || []).length, 2);
});

test('the page break rules survive a theme that ships none', () => {
    // They sit in their own <style> ahead of the theme for that reason: one
    // page per note is the widget's promise, not something every theme has to
    // remember. A theme can still override it, but has to say so.
    const doc = widget.buildPrintDocument('T', '.notecast-doc { color: red }', '<p>x</p>');
    assert.ok(doc.includes('.notecast-page { page-break-before: always'));
    assert.ok(doc.includes('.notecast-page:first-child { page-break-before: avoid'));
    assert.ok(doc.indexOf('.notecast-page {') < doc.indexOf('color: red'),
        'theme CSS must come last so it can override deliberately');
});
