const { updatePresence } = require('../utils/presence');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[BOT] Logged in as ${client.user.tag}`);

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.warn(
        `[BOT] WARNING: Bot is not in the guild configured by GUILD_ID (${process.env.GUILD_ID}). Ticket commands will not work until it is invited there.`
      );
    } else {
      console.log(`[BOT] Locked to guild: ${guild.name} (${guild.id})`);
    }

    await updatePresence(client);
    setInterval(() => updatePresence(client), 5 * 60 * 1000);
  }
};