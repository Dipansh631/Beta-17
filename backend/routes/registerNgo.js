import { getMongoDB } from '../config/mongodb.js';
import dotenv from 'dotenv';

dotenv.config();

// Use MongoDB for NGO registration instead of Firestore

const registerNgo = async (req, res) => {
  try {
    // Check if MongoDB is available
    const mongoDB = getMongoDB();
    if (!mongoDB || !mongoDB.db) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB not connected. Please check MongoDB connection and Atlas IP whitelist.',
      });
    }

    const {
      uid,
      profile,
      details,
      conditions,
      profilePhotoUrl,
    } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'User ID (uid) is required',
      });
    }

    if (!profile || !details) {
      return res.status(400).json({
        success: false,
        message: 'Profile and details are required',
      });
    }

    console.log(`📝 Registering NGO for user: ${uid}`);

    const { db } = mongoDB;

    // Prepare NGO data structure
    const ngoData = {
      _id: uid, // Use uid as document ID
      profile: {
        name: profile.name || '',
        dob: profile.dob || '',
        gender: profile.gender || '',
        address: profile.address || '',
        id_number: profile.id_number || '',
        id_type: profile.id_type || '',
        verified: true,
        profile_photo_url: profilePhotoUrl || '',
      },
      details: {
        ngo_name: details.ngo_name || '',
        description: details.description || '',
        donation_category: details.donation_category || '',
        contact_email: details.contact_email || '',
        contact_phone: details.contact_phone || '',
      },
      conditions: conditions && Array.isArray(conditions) ? conditions.map((condition, index) => ({
        title: condition.title || '',
        description: condition.description || '',
        fund_estimate: condition.fund_estimate || 0,
        priority: condition.priority || 'Medium',
        order: index,
      })) : [],
      status: 'pending_verification',
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Save to MongoDB
    const ngosCollection = db.collection('ngos');
    await ngosCollection.updateOne(
      { _id: uid },
      { $set: ngoData },
      { upsert: true } // Create if doesn't exist, update if exists
    );

    console.log(`✅ Saved NGO registration with ${ngoData.conditions.length} conditions`);

    console.log('✅ NGO registered successfully in MongoDB');

    res.json({
      success: true,
      message: 'NGO registered successfully',
      data: {
        uid,
        status: 'pending_verification',
      },
    });
  } catch (error) {
    console.error('❌ Error in registerNgo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register NGO',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

export default registerNgo;

