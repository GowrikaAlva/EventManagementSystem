const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // Grab standard header structure "Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Not authorized. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "valora_fallback_secret_key");
    req.user = decoded; // { id, role, email }
    req.orgId = decoded.orgId; // add this line
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Not authorized. Invalid token." });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({ success: false, error: "Not authorized as an admin." });
  }
};

module.exports = { authMiddleware, adminMiddleware };
