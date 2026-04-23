"""
app.py — Main Flask server for the Election Process Assistant
Handles all routes and connects to Gemini AI + Google Sheets
"""

import os
import json
import datetime
from flask import Flask, request, jsonify, render_template

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Google Generative AI (Gemini) — new official SDK
from google import genai
from google.genai import types

# Google Sheets (optional — app works even if this fails)
try:
    import gspread
    from google.oauth2.service_account import Credentials
    SHEETS_AVAILABLE = True
except ImportError:
    SHEETS_AVAILABLE = False

# ─────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────

app = Flask(__name__)

# Read Gemini API key from .env
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Build the Gemini client (will be None if no key is set)
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# This is the system prompt that shapes the AI's personality and behaviour
SYSTEM_PROMPT = (
    "You are a friendly Indian election guide. Explain everything simply "
    "for a first-time voter. Never discuss political parties or candidates. "
    "Keep all answers under 4 sentences. Always end with one actionable "
    "next step the user can take."
)


# ─────────────────────────────────────────────
# Google Sheets Setup (Optional)
# ─────────────────────────────────────────────

def get_sheet():
    """
    Connects to the Google Sheet for logging questions.
    Returns the worksheet object, or None if credentials are missing or invalid.
    This is OPTIONAL — the app still works if this returns None.
    """
    if not SHEETS_AVAILABLE:
        return None

    creds_file = os.getenv("GOOGLE_CREDS_FILE", "config/sheets_creds.json")
    sheet_id   = os.getenv("GOOGLE_SHEET_ID", "")

    if not sheet_id or not os.path.exists(creds_file):
        return None  # Silently skip logging — credentials not set up

    try:
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]
        creds  = Credentials.from_service_account_file(creds_file, scopes=scopes)
        client = gspread.authorize(creds)
        sheet  = client.open_by_key(sheet_id).sheet1
        return sheet
    except Exception as e:
        print(f"[Sheets] Could not connect: {e}")
        return None


def log_to_sheet(question_type, user_message, ai_response):
    """
    Appends a single row to Google Sheets with timestamp and Q&A details.
    Silently does nothing if Google Sheets is not configured.
    """
    sheet = get_sheet()
    if sheet is None:
        return  # Sheets not configured — skip logging

    try:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sheet.append_row([timestamp, question_type, user_message, ai_response])
    except Exception as e:
        print(f"[Sheets] Failed to log row: {e}")


# ─────────────────────────────────────────────
# Gemini Helper
# ─────────────────────────────────────────────

def ask_gemini(user_message, extra_instructions=""):
    """
    Sends a message to Gemini and returns the text response.
    Combines the global system prompt with any extra task-specific instructions.
    Returns an error string if the API call fails.
    """
    if not gemini_client:
        return "❌ Gemini API key not configured. Please add GEMINI_API_KEY to your .env file."

    try:
        system_text = SYSTEM_PROMPT
        if extra_instructions:
            system_text += " " + extra_instructions

        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_text,
            ),
        )
        return response.text.strip()
    except Exception as e:
        return f"❌ Sorry, I couldn't get an answer right now. Error: {str(e)}"


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.route("/")
def index():
    """Serves the main single-page HTML app."""
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Handles general election Q&A.
    Accepts: { "message": "How do I register to vote?" }
    Returns: { "reply": "..." }
    """
    data    = request.get_json()
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"error": "Message cannot be empty"}), 400

    reply = ask_gemini(message)

    # Log the Q&A to Google Sheets (silently skipped if not configured)
    log_to_sheet("chat", message, reply)

    return jsonify({"reply": reply})


@app.route("/api/timeline/<step_id>", methods=["GET"])
def timeline_step(step_id):
    """
    Returns the explanation for a clicked election timeline step.
    Reads from data/election_steps.json — no AI call needed for static content.
    """
    try:
        with open("data/election_steps.json", "r", encoding="utf-8") as f:
            steps = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Timeline data file not found"}), 500

    # Search for the step that matches the requested id
    for step in steps:
        if step["id"] == step_id:
            return jsonify(step)

    return jsonify({"error": f"Step '{step_id}' not found"}), 404


@app.route("/api/timeline", methods=["GET"])
def timeline_all():
    """
    Returns all timeline steps at once (used on page load to build the timeline).
    """
    try:
        with open("data/election_steps.json", "r", encoding="utf-8") as f:
            steps = json.load(f)
        return jsonify(steps)
    except FileNotFoundError:
        return jsonify({"error": "Timeline data file not found"}), 500


@app.route("/api/eligibility", methods=["POST"])
def eligibility():
    """
    Checks if the user is eligible to vote based on 3 answers.
    Accepts: { "age": 20, "citizen": true, "resident": true }
    Returns: { "eligible": true/false, "message": "...", "next_step": "..." }
    """
    data     = request.get_json()
    age      = int(data.get("age", 0))
    citizen  = data.get("citizen", False)   # Boolean: is Indian citizen?
    resident = data.get("resident", False)  # Boolean: has registered address in India?

    # Apply the three eligibility rules from the Representation of the People Act, 1950
    if age >= 18 and citizen and resident:
        return jsonify({
            "eligible":  True,
            "title":     "🎉 You are eligible to vote!",
            "message":   "You meet all three criteria — age 18+, Indian citizen, and a registered address in India.",
            "next_step": "Visit voterportal.eci.gov.in to register on the Electoral Roll or check if you're already registered.",
        })
    elif age < 18:
        years_left = 18 - age
        return jsonify({
            "eligible":  False,
            "title":     "⏳ Not yet — you need to be 18",
            "message":   f"You are {age} years old. You need to be at least 18 years old to vote in India.",
            "next_step": f"Come back in {years_left} year(s)! You can still follow elections and learn about the process at ecisveep.nic.in.",
        })
    elif not citizen:
        return jsonify({
            "eligible":  False,
            "title":     "❌ Indian citizenship is required",
            "message":   "Only Indian citizens can vote in national and state elections.",
            "next_step": "If you have applied for citizenship, check the status at indiancitizenshiponline.nic.in.",
        })
    else:
        return jsonify({
            "eligible":  False,
            "title":     "📍 Residency registration needed",
            "message":   "You need to have a registered address in India to be listed on the Electoral Roll.",
            "next_step": "Apply for voter registration at your current address on voterportal.eci.gov.in using Form 6.",
        })


@app.route("/api/myth", methods=["POST"])
def myth():
    """
    Checks whether a user-submitted statement is an election myth or fact.
    Accepts: { "statement": "EVMs are hacked every election" }
    Returns: { "verdict": "MYTH" or "FACT", "explanation": "...", "truth": "..." }
    """
    data      = request.get_json()
    statement = data.get("statement", "").strip()

    if not statement:
        return jsonify({"error": "Statement cannot be empty"}), 400

    # Build a specific prompt that forces Gemini to classify and explain
    prompt = (
        f"A user has shared this statement about Indian elections: \"{statement}\"\n\n"
        "First, on its own line write exactly 'VERDICT: MYTH' or 'VERDICT: FACT'.\n"
        "Then explain in 2-3 simple sentences why it is a myth or fact, and correct "
        "any misinformation. End with one actionable step."
    )

    extra = (
        "You are fact-checking Indian election statements. "
        "Be objective, factual, and cite the Election Commission of India where relevant."
    )

    raw_reply = ask_gemini(prompt, extra_instructions=extra)

    # Parse the VERDICT line out of the response
    verdict = "MYTH"  # default conservative
    explanation = raw_reply

    for line in raw_reply.splitlines():
        if "VERDICT:" in line.upper():
            if "FACT" in line.upper():
                verdict = "FACT"
            else:
                verdict = "MYTH"
            # Remove the verdict line from the explanation shown to the user
            explanation = raw_reply.replace(line, "").strip()
            break

    # Log the myth-check to Google Sheets
    log_to_sheet("myth", statement, f"[{verdict}] {explanation}")

    return jsonify({
        "verdict":     verdict,
        "explanation": explanation,
    })


# ─────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────

if __name__ == "__main__":
    # debug=True gives helpful error messages during development
    # Set debug=False before deploying to production
    app.run(debug=True, port=5000)
