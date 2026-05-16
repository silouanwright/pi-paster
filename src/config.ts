export interface PasterConfig {
  /**
   * Keyboard shortcuts that read a clipboard image and insert a paster placeholder.
   * Set to false or [] to disable shortcut registration.
   */
  clipboardShortcuts?: string | string[] | false;
  customEditor?: {
    /** Replace pi's input editor to enable cursor-preview and editor-level paste handling. */
    enabled?: boolean;
    /** Show an image preview above the input while the cursor is inside an image placeholder. */
    showImagePreview?: boolean;
    /**
     * Treat image placeholders as atomic blocks for backspace/delete.
     * This uses pi editor internals and is disabled by default for update resilience.
     */
    deletePlaceholderAsBlock?: boolean;
    /** Replace another extension's custom editor if one is already installed. */
    replaceExistingEditor?: boolean;
  };
}

export interface ResolvedPasterConfig {
  clipboardShortcuts: string[];
  customEditor: {
    enabled: boolean;
    showImagePreview: boolean;
    deletePlaceholderAsBlock: boolean;
    replaceExistingEditor: boolean;
  };
}

export const DEFAULT_PASTER_CONFIG: ResolvedPasterConfig = {
  clipboardShortcuts: ["alt+v"],
  customEditor: {
    enabled: false,
    showImagePreview: true,
    deletePlaceholderAsBlock: false,
    replaceExistingEditor: false,
  },
};

function normalizeShortcuts(shortcuts: PasterConfig["clipboardShortcuts"]): string[] {
  if (shortcuts === false) return [];
  if (shortcuts === undefined) return DEFAULT_PASTER_CONFIG.clipboardShortcuts;
  return Array.isArray(shortcuts) ? shortcuts : [shortcuts];
}

export function resolvePasterConfig(config: PasterConfig = {}): ResolvedPasterConfig {
  return {
    clipboardShortcuts: normalizeShortcuts(config.clipboardShortcuts),
    customEditor: {
      enabled: config.customEditor?.enabled ?? DEFAULT_PASTER_CONFIG.customEditor.enabled,
      showImagePreview:
        config.customEditor?.showImagePreview ??
        DEFAULT_PASTER_CONFIG.customEditor.showImagePreview,
      deletePlaceholderAsBlock:
        config.customEditor?.deletePlaceholderAsBlock ??
        DEFAULT_PASTER_CONFIG.customEditor.deletePlaceholderAsBlock,
      replaceExistingEditor:
        config.customEditor?.replaceExistingEditor ??
        DEFAULT_PASTER_CONFIG.customEditor.replaceExistingEditor,
    },
  };
}
