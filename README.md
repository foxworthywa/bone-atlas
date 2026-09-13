# Bone Atlas — BIO 141

A free student atlas with a rotatable human skeleton, selectable bones and 142 instructor-approved point landmarks. The student edition provides Explore and ungraded Recall. It contains no instructor editing controls, account requirement, score collection, or server dependency.

## Publish with GitHub Pages

The ready-to-publish website is in `docs/`.

1. Create a public repository named `bone-atlas` in your GitHub account and upload this project.
2. In **Settings → Pages**, choose **Deploy from a branch**, then **main** and **/docs**.
3. Save and wait for GitHub's Pages deployment to finish. Use the website address displayed in those settings in your LMS.

Keep the repository and GitHub account available to keep serving the link. The complete source and built website can also be moved to another static host.

## Update the student atlas

The separate instructor atlas remains the place to review labels and export corrections. Updates to `lib/published-annotations.json` should include only approved landmarks, with retired targets also removed from `lib/catalog.json`. Rebuild and commit the updated source and `docs/` together.

With Node.js 22.13 or later and pnpm installed:

```sh
pnpm install --frozen-lockfile
pnpm build
```

For local development, run `pnpm dev`. Vite serves the atlas at the address printed in the terminal. The production build uses relative asset URLs so the model loads under a GitHub Pages repository path or another static host.

## Model and teaching scope

Anatomical geometry is adapted from Z-Anatomy exports; see [model credits](public/credits.txt). The model includes 222 bone/cartilage meshes. The student list contains 232 selectable bone/group and approved landmark entries.

A point locates a feature; it does not trace its entire boundary. Recall uses the course instructor's approved representative locations. The frontal sinus and interosseous membranes are excluded from the student list because this model does not adequately depict them. Composite joint, hard palate and subpubic angle targets and the other instructor-retired labels are excluded. The cribriform plate entry explains olfactory foramina.

## License

Anatomical assets and associated model annotations are CC BY-SA 4.0, with upstream credits retained in `public/credits.txt`. Application code is provided under the MIT license in `LICENSE.md`. Bundled dependencies retain their own licenses.
