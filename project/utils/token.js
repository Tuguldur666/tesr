const jwt = require('jsonwebtoken');

function verifyToken(accessToken) {
  try {
    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    return { userId: decoded.id, isAdmin: decoded.isAdmin,error: null };
  } catch (error) {
    return { userId: null, error: 'Invalid or expired access token' };
  }
}


module.exports = {verifyToken}