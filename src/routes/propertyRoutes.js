import express from "express";
import {
  createProperty,
  getMyProperties,
  getOneProperty,
  updateProperty,
  deleteProperty,
  assignManager,
  removeManager,
  getAvailableManagers,
  getPropertyForTenant,
  getManagerProperties,
  upload,
  uploadPropertyImage
} from "../controllers/propertyController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizaRoles } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// ✅ PUBLIC ROUTE FOR TENANTS
router.get(
  "/properties/:id",
  verifyToken,
  getPropertyForTenant
);

// Property CRUD routes (admin only)
router.post(
  "/admin/properties",
  verifyToken,
  authorizaRoles("admin"),
  createProperty
);

router.get(
  "/admin/properties",
  verifyToken,
  authorizaRoles("admin"),
  getMyProperties
);

router.get(
  "/admin/properties/:id",
  verifyToken,
  authorizaRoles("admin"),
  getOneProperty
);

router.put(
  "/admin/properties/:id",
  verifyToken,
  authorizaRoles("admin"),
  updateProperty
);

router.delete(
  "/admin/properties/:id",
  verifyToken,
  authorizaRoles("admin"),
  deleteProperty
);

// Image upload route (admin only)
router.post(
  "/admin/properties/:id/upload-image",
  verifyToken,
  authorizaRoles("admin"),
  upload.single("image"),
  uploadPropertyImage
);

// Manager routes (admin only)
router.get(
  "/admin/managers/available",
  verifyToken,
  authorizaRoles("admin"),
  getAvailableManagers
);

router.post(
  "/admin/properties/:id/assign-manager",
  verifyToken,
  authorizaRoles("admin"),
  assignManager
);

router.delete(
  "/admin/properties/:id/remove-manager",
  verifyToken,
  authorizaRoles("admin"),
  removeManager
);

// Get properties assigned to manager (managers only)
router.get(
  "/manager/properties",
  verifyToken,
  authorizaRoles("manager"),
  getManagerProperties
);

export default router;