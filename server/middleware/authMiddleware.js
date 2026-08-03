import jwt from 'jsonwebtoken';

export const protectAdmin = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no admin token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'farm_fusion_ai_super_secret_jwt_key_2026_green_tech');
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token validation failed' });
  }
};
