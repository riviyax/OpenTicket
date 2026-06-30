const { Schema, model } = require('mongoose');

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = model('Counter', counterSchema);

async function getNextSequence(name) {
  const result = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result.seq;
}

module.exports = { Counter, getNextSequence };