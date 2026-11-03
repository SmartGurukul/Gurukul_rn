# View module contract (mail.js, calendar.js, drive.js)

Each view is an ES module exporting:

    export async function mount(root, ctx, host) → { unmount?(), route?(hash) }

- `root`: the empty `<main id="view">` element to render into. Use `h()`/`clear()` from `./ui.js`;
  never innerHTML with user data (h() creates text nodes; `html:` attr only for trusted markup).
- `ctx`: `{ session, schoolId, school, profile, role, name }`. `session` is the LoginResponse
  (`ownerType` EMPLOYEE|STUDENT|PARENT…, `ownerId`, `role` ADMIN|TEACHER|STUDENT|PARENT|DRIVER).
  `profile` is the current `/auth/profiles` entry (`name`, `className`, `section`) or null.
- `host`: `{ toast(message, kind), navigate(hash) }`.
- All API calls go through `./api.js` (exports listed there). Errors are `ApiError` with `.message`
  safe to show. Render `spinner()` while loading, `errorBox(err, retry)` on failure, `empty()` when
  there is nothing.
- `route(hash)` is called on hash changes inside the same app (e.g. `#/mail/<conversationId>`).
- `unmount()` must clear timers and live subscriptions.
- Mobile: `.pane` layouts toggle `show-main` on the `.pane` element to show the detail; add a
  `.btn.ghost.back-btn` in the detail head that removes it.
- Styles: use classes from `../suite.css` (list, list-item, pane-*, card, chip, bubble, composer,
  cal-*, agenda, folders/folder/files/file, crumbs, section-pad, grid-2). Add view-specific rules
  to suite.css under a comment with the view's name, only if nothing existing fits.
- Search: the top bar `#search` input fires `input` events; a view may read its value via
  `document.getElementById('search').value` and filter its list.
