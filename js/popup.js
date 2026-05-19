/**
 * 확장프로그램 팝업창(page/dogdrip.html) 전용 마스터 스크립트 (라디오 차단 스킨 인터랙션 동기화 완료판)
 */

var COOKIE_URL = "https://www.dogdrip.net";
var TXT_COOKIE_NAME = "txtmode";
var THEME_COOKIE_NAME = "theme";

// 1. 팝업창 오픈 시 설정 데이터 로드 및 UI 복원
document.addEventListener("DOMContentLoaded", () => {
  // 공용 버전 체크 모듈 엔진 기동
  execFilterVersionCheck();

  checkCookieStatus();
  checkThemeCookieStatus();

  // 스토리지에 저장된 모든 체크박스 및 라디오 상태 일괄 복원
  chrome.storage.local.get(
    [
      "hideNotice",
      "hidePopular",
      "hideSidebar",
      "compactMode",
      "disableVote",
      "preventYoutubeAlgorithm",
      "contentWidth",
      "blockMethod", // 💡 차단 방식 데이터 로드 대상 통합
    ],
    (result) => {
      const isCompact = result.compactMode || false;

      document.getElementById("hide-notice-cb").checked =
        result.hideNotice || false;
      document.getElementById("hide-popular-cb").checked =
        result.hidePopular || false;
      document.getElementById("hide-sidebar-cb").checked =
        result.hideSidebar || false;
      document.getElementById("compact-mode-cb").checked = isCompact;
      document.getElementById("disable-vote-cb").checked =
        result.disableVote || false;
      document.getElementById("preventYoutubeAlgorithm").checked =
        result.preventYoutubeAlgorithm || false;

      // 📐 가변 폭 초기 값 매핑
      document.getElementById("content-width-input").value =
        result.contentWidth || "";

      // 💡 [차단 방식 라디오 버튼 초기 동기화 복원 마감]
      const method = result.blockMethod || "remove";
      if (method === "blind") {
        document.getElementById("block-method-blind").checked = true;
      } else {
        document.getElementById("block-method-remove").checked = true;
      }

      // 💡 컴팩트 모드 활성화 여부에 따른 수동 폭 폼 록킹 제어
      toggleWidthFormState(isCompact);
    },
  );
});

// 2. 퀵 패널 폼 이벤트 리스너 등록 (HTML에 존재하는 ID와 완벽 매칭)
document
  .getElementById("add-keyword-btn")
  .addEventListener("click", () => addListItem("keywords", "keyword-input"));
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

// 💡 컴팩트 모드 토글 스위치 핸들러 고도화
document.getElementById("compact-mode-cb").addEventListener("change", (e) => {
  const isChecked = e.target.checked;

  // 폼 상태를 실시간으로 제어 (꺼지면 960 고정 및 disabled)
  toggleWidthFormState(isChecked);

  // 체크박스 공통 저장 및 활성 탭 즉시 리로드
  handleCheckboxChange("compactMode", isChecked);
});

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

// 💡 [차단 방식 라디오 스위치 그룹 실시간 체인지 인터랙션 바인딩]
document
  .getElementById("block-method-remove")
  .addEventListener("change", handleBlockMethodRadioChange);
document
  .getElementById("block-method-blind")
  .addEventListener("change", handleBlockMethodRadioChange);
document
  .getElementById("block-method-badge")
  .addEventListener("change", handleBlockMethodRadioChange);

// [수동 폭 설정 버튼] 숫자만 쳤을 때 px 단위 자동 보정 및 세이브
document.getElementById("apply-width-btn").addEventListener("click", () => {
  const inputEl = document.getElementById("content-width-input");
  // 🔒 컴팩트모드가 꺼져 잠긴 상태라면 연산 차단
  if (inputEl.disabled) return;

  let widthVal = inputEl.value.trim();

  if (widthVal && !isNaN(widthVal)) {
    widthVal += "px";
    inputEl.value = widthVal;
  }

  chrome.storage.local.set({ contentWidth: widthVal }, () => {
    refreshActiveTab();
  });
});

// 4. 편의용 엔터키 이벤트 맵
document.getElementById("keyword-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("add-keyword-btn").click();
});
document
  .getElementById("content-width-input")
  .addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("apply-width-btn").click();
  });

// 5. 마스터 대시보드(옵션 페이지) 호출 이벤트
document.getElementById("open-options-link").addEventListener("click", (e) => {
  e.preventDefault();
  openOptionsPage();
});

document.getElementById("open-options-link2").addEventListener("click", (e) => {
  e.preventDefault();
  openOptionsPage();
});

function openOptionsPage() {
  const optionsUrl = chrome.runtime.getURL("page/options.html");
  chrome.tabs.query({ url: optionsUrl }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      chrome.tabs.create({ url: optionsUrl });
    }
  });
}

// 체크박스 공통 저장 및 활성 탭 즉시 리로드
function handleCheckboxChange(key, value) {
  chrome.storage.local.set({ [key]: value }, () => {
    refreshActiveTab();
  });
}

// 💡 [차단 방식 라디오 전용 스토리지 변동 제어선 수립]
function handleBlockMethodRadioChange(e) {
  if (e.target.checked) {
    chrome.storage.local.set({ blockMethod: e.target.value }, () => {
      refreshActiveTab();
    });
  }
}

/**
 * 💡 [NEW] 컴팩트 모드 스위칭 연동 수동 폭 입력 폼 활성/비활성화 가드 엔진
 */
function toggleWidthFormState(isCompactActive) {
  const inputEl = document.getElementById("content-width-input");
  const btnEl = document.getElementById("apply-width-btn");
  if (!inputEl || !btnEl) return;

  // 1. 컴팩트 모드가 비활성화(False) 상태인 경우 ➡️ 960 강제 셋 및 UI 잠금
  if (!isCompactActive) {
    inputEl.value = "960";
    inputEl.disabled = true;
    btnEl.disabled = true;

    // 시각적 피드백 매핑 (금지 마크 및 opacity 적용)
    inputEl.style.opacity = "0.5";
    inputEl.style.cursor = "not-allowed";
    btnEl.style.opacity = "0.5";
    btnEl.style.cursor = "not-allowed";

    // 컴팩트 모드가 꺼지면 스토리지 내부 수치도 빈값으로 밀어서 본섭 app.js의 Fallback(960px) 기믹 발동 유도
    chrome.storage.local.set({ contentWidth: "" });
  }
  // 2. 컴팩트 모드가 활성화(True) 상태인 경우 ➡️ 폼 제한 전면 해제
  else {
    inputEl.disabled = false;
    btnEl.disabled = false;

    inputEl.style.opacity = "1";
    inputEl.style.cursor = "text";
    btnEl.style.opacity = "1";
    btnEl.style.cursor = "pointer";

    // 유저가 기존에 세이브해둔 커스텀 폭 값이 있다면 스토리지를 다시 긁어와서 채워줌
    chrome.storage.local.get(["contentWidth"], (res) => {
      inputEl.value = res.contentWidth || "";
    });
  }
}

/* ================= 🍪 개드립콘 절약모드 토글 스위치 로직 ================= */
function checkCookieStatus() {
  const switchEl = document.getElementById("toggle-cookie-switch");
  if (!switchEl) return;

  chrome.cookies.get(
    { url: COOKIE_URL, name: "rx_login_status" },
    (loginCookie) => {
      const isNotLoggedIn =
        !loginCookie ||
        loginCookie.value === "none" ||
        loginCookie.value.trim() === "";

      if (isNotLoggedIn) {
        switchEl.checked = false;
        switchEl.disabled = true;
        switchEl.style.cursor = "not-allowed";

        const labelEl = switchEl.closest("label") || switchEl.parentElement;
        if (labelEl) {
          labelEl.style.opacity = "0.5";
          labelEl.style.cursor = "not-allowed";
          labelEl.title = "로그인이 필요한 기능입니다.";
        }
        return;
      }

      switchEl.disabled = false;
      switchEl.style.cursor = "pointer";
      const labelEl = switchEl.closest("label") || switchEl.parentElement;
      if (labelEl) {
        labelEl.style.opacity = "1";
        labelEl.style.cursor = "pointer";
        labelEl.removeAttribute("title");
      }

      chrome.cookies.get(
        { url: COOKIE_URL, name: TXT_COOKIE_NAME },
        (cookie) => {
          switchEl.checked = !!(cookie && cookie.value === "1");
        },
      );
    },
  );
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
    () => {
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
        changeEl.innerText = "☀️ 라이트테마";
      } else if (cookie.value === "b") {
        changeEl.innerText = "🌙 다크테마";
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
        url: "https://www.dogdrip.net",
        name: THEME_COOKIE_NAME,
        value: newValue,
        path: "/",
        secure: true,
        sameSite: "no_restriction",
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

/* ================= 🚫 [NEW 코어] 퀵 패널 전용 조건형 키워드 적재기 ================= */
function addListItem(key, inputId) {
  const inputEl = document.getElementById(inputId);
  const methodEl = document.getElementById("ext-quick-keyword-method");
  const targetEl = document.getElementById("ext-quick-keyword-target");

  if (!inputEl || !methodEl || !targetEl) return;

  const value = inputEl.value.trim();
  if (!value) return;

  chrome.storage.local.get([key], (result) => {
    if (chrome.runtime?.lastError) return;
    const list = result[key] || [];

    // 🛡️ 중복 등록 방어선 가드: 이미 등록된 단어인지 확인 (객체 구조 분해 호환 검사)
    const isAlreadyExist = list.some((kw) => {
      const checkWord =
        typeof kw === "string" ? kw : kw.word || kw.keyword || "";
      return checkWord.toLowerCase() === value.toLowerCase();
    });

    if (!isAlreadyExist) {
      // 📦 빠른 차단창에서 고른 콤보박스 설정값과 함께 마스터 규격 문자열 구조체 생성
      const newQuickKeywordObj = {
        date: "2026/05/19",
        method: methodEl.value, // includes, starts
        target: targetEl.value, // all, comments, posts
        word: value,
      };

      list.push(newQuickKeywordObj);

      chrome.storage.local.set({ [key]: list }, () => {
        inputEl.value = "";
        refreshActiveTab(); // 내가 지금 보고 있는 개드립 본섭 탭 실시간 새로고침
      });
    } else {
      alert(`⚠️ '${value}' 항목은 이미 차단 목록에 존재합니다.`);
      inputEl.value = "";
    }
  });
}
