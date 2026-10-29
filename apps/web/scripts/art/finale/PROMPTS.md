# IMG-10 / IMG-11 prompt record

Generator: built-in `image_gen.imagegen`, transparent_background=true, 1536×1024 PNG. No API fallback. Generated 2026-10-29. All references were inspected first. No person was generated.

## IMG-10 first pass

Reference inputs: `public/site/plate-night-hill.webp` (painting style), `hero-night-cutout.webp` (lighting only), `scenes/sit-cutout.webp` (pose and seating geometry only).

Create a transparent night meadow foreground in the hero's exact painterly anime style: dark plum-black craggy rocks, graceful grasses rim-lit hot pink, white and pale pink five-petal flowers with yellow centers and fine sparkle dust. Low irregular ridge, transparent above, no sky or moon. A broad flat-topped boulder at 62% across, its sitting surface near 50% down, nearly horizontal clean front lip, broad enough for the sitting girl's spread hands, vertical front below dangling legs, flowers around its base, clear seat. Quiet opaque #120A10 ground at the bottom. Compose in the central 704px of a 1536×1024 image for a 2400×1100 crop. No people, text, letters, logos, watermark or signature.

First output: `/Users/aniruddhdubge/.codex/generated_images/01a18762-e3f2-73e0-87f7-1f499abeabc1/exec-27411d40-8f4b-4238-a51d-ad134373f154.png`. Rejected composition: seat was too far right and ridge too steep.

## IMG-10 selected revision

Edit the first pass, with the original night hill as reference. Preserve the exact detailed painting style, palette, flowers, craggy stones and pink night lighting. Center the sitting boulder at x=62%, top lip near y=50%; broad nearly horizontal seat from x=50% to 74%, very slight perspective, front face dropping about 16% of image height. Low irregular flower/grass ridge between y=43% and 53%. No plants on seat. True clear alpha above every blade and flower; no pink haze, sky, moon or background fill. Hot-pink rim confined to blades and flower petals. Below y=75%, settle into opaque #120A10. Landscape 1536×1024. No people or text.

Selected original: `exec-37217bb2-a9e2-4a06-b2fc-cd45119c2108.png` in the same generated-images directory. Archived losslessly as `masters/meadow-night-generated.png`.

## IMG-11 selected daylight edit

Edit the selected night meadow. Reference inputs: selected night PNG (composition), `plate-day-hill.webp` (daylight palette and brushwork), `hero-cutout.webp` (daylight character-world lighting only, never paint her).

Keep the exact same stone, flower, grass, ridge and seat composition. Change only lighting and palette: lavender-grey craggy rocks, fresh warm yellow-green grass, white and pale pink flowers with yellow centers, gentle upper-left morning sunlight, pale golden rim highlights. Preserve the same broad empty sitting surface near 62% across, near 50% down, and the alpha silhouette. No sky or sun disk. Below y=72%, transition gently into quiet opaque #FFF1F6. Landscape 1536×1024. No people or text.

Selected original: `exec-0a40b61b-46df-4958-8b4e-d0e910deda11.png` in the same generated-images directory. Archived as `masters/meadow-day-generated.png`.

House style appended to all prompts: Painterly anime background art, soft cel shading, painted (not airbrushed) grass, glowing highlights with fine sparkle dust; match reference palette, brushwork, line weight and lighting exactly. No text, letters, logos, watermark, signature or people.

## Deterministic finishing

Real-ESRGAN x4plus_anime_6B → ×2 intermediate with original alpha resampled separately → crop `(0,320,3072,1728)` → 2400×1100. Remove isolated alpha values ≤2 from the meadow only (never trophy or sitter); smoothstep blend y710–900 into the exact specified ground. Bottom y900–1099 is flat and opaque. Lossless WebP masters/fallbacks preserve that exact ground. AVIF q60 introduces a measured one-unit RGB conversion difference; see MANIFEST.md.
