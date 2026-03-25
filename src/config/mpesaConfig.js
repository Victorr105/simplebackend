// src/config/mpesaConfig.js
import dotenv from 'dotenv';
dotenv.config();

export const mpesaConfig = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  passKey: process.env.MPESA_PASSKEY,
  shortCode: process.env.MPESA_SHORTCODE,
  environment: process.env.MPESA_ENV || 'sandbox', // 'sandbox' or 'production'
  
  // URLs
  get authUrl() {
    return this.environment === 'sandbox' 
      ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  },
  
  get stkUrl() {
    return this.environment === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
  },
  
  get queryUrl() {
    return this.environment === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query'
      : 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query';
  }
};