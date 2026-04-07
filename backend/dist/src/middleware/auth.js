"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const auth_1 = require("../lib/auth");
async function authMiddleware(req, res, next) {
    try {
        const token = req.cookies?.session;
        const user = await (0, auth_1.getUserByToken)(token);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error('authMiddleware error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
