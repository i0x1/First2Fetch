# macOS desktop releases

The desktop release workflow is `.github/workflows/macos-release.yml`. It builds Intel and Apple Silicon DMG and ZIP files, signs and notarizes the apps, and publishes the files to this repository's GitHub Releases page. The installed app checks `update.electronjs.org` for signed ZIP updates. A DMG is for the first install; the ZIP is for updates.

## One-time GitHub setup

Add these repository Actions secrets: `MAC_CERT` (a base64 encoded Developer ID Application `.p12`), `MAC_CERT_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` (an Apple app-specific password), and `APPLE_TEAM_ID`. The workflow also needs `APP_BUNDLE_ID`, `SUPABASE_URL`, and `SUPABASE_KEY` for this project's current configuration. Optional telemetry secrets are `AXIOM_TOKEN`, `AXIOM_DATASET`, and `AMPLITUDE_API_KEY`.

Use the same `APP_BUNDLE_ID` for every release. Changing it can break updates and stored macOS permissions. Do not put a Supabase service-role key in the desktop build; use a public publishable or anon key.

The workflow checks the required signing secrets and version before it builds. No release is published when a check or build fails. Local packages can be built without Apple credentials for development, but they are not official releases and cannot provide verified macOS auto updates.

## Publish a release

1. Finish and push the code changes. Confirm that desktop TypeScript and focused tests pass.
2. Set the same new semantic version in the root and `apps/desktopProbe/package.json`, then commit and push it. Keep the release version above the installed version.
3. Create and push a `desktop-v<version>` tag on that commit. The tag starts the macOS workflow.
4. Check the workflow result and the four DMG/ZIP assets on the GitHub release. Do not install or share a failed or incomplete release.
5. Install the Apple Silicon DMG on an Apple Silicon Mac, or the Intel DMG on an Intel Mac. Open the app, sign in, confirm job scanning and the web job inbox, then quit and reopen it.
6. For the first update test, publish a second signed version. Launch the earlier installed version, wait for its update check, select the update action, and confirm that the new version opens with the saved session and scanner settings.

If an update fails, install the latest verified DMG from GitHub Releases. The app's job data remains in hosted Supabase. Desktop login state and scanner settings remain local to the Mac, so verify them after reinstalling.
