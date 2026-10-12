<!-- Keep it short. Delete any line that doesn't apply. -->

## What
<!-- One or two sentences: what does this change do? -->

## Why
<!-- The reason / the issue it fixes. Link issues like: Fixes #123 -->

## Tested
<!-- How did you check it works? (built locally, flashed the board, ran the site…) -->

## Which row
<!-- Which row of the table in CONTRIBUTING.md (https://github.com/engmung/Patternflow/blob/main/CONTRIBUTING.md#where-your-contribution-goes) this is: a guide fix, a feature, a remix… -->

---
- [ ] Touches `web/` → it builds (`npm run build`)
- [ ] Touches `firmware/` → every composition builds (`./firmware/bundles/build.sh all`), and the core still names no feature (`python firmware/toolchain/check_boundaries.py`)
- [ ] Touches a markdown file → its relative links resolve (`python3 .github/scripts/check_links.py`)
