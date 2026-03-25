import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema(
    {
        propertyName: {
            type: String,
            required: true,
            trim: true,
        },
        propertyOwner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        manager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        numberOfUnits: {
            type: Number,
            required: true,
        },
        imageUrl: {
            type: String,
            default: '',
        }
    },
    {
        timestamps: true,
    }
);

const Property = mongoose.model("Property", propertySchema);
export default Property;