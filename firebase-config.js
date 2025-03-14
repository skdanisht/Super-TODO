// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyBVf8aAxzUFsQXXjIMjjpPSGJFDgmtQHXU",
  authDomain: "todo-be6fb.firebaseapp.com",
  projectId: "todo-be6fb",
  storageBucket: "todo-be6fb.firebasestorage.app",
  messagingSenderId: "844080666799",
  appId: "1:844080666799:web:2b1a22d82993c07d585c5a",
  measurementId: "G-8B1ERE2FXH"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();