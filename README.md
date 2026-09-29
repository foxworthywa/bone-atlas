# Bone Atlas — BIO 141

A free student atlas with a rotatable human skeleton, selectable bones, 142 instructor-approved point landmarks and the course's key joints. The student edition provides Explore, ungraded Recall and Quiz me. It contains no instructor editing controls, account requirement, score collection, or server dependency.

## For students

- **Rotate**: drag or use the arrow keys. **Zoom**: scroll, pinch or + / −. **Pan**: right-drag or two-finger drag. **Double-click** a spot to rotate around it.
- **Click a bone** to select it. Paired bones are shown one side at a time: the side you clicked is highlighted and becomes the centre of rotation. Use **Side shown: Right / Left** to switch sides.
- **Joints**: choose *Joints* to see where bones meet. The articular surfaces are shaded and labelled, and dashed lines join the surfaces that meet. *Pull the bones apart* slides one bone away so you can see the facing surfaces; *Fade the other bones* keeps the rest of the skeleton see-through.
- **Recall**: name the highlighted landmark, then reveal the answer.
- **Quiz me**: pick sections and question types. *Find it* (click it on the model; either side counts), *Name it* (type it, with small misspellings accepted, or choose from four), *Articulations* (which surfaces meet at each joint). Missed questions can be retried. Only the quiz settings are stored, in the student's own browser.

A link can open a structure directly, e.g. `…/bone-atlas/#h-capitulum` or `#joint-hip@left`.

## Publish with GitHub Pages

The ready-to-publish website is in `docs/`.

1. Create a public repository named `bone-atlas` in your GitHub account and upload this project.
2. In **Settings → Pages**, choose **Deploy from a branch**, then **main** and **/docs**.
3. Save and wait for GitHub's Pages deployment to finish. Use the website address displayed in those settings in your LMS.

Keep the repository and GitHub account available to keep serving the link. The complete source and built website can also be moved to another static host.

## Update the student atlas

The separate instructor atlas remains the place to review labels and export corrections. Updates to `lib/published-annotations.json` should include only approved landmarks, with retired targets also removed from `lib/catalog.json`. Rebuild and commit the updated source and `docs/` together.

In `lib/catalog.json`, a landmark may list other accepted typed answers in `aka` (e.g. the English or plural form of a Latin label). `"paired": true` marks a paired landmark that lies within 8 mm of the midline (the nasal conchae, the palatine process and the horizontal plate), so it is still shown on the side chosen instead of being treated as a midline point.

Joints live in `lib/joints.json`. Each joint lists its articular surfaces. A surface either reuses an approved landmark (`"landmark"`) or, where the course list has no landmark for it, is placed on the closest spot of its bone to the partner surface (`"nearestTo"`) or to a fixed point (`"near"`, used where the approved landmark marks a different face of the feature, such as the front of the dens). The file also sets each joint's camera direction (`view`), how the bones slide apart (`move`, `apart`) and any bone that slides with the moving one (`carry`: the fibula travels with the tibia at the knee). After changing joints or landmarks, run:

```sh
node tools/derive-joints.mjs
```

This recomputes every surface point and records the mesh it sits on. Points are stored on the right side; the atlas mirrors them for the left. It also regenerates `lib/landmark-meshes.json`, the bone mesh under each landmark on each side (e.g. which vertebra or rib), found by nearest surface; the atlas uses it to paint and isolate the right bone.

With Node.js 22.13 or later and pnpm installed:

```sh
pnpm install --frozen-lockfile
pnpm build
```

For local development, run `pnpm dev`. Vite serves the atlas at the address printed in the terminal. The production build uses relative asset URLs so the model loads under a GitHub Pages repository path or another static host.

## Model and teaching scope

Anatomical geometry is adapted from Z-Anatomy exports; see [model credits](public/credits.txt). The model includes 222 bone/cartilage meshes. The student list contains selectable bones and bone groups, approved landmarks and joints.

A point locates a feature; it does not trace its entire boundary. Recall uses the course instructor's approved representative locations. The frontal sinus and interosseous membranes are excluded from the student list because this model does not adequately depict them. The earlier single-point joint markers, hard palate and subpubic angle targets and the other instructor-retired labels are excluded; joints are now shown as pairs of articular surfaces instead. The cribriform plate entry explains olfactory foramina.

## License

Anatomical assets and associated model annotations are CC BY-SA 4.0, with upstream credits retained in `public/credits.txt`. Application code is provided under the MIT license in `LICENSE.md`. Bundled dependencies retain their own licenses.
