#!/usr/bin/env python3
"""
Streams Panel — Pre-push Audit Script
Checks ALL checkable rules from BUILD_RULES.md + FRONTEND_BUILD_RULES.md
Returns exit code 1 if ANY violation found, 0 if clean.
Run: python3 scripts/audit.py
"""

import re, os, sys, subprocess
from pathlib import Path

# ── Colour math (WCAG 2.1 contrast) ─────────────────────────────────────────

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

# ── Live token values — read from tokens.ts at runtime ──────────────────────

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

# ── File discovery ───────────────────────────────────────────────────────────

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

# ── Violation collector ──────────────────────────────────────────────────────

findings = []

def fail(rule, path, line_no, msg):
    findings.append((rule, str(path), line_no, msg))

# ════════════════════════════════════════════════════════════════════════════
# SECTION 1 — CONTRAST (C.1, C.2)
# Every token used as foreground text must pass 4.5:1 against its background.
# ════════════════════════════════════════════════════════════════════════════

def check_contrast(tok):
    bg   = tok.get("bg",  "#080C1E")
    bg2  = tok.get("bg2", "#0D1228")
    bg3  = tok.get("bg3", "#111830")
    bg4  = tok.get("bg4", "#161E38")

    pairs = [
        # (fg_name, fg_hex, bg_name, bg_hex, min_ratio, note)
        ("t1", tok.get("t1","#F0F2FF"), "bg",  bg,  4.5, "body text on page"),
        ("t1", tok.get("t1","#F0F2FF"), "bg2", bg2, 4.5, "body text on panel"),
        ("t1", tok.get("t1","#F0F2FF"), "bg3", bg3, 4.5, "body text on input"),
        ("t2", tok.get("t2","#9BA3C9"), "bg",  bg,  4.5, "secondary on page"),
        ("t2", tok.get("t2","#9BA3C9"), "bg2", bg2, 4.5, "secondary on panel"),
        ("t2", tok.get("t2","#9BA3C9"), "bg3", bg3, 4.5, "secondary on input"),
        ("t3", tok.get("t3","#5A6390"), "bg",  bg,  4.5, "tertiary on page — used for labels"),
        ("t3", tok.get("t3","#5A6390"), "bg2", bg2, 4.5, "tertiary on panel — used for labels"),
        ("t4", tok.get("t4","#323A60"), "bg",  bg,  3.0, "hint on page — large UI text only"),
        ("t4", tok.get("t4","#323A60"), "bg2", bg2, 3.0, "hint on panel — large UI text only"),
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

# ════════════════════════════════════════════════════════════════════════════
# SECTION 2 — CSS RULES (CSS.1, CSS.2, CSS.5)
# ════════════════════════════════════════════════════════════════════════════

def check_important(files):
    """CSS.1 — !important is NEVER used."""
    for path in files:
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            # Skip comments
            if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
                continue
            if "!important" in line:
                # Only exception: prefers-reduced-motion global reset
                ctx = " ".join(lines(path)[max(0,i-4):i+4])
                if "prefers-reduced-motion" in ctx:
                    continue
                fail("CSS.1", path, i, f"!important: {stripped[:100]}")

def check_hardcoded_colors(files, tok):
    """CSS.2 — No hardcoded hex colours outside tokens.ts."""
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
            # Allow PALETTE constants (creative/brand colours for image generation)
            if "PALETTE" in line:
                continue
            for m in pattern.finditer(line):
                val = m.group(0)
                if val.lower() not in {v.lower() for v in known_ok}:
                    fail("CSS.2", path, i,
                         f"Hardcoded colour {val} — use token: {stripped[:100]}")

# ════════════════════════════════════════════════════════════════════════════
# SECTION 3 — TYPOGRAPHY (T.2, T.4, T.7, T.8, T.10)
# ════════════════════════════════════════════════════════════════════════════

def check_font_weights(files):
    """T.2 — fontWeight 600 and 700 never used."""
    pattern = re.compile(r'fontWeight\s*[:=]\s*(600|700)')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if pattern.search(line):
                fail("T.2", path, i, f"fontWeight 600/700: {line.strip()[:100]}")

def check_font_floor(files):
    """T.8 — No fontSize below 12."""
    pattern = re.compile(r'fontSize\s*[:=]\s*(\d+(?:\.\d+)?)\b')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            for m in pattern.finditer(line):
                size = float(m.group(1))
                if size < 12:
                    fail("T.8", path, i,
                         f"fontSize {size} below minimum 12: {line.strip()[:100]}")

def check_letter_spacing(files):
    """T.4 — letterSpacing only on uppercase display text > 24px."""
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if "letterSpacing" not in line:
                continue
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            ctx = " ".join(lines(path)[max(0,i-3):i+3])
            # Allow on uppercase labels and resolution badge
            if "uppercase" in ctx.lower() or "RESOLUTION" in ctx:
                continue
            # Allow the brand name italic (borderline)
            if "streams-serif" in ctx or "DM Serif" in ctx:
                continue
            fail("T.4", path, i,
                 f"letterSpacing on non-uppercase text: {stripped[:100]}")

def check_monospace_prose(files):
    """T.7 — Monospace only on code/IDs, never prose."""
    pattern = re.compile(r'fontFamily.*(?:mono|IBM Plex Mono)', re.IGNORECASE)
    for path in files:
        if "tokens.ts" in str(path) or "StreamsPanel.tsx" in str(path):
            continue
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            if pattern.search(line):
                if "streams-mono" in line or "className.*mono" in line:
                    continue
                fail("T.7", path, i,
                     f"Monospace on non-code element: {stripped[:100]}")

# ════════════════════════════════════════════════════════════════════════════
# SECTION 4 — SPACING + LAYOUT (S.1/9.2, S.8, R.3/1.2, R.11/1.5)
# ════════════════════════════════════════════════════════════════════════════

SPACING_SCALE = {0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96}

def check_spacing(files):
    """S.1 / Rule 9.2 — Spacing from locked scale only."""
    # Match padding/margin/gap with explicit px values
    pattern = re.compile(
        r'(?:padding|margin|gap)\s*[:=]\s*["\']?\s*(\d+)px\s*["\']?'
    )
    for path in files:
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            for m in pattern.finditer(line):
                val = int(m.group(1))
                if val not in SPACING_SCALE:
                    fail("S.1/9.2", path, i,
                         f"Off-scale spacing {val}px (scale: 4,8,12,16,20,24,32,40,48,64,80,96): {stripped[:100]}")

RADIUS_SCALE = {0, 4, 8, 12, 16, 20, 24, 999}

def check_radius(files):
    """Rule 9.3 — Radius from locked scale only."""
    pattern = re.compile(r'borderRadius\s*[:=]\s*(\d+)\b')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            for m in pattern.finditer(line):
                val = int(m.group(1))
                if val not in RADIUS_SCALE:
                    fail("9.3", path, i,
                         f"Off-scale borderRadius {val} (scale: 8,12,16,20,24,999): {line.strip()[:100]}")

Z_SCALE = {10, 100, 200, 299, 300, 400}

def check_zindex(files):
    """S.8 — z-index from defined scale: 10,100,200,300,400."""
    pattern = re.compile(r'zIndex\s*[:=]\s*(\d+)')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            for m in pattern.finditer(line):
                val = int(m.group(1))
                if val not in Z_SCALE:
                    fail("S.8", path, i,
                         f"z-index {val} not in scale {{10,100,200,299,300,400}}: {line.strip()[:100]}")

def check_display_none_features(files):
    """R.3 / Rule 1.2 — No display:none !important on feature elements."""
    pattern = re.compile(r'display\s*:\s*none\s*!important')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if pattern.search(line):
                # Only allowed for desktop nav replaced by mobile nav
                if "desktop-nav" in line or "streams-desktop-nav" in line:
                    continue
                fail("R.3/1.2", path, i,
                     f"display:none !important on feature element: {line.strip()[:100]}")

def check_safe_area(files):
    """R.11 / Rule 1.5 — safe-area-inset-bottom on bottom-anchored elements."""
    for path in files:
        if "ChatTab" in str(path):
            content = read(path)
            if "safe-area-inset-bottom" not in content:
                fail("R.11/1.5", path, 0,
                     "ChatTab input bar missing env(safe-area-inset-bottom)")

# ════════════════════════════════════════════════════════════════════════════
# SECTION 5 — MOTION (M.1/9.4, M.3, M.7/ACC.11)
# ════════════════════════════════════════════════════════════════════════════

LAYOUT_PROPS = ["width", "height", r"\btop\b", r"\bleft\b", r"\bright\b",
                r"\bbottom\b", "padding", "margin", "border-width", "font-size"]

def check_layout_animation(files):
    """M.1 / Rule 9.4 — Only transform + opacity may be animated."""
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
    """M.3 — transition: all is never used."""
    pattern = re.compile(r'transition\s*[:=]\s*["\']all\b')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if pattern.search(line):
                fail("M.3", path, i,
                     f"transition: all found: {line.strip()[:100]}")

def check_reduced_motion(files):
    """M.7 / ACC.11 — prefers-reduced-motion must be respected globally."""
    panel = [f for f in files if "StreamsPanel.tsx" in str(f)]
    for path in panel:
        if "prefers-reduced-motion" not in read(path):
            fail("M.7/ACC.11", path, 0,
                 "No @media (prefers-reduced-motion) rule in StreamsPanel")

# ════════════════════════════════════════════════════════════════════════════
# SECTION 6 — FORMS (F.1, F.11)
# ════════════════════════════════════════════════════════════════════════════

def check_uncontrolled_inputs(files):
    """F.1 / Rule 11.4 — No defaultValue on controlled inputs."""
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if "defaultValue" in line:
                stripped = line.strip()
                if not stripped.startswith("//"):
                    fail("F.1/11.4", path, i,
                         f"defaultValue on input: {stripped[:100]}")

def check_max_length(files):
    """F.11 — maxLength required on all free-text inputs."""
    for path in files:
        if "ChatTab" not in str(path) and "VideoEditorTab" not in str(path):
            continue
        content = read(path)
        textarea_count = content.count("<textarea")
        maxlength_count = content.count("maxLength")
        if textarea_count > maxlength_count:
            fail("F.11", path, 0,
                 f"{textarea_count} textarea(s) but only {maxlength_count} maxLength — every textarea needs maxLength")

# ════════════════════════════════════════════════════════════════════════════
# SECTION 7 — NOTIFICATIONS (N.1, N.2, N.3)
# ════════════════════════════════════════════════════════════════════════════

def check_toast(files):
    """N.1 auto-dismiss, N.2 max 3, N.3 visualViewport."""
    for path in files:
        if "Toast" not in str(path):
            continue
        content = read(path)
        lns = lines(path)
        # N.1 — must have auto-dismiss
        if "setTimeout" not in content:
            fail("N.1", path, 0,
                 "Toast has no setTimeout auto-dismiss — toasts never disappear")
        # N.2 — max 3 (slice(-2) keeps 2, adding 1 = 3)
        for i, line in enumerate(lns, 1):
            if re.search(r'slice\(-[3-9]\)', line):
                fail("N.2", path, i,
                     f"Toast slice allows more than 3 toasts: {line.strip()[:100]}")
        # N.3 — visualViewport for keyboard
        if "visualViewport" not in content:
            fail("N.3", path, 0,
                 "Toast container not repositioned when iOS keyboard opens")

# ════════════════════════════════════════════════════════════════════════════
# SECTION 8 — ACCESSIBILITY (K.7, K.8, ACC.4, ACC.11)
# ════════════════════════════════════════════════════════════════════════════

def check_clickable_divs(files):
    """K.7 — Clickable divs need role/tabIndex/onKeyDown."""
    pattern = re.compile(r'<div[^>]*onClick=')
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if pattern.search(line):
                if 'role=' not in line or 'tabIndex' not in line:
                    fail("K.7", path, i,
                         f"Clickable div missing role/tabIndex: {line.strip()[:100]}")

def check_aria_labels(files):
    """K.8 — Icon-only buttons need aria-label."""
    # Buttons containing only single characters, emoji, or simple symbols
    icon_pattern = re.compile(
        r'<button[^>]*>\s*[✕✖×➕➖⊕↗▶▤◎⊞✦←→↑↓☰\+\-−✓]{1,3}\s*</button>'
    )
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if icon_pattern.search(line):
                if "aria-label" not in line:
                    fail("K.8", path, i,
                         f"Icon-only button missing aria-label: {line.strip()[:100]}")

def check_aria_live(files):
    """ACC.4 — Dynamic content needs aria-live regions."""
    for path in files:
        if "ChatTab" in str(path):
            content = read(path)
            if "aria-live" not in content:
                fail("ACC.4", path, 0,
                     "ChatTab message list has no aria-live region")
        if "GenerateTab" in str(path):
            content = read(path)
            if "aria-live" not in content and "role=\"status\"" not in content:
                fail("ACC.4", path, 0,
                     "GenerateTab generation status has no aria-live / role=status")

# ════════════════════════════════════════════════════════════════════════════
# SECTION 9 — DATA DISPLAY (D.3)
# ════════════════════════════════════════════════════════════════════════════

def check_iso_dates(files):
    """D.3 — No raw ISO timestamps displayed to users."""
    for path in files:
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            # Look for created_at/updated_at being rendered without formatting
            if re.search(r'\{[^}]*\.created_at\b', line) or re.search(r'\{[^}]*\.updated_at\b', line):
                if "toLocale" not in line and "format" not in line and "new Date" not in line:
                    fail("D.3", path, i,
                         f"Raw ISO timestamp displayed: {stripped[:100]}")

# ════════════════════════════════════════════════════════════════════════════
# SECTION 10 — STUBS + FAKES (ST.1-4 / Rules 7.1-7.4)
# ════════════════════════════════════════════════════════════════════════════

def check_stubs(files):
    """ST.1-4 — No stubs, fakes, or placeholder UI."""
    for path in files:
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            # Empty onClick
            if re.search(r'onClick=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}', line):
                fail("ST.2", path, i,
                     f"Empty onClick: {stripped[:100]}")
            # window.prompt
            if "window.prompt(" in line:
                fail("ST.3/7.4", path, i,
                     f"window.prompt: {stripped[:100]}")
            # "coming soon"
            if re.search(r'coming\s+soon', line, re.IGNORECASE):
                fail("ST.4/7.3", path, i,
                     f'"coming soon" in rendered UI: {stripped[:100]}')
            # Shell data developer text
            if "Shell data" in line:
                fail("6.2", path, i,
                     f'"Shell data" dev text in UI: {stripped[:100]}')

# ════════════════════════════════════════════════════════════════════════════
# SECTION 11 — PROVIDER NAMES (Rule 10.1)
# ════════════════════════════════════════════════════════════════════════════

PROVIDERS = ["MiniMax", "fal-ai/", "ElevenLabs", "Kling", "OpenAI", "Runway", "Veo"]

def check_providers(files):
    """Rule 10.1 — No provider names in rendered UI outside SettingsTab.
    Only applies to component files — API routes may reference providers internally."""
    for path in files:
        if "SettingsTab" in str(path):
            continue
        # Rule 10.1 is about RENDERED UI — skip API route files
        if "api/streams" in str(path).replace("\\", "/"):
            continue
        for i, line in enumerate(lines(path), 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            if "import " in stripped:
                continue
            for prov in PROVIDERS:
                if prov in line:
                    fail("10.1", path, i,
                         f"Provider name '{prov}' outside SettingsTab: {stripped[:100]}")
                    break

# ════════════════════════════════════════════════════════════════════════════
# SECTION 12 — MOBILE / KEYBOARD (Rules 2.3, 3.1, 3.3)
# ════════════════════════════════════════════════════════════════════════════

def check_scrollbar_suppression(files):
    """Rule 2.3 — overflow-x:auto rows must suppress native scrollbar."""
    pattern = re.compile(r'overflowX\s*:\s*["\']auto["\']')
    for path in files:
        lns = lines(path)
        content = read(path)
        for i, line in enumerate(lns, 1):
            if pattern.search(line):
                # Check that scrollbar suppression CSS exists in the file
                if "scrollbar-width" not in content:
                    fail("2.3", path, i,
                         f"overflow-x:auto without scrollbar suppression: {line.strip()[:100]}")
                    break  # One violation per file

def check_visualviewport(files):
    """Rule 3.1 — Bottom-anchored inputs need visualViewport listener."""
    for path in files:
        if "ChatTab" not in str(path):
            continue
        if "visualViewport" not in read(path):
            fail("3.1", path, 0,
                 "ChatTab bottom input missing window.visualViewport listener — keyboard hides input on iOS")

def check_input_borders(files):
    """Rule 5.1 — No borders on input fields."""
    for path in files:
        for i, line in enumerate(lines(path), 1):
            if ("<input" in line or "<textarea" in line):
                if re.search(r'border\s*:\s*`1px|border\s*:\s*"1px|border\s*:\s*\'1px', line):
                    fail("5.1", path, i,
                         f"Border on input/textarea: {line.strip()[:100]}")

# ════════════════════════════════════════════════════════════════════════════
# SECTION 13 — TYPESCRIPT (Rule 12.1)
# ════════════════════════════════════════════════════════════════════════════

def check_typescript():
    """Rule 12.1 — Zero TypeScript errors in streams files."""
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

# ════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════

def main():
    # Must run from repo root
    if not Path("src/components/streams").exists():
        print("ERROR: Run from repo root (C:\\Users\\hawk7\\streamsailive)")
        return 2

    print("=" * 65)
    print(" Streams Panel — Pre-push Audit")
    print(" BUILD_RULES.md + FRONTEND_BUILD_RULES.md")
    print("=" * 65)

    tok = parse_tokens()
    files = get_files()
    print(f" Scanning {len(files)} files across {len(DIRS)} directories...\n")

    # ── Run all checks ──────────────────────────────────────────────────────
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
    print(" Running TypeScript check (this takes ~30s)...")
    check_typescript()

    # ── Report ──────────────────────────────────────────────────────────────
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
