// controllers/unitController.js
import Unit from "../models/unitModel.js";
import Property from "../models/propertyModel.js";
import User from "../models/userModel.js";

// Create a new unit
const createUnit = async (req, res) => {
  try {
    console.log("Create Unit called", { user: req.user, params: req.params, body: req.body });

    const { unitNumber, rent, status } = req.body;
    const { propertyId } = req.params;

    if (!unitNumber || !rent) {
      return res.status(400).json({ 
        message: "Unit number and rent are required" 
      });
    }

    const property = await Property.findOne({
      _id: propertyId,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(403).json({ message: "Not authorized or property not found" });
    }

    const unitCount = await Unit.countDocuments({ property: propertyId });
    if (unitCount >= property.numberOfUnits) {
      return res.status(400).json({ 
        message: `Maximum number of units (${property.numberOfUnits}) reached for this property` 
      });
    }

    const unit = await Unit.create({
      unitNumber: unitNumber.trim(),
      rent: Number(rent),
      status: status || "vacant",
      property: propertyId,
    });

    res.status(201).json(unit);
  } catch (error) {
    console.error("Create unit error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: "Unit number already exists in this property" 
      });
    }
    res.status(500).json({ message: "Failed to create unit" });
  }
};

// Get all units for a property (admin only)
const getPropertyUnits = async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    const property = await Property.findOne({
      _id: propertyId,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const units = await Unit.find({ property: propertyId })
      .populate('tenant', 'username')
      .sort({ unitNumber: 1 });

    res.json({
      property: {
        id: property._id,
        name: property.propertyName,
        totalUnits: property.numberOfUnits,
        currentUnits: units.length
      },
      units
    });
  } catch (error) {
    console.error("Get units error:", error);
    res.status(500).json({ message: "Failed to fetch units" });
  }
};

// Get units for a property (accessible by tenants)
const getUnitsForTenant = async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    const units = await Unit.find({ property: propertyId })
      .populate('tenant', 'username')
      .sort({ unitNumber: 1 });
    
    res.json({
      property: propertyId,
      units
    });
  } catch (error) {
    console.error("Get units error:", error);
    res.status(500).json({ message: "Failed to fetch units" });
  }
};

// Update a unit
const updateUnit = async (req, res) => {
  try {
    const { propertyId, unitId } = req.params;
    const { unitNumber, rent, status } = req.body;

    const property = await Property.findOne({
      _id: propertyId,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updateFields = {};
    if (unitNumber !== undefined) updateFields.unitNumber = unitNumber.trim();
    if (rent !== undefined) updateFields.rent = Number(rent);
    if (status !== undefined) updateFields.status = status;

    const unit = await Unit.findOneAndUpdate(
      { _id: unitId, property: propertyId },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('tenant', 'username');

    if (!unit) {
      return res.status(404).json({ message: "Unit not found" });
    }

    res.json(unit);
  } catch (error) {
    console.error("Update unit error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: "Unit number already exists in this property" 
      });
    }
    res.status(500).json({ message: "Failed to update unit" });
  }
};

// Delete a unit
const deleteUnit = async (req, res) => {
  try {
    const { propertyId, unitId } = req.params;

    const property = await Property.findOne({
      _id: propertyId,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const unit = await Unit.findOne({ _id: unitId, property: propertyId });
    
    if (!unit) {
      return res.status(404).json({ message: "Unit not found" });
    }

    if (unit.tenant) {
      return res.status(400).json({ 
        message: "Cannot delete unit with an assigned tenant. Remove tenant first." 
      });
    }

    await Unit.findByIdAndDelete(unitId);
    res.json({ message: "Unit deleted successfully" });
  } catch (error) {
    console.error("Delete unit error:", error);
    res.status(500).json({ message: "Failed to delete unit" });
  }
};

// Assign a tenant to a unit
const assignTenantToUnit = async (req, res) => {
  try {
    const { propertyId, unitId } = req.params;
    const { tenantId } = req.body;

    const property = await Property.findOne({
      _id: propertyId,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const unit = await Unit.findOne({
      _id: unitId,
      property: propertyId,
    });

    if (!unit) {
      return res.status(404).json({ message: "Unit not found" });
    }

    if (unit.tenant) {
      return res.status(400).json({ 
        message: "This unit already has a tenant. Remove current tenant first." 
      });
    }

    const tenant = await User.findOne({
      _id: tenantId,
      role: "user"
    });

    if (!tenant) {
      return res.status(404).json({ 
        message: "Tenant not found or user does not have 'user' role" 
      });
    }

    const existingAssignment = await Unit.findOne({
      tenant: tenantId,
      _id: { $ne: unitId }
    });

    if (existingAssignment) {
      return res.status(400).json({ 
        message: "This tenant is already assigned to another unit" 
      });
    }

    unit.tenant = tenantId;
    unit.status = "occupied";
    await unit.save();

    const updatedUnit = await Unit.findById(unitId)
      .populate('tenant', 'username');

    res.json({ 
      message: "Tenant assigned successfully", 
      unit: updatedUnit 
    });
  } catch (error) {
    console.error("Assign tenant error:", error);
    res.status(500).json({ message: "Failed to assign tenant" });
  }
};

// Remove tenant from unit
const removeTenantFromUnit = async (req, res) => {
  try {
    const { propertyId, unitId } = req.params;

    const property = await Property.findOne({
      _id: propertyId,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const unit = await Unit.findOneAndUpdate(
      { _id: unitId, property: propertyId },
      { 
        tenant: null,
        status: "vacant" 
      },
      { new: true }
    );

    if (!unit) {
      return res.status(404).json({ message: "Unit not found" });
    }

    res.json({ 
      message: "Tenant removed successfully", 
      unit 
    });
  } catch (error) {
    console.error("Remove tenant error:", error);
    res.status(500).json({ message: "Failed to remove tenant" });
  }
};

// Get available tenants
const getAvailableTenants = async (req, res) => {
  try {
    const allUsers = await User.find({ role: "user" }).select('username');
    const assignedTenantIds = await Unit.distinct('tenant', { tenant: { $ne: null } });
    
    const availableTenants = allUsers.filter(
      user => !assignedTenantIds.some(id => id && id.toString() === user._id.toString())
    );

    res.json(availableTenants);
  } catch (error) {
    console.error("Get available tenants error:", error);
    res.status(500).json({ message: "Failed to fetch available tenants" });
  }
};
// Get units for a property (accessible by managers)
const getUnitsForManager = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const managerId = req.user.id;
    
    console.log("Fetching units for property:", propertyId);
    console.log("Manager ID:", managerId);
    
    // Check if this property belongs to the manager
    const Property = (await import("../models/propertyModel.js")).default;
    const property = await Property.findOne({ 
      _id: propertyId,
      manager: managerId 
    });
    
    if (!property) {
      return res.status(403).json({ 
        message: "Not authorized to view this property's units" 
      });
    }
    
    const units = await Unit.find({ property: propertyId })
      .populate('tenant', 'username')
      .sort({ unitNumber: 1 });
    
    res.json({
      property: propertyId,
      units
    });
  } catch (error) {
    console.error("Get units for manager error:", error);
    res.status(500).json({ message: "Failed to fetch units" });
  }
};

// Get tenant for a specific unit
const getUnitTenant = async (req, res) => {
  try {
    const { propertyId, unitId } = req.params;

    const property = await Property.findOne({
      _id: propertyId,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const unit = await Unit.findOne({ _id: unitId, property: propertyId })
      .populate('tenant', 'username');

    if (!unit) {
      return res.status(404).json({ message: "Unit not found" });
    }

    if (!unit.tenant) {
      return res.status(404).json({ message: "No tenant assigned to this unit" });
    }

    res.json(unit.tenant);
  } catch (error) {
    console.error("Get unit tenant error:", error);
    res.status(500).json({ message: "Failed to fetch tenant" });
  }
};

// Get vacant units
const getVacantUnits = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findOne({
      _id: propertyId,
      propertyOwner: req.user.id,
    });

    if (!property) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const vacantUnits = await Unit.find({ 
      property: propertyId, 
      status: "vacant" 
    }).select('unitNumber rent');

    res.json(vacantUnits);
  } catch (error) {
    console.error("Error fetching vacant units:", error);
    res.status(500).json({ message: "Failed to fetch vacant units" });
  }
};

// EXPORT ALL FUNCTIONS
export { 
  createUnit, 
  getPropertyUnits, 
  updateUnit, 
  deleteUnit,
  assignTenantToUnit,
  removeTenantFromUnit,
  getAvailableTenants,
  getUnitTenant,
  getVacantUnits,
  getUnitsForTenant,
  getUnitsForManager  // Add this
};