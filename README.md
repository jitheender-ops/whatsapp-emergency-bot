# 🆘 WhatsApp Emergency Bot

A WhatsApp-first emergency assistance bot built on the **WhatsApp Business Cloud API**. Zero app installs — meets people where they already are.

## Features

| Feature | Description |
|---------|-------------|
| 🩸 **Blood Donor Finder** | Search for registered blood donors by blood group & location |
| 🚑 **Ambulance & Hospital Finder** | Find nearest hospitals using GPS location (OpenStreetMap) |
| 📄 **Lost Document Help** | Step-by-step guides for replacing Indian identity documents |
| 📋 **Donor Registration** | Register as a blood donor directly via WhatsApp |
| 🔔 **Donor Alerts** | Automatically notify nearby donors when blood is needed |

## Architecture

```
WhatsApp User → Meta Cloud API → Express.js Webhook → Module Router
                                                          ├── Blood Donor Module
                                                          ├── Ambulance Finder Module
                                                          ├── Document Help Module
                                                          └── Onboarding Module
```

- **Runtime:** Node.js (ES Modules)
- **Database:** SQLite via sql.js (pure JS, no native compilation)
- **Geocoding:** OpenStreetMap Nominatim + Overpass API (free, no API key)
- **WhatsApp:** Meta Cloud API v21.0

## Quick Start

### Prerequisites

1. **Node.js** v18+ installed
2. **Meta Developer Account** with a WhatsApp Business app configured
3. **ngrok** (for local development) — `npm install -g ngrok`

### Setup

```bash
# Clone & install
git clone <repo-url>
cd whatsapp-emergency-bot
npm install

# Configure environment
cp .env.example .env
# Edit .env with your WhatsApp API credentials

# Start the server
npm run dev

# In another terminal, expose via ngrok
ngrok http 3000
```

### Meta Dashboard Configuration

1. Go to [Meta Developer Dashboard](https://developers.facebook.com)
2. Navigate to your app → **WhatsApp** → **Configuration**
3. Set the Webhook URL to your ngrok URL: `https://xxxx.ngrok.io/webhook`
4. Set the Verify Token to match your `VERIFY_TOKEN` in `.env`
5. Subscribe to the `messages` webhook field

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WHATSAPP_TOKEN` | Permanent system user access token |
| `PHONE_NUMBER_ID` | WhatsApp phone number ID from Meta dashboard |
| `APP_SECRET` | Meta app secret (for webhook signature verification) |
| `VERIFY_TOKEN` | Custom token for webhook handshake |
| `PORT` | Server port (default: 3000) |

## Project Structure

```
src/
├── index.js                    # Express server & webhook routes
├── config.js                   # Environment configuration
├── whatsapp/
│   ├── client.js               # WhatsApp Cloud API client
│   ├── webhook.js              # Webhook verification & message parsing
│   └── templates.js            # Interactive message builders
├── modules/
│   ├── router.js               # Intent router
│   ├── onboarding.js           # Welcome & main menu
│   ├── blood-donor.js          # Blood donor search & registration
│   ├── ambulance-finder.js     # Hospital & ambulance finder
│   └── document-help.js        # Document replacement guides
├── services/
│   ├── session.js              # Conversation state manager
│   ├── geocoding.js            # Nominatim/Overpass geocoding
│   └── notifications.js       # Donor alert broadcasting
└── db/
    ├── database.js             # SQLite connection (sql.js)
    ├── migrations.js           # Schema setup
    └── models/
        ├── user.js             # User/donor model
        └── blood-request.js    # Blood request model
```

## Conversation Flow

```
User: Hi
Bot:  👋 Welcome to EmergencyBot!
      [Interactive Menu]
      🩸 Find Blood Donors
      🚑 Nearest Ambulance
      📄 Lost Document Help
      📋 Register as Donor

User: [Selects "Find Blood Donors"]
Bot:  What blood group do you need?
      [A+] [A−] [B+]
      [B−] [O+] [O−]
      [AB+] [AB−]

User: [Taps "B+"]
Bot:  📍 Share your location...
      [Send Location]

User: [Shares location]
Bot:  Found 3 donors for B+ near you:
      1. Rahul S. — 2.3km
      2. Priya M. — 5.1km
      3. Amit K. — 8.7km
```

## Testing

```bash
npm test
```

## License

MIT
