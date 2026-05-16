# paster

`paster` is a pi extension that turns pasted, drag-dropped, or clipboard-provided images into first-class image attachments.

Instead of leaving raw local image paths in your prompt, paster replaces them with readable placeholders such as `[#image 1]` and attaches the matching image content to the same user turn.

## Preview

<!-- Replace this with the project screenshot/demo image. -->

![paster preview](./docs/preview.png)

## Why this exists

Terminal image workflows are awkward: dragging a screenshot into a terminal usually inserts a local file path, and pasting an image from the clipboard may require special handling. Even when a model could inspect a local file through tools, that adds friction and wastes context/tool-call budget compared with attaching the image directly.

`paster` makes image input feel native in pi interactive mode:

1. Paste or drag/drop an image path into the editor.
2. The path is replaced with a placeholder like `[#image 1]`.
3. The image is stored in memory immediately.
4. When you submit, pi sends your text with the placeholder plus the actual image attachment.
5. The submitted image is rendered back in the conversation so you can confirm what was attached.

## Features

- Converts pasted or drag-dropped image paths into placeholders.
- Supports PNG, JPEG, WebP, and GIF by magic-byte detection.
- Supports absolute, relative, home-relative, quoted, and shell-escaped paths.
- Attaches only placeholders still present in the submitted prompt.
- Preserves attachment order by first placeholder occurrence.
- Shows submitted image previews in chat history.
- Optional custom editor integration:
  - cursor-based image preview above the input
  - atomic deletion of whole image placeholders
  - macOS clipboard image paste via pi's image paste keybinding

## Installation

Once published to npm, install the package with pi:

```bash
pi install npm:pi-paster
```

Or try it without installing:

```bash
pi -e npm:pi-paster
```

For local development/testing:

```bash
pi -e .
```

## Usage

Start pi interactive mode with the extension enabled.

Then paste or drag/drop an image path:

```text
/Users/me/Desktop/screenshot.png
```

The editor will insert:

```text
[#image 1]
```

You can also write normal text around it:

```text
What is wrong in this screenshot? [#image 1]
```

On submit, the text and matching image attachment are sent together.

## Clipboard image paste

On macOS, use the `/paster-paste-image` command to read the clipboard image, insert a placeholder, and attach the image when you submit.

Paster also registers `Alt+V` by default for the same clipboard-image flow. If your terminal or another extension uses `Alt+V`, load a small wrapper extension and set `clipboardShortcuts: false` or provide another shortcut.

`Cmd+V` is handled by the terminal emulator itself. In Ghostty, if the clipboard contains text, Ghostty pastes the text into pi; if the clipboard contains only image data, pi may receive no input. Use `Alt+V`, `/paster-paste-image`, or an explicit paster shortcut for direct clipboard-image paste.

## Configuration

By default paster avoids replacing pi's editor. It uses terminal paste/drop handling for image paths plus `Alt+V` and `/paster-paste-image` for clipboard images.

To customize behavior, load a small wrapper extension:

```ts
import { createPaster } from "pi-paster";

export default createPaster({
  clipboardShortcuts: ["alt+v"],
  customEditor: {
    enabled: true,
    showImagePreview: true,
    deletePlaceholderAsBlock: false,
    replaceExistingEditor: false,
  },
});
```

### Options

| Option                                  | Default | Description                                                                                                                          |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `clipboardShortcuts`                    | `["alt+v"]` | Shortcuts that run the same clipboard attach flow as `/paster-paste-image`. Set `false` or `[]` to disable.                     |
| `customEditor.enabled`                  | `false` | Replaces pi's input editor with paster's editor integration for cursor previews and editor-level paste handling.                      |
| `customEditor.showImagePreview`         | `true`  | Shows an image preview above the input when the cursor is inside an image placeholder. Requires `customEditor.enabled`.               |
| `customEditor.deletePlaceholderAsBlock` | `false` | Makes backspace/delete remove the whole placeholder when editing inside or adjacent to it. Experimental: uses pi editor internals.    |
| `customEditor.replaceExistingEditor`    | `false` | If another extension already installed a custom editor, replace it instead of falling back to paster's non-editor paste path handler. |

When `customEditor.enabled` is `false`, paster still handles bracketed terminal paste/drop image paths and clipboard images through `/paster-paste-image`, but cursor previews and atomic placeholder deletion are disabled.

## Development

This repo uses a plain TypeScript toolchain with pnpm.

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run check
```

The package manifest exposes the extension through:

```json
{
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```
