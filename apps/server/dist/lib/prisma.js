import service from "../service.mjs";
const { db } = service.load();
export const prisma = db.client;
