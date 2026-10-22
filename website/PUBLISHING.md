# Publishing smartgurukul.org

The app repo is private; the site is public. They are split so the code can stay closed without
taking the marketing site down, and without needing a paid GitHub plan — GitHub Pages only works
from a private repository on Pro, Team or Enterprise, but a **public** repo serves Pages on the
free organization plan.

## How the split works

| Where | What | Visibility |
|---|---|---|
| `SmartGurukul/Gurukul_rn` | the app, plus `website/` (generator + page sources) | private |
| `SmartGurukul/smartgurukul-site` | only the built HTML, served as smartgurukul.org | public |

The generator stays in the private repo on purpose. `website/build.py` checks every
`<span class="ui">` label in the marketing copy against `src/i18n/locales/{en,hi}.json`, so renaming
a button in the app fails the site build instead of leaving the site quoting a button nobody can
find. That check needs the app's locale files next to it. Only `docs/` — finished HTML — is pushed
out, so the public repo carries no page sources and no generator.

`.github/workflows/publish-site.yml` runs `python website/build.py` on every push to `main` that
touches `website/**` or `src/i18n/locales/**`, and pushes `docs/` to the public repo. The build
exits non-zero on any FAIL, so a broken link or a stale app label stops the publish before it
reaches the live site.

To publish by hand: Actions → **Publish site** → Run workflow.

## DNS, as it stands

- Apex `smartgurukul.org` → GitHub's four Pages A records (`185.199.108–111.153`).
  **Owner-independent — moving the site between GitHub accounts needs no apex change.**
- `www.smartgurukul.org` → CNAME. **This one names the owner** and must track wherever Pages is
  served from.

## One-time migration

Do these in order. The only user-visible downtime is step 5, a few minutes.

### 1. Transfer the app repo to the organization

`ManojPatidar10/Gurukul_rn` → Settings → General → Danger zone → **Transfer ownership** → `SmartGurukul`.

Needs repo admin on the source and the right to create repos in the org. Leave it **public** for
now — it is still serving the live site at this point. Issues, PRs and stars come across, and the
old URLs redirect.

Then repoint `www`:

    www.smartgurukul.org  CNAME  smartgurukul.github.io.

Check the site is still up before going on.

### 2. Verify the domain for the organization

Org Settings → Pages → **Verified domains** → Add `smartgurukul.org`, add the
`_github-pages-challenge-smartgurukul` TXT record it gives you, then Verify.

Do this *after* the transfer, not before: verifying a domain for the org blocks other accounts from
using it, and until step 1 the site is served by a personal account.

There is no such TXT record today, for either owner — the domain is **currently unverified**, which
is what makes a takeover possible. This step closes that.

### 3. Create the public site repo

New **public** repo `SmartGurukul/smartgurukul-site`, empty, no README.

### 4. Wire up the deploy key

    ssh-keygen -t ed25519 -C "smartgurukul-site deploy" -f /tmp/site_deploy -N ""

- Public half (`/tmp/site_deploy.pub`) → `smartgurukul-site` → Settings → Deploy keys → Add,
  **Allow write access** ticked.
- Private half (`/tmp/site_deploy`) → `Gurukul_rn` → Settings → Secrets and variables → Actions →
  New secret, named `SITE_DEPLOY_KEY`.
- Delete both local files afterwards.

Then run **Publish site** manually and confirm the HTML lands in `smartgurukul-site`.

### 5. Move the domain

In `smartgurukul-site` → Settings → Pages: source **main / (root)**.

Expect the `smartgurukul.github.io/smartgurukul-site/` preview to look unstyled — the pages use
root-absolute paths (`/assets/...`), which only resolve once the custom domain is attached. That is
not a broken build.

Then, back to back:

1. `Gurukul_rn` → Settings → Pages → remove the custom domain.
2. `smartgurukul-site` → Settings → Pages → set custom domain `smartgurukul.org`, tick
   **Enforce HTTPS** once the certificate is issued (usually minutes, sometimes an hour).

No apex DNS change. `www` already points at `smartgurukul.github.io` from step 1.

### 6. Make the app repo private

`Gurukul_rn` → Settings → Danger zone → Change visibility → **Private**.

Confirm smartgurukul.org still loads — it is served from the public repo now, so it should be
untouched. The redirects from the old `ManojPatidar10/Gurukul_rn` URLs will start 404ing for anyone
outside the org, which is the point.

### 7. Rewire local clones

    git remote set-url origin https://github.com/SmartGurukul/Gurukul_rn.git

## Afterwards

- `docs/` stays committed in the private repo. It is the build output and the workflow's input;
  leaving it tracked keeps the build reviewable in diffs.
- Nothing else in the repo references the old owner. `app.json`, `eas.json` and the EAS project id
  are account-scoped, not repo-scoped, and are unaffected.
