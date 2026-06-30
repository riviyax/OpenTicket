require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { connectDatabase } = require('./database/connect');
const { REST, Routes } = require('discord.js');
const commands = require('./commands/index');

const REQUIRED_ENV = ['BOT_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'MONGODB_URI'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[BOT] Missing required .env variable: ${key}`);
    process.exit(1);
  }
}

// ─── COMMAND DEPLOYMENT ───
async function deployCommands() {
  const body = commands.map((cmd) => cmd.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  try {
    console.log(`[DEPLOY] Registering ${body.length} command(s) to guild ${process.env.GUILD_ID}...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body }
    );
    console.log('[DEPLOY] Slash commands registered successfully.');
  } catch (err) {
    console.error('[DEPLOY] Failed to register commands:', err);
  }
}

// ─── BOT CLIENT ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once('ready', require('./events/ready').execute);
client.on('interactionCreate', require('./events/interactionCreate').execute);

// ─── START EVERYTHING ───
(async () => {
  await connectDatabase();
  await deployCommands(); // Deploy commands before logging in
  await client.login(process.env.BOT_TOKEN);
})();

process.on('unhandledRejection', (err) => {
  console.error('[BOT] Unhandled promise rejection:', err);
});