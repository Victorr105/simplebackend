// controllers/userController.js
import User from "../models/userModel.js";
import bcrypt from "bcrypt";

// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').populate('property', 'propertyName');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
};

// Get single user
const getOneUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password').populate('property', 'propertyName');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user", error });
  }
};

// Get own profile (for tenants to see their own info)
const getMyProfile = async (req, res) => {
  try {
    console.log("getMyProfile called for user ID:", req.user.id);
    
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('property', 'propertyName');
    
    console.log("User found:", user);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Error fetching profile", error: error.message });
  }
};

// Create user (admin only)
const createUser = async (req, res) => {
  try {
    const { username, password, role, propertyId } = req.body;

    console.log("Creating user:", { username, role, propertyId });

    if (!username || !password || !role) {
      return res.status(400).json({ message: "Username, password and role are required" });
    }

    // Check if username already exists
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Validate role
    const allowedRoles = ["admin", "manager", "user"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // If role is "user" OR "manager", propertyId is required
    if ((role === "user" || role === "manager") && !propertyId) {
      return res.status(400).json({ 
        message: role === "user" ? "Property is required for tenants" : "Property is required for managers" 
      });
    }

    // If propertyId is provided, check if property exists
    if (propertyId) {
      const Property = (await import("../models/propertyModel.js")).default;
      const property = await Property.findById(propertyId);
      if (!property) {
        return res.status(400).json({ message: "Property not found" });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user - save property for both tenants AND managers
    const newUser = await User.create({
      username: username.trim(),
      password: hashedPassword,
      role: role,
      property: (role === "user" || role === "manager") ? propertyId : null
    });

    // If creating a manager, also update the property's manager field
    if (role === "manager" && propertyId) {
      const Property = (await import("../models/propertyModel.js")).default;
      await Property.findByIdAndUpdate(propertyId, { manager: newUser._id });
      console.log(`✅ Manager ${username} assigned to property ${propertyId}`);
    }

    // Return user without password
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: "User created successfully",
      user: userResponse
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Error creating user" });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, role, propertyId } = req.body;

    const updateData = { username, role };
    
    // Update property for both tenants AND managers
    if ((role === "user" || role === "manager") && propertyId) {
      updateData.property = propertyId;
    } else if (role !== "user" && role !== "manager") {
      updateData.property = null;
    }

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password').populate('property', 'propertyName');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If updating a manager, also update the property's manager field
    if (role === "manager" && propertyId) {
      const Property = (await import("../models/propertyModel.js")).default;
      
      // Remove manager from old property if exists
      await Property.updateMany(
        { manager: id },
        { $unset: { manager: "" } }
      );
      
      // Assign to new property
      await Property.findByIdAndUpdate(propertyId, { manager: id });
      console.log(`✅ Manager ${user.username} reassigned to property ${propertyId}`);
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Error updating user" });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const Unit = (await import("../models/unitModel.js")).default;
    const assignedUnit = await Unit.findOne({ tenant: id });
    
    if (assignedUnit) {
      return res.status(400).json({ 
        message: "Cannot delete user because they are assigned as a tenant to a unit. Please remove them from the unit first." 
      });
    }

    const Property = (await import("../models/propertyModel.js")).default;
    const ownedProperty = await Property.findOne({ propertyOwner: id });
    
    if (ownedProperty) {
      return res.status(400).json({ 
        message: "Cannot delete user because they own properties. Please reassign properties first." 
      });
    }

    // If user is a manager, remove them from property manager field
    const userToDelete = await User.findById(id);
    if (userToDelete && userToDelete.role === "manager" && userToDelete.property) {
      await Property.findByIdAndUpdate(userToDelete.property, { $unset: { manager: "" } });
      console.log(`✅ Manager removed from property ${userToDelete.property}`);
    }

    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Error deleting user" });
  }
};

// Get users by role (for dropdowns)
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    
    console.log("Fetching users with role:", role);
    
    const allowedRoles = ["admin", "manager", "user"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const users = await User.find({ role }).select('username property').populate('property', 'propertyName');
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users by role:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

// Get tenants by property (for unit assignment)
const getTenantsByProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    console.log("Fetching tenants for property:", propertyId);
    
    const tenants = await User.find({ 
      role: "user",
      property: propertyId 
    }).select('username');
    
    const Unit = (await import("../models/unitModel.js")).default;
    const assignedTenantIds = await Unit.distinct('tenant', { 
      property: propertyId,
      tenant: { $ne: null } 
    });
    
    const availableTenants = tenants.filter(
      tenant => !assignedTenantIds.some(id => id && id.toString() === tenant._id.toString())
    );

    res.json(availableTenants);
  } catch (error) {
    console.error("Error fetching tenants by property:", error);
    res.status(500).json({ message: "Failed to fetch tenants" });
  }
};

// EXPORT ALL FUNCTIONS
export { 
  getUsers, 
  getOneUser, 
  createUser, 
  updateUser, 
  deleteUser,
  getUsersByRole,
  getTenantsByProperty,
  getMyProfile
};