import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";
import { readClipboardImage } from "./clipboard.ts";
import { type PasterConfig, resolvePasterConfig } from "./config.ts";
import { PasterEditor } from "./editor.ts";
import { imagesForText } from "./image-utils.ts";
import { CursorImagePreviewWidget, ImagePreviewMessage } from "./preview.ts";
import { AttachmentStore } from "./store.ts";
import { createImagePasteTerminalInputHandler } from "./terminal-input.ts";
import type { ImageAttachment, PasterPreviewItem, PasterPreviewDetails } from "./types.ts";

export * from "./clipboard.ts";
export * from "./config.ts";
export * from "./editor.ts";
export * from "./image-utils.ts";
export * from "./preview.ts";
export * from "./store.ts";
export * from "./terminal-input.ts";
export * from "./types.ts";

export function createPaster(config: PasterConfig = {}): (pi: ExtensionAPI) => void {
  return (pi) => paster(pi, config);
}

function toPreviewItem(attachment: ImageAttachment): PasterPreviewItem {
  return {
    placeholder: attachment.placeholder,
    originalPath: attachment.originalPath,
    mimeType: attachment.mimeType,
    data: attachment.data,
    dimensions: attachment.dimensions,
  };
}

export default function paster(pi: ExtensionAPI, config: PasterConfig = {}): void {
  const resolvedConfig = resolvePasterConfig(config);
  const store = new AttachmentStore();
  let pendingPreview: ImageAttachment[] = [];
  let activeEditor: PasterEditor | undefined;
  let unsubscribeTerminalInput: (() => void) | undefined;
  let restoreEditorComponent: (() => void) | undefined;

  const clearCursorPreview = (): void => {
    activeEditor?.clearCursorPreview();
    activeEditor = undefined;
  };

  const installTerminalInputHandler = (ctx: ExtensionContext | ExtensionCommandContext): void => {
    unsubscribeTerminalInput?.();
    unsubscribeTerminalInput = ctx.ui.onTerminalInput(
      createImagePasteTerminalInputHandler({
        cwd: ctx.cwd,
        store,
        notify: (message) => ctx.ui.notify(message, "warning"),
      }),
    );
  };

  const pasteClipboardImage = (ctx: ExtensionContext | ExtensionCommandContext): void => {
    if (!ctx.hasUI) return;

    const result = readClipboardImage();
    if (!result.ok) {
      if (result.reason === "empty") {
        ctx.ui.notify("paster: no image found in the clipboard", "warning");
      } else if (result.reason !== "unsupported-platform") {
        ctx.ui.notify("paster: clipboard image could not be attached", "warning");
      }
      return;
    }

    const attachment = store.add(result.image);
    ctx.ui.pasteToEditor(attachment.placeholder);
    ctx.ui.notify(`paster: attached ${attachment.placeholder}`, "info");
  };

  pi.registerMessageRenderer<PasterPreviewDetails>("paster-preview", (message, _options, theme) => {
    const attachments = message.details?.attachments ?? [];
    if (attachments.length === 0) return undefined;
    return new ImagePreviewMessage(attachments, {
      fallbackColor: (text) => theme.fg("muted", text),
    });
  });

  pi.registerCommand("paster-paste-image", {
    description: "Attach a clipboard image to the current draft using a paster placeholder",
    handler: async (_args, ctx) => pasteClipboardImage(ctx),
  });

  for (const shortcut of resolvedConfig.clipboardShortcuts) {
    pi.registerShortcut(shortcut as KeyId, {
      description: "Attach clipboard image to draft using paster",
      handler: (ctx) => pasteClipboardImage(ctx),
    });
  }

  pi.on("session_start", (_event, ctx) => {
    store.clear();
    pendingPreview = [];
    if (!ctx.hasUI) return;

    unsubscribeTerminalInput?.();
    unsubscribeTerminalInput = undefined;
    restoreEditorComponent?.();
    restoreEditorComponent = undefined;
    clearCursorPreview();
    ctx.ui.setWidget("paster-cursor-preview", undefined, { placement: "aboveEditor" });

    if (!resolvedConfig.customEditor.enabled) {
      installTerminalInputHandler(ctx);
      return;
    }

    const previousEditorComponent = ctx.ui.getEditorComponent();
    if (previousEditorComponent && !resolvedConfig.customEditor.replaceExistingEditor) {
      ctx.ui.notify(
        "paster: another custom editor is active; using paste-path fallback instead",
        "warning",
      );
      installTerminalInputHandler(ctx);
      return;
    }

    restoreEditorComponent = () => ctx.ui.setEditorComponent(previousEditorComponent);
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      activeEditor = new PasterEditor(tui, theme, keybindings, {
        cwd: ctx.cwd,
        store,
        notify: (message) => ctx.ui.notify(message, "warning"),
        deletePlaceholderAsBlock: resolvedConfig.customEditor.deletePlaceholderAsBlock,
        pasteClipboardImage: () => {
          const result = readClipboardImage();
          if (!result.ok) {
            if (result.reason !== "empty" && result.reason !== "unsupported-platform") {
              ctx.ui.notify("paster: clipboard image could not be attached", "warning");
            }
            return undefined;
          }
          return store.add(result.image);
        },
        setCursorPreview: (attachment) => {
          if (!resolvedConfig.customEditor.showImagePreview) return;
          ctx.ui.setWidget(
            "paster-cursor-preview",
            attachment
              ? (_tui, widgetTheme) =>
                  new CursorImagePreviewWidget(attachment, {
                    title: (text) => widgetTheme.fg("accent", text),
                    muted: (text) => widgetTheme.fg("muted", text),
                    accent: (text) => widgetTheme.fg("accent", text),
                  })
              : undefined,
            { placement: "aboveEditor" },
          );
        },
      });
      return activeEditor;
    });
  });

  pi.on("session_shutdown", (_event, ctx) => {
    pendingPreview = [];
    if (ctx.hasUI) {
      unsubscribeTerminalInput?.();
      unsubscribeTerminalInput = undefined;
      clearCursorPreview();
      ctx.ui.setWidget("paster-cursor-preview", undefined, { placement: "aboveEditor" });
      restoreEditorComponent?.();
      restoreEditorComponent = undefined;
    }
    store.clear();
  });

  pi.on("input", (event, ctx) => {
    if (event.source === "extension") return { action: "continue" as const };
    if (ctx.hasUI) {
      activeEditor?.clearCursorPreview();
    }

    const attachments = store.matchingPlaceholders(event.text);
    if (attachments.length === 0) return { action: "continue" as const };
    pendingPreview = attachments;

    return {
      action: "transform" as const,
      text: event.text,
      images: imagesForText(store, event.text, event.images),
    };
  });

  pi.on("before_agent_start", () => {
    if (pendingPreview.length === 0) return;
    const attachments = pendingPreview.map(toPreviewItem);
    pendingPreview = [];
    return {
      message: {
        customType: "paster-preview",
        content: "",
        display: true,
        details: { attachments },
      },
    };
  });
}
