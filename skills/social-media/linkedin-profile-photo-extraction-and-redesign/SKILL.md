---
name: linkedin-profile-photo-extraction-and-redesign
description: Extract the real profile photo from a LinkedIn screenshot when the public page shows a placeholder, then create a more professional replacement while preserving the subject's actual facial features.
version: 1.0.0
author: Hermes
license: MIT
metadata:
  hermes:
    tags: [linkedin, profile-photo, screenshot, image-editing, vision, social-media]
---

# LinkedIn Profile Photo Extraction and Redesign

Use when:
- The user sends a LinkedIn URL and wants a new profile image.
- The public or guest LinkedIn page does not expose the real profile photo.
- The user shares an app screenshot that contains the actual profile image.
- The user wants a more professional version while preserving the person's real facial features.

## Key Lesson

Do not trust the guest or public LinkedIn page as the source of truth for the profile photo.

Public LinkedIn pages can expose a generic placeholder or static avatar asset instead of the person's actual photo. If the user also provided a screenshot from the LinkedIn app or a logged-in view, treat that screenshot as the likely source of truth.

## Workflow

### 1. Check The Public Page, Then Verify

Open the LinkedIn URL and inspect the top card.

Look for signs the avatar is fake or generic:
- Static LinkedIn asset URL.
- Generic silhouette or avatar styling.
- Vision says no real face is visible.

Useful tools:
- `browser_navigate`
- `browser_snapshot(full=true)`
- `browser_get_images`
- `browser_vision`

If the public page shows a placeholder, stop using it as the facial reference.

### 2. Switch To The Screenshot As Source Of Truth

If the user supplied a screenshot, analyze it with vision.

Ask vision for:
- Approximate location of the circular avatar.
- Rough center x/y.
- Rough radius or bounding box.
- Whether the full head and facial features are visible.

This is especially useful when the screenshot is a full phone screen and the avatar is small.

### 3. Crop Iteratively

Use the screenshot dimensions and the vision-estimated center/radius to make a first crop.

Then verify the crop with vision:
- Is the whole head visible?
- Are the eyes present?
- Is the circular avatar fully included?
- Are UI elements still intruding?

Expect 2-4 iterations. A typical path is: initial crop, move/widen after vision feedback, then final crop containing the full circular avatar.

### 4. Isolate The Avatar

Once the full circular avatar is captured:
- Crop inward to remove the LinkedIn ring or surrounding UI.
- If needed, use a soft mask to remove a plain background around the face.
- Save both the square avatar crop and an isolated cutout for compositing.

### 5. Choose Redesign Method

Use prompt-only generation when there is no reliable photo reference or likeness is not required.

Use composite-based redesign when the user explicitly wants the real facial features preserved and a usable screenshot/avatar crop exists. For preserving a real person, prefer compositing over pure generation.

### 6. Generate A Suitable Background

For serious tech leadership, generate a restrained office background:
- Modern tech office.
- Neutral blue/gray palette.
- Soft daylight.
- No neon, party vibe, logos, text, or extra people.
- Suitable for a LinkedIn portrait background.

Avoid cyberpunk, purple neon portraits, nightlife aesthetics, and over-stylized executive glamour.

### 7. Composite Carefully

When compositing the real face onto the new background:
- Keep the subject large enough for LinkedIn thumbnail use.
- Use a subtle background blur.
- Use minimal shadowing.
- Avoid strong halos around the head.
- Avoid visible remnants of the original background.
- Keep lighting and sharpness reasonably consistent.

Vision often catches pasted-on artifacts: halo around scalp/ears, artificial outline, poor shoulder cutout, and mismatch in lighting or sharpness.

### 8. Validate Each Candidate

After each composite, ask vision:
- Does it look like a serious LinkedIn profile photo?
- Is it office/tech and not nightlife/trance?
- Are there halos, cutout artifacts, white edges, or UI remnants?
- Does it feel suitable for an engineering or operations leader?

Use the feedback to iterate before delivery.

### 9. Explain The Correction

When a previous attempt used the wrong reference source, say it clearly:
- The public LinkedIn page showed a placeholder.
- The screenshot contained the real profile photo.
- The new result is based on the real face, not a generic persona.

## Practical Heuristics

- If `browser_get_images()` shows a `static.licdn.com` avatar asset for the subject, assume placeholder until proven otherwise.
- If the screenshot is around phone resolution, ask vision for center/radius before manual cropping.
- A usable avatar crop does not need full shoulders; full head plus face is enough for reference.
- For LinkedIn, usefulness at thumbnail size matters more than cinematic realism.
- A good practical result has a clear face, neutral office background, no obvious neon/party styling, and minimal visible cutout artifacts.

## Output Checklist

Before final delivery, verify:
- Real facial features came from the actual profile screenshot.
- No placeholder asset was used as the source face.
- No obvious trance/nightlife aesthetic remains.
- Background reads as office/tech.
- No text/logos appear in the generated image.
- Face remains recognizable.
- Artifacts are acceptable for LinkedIn-sized display.

## When To Ask For A Better Source Image

Ask for a better headshot if:
- The screenshot avatar is too small or blurry.
- The face is partially blocked.
- The crop cannot avoid UI contamination.
- The user wants a highly polished studio-grade result rather than a practical LinkedIn-ready one.

Suggested phrasing:
- "יש לי בסיס טוב מהצילום, אבל אם אתה רוצה גרסה הרבה יותר מדויקת ונקייה, שלח headshot ברור."
