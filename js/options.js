/**
 * 대화면 마스터 대시보드(options.html) 전용 스크립트 (가져오기 버튼 링크 먹통 버그 완벽 수선판)
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. 🚀 외부 공용 파일로 분리된 원격 버전 교차 검증 모듈 작동
  if (typeof execFilterVersionCheck === "function") {
    execFilterVersionCheck();
  }

  // 2. 크롬 스토리지에서 전체 차단 리스트 및 유저 메모 로드
  loadData("keywords", "keyword-list");
  loadData("blocked_users", "nickname-list");
  loadData("blockedDogcons", "dogcon-list");
  loadData("blockedDogconGroups", "dogcon-group-list");
  if (typeof loadDashboardUserMemos === "function") loadDashboardUserMemos();

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

      const hideNoticeCb = document.getElementById("hide-notice-cb");
      const hidePopularCb = document.getElementById("hide-popular-cb");
      const hideSidebarCb = document.getElementById("hide-sidebar-cb");
      const compactModeCb = document.getElementById("compact-mode-cb");
      const disableVoteCb = document.getElementById("disable-vote-cb");
      const preventYoutubeCb = document.getElementById(
        "preventYoutubeAlgorithm",
      );
      const contentWidthInput = document.getElementById("content-width-input");

      if (hideNoticeCb) hideNoticeCb.checked = result.hideNotice || false;
      if (hidePopularCb) hidePopularCb.checked = result.hidePopular || false;
      if (hideSidebarCb) hideSidebarCb.checked = result.hideSidebar || false;
      if (compactModeCb) compactModeCb.checked = isCompact;
      if (disableVoteCb) disableVoteCb.checked = result.disableVote || false;
      if (preventYoutubeCb)
        preventYoutubeCb.checked = result.preventYoutubeAlgorithm || false;
      if (contentWidthInput)
        contentWidthInput.value = result.contentWidth || "";

      const method = result.blockMethod || "remove";
      const methodBlind = document.getElementById("block-method-blind");
      const methodRemove = document.getElementById("block-method-remove");
      const methodBadge = document.getElementById("block-method-badge");

      if (method === "blind" && methodBlind) {
        methodBlind.checked = true;
      } else if (methodRemove) {
        methodRemove.checked = true;
      } else if (memoBadge) {
        methodRemove.checked = true;
      }

      toggleWidthFormState(isCompact);
    },
  );

  // 4. 레이아웃 체크박스 및 라디오 버튼 실시간 동기화 바인딩
  const hideNoticeCb = document.getElementById("hide-notice-cb");
  const hidePopularCb = document.getElementById("hide-popular-cb");
  const hideSidebarCb = document.getElementById("hide-sidebar-cb");
  const methodRemove = document.getElementById("block-method-remove");
  const methodBlind = document.getElementById("block-method-blind");
  const compactModeCb = document.getElementById("compact-mode-cb");
  const disableVoteCb = document.getElementById("disable-vote-cb");
  const preventYoutubeCb = document.getElementById("preventYoutubeAlgorithm");
  const applyWidthBtn = document.getElementById("apply-width-btn");
  const contentWidthInput = document.getElementById("content-width-input");

  if (hideNoticeCb)
    hideNoticeCb.addEventListener("change", (e) =>
      handleCheckboxChange("hideNotice", e.target.checked),
    );
  if (hidePopularCb)
    hidePopularCb.addEventListener("change", (e) =>
      handleCheckboxChange("hidePopular", e.target.checked),
    );
  if (hideSidebarCb)
    hideSidebarCb.addEventListener("change", (e) =>
      handleCheckboxChange("hideSidebar", e.target.checked),
    );

  if (methodRemove)
    methodRemove.addEventListener("change", handleBlockMethodRadioChange);
  if (methodBlind)
    methodBlind.addEventListener("change", handleBlockMethodRadioChange);

  if (compactModeCb) {
    compactModeCb.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      toggleWidthFormState(isChecked);
      handleCheckboxChange("compactMode", isChecked);
    });
  }

  if (disableVoteCb)
    disableVoteCb.addEventListener("change", (e) =>
      handleCheckboxChange("disableVote", e.target.checked),
    );
  if (preventYoutubeCb)
    preventYoutubeCb.addEventListener("change", (e) =>
      handleCheckboxChange("preventYoutubeAlgorithm", e.target.checked),
    );

  if (applyWidthBtn) applyWidthBtn.addEventListener("click", applyCustomWidth);
  if (contentWidthInput) {
    contentWidthInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") applyCustomWidth();
    });
  }

  // =========================================================================
  // ⚡ 5. 좌측 사이드바 탭 메뉴 클릭 시 데이터 실시간 재로드 및 카드 스위칭 인터랙션
  // =========================================================================
  const navItems = document.querySelectorAll(".nav-item");
  const mainTitleEl = document.getElementById("main-title");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      // ① 기존 활성화된 메뉴 탭 스타일 제거 및 현재 선택된 탭 강조
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // ② 타이틀에서 이모지/특수문자 제거 후 텍스트만 깔끔하게 상단 헤더에 반영
      if (mainTitleEl) {
        mainTitleEl.innerText = item.innerText
          .replace(
            /[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g,
            "",
          )
          .trim();
      }

      // ③ 대상 카드 레이아웃 전환(Show/Hide) 제어
      const targetId = item.getAttribute("data-target");
      const cards = document.querySelectorAll(".dashboard-card");
      cards.forEach((card) => {
        if (card.id === targetId) {
          card.classList.add("active");
        } else {
          card.classList.remove("active");
        }
      });

      // 🔥 [핵심 추가] 메뉴 이동(탭 클릭) 감지 즉시 해당 메뉴에 맞는 크롬 스토리지 데이터 정밀 동적 새로고침
      switch (targetId) {
        case "card-keyword":
          loadData("keywords", "keyword-list");
          break;
        case "card-nickname":
          loadData("blocked_users", "nickname-list");
          break;
        case "card-memo":
          if (typeof loadDashboardUserMemos === "function")
            loadDashboardUserMemos();
          break;
        case "card-dogcon":
          loadData("blockedDogcons", "dogcon-list");
          break;
        case "card-group":
          loadData("blockedDogconGroups", "dogcon-group-list");
          break;
        default:
          break;
      }
    });
  });

  // 6. 🛠️ 미니 팝업창 취소 단추 리스너
  const cancelBtn = document.getElementById("ext-dash-popup-cancel-btn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      const popup = document.getElementById("ext-dashboard-memo-edit-popup");
      if (popup) popup.style.display = "none";
    });
  }

  // 7. 🚀 [반응 없음 버그 완전 진압] 가져오기/내보내기 클릭 회로를 DOM 안정지대 안으로 완벽 이식
  // ① 순정 데이터 내보내기 (백업)
  const backupBtn = document.getElementById("backup-btn");
  if (backupBtn) {
    backupBtn.addEventListener("click", (e) => {
      e.preventDefault();
      backupSettings();
    });
  }

  // ② 순정 데이터 가져오기 (복원) - 변수 선언과 동시에 리스너 결합하여 허공 분출 방지
  const restoreBtn = document.getElementById("restore-btn");
  const fileInput = document.getElementById("file-input");
  if (restoreBtn && fileInput) {
    restoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click(); // 숨겨진 input file 강제 클릭 트리거
      console.log("ali");
    });
    fileInput.addEventListener("change", restoreSettings);
  } else {
    console.log(restoreBtn);
    console.log(fileInput);
  }

  // ③ 타사 Dogdrip++ 데이터 호환 가져오기
  const plusPlusRestoreBtn = document.getElementById(
    "ext-dogdrip-plus-plus-restore-btn",
  );
  const plusPlusFileInput = document.getElementById("ext-plus-plus-file-input");
  if (plusPlusRestoreBtn && plusPlusFileInput) {
    plusPlusRestoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      plusPlusFileInput.click(); // 숨겨진 타사 input file 강제 클릭 트리거
    });
    plusPlusFileInput.addEventListener("change", restoreFromDogdripPlusPlus);
  }

  // =========================================================================
  // 🔍 [NEW] 키워드 리스트 및 차단 유저 목록 실시간 다이내믹 검색 필터 바인딩
  // =========================================================================
  const keywordSearchInput = document.getElementById(
    "ext-keyword-search-input",
  );
  if (keywordSearchInput) {
    keywordSearchInput.addEventListener("input", () => {
      loadData("keywords", "keyword-list"); // 입력값 변화에 맞춰 데이터 재조회 매핑
    });
  }

  const userSearchInput = document.getElementById("ext-user-search-input");
  if (userSearchInput) {
    userSearchInput.addEventListener("input", () => {
      loadData("blocked_users", "nickname-list"); // 입력값 변화에 맞춰 데이터 재조회 매핑
    });
  }

  // 키워드 전역 모달 취소 단추 기믹 스위치 연결
  const keywordCancelBtn = document.getElementById(
    "ext-keyword-popup-cancel-btn",
  );
  if (keywordCancelBtn) {
    keywordCancelBtn.addEventListener("click", () => {
      document.getElementById(
        "ext-dashboard-keyword-edit-popup",
      ).style.display = "none";
    });
  }

  // =========================================================================
  // ➕ [NEW] 신규 조건형 키워드 추가 등록 리스너 회로 결합
  // =========================================================================
  const newKeywordAddBtn = document.getElementById("ext-new-keyword-add-btn");
  const newKeywordInput = document.getElementById("ext-new-keyword-input");

  if (newKeywordAddBtn) {
    newKeywordAddBtn.addEventListener("click", () => {
      addNewKeywordObjectItem(); // 신형 객체 적재 함수 호출
    });
  }

  if (newKeywordInput) {
    newKeywordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && newKeywordAddBtn) newKeywordAddBtn.click();
    });
  }
}); // 💡 DOMContentLoaded 종료 괄호선 위치 확인용

/* ================= 🍪 기능 코어 연산 엔진 구역 ================= */
function handleBlockMethodRadioChange(e) {
  if (e.target.checked) {
    chrome.storage.local.set({ blockMethod: e.target.value }, () => {
      refreshActiveTabs();
    });
  }
}
function handleCheckboxChange(key, value) {
  chrome.storage.local.set({ [key]: value }, () => {
    refreshActiveTabs();
  });
}

function loadData(key, containerId) {
  chrome.storage.local.get([key], (result) => {
    let list = result[key] || [];

    // 💡 [검색 가드] 인풋 검색어 입력 상태를 확인하여 렌더링 리스트 전면 실시간 필터링 분기
    if (key === "keywords") {
      const query = document
        .getElementById("ext-keyword-search-input")
        ?.value.trim()
        .toLowerCase();
      if (query) {
        list = list.filter((item) => {
          const word = (item.word || item.keyword || "").toLowerCase();
          return word.includes(query);
        });
      }
    } else if (key === "blocked_users") {
      const query = document
        .getElementById("ext-user-search-input")
        ?.value.trim()
        .toLowerCase();
      if (query) {
        list = list.filter((item) => {
          const memo = (item.memo || "").toLowerCase();
          return memo.includes(query);
        });
      }
    }

    renderList(list, key, containerId);
  });
}

function removeListItem(key, value, containerId) {
  chrome.storage.local.get([key], (result) => {
    let list = result[key] || [];
    if (key === "blockedDogcons" || key === "blockedDogconGroups") {
      list = list.filter((item) => item.id !== value.id);
    } else if (key === "blocked_users") {
      list = list.filter((item) => item.member_num !== value.member_num);
    } else if (key === "keywords") {
      list = list.filter((item) => item.word !== value.word);
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
    } else if (key === "blocked_users") {
      const dateLabel = item.date || "2026/05/19";
      badge.innerHTML = `
        <div>
          <p style="margin:0; font-weight:bold;">👤 번호: ${item.member_num}</p>
          <p style="margin:0; margin-top:2px; font-size:0.75rem; color:#6b7280;">등록일: ${dateLabel}</p>
          ${item.memo ? `<p style="margin:0; margin-top:2px; font-size:0.75rem; color:#ef4444;">사유: ${item.memo}</p>` : ""}
        </div>`;
      badge.title = `회원고유ID: ${item.member_num}`;
    } else if (key === "keywords") {
      const keywordText = item.word || item.keyword;
      const methodText = item.method === "starts" ? "시작단어" : "포함";
      const targetText =
        item.target === "comments" || item.target === "comment"
          ? "댓글"
          : item.target === "posts" || item.target === "post"
            ? "게시글"
            : "전체(게시글, 댓글)";

      badge.innerHTML = `
        <div style="cursor: pointer;" class="ext-keyword-clickable-item">
          <p style="margin:0; font-weight:bold;">⌨️ ${keywordText}</p>
          <p style="margin:0; margin-top:2px; font-size:0.72rem; color:#2563eb;">조건: [${targetText}] [${methodText}] 시</p>
        </div>`;

      // 🚀 [NEW] 키워드 목록 엘리먼트 클릭 시 상세 조건 변경 콤보박스 모달창 소환 루틴
      badge
        .querySelector(".ext-keyword-clickable-item")
        .addEventListener("click", (e) => {
          openDashboardKeywordEditPopup(item);
        });
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
      const memoBadge = document.createElement("span");
      memoBadge.className = `ext-user-memo-badge ext-memo-${colorStyle}`;
      memoBadge.style.cssText =
        "padding: 6px 12px; font-size: 12px; border-radius: 6px; cursor: pointer; margin: 4px;";
      memoBadge.innerText = `${memoText} (ID: ${mid})`;
      memoBadge.title = "클릭하여 메모 내용 수정 및 삭제";
      memoBadge.addEventListener("click", () => {
        openDashboardMemoPopup(mid, memoText);
      });
      container.appendChild(memoBadge);
    });
  });
}

function openDashboardMemoPopup(memberId, currentText) {
  const popup = document.getElementById("ext-dashboard-memo-edit-popup");
  const input = document.getElementById("ext-dash-popup-input");
  const saveBtn = document.getElementById("ext-dash-popup-save-btn");
  const deleteBtn = document
    .getElementById("ext-dashboard-memo-edit-popup")
    .querySelector("#ext-dash-popup-delete-btn");
  if (!popup || !input || !saveBtn || !deleteBtn) return;

  input.value = currentText;
  popup.style.display = "flex";
  setTimeout(() => input.focus(), 50);
  const newSaveBtn = saveBtn.cloneNode(true);
  const newDeleteBtn = deleteBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);

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
      currentMemos[memberId] = `${updatedText}:${colorStyle}`;
      chrome.storage.local.set({ userMemos: currentMemos }, () => {
        popup.style.display = "none";
        loadDashboardUserMemos();
        refreshActiveTabs();
      });
    });
  });
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

function applyCustomWidth() {
  const inputEl = document.getElementById("content-width-input");
  if (!inputEl || inputEl.disabled) return;
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

function backupSettings() {
  chrome.storage.local.get(
    [
      "keywords",
      "blocked_users",
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
      "userMemos",
    ],
    (result) => {
      const dataStr = JSON.stringify(result, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dogdrip_plus_master_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  );
}

function restoreSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const importedData = JSON.parse(e.target.result);
      let rawKeywords = Array.isArray(importedData.keywords)
        ? importedData.keywords
        : [];
      let rawNicknames = Array.isArray(importedData.nicknames)
        ? importedData.nicknames
        : Array.isArray(importedData.blocked_users)
          ? importedData.blocked_users
          : [];

      const keywords = rawKeywords.map((item) => {
        if (typeof item === "string") {
          return {
            date: "2026/05/19",
            method: "includes",
            target: "all",
            word: item,
          };
        }
        return {
          date: item.date || "2026/05/19",
          method: item.method || "includes",
          target: item.target || "all",
          word: item.word || item.keyword,
        };
      });

      const blocked_users = rawNicknames.map((item) => {
        if (typeof item === "string" && item.includes(":")) {
          const parts = item.split(":");
          return {
            date: "2026/05/19",
            member_num: parts[0].trim(),
            memo: parts[2] ? parts[2].trim() : "",
          };
        }
        return {
          date: item.date || "2026/05/19",
          member_num: item.member_num,
          memo: item.memo || "",
        };
      });

      chrome.storage.local.get(
        [
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
          "userMemos",
        ],
        (currentSettings) => {
          const blockedDogcons = currentSettings.blockedDogcons || [];
          const blockedDogconGroups = currentSettings.blockedDogconGroups || [];
          const hideNotice =
            typeof currentSettings.hideNotice === "boolean"
              ? currentSettings.hideNotice
              : false;
          const hidePopular =
            typeof currentSettings.hidePopular === "boolean"
              ? currentSettings.hidePopular
              : false;
          const hideSidebar =
            typeof currentSettings.hideSidebar === "boolean"
              ? currentSettings.hideSidebar
              : false;
          const compactMode =
            typeof currentSettings.compactMode === "boolean"
              ? currentSettings.compactMode
              : false;
          const disableVote =
            typeof currentSettings.disableVote === "boolean"
              ? currentSettings.disableVote
              : false;
          const preventYoutubeAlgorithm =
            typeof currentSettings.preventYoutubeAlgorithm === "boolean"
              ? currentSettings.preventYoutubeAlgorithm
              : false;
          const contentWidth =
            typeof currentSettings.contentWidth === "string"
              ? currentSettings.contentWidth
              : "";
          const blockMethod =
            typeof currentSettings.blockMethod === "string"
              ? currentSettings.blockMethod
              : "remove";
          const userMemos = currentSettings.userMemos || {};
          chrome.storage.local.set(
            {
              keywords,
              blocked_users,
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
              userMemos,
            },
            () => {
              alert("🎉 순정 백업 데이터 복원을 완료했습니다!");
              loadData("keywords", "keyword-list");
              loadData("blocked_users", "nickname-list");
              loadData("blockedDogcons", "dogcon-list");
              loadData("blockedDogconGroups", "dogcon-group-list");
              if (typeof loadDashboardUserMemos === "function")
                loadDashboardUserMemos();

              const hideNoticeCb = document.getElementById("hide-notice-cb");
              const hidePopularCb = document.getElementById("hide-popular-cb");
              const hideSidebarCb = document.getElementById("hide-sidebar-cb");
              const compactModeCb = document.getElementById("compact-mode-cb");
              const disableVoteCb = document.getElementById("disable-vote-cb");
              const preventYoutubeCb = document.getElementById(
                "preventYoutubeAlgorithm",
              );
              const contentWidthInput = document.getElementById(
                "content-width-input",
              );

              if (hideNoticeCb) hideNoticeCb.checked = hideNotice;
              if (hidePopularCb) hidePopularCb.checked = hidePopular;
              if (hideSidebarCb) hideSidebarCb.checked = hideSidebar;
              if (compactModeCb) compactModeCb.checked = compactMode;
              toggleWidthFormState(compactMode);
              if (disableVoteCb) disableVoteCb.checked = disableVote;
              if (preventYoutubeCb)
                preventYoutubeCb.checked = preventYoutubeAlgorithm;
              if (contentWidthInput) contentWidthInput.value = contentWidth;

              const methodBlind = document.getElementById("block-method-blind");
              const methodRemove = document.getElementById(
                "block-method-remove",
              );
              if (blockMethod === "blind" && methodBlind) {
                methodBlind.checked = true;
              } else if (methodRemove) {
                methodRemove.checked = true;
              }
              event.target.value = "";
              refreshActiveTabs();
            },
          );
        },
      );
    } catch (err) {
      alert("❌ 파일 변환 규격 오류가 발생했습니다.");
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function restoreFromDogdripPlusPlus(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const targetJson = JSON.parse(e.target.result);
      const rawTargetMembers = Array.isArray(targetJson.blocked_members)
        ? targetJson.blocked_members
        : [];
      const rawTargetKeywords = Array.isArray(targetJson.keywords)
        ? targetJson.keywords
        : [];

      const convertedUsers = rawTargetMembers.map((item) => {
        return {
          date: item.date || "2026/05/19",
          member_num: String(item.member_num).trim(),
          memo: item.memo || "",
        };
      });

      const convertedKeywords = rawTargetKeywords.map((item) => {
        return {
          date: item.date || "2026/05/19",
          method: item.method || "includes",
          target: item.target || "all",
          word: item.keyword,
        };
      });

      chrome.storage.local.get(
        [
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
          "userMemos",
        ],
        (currentSettings) => {
          if (chrome.runtime?.lastError) return;
          const keywords = convertedKeywords;
          const blocked_users = convertedUsers;

          const blockedDogcons = currentSettings.blockedDogcons || [];
          const blockedDogconGroups = currentSettings.blockedDogconGroups || [];
          const hideNotice =
            typeof currentSettings.hideNotice === "boolean"
              ? currentSettings.hideNotice
              : false;
          const hidePopular =
            typeof currentSettings.hidePopular === "boolean"
              ? currentSettings.hidePopular
              : false;
          const hideSidebar =
            typeof currentSettings.hideSidebar === "boolean"
              ? currentSettings.hideSidebar
              : false;
          const compactMode =
            typeof currentSettings.compactMode === "boolean"
              ? currentSettings.compactMode
              : false;
          const disableVote =
            typeof currentSettings.disableVote === "boolean"
              ? currentSettings.disableVote
              : false;
          const preventYoutubeAlgorithm =
            typeof currentSettings.preventYoutubeAlgorithm === "boolean"
              ? currentSettings.preventYoutubeAlgorithm
              : false;
          const contentWidth =
            typeof currentSettings.contentWidth === "string"
              ? currentSettings.contentWidth
              : "";
          const blockMethod =
            typeof currentSettings.blockMethod === "string"
              ? currentSettings.blockMethod
              : "remove";
          const userMemos = currentSettings.userMemos || {};

          chrome.storage.local.set(
            {
              keywords,
              blocked_users,
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
              userMemos,
            },
            () => {
              alert(
                "🎉 Dogdrip++의 차단 유저 및 조건 키워드 데이터를 성공적으로 변환하여 이식했습니다!",
              );
              loadData("keywords", "keyword-list");
              loadData("blocked_users", "nickname-list");
              loadData("blockedDogcons", "dogcon-list");
              loadData("blockedDogconGroups", "dogcon-group-list");
              if (typeof loadDashboardUserMemos === "function")
                loadDashboardUserMemos();
              event.target.value = "";
              refreshActiveTabs();
            },
          );
        },
      );
    } catch (err) {
      alert(
        "❌ 타사 백업 JSON 파일을 분석하는 도중 파싱 규격 예외가 발생했습니다.",
      );
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}
/* =========================================================================
   🔑 [NEW 코어] 대시보드 키워드 상세 조건 매칭/타겟 핸들러 및 원격 노드 스케줄러
   ========================================================================= */
function openDashboardKeywordEditPopup(keywordObj) {
  const popup = document.getElementById("ext-dashboard-keyword-edit-popup");
  const wordInput = document.getElementById("ext-keyword-popup-word-input");
  const methodSelect = document.getElementById(
    "ext-keyword-popup-method-select",
  );
  const targetSelect = document.getElementById(
    "ext-keyword-popup-target-select",
  );
  const saveBtn = document.getElementById("ext-keyword-popup-save-btn");

  if (!popup || !wordInput || !methodSelect || !targetSelect || !saveBtn)
    return;

  const originalWord = keywordObj.word || keywordObj.keyword || "";
  wordInput.value = originalWord;
  methodSelect.value = keywordObj.method || "includes";

  // 타사 단수형 세션 포맷 매칭 스킨 보정 처리
  const currentTarget = keywordObj.target || "all";
  targetSelect.value =
    currentTarget === "post"
      ? "posts"
      : currentTarget === "comment"
        ? "comments"
        : currentTarget;

  popup.style.display = "flex";
  setTimeout(() => wordInput.focus(), 50);

  // 이벤트 중복 전이 방지용 클론 치환 게이트웨이 기법 수립
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  // [수정 완료 저장 트리거]
  newSaveBtn.addEventListener("click", () => {
    const nextWord = wordInput.value.trim();
    if (!nextWord) {
      alert("❌ 키워드명은 공백으로 설정할 수 없습니다.");
      return;
    }

    chrome.storage.local.get(["keywords"], (res) => {
      let currentKeywords = res.keywords || [];

      // 기존 대상 오브젝트를 인덱스로 정밀 추적하여 값 대치 가동
      currentKeywords = currentKeywords.map((kw) => {
        const checkWord = kw.word || kw.keyword || "";
        if (checkWord === originalWord) {
          return {
            date: kw.date || "2026/05/19",
            method: methodSelect.value,
            target: targetSelect.value,
            word: nextWord,
          };
        }
        return kw;
      });

      chrome.storage.local.set({ keywords: currentKeywords }, () => {
        popup.style.display = "none";
        loadData("keywords", "keyword-list"); // 새로고침 없이 대시보드 배지 실시간 정렬 최신화
        refreshActiveTabs(); // 본섭 탭 동기화 트리거
      });
    });
  });
}

// ⌨️ [options.js] 대시보드 내 모든 수정 팝업(키워드/메모) 통합 ESC 제어 엔진
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "Esc") {
    // 🎯 1. 처리할 대시보드 내 특수 팝업 ID 리스트 등록
    const targetPopupIds = [
      "ext-dashboard-keyword-edit-popup",
      "ext-dashboard-memo-edit-popup",
    ];

    targetPopupIds.forEach((id) => {
      const popup = document.getElementById(id);
      if (!popup) return;

      // 🛡️ 현재 해당 팝업이 화면에 활성화되어 노출 중인지 체크
      const isVisible =
        window.getComputedStyle(popup).display === "flex" ||
        window.getComputedStyle(popup).display === "block" ||
        popup.classList.contains("active") ||
        popup.classList.contains("show");

      if (isVisible) {
        // 🔍 팝업 내부의 취소/닫기 성격의 단추들을 정밀 추적
        const cancelBtn =
          popup.querySelector(".btn-secondary") ||
          popup.querySelector("button[id*='cancel']") ||
          popup.querySelector("button[id*='close']") ||
          popup.querySelector(".modal-close");

        if (cancelBtn) {
          // ① 기존에 구현해둔 데이터 리셋/초기화 스크립트 그대로 실행 (권장)
          cancelBtn.click();
        } else {
          // ② 취소 버튼 매핑 실패 시 물리적으로 디스플레이 오프 가드 집행
          popup.style.display = "none";
          popup.classList.remove("active", "show");
        }
      }
    });
  }
});
