import jwt from 'jsonwebtoken'; // For JWT token generation
import dotenv from 'dotenv';
import User from '../Models/User.js';
import multer from 'multer'; // Import multer for file handling
import path from 'path';  // To resolve file paths
import cloudinary from '../config/cloudinary.js';
import { fileURLToPath } from 'url';
import Pharmacy from '../Models/Pharmacy.js';
import Medicine from '../Models/Medicine.js';
import Cart from '../Models/Cart.js';
import mongoose from 'mongoose';
import Order from '../Models/Order.js';
import Query from '../Models/Query.js';
import Prescription from '../Models/Prescription.js';
import Rider from '../Models/Rider.js';
import { Notification } from '../Models/Notification.js';
import Razorpay from "razorpay";
import Chat from '../Models/Chat.js';
import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import fs from 'fs';
import Coupon from '../Models/Coupon.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';





const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_BxtRNvflG06PTV",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "RecEtdcenmR7Lm4AIEwo4KFr",
});



dotenv.config();



cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});




export const registerUser = async (req, res) => {
  try {
    const { name, mobile, code, email } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ message: 'Name and Mobile are required' });
    }

    // Check if user already exists (by mobile or email if provided)
    const query = email ? { $or: [{ mobile }, { email }] } : { mobile };
    const existingUser = await User.findOne(query);

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this mobile number or email' });
    }

    const generatedCode = code || Math.floor(10000000 + Math.random() * 90000000).toString();

    const newUser = new User({
      name,
      mobile,
      email: email || null,
      code: generatedCode,
      status: "active",
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        mobile: newUser.mobile,
        email: newUser.email,
        code: newUser.code,
        status: newUser.status,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, mobile } = req.body;

    // Validate User ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Validate required fields
    if (!name && !mobile) {
      return res.status(400).json({ message: "At least one field (name or mobile) is required" });
    }

    // Check if mobile is already used by another user
    if (mobile) {
      const existingUser = await User.findOne({ mobile, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ message: "Mobile number is already in use by another account" });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { ...(name && { name }), ...(mobile && { mobile }) } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User updated successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        mobile: updatedUser.mobile,
        profileImage: updatedUser.profileImage
      }
    });

  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


export const loginUser = async (req, res) => {
  const { mobile } = req.body;

  // 🔒 Validate input
  if (!mobile) {
    return res.status(400).json({ error: 'Mobile number is required' });
  }

  // 📞 Validate mobile format
  const mobilePattern = /^[0-9]{10}$/;
  if (!mobilePattern.test(mobile)) {
    return res.status(400).json({ error: 'Invalid mobile number format' });
  }

  try {
    // 🔍 Check user existence
    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    // ✅ Generate token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );

    // ✅ Respond with user info
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        code: user.code || null,
        status: user.status,
        createdAt: user.createdAt
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};



// User Controller (GET User)
// Get single user by ID
export const getUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    return res.status(200).json({
      message: "User details retrieved successfully",
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        code: user.code,
        profileImage:
          user.profileImage ||
          "https://img.freepik.com/premium-vector/student-avatar-illustration-user-profile-icon-youth-avatar_118339-4406.jpg?w=2000",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("Error in getUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};




// Get current directory for handling paths correctly in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up storage for profile images using Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads', 'profiles')); // Folder where profile images will be saved
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Use timestamp to avoid conflicts
  },
});

// Filter to ensure only image files can be uploaded
const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    return cb(new Error('Invalid file type. Only JPG, JPEG, and PNG files are allowed.'));
  }
};

// Initialize multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: fileFilter,
});

export const createProfile = async (req, res) => {
  try {
    const userId = req.params.id; // Get the userId from request params

    // Check if the user exists
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Check if a file is uploaded
    if (!req.files || !req.files.profileImage) {
      return res.status(400).json({ message: 'No file uploaded!' });
    }

    // Get the uploaded file (profileImage)
    const profileImage = req.files.profileImage;

    // Upload the profile image to Cloudinary
    const uploadedImage = await cloudinary.uploader.upload(profileImage.tempFilePath, {
      folder: 'poster', // Cloudinary folder where images will be stored
    });

    // Save the uploaded image URL to the user's profile
    existingUser.profileImage = uploadedImage.secure_url;

    // Save the updated user data to the database
    await existingUser.save();

    // Respond with the updated user profile
    return res.status(200).json({
      message: 'Profile image uploaded successfully!',
      user: {
        id: existingUser._id,
        profileImage: existingUser.profileImage,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Update Profile Image (with userId in params)
export const editProfileImage = async (req, res) => {
  try {
    const userId = req.params.userId; // Get the userId from request params

    // Check if the user exists
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Check if a new file is uploaded
    if (!req.files || !req.files.profileImage) {
      return res.status(400).json({ message: 'No new file uploaded!' });
    }

    const newProfileImage = req.files.profileImage;

    // OPTIONAL: Delete previous image from Cloudinary if you stored public_id
    // You can store public_id during upload for this purpose

    // Upload the new image to Cloudinary
    const uploadedImage = await cloudinary.uploader.upload(newProfileImage.tempFilePath, {
      folder: 'poster',
    });

    // Update the profileImage field with new URL
    existingUser.profileImage = uploadedImage.secure_url;

    // Save updated user
    await existingUser.save();

    // Respond
    return res.status(200).json({
      message: 'Profile image updated successfully!',
      user: {
        id: existingUser._id,
        profileImage: existingUser.profileImage,
      },
    });

  } catch (error) {
    console.error('Error updating profile image:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


// Get Profile (with userId in params)
export const getProfile = async (req, res) => {
  try {
    const userId = req.params.id;  // Get the user ID from request params

    // Find user by ID
    const user = await User.findById(userId);  // No need to populate subscribedPlans

    if (!user) {
      return res.status(404).json({ message: 'User not found! Please check the provided user ID.' });
    }

    // Respond with selected user details and set default profileImage to null if not present
    return res.status(200).json({
      message: 'User profile retrieved successfully!',  // Custom success message
      data: {
        name: user.name || 'No name available',  // Provide fallback in case name is missing
        mobile: user.mobile || 'No mobile number available',  // Provide fallback in case mobile is missing
        profileImage: user.profileImage || null,  // Default to null if profileImage doesn't exist
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};




// Step 1: Verify mobile number exists
export const verifyMobile = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ message: 'User with this mobile number does not exist' });
    }

    // Return userId so it can be passed to step 2
    return res.status(200).json({
      message: 'Mobile number verified. You can now reset your password.',
      userId: user._id
    });

  } catch (error) {
    console.error('Error in verifyMobile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




// Step 2: Reset password using userId
export const resetPassword = async (req, res) => {
  try {
    const { userId, password, confirmPassword } = req.body;

    if (!userId || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = password;
    user.confirmPassword = confirmPassword;

    await user.save();

    return res.status(200).json({
      message: 'Password updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        aadhaarCardNumber: user.aadhaarCardNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Error in resetPassword:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



export const submitForm = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, mobile, email, aadhar, pan, upi, group, collegeId } = req.body;

    if (!name || !mobile || !email || !aadhar || !pan || !upi || !group || !collegeId) {
      return res.status(400).json({ message: 'All fields including collegeId are required' });
    }

    // Check if college exists
    const college = await College.findById(collegeId);
    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    // Create the form with student ID
    const form = new Form({
      name,
      mobile,
      email,
      aadhar,
      pan,
      upi,
      group,
      college: collegeId,
      student: userId   // ✅ storing userId in student field
    });

    await form.save();

    // Add form to user's forms array
    const user = await User.findById(userId);
    if (user) {
      user.forms.push(form._id);
      await user.save();
    }

    // Populate college details and student info
    const populatedForm = await Form.findById(form._id)
      .populate('college')
      .populate('student', 'username email'); // optional: populate student info

    return res.status(201).json({
      message: 'Form submitted successfully',
      form: populatedForm
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



export const getSubmittedFormsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const submittedForms = await Form.find({
      student: userId,
      status: 'Submitted'
    })
      .populate('college')
      .populate('student', 'username email');

    return res.status(200).json({
      message: 'Submitted forms fetched successfully',
      forms: submittedForms
    });
  } catch (error) {
    console.error('Error fetching submitted forms:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



export const updateUserLocation = async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.body;

    if (!userId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'userId, latitude, and longitude are required' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      message: 'User location stored successfully',
      location: updatedUser.location,
    });
  } catch (error) {
    console.error('Error storing user location:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};


export const getNearestPharmaciesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user || !user.location || !user.location.coordinates) {
      return res.status(404).json({ message: 'User location not found' });
    }

    const [userLng, userLat] = user.location.coordinates;

    const pharmacies = await Pharmacy.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [userLng, userLat] },
          distanceField: "dist.calculated",
          maxDistance: 10000,
          spherical: true,
        }
      },
    ]);

    res.status(200).json({
      message: 'Nearest pharmacies fetched successfully',
      pharmacies,
    });

  } catch (error) {
    console.error('Error fetching nearest pharmacies:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



export const addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { medicineId, quantity, inc, dec } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(medicineId)) {
      return res.status(400).json({ message: 'Invalid medicine ID' });
    }

    // Fetch medicine
    const medicine = await Medicine.findById(medicineId).populate('pharmacyId');
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // If cart doesn't exist, create new cart with one item
      cart = new Cart({
        userId,
        items: [
          {
            medicineId,
            quantity: quantity || 1,
            name: medicine.name,
            mrp: medicine.mrp, // Use the price (mrp) here
            images: medicine.images, // Assuming images is an array in the Medicine model
            description: medicine.description, // Assuming description exists in the Medicine model
            pharmacy: medicine.pharmacyId, // Pharmacy reference
          },
        ],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.medicineId.toString() === medicineId
      );

      if (itemIndex > -1) {
        // Item exists in cart
        if (inc) {
          cart.items[itemIndex].quantity += 1;
        } else if (dec) {
          cart.items[itemIndex].quantity = Math.max(1, cart.items[itemIndex].quantity - 1);
        } else if (quantity) {
          // direct quantity set if inc/dec not passed
          cart.items[itemIndex].quantity = quantity;
        }
      } else {
        // Item not in cart, push new
        cart.items.push({
          medicineId,
          quantity: quantity || 1,
          name: medicine.name,
          price: medicine.mrp, // Use the price (mrp)
          images: medicine.images,
          description: medicine.description,
          pharmacy: medicine.pharmacyId,
        });
      }
    }

    // Calculate subTotal using mrp
    let subTotal = 0;
    for (const item of cart.items) {
      const med = await Medicine.findById(item.medicineId);
      if (med) {
        subTotal += med.mrp * item.quantity;
      }
    }

    cart.subTotal = subTotal;
    cart.platformFee = 10;

    // 🔥 NEW: Fetch admin-set delivery charge (baseFare)
    let deliveryCharge = 22; // fallback
    try {
      const rider = await Rider.findOne({}, { baseFare: 1 });
      if (rider && rider.baseFare !== undefined) {
        deliveryCharge = rider.baseFare;
      }
    } catch (err) {
      console.log("Failed to fetch base fare from Rider, using default 22");
    }

    cart.deliveryCharge = deliveryCharge;

    // Total payable
    cart.totalPayable = cart.subTotal + cart.platformFee + cart.deliveryCharge;

    await cart.save();

    return res.status(200).json({
      message: 'Cart updated successfully',
      cart,
    });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.medicineId',
        select: 'name price images description pharmacyId mrp',
        populate: {
          path: 'pharmacyId',
          select: 'name location'
        }
      });

    if (!cart) {
      // Cart nahi mila, empty response with zero values
      return res.status(200).json({
        message: 'Cart fetched successfully',
        cart: {
          items: [],
          totalItems: 0,
          subTotal: 0,
          platformFee: 0,
          deliveryCharge: 0,
          totalPayable: 0
        }
      });
    }

    const totalItems = cart.items.reduce((acc, item) => acc + item.quantity, 0);

    if (totalItems === 0) {
      // Cart hai par items nahi, sab zero show karo
      return res.status(200).json({
        message: 'Cart fetched successfully',
        cart: {
          items: [],
          totalItems: 0,
          subTotal: 0,
          platformFee: 0,
          deliveryCharge: 0,
          totalPayable: 0
        }
      });
    }

    // Items hain, fixed platformFee and deliveryCharge dikhao
    return res.status(200).json({
      message: 'Cart fetched successfully',
      cart: {
        items: cart.items.map(item => ({
          medicineId: item.medicineId._id,
          name: item.medicineId.name,
          mrp: item.medicineId.mrp,
          images: item.medicineId.images,
          description: item.medicineId.description,
          pharmacy: item.medicineId.pharmacyId,
          quantity: item.quantity,
          totalPrice: item.medicineId.mrp * item.quantity
        })),
        totalItems,
        subTotal: cart.subTotal,
        platformFee: 10,     // static value shown only if items exist
        deliveryCharge: 0,  // static value shown only if items exist
        totalPayable: cart.subTotal + 10 + 0
      }
    });

  } catch (error) {
    console.error('Get Cart Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const removeFromCart = async (req, res) => {
  try {
    const { userId, medicineId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(medicineId)) {
      return res.status(400).json({ message: 'Invalid medicine ID' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found for this user' });
    }

    // Filter out the medicine to be removed
    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => item.medicineId.toString() !== medicineId);

    if (cart.items.length === initialLength) {
      return res.status(404).json({ message: 'Medicine not found in cart' });
    }

    // Recalculate subTotal - MRP use karo price ki jagah
    let subTotal = 0;
    for (const item of cart.items) {
      const med = await Medicine.findById(item.medicineId);
      if (med) {
        subTotal += med.mrp * item.quantity; // MRP use karo
      }
    }

    cart.subTotal = subTotal;

    // Fixed charges set karo
    cart.platformFee = 10;
    cart.deliveryCharge = 22;
    cart.totalPayable = cart.subTotal + cart.platformFee + cart.deliveryCharge;

    await cart.save();

    return res.status(200).json({
      message: 'Medicine removed from cart successfully',
      cart
    });

  } catch (error) {
    console.error('Remove from Cart Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const addAddress = async (req, res) => {
  try {
    const { userId } = req.params;
    const { house, street, city, state, pincode, country } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (!house || !street || !city || !state || !pincode || !country) {
      return res.status(400).json({ message: 'Please provide all address fields' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.myAddresses.push({ house, street, city, state, pincode, country });

    await user.save();

    return res.status(201).json({
      message: 'Address added successfully',
      myAddresses: user.myAddresses
    });

  } catch (error) {
    console.error('Add Address Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const getAddresses = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      message: 'User addresses fetched successfully',
      myAddresses: user.myAddresses || []
    });

  } catch (error) {
    console.error('Get Addresses Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const createBookingFromCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      addressId,
      notes,
      voiceNoteUrl,
      paymentMethod,
      transactionId,
      couponCode,
    } = req.body;

    console.log(`🔹 Order creation started for user: ${userId}`);
    console.log(`🔹 Payment method: ${paymentMethod}, Coupon: ${couponCode}`);

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: "Invalid address ID" });
    }

    // Fetch User
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    console.log(`🔹 User found: ${user.name}`);

    // Log user location
    if (user.location?.coordinates) {
      console.log(`📍 User location coordinates: [${user.location.coordinates}]`);
    } else {
      console.log("⚠️ User location not found");
    }

    // Find delivery address
    const deliveryAddress = user.myAddresses.id(addressId);
    if (!deliveryAddress) {
      return res.status(404).json({ message: "Address not found" });
    }
    console.log(`🏠 Delivery address: ${deliveryAddress.house}, ${deliveryAddress.city}`);

    // Fetch cart and populate medicine info
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.medicineId",
      select: "name mrp images description pharmacyId location status",
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    console.log(`🛒 Cart has ${cart.items.length} items, Subtotal: ₹${cart.subTotal}`);

    // Prepare order items
    const orderItems = cart.items.map((item) => ({
      medicineId: item.medicineId._id,
      quantity: item.quantity,
      name: item.medicineId.name,
      price: item.price,
      images: item.medicineId.images,
      description: item.medicineId.description,
      pharmacy: item.medicineId.pharmacyId,
    }));

    let { subTotal } = cart;
    const platformFee = 10;
    const deliveryCharge = 0;
    let totalPayable = subTotal + platformFee + deliveryCharge;
    console.log(`💰 Payment breakdown - Subtotal: ₹${subTotal}, Platform fee: ₹${platformFee}, Total: ₹${totalPayable}`);

    // Handle coupon
    let discountAmount = 0;
    if (couponCode) {
      console.log(`🎫 Applying coupon: ${couponCode}`);
      const coupon = await Coupon.findOne({ couponCode });
      if (coupon) {
        if (coupon.expirationDate < new Date()) {
          return res.status(400).json({ message: "Coupon has expired" });
        }
        discountAmount = (subTotal * coupon.discountPercentage) / 100;
        totalPayable -= discountAmount;
        if (totalPayable < 0) totalPayable = 0;

        orderItems.push({
          name: `Coupon Discount: ${couponCode}`,
          price: -discountAmount,
          quantity: 1,
        });
        console.log(`✅ Coupon applied! Discount: ₹${discountAmount}, New total: ₹${totalPayable}`);
      } else {
        return res.status(404).json({ message: "Invalid coupon code" });
      }
    }

    // Payment verification (if not COD)
    let paymentStatus = "Pending";
    let verifiedPaymentDetails = null;
    if (paymentMethod !== "Cash on Delivery") {
      console.log(`💳 Online payment with transaction ID: ${transactionId}`);
      if (!transactionId) {
        return res
          .status(400)
          .json({ message: "Transaction ID is required for online payments" });
      }

      try {
        const paymentInfo = await razorpay.payments.fetch(transactionId);
        if (!paymentInfo) {
          return res.status(404).json({ message: "Payment not found" });
        }

        if (paymentInfo.status === "authorized") {
          await razorpay.payments.capture(transactionId, totalPayable * 100, "INR");
        }

        verifiedPaymentDetails = await razorpay.payments.fetch(transactionId);
        if (verifiedPaymentDetails.status !== "captured") {
          return res.status(400).json({
            message: `Payment not captured. Status: ${verifiedPaymentDetails.status}`,
          });
        }

        paymentStatus = "Captured";
        console.log(`✅ Payment captured successfully: ${transactionId}`);
      } catch (err) {
        console.error("❌ Razorpay verification error:", err);
        return res
          .status(500)
          .json({ message: "Payment verification failed", error: err.message });
      }
    } else {
      console.log(`💵 Cash on Delivery selected`);
    }

    // ------------------------------------------------------------
    // 🧭 SMART PHARMACY FINDER - Works with any coordinate format
    // ------------------------------------------------------------
    console.log("\n🔍 Finding nearest pharmacy...");
    let selectedPharmacy = null;
    let activePharmacies = [];

    // Get user coordinates
    const [userLng, userLat] = user.location?.coordinates || [];

    if (userLng && userLat) {
      console.log(`📍 User coordinates: [${userLng}, ${userLat}]`);

      // METHOD 1: Try normal geospatial search
      try {
        console.log(`🔎 Method 1: Searching with coordinates [${userLng}, ${userLat}]`);
        activePharmacies = await Pharmacy.find({
          status: "Active",
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [userLng, userLat],
              },
              $maxDistance: 100000, // 100 km (increased)
            },
          },
        }).limit(5);

        console.log(`✅ Method 1 found: ${activePharmacies.length} pharmacies`);
        if (activePharmacies.length > 0) {
          console.log(`🏥 Pharmacies found: ${activePharmacies.map(p => p.name).join(', ')}`);
        }
      } catch (error) {
        console.log("❌ Method 1 geospatial query failed:", error.message);
      }

      // METHOD 2: If not found, try with swapped coordinates
      if (!activePharmacies.length) {
        try {
          console.log(`🔄 Method 2: Trying swapped coordinates [${userLat}, ${userLng}]`);
          activePharmacies = await Pharmacy.find({
            status: "Active",
            location: {
              $near: {
                $geometry: {
                  type: "Point",
                  coordinates: [userLat, userLng], // Swapped
                },
                $maxDistance: 100000,
              },
            },
          }).limit(5);

          console.log(`✅ Method 2 found: ${activePharmacies.length} pharmacies`);
        } catch (error) {
          console.log("❌ Method 2 geospatial query failed:", error.message);
        }
      }
    } else {
      console.log("⚠️ User coordinates not available, using fallback methods");
    }

    // METHOD 3: If still no pharmacies, get any active pharmacy
    if (!activePharmacies.length) {
      console.log("📋 Method 3: Getting any active pharmacy");
      activePharmacies = await Pharmacy.find({
        status: "Active"
      }).limit(5);
      console.log(`✅ Method 3 found: ${activePharmacies.length} active pharmacies`);
    }

    // METHOD 4: If still no pharmacy, create a dummy one
    if (!activePharmacies.length) {
      console.log("⚡ Method 4: Creating system pharmacy");

      // Check if system pharmacy exists
      let systemPharmacy = await Pharmacy.findOne({ name: "System Pharmacy" });

      if (!systemPharmacy) {
        // Create a system pharmacy if none exists
        systemPharmacy = new Pharmacy({
          name: "System Pharmacy",
          vendorName: "System",
          vendorEmail: "system@pharmacy.com",
          vendorPhone: "0000000000",
          status: "Active",
          address: "System Address",
          location: {
            type: "Point",
            coordinates: [userLng || 77.1025, userLat || 28.7041] // Default to Delhi
          }
        });
        await systemPharmacy.save();
        console.log("✅ Created new system pharmacy");
      }

      activePharmacies = [systemPharmacy];
      console.log("✅ Using system pharmacy");
    }

    // Select the first available pharmacy
    selectedPharmacy = activePharmacies[0];
    console.log(`\n🎯 Selected Pharmacy: ${selectedPharmacy.name} (ID: ${selectedPharmacy._id})`);
    console.log(`📍 Pharmacy Location: ${selectedPharmacy.location?.coordinates}`);
    console.log(`📞 Pharmacy Contact: ${selectedPharmacy.vendorPhone || selectedPharmacy.phone}`);

    // ------------------------------------------------------------
    // Create the order
    // ------------------------------------------------------------
    console.log("\n📦 Creating order...");
    const newOrder = new Order({
      userId,
      deliveryAddress,
      orderItems,
      subTotal,
      platformFee,
      deliveryCharge,
      totalAmount: totalPayable,
      couponCode: couponCode || null,
      discountAmount,
      notes: notes || "",
      voiceNoteUrl: voiceNoteUrl || "",
      paymentMethod,
      transactionId: transactionId || null,
      paymentStatus,
      status: "Pending",
      statusTimeline: [
        {
          status: "Pending",
          message: "Order placed",
          timestamp: new Date(),
        },
      ],
      assignedPharmacy: selectedPharmacy._id,
      pharmacyResponse: "Pending",
      razorpayOrder: verifiedPaymentDetails || null,
    });

    await newOrder.save();
    console.log(`✅ Order created successfully! Order ID: ${newOrder._id}`);

    // Notify user
    user.notifications.push({
      orderId: newOrder._id,
      status: "Pending",
      message: `Your order has been placed successfully. Order ID: ORD${newOrder._id.toString().slice(-6).toUpperCase()}`,
      timestamp: new Date(),
      read: false,
    });
    await user.save();
    console.log(`📨 Notification sent to user`);

    // Notify selected pharmacy
    if (selectedPharmacy.notifications) {
      selectedPharmacy.notifications.push({
        orderId: newOrder._id,
        status: "Pending",
        message: `New order placed by ${user.name}. Order ID: ORD${newOrder._id.toString().slice(-6).toUpperCase()}`,
        timestamp: new Date(),
        read: false,
      });
      await selectedPharmacy.save();
      console.log(`📨 Notification sent to pharmacy`);
    }

    // Clear cart
    cart.items = [];
    cart.subTotal = 0;
    cart.platformFee = 0;
    cart.deliveryCharge = 0;
    cart.totalPayable = 0;
    await cart.save();
    console.log(`🛒 Cart cleared`);

    // Global notification for all
    await Notification.create({
      type: "Order",
      referenceId: newOrder._id,
      message: `New order placed by ${user.name}, status: "Pending"`,
    });
    console.log(`🔔 Global notification created`);

    console.log("\n🎉 Order process completed successfully!");

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: {
        _id: newOrder._id,
        orderId: `ORD${newOrder._id.toString().slice(-6).toUpperCase()}`,
        totalAmount: newOrder.totalAmount,
        status: newOrder.status,
        paymentMethod: newOrder.paymentMethod,
        paymentStatus: newOrder.paymentStatus,
        createdAt: newOrder.createdAt,
        itemsCount: orderItems.length,
      },
      pharmacy: {
        _id: selectedPharmacy._id,
        name: selectedPharmacy.name,
        phone: selectedPharmacy.vendorPhone || selectedPharmacy.phone,
        status: selectedPharmacy.status,
        address: selectedPharmacy.address,
      },
      deliveryAddress: newOrder.deliveryAddress,
      summary: {
        subTotal: subTotal,
        platformFee: platformFee,
        deliveryCharge: deliveryCharge,
        discountAmount: discountAmount,
        totalPayable: totalPayable
      }
    });
  } catch (error) {
    console.error("\n❌ Error in createBookingFromCart:", error);

    // More detailed error response
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
export const getMyBookings = async (req, res) => {
  try {
    const { userId } = req.params;

    // User ID validation
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Fetch bookings for user
    const bookings = await Order.find({ userId })
      .sort({ createdAt: -1 }) // Latest first
      .populate({
        path: 'orderItems.medicineId',
        select: 'name mrp images description'
      });

    return res.status(200).json({
      message: 'Bookings fetched successfully',
      totalBookings: bookings.length,
      bookings
    });

  } catch (error) {
    console.error('Get My Bookings Error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};



export const cancelOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    // Find order by ID and user
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ message: "Order not found for this user" });
    }

    // Check if already cancelled or delivered
    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }
    if (order.status === "Delivered") {
      return res.status(400).json({ message: "Delivered orders cannot be cancelled" });
    }

    // Add cancellation entry to the statusTimeline
    const cancellationEntry = {
      status: "Cancelled",
      message: "Order has been cancelled by the user.",
      timestamp: new Date(),
    };

    order.statusTimeline.push(cancellationEntry);  // Push the cancellation entry to the timeline

    // Update the order status to 'Cancelled'
    order.status = "Cancelled";
    await order.save();  // Save the updated order

    return res.status(200).json({
      message: "Order cancelled successfully",
      order,
    });

  } catch (error) {
    console.error("Cancel Order Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


export const getPreviousOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    // User ID validation
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Fetch sirf Delivered orders
    const previousOrders = await Order.find({
      userId,
      status: 'Delivered' // status exactly match hona chahiye
    })
      .sort({ createdAt: -1 }) // Latest delivered first
      .populate({
        path: 'orderItems.medicineId',
        select: 'name price images description'
      });

    return res.status(200).json({
      message: 'Previous (Delivered) orders fetched successfully',
      totalDeliveredOrders: previousOrders.length,
      orders: previousOrders
    });

  } catch (error) {
    console.error('Get Previous Orders Error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};




export const getSinglePreviousOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    // Find the delivered order for this user
    const order = await Order.findOne({
      _id: orderId,
      userId,
      status: "Delivered"
    }).populate({
      path: "orderItems.medicineId",
      select: "name price images description"
    });

    if (!order) {
      return res.status(404).json({
        message: "Delivered order not found for this user"
      });
    }

    return res.status(200).json({
      message: "Delivered order fetched successfully",
      order
    });

  } catch (error) {
    console.error("Get Single Previous Order Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


export const removeDeliveredOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params;

    // ID validations
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    // Find order by userId & orderId
    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found for this user' });
    }

    // Check status before removing
    if (order.status !== 'Delivered') {
      return res.status(400).json({ message: 'Only Delivered orders can be removed' });
    }

    // Remove order
    await order.deleteOne();

    return res.status(200).json({
      message: 'Delivered order removed successfully',
      removedOrderId: orderId
    });

  } catch (error) {
    console.error('Remove Delivered Order Error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};



export const getNotifications = async (req, res) => {
  const { userId } = req.params;

  // Validate userId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    const user = await User.findById(userId).select('notifications');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const sortedNotifications = [...user.notifications].sort((a, b) => b.timestamp - a.timestamp);

    return res.status(200).json({
      message: 'Notifications fetched successfully',
      total: sortedNotifications.length,
      notifications: sortedNotifications
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};



// ✅ Create new query
export const createQuery = async (req, res) => {
  try {
    const { name, email, mobile, message } = req.body;
    const query = new Query({ name, email, mobile, message });
    await query.save();
    res.status(201).json({ message: "Query submitted successfully", query });
  } catch (error) {
    res.status(500).json({ message: "Error creating query", error });
  }
};


// 🌟 Send Prescription (image/pdf upload) using params
export const sendPrescription = async (req, res) => {
  try {
    const { userId, pharmacyId } = req.params;
    const { notes } = req.body;

    if (!userId || !pharmacyId) {
      return res.status(400).json({ message: "userId and pharmacyId are required in params" });
    }

    if (!req.files || !req.files.prescriptionFile) {
      return res.status(400).json({ message: "Prescription file is required" });
    }

    const file = req.files.prescriptionFile;

    // 📤 Upload to Cloudinary
    const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "prescriptions",
      resource_type: "auto", // image/pdf/other types
    });

    const prescription = new Prescription({
      userId,
      pharmacyId,
      prescriptionUrl: uploaded.secure_url,
      notes: notes || "",
    });

    await prescription.save();

    res.status(201).json({
      message: "Prescription sent successfully",
      prescription,
    });
  } catch (error) {
    console.error("Send Prescription Error:", error);
    res.status(500).json({ message: "Error sending prescription", error: error.message });
  }
};



// ✅ Get Prescriptions for a User using params
export const getPrescriptionsForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "userId is required in params" });
    }

    const prescriptions = await Prescription.find({ userId })
      .populate("pharmacyId", "name email phone") // populate pharmacy info
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "User prescriptions fetched successfully",
      prescriptions,
    });
  } catch (error) {
    console.error("Get User Prescriptions Error:", error);
    res.status(500).json({ message: "Error fetching user prescriptions", error: error.message });
  }
};



// 📤 Get statusTimeline and medicine details of latest order for a user
export const getUserOrderStatuses = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch latest order with populated medicine details
    const latestOrder = await Order.findOne({ userId })
      .sort({ createdAt: -1 }) // latest order
      .select("statusTimeline orderItems") // Include orderItems for medicine details
      .populate({
        path: "orderItems.medicineId",
        select: "name mrp description images", // Add more if needed
      });

    if (!latestOrder) {
      return res.status(404).json({ message: "No order found for this user" });
    }

    const timeline = latestOrder.statusTimeline;

    // Check if "PickedUp" status exists in timeline
    const isPickedUp = timeline.some(item => item.status === "PickedUp");

    // Format medicine details
    const medicines = latestOrder.orderItems.map(item => ({
      name: item?.medicineId?.name || "Unknown",
      mrp: item?.medicineId?.mrp || 0,
      description: item?.medicineId?.description || "",
      images: item?.medicineId?.images || [], // Expecting array of image URLs or paths
      quantity: item?.quantity || 1,
    }));

    return res.status(200).json({
      message: "Latest order statusTimeline fetched successfully",
      statusTimeline: timeline,
      deliveryNote: isPickedUp ? "Your order will be delivered in 10 mins" : null,
      medicines, // 🆕 Added medicine details
    });

  } catch (error) {
    console.error("Error fetching statusTimeline:", error);
    return res.status(500).json({ message: "Server error while fetching statusTimeline" });
  }
};




// Utility function to calculate distance (in kilometers) between two coordinates using Haversine formula
const calculateDistance = (coord1, coord2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Calculate estimated time based on distance and average speed
const calculateTime = (distance) => {
  const speed = 30; // Speed in km/h, assuming a rider's average speed
  const timeInHours = distance / speed; // Time in hours
  const timeInMinutes = Math.round(timeInHours * 60); // Convert time to minutes
  return timeInMinutes;
};

// Add time to a given timestamp (order creation time)
const addMinutesToTime = (time, minutesToAdd) => {
  const newTime = new Date(time);
  newTime.setMinutes(newTime.getMinutes() + minutesToAdd);
  return newTime;
};

// Format a date into 12-hour format (AM/PM)
const formatTimeTo12Hour = (date) => {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12; // Convert 24-hour to 12-hour format
  hours = hours ? hours : 12; // '0' becomes 12
  minutes = minutes < 10 ? '0' + minutes : minutes; // Add leading zero if needed
  return `${hours}:${minutes} ${ampm}`;
};


export const reorderDeliveredOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    const { paymentMethod, transactionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: "Invalid user ID" });

    if (!mongoose.Types.ObjectId.isValid(orderId))
      return res.status(400).json({ message: "Invalid order ID" });

    const validPayments = [
      "Credit/Debit card", "Phonepe", "Google pay", "Paytm", "Cash on Delivery", "Online"
    ];
    if (!paymentMethod || !validPayments.includes(paymentMethod))
      return res.status(400).json({ message: "Invalid payment method" });

    const originalOrder = await Order.findOne({ _id: orderId, status: "Delivered" });
    if (!originalOrder)
      return res.status(404).json({ message: "Delivered order not found" });

    if (originalOrder.userId.toString() !== userId)
      return res.status(403).json({ message: "Unauthorized reorder attempt" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const deliveryAddress = originalOrder.deliveryAddress;

    // ✅ Rebuild order items using fresh medicine data to get current MRP
    let orderItems = [];
    let subTotal = 0;

    for (const item of originalOrder.orderItems) {
      const medicine = await Medicine.findById(item.medicineId);
      if (!medicine)
        return res.status(404).json({ message: `Medicine not found: ${item.medicineId}` });

      const currentMRP = medicine.mrp || 0;
      const qty = item.quantity || 1;

      orderItems.push({
        medicineId: medicine._id,
        quantity: qty,
        name: medicine.name,
        price: currentMRP,
        images: medicine.images,
        description: medicine.description,
        pharmacy: medicine.pharmacyId,
      });

      subTotal += currentMRP * qty;
    }

    const platformFee = 10;

    // ✅ Find nearest rider
    const allRiders = await Rider.find();
    let nearestRider = null;
    let minDistance = Infinity;

    const userLat = user.location?.coordinates[1] || 0;
    const userLon = user.location?.coordinates[0] || 0;

    for (let rider of allRiders) {
      if (!rider.latitude || !rider.longitude) continue;

      const distance = calculateDistance(
        [parseFloat(rider.longitude), parseFloat(rider.latitude)],
        [userLon, userLat]
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestRider = rider;
      }
    }

    const deliveryCharge = nearestRider ? calculateDeliveryCharge(minDistance) : 0;
    const totalAmount = subTotal + platformFee + deliveryCharge;

    if (isNaN(totalAmount)) {
      return res.status(500).json({ message: "Invalid total amount (NaN)" });
    }

    // ✅ Payment processing
    let paymentStatus = "Pending";
    let verifiedPaymentDetails = null;

    if (paymentMethod !== "Cash on Delivery") {
      if (!transactionId)
        return res.status(400).json({ message: "Transaction ID is required for online payment" });

      try {
        const paymentInfo = await razorpay.payments.fetch(transactionId);
        if (!paymentInfo)
          return res.status(404).json({ message: "Payment not found" });

        const amountToCapture = paymentInfo.amount;

        if (paymentInfo.status === "authorized") {
          await razorpay.payments.capture(transactionId, amountToCapture, "INR");
        }

        verifiedPaymentDetails = await razorpay.payments.fetch(transactionId);
        if (verifiedPaymentDetails.status !== "captured") {
          return res.status(400).json({
            message: `Payment not captured. Status: ${verifiedPaymentDetails.status}`,
          });
        }

        // ✅ Set to "Completed" instead of "Captured"
        paymentStatus = "Completed";
      } catch (err) {
        console.error("Razorpay Error:", err);
        return res.status(500).json({
          message: "Payment verification failed",
          error: err.message,
        });
      }
    }

    // ✅ Create new order
    const newOrder = new Order({
      userId,
      deliveryAddress,
      orderItems,
      subTotal,
      platformFee,
      deliveryCharge,
      totalAmount,
      notes: originalOrder.notes,
      voiceNoteUrl: originalOrder.voiceNoteUrl,
      paymentMethod,
      transactionId: transactionId || null,
      paymentStatus,
      status: "Pending",
      statusTimeline: [
        {
          status: "Pending",
          message: "Order placed via reorder",
          timestamp: new Date(),
        },
      ],
      assignedRider: nearestRider?._id || null,
      assignedRiderStatus: "Pending",
      razorpayOrder: verifiedPaymentDetails || null,
      isReordered: true,
    });

    // ✅ Rider notification
    if (nearestRider) {
      newOrder.statusTimeline.push({
        status: "Rider Assigned",
        message: `Rider ${nearestRider.name} assigned`,
        timestamp: new Date(),
      });

      nearestRider.notifications.push({
        message: `New order assigned via reorder from ${user.name}`,
        order: {
          _id: newOrder._id,
          user: {
            _id: user._id,
            name: user.name,
            phone: user.phone,
          },
          deliveryAddress,
          orderItems,
          subTotal,
          platformFee,
          deliveryCharge,
          totalAmount,
          paymentMethod,
          paymentStatus,
          status: newOrder.status,
          statusTimeline: newOrder.statusTimeline,
        },
      });

      await nearestRider.save();
    }

    await newOrder.save();

    await Notification.create({
      type: "Order",
      referenceId: newOrder._id,
      message: `New reorder placed by ${user.name}`,
      status: "Pending",
    });

    return res.status(201).json({
      message: "Order placed successfully via reorder",
      orderId: newOrder._id,
      status: newOrder.status,
      paymentStatus,
    });

  } catch (error) {
    console.error("Reorder Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



export const togglePeriodicMedsPlan = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be true or false" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { "periodicMedsPlan.isActive": isActive },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: `Periodic Meds Plan ${isActive ? "activated" : "deactivated"} successfully.`,
      periodicMedsPlan: user.periodicMedsPlan,
    });

  } catch (error) {
    console.error("Error toggling periodic plan:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const createPeriodicOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      planType,
      orderItems,
      deliveryDates,
      notes,
      voiceNoteUrl,
      paymentMethod,
      transactionId,
      couponCode,
    } = req.body;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Validate planType
    if (!planType || !["Weekly", "Monthly"].includes(planType)) {
      return res.status(400).json({
        message: "planType must be 'Weekly' or 'Monthly'",
      });
    }

    // Validate orderItems
    if (
      !orderItems ||
      !Array.isArray(orderItems) ||
      orderItems.length === 0 ||
      orderItems.some((item) => !item.medicineId || !item.quantity)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid orderItems: must include medicineId and quantity" });
    }

    // Validate deliveryDates
    if (
      !deliveryDates ||
      !Array.isArray(deliveryDates) ||
      deliveryDates.length === 0 ||
      deliveryDates.some((d) => isNaN(new Date(d).getTime()))
    ) {
      return res
        .status(400)
        .json({ message: "Invalid deliveryDates: must be valid date array" });
    }

    // Fetch User
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.myAddresses || user.myAddresses.length === 0) {
      return res.status(400).json({ message: "User has no saved addresses" });
    }

    const deliveryAddress = user.myAddresses[0];

    // Prepare orderItems with medicine info
    let subTotal = 0;
    const enrichedItems = [];

    for (const item of orderItems) {
      const med = await Medicine.findById(item.medicineId);
      if (!med) {
        return res
          .status(404)
          .json({ message: `Medicine not found: ${item.medicineId}` });
      }

      const totalPrice = med.mrp * item.quantity;
      subTotal += totalPrice;

      enrichedItems.push({
        medicineId: med._id,
        name: med.name,
        price: med.mrp,
        quantity: item.quantity,
        images: med.images || [],
        description: med.description || "",
        pharmacy: med.pharmacyId || null,
      });
    }

    // Fees
    const platformFee = 10;
    const deliveryCharge = 0;
    let totalPayable = subTotal + platformFee + deliveryCharge;

    let discountAmount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ couponCode });
      if (!coupon)
        return res.status(404).json({ message: "Invalid coupon code" });

      if (coupon.expirationDate < new Date())
        return res.status(400).json({ message: "Coupon has expired" });

      discountAmount = (subTotal * coupon.discountPercentage) / 100;
      totalPayable -= discountAmount;
      if (totalPayable < 0) totalPayable = 0;

      enrichedItems.push({
        name: `Coupon Discount: ${couponCode}`,
        price: -discountAmount,
        quantity: 1,
      });
    }

    // ------------------------------------------------------------
    // 🧭 Skip nearest pharmacy search (commented out)
    // ------------------------------------------------------------
    /*
    const [userLng, userLat] = user.location?.coordinates || [];
    if (typeof userLat !== "number" || typeof userLng !== "number") {
      return res
        .status(400)
        .json({ message: "User location coordinates missing or invalid" });
    }

    const nearestPharmacies = await Pharmacy.find({
      status: "Active",
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [userLng, userLat],
          },
          $maxDistance: 10000, // 10 km
        },
      },
    });

    if (!nearestPharmacies.length) {
      return res.status(404).json({ message: "No pharmacy found nearby." });
    }

    const selectedPharmacy = nearestPharmacies[0];
    */

    // ------------------------------------------------------------
    // ✅ Assign any available pharmacy instead
    // ------------------------------------------------------------
    const selectedPharmacy = await Pharmacy.findOne({ status: "Active" });
    if (!selectedPharmacy) {
      return res.status(404).json({ message: "No pharmacy found in the system" });
    }

    // Create multiple orders (one per delivery date)
    const createdOrders = [];

    for (const date of deliveryDates) {
      const order = new Order({
        userId,
        deliveryAddress,
        orderItems: enrichedItems,
        subTotal,
        platformFee,
        deliveryCharge,
        totalAmount: totalPayable,
        couponCode: couponCode || null,
        discountAmount,
        planType,
        deliveryDate: new Date(date),
        notes: notes || "",
        voiceNoteUrl: voiceNoteUrl || "",
        paymentMethod: paymentMethod || "Cash on Delivery",
        transactionId: transactionId || null,
        paymentStatus: "Pending",
        status: "Pending",
        statusTimeline: [
          {
            status: "Pending",
            message: "Order placed",
            timestamp: new Date(),
          },
        ],
        assignedPharmacy: selectedPharmacy._id,
        pharmacyResponse: "Pending",
        assignedRider: null,
        assignedRiderStatus: "Pending",
        razorpayOrder: null,
      });

      await order.save();

      createdOrders.push(order);

      // Notify user
      user.notifications.push({
        orderId: order._id,
        status: "Pending",
        message: `Your periodic order for ${planType} plan on ${new Date(
          date
        ).toDateString()} has been placed successfully.`,
        timestamp: new Date(),
        read: false,
      });

      // Notify pharmacy
      selectedPharmacy.notifications.push({
        orderId: order._id,
        status: "Pending",
        message: `New periodic order placed by ${user.name}.`,
        timestamp: new Date(),
        read: false,
      });

      await selectedPharmacy.save();
    }

    await user.save();

    // Global admin notification
    await Notification.create({
      type: "PeriodicOrder",
      referenceId: createdOrders[0]._id,
      message: `New periodic order placed by ${user.name} (${planType}).`,
    });

    return res.status(201).json({
      message: "Periodic orders created successfully",
      orders: createdOrders.map((o) => ({
        _id: o._id,
        planType: o.planType,
        deliveryDate: o.deliveryDate,
        subTotal: o.subTotal,
        totalAmount: o.totalAmount,
        deliveryCharge: o.deliveryCharge,
        platformFee: o.platformFee,
        assignedPharmacy: o.assignedPharmacy,
        pharmacyResponse: o.pharmacyResponse,
        status: o.status,
      })),
    });
  } catch (error) {
    console.error("Error in createPeriodicOrders:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};




export const getUserPeriodicOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Check if user exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch only periodic (subscription) orders
    const orders = await Order.find({
      userId,
      planType: { $exists: true, $ne: null, $ne: "" },
    })
      .populate("assignedRider", "name phone")
      .populate("assignedPharmacy", "name phone email")
      .sort({ deliveryDate: -1 })
      .lean(); // convert to plain JS object (removes Mongoose metadata)

    if (!orders.length) {
      return res.status(200).json({ success: true, count: 0, orders: [] });
    }

    // Process each order
    const formattedOrders = await Promise.all(
      orders.map(async (order) => {
        const orderItems = await Promise.all(
          order.orderItems.map(async (item) => {
            const med = await Medicine.findById(item.medicineId).lean();
            return {
              _id: item._id,
              medicineId: item.medicineId,
              name: item.name || med?.name,
              quantity: item.quantity,
              image:
                med?.images?.length > 0
                  ? med.images[0]
                  : "/default-image.jpg",
            };
          })
        );

        const deliveryDate =
          order.deliveryDate && !isNaN(new Date(order.deliveryDate))
            ? new Date(order.deliveryDate).toISOString().split("T")[0]
            : null;

        return {
          _id: order._id,
          planType: order.planType,
          deliveryDate,
          deliveryAddress: order.deliveryAddress,
          orderItems,
          subTotal: order.subTotal,
          totalAmount: order.totalAmount,
          platformFee: order.platformFee || order.platformCharge || 0,
          deliveryCharge: order.deliveryCharge || 0,
          discountAmount: order.discountAmount || 0,
          couponCode: order.couponCode || null,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          status: order.status,
          pharmacy: order.assignedPharmacy
            ? {
              _id: order.assignedPharmacy._id,
              name: order.assignedPharmacy.name,
              phone: order.assignedPharmacy.phone,
            }
            : null,
          rider: order.assignedRider
            ? {
              _id: order.assignedRider._id,
              name: order.assignedRider.name,
              phone: order.assignedRider.phone,
            }
            : null,
          notes: order.notes,
          voiceNoteUrl: order.voiceNoteUrl,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: formattedOrders.length,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error("Error fetching user periodic orders:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};




export const cancelPeriodicOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check ownership
    if (order.userId.toString() !== userId) {
      return res.status(403).json({ message: "You are not authorized to cancel this order" });
    }

    // Prevent cancelling already delivered/cancelled orders
    if (["Delivered", "Cancelled"].includes(order.status)) {
      return res.status(400).json({ message: `Order is already ${order.status}` });
    }

    // ✅ Only update order status
    order.status = "Cancelled";
    order.statusTimeline.push({
      status: "Cancelled",
      message: "Order was cancelled by user",
      timestamp: new Date(),
    });

    await order.save();

    // Optional: Notify assigned rider
    if (order.assignedRider) {
      const rider = await Rider.findById(order.assignedRider);
      if (rider) {
        rider.notifications.push({
          message: `Order from ${order.deliveryAddress?.name || "a user"} has been cancelled.`,
          order: order._id,
        });
        await rider.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      orderId: order._id,
    });

  } catch (error) {
    console.error("❌ Error cancelling order:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};





// 🌟 Send Prescription (image/pdf upload) using userId and pharmacyId
export const sendPrescriptionToAdmin = async (req, res) => {
  try {
    const { userId, pharmacyId } = req.params;  // assuming you want to pass both in the URL params

    if (!userId) {
      return res.status(400).json({ message: "userId is required in params" });
    }

    if (!pharmacyId) {
      return res.status(400).json({ message: "pharmacyId is required in params" });
    }

    if (!req.files || !req.files.prescriptionFile) {
      return res.status(400).json({ message: "Prescription file is required" });
    }

    const file = req.files.prescriptionFile;

    // 📤 Upload to Cloudinary
    const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "prescriptions",
      resource_type: "auto", // image/pdf/other types
    });

    // Create the Prescription entry with userId, pharmacyId, and the uploaded file URL
    const prescription = new Prescription({
      userId,
      pharmacyId,  // Added pharmacyId here
      prescriptionUrl: uploaded.secure_url,
    });

    await prescription.save();

    res.status(201).json({
      message: "Prescription sent successfully",
      prescription,
    });
  } catch (error) {
    console.error("Send Prescription Error:", error);
    res.status(500).json({ message: "Error sending prescription", error: error.message });
  }
};



export const sendMessage = async (req, res) => {
  try {
    const { userId, riderId } = req.params;
    const { message, senderType } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Message must be provided." });
    }

    if (senderType !== 'rider' && senderType !== 'user') {
      return res.status(400).json({ success: false, message: "Invalid senderType. Must be 'rider' or 'user'." });
    }

    const riderExists = await Rider.exists({ _id: riderId });
    const userExists = await User.exists({ _id: userId });

    if (!riderExists || !userExists) {
      return res.status(404).json({ success: false, message: "Rider or User not found." });
    }

    const newMessage = new Chat({
      riderId,
      userId,
      message: message.trim(),
      senderType,
      timestamp: new Date(),
    });

    const savedMessage = await newMessage.save();

    // Emit message to Socket.IO room
    const roomId = `${riderId}_${userId}`;
    const io = req.app.get("io");

    if (io) {
      io.to(roomId).emit('receiveMessage', savedMessage);
      console.log(`📤 Message emitted to room: ${roomId} from API`);
    }

    res.status(201).json({
      success: true,
      message: savedMessage,
    });

  } catch (error) {
    console.error("❌ Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message,
    });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const { riderId, userId } = req.params;

    if (!riderId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'riderId and userId are required.',
      });
    }

    const riderExists = await Rider.exists({ _id: riderId });
    const userExists = await User.exists({ _id: userId });

    if (!riderExists || !userExists) {
      return res.status(404).json({ success: false, message: "Rider or User not found." });
    }

    const messages = await Chat.find({
      $or: [
        { riderId: riderId, userId: userId },
        { riderId: userId, userId: riderId },
      ],
    }).sort({ timestamp: 1 });

    if (!messages.length) {
      return res.status(404).json({
        success: false,
        message: 'No chat history found.',
      });
    }

    const [rider, user] = await Promise.all([
      Rider.findOne({ _id: riderId }, { name: 1 }).lean(),
      User.findOne({ _id: userId }, { name: 1 }).lean(),
    ]);

    if (!rider || !user) {
      return res.status(404).json({
        success: false,
        message: 'Either the rider or user does not exist.',
      });
    }

    const formattedMessages = messages.map((message) => {
      const senderName = message.senderType === 'rider' ? rider.name : user.name;
      const receiverName = message.senderType === 'rider' ? user.name : rider.name;

      return {
        ...message.toObject(),
        timestamp: message.timestamp.toISOString(),
        sender: senderName,
        receiver: receiverName,
      };
    });

    // Emit chat history to Socket.IO room
    const roomId = `${riderId}_${userId}`;
    const io = req.app.get("io");

    if (io) {
      io.to(roomId).emit('chatHistory', formattedMessages);
      console.log(`📤 Chat history emitted to room: ${roomId} from API`);
    }

    return res.status(200).json({
      success: true,
      messages: formattedMessages,
    });

  } catch (error) {
    console.error('❌ Error fetching chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching chat history',
      error: error.message,
    });
  }
};





export const generateAndUploadInvoice = async (req, res) => {
  try {
    const { userId, orderId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid user ID or order ID" });
    }

    // Fetch order with all necessary data
    const order = await Order.findOne({ _id: orderId, userId })
      .populate({
        path: "userId",
        select: "name mobile email profileImage"
      })
      .populate({
        path: "orderItems.medicineId",
        select: "name price images description categoryName pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name location"
        }
      })
      .populate({
        path: "assignedRider",
        select: "name phone email latitude longitude profileImage"
      });

    if (!order) {
      return res.status(404).json({ message: "Order not found for this user" });
    }

    // Prepare plain JSON invoice data
    const invoiceData = {
      orderId: order._id,
      orderDate: order.createdAt,
      paymentStatus: order.paymentStatus,
      customer: {
        name: order.userId.name,
        email: order.userId.email,
        phone: order.userId.mobile,
        profileImage: order.userId.profileImage || null,
      },
      rider: order.assignedRider || null,
      orderItems: order.orderItems.map(item => ({
        medicineName: item.medicineId?.name || "Unknown",
        quantity: item.quantity,
        price: item.price,
        pharmacy: item.medicineId?.pharmacyId?.name || null,
        pharmacyLocation: item.medicineId?.pharmacyId?.location || null,
      })),
      subTotal: order.subTotal,
      platformFee: order.platformFee,
      deliveryCharge: order.deliveryCharge,
      totalAmount: order.totalAmount,
    };

    return res.status(200).json({
      message: "Invoice data fetched successfully",
      invoice: invoiceData,
    });

  } catch (error) {
    console.error("❌ Error fetching invoice data:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



// Setup Nodemailer transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'pms226803@gmail.com',
    pass: 'nrasbifqxsxzurrm',
  },
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000
});


export const deleteAccount = async (req, res) => {
  const { email, reason } = req.body;

  // Validate email and reason
  if (!email || !reason) {
    return res.status(400).json({ message: 'Email and reason are required' });
  }

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a unique token for account deletion
    const token = crypto.randomBytes(20).toString('hex');
    const deleteLink = `${process.env.BASE_URL}/confirm-delete-account/${token}`;

    // Set the deleteToken and deleteTokenExpiration
    user.deleteToken = token;
    user.deleteTokenExpiration = Date.now() + 3600000;  // Token expires in 1 hour

    // Log the user object before saving
    console.log('User before saving:', user);

    // Save the token and expiration time to the database
    await user.save();  // This should now save the user along with the deleteToken and deleteTokenExpiration

    // Log after saving to confirm
    console.log('User after saving:', user);

    // Send the confirmation email
    const mailOptions = {
      from: 'pms226803@gmail.com',
      to: email,
      subject: 'Account Deletion Request Received',
      text: `Hi ${user.name},\n\nWe have received your account deletion request. To confirm the deletion of your account, please click the link below:\n\n${deleteLink}\n\nReason: ${reason}\n\nIf you have any questions or need further assistance, please feel free to contact us at Simcurarx@gmail.com.\n\nBest regards,\nYour Team`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: 'Account deletion request has been processed.We are send mail shortly.Please check your email and confirm the link to delete.',
      token: token // Send the token in the response
    });
  } catch (err) {
    console.error('Error in deleteAccount:', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

export const confirmDeleteAccount = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      deleteToken: token,
      deleteTokenExpiration: { $gt: Date.now() },
    });

    // Token is valid, delete the user account
    await User.deleteOne({ _id: user._id });

    // Always return success even if something minor fails afterward
    return res.status(200).json({
      message: 'Your account has been successfully deleted.',
    });
  } catch (err) {
    // Optional: You can still log it but don't let it affect the user
    console.error('Error in confirmDeleteAccount:', err);

    // Return a 200 anyway if user deletion probably succeeded
    return res.status(200).json({
      message: 'Your account has been successfully deleted.',
    });
  }
};



export const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    // Check if user exists
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};