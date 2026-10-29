# IMG-05–08 generation record

Generated with the built-in image generation tool, real transparent backgrounds, attached local reference files. Accepted raw RGBA outputs are preserved in `sources/`. Original paintings are retained alongside the rounded fall refinements.

House style: painterly anime background art; soft cel shading; painted, not airbrushed, clouds; glowing highlights with fine sparkle dust; match attached reference palette, brushwork, line weight and lighting. No text, letters, logos, watermark, signature, people, birds, buildings, moon or sun disk.

## IMG-05 / `sources/rise-night.png`

Initial references: `public/site/plate-night-sky.webp` and `public/site/sky-night.webp`. The first generation had tall clouds at the sides, so a second generation used that draft and the night plate to make the composition shallow enough to crop.

Accepted refinement prompt:

> Refine image 1 for a web seam. Preserve exactly its beautiful detailed painted anime cloud brushwork, pink rim light, plum shadows and varied tiny sparkling rims. IMPORTANT COMPOSITION CHANGE: this must be a shallow panoramic cloud ribbon entirely in the BOTTOM 40% of a landscape 1536x1024 transparent canvas. All pixels above y=610 are fully transparent. Cloud tops vary subtly in height from y=620 to y=740, never a deep valley or tall side pillars. Clouds extend off both left and right edges. From y=840 toward bottom smoothly melt to an untextured flat solid pale pink #FFB3D1, fully opaque y=920 through1024. NO haze floating above the cloud silhouette, no black or pink sky. Rich painted billows occupy y=620..870 only. Varied billow scale, thin irregular wispy edges, small distant clouds and nearer billows. Night, lit hot pink from below. True alpha background, no baked checkerboard. NOT smooth balloon shapes or 3D render.

## IMG-06 / `sources/rise-day.png`

References: accepted IMG-05, `public/site/plate-day-sky.webp`, `public/site/sky-day.webp`.

> Image1 is exact cloud silhouette/composition reference, images2 and3 are DAY palette/brushwork references. Repaint image1's same shallow cloud bank in soft morning light. Bright white cloud tops, lavender-blue and pale pink shadows, upper-left sunlight, delicate irregular painted edges from day reference. Keep the same positions, height, scale, shallow valley, cloud family. Transparent above, no sky. Landscape1536x1024; cloud bank in BOTTOM40%, visible tops y620-740; all above y610 transparent. Clouds go off left/right edges. At y840 begin melting softly into smooth blush sea, fully flat untextured opaque #FFC6DC by y920 through bottom. Do not add a sun/moon, mountains, birds, buildings, people, petals, or new sparkles. No haze field above the silhouette. No grey/white checkerboard or baked background. Painterly anime background art, soft cel shading, painted (not airbrushed) clouds, match attached day reference palette brushwork line weight lighting exactly. No text letters logos watermark signature. Real RGBA alpha.

## IMG-07 / `sources/fall-night.png`

Initial references: IMG-05 and `public/site/plate-night-sky.webp`. A first fall draft was too tall and bright. Accepted refinement used that fall draft and accepted IMG-05.

> Refine image1 CLOUD FALL night, preserve same brushwork and colors. Need MUCH SHALLOWER cloud strip for panoramic website seam; no towering clouds. Landscape1536x1024 PNG. Occupy only top THIRD of the image, all pixels below y350 fully transparent. y0-80 must be SOLID FLAT #FFB3D1 pink. y80-150 smoothly blends to softly shaded rose cloud shoulders. y150-310 dark violet-plum hanging cloud undersides, gently varied lowest tips y270-340. Clouds go off both side edges. Delicate irregular tiny edge brushwork same as image2. No bright white rim outlining every lobe; use subdued rose bounce lighting on dark undersides. Do NOT paint any background or colored haze below the cloud silhouette: pure true alpha. Keep one or two tiny pale-pink glints. Painted anime background, soft cel shading, intricate layered clouds, no text no letters no logos no moon no people. This is a narrow shallow ceiling fringe, not a large deep mass.

## IMG-08 / `sources/fall-day.png`

References: accepted IMG-07, accepted IMG-06, `public/site/plate-day-sky.webp`.

> Repaint image1 same shallow ceiling of clouds with same silhouette and scale in daylight. Image2 is matching day cloud family and image3 palette/brushwork reference. Top band of 1536x1024 landscape: y0..80 perfectly flat opaque #FFC6DC blush; y80..150 gently becomes pale pink cloud; then hanging cloud undersides in lavender-grey and pale pink, NO glowing electric hot pink. Shadows muted periwinkle-grey, edges softly lit by warm morning light. Bottom edges thin into full alpha transparency, entire area below y420 fully transparent. Cloud mass across whole width and off both side edges. Brushwork intricate and organic, layered small distant wisps and large near billows. Real RGBA background no sky, no colored background haze, no checkerboard/white fringe. No sparkles in day. No sun moon birds buildings mountains grass people text letters logos watermark. Painterly anime background art, soft cel shading, painted not airbrushed clouds; match day reference palette brushwork and lighting exactly.

Generation is probabilistic: actual painted extents differ slightly from prompted coordinates. The crop boxes, foundation blends, and final solid-band locations are enforced by `build.py`, not assumed from the prompts.

## Fall underside refinement / 2026-10-29

Built-in `image_gen` edits, true transparent output. Raw accepted images are `sources/fall-night-rounded.png` (1920×819) and `sources/fall-day-rounded.png` (2103×748). The edit tool did not retain the flat upper band, so the pipeline keeps the original painting through y=290, blends into the repaint by y=380, and copies y=0–127 exactly from the original master. Generated alpha is rebuilt with a 100px rounded, pigment-modulated dissolve, retaining 8-bit alpha. Both front and back use the same refined master, with an 80px feather at the depth split.

Night prompt (reference: the existing fall-night master):

> Use case: precise-object-edit. Edit this exact wide panoramic painted cloud seam, preserving the same night pink/plum lighting, rich anime brushwork, highlights, scale, and composition. Keep 2400x640 dimensions. KEEP THE TOP HALF IDENTICAL, including the full-width perfectly flat #FFB3D1 top band at y=0..127. Repaint ONLY the lowest cloud undersides: replace the jagged fractal/star/cross-shaped cutouts along the bottom silhouette with naturally rounded overlapping soft painted billows, with varied smaller wisps, gradually thinning vapor and feathered transparency over roughly 60–120 pixels. Subdued rose bounce light on plum shadows. The lower edge should dissolve beautifully into genuine full alpha transparency, with soft edges everywhere, no punched-out notches, no hard alpha cutouts, no sharp triangular or star holes, no white rim, no checkerboard, no background color, no new stars. Keep all cloud detail above the lower region and preserve large cloud masses. Leave bottom 50 pixels entirely transparent. This is a transparent web asset, no labels or text.

Day prompt (reference 1: existing day master; reference 2: rounded night output):

> Use case: precise-object-edit. Image 1 is the DAY cloud seam edit target. Image 2 is a supporting reference for newly rounded bottom billows only, NOT color. Repaint image 1's lower cloud undersides with soft rounded overlapping billows and gentle wisps like image2 instead of jagged cross/star/cutout holes. Retain image1 pale lavender-periwinkle shadows, warm pink morning bounce and delicate painted anime brushwork. Softly dissolve the entire bottom silhouette through 60–120px of feathered wispy alpha into true transparency. No hard cutout edges, no sawtooth or branching fractal silhouettes. Preserve the shallow panoramic composition, large cloud locations and scale. Keep the TOP HALF of image1 unchanged, especially its solid #FFC6DC band across the top 128 rows. Target 2400x640. Leave bottom 50px transparent. Clouds extend off both side edges. No stars, no background, no checkerboard, no text.

Visual iterations: a uniform distance feather was too airbrushed; the accepted version modulates it with two scales of painted vapor detail. All decoded fall layers were inspected individually, together, on black and blush, and in the rise/panel/fall journeys. Original previews are in `/tmp/art-seams/before/`.
