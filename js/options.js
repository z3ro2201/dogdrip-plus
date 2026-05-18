/**
 * 대화면 마스터 대시보드(options.html) 전용 스크립트 (Brave 보정 및 순수 레이아웃 백업 통합판)
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. 🚀 [NEW] 외부 공용 파일로 분리된 원격 버전 교차 검증 모듈 작동
  execFilterVersionCheck();

  // 2. 크롬 스토리지에서 전체 차단 리스트 로드
  loadData("keywords", "keyword-list");
  loadData("nicknames", "nickname-list");
  loadData("blockedDogcons", "dogcon-list");
  loadData("blockedDogconGroups", "dogcon-group-list");

  // 3. 📐 레이아웃 제어 체크박스 및 본문 폭 설정 상태 일괄 복원
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

  // 4. 레이아웃 체크박스 실시간 동기화 바인딩
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

  // 수동 폭 입력 연산선 연결
  document
    .getElementById("apply-width-btn")
    .addEventListener("click", applyCustomWidth);
  document
    .getElementById("content-width-input")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") applyCustomWidth();
    });

  // 5. ⚡ 좌측 사이드바 탭 메뉴 클릭 시 우측 카드 연동 스위칭 인터랙션 바인딩
  const navItems = document.querySelectorAll(".nav-item");
  const mainTitleEl = document.getElementById("main-title");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // 클릭한 왼쪽 메뉴의 텍스트를 상단 큰 제목에 실시간 바인딩 (이모지 제외 보정)
      if (mainTitleEl) {
        mainTitleEl.innerText = item.innerText
          .replace(
            /[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g,
            "",
          )
          .trim();
      }

      const targetId = item.getAttribute("data-target");
      const cards = document.querySelectorAll(".dashboard-card");
      cards.forEach((card) => {
        if (card.id === targetId) {
          card.classList.add("active");
        } else {
          card.classList.remove("active");
        }
      });
    });
  });
});

// 백업 및 복구 엔진 핵심 이벤트 리스너 바인딩
document.getElementById("backup-btn").addEventListener("click", backupSettings);
document
  .getElementById("restore-btn")
  .addEventListener("click", () =>
    document.getElementById("file-input").click(),
  );
document
  .getElementById("file-input")
  .addEventListener("change", restoreSettings);

/* ================= 🚫 차단 데이터 동기화 렌더러 ================= */
function loadData(key, containerId) {
  chrome.storage.local.get([key], (result) => {
    const list = result[key] || [];
    renderList(list, key, containerId);
  });
}

function removeListItem(key, value, containerId) {
  chrome.storage.local.get([key], (result) => {
    let list = result[key] || [];

    if (key === "blockedDogcons" || key === "blockedDogconGroups") {
      list = list.filter((item) => item.id !== value.id);
    } else {
      list = list.filter((item) => item !== value);
    }

    chrome.storage.local.set({ [key]: list }, () => {
      renderList(list, key, containerId);
      refreshActiveTabs();
    });
  });
}

function renderList(list, key, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML =
      '<span style="color: #94a3b8; font-size: 13px;">차단 등록된 내역이 현재 비어있습니다.</span>';
    return;
  }

  list.forEach((item) => {
    const badge = document.createElement("span");
    badge.className = "badge";

    if (key === "blockedDogcons" || key === "blockedDogconGroups") {
      badge.innerText = item.name;
      badge.title = `ID: ${item.id}`;
    } else {
      badge.innerText = item;
    }

    const delBtn = document.createElement("button");
    delBtn.innerText = "×";
    delBtn.addEventListener("click", () =>
      removeListItem(key, item, containerId),
    );

    badge.appendChild(delBtn);
    container.appendChild(badge);
  });
}

/* ================= ⚙️ 공통 기능 실행 및 수동 폭 제어부 ================= */
function handleCheckboxChange(key, value) {
  chrome.storage.local.set({ [key]: value }, () => {
    refreshActiveTabs();
  });
}

function applyCustomWidth() {
  let widthVal = document.getElementById("content-width-input").value.trim();
  if (widthVal && !isNaN(widthVal)) {
    widthVal += "px";
    document.getElementById("content-width-input").value = widthVal;
  }
  chrome.storage.local.set({ contentWidth: widthVal }, () => {
    refreshActiveTabs();
  });
}

/* ================= 🔄 마스터 멀티 탭 동기화 리로더 ================= */
function refreshActiveTabs() {
  chrome.tabs.query({ url: "*://*.dogdrip.net/*" }, (tabs) => {
    tabs.forEach((tab) => chrome.tabs.reload(tab.id));
  });
}

/* ================= 💾 마스터 데이터 백업/복구 통합 제어부 ================= */
function backupSettings() {
  chrome.storage.local.get(
    [
      "keywords",
      "nicknames",
      "blockedDogcons",
      "blockedDogconGroups",
      "hideNotice",
      "hidePopular",
      "hideSidebar",
      "compactMode",
      "disableVote",
      "preventYoutubeAlgorithm",
      "contentWidth",
    ],
    (result) => {
      const dataStr = JSON.stringify(result, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `dogdrip_clean_filter_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  );
}

document.keep_restore_reader = restoreSettings;
function restoreSettings(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const importedData = JSON.parse(e.target.result);

      const keywords = Array.isArray(importedData.keywords)
        ? importedData.keywords
        : [];
      const nicknames = Array.isArray(importedData.nicknames)
        ? importedData.nicknames
        : [];
      const blockedDogcons = Array.isArray(importedData.blockedDogcons)
        ? importedData.blockedDogcons
        : [];
      const blockedDogconGroups = Array.isArray(
        importedData.blockedDogconGroups,
      )
        ? importedData.blockedDogconGroups
        : [];

      const hideNotice =
        typeof importedData.hideNotice === "boolean"
          ? importedData.hideNotice
          : false;
      const hidePopular =
        typeof importedData.hidePopular === "boolean"
          ? importedData.hidePopular
          : false;
      const hideSidebar =
        typeof importedData.hideSidebar === "boolean"
          ? importedData.hideSidebar
          : false;
      const compactMode =
        typeof importedData.compactMode === "boolean"
          ? importedData.compactMode
          : false;
      const disableVote =
        typeof importedData.disableVote === "boolean"
          ? importedData.disableVote
          : false;
      const preventYoutubeAlgorithm =
        typeof importedData.preventYoutubeAlgorithm === "boolean"
          ? importedData.preventYoutubeAlgorithm
          : false;
      const contentWidth =
        typeof importedData.contentWidth === "string"
          ? importedData.contentWidth
          : "";

      chrome.storage.local.set(
        {
          keywords,
          nicknames,
          blockedDogcons,
          blockedDogconGroups,
          hideNotice,
          hidePopular,
          hideSidebar,
          compactMode,
          disableVote,
          preventYoutubeAlgorithm,
          contentWidth,
        },
        () => {
          alert(
            "🎉 차단 데이터와 레이아웃 환경 설정을 성공적으로 모두 복원했습니다!",
          );

          loadData("keywords", "keyword-list");
          loadData("nicknames", "nickname-list");
          loadData("blockedDogcons", "dogcon-list");
          loadData("blockedDogconGroups", "dogcon-group-list");

          document.getElementById("hide-notice-cb").checked = hideNotice;
          document.getElementById("hide-popular-cb").checked = hidePopular;
          document.getElementById("hide-sidebar-cb").checked = hideSidebar;
          document.getElementById("compact-mode-cb").checked = compactMode;
          document.getElementById("disable-vote-cb").checked = disableVote;
          document.getElementById("preventYoutubeAlgorithm").checked =
            preventYoutubeAlgorithm;
          document.getElementById("content-width-input").value = contentWidth;

          event.target.value = "";
          refreshActiveTabs();
        },
      );
    } catch (err) {
      alert(
        "❌ 파일 분석 중 치명적 파싱 규격 오류를 감지했습니다. 올바른 백업 파일인지 확인해주세요.",
      );
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}
