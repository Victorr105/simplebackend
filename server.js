//dependancies
import express from 'express';
import dotenv from 'dotenv';/*dotenv configuration*/ dotenv.config();
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { databaseConnection } from './src/config/dbConnection.js';

//routes
import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import propertyRoutes from './src/routes/propertyRoutes.js';
import unitRoutes from './src/routes/unitRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import maintenanceRoutes from './src/routes/maintenance.js';
// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//getting from .env file
const port = process.env.PORT || 8000;
console.log(`Server will run on port: ${port}`);

//create express app
const app = express();

// 🔴 IMPORTANT: Order matters! CORS should come BEFORE routes

// 1. First, setup CORS properly
const corsOptions = {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 2. Then JSON middleware
app.use(express.json());

// 3. Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 4. Debug middleware (optional - helps see incoming requests)
app.use((req, res, next) => {
  console.log(`🔍 Incoming request: ${req.method} ${req.url}`);
  next();
});

// 5. Connect to database
databaseConnection();

// 6. Routes - these should come AFTER middleware
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/units", unitRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Add after other routes
app.use("/api/payments", paymentRoutes);

// 7. Test route
app.use("/testRoute111", (req, res) => {
    res.send("<p>This is the test route</p>");
});

// 8. Start server
app.listen(5000, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
  console.log(`✅ Test route: http://localhost:${port}/testRoute111`);
  console.log(`✅ Auth route: http://localhost:${port}/api/auth/register`);
});