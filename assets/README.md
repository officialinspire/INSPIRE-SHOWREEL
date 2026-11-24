# assets/

| Path | Tracked in Git | Contents |
|------|----------------|----------|
| `branding/` | yes (regular blobs) | Original INSPIRE studio intro (`inspiresoftwareintro.mp4`) and logo. Do not edit; `npm test` and `npm run validate` check their SHA-256. |
| `vendor/` | no (ignored) | Per-game title cards and music, downloaded from pinned commits by `npm run fetch`. |
| `masters/` | Git LFS | Reserved for large source masters, such as raw footage or high-bitrate audio. |
