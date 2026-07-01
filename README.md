# OpenTicket Discord Ticket Bot

A fully customizable Discord support-ticket bot built with discord.js v14 and MongoDB.

## Features

- `/ticket-panel` posts a button-based panel; clicking **Open Ticket** creates a private channel for the user.
- All ticket events (opened, closed, reopened) are reported **privately**: once to a staff-only log channel (with the HTML transcript attached on close) and once via DM to the ticket opener.
- Bot status shows **Watching N tickets**, live-updated on every open/close/reopen and refreshed every 5 minutes.
- Locked to a single server via `GUILD_ID` in `.env` — slash commands are registered only to that guild, and any interaction from another server is rejected.
- Ticket data (status, opener, claimer, closer, timestamps, transcript) is stored in MongoDB via Mongoose.
- Fully customizable through `config.json` — no code edits required for re-theming text, colors, role/category IDs, or behavior.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Discord application & bot**
   - https://discord.com/developers/applications → New Application → Bot → copy the token.
   - Under "Privileged Gateway Intents," enable **Server Members Intent** and **Message Content Intent**.
   - Invite the bot to your server with `applications.commands` + `bot` scopes and `Manage Channels`, `Manage Roles`, `Send Messages`, `Attach Files` permissions.

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in `BOT_TOKEN`, `CLIENT_ID`, `GUILD_ID` (the one server this bot will operate in), and `MONGODB_URI`.

   > Note: `dotenv` is pinned to `^16.4.5` in `package.json`. Do not bump it to v17+, which injects an ad banner on load.

4. **Configure `config.json`**
   - `ticketCategoryId`: category channel ID new ticket channels are created under.
   - `transcriptLogChannelId`: a **private** staff-only channel ID where open/close/reopen logs and transcripts are posted.
   - `supportRoleIds`: array of role IDs that get access to every ticket.
   - All embed titles, descriptions, button labels, and colors can be edited freely. Edits apply on the next interaction — no restart required.

5. **Run the bot**
   ```bash
   npm start
   ```

## Commands

| Command | Description |
|---|---|
| `/ticket-panel` | Posts the "Open Ticket" panel in the current channel (Manage Server permission). |
| `/ticket-close` | Closes the current ticket channel (alternative to the button). |
| `/ticket-reopen` | Reopens a closed ticket channel (alternative to the button). |

Buttons handle the same actions inline: **Open Ticket**, **Claim Ticket**, **Close Ticket**, **Reopen Ticket**, **Delete Channel**.

## Project Structure

```
config.json              # All customizable text/IDs/behavior
.env                      # Secrets & the single-guild lock
src/
  index.js                # Entry point
  database/connect.js      # MongoDB connection
  models/Ticket.js         # Ticket schema
  models/Counter.js        # Auto-incrementing ticket numbers
  commands/index.js        # Slash command definitions
  events/ready.js           # Sets bot presence on startup
  events/interactionCreate.js # Routes commands/buttons, enforces guild lock
  handlers/ticketManager.js # Open/claim/close/reopen/delete logic
  utils/config.js           # Loads config.json (hot-reloaded each call)
  utils/presence.js         # "Watching N tickets" status updater
  utils/transcript.js       # HTML transcript generation
```

## Notes on Privacy

- The ticket channel itself only ever sees the open/close/reopen embeds relevant to that ticket.
- The **transcript log channel** should have its permissions set so only staff can view it — this is where every transcript and lifecycle log is posted.
- DMs to the ticket opener are sent for open/close/reopen events (each individually toggleable via `dmUserOnEvents` in `config.json`); if the user has DMs disabled, this fails silently without affecting the ticket flow.
