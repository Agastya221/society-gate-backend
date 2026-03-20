import admin from 'firebase-admin';
import logger from '../utils/logger';

let firebaseAvailable = false;

const getFirebaseAdmin = (): admin.app.App | null => {
  // Guard against double-initialization
  if (admin.apps.length > 0) {
    firebaseAvailable = true;
    return admin.apps[0]!;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled');
      return null;
    }

    const app = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
    });

    firebaseAvailable = true;
    logger.info('Firebase Admin SDK initialized successfully');
    return app;
  } catch (error) {
    firebaseAvailable = false;
    logger.error({ error }, 'Firebase Admin SDK initialization failed — push notifications disabled');
    return null;
  }
};

export const isFirebaseAvailable = (): boolean => firebaseAvailable;

export const getMessaging = (): admin.messaging.Messaging => {
  return admin.messaging();
};

// Initialize on import
getFirebaseAdmin();

export { getFirebaseAdmin };
