import express from "express";
import { prisma } from "../utils/prisma/index.js";
import { Prisma } from "@prisma/client";
import bycrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMW from "../middlewares/auth-mw.js";

/* 인벤&장비 라우터 생성 */
const router = express.Router();

/* 보유 아이템 목록 조회 API */
router.get("/inventory/:charKey", authMW, async (req, res, next) => {
  const { charKey } = req.params;
  const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
  // [검사 01] : 존재하는 캐릭터인지 확인
  const checkChar = await prisma.characters.findFirst({
    where: { charKey: +charKey },
  });
  if (!checkChar) {
    return res.status(404).json({ message: "존재하지 않는 캐릭터에요!!" });
  }
  // [검사 02] : 내 계정의 캐릭터인지 확인
  if (checkChar.accountKey !== accountKey) {
    return res.status(403).json({ message: "당신 캐릭터가 아녀요!!" });
  }
  // [1] "내 캐릭터" 인벤 상태 조회
  const invenList = await prisma.inventory.findMany({
    where: { charKey: +charKey },
    select: {
      charKey: true,
      itemCode: true,
      name: true,
      count: true,
    },
  });
  // [2] 목록 조회 응답
  return res.status(200).json({ data: invenList });
});

/* 장비 아이템 목록 조회 API */
router.get("/equipments/:charKey", async (req, res, next) => {
  const { charKey } = req.params;
  // [검사 01] : 존재하는 캐릭터인지 확인
  const isCharExist = await prisma.characters.findFirst({
    where: { charKey: +charKey },
  });
  if (!isCharExist) {
    return res.status(404).json({ message: "존재하지 않는 캐릭터에요!!" });
  }
  // [1] 요청받은 캐릭의 장비 상태 확인
  const isEquip = await prisma.equips.findMany({
    where: { charKey: +charKey },
    select: {
      charKey: true,
      itemCode: true,
      name: true,
    },
  });
  // [2] 착용한 장비가 없으면 빈 배열, 있으면 조회한 거 보여주기
  let showEquip = !isEquip ? [] : isEquip;
  // [3] 목록 조회 응답
  return res.status(200).json({ data: showEquip });
});

/* 아이템 장착 API */
router.put("/equip/:charKey", authMW, async (req, res, next) => {
  const { charKey } = req.params;
  const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
  const { itemCode } = req.body;
  // [검사 01] : 존재하는 캐릭터인지 확인
  const checkChar = await prisma.characters.findFirst({
    where: { charKey: +charKey },
  });
  if (!checkChar) {
    return res.status(404).json({ message: "존재하지 않는 캐릭터에요!!" });
  }
  // [검사 02] : 내 계정의 캐릭터인지 확인
  if (checkChar.accountKey !== accountKey) {
    return res.status(403).json({ message: "당신 캐릭터가 아녀요!!" });
  }
  // [검사 03] : 내 캐릭의 인벤에 있는 아이템인지 확인
  const checkInven = await prisma.inventory.findFirst({
    where: { charKey: +charKey, itemCode },
    select: {
      invenKey: true,
      itemKey: true,
      count: true,
      name: true,
    },
  });
  if (!checkInven) {
    return res.status(404).json({ message: "해당 아이템을 가지고 있지 않아요!!!" });
  }
  // [검사 04] : 이미 장착한 아이템인지 확인
  const isEquip = await prisma.equips.findFirst({
    where: { charKey: +charKey, itemCode },
  });
  if (isEquip) {
    return res.status(409).json({ message: "이미 장착중인 아이템이에요!!!" });
  }
  // [1] 변동 능력치 계산
  const itemStats = await prisma.items.findFirst({
    where: { itemCode },
    select: {
      stats: true, // { "stats":{ "hp":00,"pow":00 } }
    },
  });
  const changedHp = checkChar.stats.hp + itemStats.stats.hp;
  const changedPOW = checkChar.stats.pow + itemStats.stats.pow;
  // [2] 장착 트랜잭션 시작
  await prisma.$transaction(async (tx) => {
    // [2-1] Equips 테이블에 아이템 정보 생성
    await tx.equips.create({
      data: {
        itemKey: checkInven.itemKey,
        charKey: +charKey,
        itemCode,
        name: checkInven.name,
      },
    });
    // [2-2] 보유수량이 0보다 적어질 경우 인벤토리 테이블에서 해당 열 삭제
    const currentCount = checkInven.count;
    if (currentCount - 1 <= 0) {
      await tx.inventory.delete({
        where: { invenKey: checkInven.invenKey },
      });
    } else if (currentCount - 1 > 0) {
      // [2-2] 여러개 보유 중이면 count 1 감소 (혹시 모를 예외가 무서워서 else if로...)
      await tx.inventory.update({
        where: { invenKey: checkInven.invenKey },
        data: {
          count: currentCount - 1,
        },
      });
    }
    // [2-3] 캐릭터 스탯 변동 적용 / 트랜잭션 종료
    await tx.characters.update({
      where: { charKey: +charKey },
      data: {
        stats: { hp: changedHp, pow: changedPOW },
      },
    });
  });
  // [3] 장착 완료 응답
  return res.status(201).json({ message: `${checkInven.name} 장착 완료!!!` });
});

/* 아이템 탈착 API */
router.put("/unequip/:charKey", authMW, async (req, res, next) => {
  const { charKey } = req.params;
  const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
  const { itemCode } = req.body;
  // [검사 01] : 존재하는 캐릭터인지 확인
  const checkChar = await prisma.characters.findFirst({
    where: { charKey: +charKey },
  });
  if (!checkChar) {
    return res.status(404).json({ message: "존재하지 않는 캐릭터에요!!" });
  }
  // [검사 02] : 내 계정의 캐릭터인지 확인
  if (checkChar.accountKey !== accountKey) {
    return res.status(403).json({ message: "당신 캐릭터가 아녀요!!" });
  }
  // [검사 03] : 내 캐릭이 장착중인 아이템인지 확인
  const checkEquip = await prisma.equips.findFirst({
    where: { charKey: +charKey, itemCode },
    select: {
      equipKey: true,
      itemKey: true,
      name: true,
    },
  });
  if (!checkEquip) {
    return res.status(404).json({ message: "장착중인 아이템이 아녀요!!!" });
  }
  // [1] 변동 능력치 계산
  const itemStats = await prisma.items.findFirst({
    where: { itemCode },
    select: {
      stats: true, // { "stats":{ "hp":00,"pow":00 } }
    },
  });
  const changedHp = checkChar.stats.hp - itemStats.stats.hp;
  const changedPOW = checkChar.stats.pow - itemStats.stats.pow;
  // [2] 인벤토리 상황 체크
  const checkInven = await prisma.inventory.findFirst({
    where: { charKey: +charKey, itemCode },
    select: {
      invenKey: true,
      count: true,
    },
  });
  // [3] 탈착 트랜잭션 시작
  await prisma.$transaction(async (tx) => {
    if (!checkInven) {
      // [3-1] 인벤에 없는 아이템이라면 Inventory 테이블에 아이템 정보 생성
      await tx.inventory.create({
        data: {
          itemKey: checkEquip.itemKey,
          charKey: +charKey,
          itemCode,
          name: checkEquip.name, // count는 기본값이 1이여요!
        },
      });
    } else if (checkInven) {
      // [3-1] 이미 보유 중인 아이템이면 count 1 증가
      const currentCount = checkInven.count;
      await tx.inventory.update({
        where: { invenKey: checkInven.invenKey },
        data: {
          count: currentCount + 1,
        },
      });
    }
    // [3-2] Equips 테이블에서 해당 열 삭제
    await tx.equips.delete({
      where: { equipKey: checkEquip.equipKey },
    });
    // [3-3] 캐릭터 스탯 변동 적용 / 트랜잭션 종료
    await tx.characters.update({
      where: { charKey: +charKey },
      data: {
        stats: { hp: changedHp, pow: changedPOW },
      },
    });
  });
  // [4] 탈착 완료 응답
  return res.status(201).json({ message: `${checkEquip.name} 탈착 완료!!!` });
});

/* 라우터 내보내기 */
export default router;
