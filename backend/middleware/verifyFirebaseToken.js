// backend/middleware/verifyFirebaseToken.js
const admin = require("../firebaseAdmin");

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // decoded contains: uid, email, phone_number, name, picture etc
    req.firebaseUser = decoded;
    next();
  } catch (err) {
    console.error("verifyFirebaseToken error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = verifyFirebaseToken;
