// src/routes/paymentRoutes.js
import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { authorizaRoles } from '../middlewares/roleMiddleware.js';
import {
  initiatePayment,
  mpesaCallback,
  getPaymentHistory,
  getAllPayments,
  queryPaymentStatus,
  getUnitPaymentStatus,
  getOverdueUnits

} from '../controllers/paymentController.js';

const router = express.Router();

// Public callback endpoint (M-Pesa calls this)
router.post('/mpesa-callback', mpesaCallback);

// Protected routes
router.post('/initiate', verifyToken, authorizaRoles('user'), initiatePayment);
router.get('/history', verifyToken, authorizaRoles('user'), getPaymentHistory);
router.get('/status/:checkoutRequestID', verifyToken, queryPaymentStatus);

// Admin routes
router.get('/admin/all', verifyToken, authorizaRoles('admin'), getAllPayments);
// Get payment status for a unit
router.get(
  "/unit-status/:unitId",
  verifyToken,
  getUnitPaymentStatus
);

// Get all overdue units (admin only)
router.get(
  "/overdue",
  verifyToken,
  authorizaRoles("admin"),
  getOverdueUnits
);
export default router;