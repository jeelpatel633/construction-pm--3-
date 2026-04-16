const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'navyakar_jwt_secret_2026';

module.exports = function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized — please login' });
    }
    const token = header.slice(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, username, role, display_name }
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Session expired — please login again' });
    }
};