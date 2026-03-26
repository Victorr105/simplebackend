import Property from "../models/propertyModel.js";
import Unit from "../models/unitModel.js";
import User from "../models/userModel.js";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Payment from "../models/paymentModel.js";  

// ---------- Multer configuration ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/properties';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter
});

// ---------- Property CRUD ----------
// CREATE a new property
const createProperty = async (req, res) => {
  try {
    const { propertyName, numberOfUnits } = req.body;
    
    if (!propertyName || !numberOfUnits) {
      return res.status(400).json({ 
        message: "Property name and number of units are required" 
      });
    }

    if (numberOfUnits < 1) {
      return res.status(400).json({ 
        message: "Number of units must be at least 1" 
      });
    }

    const newProperty = await Property.create({
      propertyName: propertyName.trim(),
      propertyOwner: req.user.id,
      numberOfUnits,
    });
    
    res.status(201).json(newProperty);
  } catch (error) {
    console.error("Create property error:", error);
    res.status(500).json({ message: "Failed to create property" });
  }
};

// GET all properties for the logged-in admin
const getMyProperties = async (req, res) => {
  try {
    const properties = await Property.find({ propertyOwner: req.user.id });
    res.json(properties);
  } catch (error) {
    console.error("Get properties error:", error);
    res.status(500).json({ message: "Failed to fetch properties" });
  }
};

// GET a single property by ID (admin only)
const getOneProperty = async (req, res) => {
  try {
    const { id } = req.params;
    
    const property = await Property.findOne({
      _id: id,
      propertyOwner: req.user.id,
    });
    
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    
    res.json(property);
  } catch (error) {
    console.error("Get property error:", error);
    res.status(500).json({ message: "Failed to fetch property" });
  }
};

// UPDATE a property
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyName, numberOfUnits, imageUrl } = req.body;

    const property = await Property.findOne({
      _id: id,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (numberOfUnits !== undefined) {
      if (numberOfUnits < 1) {
        return res.status(400).json({ 
          message: "Number of units must be at least 1" 
        });
      }

      const currentUnitsCount = await Unit.countDocuments({ property: id });
      
      if (numberOfUnits < currentUnitsCount) {
        return res.status(400).json({ 
          message: `Cannot reduce number of units to ${numberOfUnits} because this property already has ${currentUnitsCount} units. Delete some units first.` 
        });
      }
    }

    const updateData = {};
    if (propertyName !== undefined) updateData.propertyName = propertyName.trim();
    if (numberOfUnits !== undefined) updateData.numberOfUnits = numberOfUnits;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

    const updatedProperty = await Property.findOneAndUpdate(
      { _id: id, propertyOwner: req.user.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.json(updatedProperty);
  } catch (error) {
    console.error("Update property error:", error);
    res.status(500).json({ message: "Failed to update property" });
  }
};

// DELETE a property
export const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findOne({
      _id: id,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Delete all units that belong to this property
    await Unit.deleteMany({ property: id });

    // Delete all payments associated with this property
    await Payment.deleteMany({ property: id });   // adjust field name if needed

    // Delete the property itself
    await Property.findByIdAndDelete(id);
    
    res.json({ message: "Property and all associated data deleted successfully" });
  } catch (error) {
    console.error("Delete property error:", error);
    res.status(500).json({ message: "Failed to delete property" });
  }
};
// ---------- Manager functions ----------
const getAvailableManagers = async (req, res) => {
  try {
    const assignedManagers = await Property.distinct('manager', { manager: { $ne: null } });
    const availableManagers = await User.find({
      role: "manager",
      _id: { $nin: assignedManagers }
    }).select('username');
    res.json(availableManagers);
  } catch (error) {
    console.error("Error fetching available managers:", error);
    res.status(500).json({ message: "Failed to fetch available managers" });
  }
};

const assignManager = async (req, res) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    const property = await Property.findOne({
      _id: id,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(403).json({ message: "Not authorized or property not found" });
    }

    const manager = await User.findOne({
      _id: managerId,
      role: "manager"
    });

    if (!manager) {
      return res.status(404).json({ message: "Manager not found or invalid role" });
    }

    const existingAssignment = await Property.findOne({
      manager: managerId,
      _id: { $ne: id }
    });

    if (existingAssignment) {
      return res.status(400).json({ 
        message: "This manager is already assigned to another property" 
      });
    }

    property.manager = managerId;
    await property.save();

    res.json({ 
      message: "Manager assigned successfully", 
      property 
    });
  } catch (error) {
    console.error("Error assigning manager:", error);
    res.status(500).json({ message: "Failed to assign manager" });
  }
};

const removeManager = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findOneAndUpdate(
      { _id: id, propertyOwner: req.user.id },
      { manager: null },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.json({ message: "Manager removed successfully", property });
  } catch (error) {
    console.error("Error removing manager:", error);
    res.status(500).json({ message: "Failed to remove manager" });
  }
};

const getManagerProperties = async (req, res) => {
  try {
    const managerId = req.user.id;
    console.log("Fetching properties for manager ID:", managerId);
    const properties = await Property.find({ manager: managerId });
    console.log(`Found ${properties.length} properties for manager`);
    res.json(properties);
  } catch (error) {
    console.error("Get manager properties error:", error);
    res.status(500).json({ message: "Failed to fetch properties" });
  }
};

// ---------- Public (tenant) property access ----------
const getPropertyForTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (user.property && user.property.toString() === id) {
      const property = await Property.findById(id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      return res.json(property);
    }
    
    const property = await Property.findOne({ 
      _id: id, 
      $or: [
        { manager: req.user.id },
        { propertyOwner: req.user.id }
      ]
    });
    
    if (!property) {
      return res.status(403).json({ message: "Not authorized to view this property" });
    }
    
    res.json(property);
  } catch (error) {
    console.error("Get property error:", error);
    res.status(500).json({ message: "Failed to fetch property" });
  }
};

// ---------- Image upload ----------
const uploadPropertyImage = async (req, res) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      propertyOwner: req.user.id,
    });
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Build URL (assuming static files are served from /uploads)
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/properties/${req.file.filename}`;
    
    property.imageUrl = imageUrl;
    await property.save();

    res.json({ imageUrl, message: "Image uploaded successfully" });
  } catch (error) {
    console.error("Upload image error:", error);
    res.status(500).json({ message: "Failed to upload image" });
  }
};

// ---------- Export ----------
export { 
  createProperty, 
  getMyProperties, 
  getOneProperty, 
  updateProperty, 
  assignManager,
  removeManager,
  getAvailableManagers,
  getPropertyForTenant,
  getManagerProperties,
  upload,
  uploadPropertyImage
};