import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bycrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMW from "../middlewares/auth-mw.js";

/* 계정 라우터 생성 */
const router = express.Router();

/* 회원가입 API */
router.post("/account/signup", async (req, res, next) => {
  // body 정보 수령
  const { id, pw, pwCheck, name } = req.body;
  // 필수 입력값 검사
  for (let prop of [id, pw, pwCheck, name]) {
    if (prop === undefined) {
      return res.status(400).json({ message: `필수 정보가 입력되지 않았수!!` });
    } else if (typeof prop !== "string") {
      return res.status(400).json({ message: `문자 형식으로 입력하슈!!` });
    }
  }
  // 유효성 검사 01 : 중복 아이디
  const check_id_isExist = await prisma.accounts.findFirst({
    where: { id },
  });
  if (check_id_isExist) {
    return res.status(409).json({ message: "이미 사용된 아이디!!" });
  }
  // 유효성 검사 02 : 아이디 양식
  const check_id_isRightForm = /^[a-z0-9]+$/.test(id);
  if (!check_id_isRightForm) {
    return res.status(400).json({ message: "영어 소문자와 숫자만 가능!!" });
  }
  // 유효성 검사 03 : 비밀번호 양식
  if (pw.length < 6) {
    return res.status(400).json({ message: "비번은 6자리 이상!!" });
  }
  // 유효성 검사 04 : 비밀번호 확인
  if (pw !== pwCheck) {
    return res.status(400).json({ message: "비번과 비번확인이 불일치!!" });
  }
  // 비밀번호 bycrpt 암호화
  const hashedPw = await bycrypt.hash(pw, 5);
  // 계정 테이블에 회원 정보 생성
  await prisma.accounts.create({
    data: {
      id,
      pw: hashedPw,
      name,
    },
  });
  // 응답할 회원 정보 조회
  const signupRes = await prisma.accounts.findFirst({
    where: { id: id },
    select: {
      id: true,
      name: true,
      signupAt: true,
    },
  });
  // 회원 가입 성공 응답
  return res.status(201).json({ data: signupRes });
});

/* 라우터 내보내기 */
export default router;
