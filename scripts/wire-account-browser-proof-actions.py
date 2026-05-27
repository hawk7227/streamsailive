from pathlib import Path

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

panel = "src/components/account/StreamsAccountActionPanel.tsx"
s = read(panel)

# Add callGroupChatWithActivity import if missing.
if "callGroupChatWithActivity" not in s.split('from "@/components/streams-ai/current-chat/new-face/runtime/streamsAccountActivityClient";')[0]:
    s = s.replace(
'''  fetchProjectsWithActivity,
  emitGitHubBuildBlockedActivity,
} from "@/components/streams-ai/current-chat/new-face/runtime/streamsAccountActivityClient";''',
'''  fetchProjectsWithActivity,
  callGroupChatWithActivity,
  emitGitHubBuildBlockedActivity,
} from "@/components/streams-ai/current-chat/new-face/runtime/streamsAccountActivityClient";'''
    )

# Add local proof/test state.
if 'const [lastAction, setLastAction] = useState("");' not in s:
    s = s.replace(
'''  const [projects, setProjects] = useState<unknown>(null);
  const [error, setError] = useState("");''',
'''  const [projects, setProjects] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [groupSessionId, setGroupSessionId] = useState("");
  const [groupEmail, setGroupEmail] = useState("");
  const [groupName, setGroupName] = useState("STREAMS Group Chat");'''
    )

# Strengthen action handlers with visible proof state.
s = s.replace(
'''  async function loadAccount() {
    setError("");
    try {
      setAccount(await fetchAccountWithActivity());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account loading failed.");
    }
  }''',
'''  async function loadAccount() {
    setError("");
    setLastAction("Loading account...");
    try {
      setAccount(await fetchAccountWithActivity());
      setLastAction("Account loaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Account loading failed.";
      setError(message);
      setLastAction(message);
    }
  }'''
)

s = s.replace(
'''  async function loadCredits() {
    setError("");
    try {
      setCredits(await fetchCreditsWithActivity());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credits loading failed.");
    }
  }''',
'''  async function loadCredits() {
    setError("");
    setLastAction("Loading credits...");
    try {
      setCredits(await fetchCreditsWithActivity());
      setLastAction("Credits loaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Credits loading failed.";
      setError(message);
      setLastAction(message);
    }
  }'''
)

s = s.replace(
'''  async function loadProjects() {
    setError("");
    try {
      setProjects(await fetchProjectsWithActivity());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Projects loading failed.");
    }
  }''',
'''  async function loadProjects() {
    setError("");
    setLastAction("Loading projects...");
    try {
      setProjects(await fetchProjectsWithActivity());
      setLastAction("Projects loaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Projects loading failed.";
      setError(message);
      setLastAction(message);
    }
  }

  async function openPortal() {
    setError("");
    setLastAction("Opening billing portal...");
    try {
      await openBillingPortalWithActivity();
      setLastAction("Billing portal redirect started.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Billing portal failed.";
      setError(message);
      setLastAction(message);
    }
  }

  async function startCheckout(source: string, product?: string) {
    setError("");
    setLastAction("Starting checkout...");
    try {
      await startCheckoutWithActivity({ source, product });
      setLastAction("Checkout redirect started.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed.";
      setError(message);
      setLastAction(message);
    }
  }

  async function runGroupChatTest(action: "create" | "invite" | "remove" | "leave" | "rename") {
    setError("");
    setLastAction(`${action} group chat...`);

    try {
      await callGroupChatWithActivity({
        sessionId: groupSessionId,
        action,
        email: groupEmail,
        name: groupName,
      });
      setLastAction(`Group chat ${action} complete.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Group chat ${action} failed.`;
      setError(message);
      setLastAction(message);
    }
  }'''
)

# Replace direct billing action calls with named proof handlers.
s = s.replace(
'''        { label: "Open billing portal", action: () => openBillingPortalWithActivity().catch((err) => setError(err.message)) },
        { label: "Start checkout", action: () => startCheckoutWithActivity({ source: "account_billing" }).catch((err) => setError(err.message)) },''',
'''        { label: "Open billing portal", action: openPortal },
        { label: "Start checkout", action: () => startCheckout("account_billing") },'''
)

s = s.replace(
'''        { label: "Buy credits", action: () => startCheckoutWithActivity({ source: "account_credits", product: "credits" }).catch((err) => setError(err.message)) },''',
'''        { label: "Buy credits", action: () => startCheckout("account_credits", "credits") },'''
)

# Add last-action proof card and group-chat test card before final section.
if 'className={styles.groupCard}' not in s:
    s = s.replace(
'''      <section className={styles.section}>
        <h2>{title} actions</h2>''',
'''      <section className={styles.proofBar}>
        <strong>Last action</strong>
        <span>{lastAction || "No account action has run yet."}</span>
      </section>

      <section className={styles.groupCard}>
        <div>
          <p className={styles.kicker}>Group chat backend test</p>
          <h2>Real session test</h2>
          <p>
            This calls /api/streams-ai/group-chat against a real session id and emits group chat activity events.
          </p>
        </div>

        <label>
          Session ID
          <input
            value={groupSessionId}
            onChange={(event) => setGroupSessionId(event.target.value)}
            placeholder="Paste a real STREAMS chat session id"
          />
        </label>

        <label>
          Invite email
          <input
            value={groupEmail}
            onChange={(event) => setGroupEmail(event.target.value)}
            placeholder="person@example.com"
            type="email"
          />
        </label>

        <label>
          Group name
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="STREAMS Group Chat"
          />
        </label>

        <div className={styles.groupActions}>
          <button type="button" onClick={() => runGroupChatTest("create")}>Create group</button>
          <button type="button" onClick={() => runGroupChatTest("invite")}>Invite</button>
          <button type="button" onClick={() => runGroupChatTest("rename")}>Rename</button>
          <button type="button" onClick={() => runGroupChatTest("remove")}>Remove</button>
          <button type="button" onClick={() => runGroupChatTest("leave")}>Leave</button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{title} actions</h2>'''
    )

write(panel, s)

css = "src/components/account/StreamsAccountActionPanel.module.css"
c = read(css)

if ".proofBar" not in c:
    c += '''
.proofBar {
  max-width: 1120px;
  margin: 0 auto 14px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 18px;
  background: #fff;
  padding: 14px 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,.04);
}

.proofBar strong {
  white-space: nowrap;
}

.proofBar span {
  color: #555;
  text-align: right;
}

.groupCard {
  max-width: 1120px;
  margin: 14px auto 0;
  display: grid;
  grid-template-columns: 1.2fr repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 26px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 10px 32px rgba(0,0,0,.05);
}

.groupCard h2 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -.03em;
}

.groupCard p {
  color: #555;
  line-height: 1.45;
}

.groupCard label {
  display: grid;
  gap: 6px;
  color: #555;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.groupCard input {
  min-height: 44px;
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 14px;
  padding: 0 12px;
  font-size: 14px;
  text-transform: none;
}

.groupActions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.groupActions button {
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: #111;
  color: #fff;
  padding: 0 16px;
  font-weight: 800;
  cursor: pointer;
}

@media (max-width: 860px) {
  .proofBar {
    display: grid;
  }

  .proofBar span {
    text-align: left;
  }

  .groupCard {
    grid-template-columns: 1fr;
    border-radius: 22px;
  }

  .groupActions button {
    flex: 1;
  }
}
'''

write(css, c)

print("Wired browser-proof account billing credits projects GitHub group-chat actions.")
