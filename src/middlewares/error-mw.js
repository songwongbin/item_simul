/* 예상치 못한 오류 알림 미들웨어 */
export default function (error, req, res, next) {
  console.error(error.message); // 내가 볼 것
  res.status(500).json({ errorMessage: "알 수 없는 오류!!!" }); // 사용자가 볼 것
}
