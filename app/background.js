/**
 * 개드립 Plus + 백그라운드 마스터 스케줄러 (background.js)
 */

// 💡 괄호 안에 (details) 매개변수를 정확하게 주입하여 브라우저의 가이드 데이터를 받아옵니다.
chrome.runtime.onInstalled.addListener((details) => {
  if (details && details.reason === "install") {
    // 🚀 셀프 수동 설치든, 스토어 출시 설치든 상관없이 최초 1회 가이드 팝업 실행
    chrome.tabs.create({
      url: chrome.runtime.getURL("page/welcome.html"),
    });
  }
  console.log("개드립 Plus + 확장프로그램이 성공적으로 가동되었습니다.");

  // 초기 설치 시 스토리지 기본값 세팅 (안전장치)
  chrome.storage.local.get(["keywords", "nicknames"], (result) => {
    if (!result.keywords) chrome.storage.local.set({ keywords: [] });
    if (!result.nicknames) chrome.storage.local.set({ nicknames: [] });
  });
});

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
