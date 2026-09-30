# Bone Atlas — BIO 141

A free student atlas with a rotatable human skeleton, selectable bones, 142 instructor-approved point landmarks and the course's key joints. The student edition provides Explore, ungraded Recall and Quiz me. It contains no instructor editing controls, account requirement, score collection, or server dependency.

## For students

- **Rotate**: drag or use the arrow keys. **Zoom**: scroll, pinch or + / −. **Pan**: right-drag or two-finger drag. **Double-click** (double-tap) a spot to rotate around it; this does not change the selection.
- **Click a bone** to select it. Paired bones are shown one side at a time: the side you clicked is highlighted and becomes the centre of rotation. Use **Side shown: Right / Left** to switch sides; the view is mirrored with it, so the other bone is seen the same way (a lateral view stays lateral). *Isolate* shows only the selected side.
- Selecting a structure keeps the current view when the structure can be seen from it; otherwise the view turns to a side from which it can. Structures that no view shows (inside the skull, deep in a joint, the sacral canal) are shown with the rest of the skeleton see-through. Whenever bone hides the selected landmark from the current view (the vertebral foramen seen from above), a faint copy of its marker shows through.
- **Joints**: choose *Joints* to see where bones meet. The articular surfaces are shaded and labelled, and dashed lines join the surfaces that meet. *Pull the bones apart* slides one bone away so you can see the facing surfaces; *Fade the other bones* keeps the rest of the skeleton see-through.
- **Recall**: name the highlighted landmark, then reveal the answer.
- **Quiz me**: pick sections and question types. *Find it* (click it on the model; either side counts), *Name it* (type it, with small misspellings and common alternative names accepted, or choose from four), *Articulations* (which surfaces meet at each joint). Find it starts on the named bone. Landmarks inside the cranium open the skull base; those hidden inside a joint (the fovea, the acetabulum, the sacrum's auricular surface) show the partner bone see-through. A landmark marked on one vertebra or rib is asked on that one, shown highlighted. Long features (sutures, borders, crests, the supraorbital margin, the linea aspera) count along their length, and a click on the far face of a thin plate (the back of the scapula for the subscapular fossa) does not count. Leaving the quiz for Explore or Recall keeps it where it was. Missed and unfinished questions are listed for review and can be retried. Only the quiz settings are stored, in the student's own browser.

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

This recomputes every surface point and records the mesh it sits on. Points are stored on the right side; the atlas mirrors them for the left. It also regenerates `lib/landmark-meshes.json`, the bone mesh under each landmark on each side (e.g. which vertebra or rib), found by nearest surface, and the landmark's outward surface normal; the atlas uses them to paint and isolate the right bone, and Quiz me to tell the two faces of a thin plate apart.

`lib/find-extents.json` lists, for long or broad landmarks, where a *Find it* click counts beyond the point itself: a line of points along a suture, border, margin, crest or the linea aspera, or one point and a radius for the femoral head and the fossae (right side, metres). Update it if such a landmark moves. Then check Quiz me against the data and the model:

```sh
node tools/check-quiz.mjs
```

It checks that every name and accepted alternative (catalog and joint `aka`) is right for its own structure and never for another, that Name it and Articulations never offer two right answers, and that every Find-it question can be clicked from outside the body and scores clicks on the right structure (and not on neighbouring landmarks or joints). `--verbose` lists every prompt. It runs in Node through the project's Vite and three.js; no browser is needed.

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
