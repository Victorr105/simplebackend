// routes/userRoutes.js
import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { authorizaRoles } from '../middlewares/roleMiddleware.js';
import { 
  getUsers, 
  getOneUser, 
  createUser, 
  updateUser, 
  deleteUser,
  getUsersByRole,
  getTenantsByProperty,
  getMyProfile
} from '../controllers/userController.js';

const router = express.Router();

// Test routes for role-based access
router.get("/admin", verifyToken, authorizaRoles("admin"), (req, res) => {
    res.json({ message: `Welcome admin` });
});

router.get("/manager", verifyToken, authorizaRoles("admin", "manager"), (req, res) => {
    res.json({ message: `Welcome manager` });
});

router.get("/user", verifyToken, authorizaRoles("admin", "manager", "user"), (req, res) => {
    res.json({ message: `Welcome user` });
});

// ✅ GET OWN PROFILE (for tenants)
router.get("/me", verifyToken, getMyProfile);

// User management routes (admin only)
router.get("/by-role/:role", verifyToken, authorizaRoles("admin"), getUsersByRole);
router.get("/by-property/:propertyId", verifyToken, authorizaRoles("admin"), getTenantsByProperty);
router.get("/getUsers", verifyToken, authorizaRoles("admin"), getUsers);
router.get("/getOneUser/:id", verifyToken, authorizaRoles("admin"), getOneUser);
router.post("/create", verifyToken, authorizaRoles("admin"), createUser);
router.put("/update/:id", verifyToken, authorizaRoles("admin"), updateUser);
router.delete("/delete/:id", verifyToken, authorizaRoles("admin"), deleteUser);

export default router;