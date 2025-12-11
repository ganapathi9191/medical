import mongoose from 'mongoose';

const pharmacySchema = new mongoose.Schema({
  name: { type: String, },
  image: { type: String },

  latitude: { type: Number, },
  longitude: { type: Number, },

  // Auto-managed location from lat/lng
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    }
  },

  // All category names in a flat array
categories: [
  {
    name: { type: String,  },
    image: { type: String, }
  }
],
 // Vendor / Owner details
  vendorName: { type: String, },
  vendorEmail: { type: String,  },
  vendorPhone: { type: String, },
  status: { type: String, enum: ["Pending", "Active", "Suspended", "Inactive"], default: "Pending" },
   vendorId: { type: String, unique: true }, // auto-generated vendor ID
  password: { type: String }, // 4-digit password (can be hashed if needed)
  address: {
  type: String,
},


  // New fields for documents
  aadhar: { type: String },
  panCard: { type: String },
  license: { type: String },
  aadharFile: { type: String }, // URL to the uploaded aadhar photo
  panCardNumber: { type: String },
  panCardImage: { type: String }, // URL to the uploaded pan card photo
  licenseNumber: { type: String },
  licenseFile: { type: String }, // URL to the uploaded license file (image or PDF)
  panCardFile: { type: String }, // URL to the uploaded license file (image or PDF)



  // All products in a flat array of objects
  products: [
    {
      name: { type: String },
      category: { type: String }, // Optional: match against categories[]
      price: { type: Number },
      image: { type: String }
    }
  ],
    bankDetails: [
    {
      accountNumber: { type: String, },
      ifscCode: { type: String, },
      branchName: { type: String, },
      bankName: { type: String, },
      accountHolderName: { type: String, }, // Add the account holder name
    },
  ],

   // revenueByMonth as simple object, keys are months, values are amounts (Number)
  revenueByMonth: {
    type: Object,
    default: {},
  },

  // paymentStatus as simple object, keys are months, values are status strings
  paymentStatus: {
    type: Object,
    default: {},
  },

   // New paymentHistory field added here
  paymentHistory: [
    {
      month: {
        type: String,
      },
      status: {
        type: String,
      },
      amount: {
        type: Number,
        default: 0,
      },
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],



    // **Notifications** (Added directly as an embedded array)
  notifications: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', },
      status: { type: String},
      message: { type: String,},
      timestamp: { type: Date, default: Date.now },
      read: { type: Boolean, default: false },
    },
  ],

}, { timestamps: true });

// Add 2dsphere index for location
pharmacySchema.index({ location: '2dsphere' });

// Pre-save hook to auto-fill location from lat/lng
pharmacySchema.pre('save', function (next) {
  if (this.latitude && this.longitude) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
  next();
});

const Pharmacy = mongoose.model('Pharmacy', pharmacySchema);
export default Pharmacy;
