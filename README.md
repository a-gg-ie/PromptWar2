# 🗳️ VoteSmartIndia — Election Process Assistant

A free, interactive web app that helps **first-time voters in India** understand the full election process — from voter registration to result declaration.

Built with **Python (Flask)** + **Google Gemini AI** + **Google Sheets**.

---

## ✨ Features

| Feature | Description |
|---|---|
| 💬 **AI Chat** | Ask any election question in plain English |
| 🗓 **Election Timeline** | Click each step (Nomination → Results) for a simple explanation |
| ✅ **Eligibility Checker** | Answer 3 questions to know if you can vote |
| 🔍 **Myth vs Fact** | Type a myth — AI tells you if it's true or false |

---

## 📁 Project Structure

```
PromptWar2/
├── app.py                   Main Flask server
├── requirements.txt         Python packages
├── .env.example             Template for your API keys
├── .gitignore
├── README.md
├── config/
│   └── sheets_creds.json    Google Service Account key (you provide)
├── data/
│   └── election_steps.json  Timeline content
├── static/
│   ├── css/style.css
│   └── js/main.js
└── templates/
    └── index.html
```

---

## 🚀 Step-by-Step Setup

### Step 1 — Clone or download the project

If you're using Git:
```bash
git clone <your-repo-url>
cd PromptWar2
```
Or just download and unzip the folder, then open a terminal inside it.

---

### Step 2 — Create a Python virtual environment

A virtual environment keeps your project's packages separate from the rest of your computer.

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac / Linux
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` at the start of your terminal prompt.

---

### Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

---

### Step 4 — Get your Gemini API key (free)

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API key"** → copy the key

---

### Step 5 — Create your `.env` file

In the project folder, copy the example file:

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Then open `.env` in any text editor and paste your Gemini API key:

```
GEMINI_API_KEY=paste_your_key_here
```

---

### Step 6 — (Optional) Set up Google Sheets logging

> **This step is optional.** The app works perfectly without it — it just won't log questions to a spreadsheet.

If you want question logging:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Google Sheets API** and **Google Drive API**
4. Go to **IAM & Admin → Service Accounts → Create Service Account**
5. Give it a name, click through, then create a **JSON key**
6. Save the JSON file as `config/sheets_creds.json` in this project
7. Create a new [Google Sheet](https://sheets.google.com), copy its ID from the URL:
   - URL looks like: `https://docs.google.com/spreadsheets/d/`**`THIS_IS_THE_ID`**`/edit`
8. Share the sheet with the **service account email** (found in the JSON file, looks like `name@project.iam.gserviceaccount.com`) — give it **Editor** access
9. Add the Sheet ID to your `.env`:
   ```
   GOOGLE_SHEET_ID=paste_your_sheet_id_here
   GOOGLE_CREDS_FILE=config/sheets_creds.json
   ```

---

### Step 7 — Run the app

```bash
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

Open your browser and go to: **[http://localhost:5000](http://localhost:5000)**

---

## 🛑 Stopping the App

Press `Ctrl + C` in the terminal to stop the Flask server.

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| `ModuleNotFoundError` | Make sure your virtual environment is activated and you ran `pip install -r requirements.txt` |
| `GEMINI_API_KEY not configured` | Check that your `.env` file exists and has the key |
| Sheets logging not working | Double-check that the service account email has Editor access on the sheet |
| Port already in use | Change `port=5000` to `port=5001` in the last line of `app.py` |

---

## 📚 Useful Links

- [Voter Registration Portal](https://voterportal.eci.gov.in)
- [Election Commission of India](https://eci.gov.in)
- [SVEEP — Voter Education](https://ecisveep.nic.in)
- [Gemini API Docs](https://ai.google.dev/docs)

---

## ⚠️ Disclaimer

This app is for **educational purposes only** and is not affiliated with or endorsed by the Election Commission of India.