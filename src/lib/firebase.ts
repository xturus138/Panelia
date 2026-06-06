import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAYQQxvBnDG4p3EtatXWs4qPAyeudQ9Tks",
  authDomain: "panelia-8501b.firebaseapp.com",
  projectId: "panelia-8501b",
  storageBucket: "panelia-8501b.firebasestorage.app",
  messagingSenderId: "1074523854004",
  appId: "1:1074523854004:web:d14a5c5524910aa71f33e1",
  measurementId: "G-TM00Q3PG70"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export { app, db };
