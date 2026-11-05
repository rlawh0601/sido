// 우리 서버리스 함수 주소 (인증키는 서버 환경변수에만 있음)
const API_URL = "/api/dust";

// 드롭다운에 넣을 시도 목록
const SIDO_LIST = ["전국", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

// 등급 번호별 카드 클래스와 한국어 이름
const GRADE_TEXT = { "1": "좋음", "2": "보통", "3": "나쁨", "4": "매우나쁨" };

// 화면 요소 가져오기
const sidoSelect = document.getElementById("sido");
const cardsBox = document.getElementById("cards");
const avgValue = document.getElementById("avgValue");
const summaryTitle = document.getElementById("summaryTitle");
const messageBox = document.getElementById("message");

// 드롭다운에 시도 옵션 채우기
SIDO_LIST.forEach((name) => {
  // 옵션 요소 만들기
  const opt = document.createElement("option");
  // 옵션의 값과 보이는 글자를 시도 이름으로 설정
  opt.value = name;
  opt.textContent = name;
  // 드롭다운에 추가
  sidoSelect.appendChild(opt);
});

// 측정값이 숫자로 쓸 수 있는지 확인 ("-", 빈 값, null 은 제외)
function isValidValue(v) {
  // 값이 없거나 "-" 이면 사용 불가
  if (v === null || v === undefined || v === "" || v === "-") return false;
  // 숫자로 바꿀 수 있어야 사용 가능
  return !Number.isNaN(Number(v));
}

// 측정값을 화면에 보여줄 글자로 바꾸기
function formatValue(v) {
  // 숫자면 단위를 붙이고, 아니면 "측정 안 됨" 표시
  return isValidValue(v) ? `${Number(v)} ㎍/㎥` : "측정 안 됨";
}

// 등급 값에 맞는 카드 클래스 이름 구하기 (없으면 빈 문자열 = 회색)
function gradeClass(grade) {
  // 1~4 등급이면 g1~g4, 그 외(빈 값 등)는 회색
  return GRADE_TEXT[String(grade)] ? `g${grade}` : "";
}

// 서버에서 측정소 목록 가져오기
async function fetchStations(sidoName) {
  // /api/dust?sido=서울 형태로 호출 (한글은 인코딩)
  const res = await fetch(`${API_URL}?sido=${encodeURIComponent(sidoName)}`);
  // 먼저 글자로 받아서 JSON인지 확인
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // JSON이 아니면 /api/dust 함수가 실행되지 않은 것 (서버 설정 문제)
    throw new Error(`/api/dust 함수가 실행되지 않았습니다. vercel dev 또는 배포 주소로 열었는지 확인해주세요. (응답: ${text.slice(0, 40)})`);
  }
  // 서버가 보낸 한국어 오류 메시지가 있으면 그대로 예외로 던지기
  if (!res.ok) throw new Error(data.error || `서버 응답 오류 (${res.status})`);
  // 측정소 배열 꺼내기 (없으면 빈 배열)
  return data.items || [];
}

// 미세먼지 평균 계산 ("-" 등 측정 안 된 값은 제외)
function calcAverage(items) {
  // 유효한 pm10 값만 숫자로 모으기
  const nums = items.filter((it) => isValidValue(it.pm10Value)).map((it) => Number(it.pm10Value));
  // 유효한 값이 하나도 없으면 null
  if (nums.length === 0) return null;
  // 합계를 개수로 나눠 소수 첫째 자리까지 반올림
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

// 카드 하나를 만드는 함수
function createCard(item) {
  // 카드 바깥 요소 (등급에 따라 색 클래스 추가)
  const card = document.createElement("article");
  card.className = `card ${gradeClass(item.pm10Grade)}`.trim();
  // 등급 이름 (없으면 "등급 없음")
  const gradeName = GRADE_TEXT[String(item.pm10Grade)] || "등급 없음";
  // 카드 안쪽 내용 구성
  card.innerHTML = `
    <h3></h3>
    <div class="row"><span>미세먼지</span><strong>${formatValue(item.pm10Value)}</strong></div>
    <div class="row"><span>초미세먼지</span><strong>${formatValue(item.pm25Value)}</strong></div>
    <div class="row"><span>등급</span><strong>${gradeName}</strong></div>
    <div class="time">측정 시각: ${item.dataTime || "정보 없음"}</div>
  `;
  // 측정소 이름은 안전하게 글자로만 넣기
  card.querySelector("h3").textContent = item.stationName || "이름 없음";
  // 완성된 카드 반환
  return card;
}

// 화면을 새로 그리는 함수
async function render(sidoName) {
  // 이전 카드 지우고 로딩 안내 표시
  cardsBox.innerHTML = "";
  avgValue.textContent = "-";
  summaryTitle.textContent = `${sidoName} 평균 미세먼지`;
  messageBox.textContent = "불러오는 중입니다...";
  try {
    // 측정소 목록 요청
    const items = await fetchStations(sidoName);
    // 결과가 없으면 안내 후 종료
    if (items.length === 0) {
      messageBox.textContent = "표시할 측정소 정보가 없습니다.";
      return;
    }
    // 평균 계산 후 큰 숫자 영역에 표시
    const avg = calcAverage(items);
    avgValue.textContent = avg === null ? "측정 안 됨" : avg;
    // 카드들을 한 번에 붙이기
    const frag = document.createDocumentFragment();
    items.forEach((it) => frag.appendChild(createCard(it)));
    cardsBox.appendChild(frag);
    // 안내 메시지 비우기
    messageBox.textContent = "";
  } catch (err) {
    // 오류 시 한국어 안내 표시
    messageBox.textContent = `데이터를 불러오지 못했습니다. (${err.message})`;
  }
}

// 시도를 바꾸면 다시 그리기
sidoSelect.addEventListener("change", () => render(sidoSelect.value));

// 처음 열 때 기본값(전국)으로 표시
render(sidoSelect.value);
