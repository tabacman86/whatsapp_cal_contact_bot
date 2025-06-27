# 📅 WhatsApp AI Assistant – Calendar & Contacts Bot

A smart WhatsApp-based assistant that:

- 🗓️ Adds events to your shared Google Calendar
- 👤 Creates contacts in your Google People account
- 📷 Understands event details from image-based invites
- 🧠 Supports Hebrew (calendar) + English (contacts)

---

## 🧩 Problems This Bot Solves

### 1. Missed Calendar Events in Shared Households

In a shared life (e.g., you and your spouse), forgetting to:
- Add calendar invites
- Share events
- Handle casual event reminders (like vaccine appointments or family dinners)

… often leads to missed commitments.

> ✅ This bot lets anyone in the house WhatsApp the bot with:
> - Hebrew text like: `"ביום שני בשעה 16:00 חיסון לילדים"`
> - Or just an image of a printed/WhatsApp invitation

It understands both and adds the event to your shared calendar.

---

### 2. Disorganized Contacts on iOS + Gmail

Managing contacts across iOS + Google Contacts is messy:
- Contacts aren’t synced well between services
- New numbers aren’t labeled or grouped
- You manually copy/paste from chats

> ✅ This bot parses a structured message like:
> `Add contact: Lior Katz, +972501234567, lior@example.com, AlphaTech, PromptCust`
>
> and adds the contact directly to your Google Contacts — clean, labeled, and synced to iOS.

---

## 🔗 Stack Overview

| Layer       | Tech Used                        |
|-------------|----------------------------------|
| Messaging   | Meta WhatsApp Business (Twilio) |
| NLP + OCR   | OpenAI GPT-4o                    |
| Runtime     | Google Apps Script               |
| Calendar    | Google Calendar API              |
| Contacts    | Google People API                |

---

## 💡 Bot Behavior

Supports 3 input types:
- 📝 Hebrew text → adds calendar event
- 📷 Image of invitation → OCR + calendar event
- 👤 English contact command → creates contact

---

## 🚀 Setup Guide

1. **Create a Google Apps Script Project**  
2. **Enable APIs**: Calendar, People, Gmail  
3. **Set Script Properties** for keys and tokens  
4. **Deploy Webhook URL to Twilio**  
5. **Test via WhatsApp** — text, contact, or image

_(Full instructions in the original README body above.)_

---

## 🙏 Credits

Special thanks to [Ido Lavi](https://www.linkedin.com/in/ido-lavi/)  
for sharing the original problem, vision, and implementation of the initial version of this bot.

---

## 📄 License

MIT — use freely, contribute responsibly.
