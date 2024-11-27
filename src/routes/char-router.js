import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bycrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMW from "../middlewares/auth-mw.js";

/* 캐릭터 라우터 생성 */
const router = express.Router();

/* 캐릭터 생성 API */
router.post("/chars", authMW, async (req, res, next) => {
  const { name } = req.body;
  const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
  // 검사 01 : 이미 존재하는 캐릭터명
  const isNameExist = await prisma.characters.findFirst({
    where: { name },
  });
  if (isNameExist) {
    return res.status(409).json({ message: "이미 존재하는 캐릭터명이에요!!" });
  }
  // 캐릭터 생성
  const char = await prisma.characters.create({
    data: {
      accountKey, // 계정 테이블과 관계 맺기 위함
      name, // 나머지는 default 설정이 돼있음!
    },
  });
  // 생성 완료 응답
  return res.status(201).json({ data: char.charKey }); // 나는 charKey가 기본 키여요....
});

/* 캐릭터 삭제 API */
router.delete("/chars/:charKey", authMW, async (req, res, next) => {
  const { charKey } = req.params;
  const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
  // 검사 01 : 존재하는 캐릭터인지 확인
  const isCharExist = await prisma.characters.findFirst({
    where: { charKey: +charKey },
  });
  if (!isCharExist) {
    return res.status(409).json({ message: "존재하지 않는 캐릭터에요!!" });
  }
  // 검사 02 : 내 계정의 캐릭터인지 확인
  const isMyChar = await prisma.characters.findFirst({
    where: { charKey: +charKey },
  });
  if (isMyChar.accountKey !== accountKey) {
    return res.status(403).json({ message: "당신 캐릭터가 아녀요!!" });
  }
  // 요청받은 캐릭터 찾아서 삭제
  await prisma.characters.delete({
    where: { charKey: +charKey },
  });
  // 삭제 완료 응답
  return res.status(200).json({ message: "캐릭터 삭제 완료!!" });
});

/* 캐릭터 상세 조회 API */
router.get("/chars/:charKey", authMW, async (req, res, next) => {
  const { charKey } = req.params;
  const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
  // 검사 01 : 존재하는 캐릭터인지 확인
  const isCharExist = await prisma.characters.findFirst({
    where: { charKey: +charKey },
  });
  if (!isCharExist) {
    return res.status(404).json({ message: "존재하지 않는 캐릭터에요!!" });
  }
  // 요청받은 캐릭터 필요한 속성만 추려 가져오기
  const whichChar = await prisma.characters.findFirst({
    where: { charKey: +charKey },
    select: {
      accountKey: true,
      name: true,
      stats: true,
      money: true,
    },
  });
  // 로그인 된 계정의 캐릭터면 money까지, 그 외의 경우라면 money는 제외하고 보여줄 예정
  let showChar;
  if (whichChar.accountKey !== +accountKey) {
    const { accountKey, money, ...copy } = { ...whichChar };
    showChar = copy;
  } else if (whichChar.accountKey === +accountKey) {
    const { accountKey, ...copy } = { ...whichChar };
    showChar = copy;
  }
  // 조회 응답
  return res.status(200).json({ data: showChar });
});

/* 라우터 내보내기 */
export default router;
