const { Schema, model } = require('mongoose');

const ticketSchema = new Schema(
  {
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    ticketNumber: { type: Number, required: true },
    openerId: { type: String, required: true },
    openerTag: { type: String, required: true },
    category: { type: String, default: 'general' },
    subject: { type: String, default: '' },
    message: { type: String, default: '' },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open'
    },
    claimedBy: { type: String, default: null },
    closedBy: { type: String, default: null },
    closedAt: { type: Date, default: null },
    reopenedBy: { type: String, default: null },
    reopenedAt: { type: Date, default: null },
    transcriptUrl: { type: String, default: null }
  },
  { timestamps: true }
);

module.exports = model('Ticket', ticketSchema);