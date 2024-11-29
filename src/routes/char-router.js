import express from "express";
import { prisma } from "../utils/prisma/index.js";
import authMW from "../middlewares/auth-mw.js";

/* 캐릭터 라우터 생성 */
const router = express.Router();

/* 캐릭터 생성 API */
router.post("/chars", authMW, async (req, res, next) => {
  try {
    const { name } = req.body;
    const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
    // [검사 01] : 이미 존재하는 캐릭터명인지
    const isNameExist = await prisma.characters.findFirst({
      where: { name },
    });
    if (isNameExist) {
      return res.status(409).json({ message: "이미 존재하는 캐릭터명이에요!!" });
    }
    // [1] 캐릭터 생성
    const char = await prisma.characters.create({
      data: {
        accountKey, // 계정 테이블과 관계 맺기 위함
        name, // 나머지는 default 설정이 돼있음!
      },
    });
    // [2] 생성 완료 응답
    return res.status(201).json({ data: char.charKey }); // 나는 charKey가 기본 키여요....
  } catch (error) {
    next(error);
  }
});

/* 캐릭터 삭제 API */
router.delete("/chars/:charKey", authMW, async (req, res, next) => {
  try {
    const { charKey } = req.params;
    const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
    // [검사 01] : 존재하는 캐릭터인지 확인
    const isMyChar = await prisma.characters.findFirst({
      where: { charKey: +charKey },
    });
    if (!isMyChar) {
      return res.status(404).json({ message: "존재하지 않는 캐릭터에요!!" });
    }
    // [검사 02] : 내 계정의 캐릭터인지 확인
    if (isMyChar.accountKey !== accountKey) {
      return res.status(403).json({ message: "당신 캐릭터가 아녀요!!" });
    }
    // [1] 요청받은 캐릭터 찾아서 삭제
    await prisma.characters.delete({
      where: { charKey: +charKey },
    });
    // [2] 삭제 완료 응답
    return res.status(200).json({ message: "캐릭터 삭제 완료!!" });
  } catch (error) {
    next(error);
  }
});

/* 캐릭터 상세 조회 API */
router.get("/chars/:charKey", authMW, async (req, res, next) => {
  try {
    const { charKey } = req.params;
    const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
    // [검사 01] : 존재하는 캐릭터인지 확인
    const isCharExist = await prisma.characters.findFirst({
      where: { charKey: +charKey },
    });
    if (!isCharExist) {
      return res.status(404).json({ message: "존재하지 않는 캐릭터에요!!" });
    }
    // [1] 요청받은 캐릭터 필요한 속성만 추려 가져오기
    const whichChar = await prisma.characters.findFirst({
      where: { charKey: +charKey },
      select: {
        accountKey: true,
        name: true,
        stats: true,
        money: true,
      },
    });
    // [2] 로그인 된 계정의 캐릭터면 money까지, 그 외의 경우라면 money는 제외하고 보여줄 예정
    let showChar;
    if (whichChar.accountKey !== +accountKey) {
      const { accountKey, money, ...copy } = whichChar;
      showChar = copy;
    } else if (whichChar.accountKey === +accountKey) {
      const { accountKey, ...copy } = whichChar;
      showChar = copy;
    }
    // [3] 조회 결과 응답
    return res.status(200).json({ data: showChar });
  } catch (error) {
    next(error);
  }
});

/* 게임 머니 벌기 API */
router.put("/chars/:charKey", authMW, async (req, res, next) => {
  try {
    const { charKey } = req.params;
    const { accountKey } = req.user; // 인증 통과한 계정 기본키 가져옴
    // [검사 01] : 존재하는 캐릭터인지 확인
    const isMyChar = await prisma.characters.findFirst({
      where: { charKey: +charKey },
    });
    if (!isMyChar) {
      return res.status(404).json({ message: "존재하지 않는 캐릭터에요!!" });
    }
    // [검사 02] : 내 계정의 캐릭터인지 확인
    if (isMyChar.accountKey !== accountKey) {
      return res.status(403).json({ message: "당신 캐릭터가 아녀요!!" });
    }
    // [1] 보유 재화 100 올려줌
    await prisma.characters.update({
      where: { charKey: +charKey },
      data: {
        money: isMyChar.money + 100,
      },
    });
    // [2] 보유 재화 다시 조회
    const leftMoney = await prisma.characters.findFirst({
      where: { charKey: +charKey },
      select: {
        money: true,
      },
    });
    // [3] 현재 보유 재화 응답
    return res.status(201).json({ data: leftMoney.money });
  } catch (error) {
    next(error);
  }
});

/* 라우터 내보내기 */
export default router;
