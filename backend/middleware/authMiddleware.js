const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

module.exports = function (req, res, next) {
  // Get token from the HTTP Authorization header (Format: Bearer <token>)
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  // If there's no token, block access
  if (!token) {
    return res.status(401).json({ message: "Access denied. No session token provided." });
  }

  try {
    // Verify token validity
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach the user metadata (userId) to the request object
    req.user = decoded; 
    
    next(); // Move on to the actual chat routing logic
  } catch (err) {
    res.status(401).json({ message: "Session expired or invalid token." });
  }
};