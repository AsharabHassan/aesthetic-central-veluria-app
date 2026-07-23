import { readdir, readFile } from "fs/promises";
import path from "path";
import { toFile } from "openai";
import type { Uploadable } from "openai/uploads";

const REF_DIR = path.join(process.cwd(), "public", "references", "veluria");
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
// gpt-image-2 accepts up to 16 images per edit; the selfie takes one slot.
const MAX_REFERENCES = 6;

let cache: { count: number; load: () => Promise<Uploadable[]> } | null = null;

async function listReferenceFiles(): Promise<string[]> {
  try {
    const entries = await readdir(REF_DIR);
    return entries
      .filter((f) => ALLOWED.has(path.extname(f).toLowerCase()))
      .sort()
      .slice(0, MAX_REFERENCES)
      .map((f) => path.join(REF_DIR, f));
  } catch {
    // Folder missing or unreadable → no references, graceful fallback.
    return [];
  }
}

/**
 * Returns curated Veluria "after" reference images as Uploadable files for the
 * gpt-image-2 edit call. Returns [] when the folder is empty/missing so the
 * transform route can fall back to a text-only prompt.
 *
 * The file list is read once and cached; the bytes are re-read per call so a
 * fresh Uploadable is handed to the SDK each time (streams are single-use).
 */
export async function getReferenceImages(): Promise<Uploadable[]> {
  if (!cache) {
    const files = await listReferenceFiles();
    cache = {
      count: files.length,
      load: async () =>
        Promise.all(
          files.map(async (fp) => {
            const buf = await readFile(fp);
            const ext = path.extname(fp).toLowerCase();
            return toFile(buf, path.basename(fp), {
              type: MIME[ext] ?? "image/jpeg",
            });
          }),
        ),
    };
  }
  return cache.load();
}
