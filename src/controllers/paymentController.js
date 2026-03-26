// src/controllers/paymentController.js
import mpesaService from '../services/mpesaService.js';
import Payment from '../models/paymentModel.js';
import Unit from '../models/unitModel.js';
import User from '../models/userModel.js';
import Property from '../models/propertyModel.js';

// Enable test mode - set to true to bypass M-Pesa for testing
// Set to false when you get working M-Pesa credentials
const TEST_MODE = false;

// Initiate STK Push payment
export const initiatePayment = async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;
    const tenantId = req.user.id;

    console.log("========================================");
    console.log("💰 Payment Initiation Request");
    console.log("  - Amount:", amount);
    console.log("  - Phone:", phoneNumber);
    console.log("  - Tenant ID:", tenantId);
    console.log("  - Test Mode:", TEST_MODE);
    console.log("========================================");

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Amount must be greater than 0" 
      });
    }

    // Get tenant details
    const tenant = await User.findById(tenantId);
    if (!tenant || tenant.role !== 'user') {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Find tenant's unit
    const unit = await Unit.findOne({ tenant: tenantId }).populate('property');
    if (!unit) {
      return res.status(404).json({ message: 'No unit assigned to this tenant' });
    }

    if (!unit.property) {
      return res.status(404).json({ message: 'Property not found for this unit' });
    }

    // TEST MODE - Bypass M-Pesa
    if (TEST_MODE) {
      console.log("🧪 TEST MODE: Simulating payment success");
      
      const payment = await Payment.create({
        tenant: tenantId,
        unit: unit._id,
        property: unit.property._id,
        amount: Math.round(amount),
        phoneNumber,
        status: 'completed',
        transactionId: `TEST-${Date.now()}`,
        mpesaReceiptNumber: `TEST${Math.random().toString(36).substring(7).toUpperCase()}`,
        resultDesc: 'Test payment successful',
        paymentDate: new Date(),
        accountReference: `TEST-${unit.unitNumber}`,
        transactionDesc: `Test payment for Unit ${unit.unitNumber}`
      });

      console.log("✅ Test payment created:", {
        id: payment._id,
        amount: payment.amount,
        receipt: payment.mpesaReceiptNumber
      });

      return res.status(200).json({
        success: true,
        message: '🧪 TEST MODE: Payment successful! (No real money deducted)',
        data: {
          paymentId: payment._id,
          transactionId: payment.transactionId,
          amount: payment.amount,
          receipt: payment.mpesaReceiptNumber
        }
      });
    }

    // REAL M-PESA CODE - Only runs when TEST_MODE is false
    // Create payment record
    const payment = await Payment.create({
      tenant: tenantId,
      unit: unit._id,
      property: unit.property._id,
      amount: Math.round(amount),
      phoneNumber,
      accountReference: `RENT-${unit.unitNumber}`,
      transactionDesc: `Rent payment for Unit ${unit.unitNumber}`
    });

    // Callback URL (your ngrok or production URL)
    const baseUrl = process.env.BASE_URL || 'http://localhost:8005';
    const callbackUrl = `${baseUrl}/api/payments/mpesa-callback`;

    console.log("📡 Initiating real STK Push with callback:", callbackUrl);

    // Initiate STK Push
    const stkResponse = await mpesaService.stkPush(
      phoneNumber,
      amount,
      payment.accountReference,
      payment.transactionDesc,
      callbackUrl
    );

    console.log("✅ STK Response:", stkResponse);

    // Update payment with M-Pesa request IDs
    payment.checkoutRequestID = stkResponse.CheckoutRequestID;
    payment.merchantRequestID = stkResponse.MerchantRequestID;
    await payment.save();

    res.status(200).json({
      success: true,
      message: 'STK Push initiated. Check your phone to complete payment.',
      data: {
        checkoutRequestID: stkResponse.CheckoutRequestID,
        merchantRequestID: stkResponse.MerchantRequestID,
        paymentId: payment._id
      }
    });

  } catch (error) {
    console.error('❌ Payment initiation error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to initiate payment' 
    });
  }
};

// M-Pesa callback handler
export const mpesaCallback = async (req, res) => {
  try {
    console.log('📞 M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

    const { Body } = req.body;
    
    if (!Body || !Body.stkCallback) {
      return res.status(400).json({ message: 'Invalid callback data' });
    }

    const { stkCallback } = Body;
    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    } = stkCallback;

    // Find payment by CheckoutRequestID
    const payment = await Payment.findOne({ checkoutRequestID: CheckoutRequestID });
    
    if (!payment) {
      console.error('Payment not found for CheckoutRequestID:', CheckoutRequestID);
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Update payment status
    payment.resultCode = ResultCode;
    payment.resultDesc = ResultDesc;
    payment.status = ResultCode === 0 ? 'completed' : 'failed';

    // If successful, extract metadata
    if (ResultCode === 0 && CallbackMetadata && CallbackMetadata.Item) {
      const metadata = CallbackMetadata.Item;
      
      metadata.forEach(item => {
        switch (item.Name) {
          case 'Amount':
            payment.amount = item.Value;
            break;
          case 'MpesaReceiptNumber':
            payment.mpesaReceiptNumber = item.Value;
            payment.transactionId = item.Value;
            break;
          case 'TransactionDate':
            payment.paymentDate = new Date(item.Value.toString().substring(0, 4) + '-' +
                                          item.Value.toString().substring(4, 6) + '-' +
                                          item.Value.toString().substring(6, 8) + 'T' +
                                          item.Value.toString().substring(8, 10) + ':' +
                                          item.Value.toString().substring(10, 12) + ':' +
                                          item.Value.toString().substring(12, 14));
            break;
          case 'PhoneNumber':
            payment.phoneNumber = item.Value;
            break;
        }
      });
    }

    await payment.save();

    console.log(`✅ Payment ${payment.status} for CheckoutRequestID: ${CheckoutRequestID}`);

    // Always respond with success to M-Pesa
    res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Callback received successfully" 
    });

  } catch (error) {
    console.error('❌ Callback processing error:', error);
    // Still return 200 to acknowledge receipt
    res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Callback received" 
    });
  }
};

// Get tenant payment history
export const getPaymentHistory = async (req, res) => {
  try {
    const tenantId = req.user.id;
    
    const payments = await Payment.find({ tenant: tenantId })
      .populate('unit', 'unitNumber')
      .populate('property', 'propertyName')
      .sort({ createdAt: -1 });

    res.status(200).json(payments);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
};

// Get all payments (admin only)
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('tenant', 'username')
      .populate('unit', 'unitNumber')
      .populate('property', 'propertyName')
      .sort({ createdAt: -1 });

    res.status(200).json(payments);
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({ message: 'Failed to fetch payments' });
  }
};

// Query transaction status
export const queryPaymentStatus = async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;
    const result = await mpesaService.queryStatus(checkoutRequestID);
    
    // Update the payment record with status and receipt number
    const payment = await Payment.findOne({ checkoutRequestID });
    if (payment) {
      payment.status = result.status; // 'completed', 'cancelled', 'failed'
      if (result.MpesaReceiptNumber) {
        payment.mpesaReceiptNumber = result.MpesaReceiptNumber;
      }
      await payment.save();
    }
    
    res.json({ payment: { status: result.status } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to query payment status' });
  }
};

// ============ NEW FUNCTIONS FOR DUE DATES & OVERDUE ============

// Calculate payment status for a unit
export const getUnitPaymentStatus = async (req, res) => {
  try {
    const { unitId } = req.params;
    
    const unit = await Unit.findById(unitId).populate('property', 'propertyName');
    if (!unit) {
      return res.status(404).json({ message: "Unit not found" });
    }
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // Get current month's payments for this unit
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
    
    const payments = await Payment.find({
      unit: unitId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      status: 'completed'
    });
    
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const isPaid = totalPaid >= unit.rent;
    
    // Calculate due date for current month
    const dueDay = unit.dueDay || 5;
    const gracePeriod = unit.gracePeriod || 3;
    const dueDate = new Date(currentYear, currentMonth, dueDay);
    const graceEndDate = new Date(currentYear, currentMonth, dueDay + gracePeriod);
    
    let status = 'paid';
    let lateFee = 0;
    
    if (!isPaid) {
      if (currentDate > dueDate) {
        status = 'overdue';
        if (currentDate > graceEndDate) {
          lateFee = unit.lateFee || 500;
        }
      } else {
        status = 'due';
      }
    }
    
    // Get the latest receipt if available
    const latestPayment = payments[payments.length - 1];
    
    res.json({
      unitId: unit._id,
      unitNumber: unit.unitNumber,
      propertyName: unit.property?.propertyName,
      rent: unit.rent,
      paidAmount: totalPaid,
      remainingAmount: Math.max(0, unit.rent - totalPaid),
      status,
      dueDate,
      dueDay,
      graceEndDate,
      lateFee,
      isLate: currentDate > dueDate,
      daysOverdue: currentDate > dueDate ? Math.floor((currentDate - dueDate) / (1000 * 60 * 60 * 24)) : 0,
      receipt: latestPayment?.mpesaReceiptNumber || null
    });
    
  } catch (error) {
    console.error("Error getting payment status:", error);
    res.status(500).json({ message: "Failed to get payment status" });
  }
};

// Get all overdue units
export const getOverdueUnits = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    const units = await Unit.find({ 
      tenant: { $ne: null },
      status: "occupied"
    }).populate('tenant', 'username email phone')
      .populate('property', 'propertyName');
    
    const overdueUnits = [];
    
    for (const unit of units) {
      const dueDay = unit.dueDay || 5;
      const dueDate = new Date(currentYear, currentMonth, dueDay);
      
      // Get current month's payments
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const payments = await Payment.find({
        unit: unit._id,
        createdAt: { $gte: startOfMonth },
        status: 'completed'
      });
      
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      
      if (totalPaid < unit.rent && currentDate > dueDate) {
        const daysOverdue = Math.floor((currentDate - dueDate) / (1000 * 60 * 60 * 24));
        const gracePeriod = unit.gracePeriod || 3;
        const lateFee = daysOverdue > gracePeriod ? (unit.lateFee || 500) : 0;
        
        overdueUnits.push({
          unit: {
            _id: unit._id,
            unitNumber: unit.unitNumber,
            propertyName: unit.property?.propertyName,
            tenant: unit.tenant,
            rent: unit.rent,
            dueDay: unit.dueDay,
            lateFee: unit.lateFee,
            gracePeriod: unit.gracePeriod
          },
          rent: unit.rent,
          paidAmount: totalPaid,
          remainingAmount: unit.rent - totalPaid,
          daysOverdue,
          dueDate,
          lateFee
        });
      }
    }
    
    // Sort by days overdue (most overdue first)
    overdueUnits.sort((a, b) => b.daysOverdue - a.daysOverdue);
    
    res.json(overdueUnits);
  } catch (error) {
    console.error("Error getting overdue units:", error);
    res.status(500).json({ message: "Failed to get overdue units" });
  }
};

// Update unit due date settings (admin only)
export const updateUnitDueSettings = async (req, res) => {
  try {
    const { unitId } = req.params;
    const { dueDay, lateFee, gracePeriod } = req.body;
    
    const unit = await Unit.findById(unitId);
    if (!unit) {
      return res.status(404).json({ message: "Unit not found" });
    }
    
    if (dueDay !== undefined) {
      if (dueDay < 1 || dueDay > 28) {
        return res.status(400).json({ message: "Due day must be between 1 and 28" });
      }
      unit.dueDay = dueDay;
    }
    
    if (lateFee !== undefined) {
      if (lateFee < 0) {
        return res.status(400).json({ message: "Late fee cannot be negative" });
      }
      unit.lateFee = lateFee;
    }
    
    if (gracePeriod !== undefined) {
      if (gracePeriod < 0) {
        return res.status(400).json({ message: "Grace period cannot be negative" });
      }
      unit.gracePeriod = gracePeriod;
    }
    
    await unit.save();
    
    res.json({
      message: "Unit settings updated successfully",
      unit: {
        _id: unit._id,
        unitNumber: unit.unitNumber,
        dueDay: unit.dueDay,
        lateFee: unit.lateFee,
        gracePeriod: unit.gracePeriod
      }
    });
    
  } catch (error) {
    console.error("Error updating unit settings:", error);
    res.status(500).json({ message: "Failed to update unit settings" });
  }
};