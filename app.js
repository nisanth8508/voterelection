// ══════════════════════════════════════════════════════════════
//  ▶  STEP 1 — Paste your Supabase credentials below
//     Get them from: Supabase Dashboard → Project Settings → API
// ══════════════════════════════════════════════════════════════
const SUPABASE_URL  = "https://wnovzhtbtbesgdkxxlxx.supabase.co";   // ← replace
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub3Z6aHRidGJlc2dka3h4bHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNTA3MTgsImV4cCI6MjA5NjcyNjcxOH0.TJSfYZm1MRjVz7gsmltX4Bcdl1yLXYRaPWxsGJ1Kk44";                   // ← replace

// ══════════════════════════════════════════════════════════════
//  Admin password (change this to something secure)
// ══════════════════════════════════════════════════════════════
const ADMIN_ID = "admin1";

// ── Init Supabase client ──────────────────────────────────────
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── In-memory cache (loaded once from DB) ────────────────────
let candidates = [];
let voters     = [];
let currentVoterId = null;

// ══════════════════════════════════════════════════════════════
//  BOOT — load data then show login
// ══════════════════════════════════════════════════════════════
async function boot() {
  try {
    await Promise.all([loadCandidates(), loadVoters()]);
    showScreen("screen-login");
  } catch (e) {
    console.error(e);
    document.getElementById("screen-loading").innerHTML = `
      <div style="text-align:center;color:#fff;padding:40px 20px">
        <div style="font-size:3rem">⚠️</div>
        <h2 style="margin:16px 0 8px">Cannot connect to database</h2>
        <p style="opacity:.8;max-width:340px;margin:0 auto">
          Check your <strong>SUPABASE_URL</strong> and <strong>SUPABASE_ANON</strong>
          values in <code>app.js</code>, then refresh the page.
        </p>
        <p style="opacity:.6;margin-top:12px;font-size:.85rem">${e.message}</p>
      </div>`;
  }
}

// ══════════════════════════════════════════════════════════════
//  DATABASE HELPERS
// ══════════════════════════════════════════════════════════════
async function loadCandidates() {
  const { data, error } = await db.from("candidates").select("*").order("id");
  if (error) throw error;
  candidates = data;
}

async function loadVoters() {
  const { data, error } = await db.from("voters").select("*").order("id");
  if (error) throw error;
  voters = data;
}

// ══════════════════════════════════════════════════════════════
//  SCREEN HELPERS
// ══════════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function logout() {
  currentVoterId = null;
  document.getElementById("login-id").value = "";
  document.getElementById("login-error").classList.add("hidden");
  showScreen("screen-login");
}

function showError(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }

// ══════════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════════
async function handleLogin() {
  const id  = document.getElementById("login-id").value.trim();
  const err = document.getElementById("login-error");
  if (!id) { showError(err, "Please enter your ID."); return; }

  if (id === ADMIN_ID) {
    err.classList.add("hidden");
    await renderAdmin();
    showScreen("screen-admin");
    return;
  }

  const voter = voters.find(v => v.voter_id === id);
  if (!voter)           { showError(err, "ID not found. Please check and try again."); return; }
  if (voter.has_voted)  { showError(err, "You have already cast your vote. Thank you!"); return; }

  currentVoterId = id;
  err.classList.add("hidden");
  renderVoterScreen();
  showScreen("screen-voter");
}

document.getElementById("login-id").addEventListener("keydown", e => {
  if (e.key === "Enter") handleLogin();
});

// ══════════════════════════════════════════════════════════════
//  VOTER SCREEN
// ══════════════════════════════════════════════════════════════
function renderVoterScreen() {
  const grid = document.getElementById("candidate-cards");
  grid.innerHTML = "";
  document.getElementById("voter-msg").classList.add("hidden");

  candidates.forEach((c, i) => {
    const card = document.createElement("div");
    card.className = "cand-card";
    card.innerHTML = `
      <div class="cand-num">${i + 1}</div>
      <div class="cand-name">${esc(c.name)}</div>
      <div class="cand-party">${esc(c.party)}</div>`;
    card.addEventListener("click", () => castVote(c));
    grid.appendChild(card);
  });
}

async function castVote(candidate) {
  if (!currentVoterId) return;
  const voter = voters.find(v => v.voter_id === currentVoterId);
  if (!voter || voter.has_voted) return;

  // Disable all cards while saving
  document.querySelectorAll(".cand-card").forEach(c => c.style.pointerEvents = "none");

  // 1. Increment votes on candidates table
  const { error: e1 } = await db
    .from("candidates")
    .update({ votes: candidate.votes + 1 })
    .eq("id", candidate.id);

  // 2. Mark voter as voted
  const { error: e2 } = await db
    .from("voters")
    .update({ has_voted: true })
    .eq("id", voter.id);

  if (e1 || e2) {
    showToast("❌ Error saving vote. Please try again.");
    document.querySelectorAll(".cand-card").forEach(c => c.style.pointerEvents = "");
    return;
  }

  // Update local cache
  candidate.votes++;
  voter.has_voted = true;

  document.getElementById("candidate-cards").innerHTML = "";
  const msg = document.getElementById("voter-msg");
  msg.textContent = `✅ Your vote for "${candidate.name}" has been recorded. Thank you!`;
  msg.classList.remove("hidden");
  showToast("Vote recorded successfully!");
  setTimeout(() => logout(), 3000);
}

// ══════════════════════════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════════════════════════
async function renderAdmin() {
  await Promise.all([loadCandidates(), loadVoters()]);
  renderResults();
  renderCandidatesList();
  renderVotersList();
  resetCandidateForm();
  resetVoterForm();
}

// ── Tabs ──────────────────────────────────────────────────────
function showTab(tabId, btn) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  btn.classList.add("active");
  if (tabId === "tab-results")    renderResults();
  if (tabId === "tab-candidates") renderCandidatesList();
  if (tabId === "tab-voters")     renderVotersList();
}

// ── Results ───────────────────────────────────────────────────
function renderResults() {
  const total = candidates.reduce((s, c) => s + (c.votes || 0), 0);
  const container = document.getElementById("results-container");
  container.innerHTML = "";

  if (candidates.length === 0) {
    container.innerHTML = `<p style="color:var(--muted);text-align:center;padding:32px 0">No candidates yet.</p>`;
    return;
  }

  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  sorted.forEach((c, rank) => {
    const pct = total > 0 ? Math.round((c.votes / total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `
      <div class="r-top">
        <div>
          <div class="r-name">${rank === 0 && total > 0 ? "🥇 " : ""}${esc(c.name)}</div>
          <div class="r-party">${esc(c.party)}</div>
        </div>
        <div class="r-count">${c.votes} <span style="font-size:.8rem;font-weight:500;color:var(--muted)">(${pct}%)</span></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
    container.appendChild(row);
  });

  const foot = document.createElement("div");
  foot.style.cssText = "text-align:right;color:var(--muted);font-size:.85rem;margin-top:8px";
  foot.textContent = `Total votes cast: ${total} / ${voters.length}`;
  container.appendChild(foot);
}

async function resetVotes() {
  if (!confirm("Reset ALL votes? This cannot be undone.")) return;

  const { error: e1 } = await db.from("candidates").update({ votes: 0 }).neq("id", 0);
  const { error: e2 } = await db.from("voters").update({ has_voted: false }).neq("id", 0);

  if (e1 || e2) { showToast("❌ Reset failed. Check console."); return; }

  await Promise.all([loadCandidates(), loadVoters()]);
  renderResults();
  showToast("All votes have been reset.");
}

// ── Candidates ────────────────────────────────────────────────
function renderCandidatesList() {
  const list = document.getElementById("candidates-list");
  list.innerHTML = "";
  if (candidates.length === 0) {
    list.innerHTML = `<p style="color:var(--muted);text-align:center;padding:24px 0">No candidates yet.</p>`;
    return;
  }
  candidates.forEach(c => {
    const row = document.createElement("div");
    row.className = "manage-row";
    row.innerHTML = `
      <div class="m-info">
        <div class="m-id">ID: ${c.id}</div>
        <div class="m-name">${esc(c.name)}</div>
        <div class="m-sub">${esc(c.party)} · ${c.votes} vote(s)</div>
      </div>
      <div class="m-actions">
        <button class="btn-icon" onclick='editCandidate(${JSON.stringify(c)})'>✏️ Edit</button>
        <button class="btn-icon del" onclick="deleteCandidate(${c.id}, '${esc(c.name)}')">🗑 Remove</button>
      </div>`;
    list.appendChild(row);
  });
}

async function saveCandidate() {
  const name  = document.getElementById("cand-name").value.trim();
  const party = document.getElementById("cand-party").value.trim() || "Independent";
  const editId = document.getElementById("cand-edit-id").value;

  if (!name) { showToast("Please enter a candidate name."); return; }

  setBtnLoading("cand-save-btn", true);

  if (!editId) {
    const { error } = await db.from("candidates").insert({ name, party, votes: 0 });
    if (error) { showToast("❌ " + error.message); setBtnLoading("cand-save-btn", false); return; }
    showToast("Candidate added!");
  } else {
    const { error } = await db.from("candidates").update({ name, party }).eq("id", editId);
    if (error) { showToast("❌ " + error.message); setBtnLoading("cand-save-btn", false); return; }
    showToast("Candidate updated!");
  }

  await loadCandidates();
  renderCandidatesList();
  renderResults();
  resetCandidateForm();
  setBtnLoading("cand-save-btn", false);
}

function editCandidate(c) {
  document.getElementById("cand-name").value  = c.name;
  document.getElementById("cand-party").value = c.party;
  document.getElementById("cand-edit-id").value = c.id;
  document.getElementById("candidate-form-title").textContent = "Edit Candidate";
  document.getElementById("cand-name").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteCandidate(id, name) {
  if (!confirm(`Remove candidate "${name}"? Their votes will be lost.`)) return;
  const { error } = await db.from("candidates").delete().eq("id", id);
  if (error) { showToast("❌ " + error.message); return; }
  await loadCandidates();
  renderCandidatesList();
  renderResults();
  showToast("Candidate removed.");
}

function resetCandidateForm() {
  document.getElementById("cand-name").value  = "";
  document.getElementById("cand-party").value = "";
  document.getElementById("cand-edit-id").value = "";
  document.getElementById("candidate-form-title").textContent = "Add Candidate";
}
function cancelCandidateEdit() { resetCandidateForm(); }

// ── Voters ────────────────────────────────────────────────────
function renderVotersList() {
  const list = document.getElementById("voters-list");
  list.innerHTML = "";
  if (voters.length === 0) {
    list.innerHTML = `<p style="color:var(--muted);text-align:center;padding:24px 0">No voters registered yet.</p>`;
    return;
  }
  voters.forEach(v => {
    const row = document.createElement("div");
    row.className = "manage-row";
    row.innerHTML = `
      <div class="m-info">
        <div class="m-id">ID: ${esc(v.voter_id)}</div>
        <div class="m-name">${esc(v.name)}</div>
        <div class="m-sub">${v.has_voted
          ? '<span style="color:var(--success)">✅ Voted</span>'
          : '<span style="color:var(--muted)">⏳ Not voted</span>'}</div>
      </div>
      <div class="m-actions">
        <button class="btn-icon" onclick='editVoter(${JSON.stringify(v)})'>✏️ Edit</button>
        <button class="btn-icon del" onclick="deleteVoter(${v.id}, '${esc(v.name)}')">🗑 Remove</button>
      </div>`;
    list.appendChild(row);
  });
}

async function saveVoter() {
  const newVoterId = document.getElementById("new-voter-id").value.trim();
  const name       = document.getElementById("new-voter-name").value.trim();
  const rowId      = document.getElementById("voter-edit-row-id").value;

  if (!newVoterId) { showToast("Please enter a Voter ID."); return; }
  if (!name)       { showToast("Please enter a voter name."); return; }

  // Check duplicate voter_id
  const dup = voters.find(v => v.voter_id === newVoterId && String(v.id) !== rowId);
  if (dup) { showToast("That Voter ID already exists."); return; }

  if (!rowId) {
    const { error } = await db.from("voters").insert({ voter_id: newVoterId, name, has_voted: false });
    if (error) { showToast("❌ " + error.message); return; }
    showToast("Voter registered!");
  } else {
    const { error } = await db.from("voters").update({ voter_id: newVoterId, name }).eq("id", rowId);
    if (error) { showToast("❌ " + error.message); return; }
    showToast("Voter updated!");
  }

  await loadVoters();
  renderVotersList();
  resetVoterForm();
}

function editVoter(v) {
  document.getElementById("new-voter-id").value    = v.voter_id;
  document.getElementById("new-voter-name").value  = v.name;
  document.getElementById("voter-edit-row-id").value = v.id;
  document.getElementById("voter-form-title").textContent = "Edit Voter";
  document.getElementById("new-voter-id").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteVoter(id, name) {
  if (!confirm(`Remove voter "${name}"?`)) return;
  const { error } = await db.from("voters").delete().eq("id", id);
  if (error) { showToast("❌ " + error.message); return; }
  await loadVoters();
  renderVotersList();
  showToast("Voter removed.");
}

function resetVoterForm() {
  document.getElementById("new-voter-id").value    = "";
  document.getElementById("new-voter-name").value  = "";
  document.getElementById("voter-edit-row-id").value = "";
  document.getElementById("voter-form-title").textContent = "Register Voter";
}
function cancelVoterEdit() { resetVoterForm(); }

// ══════════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2800);
}

function setBtnLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "Saving…" : "Save";
}

function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Start app ─────────────────────────────────────────────────
boot();
