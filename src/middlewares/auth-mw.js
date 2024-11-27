import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma/index.js";
import dotenv from "dotenv";

/* env로 숨긴 정보 가져오기 */
dotenv.config();
const ATSK = process.env.ATSK; // access 토큰 비밀 키 가져옴
/* 토큰 검증하는 함수 */
function validateToken(token, secretKey) {
  try {
    return jwt.verify(token, secretKey);
  } catch (err) {
    return null;
  }
}
/* 인증 미들웨어 */
export default async function (req, res, next) {
  try {
    const { authorization } = req.headers; // authorization 헤더에서 토큰 받아옴
    // 검사 01 : 토큰 발급 여부 확인 (또는 만료 여부)
    if (!authorization) {
      throw new Error("오류1 : 요청한 계정의 토큰이 없수!!");
    }
    // 검사 02 : 받아온 정보 토큰타입과 토큰내용으로 분리 후 타입 체크
    const [tokenType, token] = authorization.split(" ");
    if (tokenType !== "Bearer") {
      throw new Error("오류2 : 토큰 타입이 잘못됐슈!!");
    }
    // 검사 03 : 토큰 해독해서 페이로드 가져오고 내용 존재 여부 체크 (또는 비밀 키 일치 여부)
    const payload = validateToken(token, ATSK);
    if (!payload) {
      throw new Error("오류3 : 이상한 토큰임!!!"); // 정확한 에러 원인 알려주지 마쇼
    }
    // 검사 04: 페이로드에서 id 꺼낸 후 계정 테이블에서 그 사용자 있는지 찾기
    const { id } = payload;
    const account = await prisma.accounts.findFirst({
      where: { id },
    });
    if (!account) {
      throw new Error("오류4 : 토큰 사용자가 없슈!!");
    }
    // 모든 검사 통과한 계정이면 요청의 user에 넘겨 인증 완하고 미들웨어 넘김
    req.user = account;
    next();
  } catch (error) {
    switch (error.message[2]) {
      case "1" || "4":
        return res.status(404).json({ message: error.message });
      case "2" || "3":
        return res.status(401).json({ message: error.message });
      default:
        return res.status(500).json({ message: "알 수 없는 오류여요!!" });
    }
  }
}
