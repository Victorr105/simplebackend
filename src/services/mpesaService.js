import axios from 'axios';
import { mpesaConfig } from '../config/mpesaConfig.js';
import moment from 'moment';

class MpesaService {
  constructor() {
    this.consumerKey = mpesaConfig.consumerKey;
    this.consumerSecret = mpesaConfig.consumerSecret;
    this.passKey = mpesaConfig.passKey;
    this.shortCode = mpesaConfig.shortCode;
    this.authUrl = mpesaConfig.authUrl;
    this.stkUrl = mpesaConfig.stkUrl;
    this.queryUrl = mpesaConfig.queryUrl;
    
    console.log("========================================");
    console.log("🔧 MpesaService Initialized");
    console.log("  - ShortCode:", this.shortCode);
    console.log("  - Auth URL:", this.authUrl);
    console.log("  - STK URL:", this.stkUrl);
    console.log("  - Consumer Key exists:", !!this.consumerKey);
    console.log("  - Consumer Secret exists:", !!this.consumerSecret);
    console.log("  - PassKey exists:", !!this.passKey);
    console.log("========================================");
  }

  // Generate access token
  async getAccessToken() {
    try {
      console.log("📡 [1/3] Getting access token from Safaricom...");
      
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      console.log("  - Auth header length:", auth.length);
      
      const response = await axios.get(this.authUrl, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      
      console.log("✅ [1/3] Access token received!");
      console.log("  - Token:", response.data.access_token);
      console.log("  - Expires in:", response.data.expires_in, "seconds");
      
      return response.data.access_token;
    } catch (error) {
      console.error('❌ [1/3] Error getting access token:');
      console.error('  - Status:', error.response?.status);
      console.error('  - Data:', error.response?.data);
      console.error('  - Message:', error.message);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  // Generate timestamp and password for STK push
  generateTimestampAndPassword() {
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`).toString('base64');
    
    console.log("  - Timestamp:", timestamp);
    console.log("  - Password length:", password.length);
    
    return { timestamp, password };
  }

  // Initiate STK Push
  async stkPush(phoneNumber, amount, accountReference, transactionDesc, callbackUrl) {
    try {
      console.log("========================================");
      console.log("🚀 [2/3] Initiating STK Push...");
      
      const token = await this.getAccessToken();
      console.log("🔑 Using token:", token.substring(0, 30) + "...");
      
      const { timestamp, password } = this.generateTimestampAndPassword();
      
      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      console.log("📱 Original phone:", phoneNumber);
      console.log("📱 Formatted phone:", formattedPhone);
      console.log("💰 Amount:", amount);
      console.log("🔗 Callback URL:", callbackUrl);
      
      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: accountReference.substring(0, 12),
        TransactionDesc: transactionDesc.substring(0, 13)
      };

      console.log('📤 STK Push Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(this.stkUrl, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ [2/3] STK Push Response:', JSON.stringify(response.data, null, 2));
      console.log("========================================");
      
      return response.data;
      
    } catch (error) {
      console.error('❌ [2/3] STK Push Error:');
      console.error('  - Status:', error.response?.status);
      console.error('  - Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('  - Message:', error.message);
      console.error("========================================");
      
      if (error.response?.data?.errorMessage) {
        throw new Error(error.response.data.errorMessage);
      }
      throw new Error('STK push failed');
    }
  }

  // Query STK Push status (updated with status mapping)
  async queryStatus(checkoutRequestID) {
    try {
      console.log("📡 [3/3] Querying payment status...");
      const token = await this.getAccessToken();
      const { timestamp, password } = this.generateTimestampAndPassword();
      
      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID
      };

      const response = await axios.post(this.queryUrl, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;
      console.log('✅ Query Status Response:', result);

      // Safaricom returns ResponseCode = "0" for successful query.
      if (result.ResponseCode !== "0") {
        // Query itself failed (e.g., invalid token)
        throw new Error(`Query failed: ${result.ResponseDescription}`);
      }

      // Map the ResultCode to our internal status
      let status = 'pending';
      if (result.ResultCode === '0') {
        status = 'completed';
      } else if (result.ResultCode === '1032') {
        status = 'cancelled';
      } else if (result.ResultCode) {
        status = 'failed';
      }

      // Return the original result plus the derived status
      return { status, ...result };
    } catch (error) {
      console.error('❌ Query Status Error:', error.response?.data || error.message);
      throw new Error('Failed to query transaction status');
    }
  }

  // Format phone number to international format
  formatPhoneNumber(phone) {
    // Remove any non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    // If starts with 7, add 254
    else if (cleaned.startsWith('7')) {
      cleaned = '254' + cleaned;
    }
    // If starts with 254, keep as is
    else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    
    return cleaned;
  }
}

export default new MpesaService();