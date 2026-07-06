// ── Firebase Configuration ───────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyB1o2QZ-9c3i7Lrm3TSeN9k9GVqXLmoIoA",
  authDomain: "researchhq-lc.firebaseapp.com",
  projectId: "researchhq-lc",
  storageBucket: "researchhq-lc.firebasestorage.app",
  messagingSenderId: "684959539704",
  appId: "1:684959539704:web:64b96499e08c4ddd36b60d",
  measurementId: "G-T5NX3J4C19"
};

firebase.initializeApp(firebaseConfig);

const db   = firebase.firestore();
const auth = firebase.auth();
const DOC  = db.collection('researchhq').doc('main');
