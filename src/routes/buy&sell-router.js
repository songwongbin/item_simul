import express from "express";
import { prisma } from "../utils/prisma/index.js";
import { Prisma } from "@prisma/client";
import bycrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMW from "../middlewares/auth-mw.js";

/* 구매판매 라우터 생성 */
const router = express.Router();

/* 아이템 구매 API */
router.put("/buy/:charKey", authMW, async (req, res, next) => {
  const { charKey } = req.params;
  const { accountKey } = req.user;
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
  // [1] 여러 개 구매 처리 위한 루프 설정
  for (let buyWhat of req.body) {
    const { itemCode, count } = buyWhat;
    const whichChar = await prisma.characters.findFirst({
      where: { charKey: +charKey },
    });
    // [검사 03] : 존재하는 아이템인지 확인
    const checkItem = await prisma.items.findFirst({
      where: { itemCode },
    });
    if (!checkItem) {
      return res.status(404).json({ message: "존재하지 않는 아이템이에요!!" });
    }
    // [검사 04] : 보유 재화로 구매 비용 지불할 수 있는지 확인
    const cost = checkItem.price * count;
    if (cost > whichChar.money) {
      return res.status(400).json({ message: "재화가 부족해요!!!" });
    }
    // [2] 구매 절차 트랜잭션
    await prisma.$transaction(async (tx) => {
      // [2-1] 내 캐릭터의 인벤토리에 요청한 아이템이 있는지 확인
      const checkInven = await tx.inventory.findFirst({
        where: { charKey: +charKey, itemCode },
        select: {
          invenKey: true,
          count: true,
        },
      });
      // [2-2] 없는 아이템이면 새로 생성, 있는 아이템이면 구매 수량만큼 count 증가
      if (!checkInven) {
        await tx.inventory.create({
          data: {
            itemKey: checkItem.itemKey,
            charKey: whichChar.charKey,
            itemCode,
            name: checkItem.name,
            count,
          },
        });
      } else if (checkInven) {
        const currentCount = checkInven.count;
        await tx.inventory.update({
          where: { invenKey: checkInven.invenKey },
          data: {
            count: currentCount + count,
          },
        });
      }
      // [2-3] 캐릭터 보유 재화에서 총 비용만큼 감소
      await tx.characters.update({
        where: { charKey: +charKey },
        data: {
          money: whichChar.money - cost,
        },
      });
    });
  }
  // [3] 보유 재화 다시 조회
  const leftMoney = await prisma.characters.findFirst({
    where: { charKey: +charKey },
    select: {
      money: true,
    },
  });
  // [4] 구매 후 잔액 응답
  return res.status(201).json({ data: leftMoney.money });
});

/* 아이템 판매 API */
router.put("/sell/:charKey", authMW, async (req, res, next) => {
  const { charKey } = req.params;
  const { accountKey } = req.user;
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

  // [1] 여러 개 판매 처리 위한 반복문
  for (let sellWhat of req.body) {
    // [1-1] 아이템 코드와 캐릭터 정보 받아옴
    const { itemCode, count } = sellWhat;
    const whichChar = await prisma.characters.findFirst({
      where: { charKey: +charKey },
    });

    // [검사 03] : 내 캐릭터의 인벤토리에 요청한 아이템이 있는지 확인
    const checkInven = await prisma.inventory.findFirst({
      where: { charKey: +charKey, itemCode },
      select: {
        invenKey: true,
        count: true,
      },
    });
    // [1-2] 보유하지 않은 아이템이면 무효, 보유량보다 많이 팔려고하면 무효
    if (!checkInven) {
      return res.status(404).json({ message: "갖고있지않은 아이템이에요!!" });
    } else if (checkInven.count < count) {
      return res.status(400).json({ message: "보유 수량보다 많이 팔 순 없슈!!!" });
    } else if (checkInven) {
      // [1-3] 판매 절차 트랜잭션 시작
      await prisma.$transaction(async (tx) => {
        // [1-4] 보유 중인 아이템이면 판매 수량만큼 count 감소
        const currentCount = checkInven.count;
        await tx.inventory.update({
          where: { invenKey: checkInven.invenKey },
          data: {
            count: currentCount - count,
          },
        });
        // [1-4] 보유수량이 0보다 적어질 경우 인벤토리 테이블에서 해당 열 삭제
        if (checkInven.count - count <= 0) {
          await tx.inventory.delete({
            where: { invenKey: checkInven.invenKey },
          });
        }
        // [1-5] 아이템 가격 조회해 총 판매액 얼만지 파악
        const checkItem = await tx.items.findFirst({
          where: { itemCode },
        });
        const income = Math.trunc(checkItem.price * count * 0.6);
        // [1-6] 캐릭터 보유 재화에서 총 가격의 60%만큼 증가 / 트랜잭션 종료
        await tx.characters.update({
          where: { charKey: +charKey },
          data: {
            money: whichChar.money + income,
          },
        });
      });
    }
  }
  // [2] 보유 재화 다시 조회
  const leftMoney = await prisma.characters.findFirst({
    where: { charKey: +charKey },
    select: {
      money: true,
    },
  });
  // [3] 판매 후 잔액 응답
  return res.status(201).json({ data: leftMoney.money });
});

/* 라우터 내보내기 */
export default router;
