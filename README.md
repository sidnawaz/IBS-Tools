# IBS Structural Tools 🏗️
### Integrated Building Services — ibuildings.in

Browser-based IS code structural design calculators. **No installation. No login. No server.** Open and use directly in any browser.

## 🔗 Live URL
> `https://<your-github-username>.github.io/ibs-tools/`

---

## Tools Available

| Tool | Code | Status | IS Codes |
|---|---|---|---|
| 🏗️ [RCC Slab Design](slab-design/) | IBS-TOOL-001 | ✅ Live | IS 456, IS 875 |
| 🧱 [Retaining Wall Design](retaining-wall/) | IBS-TOOL-002 | ✅ Live | IS 456, IS 875 Pt.5 |
| 🏛️ Isolated Footing | IBS-TOOL-003 | ⏳ Soon | IS 456, IS 1904 |
| 🏢 Column Design | IBS-TOOL-004 | ⏳ Soon | IS 456, SP 16 |
| 📏 Beam Design | IBS-TOOL-005 | 📋 Planned | IS 456, SP 16 |
| 🪜 Staircase Design | IBS-TOOL-006 | 📋 Planned | IS 456 |

---

## File Structure

```
ibs-tools/
├── index.html                    ← Hub / Landing Page
├── slab-design/
│   ├── index.html
│   ├── css/style.css
│   ├── js/engine.js              ← IS 456 slab design engine
│   ├── js/app.js
│   └── data/is875_loads.js       ← IS 875 Part 2 load database
├── retaining-wall/
│   ├── index.html
│   ├── css/rw_style.css
│   ├── js/rw_engine.js           ← Rankine earth pressure engine
│   ├── js/rw_app.js
│   └── data/rw_data.js           ← Soil & material database
└── .github/workflows/deploy.yml  ← Auto GitHub Pages deployment
```

---

## How to Deploy

### Step 1 — Create GitHub Repository
1. Go to **github.com** → New Repository
2. Name it: `ibs-tools`
3. Set visibility: **Public** (required for free GitHub Pages)
4. Click **Create Repository**

### Step 2 — Upload Files
**Option A — GitHub Web UI (easiest):**
1. Open the new repo → click **uploading an existing file**
2. Drag and drop the entire `ibs-tools` folder contents
3. Commit with message: `Initial release — IBS Structural Tools`

**Option B — Git Command Line:**
```bash
cd ibs-tools
git init
git add .
git commit -m "Initial release — IBS Structural Tools"
git branch -M main
git remote add origin https://github.com/<username>/ibs-tools.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages
1. Go to repo → **Settings** → **Pages**
2. Source: **Deploy from a branch** → **main** → **/ (root)**
3. Save → Wait ~2 minutes
4. Your site is live at: `https://<username>.github.io/ibs-tools/`

> The included `deploy.yml` will **automatically redeploy** every time you push changes.

---

## IS Code References

| Code | Description |
|---|---|
| IS 456 : 2000 | Plain & Reinforced Concrete |
| IS 875 Part 1 : 1987 | Dead Loads — Unit Weights |
| IS 875 Part 2 : 1987 | Imposed / Live Loads |
| IS 875 Part 5 : 1987 | Special Loads — Earth & Hydrostatic |
| SP 16 : 1980 | Design Aids for IS 456 |
| IS 1904 : 1986 | Design of Foundations |

---

## Disclaimer
Results are for **preliminary design guidance only**. All designs must be verified by a qualified structural engineer per applicable Indian Standards before execution. Integrated Building Services (IBS) accepts no liability for direct application of these results.

---

**Integrated Building Services (IBS)**  
Structural Consultancy · PMC · BIM Services · Mumbai  
📧 shahnawaz@ibuildings.in
