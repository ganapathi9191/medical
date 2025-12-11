import cloudinary from '../config/cloudinary.js';
import Pharmacy from '../Models/Pharmacy.js';
import PharmacyCategory from '../Models/PharmacyCategory.js';
import Medicine from '../Models/Medicine.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Prescription from '../Models/Prescription.js';
import { Notification } from '../Models/Notification.js';
import Order from '../Models/Order.js';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

export const createPharmacy = async (req, res) => {
  try {
    const {
      name,
      image,
      latitude,
      longitude,
      categories,
      vendorName,
      vendorEmail,
      vendorPhone,
      address,
      aadhar,
      panCard,
      license
    } = req.body;

    // Required field validation
    if (!name || !latitude || !longitude || !address) {
      return res.status(400).json({
        message: 'Name, latitude, longitude, and address are required'
      });
    }

    // ✅ Check if vendorPhone already exists (UNIQUE VALIDATION)
    if (vendorPhone) {
      const existingPhone = await Pharmacy.findOne({ vendorPhone });

      if (existingPhone) {
        return res.status(400).json({
          message: "Vendor phone already exists",
          existsInPharmacy: existingPhone.name,
        });
      }
    }

    let imageUrl = '';

    // Upload pharmacy image
    if (req.files?.image) {
      const uploaded = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: 'pharmacies',
      });
      imageUrl = uploaded.secure_url;
    } else if (image?.startsWith('http')) {
      imageUrl = image;
    } else {
      return res.status(400).json({ message: 'Pharmacy image file or valid URL is required' });
    }

    // Parse categories
    let parsedCategories = [];
    if (categories) {
      let catArray = [];
      if (typeof categories === 'string') catArray = JSON.parse(categories);
      else if (Array.isArray(categories)) catArray = categories;

      if (req.files?.categoryImages) {
        const categoryFiles = Array.isArray(req.files.categoryImages)
          ? req.files.categoryImages
          : [req.files.categoryImages];

        for (let i = 0; i < categoryFiles.length; i++) {
          const file = categoryFiles[i];
          const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
            folder: 'pharmacy_categories',
          });

          parsedCategories.push({
            name: catArray[i]?.name || file.name.split('.')[0],
            image: uploaded.secure_url
          });
        }
      } else {
        parsedCategories = catArray;
      }
    }

    // Upload Aadhar document
    let aadharFileUrl = '';
    if (req.files?.aadharFile) {
      const uploaded = await cloudinary.uploader.upload(req.files.aadharFile.tempFilePath, {
        folder: 'pharmacy_aadhar_docs',
      });
      aadharFileUrl = uploaded.secure_url;
    }

    // Upload PAN card
    let panCardFileUrl = '';
    if (req.files?.panCardFile) {
      const uploaded = await cloudinary.uploader.upload(req.files.panCardFile.tempFilePath, {
        folder: 'pharmacy_pancard_docs',
      });
      panCardFileUrl = uploaded.secure_url;
    }

    // Upload License document
    let licenseFileUrl = '';
    if (req.files?.licenseFile) {
      const uploaded = await cloudinary.uploader.upload(req.files.licenseFile.tempFilePath, {
        folder: 'pharmacy_license_docs',
      });
      licenseFileUrl = uploaded.secure_url;
    }

    // Generate vendor ID and password
    const lastPharmacy = await Pharmacy.findOne({})
      .sort({ createdAt: -1 })
      .select('vendorId')
      .lean();

    let newNumber = 100001;

    if (lastPharmacy?.vendorId && /^CX\d{6}$/.test(lastPharmacy.vendorId)) {
      const lastNumber = parseInt(lastPharmacy.vendorId.slice(2), 10);
      newNumber = lastNumber + 1;
    }

    const vendorId = `CX${newNumber.toString().padStart(6, '0')}`;
    const password = Math.floor(1000 + Math.random() * 9000).toString();

    // Create pharmacy
    const newPharmacy = new Pharmacy({
      name,
      image: imageUrl,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address,
      categories: parsedCategories,
      vendorName,
      vendorEmail,
      vendorPhone,         // keeps unique
      vendorId,
      password,
      status: "Pending",
      aadhar,
      aadharFile: aadharFileUrl,
      panCard,
      panCardFile: panCardFileUrl,
      license,
      licenseFile: licenseFileUrl
    });

    await newPharmacy.save();

    // Create notifications
    await Notification.create({
      type: "Pharmacy",
      referenceId: newPharmacy._id,
      message: `New pharmacy "${newPharmacy.name}" created. Please approve or reject.`,
      status: "Pending"
    });

    return res.status(201).json({
      message: "Pharmacy created successfully",
      pharmacy: newPharmacy,
      vendorCredentials: { vendorId, password }
    });

  } catch (error) {
    console.error("Error creating pharmacy:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



export const updatePharmacy = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const {
      name,
      image,
      latitude,
      longitude,
      categories,
      vendorName,
      vendorEmail,
      vendorPhone,
      status,
      address,
      aadhar,
      panCard,
      license,
    } = req.body;

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    // 🌐 Upload pharmacy image
    let imageUrl = pharmacy.image;
    if (req.files?.image) {
      const uploaded = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: 'pharmacies',
      });
      imageUrl = uploaded.secure_url;
    } else if (image?.startsWith('http')) {
      imageUrl = image;
    }

    // 🏷️ Merge existing categories with new ones
    let existingCategories = pharmacy.categories || [];
    let newCategories = [];

    if (categories) {
      let catArray = [];

      if (typeof categories === 'string') {
        catArray = JSON.parse(categories); // from stringified JSON
      } else if (Array.isArray(categories)) {
        catArray = categories; // already parsed
      }

      const categoryFiles = req.files?.categoryImages
        ? Array.isArray(req.files.categoryImages)
          ? req.files.categoryImages
          : [req.files.categoryImages]
        : [];

      for (let i = 0; i < catArray.length; i++) {
        let imageUrl = catArray[i].image || '';

        // Upload image if provided in file
        if (categoryFiles[i]) {
          const uploaded = await cloudinary.uploader.upload(categoryFiles[i].tempFilePath, {
            folder: 'pharmacy_categories',
          });
          imageUrl = uploaded.secure_url;
        }

        if (!catArray[i].name || !imageUrl) {
          return res.status(400).json({
            message: 'Each new category must have a name and an image',
          });
        }

        newCategories.push({
          name: catArray[i].name,
          image: imageUrl,
        });
      }
    }

    // 🔄 Update fields
    pharmacy.name = name || pharmacy.name;
    pharmacy.image = imageUrl;
    pharmacy.latitude = latitude ? parseFloat(latitude) : pharmacy.latitude;
    pharmacy.longitude = longitude ? parseFloat(longitude) : pharmacy.longitude;
    pharmacy.categories = [...existingCategories, ...newCategories]; // ✅ Merge
    pharmacy.vendorName = vendorName || pharmacy.vendorName;
    pharmacy.vendorEmail = vendorEmail || pharmacy.vendorEmail;
    pharmacy.vendorPhone = vendorPhone || pharmacy.vendorPhone;
    pharmacy.address = address || pharmacy.address;
    pharmacy.aadhar = aadhar || pharmacy.aadhar;
    pharmacy.panCard = panCard || pharmacy.panCard;
    pharmacy.license = license || pharmacy.license;

    // 📄 Upload documents if any
    if (req.files?.aadharFile) {
      const uploaded = await cloudinary.uploader.upload(req.files.aadharFile.tempFilePath, {
        folder: 'pharmacy_aadhar_docs',
      });
      pharmacy.aadharFile = uploaded.secure_url;
    }

    if (req.files?.panCardFile) {
      const uploaded = await cloudinary.uploader.upload(req.files.panCardFile.tempFilePath, {
        folder: 'pharmacy_pancard_docs',
      });
      pharmacy.panCardFile = uploaded.secure_url;
    }

    if (req.files?.licenseFile) {
      const uploaded = await cloudinary.uploader.upload(req.files.licenseFile.tempFilePath, {
        folder: 'pharmacy_license_docs',
      });
      pharmacy.licenseFile = uploaded.secure_url;
    }

    // ✅ Status update
    if (status) {
      const validStatuses = ['Active', 'Inactive', 'Suspended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      pharmacy.status = status;
    }

    // 💾 Save
    await pharmacy.save();

    // 🔔 Notification
    await Notification.create({
      type: 'Pharmacy',
      referenceId: pharmacy._id,
      message: `Pharmacy "${pharmacy.name}" updated with new categories`,
      status: 'Pending',
    });

    res.status(200).json({
      message: 'Pharmacy updated successfully with new categories',
      pharmacy,
    });

  } catch (error) {
    console.error('Error updating pharmacy:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const deletePharmacy = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const deleted = await Pharmacy.findByIdAndDelete(pharmacyId);

    if (!deleted) {
      return res.status(404).json({ message: 'Pharmacy not found or already deleted' });
    }

    res.status(200).json({ message: 'Pharmacy deleted successfully' });

  } catch (error) {
    console.error('Error deleting pharmacy:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// 📦 Get All Pharmacies with Monthly Revenue
// 📦 Get All Pharmacies with Monthly Revenue and Payment Status
export const getAllPharmacies = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find().lean();
    const orders = await Order.find({ status: 'Delivered' }).lean();
    const medicines = await Medicine.find().lean();

    // Map for fast lookup
    const medicineMap = {};
    for (const med of medicines) {
      medicineMap[med._id.toString()] = med;
    }

    // Revenue map: { pharmacyId: { 'YYYY-MM': amount } }
    const revenueMap = {};

    for (const order of orders) {
      const orderMonth = new Date(order.createdAt).toISOString().slice(0, 7); // "YYYY-MM"

      for (const item of order.orderItems) {
        // Check if medicineId exists and is valid before using it
        if (!item.medicineId || !medicineMap[item.medicineId.toString()]) {
          continue; // Skip this item if medicineId is missing or invalid
        }

        const med = medicineMap[item.medicineId.toString()];
        if (!med || !med.pharmacyId) continue;

        const pharmacyId = med.pharmacyId.toString();
        const amount = med.price * item.quantity;

        if (!revenueMap[pharmacyId]) {
          revenueMap[pharmacyId] = {};
        }

        if (!revenueMap[pharmacyId][orderMonth]) {
          revenueMap[pharmacyId][orderMonth] = 0;
        }

        revenueMap[pharmacyId][orderMonth] += amount;
      }
    }

    // Merge revenue and payment status into pharmacy list
    const pharmacyData = pharmacies.map((pharmacy) => {
      const pharmacyId = pharmacy._id.toString();
      const monthlyRevenue = revenueMap[pharmacyId] || {};
      const paymentStatus = pharmacy.paymentStatus || {};
      const revenueByMonth = {};

      for (const month in monthlyRevenue) {
        revenueByMonth[month] = {
          amount: monthlyRevenue[month],
          status: paymentStatus[month] || 'pending', // default to 'pending'
        };
      }

      return {
        ...pharmacy,
        revenueByMonth,
      };
    });

    res.status(200).json({
      message: 'Pharmacies fetched successfully with revenue and status',
      total: pharmacies.length,
      pharmacies: pharmacyData,
    });
  } catch (error) {
    console.error('Error fetching pharmacies with revenue:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



export const getPharmacies = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    if (pharmacyId) {
      // 🛡️ Validate ID
      if (!mongoose.Types.ObjectId.isValid(pharmacyId)) {
        return res.status(400).json({ message: 'Invalid pharmacy ID' });
      }

      // 🔍 Find the pharmacy
      const pharmacy = await Pharmacy.findById(pharmacyId);
      if (!pharmacy) {
        return res.status(404).json({ message: 'Pharmacy not found' });
      }

      // 💊 Find medicines related to this pharmacy
      const medicines = await Medicine.find({ pharmacyId });

      return res.status(200).json({
        message: 'Pharmacy fetched successfully',
        pharmacy,
        totalMedicines: medicines.length,
        medicines,
      });
    }

    // 📦 If no pharmacyId → fetch all pharmacies
    const pharmacies = await Pharmacy.find();

    return res.status(200).json({
      message: 'Pharmacies fetched successfully',
      total: pharmacies.length,
      pharmacies,
    });

  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// Add/Edit Pharmacy
export const addOrUpdatePharmacy = async (req, res) => {
  const { pharmacyId } = req.params;
  const { name, image, latitude, longitude, categories } = req.body;

  try {
    if (pharmacyId) {
      // 🛡️ Validate ID
      if (!mongoose.Types.ObjectId.isValid(pharmacyId)) {
        return res.status(400).json({ message: 'Invalid pharmacy ID' });
      }

      // 🔍 Find and update the pharmacy
      const pharmacy = await Pharmacy.findByIdAndUpdate(
        pharmacyId,
        { name, image, latitude, longitude, categories },
        { new: true, runValidators: true }
      );

      if (!pharmacy) {
        return res.status(404).json({ message: 'Pharmacy not found to update' });
      }

      return res.status(200).json({ message: 'Pharmacy updated successfully', pharmacy });
    } else {
      // 🆕 Add a new pharmacy
      const pharmacy = new Pharmacy({ name, image, latitude, longitude, categories });
      await pharmacy.save();

      return res.status(201).json({ message: 'Pharmacy created successfully', pharmacy });
    }
  } catch (error) {
    console.error('Error adding/updating pharmacy:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// ➕ Create Pharmacy Category
export const createPharmacyCategory = async (req, res) => {
  try {
    const { pharmacyId, categoryName, image } = req.body;

    if (!pharmacyId || !categoryName) {
      return res.status(400).json({ message: 'pharmacyId and categoryName are required' });
    }

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    let imageUrl = '';

    if (req.files && req.files.image) {
      const uploaded = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: 'pharmacy-categories',
      });
      imageUrl = uploaded.secure_url;
    } else if (image && image.startsWith('http')) {
      imageUrl = image;
    } else {
      return res.status(400).json({ message: 'Image file or valid URL is required' });
    }

    const newCategory = new PharmacyCategory({
      pharmacyId,
      categoryName,
      image: imageUrl,
    });

    await newCategory.save();

    const populated = await PharmacyCategory.findById(newCategory._id).populate('pharmacyId', 'name location');

    res.status(201).json({
      message: 'Pharmacy category created successfully',
      category: populated,
    });
  } catch (error) {
    console.error('Error creating pharmacy category:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// 📥 Get All Pharmacy Categories
export const getAllPharmacyCategories = async (req, res) => {
  try {
    const categories = await PharmacyCategory.find().populate('pharmacyId', 'name location');
    res.status(200).json({
      message: 'Pharmacy categories fetched successfully',
      total: categories.length,
      categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



// ➕ Create Medicine
export const createMedicine = async (req, res) => {
  try {
    const { pharmacyId, name, price, mrp, description, categoryName } = req.body;

    // ✅ Check pharmacy exists
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    // 🔍 Validate category name exists in pharmacy
    const categoryExists = pharmacy.categories.some(
      cat => cat.name.toLowerCase() === categoryName?.toLowerCase()
    );

    if (!categoryExists) {
      return res.status(400).json({ message: `Category "${categoryName}" not found in this pharmacy` });
    }

    let images = [];

    // 📷 Case 1: Upload multiple files
    if (req.files && req.files.images) {
      const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      for (let file of files) {
        const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: 'medicines',
        });
        images.push(uploaded.secure_url);
      }
    }
    // 🌐 Case 2: URLs passed directly
    else if (Array.isArray(req.body.images)) {
      images = req.body.images.filter(img => img.startsWith('http'));
    }
    else {
      return res.status(400).json({ message: 'Images are required (upload or URL)' });
    }

    // 🏥 Create medicine with category name only
    const newMedicine = new Medicine({
      pharmacyId,
      name,
      images,
      price,
      mrp, // ✅ Added MRP
      description,
      categoryName
    });

    await newMedicine.save();

    const populated = await Medicine.findById(newMedicine._id)
      .populate('pharmacyId', 'name location');

    res.status(201).json({
      message: 'Medicine created successfully',
      medicine: {
        name: populated.name,
        images: populated.images,
        price: populated.price,
        mrp: populated.mrp, // ✅ Return MRP
        description: populated.description,
        categoryName: populated.categoryName,
        pharmacy: populated.pharmacyId,
      }
    });

  } catch (error) {
    console.error('Error creating medicine:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


export const updateMedicine = async (req, res) => {
  try {
    const { medicineId } = req.params;
    const { name, price, mrp, description, categoryName } = req.body;

    // 🔍 Check medicine exists
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    // ✅ If categoryName is provided, validate against pharmacy's categories
    if (categoryName) {
      const pharmacy = await Pharmacy.findById(medicine.pharmacyId);
      if (!pharmacy) {
        return res.status(404).json({ message: 'Pharmacy not found for this medicine' });
      }

      const categoryExists = pharmacy.categories.some(
        cat => cat.name.toLowerCase() === categoryName.toLowerCase()
      );

      if (!categoryExists) {
        return res.status(400).json({ message: `Category "${categoryName}" not found in this pharmacy` });
      }
      medicine.categoryName = categoryName;
    }

    // 📷 Update images if provided
    if (req.files && req.files.images) {
      const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      let uploadedImages = [];
      for (let file of files) {
        const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: 'medicines',
        });
        uploadedImages.push(uploaded.secure_url);
      }
      medicine.images = uploadedImages;
    } else if (Array.isArray(req.body.images)) {
      medicine.images = req.body.images.filter(img => img.startsWith('http'));
    }

    // 🖊 Update text fields if provided
    if (name) medicine.name = name;
    if (price) medicine.price = price;
    if (mrp) medicine.mrp = mrp; // ✅ Update MRP
    if (description) medicine.description = description;

    await medicine.save();

    const populated = await Medicine.findById(medicine._id)
      .populate('pharmacyId', 'name location');

    res.status(200).json({
      message: 'Medicine updated successfully',
      medicine: populated
    });

  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


export const deleteMedicine = async (req, res) => {
  try {
    const { medicineId } = req.params;

    // 🔍 Check medicine exists
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    // (Optional) ❌ Delete images from Cloudinary if needed
    // This requires storing `public_id` when uploading
    // for (let img of medicine.images) {
    //   const publicId = img.split('/').pop().split('.')[0];
    //   await cloudinary.uploader.destroy(`medicines/${publicId}`);
    // }

    await Medicine.findByIdAndDelete(medicineId);

    res.status(200).json({ message: 'Medicine deleted successfully' });

  } catch (error) {
    console.error('Error deleting medicine:', error);
    res.status(500).json({ message: 'Server error' });
  }
};





export const getAllMedicines = async (req, res) => {
  try {
    const { categoryName, name } = req.query;

    // Build query object
    const query = {};

    // Case-insensitive exact match for categoryName
    if (categoryName && categoryName.trim() !== "") {
      query.categoryName = { $regex: new RegExp(`^${categoryName}$`, "i") };
    }

    // Case-insensitive partial match for name
    if (name && name.trim() !== "") {
      query.name = { $regex: new RegExp(name, "i") }; // partial match
    }

    // Fetch medicines and populate pharmacy with name and address
    const medicines = await Medicine.find(query).populate("pharmacyId", "name address");

    // Filter out medicines that don't have a pharmacy
    const medicinesWithPharmacy = medicines.filter(med => med.pharmacyId);

    if (medicinesWithPharmacy.length === 0) {
      return res.status(200).json({
        message: "No medicines available with a pharmacy",
        total: 0,
        medicines: []
      });
    }

    // Format response
    const formatted = medicinesWithPharmacy.map(med => ({
      medicineId: med._id,
      name: med.name,
      images: med.images,
      price: med.price,
      mrp: med.mrp,
      description: med.description,
      categoryName: med.categoryName,
      pharmacy: med.pharmacyId
    }));

    res.status(200).json({
      message: "Medicines fetched successfully",
      total: formatted.length,
      medicines: formatted
    });

  } catch (error) {
    console.error("Error fetching medicines:", error);
    res.status(500).json({ message: "Server error" });
  }
};




// 📦 Get Medicines by Pharmacy & Category
// export const getMedicinesByPharmacyAndCategory = async (req, res) => {
//   try {
//     const { pharmacyId } = req.params;
//     const { categoryName } = req.query;

//     // ✅ Validate pharmacyId
//     if (!mongoose.Types.ObjectId.isValid(pharmacyId)) {
//       return res.status(400).json({ message: 'Invalid pharmacy ID' });
//     }

//     // ✅ Ensure pharmacy exists
//     const pharmacy = await Pharmacy.findById(pharmacyId);
//     if (!pharmacy) {
//       return res.status(404).json({ message: 'Pharmacy not found' });
//     }

//     // 🔍 Build query object
//     let query = { pharmacyId };
//     if (categoryName) {
//       query.categoryName = { $regex: new RegExp(`^${categoryName}$`, 'i') }; // Case-insensitive exact match
//     }

//     // 📦 Fetch medicines
//     const medicines = await Medicine.find(query).populate('pharmacyId', 'name location');

//     res.status(200).json({
//       message: 'Medicines fetched successfully',
//       total: medicines.length,
//       medicines
//     });

//   } catch (error) {
//     console.error('Error fetching medicines:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };




// 📥 Get Single Medicine by ID
export const getSingleMedicine = async (req, res) => {
  try {
    const { medicineId } = req.params;

    const medicine = await Medicine.findById(medicineId)
      .populate('pharmacyId', 'name location');

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    res.status(200).json({
      message: 'Medicine fetched successfully',
      medicine: {
        medicineId: medicine._id,
        name: medicine.name,
        images: medicine.images,
        price: medicine.price,
        description: medicine.description,
        categoryName: medicine.categoryName,
        pharmacy: medicine.pharmacyId, // populated: { name, location }
      }
    });
  } catch (error) {
    console.error('Error fetching medicine:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



// ✅ Get Prescriptions for a Pharmacy with populate and safe fallback
export const getPrescriptionsForPharmacy = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    if (!pharmacyId) {
      return res.status(400).json({ message: "pharmacyId is required in params" });
    }

    const prescriptions = await Prescription.find({ pharmacyId })
      .populate({
        path: "userId",
        select: "name email mobile",
        options: { lean: true }, // return plain JS object
      })
      .populate({
        path: "pharmacyId",
        select: "name email mobile",
        options: { lean: true },
      })
      .sort({ createdAt: -1 })
      .lean(); // convert all docs to plain JS objects

    // Optional: if some userId are missing, replace with placeholder
    const prescriptionsWithFallback = prescriptions.map((p) => ({
      ...p,
      userId: p.userId || { _id: null, name: "Deleted User", email: "", mobile: "" },
    }));

    res.status(200).json({
      message: "Prescriptions fetched successfully",
      prescriptions: prescriptionsWithFallback,
    });
  } catch (error) {
    console.error("Get Prescriptions Error:", error);
    res.status(500).json({ message: "Error fetching prescriptions", error: error.message });
  }
};



export const getMedicinesByPharmacyAndCategory = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { category } = req.query; // e.g., ?category=Fever

    // Validate pharmacyId
    if (!mongoose.Types.ObjectId.isValid(pharmacyId)) {
      return res.status(400).json({ message: "Invalid pharmacy ID" });
    }

    // Find the pharmacy
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ message: "Pharmacy not found" });
    }

    // If category provided → check if it's valid in this pharmacy
    if (category) {
      const matchedCategory = pharmacy.categories.find(cat => cat.name.toLowerCase() === category.toLowerCase());
      if (!matchedCategory) {
        return res.status(404).json({ message: `Category '${category}' not found in this pharmacy` });
      }
    }

    // Get medicines for this pharmacy and filter by category if provided
    const query = { pharmacyId };
    if (category) {
      query.categoryName = category;  // Filter medicines by categoryName
    }

    const medicines = await Medicine.find(query);

    return res.status(200).json({
      message: "Medicines fetched successfully",
      pharmacy: {
        _id: pharmacy._id,
        name: pharmacy.name,
        address: pharmacy.address,
        image: pharmacy.image,
      },
      categoryFilter: category || null,
      totalMedicines: medicines.length,
      medicines,
    });

  } catch (error) {
    console.error("Error fetching medicines:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const updatePaymentStatus = async (req, res) => {
  const { pharmacyId } = req.params;
  const { month, status, amount } = req.body;

  if (!month || !status) {
    return res.status(400).json({ message: 'Month and status are required' });
  }

  try {
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    // Initialize paymentStatus, revenueByMonth, and paymentHistory if they are undefined
    if (!pharmacy.paymentStatus) pharmacy.paymentStatus = {};
    if (!pharmacy.revenueByMonth) pharmacy.revenueByMonth = {};
    if (!pharmacy.paymentHistory) pharmacy.paymentHistory = [];

    // Check if the status for the given month is already 'paid'
    if (pharmacy.paymentStatus[month] === 'paid') {
      return res.status(400).json({
        message: `Payment for ${month} has already been marked as 'paid'. No further updates allowed for this month.`,
      });
    }

    // Update status for the month
    pharmacy.paymentStatus[month] = status;

    // Use the amount directly from the request body, don't force to 0 unless explicitly required
    let finalAmount = amount;

    // If the status is 'paid', record the amount sent
    if (status === 'paid' && finalAmount !== undefined) {
      pharmacy.revenueByMonth[month] = { amount: finalAmount };
    }

    // Add the payment history entry
    pharmacy.paymentHistory.push({
      month,
      status,
      amount: finalAmount, // Use the actual amount passed in the body
      date: new Date(),    // Current date when the update is made
    });

    await pharmacy.save();

    return res.json({
      message: 'Payment status and amount updated',
      month,
      status,
      amount: finalAmount, // Return the actual amount sent in the request
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};




// Controller for fetching all pharmacies' payment history
// Controller for fetching all pharmacies' payment history
export const getAllPaymentHistory = async (req, res) => {
  try {
    // Fetch all pharmacies with their payment history
    const pharmacies = await Pharmacy.find({})
      .select('name vendorName vendorId paymentHistory createdAt')
      .sort({ createdAt: -1 });

    if (!pharmacies || pharmacies.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pharmacies found",
      });
    }

    // Extract and format payment history
    const paymentHistories = pharmacies.map(pharmacy => {
      return {
        pharmacyId: pharmacy._id,
        pharmacyName: pharmacy.name,
        vendorName: pharmacy.vendorName,
        vendorId: pharmacy.vendorId,
        totalPayments: pharmacy.paymentHistory?.length || 0,
        paymentHistory: pharmacy.paymentHistory?.length > 0 
          ? pharmacy.paymentHistory.map(payment => ({
              month: payment.month,
              status: payment.status,
              amount: payment.amount,
              date: payment.date
            }))
          : "No payment history available",
        createdAt: pharmacy.createdAt
      };
    });

    // Return the list of payment histories
    return res.status(200).json({
      success: true,
      count: paymentHistories.length,
      paymentHistories,
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching payment history",
      error: error.message,
    });
  }
};




// Get pharmacy by id
export const getPharmacyById = async (req, res) => {
  const { pharmacyId } = req.params;

  try {
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    return res.json(pharmacy);
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};




