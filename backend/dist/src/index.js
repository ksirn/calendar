"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const prisma_1 = __importDefault(require("./lib/prisma"));
const auth_1 = __importDefault(require("./routes/auth"));
const connections_1 = __importDefault(require("./routes/connections"));
const events_1 = __importDefault(require("./routes/events"));
const invites_1 = __importDefault(require("./routes/invites"));
const reschedule_1 = __importDefault(require("./routes/reschedule"));
const auth_2 = require("./middleware/auth");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.use('/auth', auth_1.default);
app.get('/users', auth_2.authMiddleware, async (_req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                username: true,
                name: true,
                preferredColor: true,
                createdAt: true,
            },
        });
        res.json(users);
    }
    catch (error) {
        console.error('GET /users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.patch('/users/me/color', auth_2.authMiddleware, async (req, res) => {
    try {
        const userId = String(req.user.id);
        const color = String((req.body ?? {}).preferredColor ?? '').trim();
        if (!color) {
            return res.status(400).json({ error: 'preferredColor is required' });
        }
        const updated = await prisma_1.default.user.update({
            where: { id: userId },
            data: { preferredColor: color },
            select: {
                id: true,
                username: true,
                name: true,
                preferredColor: true,
                createdAt: true,
            },
        });
        return res.json(updated);
    }
    catch (error) {
        console.error('PATCH /users/me/color error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
app.use('/connections', auth_2.authMiddleware, connections_1.default);
app.use('/events', auth_2.authMiddleware, events_1.default);
app.use('/invites', auth_2.authMiddleware, invites_1.default);
app.use('/reschedule', auth_2.authMiddleware, reschedule_1.default);
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
