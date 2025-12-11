import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['Order', 'Pharmacy', 'PeriodicOrder'], 
  },
  referenceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'type' // Dynamically references Order or Pharmacy
  },
  message: { type: String, },
  status: { 
    type: String, 
    enum: ['Pending', 'Seen'], 
    default: 'Pending' 
  },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date }
});

export const Notification = mongoose.model('Notification', notificationSchema);
