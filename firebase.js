const admin = require("firebase-admin");
const fs = require("fs");

// Get the base64-encoded service account key from environment variables
const base64EncodedKey = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// Decode the base64 string to get the JSON key
const jsonKey = Buffer.from(base64EncodedKey, "base64").toString("utf-8");

// Save the decoded JSON to a temporary file
fs.writeFileSync("tempServiceAccountKey.json", jsonKey);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert("tempServiceAccountKey.json"),
  databaseURL: "https://university-bot-59fdd.firebaseio.com", // Replace with your Firebase database URL
});

// Optional: Delete the temporary key file after initializing
fs.unlinkSync("tempServiceAccountKey.json");

const db = admin.firestore();
module.exports = db;
