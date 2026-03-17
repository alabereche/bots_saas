# BotForge — WhatsApp Engine Plan

## Overview

Add WhatsApp support to BotForge using `whatsapp-web.js`.  
Each client connects their existing WhatsApp business number by scanning a QR Code.  
The bot then replies to their customers automatically using OpenRouter AI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bot Framework | whatsapp-web.js |
| Browser Engine | puppeteer (required by whatsapp-web.js) |
| Backend | Node.js + Express |
| Database | NexCloud DB via @nexcloud/mcp |
| AI | OpenRouter API (client provides their own key) |
| Session Storage | LocalAuth (persists across restarts) |
| Hosting | Render.com (free tier) |

---

## How It Works

```
1. Client creates a WhatsApp bot in the dashboard
2. Backend initializes a whatsapp-web.js Client
3. QR Code is generated and shown in the dashboard
4. Client scans it with their WhatsApp business phone
5. Bot status changes to "connected"
6. Every incoming message → sent to OpenRouter with system prompt
7. AI response → sent back to customer on WhatsApp
8. Message logged to NexCloud DB
```

---

## File Structure

```
whatsapp-engine/
├── index.js               ← Express server + route registration
├── botManager.js          ← Create, stop, manage WhatsApp clients
├── messageHandler.js      ← Handle incoming messages + call OpenRouter
├── promptGenerator.js     ← Reused from Telegram engine (no changes)
├── openrouter.js          ← OpenRouter API integration
├── nexcloud.js            ← NexCloud DB/Storage via MCP
├── encryption.js          ← AES-256 for API keys + tokens
├── sessions/              ← LocalAuth session files (one per bot)
└── .env
```

---

## Bot Manager (Core Logic)

```javascript
const { Client, LocalAuth } = require('whatsapp-web.js')

// Active bots store
const activeBots = new Map() // botId → WhatsApp Client instance

async function createWhatsAppBot(botId, config) {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: botId,
      dataPath: './sessions'
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  })

  // QR Code generated → save to NexCloud Storage
  client.on('qr', async (qr) => {
    await nexcloud.saveQR(botId, qr)
    await nexcloud.updateBotStatus(botId, 'waiting_scan')
  })

  // Bot connected successfully
  client.on('ready', async () => {
    await nexcloud.updateBotStatus(botId, 'active')
    activeBots.set(botId, client)
  })

  // Handle disconnection
  client.on('disconnected', async () => {
    await nexcloud.updateBotStatus(botId, 'disconnected')
    activeBots.delete(botId)
  })

  // Handle incoming messages
  client.on('message', async (msg) => {
    if (msg.fromMe) return
    await handleMessage(msg, config)
  })

  await client.initialize()
}

async function stopWhatsAppBot(botId) {
  const client = activeBots.get(botId)
  if (client) {
    await client.destroy()
    activeBots.delete(botId)
  }
}

async function restoreBotsOnStartup() {
  // On server restart → reload all active bots from NexCloud DB
  const bots = await nexcloud.getActiveBots()
  for (const bot of bots) {
    await createWhatsAppBot(bot.id, bot.config)
  }
}
```

---

## Message Handler

```javascript
async function handleMessage(msg, config) {
  // Rate limit check
  const count = await nexcloud.getTodayMessageCount(config.botId)
  if (config.plan === 'free' && count >= 200) {
    await msg.reply('عذراً، تم الوصول للحد اليومي. تواصل مع المشروع مباشرة.')
    return
  }

  // Call OpenRouter AI
  const reply = await askOpenRouter(
    config.systemPrompt,
    msg.body,
    config.apiKey,
    config.model
  )

  // Send reply
  await msg.reply(reply)

  // Log to NexCloud DB
  await nexcloud.logMessage({
    botId: config.botId,
    from: msg.from,
    message: msg.body,
    response: reply,
    timestamp: new Date()
  })
}
```

---

## API Routes

```
POST   /api/whatsapp/create        → Initialize bot + return QR code image
GET    /api/whatsapp/:id/qr        → Get current QR (base64 PNG)
GET    /api/whatsapp/:id/status    → connected | waiting_scan | disconnected
POST   /api/whatsapp/:id/stop      → Stop and disconnect bot
POST   /api/whatsapp/:id/restart   → Reconnect bot
GET    /api/whatsapp/:id/messages  → Last 50 messages log
```

---

## QR Code Flow (Dashboard)

```
Client clicks "Connect WhatsApp"
          ↓
POST /api/whatsapp/create
          ↓
Backend initializes Client → QR generated
          ↓
Dashboard polls GET /api/whatsapp/:id/qr every 3 seconds
          ↓
Shows QR image as <img> tag
          ↓
Client scans with phone
          ↓
Status → "connected" → dashboard shows green badge
```

---

## Security

| Rule | Implementation |
|---|---|
| JWT on every route | auth middleware |
| Ownership check | verify botId belongs to user |
| API keys encrypted | AES-256 via crypto module |
| Rate limiting | 200 messages/day free plan |
| Input sanitization | xss-clean on all inputs |
| No logging of secrets | never log apiKey or token |

---

## System Prompt

Reuse `generateSystemPrompt(botConfig)` from the existing Telegram engine.  
No changes needed — same function works for both platforms.

---

## OpenRouter Integration

```javascript
async function askOpenRouter(systemPrompt, userMessage, apiKey, model) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  })

  const data = await response.json()
  return data.choices[0].message.content
}
```

---

## Environment Variables

```
PORT=3001
NEXCLOUD_URL=https://your-nexcloud.railway.app
NEXCLOUD_KEY=your_nexcloud_key
ENCRYPTION_KEY=32_char_random_string_here
SITE_URL=https://botforge.render.com
NODE_ENV=production
WHATSAPP_SESSIONS_PATH=./sessions
```

---

## Render.com Deployment Notes

- Free tier RAM: 512MB → supports 3-5 simultaneous bots
- puppeteer needs these build flags: `--no-sandbox --disable-setuid-sandbox`
- Add to `render.yaml`:

```yaml
services:
  - type: web
    name: botforge-whatsapp
    env: node
    buildCommand: npm install
    startCommand: node index.js
    envVars:
      - key: PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
        value: "true"
```

- Install Chrome on Render via `puppeteer-core` + `chrome-aws-lambda`

---

## NexCloud Integration

Use `@nexcloud/mcp` for all database and storage operations:

```javascript
// Connect via MCP — no manual HTTP calls needed
const nexcloud = require('@nexcloud/mcp')

// DB operations
await nexcloud.db.insert('bots', botDocument)
await nexcloud.db.find('bots', { userId, status: 'active' })
await nexcloud.db.update('bots', { id: botId }, { status: 'connected' })

// Storage (QR codes)
await nexcloud.storage.upload(`qr-${botId}.png`, qrImageBuffer)
const qrUrl = await nexcloud.storage.getUrl(`qr-${botId}.png`)

// Notifications
await nexcloud.notify.send(userId, 'بوتك جاهز! تم الاتصال بـ WhatsApp ✅')
```

---

## Comparison: Telegram vs WhatsApp Engine

| Feature | Telegram | WhatsApp |
|---|---|---|
| Framework | Telegraf.js | whatsapp-web.js |
| Auth | Bot Token | QR Code scan |
| Needs phone? | No | Yes (business number) |
| Stability | Very stable | Depends on WhatsApp updates |
| Market reach | Medium | Very high (Algeria + Arab world) |
| RAM usage | Low | High (puppeteer) |

---

## Deliverables

1. `whatsapp-engine/` folder with complete working code
2. QR Code display component in React dashboard
3. Bot status polling (connected / waiting / disconnected)
4. Auto-reconnect on server restart via LocalAuth
5. Message logs saved to NexCloud DB
6. Integrated with existing BotForge dashboard seamlessly
7. `render.yaml` for one-click Render deployment
8. `.env.example` file

---

*BotForge — Telegram + WhatsApp AI Bots, powered by NexCloud*
