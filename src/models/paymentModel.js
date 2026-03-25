// src/models/paymentModel.js
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  mpesaReceiptNumber: String,
  checkoutRequestID: String,
  merchantRequestID: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  resultCode: Number,
  resultDesc: String,
  paymentDate: Date,
  paymentMethod: {
    type: String,
    default: 'mpesa'
  },
  accountReference: String,
  transactionDesc: String
}, {
  timestamps: true
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;