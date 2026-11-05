// 에어코리아 시도별 실시간 측정정보 요청 주소
const API_URL = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";

// Vercel 서버리스 함수: /api/dust?sido=서울 로 호출됨
export default async function handler(req, res) {
  // 시도 이름을 쿼리에서 받고, 없으면 기본값 '서울'
  const sido = req.query.sido || "서울";
  // 환경변수에서 인증키 읽기 (코드에는 키를 적지 않음)
  const key = process.env.AIRKOREA_KEY;
  // 키가 설정되지 않았으면 안내 후 종료
  if (!key) {
    return res.status(500).json({ error: "서버에 인증키(AIRKOREA_KEY)가 설정되어 있지 않습니다." });
  }

  // Encoding 키는 이미 %가 들어 있어 그대로 감싸면 이중 인코딩되므로, 먼저 풀고 다시 인코딩
  let decodedKey;
  try {
    decodedKey = decodeURIComponent(key);
  } catch {
    decodedKey = key;
  }

  // 요청 주소 만들기
  const url =
    `${API_URL}?serviceKey=${encodeURIComponent(decodedKey)}` +
    `&returnType=json&numOfRows=100&pageNo=1&ver=1.3` +
    `&sidoName=${encodeURIComponent(sido)}`;

  try {
    // 에어코리아 API 호출
    const upstream = await fetch(url);
    // 먼저 글자로 받아서 JSON인지 확인 (XML 에러가 올 수 있음)
    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // JSON이 아니면(XML 에러 등) 한국어 안내
      return res.status(502).json({ error: "인증키 또는 요청값을 확인해주세요" });
    }

    // 응답 안의 결과 코드 확인 ("00"이 성공)
    const header = data.response && data.response.header;
    if (!header || header.resultCode !== "00") {
      const msg = header && header.resultMsg ? ` (${header.resultMsg})` : "";
      return res.status(502).json({ error: `에어코리아 요청에 실패했습니다.${msg}` });
    }

    // 성공: 측정소 목록만 돌려주기 (잠깐 캐시해서 호출 횟수 절약)
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return res.status(200).json({ items: data.response.body.items || [] });
  } catch (err) {
    // 네트워크 오류 등
    return res.status(500).json({ error: "서버에서 데이터를 가져오지 못했습니다." });
  }
}
