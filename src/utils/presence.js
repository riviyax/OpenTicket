const { ActivityType } = require('discord.js');
const Ticket = require('../models/Ticket');

async function updatePresence(client) {
  const config = require('./config').loadConfig();
  const openCount = await Ticket.countDocuments({ status: 'open' });
  const text = config.presence.textFormat.replace('{count}', openCount);

  client.user.setActivity(text, { type: ActivityType[config.presence.type] || ActivityType.Watching });
}

module.exports = { updatePresence };