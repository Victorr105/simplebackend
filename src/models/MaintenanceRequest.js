import mongoose from 'mongoose';

const maintenanceRequestSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['low','medium','high','emergency'], default: 'medium' },
  status: { type: String, enum: ['pending','in-progress','completed','cancelled'], default: 'pending' },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('MaintenanceRequest', maintenanceRequestSchema);