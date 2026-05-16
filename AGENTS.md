# pi-paster Project Guide

## What this project is

`pi-paster` is a pi extension package. It makes pasted, drag-dropped, or clipboard-provided images behave like first-class image attachments in pi interactive mode.

Target behavior:

1. User pastes or drag-drops an image path, or uses pi's image clipboard paste keybinding.
2. The editor replaces the raw path/image with a placeholder like `[#image 1]`.
3. The extension stores the image payload immediately in memory.
4. On submit, the user text is sent with placeholders preserved and matching image blocks attached to the same user turn.
5. Submitted attachments render back in chat history with an `Attached [#image N] <path>` label and image preview.

## Product behavior notes

- Placeholder format is `[#image 1]`, `[#image 2]`, etc. Keep the space after `image`.
- Attach each referenced placeholder at most once per submitted message, ordered by first placeholder occurrence in the text.
- If a placeholder is deleted before submit, do not attach that image.
- If a placeholder is duplicated in text, attach the image once.
- Read image payloads immediately on paste/drop/clipboard; later file deletion should not matter.
- Attachment state is in-memory and resets on session lifecycle changes.
- Supported image formats: PNG, JPEG, WebP, GIF. Detect by magic bytes, not extension only.
- Max image file size is 10 MB.
- Leave unsupported/non-image paste text unchanged. Warn only for oversized images.
- Do not add LLM-callable tools; the extension should work automatically except for the explicit `/paster-paste-image` convenience command.

## Important files

- `src/index.ts` — extension entrypoint and event wiring.
- `src/config.ts` — public configuration types/defaults.
- `src/editor.ts` — custom editor integration, paste handling, clipboard insertion, atomic placeholder deletion.
- `src/image-utils.ts` — image path parsing, MIME detection, image loading, and image-content generation.
- `src/preview.ts` — submitted-image and cursor-preview render components.
- `src/store.ts` — in-memory attachment store and placeholder allocation.
- `src/clipboard.ts` — macOS clipboard image reader.
- `src/terminal-input.ts` — fallback terminal input handler used when the custom editor is disabled.
- `tests/` — Node test-runner tests executed with Node's built-in TypeScript stripping.
- `package.json` — package metadata, npm publishing metadata, peer dependencies, and `pi.extensions` manifest.
- `docs/preview.png` — package gallery/README preview image.
- `README.md` — user-facing docs.

## How to run it

Install dependencies:

```bash
pnpm install
```

Run checks:

```bash
pnpm run typecheck
pnpm test
pnpm run check
```

There is no bundled build step; pi loads the TypeScript extension source from `src/index.ts`.

Try the extension locally in pi:

```bash
pi -e .
```

## Implementation notes

- The extension entrypoint is `src/index.ts` and must default-export a function receiving `ExtensionAPI`.
- Also export `createPaster(config)` so users can configure the extension from a wrapper extension.
- Pi discovers this package through `package.json`:

  ```json
  {
    "pi": {
      "extensions": ["./src/index.ts"]
    }
  }
  ```

- Keep pi core packages used by the extension as peer dependencies for consumers:
  - `@earendil-works/pi-coding-agent`
  - `@earendil-works/pi-tui`
- Use `CustomEditor` for editor customization so pi app keybindings continue to work.
- If `customEditor.enabled` is false, do not install the custom editor; use the terminal input fallback for bracketed paste/drop paths.
- Avoid private pi editor internals. The optional atomic placeholder deletion path is experimental because it uses private editor state.
- Use `pi.on("input", ...)` to transform submitted text and attach image content.
- Keep image parsing and MIME detection helper functions small and unit-testable.
- Real images must not render inside pi-tui overlays; overlay compositing can corrupt terminal image escape sequences. Use normal widget/custom render flow instead.

## Configuration contract

Default config avoids replacing pi's editor and leaves shortcuts opt-in:

```ts
createPaster({
  clipboardShortcuts: [],
  customEditor: {
    enabled: false,
    showImagePreview: true,
    deletePlaceholderAsBlock: false,
    replaceExistingEditor: false,
  },
});
```

Behavior:

- `clipboardShortcuts` registers optional shortcuts for the same flow as `/paster-paste-image`.
- `customEditor.enabled: false` keeps pi's default editor and uses terminal paste/drop handling for image paths.
- `customEditor.enabled: true` enables cursor previews and editor-level paste handling.
- `customEditor.showImagePreview: false` keeps the custom editor but disables the above-editor cursor image preview.
- `customEditor.deletePlaceholderAsBlock: true` makes placeholders delete atomically, but uses pi editor internals and is experimental.
- `customEditor.replaceExistingEditor: false` falls back to non-editor paste handling if another custom editor is already active.

## Publishing notes

- npm package name: `pi-paster`.
- Keep `keywords` including `pi-package` so the pi package gallery can discover it.
- Keep `pi.image` pointing at the published preview image, e.g. `https://unpkg.com/pi-paster@<version>/docs/preview.png`.
- Before publishing, run:

```bash
pnpm run check
npm pack --dry-run
```

- Publish with:

```bash
npm publish
```

NPM may require browser/OTP authentication.

## Testing guidance

- Put fast unit tests under `tests/` and use Node's built-in `node:test` plus `node:assert/strict`.
- Prefer unit tests for parsing, path resolution, MIME detection, attachment ordering, and placeholder matching.
- Use manual pi testing for TUI behavior that is difficult to automate:
  - normal text paste still works
  - image path paste becomes `[#image N]`
  - multiple image paths preserve order
  - deleting a placeholder prevents attachment
  - pi keybindings still work
  - cursor preview appears only when the cursor is inside the placeholder
  - clipboard image paste works via pi's image paste keybinding on macOS

Before handing off changes, run:

```bash
pnpm run check
```

If implementation changed publish metadata, also run:

```bash
npm pack --dry-run
```

## Documentation references

When working on pi extension APIs, consult the local pi docs first:

- Extensions: local `@earendil-works/pi-coding-agent` docs, `docs/extensions.md`
- TUI/custom editor APIs: local `@earendil-works/pi-coding-agent` docs, `docs/tui.md`
- Package manifests: local `@earendil-works/pi-coding-agent` docs, `docs/packages.md`
- Extension examples: local `@earendil-works/pi-coding-agent` examples, `examples/extensions/`

This fork intentionally does not use Vite+.
