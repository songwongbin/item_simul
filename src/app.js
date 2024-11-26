import express from "express";
import cookieParser from "cookie-parser";
import accountRouter from "./routes/account-router.js";
import charRouter from "./routes/char-router.js";
import itemRouter from "./routes/item-router.js";

/* express 생성 */
const app = express();
const PORT = 3018;

/* Parser */
app.use(express.json()); // 바디 파서
app.use(cookieParser()); // 쿠키 파서

/* 라우터 경로 배정 */
app.use("/api", [accountRouter, charRouter, itemRouter]);

/* 서버 오픈 알리미 */
app.listen(PORT, () => {
  console.log(PORT, "포트로 서버 열림!");
});
