/**
 * main.js — Election Process Assistant
 * Handles all user interaction: tab navigation, chat, timeline, eligibility, myth checker
 */

// ─────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────

/**
 * Switches the visible section when a tab button is clicked.
 * Adds/removes the "active" class on both the button and section.
 */
function initTabs() {
  const buttons  = document.querySelectorAll(".tab-btn");
  const sections = document.querySelectorAll(".section");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;

      // Deactivate all buttons and sections
      buttons.forEach((b)  => b.classList.remove("active"));
      sections.forEach((s) => s.classList.remove("active"));

      // Activate the clicked button's tab and section
      btn.classList.add("active");
      document.getElementById(`section-${target}`).classList.add("active");
    });
  });
}


// ─────────────────────────────────────────────
// SECTION 1 — CHAT
// ─────────────────────────────────────────────

/**
 * Appends a new chat bubble to the chat window.
 * @param {string} text  - The message content (supports basic HTML)
 * @param {"user"|"ai"}  role - Who sent it
 */
function appendBubble(text, role) {
  const window_  = document.getElementById("chat-window");
  const bubble   = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;

  const avatar = role === "user" ? "🧑" : "🤖";

  bubble.innerHTML = `
    <div class="bubble-avatar">${avatar}</div>
    <div class="bubble-body"><p>${text}</p></div>
  `;

  window_.appendChild(bubble);
  // Auto-scroll to the newest message
  window_.scrollTop = window_.scrollHeight;
  return bubble;
}

/**
 * Shows an animated "thinking" indicator while waiting for the AI.
 * Returns the bubble element so it can be removed after the reply arrives.
 */
function showThinkingBubble() {
  const window_ = document.getElementById("chat-window");
  const bubble  = document.createElement("div");
  bubble.className = "chat-bubble ai";
  bubble.id = "thinking-bubble";
  bubble.innerHTML = `
    <div class="bubble-avatar">🤖</div>
    <div class="bubble-body">
      <div class="thinking-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  window_.appendChild(bubble);
  window_.scrollTop = window_.scrollHeight;
  return bubble;
}

/**
 * Sends the user's message to /api/chat and displays the AI reply.
 */
async function sendChatMessage() {
  const input   = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  const message = input.value.trim();

  if (!message) return;

  // Show user bubble and clear input
  appendBubble(message, "user");
  input.value = "";

  // Disable input while waiting
  sendBtn.disabled = true;
  sendBtn.classList.add("loading");
  input.disabled = true;

  // Show animated "thinking" dots
  const thinkingBubble = showThinkingBubble();

  try {
    const response = await fetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message }),
    });

    const data = await response.json();

    // Remove the thinking bubble and show the actual reply
    thinkingBubble.remove();

    if (data.reply) {
      appendBubble(data.reply, "ai");
    } else {
      appendBubble("Sorry, I couldn't get an answer. Please try again.", "ai");
    }
  } catch (err) {
    thinkingBubble.remove();
    appendBubble("⚠️ Network error — please check your connection and try again.", "ai");
  } finally {
    // Re-enable input
    sendBtn.disabled = false;
    sendBtn.classList.remove("loading");
    input.disabled = false;
    input.focus();
  }
}

/**
 * Sets up the chat input: send on button click and on Enter key press.
 */
function initChat() {
  const sendBtn = document.getElementById("chat-send-btn");
  const input   = document.getElementById("chat-input");

  sendBtn.addEventListener("click", sendChatMessage);

  input.addEventListener("keydown", (e) => {
    // Send on Enter, but allow Shift+Enter for line breaks (future-proofing)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
}


// ─────────────────────────────────────────────
// SECTION 2 — ELECTION TIMELINE
// ─────────────────────────────────────────────

let activeStepId = null; // Tracks which step is currently expanded

/**
 * Fetches all timeline steps from the server and builds the clickable cards.
 */
async function initTimeline() {
  const track = document.getElementById("timeline-track");

  try {
    const response = await fetch("/api/timeline");
    const steps    = await response.json();

    // Clear the loading placeholder
    track.innerHTML = "";

    steps.forEach((step) => {
      const btn = document.createElement("button");
      btn.className        = "timeline-step";
      btn.dataset.stepId   = step.id;
      btn.setAttribute("role", "listitem");
      btn.setAttribute("aria-label", `${step.label} — click for details`);

      btn.innerHTML = `
        <div class="step-circle">${step.icon}</div>
        <div class="step-label">${step.label}</div>
        <div class="step-short">${step.short}</div>
      `;

      btn.addEventListener("click", () => handleStepClick(step.id, btn));
      track.appendChild(btn);
    });
  } catch (err) {
    track.innerHTML = `<p style="color:#ef4444;padding:20px;">Could not load timeline. Is the server running?</p>`;
  }
}

/**
 * Handles a click on a timeline step: fetches details and shows the detail panel.
 * If the same step is clicked again, it toggles (closes) the detail panel.
 */
async function handleStepClick(stepId, clickedBtn) {
  const detailPanel = document.getElementById("timeline-detail");

  // Toggle off if same step is clicked again
  if (activeStepId === stepId) {
    detailPanel.hidden = true;
    clickedBtn.classList.remove("active");
    activeStepId = null;
    return;
  }

  // Mark the new active step
  document.querySelectorAll(".timeline-step").forEach((b) => b.classList.remove("active"));
  clickedBtn.classList.add("active");
  activeStepId = stepId;

  try {
    const response = await fetch(`/api/timeline/${stepId}`);
    const step     = await response.json();

    // Populate the detail panel
    document.getElementById("detail-icon").textContent  = step.icon;
    document.getElementById("detail-title").textContent = step.label;
    document.getElementById("detail-text").textContent  = step.detail;

    detailPanel.hidden = false;
    // Scroll the detail panel into view smoothly
    detailPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    document.getElementById("detail-text").textContent = "Could not load details. Please try again.";
    detailPanel.hidden = false;
  }
}

/**
 * Sets up the close button for the timeline detail panel.
 */
function initTimelineClose() {
  document.getElementById("timeline-close-btn").addEventListener("click", () => {
    document.getElementById("timeline-detail").hidden = true;
    document.querySelectorAll(".timeline-step").forEach((b) => b.classList.remove("active"));
    activeStepId = null;
  });
}


// ─────────────────────────────────────────────
// SECTION 3 — VOTER ELIGIBILITY CHECKER
// ─────────────────────────────────────────────

/**
 * Handles eligibility form submission.
 * Reads form values, sends to /api/eligibility, displays result card.
 */
async function initEligibility() {
  const form      = document.getElementById("eligibility-form");
  const submitBtn = document.getElementById("eligibility-submit-btn");
  const resetBtn  = document.getElementById("eligibility-reset-btn");
  const result    = document.getElementById("eligibility-result");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Read form values
    const age      = parseInt(document.getElementById("age-input").value, 10);
    const citizen  = document.querySelector('input[name="citizen"]:checked')?.value === "yes";
    const resident = document.querySelector('input[name="resident"]:checked')?.value === "yes";

    // Basic validation
    if (!age || isNaN(age)) {
      alert("Please enter your age.");
      return;
    }
    if (!document.querySelector('input[name="citizen"]:checked')) {
      alert("Please answer whether you are an Indian citizen.");
      return;
    }
    if (!document.querySelector('input[name="resident"]:checked')) {
      alert("Please answer whether you have a registered address in India.");
      return;
    }

    // Disable button and show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");

    try {
      const response = await fetch("/api/eligibility", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ age, citizen, resident }),
      });

      const data = await response.json();

      // Populate and show the result card
      document.getElementById("result-title").textContent   = data.title;
      document.getElementById("result-message").textContent = data.message;
      document.getElementById("result-next").textContent    = `👉 Next step: ${data.next_step}`;

      result.className = `result-card ${data.eligible ? "eligible" : "ineligible"}`;
      result.hidden    = false;

      // Hide the form, show the result
      form.hidden = true;
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      alert("Could not check eligibility. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
    }
  });

  // Reset button — shows the form again, hides result
  resetBtn.addEventListener("click", () => {
    form.reset();
    form.hidden   = false;
    result.hidden = true;
  });
}


// ─────────────────────────────────────────────
// SECTION 4 — MYTH VS FACT
// ─────────────────────────────────────────────

/**
 * Sends a statement to /api/myth and displays the MYTH or FACT verdict.
 * @param {string} statement - The text to fact-check
 */
async function checkMyth(statement) {
  const checkBtn     = document.getElementById("myth-check-btn");
  const verdictCard  = document.getElementById("verdict-card");
  const mythTextarea = document.getElementById("myth-input");

  if (!statement.trim()) {
    alert("Please enter a statement to check.");
    return;
  }

  // Show loading state
  checkBtn.disabled = true;
  checkBtn.classList.add("loading");
  verdictCard.hidden = true;

  try {
    const response = await fetch("/api/myth", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ statement }),
    });

    const data = await response.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    // Set verdict badge text and style
    const badge = document.getElementById("verdict-badge");
    if (data.verdict === "FACT") {
      badge.textContent  = "✅ FACT";
      badge.className    = "verdict-badge fact-badge";
    } else {
      badge.textContent  = "❌ MYTH";
      badge.className    = "verdict-badge myth-badge";
    }

    document.getElementById("verdict-explanation").textContent = data.explanation;

    verdictCard.hidden = false;
    verdictCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    alert("Network error — please try again.");
  } finally {
    checkBtn.disabled = false;
    checkBtn.classList.remove("loading");
  }
}

/**
 * Sets up the myth checker: button click, Enter key, example chips, and reset.
 */
function initMythChecker() {
  const checkBtn     = document.getElementById("myth-check-btn");
  const mythTextarea = document.getElementById("myth-input");
  const resetBtn     = document.getElementById("myth-reset-btn");

  // Send on button click
  checkBtn.addEventListener("click", () => {
    checkMyth(mythTextarea.value);
  });

  // Example chips — fill the textarea with the chip's preset myth
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      mythTextarea.value = chip.dataset.myth;
      mythTextarea.focus();
    });
  });

  // Reset — clear textarea and hide verdict card
  resetBtn.addEventListener("click", () => {
    mythTextarea.value = "";
    document.getElementById("verdict-card").hidden = true;
    mythTextarea.focus();
  });
}


// ─────────────────────────────────────────────
// INITIALISE EVERYTHING ON PAGE LOAD
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initChat();
  initTimeline();
  initTimelineClose();
  initEligibility();
  initMythChecker();
});
