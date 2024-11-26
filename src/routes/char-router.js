import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bycrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMW from "../middlewares/auth-mw.js";

/* 캐릭터 라우터 생성 */
const router = express.Router();

/* 라우터 내보내기 */
export default router;
