/**
 * 개드립 Plus + 백그라운드 마스터 스케줄러 (background.js)
 */

// 💡 괄호 안에 (details) 매개변수를 정확하게 주입하여 브라우저의 가이드 데이터를 받아옵니다.
chrome.runtime.onInstalled.addListener((details) => {
  if (details && details.reason === "install") {
    // 최초 설치 시 환영 페이지
    chrome.tabs.create({
      url: chrome.runtime.getURL("page/welcome.html"),
    });
  } else if (details && details.reason === "update") {
    // 업데이트 시 업데이트 노트 페이지
    chrome.tabs.create({
      url: chrome.runtime.getURL("page/update.html"),
    });
  }
  console.log("개드립 Plus + 확장프로그램이 성공적으로 가동되었습니다.");

  // 초기 설치 시 스토리지 기본값 세팅 (안전장치)
  chrome.storage.local.get(["keywords", "nicknames"], (result) => {
    if (!result.keywords) chrome.storage.local.set({ keywords: [] });
    if (!result.nicknames) chrome.storage.local.set({ nicknames: [] });
  });

  // userMemos 구버전(object) → 신버전(array) 자동 마이그레이션
  migrateUserMemos();
});

/**
 * userMemos 저장 형식 마이그레이션
 * 구버전: { "memberId": "메모텍스트:colorStyle" }
 * 신버전: [ { member_num, memo, date, color } ]
 */
function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function migrateUserMemos() {
  chrome.storage.local.get(["userMemos"], (result) => {
    if (chrome.runtime?.lastError) return;
    const raw = result.userMemos;

    // 이미 배열이면 마이그레이션 불필요
    if (Array.isArray(raw)) return;

    // null/undefined면 빈 배열로 초기화
    if (!raw || typeof raw !== "object") {
      chrome.storage.local.set({ userMemos: [] });
      return;
    }

    // object 형태 → array 변환
    const dateStr = getTodayDateStr();

    const migrated = Object.entries(raw).map(([memberId, rawData]) => {
      let memo = rawData;
      let color = "blue";
      if (typeof rawData === "string") {
        const colonIdx = rawData.lastIndexOf(":");
        if (colonIdx !== -1) {
          memo = rawData.slice(0, colonIdx);
          color = rawData.slice(colonIdx + 1) || "blue";
        }
      }
      return {
        member_num: memberId,
        memo: memo || "",
        date: dateStr,
        color,
      };
    });

    chrome.storage.local.set({ userMemos: migrated }, () => {
      console.log(`[마이그레이션] userMemos ${migrated.length}건 변환 완료`);
    });
  });
}

// [옵션] 쿠키 상태 실시간 감지 레이더
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.domain.includes("dogdrip.net")) {
    if (changeInfo.cookie.name === "txtmode") {
      console.log(
        `[Background] txtmode 쿠키 변경됨! 현재 상태 -> 삭제 여부: ${changeInfo.removed}, 값: ${changeInfo.cookie.value}`,
      );
    }
  }
});
