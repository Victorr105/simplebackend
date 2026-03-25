// routes/unitRoutes.js
import express from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizaRoles } from "../middlewares/roleMiddleware.js";
import {
  createUnit,
  getPropertyUnits,
  updateUnit,
  deleteUnit,
  assignTenantToUnit,
  removeTenantFromUnit,
  getAvailableTenants,
  getUnitTenant,
  getVacantUnits,
  getUnitsForTenant,
  getUnitsForManager
} from "../controllers/unitController.js";

const router = express.Router();

// ✅ PUBLIC ROUTE FOR TENANTS - MUST COME BEFORE OTHER ROUTES
router.get(
  "/properties/:propertyId/units-public",
  verifyToken,
  getUnitsForTenant
);

// Get available tenants (admin only)
router.get(
  "/tenants/available",
  verifyToken,
  authorizaRoles("admin"),
  getAvailableTenants
);

// Get vacant units for a property (admin only)
router.get(
  "/properties/:propertyId/units/vacant",
  verifyToken,
  authorizaRoles("admin"),
  getVacantUnits
);

// Unit routes (admin only)
router.post(
  "/properties/:propertyId/units",
  verifyToken,
  authorizaRoles("admin"),
  createUnit
);

router.get(
  "/properties/:propertyId/units",
  verifyToken,
  authorizaRoles("admin"),
  getPropertyUnits
);

// Tenant assignment routes (admin only)
router.post(
  "/properties/:propertyId/units/:unitId/assign-tenant",
  verifyToken,
  authorizaRoles("admin"),
  assignTenantToUnit
);

router.delete(
  "/properties/:propertyId/units/:unitId/remove-tenant",
  verifyToken,
  authorizaRoles("admin"),
  removeTenantFromUnit
);

router.get(
  "/properties/:propertyId/units/:unitId/tenant",
  verifyToken,
  authorizaRoles("admin"),
  getUnitTenant
);

// Unit CRUD (admin only)
router.put(
  "/properties/:propertyId/units/:unitId",
  verifyToken,
  authorizaRoles("admin"),
  updateUnit
);

router.delete(
  "/properties/:propertyId/units/:unitId",
  verifyToken,
  authorizaRoles("admin"),
  deleteUnit
);
// Get units for a property (managers only)
router.get(
  "/manager/properties/:propertyId/units",
  verifyToken,
  authorizaRoles("manager"),
  getUnitsForManager
);

export default router;