# 🗄️ VoteDesk — Supabase Setup Guide

Follow these steps once. Takes about 10 minutes.

---

## STEP 1 — Create a Free Supabase Project

1. Go to https://supabase.com and sign up (free)
2. Click **New Project**
3. Give it a name e.g. `votedesk`
4. Set a database password (save it)
5. Choose a region closest to you
6. Click **Create Project** and wait ~2 minutes

---

## STEP 2 — Create the Tables

Go to **SQL Editor** in the left sidebar and run this SQL:

```sql
-- Candidates table
CREATE TABLE candidates (
  id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name   TEXT NOT NULL,
  party  TEXT NOT NULL DEFAULT 'Independent',
  votes  INT  NOT NULL DEFAULT 0
);

-- Voters table
CREATE TABLE voters (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  voter_id  TEXT NOT NULL UNIQUE,
  name      TEXT NOT NULL,
  has_voted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Optional: seed default data
INSERT INTO candidates (name, party) VALUES
  ('Candidate 1', 'Party A'),
  ('Candidate 2', 'Party B'),
  ('Candidate 3', 'Party C');

INSERT INTO voters (voter_id, name) VALUES
  ('7321',   'Voter One'),
  ('732122', 'Voter Two'),
  ('001',    'Voter Three'),
  ('002',    'Voter Four');
```

Click **Run** (▶️).

---

## STEP 3 — Disable Row Level Security (for simplicity)

In Supabase → **Table Editor** → click each table → **RLS** → toggle OFF.

> For production use, enable RLS and add proper policies.

---

## STEP 4 — Get Your API Keys

1. Go to **Project Settings** (⚙️ gear icon) → **API**
2. Copy:
   - **Project URL** → looks like `https://abcxyz.supabase.co`
   - **anon / public key** → long string starting with `eyJ...`

---

## STEP 5 — Paste Keys into app.js

Open `app.js` and replace lines 5–6:

```js
const SUPABASE_URL  = "https://YOUR_PROJECT_ID.supabase.co";  // ← your URL
const SUPABASE_ANON = "YOUR_ANON_PUBLIC_KEY";                  // ← your anon key
```

---

## STEP 6 — Open index.html in your browser

That's it! The app will connect to Supabase automatically.
All votes, candidates, and voters are now stored in the cloud.

---

## 🔒 Security Note

The `anon` key is safe to put in front-end code — it only has
limited access. Never put your `service_role` key in the browser.

