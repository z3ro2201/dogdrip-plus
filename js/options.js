/**
 * 대화면 마스터 대시보드(options.html) 전용 스크립트 (Brave 보정 및 순수 레이아웃 백업 통합판)
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. 🚀 외부 공용 파일로 분리된 원격 버전 교차 검증 모듈 작동
  if (typeof execFilterVersionCheck === "function") {
    execFilterVersionCheck();
  }

  // 2. 크롬 스토리지에서 전체 차단 리스트 및 유저 메모 로드
  loadData("keywords", "keyword-list");
  loadData("nicknames", "nickname-list");
  loadData("blockedDogcons", "dogcon-list");
  loadData("blockedDogconGroups", "dogcon-group-list");
  loadDashboardUserMemos(); // 💡 [NEW] 기등록 유저 메모 대시보드 렌더러 가동

  // 3. 📐 레이아웃 제어 체크박스 및 차단 방식 라디오 상태 일괄 복원
  chrome.storage.local.get(
    [
      "hideNotice",
      "hidePopular",
      "hideSidebar",
      "compactMode",
      "disableVote",
      "preventYoutubeAlgorithm",
      "contentWidth",
      "blockMethod",
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

      // 가변 폭 초기 값 매핑
      document.getElementById("content-width-input").value =
        result.contentWidth || "";

      // 차단 방식 라디오 버튼 상태 복원
      const method = result.blockMethod || "remove";
      if (method === "blind") {
        document.getElementById("block-method-blind").checked = true;
      } else {
        document.getElementById("block-method-remove").checked = true;
      }

      // 컴팩트 모드 활성화 여부에 따른 수동 폭 폼 록킹 제어
      toggleWidthFormState(isCompact);
    },
  );

  // 4. 레이아웃 체크박스 및 라디오 버튼 실시간 동기화 바인딩
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
    .getElementById("block-method-remove")
    .addEventListener("change", handleBlockMethodRadioChange);
  document
    .getElementById("block-method-blind")
    .addEventListener("change", handleBlockMethodRadioChange);

  // 컴팩트 모드 토글 스위치 핸들러 고도화
  document.getElementById("compact-mode-cb").addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    toggleWidthFormState(isChecked);
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

  // 💡 미니 팝업창 닫기용 취소 리스너 브릿지 결합
  const cancelBtn = document.getElementById("ext-dash-popup-cancel-btn");
  if (cancelBtn)
    cancelBtn.addEventListener("click", () => {
      document.getElementById("ext-dashboard-memo-edit-popup").style.display =
        "none";
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

/* ================= 🍪 차단 방식 라디오 상태 전용 싱크 핸들러 ================= */
if (typeof handleBlockMethodRadioChange !== "function") {
  function handleBlockMethodRadioChange(e) {
    if (e.target.checked) {
      chrome.storage.local.set({ blockMethod: e.target.value }, () => {
        refreshActiveTabs();
      });
    }
  }
}

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
    } else if (key === "nicknames") {
      if (item.includes(":")) {
        const splitted = item.split(":");
        badge.innerHTML = `
          <div>
            <p style="margin:0; font-weight:bold;">${splitted[1]} (${splitted[0]})</p>
            ${splitted[2] ? `<p style="margin:0;margin-top:2px;font-size:0.8rem;color:#ef4444;">차단사유: ${splitted[2]}</p>` : ""}
          </div>`;
        badge.title = `회원고유ID: ${splitted[0]}`;
      } else {
        badge.innerText = item;
      }
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

/* =========================================================================
   📝 [NEW] 유저 메모 대시보드 실시간 조회 및 인라인 제어반 컴포넌트 구역
   ========================================================================= */
function loadDashboardUserMemos() {
  const container = document.getElementById("user-memo-dashboard-list");
  if (!container) return;
  container.innerHTML = "";

  chrome.storage.local.get(["userMemos"], (result) => {
    const memos = result.userMemos || {};
    const memberIds = Object.keys(memos);

    if (memberIds.length === 0) {
      container.innerHTML =
        '<span style="color: #94a3b8; font-size: 13px;">등록된 유저 메모 내역이 현재 비어있습니다.</span>';
      return;
    }

    memberIds.forEach((mid) => {
      const rawData = memos[mid];
      let memoText = rawData;
      let colorStyle = "blue";

      if (rawData.includes(":")) {
        const parts = rawData.split(":");
        memoText = parts[0];
        colorStyle = parts[1] || "blue";
      }

      // 💡 global.css에 코딩해둔 원순정 M3 배지 스킨을 빌드하여 렌더링에 이식
      const memoBadge = document.createElement("span");
      memoBadge.className = `ext-user-memo-badge ext-memo-${colorStyle}`;
      memoBadge.style.cssText =
        "padding: 6px 12px; font-size: 12px; border-radius: 6px; cursor: pointer; margin: 4px;";
      memoBadge.innerText = `${memoText} (ID: ${mid})`;
      memoBadge.title = "클릭하여 메모 내용 수정 및 삭제";

      // 💡 [원클릭 팝업 편집 리스너 브릿지 트리거]
      memoBadge.addEventListener("click", () => {
        openDashboardMemoPopup(mid, memoText);
      });

      container.appendChild(memoBadge);
    });
  });
}

// 대시보드 직속 메모 팝업 편집 다이얼로그 호출기
function openDashboardMemoPopup(memberId, currentText) {
  const popup = document.getElementById("ext-dashboard-memo-edit-popup");
  const input = document.getElementById("ext-dash-popup-input");
  const saveBtn = document.getElementById("ext-dash-popup-save-btn");
  const deleteBtn = document
    .getElementById("ext-dashboard-memo-edit-popup")
    .querySelector("#ext-dash-popup-delete-btn");

  input.value = currentText;
  popup.style.display = "flex";
  setTimeout(() => input.focus(), 50);

  // 리스너 중복 바인딩 누수를 완전히 복구하기 위해 복제 노드 치환 청소 루틴 작동
  const newSaveBtn = saveBtn.cloneNode(true);
  const newDeleteBtn = deleteBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);

  // [수정 완료 저장 연산]
  newSaveBtn.addEventListener("click", () => {
    const updatedText = input.value.trim();
    if (!updatedText) {
      newDeleteBtn.click();
      return;
    }

    chrome.storage.local.get(["userMemos"], (res) => {
      const currentMemos = res.userMemos || {};
      const rawData = currentMemos[memberId] || "";
      const colorStyle = rawData.includes(":") ? rawData.split(":")[1] : "blue";

      currentMemos[memberId] = `${updatedText}:${colorStyle}`; // 사유는 냅두고 글자만 정밀 변경

      chrome.storage.local.set({ userMemos: currentMemos }, () => {
        popup.style.display = "none";
        loadDashboardUserMemos(); // 새로고침 없이 대시보드판 실시간 재렌더링
        refreshActiveTabs();
      });
    });
  });

  // [즉시 파괴 삭제 연산]
  newDeleteBtn.addEventListener("click", () => {
    chrome.storage.local.get(["userMemos"], (res) => {
      const currentMemos = res.userMemos || {};
      delete currentMemos[memberId];

      chrome.storage.local.set({ userMemos: currentMemos }, () => {
        popup.style.display = "none";
        loadDashboardUserMemos();
        refreshActiveTabs();
      });
    });
  });
}

/* ================= ⚙️ 공통 기능 실행 및 수동 폭 제어부 ================= */
function handleCheckboxChange(key, value) {
  chrome.storage.local.set({ [key]: value }, () => {
    refreshActiveTabs();
  });
}

function applyCustomWidth() {
  const inputEl = document.getElementById("content-width-input");
  if (inputEl.disabled) return;

  let widthVal = inputEl.value.trim();
  if (widthVal && !isNaN(widthVal)) {
    widthVal += "px";
    inputEl.value = widthVal;
  }
  chrome.storage.local.set({ contentWidth: widthVal }, () => {
    refreshActiveTabs();
  });
}

function toggleWidthFormState(isCompactActive) {
  const inputEl = document.getElementById("content-width-input");
  const btnEl = document.getElementById("apply-width-btn");
  if (!inputEl || !btnEl) return;

  if (!isCompactActive) {
    inputEl.value = "960";
    inputEl.disabled = true;
    btnEl.disabled = true;
    inputEl.style.opacity = "0.5";
    inputEl.style.cursor = "not-allowed";
    btnEl.style.opacity = "0.5";
    btnEl.style.cursor = "not-allowed";
    chrome.storage.local.set({ contentWidth: "" });
  } else {
    inputEl.disabled = false;
    btnEl.disabled = false;
    inputEl.style.opacity = "1";
    inputEl.style.cursor = "text";
    btnEl.style.opacity = "1";
    btnEl.style.cursor = "pointer";
    chrome.storage.local.get(["contentWidth"], (res) => {
      inputEl.value = res.contentWidth || "";
    });
  }
}

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
      "blockMethod",
      "userMemos", // 💡 백업 다운로드 파일 포맷에 명세서 완전 통합 완료
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
      const blockMethod =
        typeof importedData.blockMethod === "string"
          ? importedData.blockMethod
          : "remove";

      // 💡 [NEW] 복원 시 불러올 파일에 백업된 메모장이 있다면 파싱 디코딩, 없으면 무공해 빈 구조체 연동
      const userMemos =
        importedData.userMemos && typeof importedData.userMemos === "object"
          ? importedData.userMemos
          : {};

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
          blockMethod,
          userMemos, // 스토리지에 메모 저장 마감
        },
        () => {
          alert(
            "🎉 차단 데이터와 사용자 메모 내역을 성공적으로 모두 복원했습니다!",
          );
          loadData("keywords", "keyword-list");
          loadData("nicknames", "nickname-list");
          loadData("blockedDogcons", "dogcon-list");
          loadData("blockedDogconGroups", "dogcon-group-list");
          loadDashboardUserMemos(); // 복원 성공 즉시 대시보드 메모판 최신화 리프레시

          document.getElementById("hide-notice-cb").checked = hideNotice;
          document.getElementById("hide-popular-cb").checked = hidePopular;
          document.getElementById("hide-sidebar-cb").checked = hideSidebar;
          document.getElementById("compact-mode-cb").checked = compactMode;
          toggleWidthFormState(compactMode);
          document.getElementById("disable-vote-cb").checked = disableVote;
          document.getElementById("preventYoutubeAlgorithm").checked =
            preventYoutubeAlgorithm;
          document.getElementById("content-width-input").value = contentWidth;

          if (blockMethod === "blind") {
            document.getElementById("block-method-blind").checked = true;
          } else {
            document.getElementById("block-method-remove").checked = true;
          }

          event.target.value = "";
          refreshActiveTabs();
        },
      );
    } catch (err) {
      alert("❌ 파일 분석 중 치명적 파싱 규격 오류를 감지했습니다.");
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}
