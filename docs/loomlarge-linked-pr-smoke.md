# LoomLarge Linked PR Smoke Test

This document is intentionally small. It gives LoomLarge a harmless Polyester
pull request to install from GitHub while validating linked dependency
resolution before npm publishing is enabled.

Expected LoomLarge PR syntax:

```text
Depends-on: meekmachine/Polyester#<pr-number>
```

When that link is present, LoomLarge CI installs this Polyester branch behind
the existing `@lovelace_lol/latticework` import surface and runs the frontend
build/test path without committing package manifest changes.
