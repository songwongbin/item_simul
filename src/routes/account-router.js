import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bycrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import authMW from "../middlewares/auth-mw.js";

/* 계정 라우터 생성 */
const router = express.Router();

/* env로 숨긴 정보 가져오기 */
dotenv.config();
const ATSK = process.env.ATSK; // access 토큰 비밀 키 가져옴

/* 회원가입 API */
router.post("/accounts/signUp", async (req, res, next) => {
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
  const isIdExist = await prisma.accounts.findFirst({
    where: { id },
  });
  if (isIdExist) {
    return res.status(409).json({ message: "이미 사용된 아이디!!" });
  }
  // 유효성 검사 02 : 아이디 양식
  const isIdRightForm = /^[a-z0-9]+$/.test(id);
  if (!isIdRightForm) {
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
  const createdAccount = await prisma.accounts.findFirst({
    where: { id: id },
    select: {
      id: true,
      name: true,
      signupAt: true,
    },
  });
  // 회원 가입 성공 응답
  return res.status(201).json({ data: createdAccount });
});

/* 로그인 API */
router.post("/accounts/signIn", async (req, res, next) => {
  const { id, pw } = req.body; // body 정보 수령
  // 유효성 검사 01 : 가입된 계정 맞는지 체크
  const account = await prisma.accounts.findFirst({
    where: { id },
  });
  if (!account) {
    return res.status(401).json({ message: "존재하지 않는 아이디여!!" });
  }
  // 유효성 검사 02 : 비밀번호 맞는지 체크
  const checkPw = await bycrypt.compare(pw, account.pw);
  if (!checkPw) {
    return res.status(401).json({ message: "비밀번호 틀렸슈!!" });
  }
  // 암호화된 access 토큰 발급 (완성 후 만료 기한 줄이기!!!)
  const accessToken = jwt.sign({ id }, ATSK, { expiresIn: "60m" });
  // authorization 헤더로 Bearer 타입의 토큰 응답
  res.setHeader("authorization", `Bearer ${accessToken}`);
  // 로그인 성공 응답
  return res.status(200).json({ message: "로그인 성공!!" });
});

/* 라우터 내보내기 */
export default router;
