const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

const Ticket = require('../models/Ticket');
const { getNextSequence } = require('../models/Counter');
const {
  loadConfig,
  getCategoryLabel,
  getRoleIdsForCategory,
  isStaffOrAdmin
} = require('../utils/config');
const { generateTranscript } = require('../utils/transcript');
const { updatePresence } = require('../utils/presence');

function hexColor(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

async function sendPrivateLog(guild, embed) {
  const config = loadConfig();
  const logChannel = await guild.channels
    .fetch(config.transcriptLogChannelId)
    .catch(() => null);
  if (!logChannel) {
    console.warn('[TICKETS] transcriptLogChannelId is not set/valid in config.json');
    return;
  }
  await logChannel.send({ embeds: [embed] }).catch((err) =>
    console.error('[TICKETS] Failed to send private log message:', err.message)
  );
}

async function dmUser(user, embed, eventKey) {
  const config = loadConfig();
  if (!config.dmUserOnEvents?.[eventKey]) return;
  await user.send({ embeds: [embed] }).catch(() => {
    // User likely has DMs closed; fail silently, this is non-critical.
  });
}

function fillTemplate(str, replacements) {
  return Object.entries(replacements).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
    str
  );
}

async function openTicket(interaction, category = 'general', extra = {}) {
  const config = loadConfig();
  const { guild, user } = interaction;
  const { subject = null, message = null } = extra;

  const existing = await Ticket.countDocuments({
    guildId: guild.id,
    openerId: user.id,
    status: 'open'
  });

  if (existing >= config.maxOpenTicketsPerUser) {
    return interaction.reply({
      content: `You already have ${existing} open ticket(s). Please close them before opening a new one.`,
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketNumber = await getNextSequence('ticketNumber');
  const channelName = fillTemplate(config.ticketChannelNameFormat, {
    username: user.username.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    number: ticketNumber
  });

  const categoryConfig = config.panel?.categories?.find((c) => c.value === category);
  const parentId = categoryConfig?.categoryId || config.ticketCategoryId || undefined;
  const categoryLabel = getCategoryLabel(config, category);

  // Which roles get access to this ticket. Controlled by `perCategoryRoles`
  // in config.json: false = every category shares `supportRoleIds`,
  // true = each category uses its own `roleIds` (falls back to
  // `supportRoleIds` if that category doesn't define any).
  const roleIds = getRoleIdsForCategory(config, category);

  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },
    ...roleIds.map((roleId) => ({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    }))
  ];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentId,
    permissionOverwrites
  });

  await Ticket.create({
    guildId: guild.id,
    channelId: channel.id,
    ticketNumber,
    openerId: user.id,
    openerTag: user.tag,
    category,
    subject: subject || '',
    message: message || '',
    status: 'open'
  });

  const openedEmbed = new EmbedBuilder()
    .setTitle(config.embeds.ticketOpened.title)
    .setDescription(
      fillTemplate(config.embeds.ticketOpened.description, { user: `<@${user.id}>` })
    )
    .setColor(hexColor(config.embeds.ticketOpened.color))
    .setFooter({ text: `Ticket #${ticketNumber}` })
    .setTimestamp();

  openedEmbed.addFields({ name: 'Category', value: categoryLabel, inline: true });

  if (subject) {
    openedEmbed.addFields({ name: 'Subject', value: subject });
  }
  if (message) {
    openedEmbed.addFields({ name: 'Message', value: message });
  }

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel(config.embeds.ticketOpened.claimButtonLabel)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel(config.embeds.ticketOpened.closeButtonLabel)
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${user.id}>${
      roleIds.length ? ' ' + roleIds.map((r) => `<@&${r}>`).join(' ') : ''
    }`,
    embeds: [openedEmbed],
    components: [actionRow]
  });

  // Private log (staff-only channel)
  const logEmbed = new EmbedBuilder()
    .setTitle(config.embeds.logOpen.title)
    .setColor(hexColor(config.embeds.logOpen.color))
    .addFields(
      { name: 'Ticket', value: `#${ticketNumber} (${channel})`, inline: true },
      { name: 'Opened By', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Category', value: categoryLabel, inline: true }
    )
    .setTimestamp();
  if (subject) {
    logEmbed.addFields({ name: 'Subject', value: subject });
  }
  await sendPrivateLog(guild, logEmbed);

  // DM to user
  const dmEmbed = new EmbedBuilder()
    .setTitle('Ticket Opened')
    .setDescription(`Your ticket **#${ticketNumber}** has been opened in **${guild.name}**: ${channel}`)
    .setColor(hexColor(config.embeds.logOpen.color))
    .setTimestamp();
  await dmUser(user, dmEmbed, 'open');

  await updatePresence(guild.client);

  await interaction.editReply({ content: `Your ticket has been created: ${channel}` });
}

async function claimTicket(interaction) {
  const config = loadConfig();
  const ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: 'open' });
  if (!ticket) {
    return interaction.reply({ content: 'This is not an active ticket channel.', ephemeral: true });
  }

  const roleIds = getRoleIdsForCategory(config, ticket.category);
  if (!isStaffOrAdmin(interaction.member, roleIds)) {
    return interaction.reply({
      content: 'Only support staff or administrators can claim this ticket.',
      ephemeral: true
    });
  }

  ticket.claimedBy = interaction.user.id;
  await ticket.save();
  await interaction.reply({ content: `🙋 Ticket claimed by <@${interaction.user.id}>.` });
}

async function closeTicket(interaction) {
  const config = loadConfig();
  const { guild, channel } = interaction;

  const ticket = await Ticket.findOne({ channelId: channel.id, status: 'open' });
  if (!ticket) {
    return interaction.reply({ content: 'This is not an active ticket channel.', ephemeral: true });
  }

  await interaction.deferReply();

  const transcriptAttachment = await generateTranscript(channel, ticket.ticketNumber);

  ticket.status = 'closed';
  ticket.closedBy = interaction.user.id;
  ticket.closedAt = new Date();
  await ticket.save();

  const closedEmbed = new EmbedBuilder()
    .setTitle(config.embeds.ticketClosed.title)
    .setDescription(
      fillTemplate(config.embeds.ticketClosed.description, { closer: `<@${interaction.user.id}>` })
    )
    .setColor(hexColor(config.embeds.ticketClosed.color))
    .setFooter({ text: `Ticket #${ticket.ticketNumber}` })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_reopen')
      .setLabel(config.embeds.ticketClosed.reopenButtonLabel)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket_delete')
      .setLabel(config.embeds.ticketClosed.deleteButtonLabel)
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [closedEmbed], components: [actionRow] });

  // Private staff log with transcript
  const logEmbed = new EmbedBuilder()
    .setTitle(config.embeds.logClose.title)
    .setColor(hexColor(config.embeds.logClose.color))
    .addFields(
      { name: 'Ticket', value: `#${ticket.ticketNumber}`, inline: true },
      { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Opened By', value: `${ticket.openerTag}`, inline: true }
    )
    .setTimestamp();

  const config2 = loadConfig();
  const logChannel = await guild.channels.fetch(config2.transcriptLogChannelId).catch(() => null);
  if (logChannel) {
    await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment] }).catch(() => {});
  }

  // DM to opener
  const opener = await guild.client.users.fetch(ticket.openerId).catch(() => null);
  if (opener) {
    const dmEmbed = new EmbedBuilder()
      .setTitle('Ticket Closed')
      .setDescription(`Your ticket **#${ticket.ticketNumber}** in **${guild.name}** was closed. A transcript is attached.`)
      .setColor(hexColor(config2.embeds.logClose.color))
      .setTimestamp();
    await opener
      .send({ embeds: [dmEmbed], files: [transcriptAttachment] })
      .catch(() => {});
  }

  await updatePresence(guild.client);

  if (config2.closeChannelOnClose) {
    await channel.permissionOverwrites
      .edit(ticket.openerId, { SendMessages: false })
      .catch(() => {});
  }
}

async function reopenTicket(interaction) {
  const config = loadConfig();
  const { guild, channel } = interaction;

  const ticket = await Ticket.findOne({ channelId: channel.id, status: 'closed' });
  if (!ticket) {
    return interaction.reply({ content: 'This ticket is not closed.', ephemeral: true });
  }

  ticket.status = 'open';
  ticket.reopenedBy = interaction.user.id;
  ticket.reopenedAt = new Date();
  await ticket.save();

  await channel.permissionOverwrites
    .edit(ticket.openerId, { SendMessages: true, ViewChannel: true })
    .catch(() => {});

  const reopenEmbed = new EmbedBuilder()
    .setTitle(config.embeds.ticketReopened.title)
    .setDescription(
      fillTemplate(config.embeds.ticketReopened.description, { reopener: `<@${interaction.user.id}>` })
    )
    .setColor(hexColor(config.embeds.ticketReopened.color))
    .setFooter({ text: `Ticket #${ticket.ticketNumber}` })
    .setTimestamp();

  await interaction.reply({ embeds: [reopenEmbed] });

  const logEmbed = new EmbedBuilder()
    .setTitle(config.embeds.logReopen.title)
    .setColor(hexColor(config.embeds.logReopen.color))
    .addFields(
      { name: 'Ticket', value: `#${ticket.ticketNumber} (${channel})`, inline: true },
      { name: 'Reopened By', value: `<@${interaction.user.id}>`, inline: true }
    )
    .setTimestamp();
  await sendPrivateLog(guild, logEmbed);

  const opener = await guild.client.users.fetch(ticket.openerId).catch(() => null);
  if (opener) {
    const dmEmbed = new EmbedBuilder()
      .setTitle('Ticket Reopened')
      .setDescription(`Your ticket **#${ticket.ticketNumber}** in **${guild.name}** was reopened: ${channel}`)
      .setColor(hexColor(config.embeds.logReopen.color))
      .setTimestamp();
    await dmUser(opener, dmEmbed, 'reopen');
  }

  await updatePresence(guild.client);
}

async function deleteTicketChannel(interaction) {
  const config = loadConfig();
  const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
  if (!ticket || ticket.status !== 'closed') {
    return interaction.reply({
      content: 'Only closed tickets can be deleted.',
      ephemeral: true
    });
  }

  // Ticket openers (regular members) may only close their ticket, not
  // delete the channel — deleting is a staff/admin-only action.
  const roleIds = getRoleIdsForCategory(config, ticket.category);
  if (!isStaffOrAdmin(interaction.member, roleIds)) {
    return interaction.reply({
      content: 'Only support staff or administrators can delete a ticket channel. You may close the ticket, but deletion is staff-only.',
      ephemeral: true
    });
  }

  await interaction.reply({
    content: `This channel will be deleted in ${config.deleteDelaySeconds} seconds...`
  });

  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, config.deleteDelaySeconds * 1000);
}

module.exports = {
  openTicket,
  claimTicket,
  closeTicket,
  reopenTicket,
  deleteTicketChannel
};