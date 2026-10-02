# 🆘 WhatsApp Emergency Bot

A WhatsApp bot for emergencies — find blood donors, nearby hospitals, and track blood requests. It runs on your own WhatsApp account (linked by scanning a QR code), so there's no app to install and no Business API needed.

The bot shares your number with your normal chats, so it **stays silent** unless someone sends the trigger word. Friends and family messaging you never get bot replies.

## Features

| Feature | How it works |
|---------|--------------|
| 🔑 **Trigger word** | Nobody gets a reply until they send `#help` (configurable). They can then use the menu for 30 minutes after their last message. |
| 🩸 **Blood donor matching** | Pick a blood group, then a city or 📍 location. Shows every *compatible* donor (exact group first) with a `wa.me` link to contact them. |
| 🆔 **Request ID + status** | Every blood search creates a request, e.g. `#12`. Check it with `status 12`, cancel with `cancel 12`. Requests expire after 24 h. |
| 🚑 **Nearby hospitals** | Share a location → hospitals sorted by distance, with address, phone and Google Maps links (OpenStreetMap data). Widens from 5 km to 20 km if nothing is close. |
| 📝 **Donor registration** | Name → blood group → city → confirm. |
| 📄 **Lost document help** | Replacement steps for Aadhaar, PAN, Voter ID, Passport, Driving License, Ration Card. |
| 🛠️ **Admin** | The account that scanned the QR manages requests from its own "Message yourself" chat. |

## Quick start

Needs **Node.js 18+** and **Google Chrome** installed (used in the background to run WhatsApp Web).

```bash
git clone https://github.com/jitheender-ops/whatsapp-emergency-bot.git
cd whatsapp-emergency-bot
npm install
npm start
```

1. A QR code appears in the terminal.
2. On your phone: **WhatsApp → Settings → Linked Devices → Link a Device** and scan it.
3. Wait for `✅ WhatsApp Bot is ready!`

The login is saved in `.wwebjs_auth/`, so later starts don't need a new scan. Stop the bot with `Ctrl+C`.

> The Chrome path is set in `src/index.js` for macOS. On Linux/Windows, change `executablePath` to your Chrome location.

## Configuration

Optional `.env` file in the project root:

| Variable | Default | What it does |
|----------|---------|--------------|
| `BOT_TRIGGER` | `#help` | The only message that starts the bot. Whole message, case-insensitive. Pick something nobody types by accident. |

## Using the bot

**As a user** (from any other WhatsApp number):

```
You:  #help
Bot:  👋 Welcome … Main Menu
      1. 🩸 Find Blood Donors
      2. 🚑 Find Nearest Hospital
      3. 📝 Register as a Donor
      4. 📋 My Request Status
      5. 📄 Lost Document Help

You:  1
Bot:  Please type the required blood group (e.g., A+, O-, B+)
You:  A+
Bot:  Share your location or type your city
You:  Visakhapatnam
Bot:  ✅ Found 2 donor(s) who can give to A+:
      1. Ravi — 🩸 O-  📞 wa.me/91XXXXXXXXXX
      …
      🆔 Request ID: #12 — status: active
```

| Command | Action |
|---------|--------|
| `menu` | Back to the main menu (also leaves a half-finished flow) |
| `status` | Your recent requests |
| `status 12` | One request |
| `cancel 12` | Cancel your own request |

**As admin** — on the phone that scanned the QR, open your **"Message yourself"** chat:

| Command | Action |
|---------|--------|
| `admin` | List admin commands |
| `admin list` | All active blood requests with requester contact |
| `admin done 12` | Mark fulfilled — the requester is notified |
| `admin cancel 12` | Close it — the requester is notified |

## Blood group compatibility

| Patient needs | Donors shown |
|---------------|--------------|
| O− | O− |
| O+ | O+, O− |
| A− | A−, O− |
| A+ | A+, A−, O+, O− |
| B− | B−, O− |
| B+ | B+, B−, O+, O− |
| AB− | AB−, A−, B−, O− |
| AB+ | everyone |

## Project structure

```
src/
├── index.js               # WhatsApp client (QR login), message filtering, admin self-chat
├── config.js              # Loads .env
├── whatsapp/client.js     # Send helpers used by modules
├── modules/
│   ├── router.js          # Trigger word, active window, menu routing
│   ├── onboarding.js      # Welcome, main menu, profile
│   ├── blood-donor.js     # Donor search + registration
│   ├── requests.js        # Request status/cancel + admin commands
│   ├── ambulance-finder.js# Nearby hospitals
│   └── document-help.js   # Lost document guides
├── services/
│   ├── session.js         # Per-user conversation state (in memory)
│   └── geocoding.js       # OpenStreetMap Nominatim + Overpass
└── db/                    # SQLite (sql.js) → data/emergency_bot.db
```

## Privacy

- Only 1:1 text and location messages are read. Groups, status updates, broadcasts, channels, calls and media are ignored.
- Data lives locally in `data/emergency_bot.db`. `.env`, the WhatsApp login and the database are git-ignored.
- Some contacts appear with a hidden ID (`…@lid`) instead of a phone number; for those, no `wa.me` link can be shown.

## Tests

```bash
npm test -- tests/router.test.js
```

`tests/router.test.js` covers the trigger word, silence for non-users, donor matching, request status, admin commands and the 30-minute window — with the WhatsApp client mocked, so no phone is needed.

## License

MIT
