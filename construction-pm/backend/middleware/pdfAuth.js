const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'navyakar_jwt_secret_2026';

module.exports = function pdfAuthMiddleware(req, res, next) {
    // Accept token from Authorization header OR ?token= query param
    const header = req.headers.authorization;
    const queryToken = req.query.token;
    const token = (header && header.startsWith('Bearer ')) ?
        header.slice(7) :
        queryToken;

    if (!token) return res.status(401).json({ error: 'Unauthorized — please login' });

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Session expired — please login again' });
    }
};