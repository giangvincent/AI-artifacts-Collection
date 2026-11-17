---
name: merlin-archive
description: "Inspect and safely extract archive files (.zip, .jar) via `unzip`. Includes safety checks for zip bombs and path traversal."
version: 1.0.0
author: Merlin
license: MIT
platforms: [linux, macos, windows]
metadata:
  merlin:
    tags: [Archive, ZIP, JAR, Extraction]
    related_skills: []
---

# Archives (ZIP, JAR)

Handles `.zip` and `.jar` archives. Treat archives as opaque until you've
inspected the listing.

## Step 1: Inspect before extracting

Always list contents first so you (and the user) know what's about to land
on disk:

```bash
unzip -l "/path/to/file.zip"
```

If the listing shows:

- More than ~100 entries
- Any entries with absolute paths (`/...`)
- Any entries with `..` in the path
- Suspicious or unfamiliar contents

→ pause and confirm with the user before extracting.

## Step 2: Extract to a sibling directory

```bash
DEST="$(dirname '/path/to/file.zip')/$(basename '/path/to/file.zip' .zip)-extracted"
mkdir -p "$DEST"
unzip -d "$DEST" "/path/to/file.zip"
```

For `.jar` files (same format):

```bash
DEST="$(dirname '/path/to/file.jar')/$(basename '/path/to/file.jar' .jar)-extracted"
mkdir -p "$DEST"
unzip -d "$DEST" "/path/to/file.jar"
```

## Step 3: Re-dispatch contents

Once extracted, each file is just a regular path on disk. Use `ls` and
`find` to enumerate, then handle each by extension via the appropriate skill.

```bash
ls -la "$DEST"
find "$DEST" -type f | head -50
```

## Safety notes

- Never extract archives from unknown sources without warning the user.
- Zip bombs: if extraction starts producing unusually large output, abort
  with Ctrl-C and report to the user.
- Don't `chmod +x` extracted files unless explicitly asked.
- `.jar` is a ZIP archive of Java classes — extracting it is fine for
  inspection, but don't execute the contents.

## Tips

- For text-heavy archives (e.g. a zipped repo of source code), use
  `grep -r` directly on the extraction directory instead of reading each
  file individually.
- Save a `README.md` summary in the extracted dir noting what the archive
  contained, so later turns have context.
