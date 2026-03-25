import express from 'express';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import Unit from '../models/unitModel.js';        // filename unitModel.js
import Property from '../models/propertyModel.js'; // filename propertyModel.js

const router = express.Router();

// POST /api/maintenance – tenant submits a request
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const tenantId = req.user.id;

    // Find the tenant's unit
    const unit = await Unit.findOne({ tenant: tenantId });
    if (!unit) return res.status(404).json({ message: 'No unit found for this tenant' });

    const property = await Property.findById(unit.property);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    const request = new MaintenanceRequest({
      title,
      description,
      priority,
      tenant: tenantId,
      unit: unit._id,
      property: unit.property
    });
    await request.save();
    res.status(201).json({ message: 'Request submitted', request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/maintenance/manager – manager views requests for their property
router.get('/manager', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ message: 'Access denied' });
    const property = await Property.findOne({ manager: req.user.id });
    if (!property) return res.status(404).json({ message: 'No property assigned' });
    const requests = await MaintenanceRequest.find({ property: property._id })
      .populate('tenant', 'username')
      .populate('unit', 'unitNumber')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/maintenance/my – tenant views their own requests
router.get('/my', verifyToken, async (req, res) => {
  try {
    const requests = await MaintenanceRequest.find({ tenant: req.user.id })
      .populate('unit', 'unitNumber')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/maintenance/:id – manager updates status
router.put('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ message: 'Access denied' });
    const { status } = req.body;
    const request = await MaintenanceRequest.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json({ message: 'Request updated', request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;