// 확장프로그램이 처음 설치되거나 업데이트되었을 때 실행
chrome.runtime.onInstalled.addListener(() => {
  console.log("개드립 커스텀 확장프로그램이 성공적으로 설치되었습니다.");
  
  // 초기 설치 시 스토리지 기본값 세팅 (선택 사항)
  chrome.storage.local.get(['keywords', 'nicknames'], (result) => {
    if (!result.keywords) chrome.storage.local.set({ keywords: [] });
    if (!result.nicknames) chrome.storage.local.set({ nicknames: [] });
  });
});

// [옵션] 쿠키 상태가 백그라운드에서 실시간으로 변하는 것을 감지하고 싶을 때 사용
chrome.cookies.onChanged.addListener((changeInfo) => {
  // 개드립 도메인의 쿠키인지 확인
  if (changeInfo.cookie.domain.includes("dogdrip.net")) {
    // 우리가 제어하려는 txtmode 쿠키인지 확인
    if (changeInfo.cookie.name === "txtmode") {
      console.log(`[Background] txtmode 쿠키 변경됨! 현재 상태 -> 삭제 여부: ${changeInfo.removed}, 값: ${changeInfo.cookie.value}`);
      
      // 만약 팝업을 열지 않고도 쿠키가 강제로 조작되는 것을 방지하거나, 
      // 특정 상태를 항시 유지하고 싶다면 여기에 추가 로직을 작성할 수 있습니다.
    }
  }
});