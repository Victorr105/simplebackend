// models/userModel.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true,
        enum: ["admin", "manager", "user"],
    },
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        default: null // For users with role "user" (tenants) AND "manager"
    }
}, {
    timestamps: true,
});

const User = mongoose.model("User", userSchema);
export default User;