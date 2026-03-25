// models/unitModel.js
import mongoose from "mongoose";

const unitSchema = new mongoose.Schema(
  {
    unitNumber: {
      type: String,
      required: true,
    },

    rent: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["vacant", "occupied"],
      default: "vacant",
    },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    
    // New fields for rent due date and late fees
    dueDay: {
      type: Number,
      default: 5, // Rent due on the 5th of each month
      min: 1,
      max: 28
    },
    
    lateFee: {
      type: Number,
      default: 500, // KES 500 late fee
      min: 0
    },
    
    gracePeriod: {
      type: Number,
      default: 3, // 3 days grace period after due date
      min: 0
    }
  },
  { 
    timestamps: true,
    indexes: [
      { unique: true, partialFilterExpression: { tenant: { $ne: null } } }
    ]
  }
);

// Ensure unique unit numbers per property
unitSchema.index({ property: 1, unitNumber: 1 }, { unique: true });

const Unit = mongoose.model("Unit", unitSchema);
export default Unit;