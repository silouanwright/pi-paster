import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  detectImageMimeType,
  replaceImagePathsInText,
  shellUnescape,
  tokenizePathLikeText,
} from "../src/image-utils.ts";
import { AttachmentStore } from "../src/store.ts";
import type { LoadImageResult } from "../src/types.ts";

describe("image utilities", () => {
  test("detects supported image MIME types by magic bytes", () => {
    assert.equal(
      detectImageMimeType(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
      "image/png",
    );
    assert.equal(detectImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
    assert.equal(
      detectImageMimeType(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])),
      "image/gif",
    );
    assert.equal(
      detectImageMimeType(
        Uint8Array.from([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        ]),
      ),
      "image/webp",
    );
    assert.equal(detectImageMimeType(Uint8Array.from([0x00, 0x01, 0x02])), undefined);
  });

  test("tokenizes quoted and shell-escaped path-like text", () => {
    const tokens = tokenizePathLikeText("'./foo bar.png' ./baz\\ qux.jpg not-a-path ~/shot.png");

    assert.deepEqual(tokens.map((token) => token.value), [
      "./foo bar.png",
      "./baz qux.jpg",
      "~/shot.png",
    ]);
    assert.equal(shellUnescape("./baz\\ qux.jpg"), "./baz qux.jpg");
  });

  test("replaces accepted image paths with placeholders and preserves rejected text", () => {
    const store = new AttachmentStore();
    const rejected: string[] = [];
    const loadImage = (path: string): LoadImageResult => {
      if (path.includes("large")) return { ok: false, reason: "too-large", path };
      return {
        ok: true,
        image: {
          originalPath: path,
          mimeType: "image/png",
          data: Buffer.from(path).toString("base64"),
        },
      };
    };

    const result = replaceImagePathsInText("see './foo bar.png' and ./large.png", {
      cwd: "/tmp",
      store,
      loadImage,
      onReject: (failure) => rejected.push(`${failure.reason}:${failure.path}`),
    });

    assert.equal(result.text, "see [#image 1] and ./large.png");
    assert.equal(result.replaced, 1);
    assert.deepEqual(
      result.accepted.map((attachment) => attachment.placeholder),
      ["[#image 1]"],
    );
    assert.deepEqual(rejected, ["too-large:./large.png"]);
  });
});
