from pathlib import Path

p = Path("src/components/account/StreamsAccountActionPanel.module.css")
s = p.read_text(encoding="utf-8")

# Replace shell block with scroll-safe mobile-first shell.
start = s.find(".shell {")
end = s.find("\n}\n\n.shell[data-gradient", start)

if start == -1 or end == -1:
    raise SystemExit("Could not find .shell block")

new_shell = '''.shell {
  --page-accent: #7c3aed;
  --page-accent-2: #06b6d4;
  width: 100%;
  min-height: 100svh;
  min-height: 100dvh;
  height: auto;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  padding:
    max(16px, env(safe-area-inset-top))
    max(10px, env(safe-area-inset-right))
    max(28px, env(safe-area-inset-bottom))
    max(10px, env(safe-area-inset-left));
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--page-accent) 15%, transparent), transparent 28%),
    radial-gradient(circle at 92% 12%, color-mix(in srgb, var(--page-accent-2) 16%, transparent), transparent 32%),
    linear-gradient(180deg, #f7f7f8 0%, #efeff2 100%);
  color: #0a0a0b;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  scroll-padding-bottom: max(32px, env(safe-area-inset-bottom));
}'''

s = s[:start] + new_shell + s[end + 2:]

# Add global mobile-first hardening once.
mobile_hardening = '''
/* Mobile-first scroll/layout hardening */
.shell * {
  box-sizing: border-box;
}

.shell button,
.shell input,
.shell select,
.shell textarea,
.shell a {
  min-height: 44px;
}

.hero,
.grid,
.liveDataGrid,
.proofBar,
.groupCard,
.section {
  width: min(1120px, 100%);
}

.heroActions,
.groupActions {
  touch-action: manipulation;
}

.card,
.liveDataGrid article,
.groupCard,
.section,
.proofBar {
  max-width: 100%;
}

.groupCard input,
.formGrid input,
.formGrid textarea,
.formGrid select {
  font-size: 16px;
}

@supports (height: 100svh) {
  .shell {
    min-height: 100svh;
  }
}

@media (max-width: 680px) {
  .shell {
    display: block;
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: calc(28px + env(safe-area-inset-bottom));
  }

  .hero,
  .card,
  .liveDataGrid article,
  .proofBar,
  .groupCard,
  .section {
    width: 100%;
    max-width: 100%;
  }

  .hero {
    min-height: auto;
  }

  .heroActions {
    position: sticky;
    bottom: calc(8px + env(safe-area-inset-bottom));
    z-index: 5;
    padding: 8px;
    margin-inline: -8px;
    border-radius: 22px;
    background: rgba(255,255,255,.72);
    backdrop-filter: blur(18px);
    box-shadow: 0 12px 38px rgba(0,0,0,.12);
  }

  .grid,
  .liveDataGrid,
  .groupCard,
  .section {
    margin-top: 10px;
  }

  .card {
    min-height: auto;
  }

  .rows div,
  .proofBar {
    gap: 6px;
  }

  .groupCard label {
    width: 100%;
  }
}
'''

if "Mobile-first scroll/layout hardening" not in s:
    s = s.rstrip() + "\n\n" + mobile_hardening + "\n"

p.write_text(s, encoding="utf-8")

# Add account layout safety if layout exists.
layout = Path("src/app/account/layout.tsx")
if layout.exists():
    t = layout.read_text(encoding="utf-8")
    if "account-scroll-root" not in t:
        t = t.replace(
            "{children}",
            '<div className="account-scroll-root">{children}</div>'
        )
        layout.write_text(t, encoding="utf-8")

# Add a tiny global style for account-scroll-root if globals exists.
globals_css = Path("src/app/globals.css")
if globals_css.exists():
    g = globals_css.read_text(encoding="utf-8")
    if ".account-scroll-root" not in g:
        g += '''

.account-scroll-root {
  min-height: 100svh;
  min-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
'''
        globals_css.write_text(g, encoding="utf-8")

print("Fixed account pages mobile-first scrolling and safe-area behavior.")
