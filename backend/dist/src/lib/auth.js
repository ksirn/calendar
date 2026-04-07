"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.generateToken = generateToken;
exports.createSession = createSession;
exports.getUserByToken = getUserByToken;
exports.normalizeUsername = normalizeUsername;
exports.validateUsername = validateUsername;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("./prisma"));
async function hashPassword(password) {
    return bcrypt_1.default.hash(password, 10);
}
async function verifyPassword(password, hash) {
    return bcrypt_1.default.compare(password, hash);
}
function generateToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
async function createSession(userId) {
    const token = generateToken();
    await prisma_1.default.session.create({
        data: {
            userId,
            token,
        },
    });
    return token;
}
async function getUserByToken(token) {
    if (!token)
        return null;
    const session = await prisma_1.default.session.findUnique({
        where: { token },
        include: { user: true },
    });
    return session?.user ?? null;
}
function normalizeUsername(value) {
    return value.trim().toLowerCase();
}
function validateUsername(value) {
    return /^[a-z0-9_.]{3,20}$/.test(value);
}
