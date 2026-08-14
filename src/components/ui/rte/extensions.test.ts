// @vitest-environment jsdom
//
// The editor is wired from a dozen extensions, and the failures that matter —
// a duplicate extension name, a missing command, an attribute that doesn't
// survive a round trip through HTML — all typecheck happily and only show up
// at runtime. So these tests build a real headless editor.

import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildExtensions } from './extensions'

let editor: Editor | null = null

function makeEditor(variant: 'full' | 'basic' = 'full', content = '') {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: buildExtensions(variant),
    content,
  })
  return editor
}

afterEach(() => {
  editor?.destroy()
  editor = null
})

describe('extension set', () => {
  it('registers no duplicate extension names', () => {
    // StarterKit v3 bundles Link and Underline. Adding them alongside it makes
    // TipTap warn and register the same node twice — this is that regression.
    const names = makeEditor().extensionManager.extensions.map(e => e.name)
    const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
    expect(duplicates).toEqual([])
  })

  it('provides the marks and nodes the toolbar drives', () => {
    const e = makeEditor()
    const names = new Set(e.extensionManager.extensions.map(x => x.name))
    for (const required of [
      'bold', 'italic', 'underline', 'strike', 'code',
      'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock',
      'horizontalRule', 'link', 'textAlign', 'image',
      'table', 'tableRow', 'tableHeader', 'tableCell',
      'placeholder', 'characterCount',
    ]) {
      expect(names, `missing ${required}`).toContain(required)
    }
  })

  it('leaves images and tables out of the basic variant', () => {
    const names = new Set(makeEditor('basic').extensionManager.extensions.map(e => e.name))
    expect(names.has('image')).toBe(false)
    expect(names.has('table')).toBe(false)
    // …but keeps the text essentials.
    expect(names.has('bold')).toBe(true)
    expect(names.has('link')).toBe(true)
    expect(names.has('textAlign')).toBe(true)
  })
})

describe('images', () => {
  it('inserts an image with alt text', () => {
    const e = makeEditor()
    e.commands.setImage({ src: 'https://example.com/a.png', alt: 'A chart' })
    expect(e.getHTML()).toContain('src="https://example.com/a.png"')
    expect(e.getHTML()).toContain('alt="A chart"')
  })

  it('accepts a base64 data URL, which the upload path produces', () => {
    const e = makeEditor()
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo='
    e.commands.setImage({ src: dataUrl })
    expect(e.getHTML()).toContain(dataUrl)
  })

  it('round-trips alignment through HTML', () => {
    const e = makeEditor()
    e.commands.setImage({ src: 'https://example.com/a.png' })
    e.commands.selectAll()
    e.commands.updateAttributes('image', { align: 'center' })
    expect(e.getHTML()).toContain('data-align="center"')

    // The part that actually breaks: reading it back out again.
    const reopened = makeEditor('full', e.getHTML())
    expect(reopened.getHTML()).toContain('data-align="center"')
  })

  it('renders no align attribute when there is none', () => {
    const e = makeEditor()
    e.commands.setImage({ src: 'https://example.com/a.png' })
    expect(e.getHTML()).not.toContain('data-align')
  })
})

describe('tables', () => {
  it('inserts a table with a header row', () => {
    const e = makeEditor()
    e.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
    const html = e.getHTML()
    expect(html).toContain('<table')
    expect((html.match(/<tr/g) ?? []).length).toBe(3)
    expect((html.match(/<th/g) ?? []).length).toBe(3)
  })

  it('exposes the row and column commands the table bar calls', () => {
    const e = makeEditor()
    e.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    for (const command of [
      'addRowBefore', 'addRowAfter', 'deleteRow',
      'addColumnBefore', 'addColumnAfter', 'deleteColumn',
      'toggleHeaderRow', 'mergeOrSplit', 'deleteTable',
    ] as const) {
      expect(typeof e.commands[command], `missing ${command}`).toBe('function')
    }
  })

  it('adds and deletes rows', () => {
    const e = makeEditor()
    e.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    const before = (e.getHTML().match(/<tr/g) ?? []).length
    e.commands.addRowAfter()
    expect((e.getHTML().match(/<tr/g) ?? []).length).toBe(before + 1)
    e.commands.deleteRow()
    expect((e.getHTML().match(/<tr/g) ?? []).length).toBe(before)
  })
})

describe('text alignment', () => {
  it('writes alignment onto paragraphs and headings', () => {
    const e = makeEditor('full', '<p>Centred</p>')
    e.commands.selectAll()
    e.commands.setTextAlign('center')
    expect(e.getHTML()).toContain('text-align: center')
  })

  it('round-trips alignment through HTML', () => {
    const reopened = makeEditor('full', '<p style="text-align: right">Right</p>')
    expect(reopened.getHTML()).toContain('text-align: right')
  })
})

describe('character count', () => {
  it('counts words and characters in the body', () => {
    const e = makeEditor('full', '<p>Toyota and Honda announce</p>')
    expect(e.storage.characterCount.words()).toBe(4)
    expect(e.storage.characterCount.characters()).toBe('Toyota and Honda announce'.length)
  })
})
