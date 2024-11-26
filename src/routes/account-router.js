import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bycrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMW from "../middlewares/auth-mw.js";

/* 계정 라우터 생성 */
const router = express.Router();

export default router;
