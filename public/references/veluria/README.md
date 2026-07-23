# Veluria reference images

Drop **3–6 real Veluria "after" skin photos** in this folder. The transform API
(`app/api/transform/route.ts` via `lib/references.ts`) sends them to GPT Image 2
as reference images so generated previews match the *real* Veluria result —
better, more credible before/afters with **no model training**.

If this folder is empty, the app still works and falls back to a text-only
prompt automatically.

## File rules
- Formats: `.jpg`, `.jpeg`, `.png`, `.webp`
- Max **6** files are used (gpt-image-2 allows 16 images per call; the user's
  selfie takes one slot). Extra files beyond 6 are ignored (alphabetical order).
- Keep each file reasonably small (≤ ~2 MB).

## What makes a GOOD reference (important)
- **Skin-only crops** — a close patch of cheek / forehead / jaw showing great
  post-Veluria texture, tone, hydration and glow. **Do NOT use full faces.**
  Full faces make the AI blend the patient's identity into other users' results.
- Even, natural lighting; in focus; true-to-life colour (no heavy filters).
- A **diverse range of skin tones** so results look right for every visitor.
- Show the *target quality*, not a dramatic/unrealistic transformation.

## Compliance (must do before adding photos)
- You must hold **written patient consent** that explicitly covers using their
  images with **AI / third-party processors** (these images are sent to OpenAI).
- Cropping to skin-only patches reduces — but does not eliminate — privacy
  exposure. Prefer non-identifiable crops.

After adding or changing files here, **restart the dev server** (the file list
is cached on first use).
