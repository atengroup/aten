// backend/middleware/verifyFirebaseToken.js
const admin = require("../firebaseAdmin");

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // Fetch full user record (for email, phone, displayName, provider info)
    const userRecord = await admin.auth().getUser(decoded.uid);

    req.firebaseUser = {
      uid: decoded.uid,
      email: decoded.email || userRecord.email || null,
      email_verified: decoded.email_verified || userRecord.emailVerified || false,
      phone_number: decoded.phone_number || userRecord.phoneNumber || null,
      name: decoded.name || userRecord.displayName || null,
      picture: decoded.picture || userRecord.photoURL || null,
      provider: userRecord.providerData || [],
      raw: decoded, // full decoded token if needed
    };

    next();
  } catch (err) {
    console.error("verifyFirebaseToken error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = verifyFirebaseToken;
