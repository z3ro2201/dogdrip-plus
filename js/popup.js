/**
 * 확장프로그램 팝업창(page/dogdrip.html) 전용 마스터 스크립트 (js/popup.js)
 */

const COOKIE_URL = "https://www.dogdrip.net";
const TXT_COOKIE_NAME = "txtmode";
const THEME_COOKIE_NAME = "theme";

// 1. 팝업창 오픈 시 설정 데이터 로드 및 UI 복원
document.addEventListener("DOMContentLoaded", () => {
  checkCookieStatus();
  checkThemeCookieStatus();

  // 스토리지에 저장된 모든 체크박스 및 폭 설정 상태 일괄 복원
  chrome.storage.local.get(
    [
      "hideNotice",
      "hidePopular",
      "hideSidebar",
      "compactMode",
      "disableVote",
      "preventYoutubeAlgorithm",
      "contentWidth",
    ],
    (result) => {
      document.getElementById("hide-notice-cb").checked =
        result.hideNotice || false;
      document.getElementById("hide-popular-cb").checked =
        result.hidePopular || false;
      document.getElementById("hide-sidebar-cb").checked =
        result.hideSidebar || false;
      document.getElementById("compact-mode-cb").checked =
        result.compactMode || false;
      document.getElementById("disable-vote-cb").checked =
        result.disableVote || false;
      document.getElementById("preventYoutubeAlgorithm").checked =
        result.preventYoutubeAlgorithm || false;
      document.getElementById("content-width-input").value =
        result.contentWidth || "";
    },
  );
});

// 2. 퀵 패널 폼 및 버튼 이벤트 리스너 등록
document
  .getElementById("add-keyword-btn")
  .addEventListener("click", () => addListItem("keywords", "keyword-input"));
document
  .getElementById("add-nickname-btn")
  .addEventListener("click", () => addListItem("nicknames", "nickname-input"));
document
  .getElementById("toggle-invert-btn")
  .addEventListener("click", toggleThemeCookie);

// 3. 🎛️ 글로벌 공통 토글 스위치 및 가변 폭 인풋 실시간 동기화 바인딩
document
  .getElementById("toggle-cookie-switch")
  .addEventListener("change", toggleTxtModeCookie);
document
  .getElementById("hide-notice-cb")
  .addEventListener("change", (e) =>
    handleCheckboxChange("hideNotice", e.target.checked),
  );
document
  .getElementById("hide-popular-cb")
  .addEventListener("change", (e) =>
    handleCheckboxChange("hidePopular", e.target.checked),
  );
document
  .getElementById("hide-sidebar-cb")
  .addEventListener("change", (e) =>
    handleCheckboxChange("hideSidebar", e.target.checked),
  );
document
  .getElementById("compact-mode-cb")
  .addEventListener("change", (e) =>
    handleCheckboxChange("compactMode", e.target.checked),
  );
document
  .getElementById("disable-vote-cb")
  .addEventListener("change", (e) =>
    handleCheckboxChange("disableVote", e.target.checked),
  );
document
  .getElementById("preventYoutubeAlgorithm")
  .addEventListener("change", (e) =>
    handleCheckboxChange("preventYoutubeAlgorithm", e.target.checked),
  );

// [수동 폭 설정 버튼] 숫자만 입력했을 때 px 단위 자동 보정 및 세이브
document.getElementById("apply-width-btn").addEventListener("click", () => {
  let widthVal = document.getElementById("content-width-input").value.trim();

  if (widthVal && !isNaN(widthVal)) {
    widthVal += "px";
    document.getElementById("content-width-input").value = widthVal;
  }

  chrome.storage.local.set({ contentWidth: widthVal }, () => {
    refreshActiveTab();
  });
});

// 4. 편의용 엔터키 이벤트 맵
document.getElementById("keyword-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("add-keyword-btn").click();
});
document.getElementById("nickname-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("add-nickname-btn").click();
});
document
  .getElementById("content-width-input")
  .addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("apply-width-btn").click();
  });

// 5. 마스터 대시보드(옵션 페이지) 호출 이벤트
document.getElementById("open-options-link").addEventListener("click", (e) => {
  e.preventDefault();
  const optionsUrl = chrome.runtime.getURL("page/options.html");
  chrome.tabs.query({ url: optionsUrl }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      chrome.tabs.create({ url: optionsUrl });
    }
  });
});
document.getElementById("open-options-link2").addEventListener("click", (e) => {
  e.preventDefault();
  const optionsUrl = chrome.runtime.getURL("page/options.html");
  chrome.tabs.query({ url: optionsUrl }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      chrome.tabs.create({ url: optionsUrl });
    }
  });
});

// 체크박스 공통 저장 및 활성 탭 즉시 리로드
function handleCheckboxChange(key, value) {
  chrome.storage.local.set({ [key]: value }, () => {
    refreshActiveTab();
  });
}

/* ================= 🍪 개드립콘 절약모드 토글 스위치 로직 ================= */
function checkCookieStatus() {
  chrome.cookies.get({ url: COOKIE_URL, name: TXT_COOKIE_NAME }, (cookie) => {
    const switchEl = document.getElementById("toggle-cookie-switch");
    if (switchEl) {
      // 쿠키 값이 "1"이면 절약모드가 켜진 것이므로 스위치를 활성화(checked) 합니다.
      switchEl.checked = !!(cookie && cookie.value === "1");
    }
  });
}

function toggleTxtModeCookie(e) {
  const newValue = e.target.checked ? "1" : "0";

  chrome.cookies.set(
    {
      url: "https://www.dogdrip.net",
      name: TXT_COOKIE_NAME,
      value: newValue,
      path: "/",
      secure: true,
      sameSite: "no_restriction",
      expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    },
    (cookie) => {
      if (chrome.runtime.lastError) {
        console.error("쿠키 생성 실패:", chrome.runtime.lastError.message);
        e.target.checked = !e.target.checked;
        return;
      }

      checkCookieStatus();
      refreshActiveTab();
    },
  );
}

/* ================= 🌓 테마 인버트 모드 로직 ================= */
function checkThemeCookieStatus() {
  chrome.cookies.get({ url: COOKIE_URL, name: THEME_COOKIE_NAME }, (cookie) => {
    const changeEl = document.getElementById("toggle-invert-btn");
    if (changeEl) {
      if (!cookie || cookie.value === "a") {
        changeEl.innerText = "☀️ 밝은화면";
      } else if (cookie.value === "b") {
        changeEl.innerText = "🌙 어두운화면";
      }
    }
  });
}

function toggleThemeCookie() {
  chrome.cookies.get({ url: COOKIE_URL, name: THEME_COOKIE_NAME }, (cookie) => {
    let newValue = "b";
    if (cookie && cookie.value === "b") {
      newValue = "a";
    }
    chrome.cookies.set(
      {
        url: COOKIE_URL,
        name: THEME_COOKIE_NAME,
        value: newValue,
        domain: ".dogdrip.net",
        path: "/",
        secure: true,
        sameSite: "lax",
        expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      },
      () => {
        checkThemeCookieStatus();
        refreshActiveTab();
      },
    );
  });
}

/* ================= 🔄 활성 탭 리로드 함수 ================= */
function refreshActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url.includes("dogdrip.net")) {
      chrome.tabs.reload(tabs[0].id);
    }
  });
}

/* ================= 🚫 퀵 차단 데이터 스토리지 적재기 ================= */
function addListItem(key, inputId) {
  const inputEl = document.getElementById(inputId);
  const value = inputEl.value.trim();
  if (!value) return;
  chrome.storage.local.get([key], (result) => {
    const list = result[key] || [];
    if (!list.includes(value)) {
      list.push(value);
      chrome.storage.local.set({ [key]: list }, () => {
        inputEl.value = "";
        refreshActiveTab();
      });
    }
  });
}
