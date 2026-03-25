// src/config/dbConnection.js
import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

const mongo_uri = process.env.MONGO_URI;

// Create a function to handle db connection 
async function databaseConnection() {
    try {
        await mongoose.connect(mongo_uri);
        console.log(`✅ Database connection successful`);
    } catch (error) {
        console.error(`❌ Error connecting with the database:`, error.message);
        // Don't just log, exit if critical
        process.exit(1);
    }
}

export { databaseConnection };