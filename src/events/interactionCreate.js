const commands = require('../commands/index');
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const {
  openTicket,
  claimTicket,
  closeTicket,
  reopenTicket,
  deleteTicketChannel
} = require('../handlers/ticketManager');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Hard restriction: the ticket system only operates in the configured guild.
    if (interaction.guildId !== process.env.GUILD_ID) {
      if (interaction.isRepliable()) {
        await interaction
          .reply({ content: 'This bot is not configured to operate in this server.', ephemeral: true })
          .catch(() => {});
      }
      return;
    }

    try {
      // Slash Commands
      if (interaction.isChatInputCommand()) {
        const command = commands.find((c) => c.data.name === interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      // String Select Menu (Category Selection) -> open a modal asking for subject/message
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_category_select') {
          const selectedCategory = interaction.values[0];

          const modal = new ModalBuilder()
            .setCustomId(`ticket_open_modal_${selectedCategory}`)
            .setTitle('Open a Ticket');

          const subjectInput = new TextInputBuilder()
            .setCustomId('ticket_subject')
            .setLabel('Subject')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true);

          const messageInput = new TextInputBuilder()
            .setCustomId('ticket_message')
            .setLabel('Message')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(subjectInput),
            new ActionRowBuilder().addComponents(messageInput)
          );

          return interaction.showModal(modal);
        }
        return;
      }

      // Modal Submit (Subject/Message collected) -> actually create the ticket
      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('ticket_open_modal_')) {
          const selectedCategory = interaction.customId.replace('ticket_open_modal_', '');
          const subject = interaction.fields.getTextInputValue('ticket_subject');
          const message = interaction.fields.getTextInputValue('ticket_message');
          return openTicket(interaction, selectedCategory, { subject, message });
        }
        return;
      }

      // Buttons
      if (interaction.isButton()) {
        switch (interaction.customId) {
          case 'ticket_open':
            return openTicket(interaction);
          case 'ticket_claim':
            return claimTicket(interaction);
          case 'ticket_close':
            return closeTicket(interaction);
          case 'ticket_reopen':
            return reopenTicket(interaction);
          case 'ticket_delete':
            return deleteTicketChannel(interaction);
          default:
            return;
        }
      }
    } catch (err) {
      console.error('[INTERACTION] Error handling interaction:', err);
      const payload = { content: 'Something went wrong while processing that action.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else if (interaction.isRepliable()) {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
};