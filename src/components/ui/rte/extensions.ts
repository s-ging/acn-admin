// src/components/ui/rte/extensions.ts
// The extension set behind <RichTextEditor>.
//
// Two variants, because the same component backs two very different jobs:
//
//   full   — a press release body: images, tables, alignment, headings
//   basic  — a paragraph of boilerplate (company About). Text and links only.
//
// Note StarterKit v3 already bundles Link and Underline. Registering them again
// makes TipTap warn about duplicate extension names, so they are configured
// through StarterKit rather than added alongside it.

import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder, CharacterCount } from '@tiptap/extensions'
import type { Extensions } from '@tiptap/react'

export type ToolbarVariant = 'full' | 'basic'

export const IMAGE_ALIGNMENTS = ['left', 'center', 'right'] as const
export type ImageAlign = (typeof IMAGE_ALIGNMENTS)[number]

/**
 * Image plus an `align` attribute, stored as `data-align` on the `<img>`.
 *
 * TextAlign can't do this job: it writes `text-align` onto the node it targets,
 * and `text-align` on an `<img>` centres nothing. Alignment here is a data
 * attribute that CSS turns into auto margins, which works both in the editor
 * and in the read-only render of the stored HTML.
 */
export const AlignableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-align'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.align ? { 'data-align': attributes.align as string } : {},
      },
    }
  },
})

export function buildExtensions(variant: ToolbarVariant, placeholder?: string): Extensions {
  const base: Extensions = [
    StarterKit.configure({
      link: {
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      },
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
    CharacterCount,
  ]

  if (variant === 'basic') return base

  return [
    ...base,
    AlignableImage.configure({
      // Images are pasted as data URLs by the upload path — see ImageDialog.
      allowBase64: true,
      resize: {
        enabled: true,
        minWidth: 80,
        minHeight: 40,
        alwaysPreserveAspectRatio: true,
      },
    }),
    TableKit.configure({
      table: { resizable: true },
    }),
  ]
}
