const { AttachmentBuilder } = require('discord.js');

async function generateTranscript(channel, ticketNumber) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => new Map());
  const sorted = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  let content = `Transcript for Ticket #${ticketNumber} — #${channel.name}\n`;
  content += `Generated: ${new Date().toISOString()}\n`;
  content += `=`.repeat(50) + '\n\n';

  for (const msg of sorted) {
    const timestamp = msg.createdAt.toISOString();
    const author = msg.author.tag;
    const text = msg.content || '[Embed/Attachment]';
    content += `[${timestamp}] ${author}: ${text}\n`;
  }

  const buffer = Buffer.from(content, 'utf-8');
  return new AttachmentBuilder(buffer, { name: `transcript-${ticketNumber}.txt` });
}

module.exports = { generateTranscript };