// firebase.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // Replace with your actual file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://university-bot-59fdd.firebaseio.com", // Replace with your Firebase database URL
});

const db = admin.firestore();
module.exports = db;
