import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bycrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMW from "../middlewares/auth-mw.js";

/* 아이템 라우터 생성 */
const router = express.Router();

/* 아이템 생성 API */
router.post("/items", async (req, res, next) => {
  // body 정보 수령
  const { itemCode, name, stats, price } = req.body;
  // 필수 입력값 검사
  for (let prop of [itemCode, name, stats, price]) {
    if (prop === undefined) {
      return res.status(400).json({ message: `필수 정보가 입력되지 않았수!!` });
    }
  }
  // 유효성 검사 01 : 중복 아이템 코드
  const isItemExist = await prisma.items.findFirst({
    where: { itemCode },
  });
  if (isItemExist) {
    return res.status(409).json({ message: "이미 존재하는 아이템!!" });
  }
  // 아이템 테이블에 아이템 정보 생성
  await prisma.items.create({
    data: {
      itemCode,
      name,
      stats,
      price,
    },
  });
  // 완료 응답
  return res.status(201).json({ message: "아이템 생성 완료!!" });
});

/* 아이템 수정 API */
router.post("/items/:itemcode", async (req, res, next) => {
  const { name, stats } = req.body; // body 정보 수령
  const itemCode = req.params["itemcode"]; // 매개 경로변수 수령
  // 검사 01 : 존재하는 아이템인지 확인
  const isItemExist = await prisma.characters.findFirst({
    where: { itemCode: +itemCode },
  });
  if (!isItemExist) {
    return res.status(404).json({ message: "존재하지 않는 아이템이에요!!" });
  }
  // 요청받은 아이템 코드에 해당하는 데이터 수정
  await prisma.items.update({
    where: { itemCode: +itemCode }, // 경로 매개변수의 값은 문자열이니 형 변환
    data: {
      name,
      stats,
    },
  });
  // 완료 응답
  return res.status(201).json({ message: "아이템 수정 완료!!" });
});

/* 아이템 목록 조회 API */
router.get("/items", async (req, res, next) => {
  // 응답할 아이템 전체 조회
  const itemList = await prisma.items.findMany({
    select: {
      itemCode: true,
      name: true,
      price: true,
    },
  });
  // 목록 조회 응답
  return res.status(200).json({ data: itemList });
});

/* 아이템 상세 조회 API */
router.get("/items/:itemCode", async (req, res, next) => {
  const itemCode = req.params["itemCode"]; // 매개 경로변수 수령
  // 검사 01 : 존재하는 아이템인지 확인
  const isItemExist = await prisma.characters.findFirst({
    where: { itemCode: +itemCode },
  });
  if (!isItemExist) {
    return res.status(404).json({ message: "존재하지 않는 아이템이에요!!" });
  }
  // 요청받은 아이템 코드에 해당하는 데이터 정보 조회
  const whichItem = await prisma.items.findFirst({
    where: { itemCode: +itemCode }, // 경로 매개변수의 값은 문자열이니 형 변환
    select: {
      itemCode: true,
      name: true,
      price: true,
      stats: true,
    },
  });
  // 조회한 특정 아이템 상세 정보 응답
  return res.status(200).json({ data: whichItem });
});

/* 라우터 내보내기 */
export default router;
