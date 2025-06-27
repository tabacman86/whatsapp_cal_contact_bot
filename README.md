# 📅 WhatsApp AI Assistant – Calendar & Contacts Bot

This project is a smart WhatsApp bot that:

- 🗓️ Adds events to your Google Calendar
- 👤 Creates new contacts in Google Contacts
- 📷 Supports image-based invites (OCR via GPT-4o)
- 🧠 Understands Hebrew (calendar) and English (contacts)

---

## 🔗 Stack Overview

This bot integrates the following services:

| Layer       | Tech Used                        |
|-------------|----------------------------------|
| Messaging   | Meta WhatsApp Business (via Twilio Sandbox) |
| NLP + OCR   | OpenAI GPT-4o                    |
| Runtime     | Google Apps Script               |
| Calendar    | Google Calendar API              |
| Contacts    | Google People API                |

---

## 💡 Bot Behavior

The bot supports **3 input types**:
- 📝 Hebrew text: `"ביום שישי ב-16:00 חיסון לילדים"` → adds calendar event
- 🧾 Image of invitation (e.g. birthday invite) → GPT-4o OCR + calendar event
- 👤 Contact request: `"Add contact: John Doe, +972..., john@..., Acme Ltd, VIP"` → creates Google Contact

---

## 🚀 Setup Guide

### 1. Create a Google Apps Script Project
- Open [script.new](https://script.new)
- Paste in the contents of `combined.gs`
- Rename to something like `WhatsApp Assistant`

---

### 2. Enable APIs
In your Apps Script project:
- Enable services:
  - Google Calendar API
  - Google People API
  - Gmail API
- Also go to **Resources → Advanced Google Services** and enable:
  - People API

---

### 3. Add Script Properties
Go to **Project Settings → Script Properties** and add the following:

| Key                  | Value                      |
|----------------------|----------------------------|
| `OPENAI_API_KEY`     | Your OpenAI API Key        |
| `CALENDAR_ID`        | Your Google Calendar ID    |
| `TWILIO_ACCOUNT_SID` | Your Twilio SID            |
| `TWILIO_AUTH_TOKEN`  | Your Twilio Token          |
| `REPLY_TO_EMAIL`     | Gmail address for confirms |

---

### 4. Set Up Twilio WhatsApp Sandbox

In [Twilio Console](https://console.twilio.com/):
- Go to **Messaging → WhatsApp → Sandbox**
- Set the **Webhook URL** (POST) to your script's deployment URL:
