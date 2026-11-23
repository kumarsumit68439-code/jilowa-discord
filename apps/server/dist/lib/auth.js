import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import service from '../service.mjs';
const appInput = service.input();
const JWT_SECRET = appInput.jwtSecret.expose();
const JWT_EXPIRES = appInput.jwtExpires || '7d';
export function signToken(user) {
    return jwt.sign({
        sub: user.id,
        email: user.email,
        username: user.username,
        discriminator: user.discriminator,
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}
export function verifyToken(token) {
    try {
        const p = jwt.verify(token, JWT_SECRET);
        if (!p.sub || !p.email)
            return null;
        return {
            id: String(p.sub),
            email: String(p.email),
            username: String(p.username || ''),
            discriminator: String(p.discriminator || '0000'),
        };
    }
    catch {
        return null;
    }
}
export async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}
export async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}
export async function nextDiscriminator(username) {
    const rows = await prisma.orm.public.User.select('discriminator').where((u) => u.username.ilike(username));
    const existing = await rows.all();
    const used = new Set(existing.map((e) => e.discriminator));
    for (let i = 1; i <= 9999; i++) {
        const d = String(i).padStart(4, '0');
        if (!used.has(d))
            return d;
    }
    throw new Error('No discriminators left for this username');
}
/** Ensures req.user is set; use after this for authenticated routes */
export const requireAuth = (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const user = token ? verifyToken(token) : null;
    if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    req.user = user;
    next();
};
export function getUser(req) {
    if (!req.user)
        throw new Error('requireAuth missing');
    return req.user;
}
export function socketUserFromToken(token) {
    if (!token)
        return null;
    return verifyToken(token);
}
