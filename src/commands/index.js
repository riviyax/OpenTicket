const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const { loadConfig } = require('../utils/config');

function hexColor(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('ticket-panel')
      .setDescription('Post the ticket opening panel in this channel.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const config = loadConfig();
      const panel = config.panel;

      // Build links text
      const linksText = panel.links
        .map(link => `• ${link.emoji} Check our **[${link.name}](${link.url})**`)
        .join('\n');

      // Build categories text
      const categoriesText = panel.categories
        .map(cat => `${cat.emoji} **${cat.label}**\n└ ${cat.description}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(panel.title)
        .setDescription(
          `${panel.description}\n\n` +
          `**Before creating a ticket:**\n${linksText}\n\n` +
          `**Support Hours:** ${panel.supportHours}\n` +
          `**Average Response Time:** ${panel.responseTime}\n\n` +
          `**Available Categories**\n${categoriesText}`
        )
        .setColor(hexColor(panel.color))
        .setThumbnail(panel.thumbnail)
        .setFooter({ text: `${panel.footer} · ${new Date().toLocaleString()}` })
        .setTimestamp();

      // Build category select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_category_select')
        .setPlaceholder('🎫 Select a category')
        .addOptions(
          panel.categories.map(cat =>
            new StringSelectMenuOptionBuilder()
              .setLabel(cat.label)
              .setDescription(cat.description)
              .setEmoji(cat.emoji)
              .setValue(cat.value)
          )
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: 'Ticket panel posted.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('ticket-close')
      .setDescription('Close the current ticket.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const { closeTicket } = require('../handlers/ticketManager');
      await closeTicket(interaction);
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('ticket-reopen')
      .setDescription('Reopen the current ticket.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const { reopenTicket } = require('../handlers/ticketManager');
      await reopenTicket(interaction);
    }
  }
];