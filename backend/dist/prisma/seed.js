"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../src/lib/prisma"));
async function main() {
    const passwordHash = await bcrypt_1.default.hash('temp12345', 10);
    const users = [
        {
            username: 'misha',
            name: 'Миша',
            passwordHash,
        },
        {
            username: 'artem',
            name: 'Артём',
            passwordHash,
        },
        {
            username: 'sanya',
            name: 'Саня',
            passwordHash,
        },
    ];
    for (const user of users) {
        const existing = await prisma_1.default.user.findUnique({
            where: { username: user.username },
        });
        if (!existing) {
            await prisma_1.default.user.create({
                data: user,
            });
        }
    }
    console.log('Seed completed');
}
main()
    .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
