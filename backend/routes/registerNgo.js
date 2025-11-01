import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (Optional - won't crash if missing)
let db = null;
try {
  if (!admin.apps.length) {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                               path.join(__dirname, '..', 'serviceAccountKey.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      db = admin.firestore();
      console.log('✅ Firebase Admin initialized with service account');
    } else {
      console.warn('⚠️ Firebase serviceAccountKey.json not found. Firestore features will be disabled.');
      console.warn('   To enable Firestore: Download serviceAccountKey.json from Firebase Console');
    }
  } else {
    db = admin.firestore();
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin initialization failed. Firestore features will be disabled.');
  console.warn('   Error:', error.message);
  db = null;
}

const registerNgo = async (req, res) => {
  try {
    // Check if Firebase is available
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Firestore database not configured. Please set up Firebase serviceAccountKey.json',
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

    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Firebase not initialized. Please configure serviceAccountKey.json',
      });
    }

    console.log(`📝 Registering NGO for user: ${uid}`);

    // Prepare NGO data structure
    const ngoData = {
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
      status: 'pending_verification',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save to Firestore
    const ngoRef = db.collection('ngos').doc(uid);
    await ngoRef.set(ngoData, { merge: true });

    // Save conditions as subcollection
    if (conditions && Array.isArray(conditions) && conditions.length > 0) {
      const conditionsRef = ngoRef.collection('conditions');
      const batch = db.batch();

      conditions.forEach((condition, index) => {
        const conditionRef = conditionsRef.doc();
        batch.set(conditionRef, {
          title: condition.title || '',
          description: condition.description || '',
          fund_estimate: condition.fund_estimate || 0,
          priority: condition.priority || 'Medium',
          order: index,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      console.log(`✅ Saved ${conditions.length} conditions`);
    }

    console.log('✅ NGO registered successfully');

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

