import mongoose from 'mongoose';

// Message Schema
const messageSchema = new mongoose.Schema({
  vendorIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Pharmacy',  // Reference to Pharmacy model
  },
  message: {
    type: String,
  },
    planType: {
    type: String,
  },
  sentAt: {
    type: Date,
    default: Date.now, // Automatically set the sent time to current date-time
  },
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
