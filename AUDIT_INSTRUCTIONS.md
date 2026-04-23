# STREAMS AUDIT SCRIPT — SESSION INSTRUCTIONS
## Paste this entire document at the start of every conversation with Claude.

---

## WHAT THIS IS

This is the pre-push audit script for the Streams panel codebase.
It checks every rule in BUILD_RULES.md and FRONTEND_BUILD_RULES.md.
If ANY violation is found, it returns exit code 1 and blocks the commit.

Claude must run this script before every push. If it finds violations,
Claude fixes them and runs it again. Zero violations required to push.

---

## HOW TO RUN IT (Git Bash on Windows)

```bash
cd /c/Users/hawk7/streamsailive
python scripts/audit.py
```

## HOW TO RUN IT (PowerShell)

```powershell
cd C:\Users\hawk7\streamsailive
python scripts/audit.py
```

---

## WHAT ZERO VIOLATIONS LOOKS LIKE

```
=================================================================
 Streams Panel — Pre-push Audit
 BUILD_RULES.md + FRONTEND_BUILD_RULES.md
=================================================================
 Scanning 38 files across 3 directories...

 Running TypeScript check (this takes ~30s)...

 ✅  ZERO VIOLATIONS — safe to push
```

If you see anything other than this, nothing gets pushed.

---

## HOW THE PRE-COMMIT HOOK WORKS

The hook was installed by running:

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
python scripts/audit.py
if [ $? -ne 0 ]; then
  echo "COMMIT BLOCKED — fix violations above."
  exit 1
fi
EOF
chmod +x .git/hooks/pre-commit
```

Every `git commit` now runs the audit automatically.
If violations exist, the commit is rejected.
This cannot be bypassed without explicitly skipping hooks.

---

## INSTRUCTIONS FOR CLAUDE EVERY SESSION

Before writing any code:

1. The audit script is at `scripts/audit.py` in the repo
2. Every push must pass `python scripts/audit.py` with zero violations
3. Run the audit after every change, before every commit
4. If the audit finds violations, fix them — do not push until clean
5. The pre-commit hook runs this automatically on `git commit`

Rules checked by the script:
- C.1: WCAG contrast ratios on all token pairs
- CSS.1: !important anywhere
- CSS.2: hardcoded hex colours outside tokens.ts
- T.2: fontWeight 600 or 700
- T.4: letterSpacing on non-uppercase text
- T.7: monospace font on prose
- T.8: fontSize below 12
- M.1/9.4: animating layout properties (width, height, etc.)
- M.3: transition: all
- M.7/ACC.11: prefers-reduced-motion missing
- S.1/9.2: off-scale spacing values
- 9.3: off-scale borderRadius values
- S.8: z-index outside defined scale
- R.3/1.2: display:none on feature elements
- R.11/1.5: missing safe-area-inset-bottom
- F.1/11.4: defaultValue / missing maxLength
- N.1/N.2/N.3: toast auto-dismiss, max count, keyboard position
- K.7: clickable divs missing role/tabIndex
- K.8: icon buttons missing aria-label
- ACC.4: missing aria-live regions
- D.3: raw ISO dates in UI
- ST.2/7.3/7.4/6.2: stubs, coming soon, shell data, window.prompt
- 10.1: provider names outside SettingsTab
- 2.3: overflow-x:auto without scrollbar suppression
- 3.1: missing visualViewport listener
- 5.1: borders on input fields
- 12.1: TypeScript errors in streams files

---

## THE FULL SCRIPT (current version)

If `scripts/audit.py` is missing from the repo, recreate it with this content:

```python
#!/usr/bin/env python3
"""
Streams Panel — Pre-push Audit Script
Checks ALL checkable rules from BUILD_RULES.md + FRONTEND_BUILD_RULES.md
Returns exit code 1 if ANY violation found, 0 if clean.
Run: python scripts/audit.py
"""

import re, os, sys, subprocess
from pathlib import Path

def linearize(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminance(hex_str):
    h = hex_str.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)

def contrast(fg, bg):
    l1, l2 = luminance(fg), luminance(bg)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

def parse_tokens():
    tokens = {}
    path = Path("src/components/streams/tokens.ts")
    if not path.exists():
        return tokens
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.search(r'(\w+)\s*:\s*["\']#([0-9a-fA-F]{6})["\']', line)
        if m:
            tokens[m.group(1)] = "#" + m.group(2)
    return tokens

DIRS = [
    "src/components/streams",
    "src/app/api/streams",
    "src/app/streams",
]

def get_files():
    files = []
    for d in DIRS:
        p = Path(d)
        if p.exists():
            files += list(p.rglob("*.tsx"))
            files += list(p.rglob("*.ts"))
    return files

def read(path):
    try:
        return path.read_text(encoding="utf-8")
    except:
        return ""

def lines(path):
    return read(path).splitlines()

findings = []

def fail(rule, path, line_no, msg):
    findings.append((rule, str(path), line_no, msg))

def check_contrast(tok):
    bg  = tok.get("bg",  "#080C1E")
    bg2 = tok.get("bg2", "#0D1228")
    bg3 = tok.get("bg3", "#111830")
    pairs = [
        ("t1", tok.get("t1","#F0F2FF"), "bg",  bg,  4.5, "body text on page"),
        ("t1", tok.get("t1","#F0F2FF"), "bg2", bg2, 4.5, "body text on panel"),
        ("t1", tok.get("t1","#F0F2FF"), "bg3", bg3, 4.5, "body text on input"),
        ("t2", tok.get("t2","#9BA3C9"), "bg",  bg,  4.5, "secondary on page"),
        ("t2", tok.get("t2","#9BA3C9"), "bg2", bg2, 4.5, "secondary on panel"),
        ("t3", tok.get("t3","#8891B8"), "bg",  bg,  4.5, "tertiary on page"),
        ("t3", tok.get("t3","#8891B8"), "bg2", bg2, 4.5, "tertiary on panel"),
        ("t4", tok.get("t4","#5A6390"), "bg",  bg,  3.0, "hint on page"),
        ("t4", tok.get("t4","#5A6390"), "bg2", bg2, 3.0, "hint on panel"),
    ]
    for fg_name, fg_hex, bg_name, bg_hex, minimum, note in pairs:
        if not fg_hex or not bg_hex:
            continue
        try:
            ratio = contrast(fg_hex, bg_hex)
        except:
            continue
        if ratio < minimum:
            fail("C.1", "src/components/streams/tokens.ts", 0,
                 f"C.{fg_name} ({fg_hex}) on C.{bg_name} ({bg_hex}) = {ratio:.2f}:1 "
                 f"— fails {minimum}:1 minimum [{note}]")

def check_important(files):
    for path in files:
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
                continue
            if "!important" in line:
                ctx = " ".join(lines(path)[max(0,i-4):i+4])
                if "prefers-reduced-motion" in ctx:
                    continue
                fail("CSS.1", path, i, f"!important: {stripped[:100]}")

def check_hardcoded_colors(files, tok):
    pattern = re.compile(r'["\']#[0-9a-fA-F]{3,6}["\']')
    known_ok = {'"#fff"',"'#fff'",'"#000"',"'#000'"}
    known_ok.update(f'"{v}"' for v in tok.values())
    known_ok.update(f"'{v}'" for v in tok.values())
    for path in files:
        if "tokens.ts" in str(path):
            continue
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            if "PALETTE" in line:
                continue
            for m in pattern.finditer(line):
                val = m.group(0)
                if val.lower() not in {v.lower() for v in known_ok}:
                    fail("CSS.2", path, i,
                         f"Hardcoded colour {val} — use token: {stripped[:100]}")

def check_font_weights(files):
    pattern = re.compile(r'fontWeight\s*[:=]\s*(600|700)')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if pattern.search(line):
                fail("T.2", path, i, f"fontWeight 600/700: {line.strip()[:100]}")

def check_font_floor(files):
    pattern = re.compile(r'fontSize\s*[:=]\s*(\d+(?:\.\d+)?)\b')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            for m in pattern.finditer(line):
                if float(m.group(1)) < 12:
                    fail("T.8", path, i,
                         f"fontSize {m.group(1)} below 12: {line.strip()[:100]}")

def check_letter_spacing(files):
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if "letterSpacing" not in line:
                continue
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            ctx = " ".join(lines(path)[max(0,i-3):i+3])
            if "uppercase" in ctx.lower() or "RESOLUTION" in ctx:
                continue
            if "streams-serif" in ctx or "DM Serif" in ctx:
                continue
            fail("T.4", path, i, f"letterSpacing on non-uppercase: {stripped[:100]}")

def check_monospace_prose(files):
    pattern = re.compile(r'fontFamily.*(?:mono|IBM Plex Mono)', re.IGNORECASE)
    for path in files:
        if "tokens.ts" in str(path) or "StreamsPanel.tsx" in str(path):
            continue
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            if pattern.search(line) and "streams-mono" not in line:
                fail("T.7", path, i, f"Monospace on non-code: {stripped[:100]}")

LAYOUT_PROPS = ["width", "height", r"\btop\b", r"\bleft\b", r"\bright\b",
                r"\bbottom\b", "padding", "margin", "border-width", "font-size"]

def check_layout_animation(files):
    pattern = re.compile(r'transition\s*[:=]\s*["\']([^"\']+)["\']')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            m = pattern.search(line)
            if not m:
                continue
            val = m.group(1).lower()
            for prop in LAYOUT_PROPS:
                if re.search(prop, val):
                    fail("M.1/9.4", path, i,
                         f"Animating layout property '{prop}': {line.strip()[:100]}")
                    break

def check_transition_all(files):
    pattern = re.compile(r'transition\s*[:=]\s*["\']all\b')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if pattern.search(line):
                fail("M.3", path, i, f"transition:all: {line.strip()[:100]}")

def check_reduced_motion(files):
    panel = [f for f in files if "StreamsPanel.tsx" in str(f)]
    for path in panel:
        if "prefers-reduced-motion" not in read(path):
            fail("M.7/ACC.11", path, 0, "No prefers-reduced-motion in StreamsPanel")

SPACING_SCALE = {0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96}

def check_spacing(files):
    pattern = re.compile(r'(?:padding|margin|gap)\s*[:=]\s*["\']?\s*(\d+)px\s*["\']?')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if line.strip().startswith("//"):
                continue
            for m in pattern.finditer(line):
                val = int(m.group(1))
                if val not in SPACING_SCALE:
                    fail("S.1/9.2", path, i,
                         f"Off-scale spacing {val}px: {line.strip()[:100]}")

RADIUS_SCALE = {0, 4, 8, 12, 16, 20, 24, 999}

def check_radius(files):
    pattern = re.compile(r'borderRadius\s*[:=]\s*(\d+)\b')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            for m in pattern.finditer(line):
                val = int(m.group(1))
                if val not in RADIUS_SCALE:
                    fail("9.3", path, i,
                         f"Off-scale radius {val}: {line.strip()[:100]}")

Z_SCALE = {10, 100, 200, 299, 300, 400}

def check_zindex(files):
    pattern = re.compile(r'zIndex\s*[:=]\s*(\d+)')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            for m in pattern.finditer(line):
                val = int(m.group(1))
                if val not in Z_SCALE:
                    fail("S.8", path, i,
                         f"z-index {val} not in scale: {line.strip()[:100]}")

def check_display_none_features(files):
    pattern = re.compile(r'display\s*:\s*none\s*!important')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if pattern.search(line):
                if "desktop-nav" in line or "streams-desktop-nav" in line:
                    continue
                fail("R.3/1.2", path, i,
                     f"display:none !important on feature: {line.strip()[:100]}")

def check_safe_area(files):
    for path in files:
        if "ChatTab" in str(path):
            if "safe-area-inset-bottom" not in read(path):
                fail("R.11/1.5", path, 0, "ChatTab missing safe-area-inset-bottom")

def check_uncontrolled_inputs(files):
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if "defaultValue" in line and not line.strip().startswith("//"):
                fail("F.1/11.4", path, i, f"defaultValue: {line.strip()[:100]}")

def check_max_length(files):
    for path in files:
        if "ChatTab" not in str(path) and "VideoEditorTab" not in str(path):
            continue
        content = read(path)
        tc = content.count("<textarea")
        ml = content.count("maxLength")
        if tc > ml:
            fail("F.11", path, 0,
                 f"{tc} textarea(s) but only {ml} maxLength")

def check_toast(files):
    for path in files:
        if "Toast" not in str(path):
            continue
        content = read(path)
        lns = lines(path)
        if "setTimeout" not in content:
            fail("N.1", path, 0, "Toast has no auto-dismiss setTimeout")
        for i, line in enumerate(lns, 1):
            if re.search(r'slice\(-[3-9]\)', line):
                fail("N.2", path, i, f"Toast allows >3: {line.strip()[:100]}")
        if "visualViewport" not in content:
            fail("N.3", path, 0, "Toast missing visualViewport repositioning")

def check_clickable_divs(files):
    pattern = re.compile(r'<div[^>]*onClick=')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if pattern.search(line):
                if 'role=' not in line or 'tabIndex' not in line:
                    fail("K.7", path, i,
                         f"Clickable div missing role/tabIndex: {line.strip()[:100]}")

def check_aria_labels(files):
    icon_pattern = re.compile(
        r'<button[^>]*>\s*[✕✖×➕➖⊕↗▶▤◎⊞✦←→↑↓☰\+\-−✓]{1,3}\s*</button>'
    )
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if icon_pattern.search(line) and "aria-label" not in line:
                fail("K.8", path, i, f"Icon button missing aria-label: {line.strip()[:100]}")

def check_aria_live(files):
    for path in files:
        if "ChatTab" in str(path) and "aria-live" not in read(path):
            fail("ACC.4", path, 0, "ChatTab missing aria-live on message list")
        if "GenerateTab" in str(path):
            content = read(path)
            if "aria-live" not in content and 'role="status"' not in content:
                fail("ACC.4", path, 0, "GenerateTab missing aria-live on status")

def check_iso_dates(files):
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if line.strip().startswith("//"):
                continue
            if re.search(r'\{[^}]*\.created_at\b', line) or re.search(r'\{[^}]*\.updated_at\b', line):
                if "toLocale" not in line and "format" not in line and "new Date" not in line:
                    fail("D.3", path, i, f"Raw ISO date: {line.strip()[:100]}")

def check_stubs(files):
    for path in files:
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            if re.search(r'onClick=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}', line):
                fail("ST.2", path, i, f"Empty onClick: {stripped[:100]}")
            if "window.prompt(" in line:
                fail("ST.3/7.4", path, i, f"window.prompt: {stripped[:100]}")
            if re.search(r'coming\s+soon', line, re.IGNORECASE):
                fail("ST.4/7.3", path, i, f"coming soon: {stripped[:100]}")
            if "Shell data" in line:
                fail("6.2", path, i, f"Shell data: {stripped[:100]}")

PROVIDERS = ["MiniMax", "fal-ai/", "ElevenLabs", "Kling", "OpenAI", "Runway", "Veo"]

def check_providers(files):
    for path in files:
        if "SettingsTab" in str(path):
            continue
        if "api/streams" in str(path).replace("\\", "/"):
            continue
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*") or "import " in stripped:
                continue
            for prov in PROVIDERS:
                if prov in line:
                    fail("10.1", path, i,
                         f"Provider '{prov}' in UI: {stripped[:100]}")
                    break

def check_scrollbar_suppression(files):
    pattern = re.compile(r'overflowX\s*:\s*["\']auto["\']')
    for path in files:
        content = read(path)
        for i, line in enumerate(lines(path), 1):
            if pattern.search(line) and "scrollbar-width" not in content:
                fail("2.3", path, i,
                     f"overflow-x:auto without scrollbar suppression: {line.strip()[:100]}")
                break

def check_visualviewport(files):
    for path in files:
        if "ChatTab" in str(path) and "visualViewport" not in read(path):
            fail("3.1", path, 0, "ChatTab missing visualViewport listener")

def check_input_borders(files):
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if ("<input" in line or "<textarea" in line):
                if re.search(r'border\s*:\s*`1px|border\s*:\s*"1px|border\s*:\s*\'1px', line):
                    fail("5.1", path, i, f"Border on input: {line.strip()[:100]}")

def check_typescript():
    result = subprocess.run(
        "npx tsc --noEmit",
        capture_output=True, text=True, timeout=120, shell=True
    )
    output = result.stdout + result.stderr
    skip = {"TS7026","TS2875","TS2503","TS2307","Cannot find module","Cannot find namespace"}
    for line in output.splitlines():
        if "streams/" not in line:
            continue
        if any(s in line for s in skip):
            continue
        if "error TS" in line:
            fail("12.1", line.split("(")[0], 0, line.strip())

def main():
    if not Path("src/components/streams").exists():
        print("ERROR: Run from repo root")
        return 2

    print("=" * 65)
    print(" Streams Panel — Pre-push Audit")
    print(" BUILD_RULES.md + FRONTEND_BUILD_RULES.md")
    print("=" * 65)

    tok = parse_tokens()
    files = get_files()
    print(f" Scanning {len(files)} files...\n")

    check_contrast(tok)
    check_important(files)
    check_hardcoded_colors(files, tok)
    check_font_weights(files)
    check_font_floor(files)
    check_letter_spacing(files)
    check_monospace_prose(files)
    check_layout_animation(files)
    check_transition_all(files)
    check_reduced_motion(files)
    check_spacing(files)
    check_radius(files)
    check_zindex(files)
    check_display_none_features(files)
    check_safe_area(files)
    check_uncontrolled_inputs(files)
    check_max_length(files)
    check_toast(files)
    check_clickable_divs(files)
    check_aria_labels(files)
    check_aria_live(files)
    check_iso_dates(files)
    check_stubs(files)
    check_providers(files)
    check_scrollbar_suppression(files)
    check_visualviewport(files)
    check_input_borders(files)
    print(" Running TypeScript check (~30s)...")
    check_typescript()

    if not findings:
        print("\n ✅  ZERO VIOLATIONS — safe to push\n")
        return 0

    by_rule = {}
    for rule, path, line_no, msg in findings:
        by_rule.setdefault(rule, []).append((path, line_no, msg))

    print(f"\n 🔴  {len(findings)} VIOLATION(S) — PUSH BLOCKED\n")
    print("-" * 65)

    for rule in sorted(by_rule.keys()):
        items = by_rule[rule]
        print(f"\n [{rule}]  {len(items)} violation(s)")
        for path, line_no, msg in items:
            loc = f"{path}:{line_no}" if line_no else path
            print(f"   {loc}")
            print(f"   → {msg}")

    print(f"\n{'='*65}")
    print(f" RESULT: {len(findings)} violations across {len(by_rule)} rules")
    print(f" Fix every violation above before pushing.")
    print(f"{'='*65}\n")
    return 1

if __name__ == "__main__":
    sys.exit(main())
```
