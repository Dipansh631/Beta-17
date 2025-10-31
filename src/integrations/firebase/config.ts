import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDy2JM3XTAa-R81sdCNHcjJEo_JNamyWwU",
  authDomain: "beta-17.firebaseapp.com",
  projectId: "beta-17",
  storageBucket: "beta-17.appspot.com",
  messagingSenderId: "167579724779",
  appId: "1:167579724779:web:dfcfee56b0179aa00cc7ae",
  measurementId: "G-SRXKHPXQHY"
};

// Initialize Firebase - prevent duplicate initialization
let app: FirebaseApp;
try {
  const existingApps = getApps();
  app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase app initialization error:', error);
  // Try to get existing app or reinitialize
  try {
    app = getApps()[0] || initializeApp(firebaseConfig);
  } catch (retryError) {
    console.error('Firebase app initialization retry failed:', retryError);
    throw retryError;
  }
}

// Initialize Firebase Authentication and get a reference to the service
let auth: Auth;
try {
  auth = getAuth(app);
} catch (error) {
  console.error('Firebase Auth initialization error:', error);
  // Try to get auth instance anyway - it may work despite errors
  auth = getAuth(app);
}

export { auth };
export default app;

