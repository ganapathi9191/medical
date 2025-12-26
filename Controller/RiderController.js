
import Order from "../Models/Order.js";
import Rider from "../Models/Rider.js";
import mongoose from "mongoose";
import moment from 'moment'; // Optional, but helpful
import withdrawalRequestModel from "../Models/withdrawalRequestModel.js";
import cloudinary from '../config/cloudinary.js';
import Query from "../Models/Query.js";
import User from "../Models/User.js";
import Pharmacy from "../Models/Pharmacy.js";
import Medicine from "../Models/Medicine.js";




export const signupRider = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ Check if phone already registered
    const existingRider = await Rider.findOne({ phone });
    if (existingRider) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    let drivingLicenseUrl = "";
    let profileImageUrl = "";
    let drivingLicenseStatus = "Pending"; // Default status

    // 📂 Driving License Upload
    if (req.files && req.files.drivingLicense) {
      const file = req.files.drivingLicense;
      const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "rider_licenses",
      });
      drivingLicenseUrl = uploaded.secure_url;
    } else if (req.body.drivingLicense && req.body.drivingLicense.startsWith("http")) {
      drivingLicenseUrl = req.body.drivingLicense;
    } else {
      return res.status(400).json({ message: "Driving license is required (upload or URL)" });
    }

    // 📷 Profile Image Upload (optional but recommended)
    if (req.files && req.files.profileImage) {
      const profileFile = req.files.profileImage;
      const uploadedProfile = await cloudinary.uploader.upload(profileFile.tempFilePath, {
        folder: "rider_profiles",
      });
      profileImageUrl = uploadedProfile.secure_url;
    } else if (req.body.profileImage && req.body.profileImage.startsWith("http")) {
      profileImageUrl = req.body.profileImage;
    }

    // 🆕 Create new rider
    const newRider = new Rider({
      name,
      email,
      phone,
      password,
      drivingLicense: drivingLicenseUrl,
      drivingLicenseStatus,
      profileImage: profileImageUrl || "", // Optional
    });

    await newRider.save();

    res.status(201).json({
      message: "Rider registered successfully",
      rider: newRider,
    });
  } catch (error) {
    console.error("🔥 Signup Rider Error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


export const loginRider = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required" });
    }

    // Find rider and select the password
    const rider = await Rider.findOne({ phone }).select("+password");

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Check if driving license status is "Approved"
    if (rider.drivingLicenseStatus !== "Approved") {
      return res.status(403).json({ message: "Your driving license is not approved yet. Please wait for approval." });
    }

    // Simple password match
    if (String(password).trim() !== String(rider.password).trim()) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Remove password from response
    const { password: _, ...riderData } = rider.toObject();

    return res.status(200).json({
      message: "Login successful",
      rider: riderData,
    });
  } catch (error) {
    console.error("Login Rider Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


export const getRiderProfile = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    // 🧠 Get rider by ID (include password if needed, or exclude)
    const rider = await Rider.findById(riderId).select('-password'); // hiding password for safety

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({
      message: "Rider profile fetched successfully",
      rider,
    });
  } catch (error) {
    console.error("🔥 Get Rider Profile Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


// ✅ Forgot Password (by email) without bcrypt
export const forgotPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Email, new password and confirm password are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const user = await Rider.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }

    // ⚠️ Save password directly (NOT recommended in production)
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const updateRiderProfileImage = async (req, res) => {
  try {
    const { riderId } = req.params;

    // ✅ Check if file exists
    if (!req.files?.profileImage) {
      return res.status(400).json({ message: "Profile image file is required" });
    }

    // ✅ Find rider
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // 🌟 Upload new profile image to Cloudinary
    const uploaded = await cloudinary.uploader.upload(
      req.files.profileImage.tempFilePath,
      { folder: "riders/profile" }
    );

    // 🛠️ Update profileImage field
    rider.profileImage = uploaded.secure_url;
    await rider.save();

    return res.status(200).json({
      message: "Profile image updated successfully",
      rider,
    });
  } catch (error) {
    console.error("Update Profile Image Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};





export const getRiderOrderStats = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { filter = 'thisWeek' } = req.query;

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    // 📅 Generate date range based on filter
    let startDate = new Date();
    let endDate = new Date();

    switch (filter) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'thisWeek':
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon ...
        const diffToMonday = (dayOfWeek + 6) % 7; // convert to Mon-based
        startDate.setDate(today.getDate() - diffToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'lastMonth':
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;

      default:
        const d = new Date();
        const dow = d.getDay();
        const diff = (dow + 6) % 7;
        startDate.setDate(d.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
    }

    // 🔍 Get ALL orders in date range (not just completed)
    const allOrders = await Order.find({
      assignedRider: riderId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('assignedRider', 'deliveryCharge');

    const pendingCount = allOrders.filter(o => o.status === 'Pending').length;
    const cancelledCount = allOrders.filter(o => o.status === 'Cancelled').length;
    const completedOrders = allOrders.filter(o => ['Completed', 'Delivered'].includes(o.status));
    const completedCount = completedOrders.length;
    const totalToday = allOrders.length;

    // 🧮 Earnings per day
    const earningsPerDay = {
      Mon: 0, Tue: 0, Wed: 0, Thu: 0,
      Fri: 0, Sat: 0, Sun: 0,
    };
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (const order of completedOrders) {
      const dayIndex = new Date(order.createdAt).getDay();
      const dayName = days[dayIndex];
      const riderCharge = order?.assignedRider?.deliveryCharge || 0;
      earningsPerDay[dayName] += riderCharge;
    }

    const totalEarnings = completedOrders.reduce(
      (sum, o) => sum + (o?.assignedRider?.deliveryCharge || 0),
      0
    );

    // ✅ Final Response
    return res.status(200).json({
      message: "Rider stats fetched successfully",
      filterUsed: filter,
      orders: {
        todayOrders: totalToday,
        pending: pendingCount,
        cancelled: cancelledCount,
        completed: completedCount,
      },
      earnings: {
        totalEarnings,
        earningsPerDay
      }
    });

  } catch (error) {
    console.error("Get Rider Order Stats Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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

export const getNewOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch rider details
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);

    // Fetch new orders
    const newOrders = await Order.find({
      assignedRider: riderId,
      assignedRiderStatus: "Assigned"
    })
      .populate({
        path: "orderItems.medicineId",
        select: "name mrp description images pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name address contactNumber latitude longitude"
        }
      })
      .populate({
        path: "userId",
        select: "name mobile location"
      })
      .lean();

    if (!newOrders || newOrders.length === 0) {
      return res.status(404).json({ message: "No new orders assigned to you" });
    }

    // Process orders
    const updatedOrders = newOrders
      .map(order => {
        const firstItem = order.orderItems[0]?.medicineId;
        if (!firstItem || !firstItem.pharmacyId) {
          return null;
        }

        const pharmacy = firstItem.pharmacyId;

        // User Location Check
        const userLocation = order.userId?.location?.coordinates;
        if (!userLocation || userLocation.length !== 2) {
          console.log("⚠️ Missing user location for order:", order._id);
          return null;
        }

        const pharmacyLat = parseFloat(pharmacy.latitude);
        const pharmacyLon = parseFloat(pharmacy.longitude);

        // Distance calculations
        const pickupDistance = calculateDistance(
          [riderLon, riderLat],
          [pharmacyLon, pharmacyLat]
        );

        const dropDistance = calculateDistance(
          [pharmacyLon, pharmacyLat],
          [userLocation[0], userLocation[1]]
        );

        // ✅ FIX 1: Get delivery charge from ORDER, not rider
        const deliveryCharge = parseFloat(order.deliveryCharge) || 0;

        // ✅ FIX: Use current time instead of order.createdAt
        const orderCreationTime = new Date();

        const pickupMinutes = calculateTime(pickupDistance);
        const dropMinutes = calculateTime(dropDistance);

        const pickupEstimate = addMinutesToTime(orderCreationTime, pickupMinutes);
        const dropEstimate = addMinutesToTime(orderCreationTime, pickupMinutes + dropMinutes);

        const formattedPickup = formatTimeTo12Hour(pickupEstimate);
        const formattedDrop = formatTimeTo12Hour(dropEstimate);


        // Billing calculation
        let subTotal = 0;
        order.orderItems.forEach(item => {
          const mrp = item?.medicineId?.mrp || 0;
          const quantity = item?.quantity || 1;
          subTotal += mrp * quantity;
        });

        const platformFee = 10;
        const totalPaid = subTotal + platformFee + deliveryCharge;

        return {
          orderId: order._id,
          pickupDistance: `${pickupDistance.toFixed(2)} km`,
          dropDistance: `${dropDistance.toFixed(2)} km`,
          pickupTime: formattedPickup,
          dropTime: formattedDrop,
          estimatedEarning: `₹${deliveryCharge.toFixed(2)}`,

          billingDetails: {
            totalItems: order.orderItems.length,
            subTotal: `₹${subTotal.toFixed(2)}`,
            platformFee: `₹${platformFee.toFixed(2)}`,
            deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
            totalPaid: `₹${totalPaid.toFixed(2)}`
          },

          order // original order object
        };
      })
      .filter(order => order !== null);

    return res.status(200).json({
      success: true,
      newOrders: updatedOrders
    });
  } catch (error) {
    console.error("Error fetching new orders for rider:", error);
    return res.status(500).json({ message: "Server error while fetching new orders." });
  }
};




export const getAcceptedOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch the first accepted order that is not delivered
    const acceptedOrder = await Order.findOne({
      assignedRider: riderId,
      assignedRiderStatus: 'Accepted',
      status: { $ne: 'Delivered' } // Only fetch orders that are not delivered yet
    })
      .populate({
        path: 'orderItems.medicineId',
        select: 'name mrp description images pharmacyId', // Select the necessary fields
        populate: {
          path: 'pharmacyId',
          select: 'name address vendorPhone latitude longitude' // Populate pharmacyId fields
        }
      })
      .populate({
        path: 'userId',
        select: 'name mobile location' // Select user fields
      })
      .lean();

    if (!acceptedOrder) {
      return res.status(404).json({ message: 'No accepted orders available for you at the moment.' });
    }

    // Fetch rider details
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);

    // Process the accepted order
    const order = acceptedOrder;
    const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
    const userLocation = order.userId?.location?.coordinates;

    const pharmacyLat = parseFloat(pharmacy?.latitude);
    const pharmacyLon = parseFloat(pharmacy?.longitude);
    const userLat = userLocation?.[1];
    const userLon = userLocation?.[0];

    // Calculate distances
    const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacyLon, pharmacyLat]);
    const dropDistance = calculateDistance([pharmacyLon, pharmacyLat], [userLon, userLat]);

    // Time estimates
    const pickupMinutes = calculateTime(pickupDistance);
    const dropMinutes = calculateTime(dropDistance);

    const pickupTimeEstimate = addMinutesToTime(order.createdAt, pickupMinutes);
    const dropTimeEstimate = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);

    const formattedPickupTime = formatTimeTo12Hour(pickupTimeEstimate);
    const formattedDropTime = formatTimeTo12Hour(dropTimeEstimate);

    // Add all the necessary data to the order response
    const orderResponse = {
      order,
      formattedPickupDistance: pickupDistance.toFixed(2),
      formattedDropDistance: dropDistance.toFixed(2),
      pickupTime: formattedPickupTime,
      dropTime: formattedDropTime
    };

    // Return the current active order
    return res.status(200).json({ acceptedOrder: orderResponse });

  } catch (error) {
    console.error("Error fetching accepted orders for rider:", error);
    return res.status(500).json({ message: "Server error while fetching accepted orders." });
  }
};



export const getPickedUpOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    const pickedUpOrders = await Order.find({
      assignedRider: riderId,
      assignedRiderStatus: "PickedUp",
    })
      .populate({
        path: "orderItems.medicineId",
        select: "name mrp description images pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name address contactNumber latitude longitude",
        },
      })
      .populate({
        path: "userId",
        select: "name mobile location",
      })
      .lean();

    if (!pickedUpOrders || pickedUpOrders.length === 0) {
      return res
        .status(404)
        .json({ message: "No picked up orders for you yet." });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const updatedOrders = pickedUpOrders.map((order) => {
      const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
      const userLocation = order.userId?.location?.coordinates;

      const pharmacyLat = parseFloat(pharmacy?.latitude);
      const pharmacyLon = parseFloat(pharmacy?.longitude);
      const userLat = userLocation?.[1];
      const userLon = userLocation?.[0];

      const dropDistance = calculateDistance(
        [pharmacyLon, pharmacyLat],
        [userLon, userLat]
      );

      const dropMinutes = calculateTime(dropDistance);
      const dropTimeEstimate = addMinutesToTime(order.createdAt, dropMinutes);
      const formattedDropTime = formatTimeTo12Hour(dropTimeEstimate);

      const totalItems = order.orderItems.length;
      let subTotal = 0;

      order.orderItems.forEach((item) => {
        const mrp = item?.medicineId?.mrp || 0;
        const quantity = item?.quantity || 1;
        subTotal += mrp * quantity;
      });

      const platformFee = 10;
      const deliveryCharge = parseFloat(order.deliveryCharge) || 0;
      const totalPaid = subTotal + platformFee + deliveryCharge;

      return {
        order,
        formattedDropDistance: dropDistance.toFixed(2),
        dropTime: formattedDropTime,
        billingDetails: {
          totalItems,
          subTotal: `₹${subTotal.toFixed(2)}`,
          platformFee: `₹${platformFee.toFixed(2)}`,
          deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
          totalPaid: `₹${totalPaid.toFixed(2)}`,
        },
        // ✅ UPI ID sirf Cash on Delivery wale orders ke liye bhejna
        upiId: order.paymentMethod === "Cash on Delivery" ? (rider.upiId || "juleeperween@ybl") : null,
      };
    });

    return res.status(200).json({ pickedUpOrders: updatedOrders });
  } catch (error) {
    console.error("Error fetching picked up orders for rider:", error);
    return res
      .status(500)
      .json({ message: "Server error while fetching picked up orders." });
  }
};





export const updateRiderStatusController = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { orderId, newStatus } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!order.assignedRider || order.assignedRider.toString() !== riderId) {
      return res.status(403).json({ message: 'This order is not assigned to you' });
    }

    const user = await User.findById(order.userId);
    if (!user) return res.status(404).json({ message: 'User not found for the order' });

    // ✅ If Rider Rejected
    if (newStatus === 'Rejected') {
      if (!order.rejectedRiders) order.rejectedRiders = [];
      if (!order.rejectedRiders.includes(riderId)) {
        order.rejectedRiders.push(riderId);
      }

      order.assignedRider = null; // Clear rider
      order.assignedRiderStatus = 'Rejected';
      order.status = 'Rejected';

      order.statusTimeline.push({
        status: "Rejected",
        message: `Rider ${riderId} rejected the order`,
        timestamp: new Date(),
      });

      user.notifications.push({
        orderId: order._id,
        status: "Rejected",
        message: "Your order was rejected by the assigned rider. Searching for a new one...",
        timestamp: new Date(),
        read: false,
      });

      await user.save();
      await order.save();

      res.status(200).json({ message: "Order rejected. Will try to reassign shortly." });

      // ✅ Try Reassigning After 30 Seconds
      setTimeout(async () => {
        try {
          const freshOrder = await Order.findById(orderId);
          if (!freshOrder || freshOrder.assignedRider) return;

          const onlineRiders = await Rider.find({ status: 'online' });

          const userLat = user.location?.coordinates[1] || 0;
          const userLon = user.location?.coordinates[0] || 0;

          let nearestRider = null;
          let minDistance = Infinity;

          for (const rider of onlineRiders) {
            if (!rider.latitude || !rider.longitude) continue;
            if (freshOrder.rejectedRiders?.includes(rider._id.toString())) continue;

            const riderLat = parseFloat(rider.latitude);
            const riderLon = parseFloat(rider.longitude);
            const distance = calculateDistance([riderLon, riderLat], [userLon, userLat]);

            if (distance < minDistance) {
              minDistance = distance;
              nearestRider = rider;
            }
          }

          if (nearestRider) {
            // ✅ Reassign to new rider
            freshOrder.assignedRider = nearestRider._id;
            freshOrder.assignedRiderStatus = 'Assigned';
            freshOrder.status = 'Assigned';

            freshOrder.statusTimeline.push({
              status: "Reassigned",
              message: `Order reassigned to ${nearestRider.name} after rejection`,
              timestamp: new Date(),
            });

            nearestRider.notifications.push({
              message: `New order assigned to you from ${user.name}`,
            });
            await nearestRider.save();

            user.notifications.push({
              orderId: freshOrder._id,
              status: "Reassigned",
              message: `Your order was reassigned to a new rider: ${nearestRider.name}`,
              timestamp: new Date(),
              read: false,
            });

            await user.save();
            await freshOrder.save();

            console.log(`Order ${orderId} reassigned to ${nearestRider.name}`);
          } else {
            // ❌ No rider found – Cancel the order
            freshOrder.status = 'Cancelled';
            freshOrder.statusTimeline.push({
              status: 'Cancelled',
              message: 'Order was cancelled automatically. No rider was available after rejection.',
              timestamp: new Date(),
            });

            user.notifications.push({
              orderId: freshOrder._id,
              status: "Cancelled",
              message: "Unfortunately, your order was cancelled because no rider was available.",
              timestamp: new Date(),
              read: false,
            });

            await user.save();
            await freshOrder.save();

            console.log(`Order ${orderId} cancelled due to no available riders.`);
          }
        } catch (e) {
          console.error("Error during reassignment/cancellation:", e);
        }
      }, 30 * 1000); // 30 seconds

      return;
    }

    // ✅ For Other Status Updates (Picked, Delivered, etc.)
    order.assignedRiderStatus = newStatus;
    order.status = newStatus;

    order.statusTimeline.push({
      status: newStatus,
      message: `Rider updated status to ${newStatus}`,
      timestamp: new Date(),
    });

    user.notifications.push({
      orderId: order._id,
      status: newStatus,
      message: `Your order status was updated to: ${newStatus}`,
      timestamp: new Date(),
      read: false,
    });

    await user.save();
    await order.save();

    return res.status(200).json({ message: `Order status updated to ${newStatus}` });

  } catch (error) {
    console.error("Error updating rider status:", error);
    return res.status(500).json({ message: 'Server error while updating rider status' });
  }
};



export const getSingleOrderForRiderController = async (req, res) => {
  try {
    const { riderId, orderId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid rider ID or order ID" });
    }

    // Fetch order
    const order = await Order.findOne({
      _id: orderId,
      assignedRider: riderId,
    })
      .populate({
        path: 'orderItems.medicineId',
        select: 'name mrp description images pharmacyId',  // Add more fields as needed
        populate: {
          path: 'pharmacyId',
          select: 'name address contactNumber latitude longitude' // Full pharmacy details
        }
      })
      .populate({
        path: 'userId',
        select: 'name mobile location'
      })
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found or not assigned to rider' });
    }

    // Fetch rider
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);
    const deliveryCharge = parseFloat(order.deliveryCharge) || 0;

    const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
    const userLocation = order.userId?.location?.coordinates;

    if (!pharmacy || !userLocation) {
      return res.status(400).json({ message: "Invalid pharmacy or user location" });
    }

    // Distance calculations
    const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacy.longitude, pharmacy.latitude]);
    const dropDistance = calculateDistance([pharmacy.longitude, pharmacy.latitude], [userLocation[0], userLocation[1]]);

    // Time estimations
    const pickupMinutes = calculateTime(pickupDistance);
    const dropMinutes = calculateTime(dropDistance);
    const pickupTime = addMinutesToTime(order.createdAt, pickupMinutes);
    const dropTime = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);
    const formattedPickupTime = formatTimeTo12Hour(pickupTime);
    const formattedDropTime = formatTimeTo12Hour(dropTime);

    // Billing calculations
    const totalItems = order.orderItems.length;
    let subTotal = 0;

    order.orderItems.forEach(item => {
      const mrp = item?.medicineId?.mrp || 0;
      const quantity = item?.quantity || 1;
      subTotal += mrp * quantity;
    });

    const platformFee = 10; // Static
    const estimatedEarning = deliveryCharge;
    const totalPaid = subTotal + platformFee + deliveryCharge;

    return res.status(200).json({
      order,
      pickupDistance: `${pickupDistance.toFixed(2)} km`,
      dropDistance: `${dropDistance.toFixed(2)} km`,
      pickupTime: formattedPickupTime,
      dropTime: formattedDropTime,
      estimatedEarning: `₹${estimatedEarning.toFixed(2)}`,
      billingDetails: {
        totalItems,
        subTotal: `₹${subTotal.toFixed(2)}`,
        platformFee: `₹${platformFee.toFixed(2)}`,
        deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
        totalPaid: `₹${totalPaid.toFixed(2)}`
      }
    });

  } catch (error) {
    console.error("Error fetching single order for rider:", error);
    res.status(500).json({ message: "Server error while fetching order" });
  }
};

export const getAllActiveOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch all active orders for rider
    const activeOrders = await Order.find({
      assignedRider: riderId,
      assignedRiderStatus: 'Accepted'
    })
      .populate({
        path: 'orderItems.medicineId',
        select: 'name mrp description images pharmacyId',  // Populating medicine details
        populate: {
          path: 'pharmacyId',
          select: 'name address contactNumber latitude longitude' // Populating pharmacy details
        }
      })
      .populate({
        path: 'userId',
        select: 'name mobile location'  // Populating user details
      })
      .lean();

    if (!activeOrders || activeOrders.length === 0) {
      return res.status(404).json({ message: 'No active orders found' });
    }

    // Get rider location
    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);

    // Process each active order
    const updatedOrders = activeOrders.map(order => {
      const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
      const userLocation = order.userId?.location?.coordinates;

      if (!pharmacy || !userLocation) return order;

      const pharmacyLat = parseFloat(pharmacy?.latitude);
      const pharmacyLon = parseFloat(pharmacy?.longitude);
      const userLat = userLocation?.[1];
      const userLon = userLocation?.[0];

      // Distance and time calculations
      const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacyLon, pharmacyLat]);
      const dropDistance = calculateDistance([pharmacyLon, pharmacyLat], [userLon, userLat]);

      const pickupMinutes = calculateTime(pickupDistance);
      const dropMinutes = calculateTime(dropDistance);

      const pickupTime = addMinutesToTime(order.createdAt, pickupMinutes);
      const dropTime = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);

      // Billing calculations
      const totalItems = order.orderItems.length;
      let subTotal = 0;

      order.orderItems.forEach(item => {
        const mrp = item?.medicineId?.mrp || 0;
        const quantity = item?.quantity || 1;
        subTotal += mrp * quantity;
      });

      const platformFee = 10; // Static platform fee
      const deliveryCharge = parseFloat(order.deliveryCharge) || 0;
      const totalPaid = subTotal + platformFee + deliveryCharge;

      return {
        ...order,
        formattedPickupDistance: `${pickupDistance.toFixed(2)} km`,
        formattedDropDistance: `${dropDistance.toFixed(2)} km`,
        pickupTime: formatTimeTo12Hour(pickupTime),
        dropTime: formatTimeTo12Hour(dropTime),
        billingDetails: {
          totalItems,
          subTotal: `₹${subTotal.toFixed(2)}`,
          platformFee: `₹${platformFee.toFixed(2)}`,
          deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
          totalPaid: `₹${totalPaid.toFixed(2)}`
        }
      };
    });

    return res.status(200).json({ activeOrders: updatedOrders });
  } catch (error) {
    console.error("Error fetching active orders:", error);
    return res.status(500).json({ message: "Server error while fetching active orders" });
  }
};



export const getAllCompletedOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch all completed orders for rider
    const completedOrders = await Order.find({
      assignedRider: riderId,
      assignedRiderStatus: 'Completed',
      status: 'Delivered' // Order should be delivered
    })
      .populate({
        path: 'orderItems.medicineId',
        select: 'name mrp description images pharmacyId',  // Populating medicine details
        populate: {
          path: 'pharmacyId',
          select: 'name address contactNumber latitude longitude' // Populating pharmacy details
        }
      })
      .populate({
        path: 'userId',
        select: 'name mobile location'  // Populating user details
      })
      .lean();

    if (!completedOrders || completedOrders.length === 0) {
      return res.status(404).json({ message: 'No completed orders found' });
    }

    // Get rider location
    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);

    // Process each completed order
    const updatedOrders = completedOrders.map(order => {
      const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
      const userLocation = order.userId?.location?.coordinates;

      if (!pharmacy || !userLocation) return order;

      const pharmacyLat = parseFloat(pharmacy?.latitude);
      const pharmacyLon = parseFloat(pharmacy?.longitude);
      const userLat = userLocation?.[1];
      const userLon = userLocation?.[0];

      // Distance and time calculations
      const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacyLon, pharmacyLat]);
      const dropDistance = calculateDistance([pharmacyLon, pharmacyLat], [userLon, userLat]);

      const pickupMinutes = calculateTime(pickupDistance);
      const dropMinutes = calculateTime(dropDistance);

      const pickupTime = addMinutesToTime(order.createdAt, pickupMinutes);
      const dropTime = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);

      // Billing calculations
      const totalItems = order.orderItems.length;
      let subTotal = 0;

      order.orderItems.forEach(item => {
        const mrp = item?.medicineId?.mrp || 0;
        const quantity = item?.quantity || 1;
        subTotal += mrp * quantity;
      });

      const platformFee = 10; // Static platform fee
      const deliveryCharge = parseFloat(order.deliveryCharge) || 0;
      const totalPaid = subTotal + platformFee + deliveryCharge;

      return {
        ...order,
        formattedPickupDistance: `${pickupDistance.toFixed(2)} km`,
        formattedDropDistance: `${dropDistance.toFixed(2)} km`,
        pickupTime: formatTimeTo12Hour(pickupTime),
        dropTime: formatTimeTo12Hour(dropTime),
        billingDetails: {
          totalItems,
          subTotal: `₹${subTotal.toFixed(2)}`,
          platformFee: `₹${platformFee.toFixed(2)}`,
          deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
          totalPaid: `₹${totalPaid.toFixed(2)}`
        }
      };
    });

    return res.status(200).json({ completedOrders: updatedOrders });
  } catch (error) {
    console.error("Error fetching completed orders:", error);
    return res.status(500).json({ message: "Server error while fetching completed orders" });
  }
};




// export const getAllPreviousOrdersForRiderController = async (req, res) => {
//   try {
//     const { riderId } = req.params;

//     // Validate riderId
//     if (!mongoose.Types.ObjectId.isValid(riderId)) {
//       return res.status(400).json({ message: "Invalid rider ID" });
//     }

//     // Fetch all active orders for rider
//     const activeOrders = await Order.find({
//       assignedRider: riderId,
//       assignedRiderStatus: 'Completed'
//     })
//       .populate({
//         path: 'orderItems.medicineId',
//         select: 'name mrp description images pharmacyId',  // Populating medicine details
//         populate: {
//           path: 'pharmacyId',
//           select: 'name address contactNumber latitude longitude' // Populating pharmacy details
//         }
//       })
//       .populate({
//         path: 'userId',
//         select: 'name mobile location'  // Populating user details
//       })
//       .lean();

//     if (!activeOrders || activeOrders.length === 0) {
//       return res.status(404).json({ message: 'No active orders found' });
//     }

//     // Get rider location
//     const rider = await Rider.findById(riderId);
//     if (!rider) return res.status(404).json({ message: 'Rider not found' });

//     const riderLat = parseFloat(rider.latitude);
//     const riderLon = parseFloat(rider.longitude);

//     // Process each active order
//     const updatedOrders = activeOrders.map(order => {
//       const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
//       const userLocation = order.userId?.location?.coordinates;

//       if (!pharmacy || !userLocation) return order;

//       const pharmacyLat = parseFloat(pharmacy?.latitude);
//       const pharmacyLon = parseFloat(pharmacy?.longitude);
//       const userLat = userLocation?.[1];
//       const userLon = userLocation?.[0];

//       // Distance and time calculations
//       const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacyLon, pharmacyLat]);
//       const dropDistance = calculateDistance([pharmacyLon, pharmacyLat], [userLon, userLat]);

//       const pickupMinutes = calculateTime(pickupDistance);
//       const dropMinutes = calculateTime(dropDistance);

//       const pickupTime = addMinutesToTime(order.createdAt, pickupMinutes);
//       const dropTime = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);

//       // Billing calculations
//       const totalItems = order.orderItems.length;
//       let subTotal = 0;

//       order.orderItems.forEach(item => {
//         const mrp = item?.medicineId?.mrp || 0;
//         const quantity = item?.quantity || 1;
//         subTotal += mrp * quantity;
//       });

//       const platformFee = 10; // Static platform fee
//       const deliveryCharge = parseFloat(rider.deliveryCharge) || 0; // Rider's delivery charge
//       const totalPaid = subTotal + platformFee + deliveryCharge;

//       return {
//         ...order,
//         formattedPickupDistance: `${pickupDistance.toFixed(2)} km`,
//         formattedDropDistance: `${dropDistance.toFixed(2)} km`,
//         pickupTime: formatTimeTo12Hour(pickupTime),
//         dropTime: formatTimeTo12Hour(dropTime),
//         billingDetails: {
//           totalItems,
//           subTotal: `₹${subTotal.toFixed(2)}`,
//           platformFee: `₹${platformFee.toFixed(2)}`,
//           deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
//           totalPaid: `₹${totalPaid.toFixed(2)}`
//         }
//       };
//     });

//     return res.status(200).json({ activeOrders: updatedOrders });
//   } catch (error) {
//     console.error("Error fetching active orders:", error);
//     return res.status(500).json({ message: "Server error while fetching active orders" });
//   }
// };






// Add bank details to rider profile
export const addBankDetailsToRider = async (req, res) => {
  try {
    const { riderId } = req.params;
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId
    } = req.body;

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({ message: "All required bank fields must be provided" });
    }

    const rider = await Rider.findById(riderId);

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const newBankDetail = {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId: upiId || null
    };

    rider.accountDetails.push(newBankDetail);
    await rider.save();

    return res.status(200).json({
      message: "Bank details added successfully",
      accountDetails: rider.accountDetails
    });

  } catch (error) {
    console.error("Error adding bank details:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



export const getRiderBankDetails = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    const rider = await Rider.findById(riderId).select('accountDetails');

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({
      message: "Bank details fetched successfully",
      accountDetails: rider.accountDetails
    });

  } catch (error) {
    console.error("Error fetching bank details:", error);
    return res.status(500).json({
      message: "Server error while fetching bank details",
      error: error.message
    });
  }
};


export const markOrderAsDeliveredController = async (req, res) => {
  try {
    const { riderId, orderId } = req.params;
    const { collectedAmount, paymentMethodType } = req.body;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid rider ID or order ID" });
    }

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Validate rider assignment
    if (order.assignedRider?.toString() !== riderId) {
      return res.status(403).json({ message: "This order is not assigned to you" });
    }

    // Check delivery proof
    if (!order.deliveryProof || order.deliveryProof.length === 0) {
      return res.status(400).json({
        message: "Please upload delivery proof before marking the order as delivered.",
      });
    }

    // Handle COD (Cash on Delivery)
    if (order.paymentMethod === "Cash on Delivery") {
      if (!paymentMethodType || !["cash", "online"].includes(paymentMethodType)) {
        return res.status(400).json({
          message: "Payment method type must be 'cash' or 'online'.",
        });
      }

      if (collectedAmount === undefined || isNaN(collectedAmount)) {
        return res.status(400).json({
          message: "Collected amount is required for all COD payments (cash or online).",
        });
      }

      const parsedAmount = parseFloat(collectedAmount);

      // Store in DB
      order.collectedAmount = parsedAmount;
      order.codAmountReceived = parsedAmount;
      order.codPaymentMode = paymentMethodType;
      order.paymentMethodStatus = "Paid";

      if (paymentMethodType === "online") {
        order.isCodPaidOnline = true;
        order.upiPaidAt = new Date();
      }
    }

    // Fetch rider
    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    const deliveryCharge = parseFloat(order.deliveryCharge) || 0;  // Get delivery charge from the order

    // Update order status to Delivered
    order.status = "Delivered";
    order.paymentStatus = "Completed";
    order.assignedRiderStatus = "Completed";

    // Add to status timeline
    order.statusTimeline.push({
      status: "Delivered",
      message: `Order delivered by rider ${rider.name || riderId}`,
      timestamp: new Date(),
    });

    // Add COD payment status if applicable
    if (order.paymentMethod === "Cash on Delivery") {
      order.statusTimeline.push({
        status: "COD Collected",
        message:
          paymentMethodType === "cash"
            ? `₹${collectedAmount} collected in cash by rider ${rider.name || riderId}`
            : `₹${collectedAmount} received via UPI (QR scanned) by customer.`,
        timestamp: new Date(),
      });
    }

    // Update rider wallet
    rider.wallet += deliveryCharge;  // Add delivery charge to rider's wallet
    rider.walletTransactions.push({
      amount: deliveryCharge,
      type: "credit",
      createdAt: new Date(),
    });

    // Save order and rider updates
    await Promise.all([order.save(), rider.save()]);

    return res.status(200).json({
      message: "Order marked as delivered successfully",
      updatedWallet: `₹${rider.wallet.toFixed(2)}`,  // Return the updated wallet balance
    });

  } catch (error) {
    console.error("Error marking order as delivered:", error);
    res.status(500).json({ message: "Server error while updating delivery status" });
  }
};


// Controller: paymentController.js

export const getUpiInfo = async (req, res) => {
  try {
    const upiId = "juleeperween@ybl";

    // Generate QR code using public QR code API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${upiId}&pn=CLYNIX`;

    return res.status(200).json({
      message: "UPI info fetched successfully",
      upiId,
      qrCodeUrl,
    });
  } catch (error) {
    console.error("Error fetching UPI info:", error);
    return res.status(500).json({
      message: "Server error while fetching UPI info",
      error: error.message,
    });
  }
};



export const getRiderWalletController = async (req, res) => {
  try {
    const { riderId } = req.params;

    // ✅ Validate Rider ID
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // ✅ Fetch Rider
    const rider = await Rider.findById(riderId).select("name wallet createdAt");

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // ✅ Date range
    const startDate = rider.createdAt;
    const endDate = new Date();

    // ✅ Fetch completed orders
    const completedOrders = await Order.find({
      assignedRider: riderId,
      assignedRiderStatus: "Completed",
    }).select("deliveryCharge");

    // ✅ Calculate earnings safely
    const totalEarnings = completedOrders.reduce(
      (sum, order) => sum + Number(order.deliveryCharge || 0),
      0
    );

    return res.status(200).json({
      success: true,
      riderName: rider.name,
      walletBalance: Number(rider.wallet || 0),
      totalEarnings,
      earningsPeriod: {
        from: moment(startDate).format("DD MMM YYYY"),
        to: moment(endDate).format("DD MMM YYYY"),
      },
    });

  } catch (error) {
    console.error("Error fetching rider wallet:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching wallet",
    });
  }
};



export const withdrawAmountFromWalletController = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { amount, bankId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(bankId)) {
      return res.status(400).json({ message: "Invalid riderId or bankId" });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid withdrawal amount" });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    const walletBalance = Number(rider.wallet || 0);
    const withdrawAmount = Number(amount);

    if (withdrawAmount > walletBalance) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    const bankDetail = rider.accountDetails.find(
      b => b._id.toString() === bankId
    );
    if (!bankDetail) {
      return res.status(404).json({ message: "Bank account not found" });
    }

    // ✅ CREATE WITHDRAW REQUEST
    const request = new withdrawalRequestModel({
      riderId,
      amount: withdrawAmount,
      bankDetail: {
        accountHolderName: bankDetail.accountHolderName,
        accountNumber: bankDetail.accountNumber,
        ifscCode: bankDetail.ifscCode,
        bankName: bankDetail.bankName,
        upiId: bankDetail.upiId || null
      },
      status: "Requested"
    });

    // ✅ DEDUCT WALLET (FIX)
    rider.wallet = walletBalance - withdrawAmount;

    // ✅ ADD WALLET TRANSACTION (FIX)
    rider.walletTransactions.push({
      amount: withdrawAmount,
      type: "debit",
      createdAt: new Date()
    });

    // ✅ SAVE BOTH
    await Promise.all([request.save(), rider.save()]);

    return res.status(200).json({
      message: "Withdrawal request submitted successfully. Awaiting approval.",
      requestId: request._id,
      status: request.status,
      remainingWalletBalance: `₹${rider.wallet.toFixed(2)}`
    });

  } catch (error) {
    console.error("Error submitting withdrawal request:", error);
    return res.status(500).json({
      message: "Server error during withdrawal request",
      error: error.message
    });
  }
};




// ✅ Get Rider Notifications
export const getRiderNotifications = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid Rider ID" });
    }

    const rider = await Rider.findById(riderId).select("notifications");

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({
      message: "Rider notifications fetched successfully",
      notifications: rider.notifications.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt) // latest first
      ),
    });
  } catch (error) {
    console.error("Error fetching rider notifications:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};



// ✅ Change Rider Status (online / offline) — returns only status
export const updateRiderStatus = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status } = req.body; // "online" | "offline"

    if (!["online", "offline"].includes(status)) {
      return res.status(400).json({ message: "Invalid status (use online/offline)" });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    rider.status = status;
    await rider.save();

    return res.status(200).json({ status }); // ✅ Only return status

  } catch (error) {
    console.error("Error updating rider status:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};



export const getRiderOrdersByStatus = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { assignedRiderStatus, status } = req.query;

    // ✅ Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // ✅ Check if rider exists
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // ✅ Build dynamic query
    const query = {
      assignedRider: riderId,
    };

    // 👉 Apply filters only if they exist
    if (assignedRiderStatus) {
      query.assignedRiderStatus = assignedRiderStatus;
    }

    if (status) {
      query.status = status;
    }

    // ✅ Fetch orders with populate
    const orders = await Order.find(query)
      .populate({
        path: "orderItems.medicineId",
        select: "name mrp description images pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name address contactNumber latitude longitude",
        },
      })
      .populate({
        path: "userId",
        select: "name mobile location",
      })
      .sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No matching orders found" });
    }

    return res.status(200).json({
      message: "Orders fetched successfully",
      orders,
    });
  } catch (error) {
    console.error("Error fetching rider orders:", error);
    return res.status(500).json({
      message: "Server error while fetching orders",
      error: error.message,
    });
  }
};






// 📊 Rider Earnings Graph (from walletTransactions)
export const getRiderEarningsGraph = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { filter } = req.query; // today | yesterday | thisWeek | lastWeek | thisMonth | lastMonth | last6Months | last8Months | last1Year

    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    const rider = await Rider.findById(riderId).select("name wallet walletTransactions");
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    const now = moment();
    const ranges = {
      today: [now.clone().startOf("day"), now.clone().endOf("day")],
      yesterday: [now.clone().subtract(1, "days").startOf("day"), now.clone().subtract(1, "days").endOf("day")],
      thisWeek: [now.clone().startOf("week"), now.clone().endOf("week")],
      lastWeek: [now.clone().subtract(1, "week").startOf("week"), now.clone().subtract(1, "week").endOf("week")],
      thisMonth: [now.clone().startOf("month"), now.clone().endOf("month")],
      lastMonth: [now.clone().subtract(1, "month").startOf("month"), now.clone().subtract(1, "month").endOf("month")],
      last6Months: [now.clone().subtract(6, "months").startOf("month"), now.clone().endOf("month")],
      last8Months: [now.clone().subtract(8, "months").startOf("month"), now.clone().endOf("month")],
      last1Year: [now.clone().subtract(1, "year").startOf("day"), now.clone().endOf("day")],
    };

    const [start, end] = ranges[filter] || ranges.thisWeek;

    // ✅ Filter transactions
    const transactions = rider.walletTransactions.filter(txn =>
      moment(txn.createdAt).isBetween(start, end, null, "[]")
    );

    // ✅ Group by day
    const earningsByDay = {};
    transactions.forEach(txn => {
      const day = moment(txn.createdAt).format("DD MMM");
      if (!earningsByDay[day]) earningsByDay[day] = 0;
      earningsByDay[day] += txn.amount;
    });

    // ✅ Sorted chart data
    const chartData = Object.keys(earningsByDay).sort((a, b) => moment(a, "DD MMM") - moment(b, "DD MMM"))
      .map(day => ({
        day,
        earnings: earningsByDay[day]
      }));

    return res.status(200).json({
      rider: rider.name,
      filter,
      totalEarnings: transactions.reduce((sum, t) => sum + t.amount, 0),
      walletBalance: rider.wallet,
      chartData
    });
  } catch (error) {
    console.error("Error fetching rider earnings graph:", error);
    return res.status(500).json({ message: "Server error while fetching earnings graph" });
  }
};


// ✅ Get Rider Driving License
export const getRiderDrivingLicense = async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch Rider only with drivingLicense
    const rider = await Rider.findById(riderId).select("drivingLicense");
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({
      riderId,
      drivingLicense: rider.drivingLicense || null,
    });
  } catch (error) {
    console.error("Error fetching driving license:", error);
    return res
      .status(500)
      .json({ message: "Server error while fetching driving license" });
  }
};


export const updateRiderLocation = async (req, res) => {
  try {
    const { riderId } = req.params; // URL se riderId le rahe hain
    const { latitude, longitude } = req.body;

    if (!riderId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'riderId, latitude, and longitude are required' });
    }

    const updatedRider = await Rider.findByIdAndUpdate(
      riderId,
      {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      },
      { new: true }
    );

    if (!updatedRider) {
      return res.status(404).json({ message: 'Rider not found' });
    }

    return res.status(200).json({
      message: 'Rider location updated successfully',
      latitude: updatedRider.latitude,
      longitude: updatedRider.longitude,
    });
  } catch (error) {
    console.error('Error updating rider location:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};


export const uploadDeliveryProof = async (req, res) => {
  try {
    const { riderId, orderId } = req.params;

    // Check for uploaded image
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid rider ID or order ID" });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ensure rider is assigned to the order
    if (!order.assignedRider || order.assignedRider.toString() !== riderId) {
      return res.status(403).json({ message: "Rider is not assigned to this order" });
    }

    // Upload image to Cloudinary
    const file = req.files.image;
    const uploadResponse = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "order_delivery_proofs",
    });

    // Push delivery proof into order
    order.deliveryProof.push({
      riderId,
      imageUrl: uploadResponse.secure_url,
      uploadedAt: new Date(),
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Delivery proof uploaded successfully",
      deliveryProof: order.deliveryProof,
    });
  } catch (error) {
    console.error("🔥 Error in uploadDeliveryProof:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



export const createRiderQuery = async (req, res) => {
  try {
    // Destructure the body to get the necessary fields
    const { riderId, name, email, mobile, message } = req.body;

    // Validate that riderId exists (optional but recommended)
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Create a new query document for the rider
    const query = new Query({
      riderId,
      name,
      email,
      mobile,
      message,
    });

    // Save the query to the database
    await query.save();

    // Send response
    res.status(201).json({ message: "Query submitted successfully", query });
  } catch (error) {
    // Handle any errors
    console.error("Error creating rider query:", error);
    res.status(500).json({ message: "Error creating query", error });
  }
};



export const uploadMedicineProof = async (req, res) => {
  try {
    const { riderId, orderId } = req.params;

    // Check for uploaded image
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid rider ID or order ID" });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ensure rider is assigned to the order
    if (!order.assignedRider || order.assignedRider.toString() !== riderId) {
      return res.status(403).json({ message: "Rider is not assigned to this order" });
    }

    // Get first medicine from order to find pharmacy
    if (!order.orderItems || order.orderItems.length === 0) {
      return res.status(202).json({ message: "No medicine items found in order" });
    }

    const firstMedicineId = order.orderItems[0].medicineId;

    // Find medicine details
    const medicine = await Medicine.findById(firstMedicineId);
    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found" });
    }

    // Find pharmacy details
    const pharmacy = await Pharmacy.findById(medicine.pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ message: "Pharmacy not found" });
    }

    // Find rider details for current location
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Check if rider has latitude and longitude
    if (!rider.latitude || !rider.longitude) {
      return res.status(400).json({
        message: "Rider location not available. Please enable location services."
      });
    }

    // Check if rider is at vendor's location
    const riderLat = parseFloat(rider.latitude);
    const riderLng = parseFloat(rider.longitude);
    const pharmacyLat = pharmacy.latitude;
    const pharmacyLng = pharmacy.longitude;

    // Calculate distance between rider and pharmacy (in kilometers)
    const distanceInKm = calculateDistance(
      [riderLng, riderLat],  // [longitude, latitude]
      [pharmacyLng, pharmacyLat]  // [longitude, latitude]
    );

    // Convert km to meters for proximity check
    const distanceInMeters = distanceInKm * 1000;

    // Set proximity threshold (e.g., 100 meters)
    const PROXIMITY_THRESHOLD = 400;

    // Distance check
    if (distanceInMeters > PROXIMITY_THRESHOLD) {
      return res.status(403).json({
        message: "You are not at the vendor's location. Please move closer.",
        distance: Math.round(distanceInMeters),
        threshold: PROXIMITY_THRESHOLD
      });
    }

    // Upload image to Cloudinary
    const file = req.files.image;
    const uploadResponse = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "medicine_pickup_proofs",
    });

    // Create beforePickupProof field if it doesn't exist in order schema
    if (!order.beforePickupProof) {
      order.beforePickupProof = [];
    }

    order.beforePickupProof.push({
      riderId,
      imageUrl: uploadResponse.secure_url,
      uploadedAt: new Date(),
      medicineId: firstMedicineId,
      pharmacyId: medicine.pharmacyId
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Medicine proof uploaded successfully",
      medicineProof: order.beforePickupProof,
      distance: Math.round(distanceInMeters),
      locationVerified: true
    });
  } catch (error) {
    console.error("🔥 Error in uploadMedicineProof:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// // Helper function to calculate distance between two coordinates (Haversine formula)
// function calculateDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371e3; // Earth's radius in meters
//   const φ1 = (lat1 * Math.PI) / 180;
//   const φ2 = (lat2 * Math.PI) / 180;
//   const Δφ = ((lat2 - lat1) * Math.PI) / 180;
//   const Δλ = ((lon2 - lon1) * Math.PI) / 180;

//   const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
//             Math.cos(φ1) * Math.cos(φ2) *
//             Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//   return R * c; // Distance in meters
// }


