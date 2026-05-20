/**
 * 개드립(dogdrip.net) 전용 통합 차단 필터 & 레이아웃 제어 스크립트 (js/app.js)
 */

const blockColor = "f43f5e";
const grantColor = "16a34a";
const targetPopupMenuId = "popup_menu_area";

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// 1. 가림막, 모달, 개드립콘 컨텍스트 메뉴 구조 준비
const loadingOverlay = document.createElement("div");
loadingOverlay.id = "ext-loading-overlay";
loadingOverlay.innerHTML = `<div class="spinner"></div><div class="loading-text">페이지 최적화 중...</div>`;

const blockModal = document.createElement("div");
blockModal.id = "ext-block-modal";
blockModal.style.display = "none";
blockModal.innerHTML = `
    <div class="modal-content">
        <p id="modal-msg"></p>
        <p style="margin-bottom: 0;">차단 사유</p>
        <div class="input-group" style="margin-bottom:1rem;">
          <input type="text" id="ext-block-reason-input" placeholder="한글, 숫자, 영어, 일부 특수문자(,.) 만 입력가능!" />
        </div>
        <div class="modal-btns">
            <button id="modal-confirm-btn" class="btn-danger">차단</button>
            <button id="modal-cancel-btn" class="btn-secondary">취소</button>
        </div>
    </div>
`;

const memoModal = document.createElement("div");
memoModal.id = "ext-memo-modal";
memoModal.className = "ext-custom-modal-layout";
memoModal.style.cssText =
  "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: none; align-items: center; justify-content: center; z-index: 100002;";
memoModal.innerHTML = `
    <div class="modal-content" style="background: #fff; padding: 20px; border-radius: 12px; width: 90%; max-width: 380px; box-shadow: 0 4px 166px rgba(0,0,0,0.15);">
        <p style="margin-top: 0; font-weight: bold; font-size: 14px; color: #111827;" id="ext-memo-modal-title"></p>
        <div class="input-group" style="margin: 14px 0 8px 0;">
          <input type="text" id="ext-user-memo-modal-input" placeholder="이 사용자에 대한 메모를 입력하세요..." style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; box-sizing: border-box;" />
        </div>
        
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: #64748b;">🎨 배지 색상 선택</p>
        <div id="ext-memo-color-picker" style="display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 18px; padding: 4px 0;"></div>

        <div class="modal-btns" style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
            <button id="memo-modal-delete-btn" style="margin-right: auto; padding: 8px 14px; font-size: 13px; font-weight: bold; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 6px; cursor: pointer; display: none;">삭제</button>
            <button id="memo-modal-confirm-btn" style="padding: 8px 14px; font-size: 13px; font-weight: bold; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer;">저장</button>
            <button id="memo-modal-cancel-btn" style="padding: 8px 14px; font-size: 13px; font-weight: bold; background: #e5e7eb; color: #4b5563; border: none; border-radius: 6px; cursor: pointer;">취소</button>
        </div>
    </div>
`;

const dogconContextMenu = document.createElement("div");
dogconContextMenu.id = "ext-dogcon-menu";
dogconContextMenu.style.display = "none";

function removeLoadingOverlay() {
  const overlay = document.getElementById("ext-loading-overlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.remove();
    }, 200);
  }
}

function injectInitialUI() {
  if (
    document.documentElement &&
    !document.getElementById("ext-loading-overlay")
  ) {
    document.documentElement.appendChild(loadingOverlay);
    document.documentElement.appendChild(blockModal);
    document.documentElement.appendChild(memoModal);
    document.documentElement.appendChild(
      document.getElementById("ext-dogcon-menu")
        ? document.createElement("div")
        : dogconContextMenu,
    );
    bindReasonInputGuard();
    bindBlockModalEvents();
    bindMemoModalEvents();
    return true;
  }
  return false;
}

if (!injectInitialUI()) {
  const injectObserver = new MutationObserver(() => {
    if (injectInitialUI()) injectObserver.disconnect();
  });
  injectObserver.observe(document, { childList: true, subtree: true });
}

let targetNicknameToBlock = "";
let targetMemberIdToBlock = "";
let targetMemoMemberId = "";
let selectedMemoColorStyle = "blue";
let lastClickedUserData = { memberId: "", nickname: "" };
let currentActiveDogconData = null;

function bindReasonInputGuard() {
  const reasonInput = document.getElementById("ext-block-reason-input");
  if (!reasonInput) return;
  reasonInput.addEventListener("input", (e) => {
    const originalValue = e.target.value;
    const filteredValue = originalValue.replace(
      /[^ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9.,\s]/g,
      "",
    );
    if (originalValue !== filteredValue) {
      e.target.value = filteredValue;
    }
  });
}

function buildBlindWrapperHTML(typeLabel, originalHTML) {
  return `
    <div class="ext-blind-container">
      <div class="ext-blind-header">
        <span>🛡️ 차단된 사용자의 ${typeLabel}입니다.</span>
        <a href="#" class="ext-blind-toggle-btn" onclick="return false;">📄 내용 보기</a>
      </div>
      <div class="ext-blind-body">${originalHTML}</div>
    </div>
  `;
}

function attachBlindToggleEvents(container) {
  container.querySelectorAll(".ext-blind-container").forEach((wrapper) => {
    if (wrapper.dataset.bound) return;
    wrapper.dataset.bound = "true";

    const btn = wrapper.querySelector(".ext-blind-toggle-btn");
    const body = wrapper.querySelector(".ext-blind-body");
    if (!body || !btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isFixed = wrapper.classList.toggle("ext-blind-fixed");

      if (isFixed) {
        body.style.display = "flex";
        btn.innerText = "❌ 내용 숨기기";
      } else {
        body.style.display = "none";
        btn.innerText = "📄 내용 보기";
      }
    });

    wrapper.addEventListener("mouseenter", () => {
      if (wrapper.classList.contains("ext-blind-fixed")) return;
      body.style.display = "flex";
      btn.innerText = "👀 슬쩍 보기 중...";
    });

    wrapper.addEventListener("mouseleave", () => {
      if (wrapper.classList.contains("ext-blind-fixed")) return;
      body.style.display = "none";
      btn.innerText = "📄 내용 보기";
    });
  });
}

// 💡 [원천 설계 보정] 타 배지를 뺏어오던 전역 ID 기반 파괴 로직을 영구 폐기합니다.
function createMemoBadgeElement(memberId, memoText, colorStyle) {
  if (!memoText) return null;
  const badge = document.createElement("span");
  // 전역 고유 간섭 방지를 위해 고유 멤버 식별 값을 클래스 클래스터에 주입합니다.
  badge.className = `ext-user-memo-badge ext-memo-${colorStyle || "blue"} ext-badge-id-${memberId}`;
  badge.innerText = memoText;
  badge.title = `메모: ${memoText}\n(회원번호: ${memberId})`;
  return badge;
}

// 조건형 키워드 대조 매칭 엔진
function checkKeywordMatchCondition(titleText, keywordObj, targetArea) {
  if (!titleText || !keywordObj) return false;

  const word =
    typeof keywordObj === "string"
      ? keywordObj
      : keywordObj.word || keywordObj.keyword;
  const method = keywordObj.method || "includes";
  const target = keywordObj.target || "all";

  const normalizedTarget =
    target === "post" ? "posts" : target === "comment" ? "comments" : target;
  if (normalizedTarget !== "all" && normalizedTarget !== targetArea)
    return false;

  let cleanText = titleText.replace(/[\s\n\r\t]+/g, " ");
  cleanText = cleanText
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, "")
    .trim();
  const cleanWord = word.trim();

  if (method === "includes") {
    return cleanText.includes(cleanWord);
  }
  if (method === "starts") {
    return cleanText.startsWith(cleanWord);
  }
  return false;
}

// 3. 종합 필터링 및 레이아웃 제어 집행부
function executeFilterWithMinTime() {
  const minTimePromise = new Promise((resolve) => setTimeout(resolve, 1000));

  const filterPromise = new Promise((resolve) => {
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
        "readabilityMode",
        "legacyToolbar",
      ],
      (result) => {
        if (chrome.runtime?.lastError) return;
        const filterKeywords = result.keywords || [];
        const blockedUsers = result.blocked_users || [];
        const blockedDogcons = result.blockedDogcons || [];
        const blockedDogconGroups = result.blockedDogconGroups || [];
        const isBlindMode = result.blockMethod === "blind";
        const isBadgeMode = result.blockMethod === "badge";

        // userMemos: 신버전 array → member_num 기준 Map으로 색인
        const rawMemos = Array.isArray(result.userMemos)
          ? result.userMemos
          : [];
        const memoMap = new Map(rawMemos.map((m) => [String(m.member_num), m]));

        const blockedMemberIds = blockedUsers
          .map((u) => String(u.member_num).trim())
          .filter((id) => id !== "");
        const blockedUserMap = new Map(
          blockedUsers.map((u) => [String(u.member_num).trim(), u]),
        );

        const blockedDogconIds = blockedDogcons.map((item) => item.id);
        const blockedDogconGroupIds = blockedDogconGroups.map(
          (item) => item.id,
        );

        const htmlEl = document.documentElement;
        if (htmlEl) {
          if (result.contentWidth && result.contentWidth.trim() !== "") {
            htmlEl.style.setProperty(
              "--ext-custom-width",
              result.contentWidth.trim(),
            );
          }
          if (result.hideNotice === true)
            htmlEl.classList.add("ext-hide-notice");
          if (result.hidePopular === true)
            htmlEl.classList.add("ext-hide-popular");
          if (result.hideSidebar === true)
            htmlEl.classList.add("ext-hide-sidebar");
          if (result.compactMode === true)
            htmlEl.classList.add("ext-hide-compact");
          if (result.disableVote === true)
            htmlEl.classList.add("ext-hide-vote");
          if (result.readabilityMode === true)
            htmlEl.classList.add("ext-readability-mode");
          else htmlEl.classList.remove("ext-readability-mode");
          if (result.legacyToolbar === true)
            htmlEl.classList.add("ext-legacy-toolbar");
          else htmlEl.classList.remove("ext-legacy-toolbar");
        }

        function getMemoData(mid) {
          const entry = memoMap.get(String(mid));
          if (!entry) return { text: "", color: "blue" };
          return { text: entry.memo || "", color: entry.color || "blue" };
        }

        // ① 웹진형 레이아웃 필터 (타겟: posts) 💡 [다중 글 독립 배지 마감 완료]
        document.querySelectorAll("li.webzine").forEach((article) => {
          const titleElement = article.querySelector(".title-link");
          const nicknameElement = article.querySelector('a[class*="member_"]');
          let shouldRemove = false;
          let shouldBlind = false;

          if (titleElement && filterKeywords.length > 0) {
            const titleText = titleElement.textContent.trim();
            if (
              filterKeywords.some((kw) =>
                checkKeywordMatchCondition(titleText, kw, "posts"),
              )
            ) {
              shouldRemove = true;
            }
          }

          let currentMemberId = "";
          if (nicknameElement) {
            const match = nicknameElement.className.match(/member_(\d+)/);
            if (match) {
              currentMemberId = match[1];
              if (blockedMemberIds.includes(currentMemberId))
                shouldBlind = true;
            }
          }

          if (shouldRemove) {
            article.remove();
            return;
          }

          if (shouldBlind) {
            if (isBadgeMode) {
              if (
                currentMemberId &&
                nicknameElement &&
                !article.querySelector(`.ext-badge-id-${currentMemberId}`)
              ) {
                const userObj = blockedUserMap.get(currentMemberId);
                const badgeLabel =
                  userObj && userObj.memo && userObj.memo.trim() !== ""
                    ? userObj.memo.trim()
                    : "차단됨";
                const blockBadge = createMemoBadgeElement(
                  currentMemberId,
                  badgeLabel,
                  "red-solid",
                );
                if (blockBadge) nicknameElement.after(blockBadge);
              }
              // article.style.backgroundColor = "#fff1f2";
              article.classList.add("ext-blocked-user-layout");
              return;
            }

            if (article.dataset.extFiltered) return;
            article.dataset.extFiltered = "true";

            if (isBlindMode) {
              const cacheHTML = article.innerHTML;
              article.innerHTML = buildBlindWrapperHTML("게시글", cacheHTML);
              attachBlindToggleEvents(article);
            } else {
              article.remove();
            }
          } else if (currentMemberId && memoMap.has(currentMemberId)) {
            if (
              nicknameElement &&
              !article.querySelector(`.ext-badge-id-${currentMemberId}`)
            ) {
              const memoData = getMemoData(currentMemberId);
              const badge = createMemoBadgeElement(
                currentMemberId,
                memoData.text,
                memoData.color,
              );
              if (badge) nicknameElement.after(badge);
            }
          }
        });

        // ② 최근 게시물 목록 및 ③ 페이지별 인기글 목록 필터링 + 차단 유저 배지 연동 구역
        document
          .querySelectorAll("li span.title a, li div.eq span.text-link")
          .forEach((titleEl) => {
            const parentLi = titleEl.closest("li");
            if (!parentLi) return;

            const nicknameElement = parentLi.querySelector(
              'a[class*="member_"]',
            );
            let currentMemberId = "";
            if (nicknameElement) {
              const match = nicknameElement.className.match(/member_(\d+)/);
              if (match) currentMemberId = match[1];
            }

            if (filterKeywords.length > 0) {
              const titleText = titleEl.textContent.trim();
              if (
                filterKeywords.some((kw) =>
                  checkKeywordMatchCondition(titleText, kw, "posts"),
                )
              ) {
                parentLi.remove();
                return;
              }
            }

            if (currentMemberId && blockedMemberIds.includes(currentMemberId)) {
              if (isBadgeMode) {
                if (
                  nicknameElement &&
                  !parentLi.querySelector(`.ext-badge-id-${currentMemberId}`)
                ) {
                  const userObj = blockedUserMap.get(currentMemberId);
                  const badgeLabel =
                    userObj && userObj.memo && userObj.memo.trim() !== ""
                      ? userObj.memo.trim()
                      : "차단됨";
                  const blockBadge = createMemoBadgeElement(
                    currentMemberId,
                    badgeLabel,
                    "red-solid",
                  );
                  if (blockBadge) nicknameElement.after(blockBadge);
                }
                parentLi.style.backgroundColor = "#fff1f2";
                parentLi.classList.add("ext-blocked-user-layout");
                return;
              }

              if (parentLi.dataset.extFiltered) return;
              parentLi.dataset.extFiltered = "true";

              if (isBlindMode) {
                const cacheHTML = parentLi.innerHTML;
                parentLi.innerHTML = buildBlindWrapperHTML("게시글", cacheHTML);
                attachBlindToggleEvents(parentLi);
              } else {
                parentLi.remove();
              }
            } else if (currentMemberId && memoMap.has(currentMemberId)) {
              if (
                nicknameElement &&
                !parentLi.querySelector(`.ext-badge-id-${currentMemberId}`)
              ) {
                const memoData = getMemoData(currentMemberId);
                const badge = createMemoBadgeElement(
                  currentMemberId,
                  memoData.text,
                  memoData.color,
                );
                if (badge) nicknameElement.after(badge);
              }
            }
          });

        // ④ 테이블형 레이아웃 필터 (tr.ed) (타겟: posts) 💡 [동일 유저 무한 배지 복제 완전 마감]
        document.querySelectorAll("tr.ed").forEach((row) => {
          const titleElement = row.querySelector(".title");
          const authorElement = row.querySelector(
            ".author a[class*='member_']",
          );
          let shouldRemove = false;
          let shouldBlind = false;

          if (titleElement && filterKeywords.length > 0) {
            const realTitleLink = titleElement.querySelector(".title-link");
            let titleText = "";

            if (realTitleLink) {
              titleText = realTitleLink.textContent.trim();
            } else {
              const mainLink = titleElement.querySelector(
                'a[href*="dogdrip.net/"], a[href^="/"]',
              );
              if (mainLink) {
                let cloneLink = mainLink.cloneNode(true);
                const replyBadge = cloneLink.querySelector(".text-primary");
                if (replyBadge) replyBadge.remove();
                titleText = cloneLink.textContent
                  .replace(/\[.*?\]/g, "")
                  .trim();
              } else {
                titleText = titleElement.textContent.trim();
              }
            }

            const cleanTitleText = titleText
              .replace(/[\s\n\r\t]+/g, " ")
              .trim();

            if (
              filterKeywords.some((kw) =>
                checkKeywordMatchCondition(cleanTitleText, kw, "posts"),
              )
            ) {
              shouldRemove = true;
            }
          }

          let currentMemberId = "";
          if (authorElement) {
            const match = authorElement.className.match(/member_(\d+)/);
            if (match) {
              currentMemberId = match[1];
              if (blockedMemberIds.includes(currentMemberId))
                shouldBlind = true;
            }
          }

          if (shouldRemove) {
            row.remove();
            return;
          }

          if (shouldBlind) {
            if (isBadgeMode) {
              if (
                currentMemberId &&
                authorElement &&
                !row.querySelector(`.ext-badge-id-${currentMemberId}`)
              ) {
                const userObj = blockedUserMap.get(currentMemberId);
                const badgeLabel =
                  userObj && userObj.memo && userObj.memo.trim() !== ""
                    ? userObj.memo.trim()
                    : "차단됨";
                const blockBadge = createMemoBadgeElement(
                  currentMemberId,
                  badgeLabel,
                  "red-solid",
                );
                if (blockBadge) authorElement.after(blockBadge);
              }
              row.style.backgroundColor = "#fff1f2";
              row.classList.add("ext-blocked-user-layout");
              return;
            }

            if (row.dataset.extFiltered) return;
            row.dataset.extFiltered = "true";

            if (isBlindMode) {
              const colCount = row.querySelectorAll("td, th").length || 6;
              const cacheHTML = row.innerHTML;
              row.innerHTML = `<td colspan="${colCount}" style="padding: 0;">${buildBlindWrapperHTML("게시글", `<table style="width:100%"><tbody><tr>${cacheHTML}</tr></tbody></table>`)}</td>`;
              attachBlindToggleEvents(row);
            } else {
              row.remove();
            }
          } else if (currentMemberId && memoMap.has(currentMemberId)) {
            if (
              authorElement &&
              !row.querySelector(`.ext-badge-id-${currentMemberId}`)
            ) {
              const memoData = getMemoData(currentMemberId);
              const badge = createMemoBadgeElement(
                currentMemberId,
                memoData.text,
                memoData.color,
              );
              if (badge) authorElement.after(badge);
            }
          }
        });

        // ⑤ 댓글 영역 필터 (타겟: comments)
        document.querySelectorAll(".ed.comment-content").forEach((comment) => {
          const nicknameElement = comment.querySelector('a[class*="member_"]');
          let shouldKeywordRemove = false;

          const commentBodyTextEl = comment.querySelector(
            ".xe_content, .comment-text",
          );

          if (commentBodyTextEl && filterKeywords.length > 0) {
            const rawContent = (
              commentBodyTextEl.innerText ||
              commentBodyTextEl.textContent ||
              ""
            ).replace(/[\s\n\r\t]+/g, " ");

            const commentText = rawContent.trim();

            if (
              filterKeywords.some((kw) =>
                checkKeywordMatchCondition(commentText, kw, "comments"),
              )
            ) {
              shouldKeywordRemove = true;
            }
          }

          if (shouldKeywordRemove) {
            const totalCommentTarget =
              comment.closest("li, div.comment-item") || comment;
            if (totalCommentTarget.dataset.extFiltered) return;
            totalCommentTarget.dataset.extFiltered = "true";

            if (isBlindMode) {
              const cacheHTML = totalCommentTarget.innerHTML;
              totalCommentTarget.innerHTML = buildBlindWrapperHTML(
                "키워드가 포함된 댓글",
                cacheHTML,
              );
              attachBlindToggleEvents(totalCommentTarget);
            } else {
              totalCommentTarget.remove();
            }
            return;
          }

          let currentMemberId = "";
          if (nicknameElement) {
            const match = nicknameElement.className.match(/member_(\d+)/);
            if (match) {
              currentMemberId = match[1];
            }
          }

          if (
            currentMemberId &&
            blockedMemberIds.length > 0 &&
            blockedMemberIds.includes(currentMemberId)
          ) {
            const totalCommentTarget =
              comment.closest("li, div.comment-item") || comment;

            if (isBadgeMode) {
              if (
                nicknameElement &&
                !comment.querySelector(`.ext-badge-id-${currentMemberId}`)
              ) {
                const userObj = blockedUserMap.get(currentMemberId);
                const badgeLabel =
                  userObj && userObj.memo && userObj.memo.trim() !== ""
                    ? userObj.memo.trim()
                    : "차단됨";
                const blockBadge = createMemoBadgeElement(
                  currentMemberId,
                  badgeLabel,
                  "red-solid",
                );
                if (blockBadge) nicknameElement.after(blockBadge);
              }
              totalCommentTarget.style.backgroundColor = "#fff1f2";
              totalCommentTarget.classList.add("ext-blocked-user-layout");
              return;
            }

            if (totalCommentTarget.dataset.extFiltered) return;
            totalCommentTarget.dataset.extFiltered = "true";

            if (isBlindMode) {
              const cacheHTML = totalCommentTarget.innerHTML;
              totalCommentTarget.innerHTML = buildBlindWrapperHTML(
                "댓글",
                cacheHTML,
              );
              attachBlindToggleEvents(totalCommentTarget);
            } else {
              totalCommentTarget.remove();
            }
            return;
          }

          if (
            nicknameElement &&
            currentMemberId &&
            memoMap.has(currentMemberId)
          ) {
            if (
              nicknameElement &&
              !comment.querySelector(`.ext-badge-id-${currentMemberId}`)
            ) {
              const memoData = getMemoData(currentMemberId);
              const badge = createMemoBadgeElement(
                currentMemberId,
                memoData.text,
                memoData.color,
              );
              if (badge) nicknameElement.after(badge);
            }
          }

          if (nicknameElement && currentMemberId) {
            const nicknameText = nicknameElement.textContent.trim();
            const dropdownMenu = comment.querySelector("ul.dropdown-menu");
            if (dropdownMenu) {
              const emptyLis = Array.from(
                dropdownMenu.querySelectorAll("li"),
              ).filter((li) => li.innerHTML.trim() === "");
              if (emptyLis.length > 0) {
                const targetLi = emptyLis[0];
                targetLi.innerHTML = `<a class="ext-block-menu-item"><span class="ed icon"><i class="fas fa-user-slash"></i></span>차단</a>`;
                targetLi.querySelector("a").addEventListener("click", (e) => {
                  e.preventDefault();
                  openBlockModal(nicknameText, currentMemberId);
                });
              }
            }
          }
        });

        // ⑥ 본문 상단 툴바 필터 제어 구역
        const titleToolbar = document.querySelector(".title-toolbar");
        if (titleToolbar) {
          const authorElement = titleToolbar.querySelector(
            'a[class*="member_"]',
          );
          const dropdownMenu = titleToolbar.querySelector("ul.dropdown-menu");
          if (authorElement && dropdownMenu) {
            const authorMemberId =
              authorElement.className.match(/member_(\d+)/)?.[1];
            if (authorMemberId) {
              if (
                memoMap.has(authorMemberId) &&
                !authorElement.nextElementSibling?.classList.contains(
                  "ext-user-memo-badge",
                )
              ) {
                const memoData = getMemoData(authorMemberId);
                const badge = createMemoBadgeElement(
                  authorMemberId,
                  memoData.text,
                  memoData.color,
                );
                if (badge) authorElement.after(badge);
              }
              const existingToolbarBtn = dropdownMenu.querySelector(
                ".ext-toolbar-member-block",
              );
              if (existingToolbarBtn) existingToolbarBtn.remove();
              const blockLi = document.createElement("li");
              blockLi.className = "ext-toolbar-member-block";

              if (blockedMemberIds.includes(authorMemberId)) {
                blockLi.innerHTML = `<a class="ext-block-menu-item" href="#popup_menu_area" onclick="return false;" style="color: #${grantColor}; font-weight: bold;"><span class="ed icon"><i class="fas fa-user-check"></i></span> 차단 해제</a>`;
                blockLi.querySelector("a").addEventListener("click", (e) => {
                  e.preventDefault();
                  if (
                    typeof chrome === "undefined" ||
                    !chrome.runtime ||
                    !chrome.runtime.id
                  ) {
                    window.location.reload();
                    return;
                  }
                  chrome.storage.local.get(["blocked_users"], (res) => {
                    let currentList = res.blocked_users || [];
                    currentList = currentList.filter(
                      (item) =>
                        String(item.member_num) !== String(authorMemberId),
                    );
                    chrome.storage.local.set(
                      { blocked_users: currentList },
                      () => {
                        window.location.reload();
                      },
                    );
                  });
                });
              } else {
                blockLi.innerHTML = `<a class="ext-block-menu-item" href="#popup_menu_area" onclick="return false;" style="color: #${blockColor}; font-weight: bold;"><span class="ed icon"><i class="fas fa-user-slash"></i></span> 차단</a>`;
                blockLi.querySelector("a").addEventListener("click", (e) => {
                  e.preventDefault();
                  openBlockModal(
                    authorElement.textContent.trim(),
                    authorMemberId,
                  );
                });
              }
              dropdownMenu.insertBefore(blockLi, dropdownMenu.firstChild);
            }
          }
        }

        // ⑧ 첨부파일 전체 다운로드 버튼
        document
          .querySelectorAll(".ed.dropdown .ed.dropdown-menu")
          .forEach((menu) => {
            injectDownloadAllButton(menu);
          });

        // ⑦ 개드립콘 처리 구역 등 하단 레거시 로직 보존 집행
        const dogconImgs = document.querySelectorAll(
          "img.dogcon-clickable, img[data-dogcon-srl]",
        );
        dogconImgs.forEach((img) => {
          const srl = img.getAttribute("data-dogcon-srl");
          const fileSrl = img.getAttribute("data-dogcon-file-srl");
          const title =
            img.getAttribute("data-title") ||
            img.getAttribute("title") ||
            "개드립콘";
          const alt = img.getAttribute("alt") || "콘";
          if (img.dataset.extProcessed) return;
          img.dataset.extProcessed = "true";
          const isGroupBlocked = blockedDogconGroupIds.includes(srl);
          const isSingleBlocked = blockedDogconIds.includes(fileSrl);
          const infoUrl = `https://www.dogdrip.net/?mid=dogcon&dogcon_srl=${srl}`;
          if (isGroupBlocked || isSingleBlocked) {
            const blockDiv = document.createElement("div");
            blockDiv.className = "ext-dogcon-blocked";
            blockDiv.innerHTML = `🚫 <span>${title} (${alt}) 차단됨</span><a href="${infoUrl}" target="_blank" class="dogcon-info-link" style="margin-left:6px; color:#0284c7; text-decoration:underline; font-weight:bold;">[ℹ️ 정보]</a>`;
            blockDiv
              .querySelector(".dogcon-info-link")
              .addEventListener("click", (e) => {
                e.stopPropagation();
              });
            blockDiv.dataset.srl = srl;
            blockDiv.dataset.fileSrl = fileSrl;
            blockDiv.dataset.title = title;
            blockDiv.dataset.alt = alt;
            blockDiv.dataset.isSingleBlocked = isSingleBlocked;
            blockDiv.dataset.isGroupBlocked = isGroupBlocked;
            blockDiv.addEventListener("click", (e) => {
              e.stopPropagation();
              e.preventDefault();
              openDogconMenu(e, blockDiv, true);
            });
            img.parentNode.insertBefore(blockDiv, img);
            img.remove();
          } else {
            img.addEventListener("click", (e) => {
              e.stopPropagation();
              e.preventDefault();
              const mockDataElement = document.createElement("div");
              mockDataElement.dataset.srl = srl;
              mockDataElement.dataset.fileSrl = fileSrl;
              mockDataElement.dataset.title = title;
              mockDataElement.dataset.alt = alt;
              mockDataElement.dataset.isSingleBlocked = false;
              mockDataElement.dataset.isGroupBlocked = false;
              openDogconMenu(e, mockDataElement, false);
            });
          }
        });

        if (result.disableVote === true) {
          document
            .querySelectorAll("td.ed.voteNum.text-primary")
            .forEach((td) => {
              if (!td.dataset.extVoteProcessed) {
                td.dataset.extVoteProcessed = "true";
                td.innerHTML = '<i class="fas fa-baby"></i>';
              }
            });
          document.querySelectorAll("i.far.fa-thumbs-up").forEach((icon) => {
            if (!icon.dataset.extVoteProcessed) {
              icon.dataset.extVoteProcessed = "true";
              icon.className = "fas fa-baby";
              const parent = icon.closest("span.text-primary");
              if (
                parent?.nextElementSibling?.classList.contains("text-primary")
              )
                parent.nextElementSibling.remove();
            }
          });
          document.querySelectorAll("a.votebtn").forEach((btn) => {
            if (btn.dataset.extVoteProcessed) return;
            btn.dataset.extVoteProcessed = "true";
            if (btn.getAttribute("title") === "추천") {
              const icon = btn.querySelector("i");
              if (icon) icon.className = "fas fa-baby";
              const count = btn.querySelector("span.count");
              if (count) count.remove();
              const parent = btn.parentElement;
              if (parent?.tagName.toLowerCase() === "span") {
                parent.parentNode.insertBefore(btn, parent);
                parent.remove();
              }
            }
            if (btn.getAttribute("title") === "비추천") btn.remove();
          });
          document.querySelectorAll("a.comment-item-tool").forEach((link) => {
            link.classList.remove("border-left-dotted");
          });
        }
        if (result.preventYoutubeAlgorithm === true) {
          document
            .querySelectorAll('iframe[src*="youtube.com/embed/"]')
            .forEach((iframe) => {
              if (!iframe.dataset.extYoutubeProcessed) {
                iframe.dataset.extYoutubeProcessed = "true";
                const src = iframe.getAttribute("src");
                if (src)
                  iframe.setAttribute(
                    "src",
                    src.replace(
                      "youtube.com/embed/",
                      "youtube-nocookie.com/embed/",
                    ),
                  );
              }
            });
        }
        if (!result.contentWidth || result.contentWidth.trim() === "") {
          document.querySelectorAll(".container").forEach((el) => {
            el.style.maxWidth = "960px";
          });
        }

        // 링크 복사 버튼
        injectCopyLinkButton();

        resolve();
      },
    );
  });
  Promise.all([minTimePromise, filterPromise]).then(() => {
    removeLoadingOverlay();
  });
}

// 6. 게시물 원본 링크 복사 버튼 주입
function injectCopyLinkButton() {
  document
    .querySelectorAll(
      ".ed.article-head.margin-bottom-large .ed.margin-xxsmall.text-default",
    )
    .forEach((container) => {
      if (container.querySelector(".ext-copy-link-btn")) return;
      if (!container.querySelector("i.fas.fa-link")) return;

      const linkEl = container.querySelector("a[href]");
      if (!linkEl) return;
      const url = linkEl.href;

      const btn = document.createElement("a");
      btn.className = "ext-copy-link-btn";
      btn.href = "#";
      btn.textContent = "링크 복사";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard
          .writeText(url)
          .then(() => {
            btn.textContent = "복사됨 ✓";
            setTimeout(() => {
              btn.textContent = "링크 복사";
            }, 1500);
          })
          .catch(() => {
            // clipboard API 실패 시 fallback
            const ta = document.createElement("textarea");
            ta.value = url;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            btn.textContent = "복사됨 ✓";
            setTimeout(() => {
              btn.textContent = "링크 복사";
            }, 1500);
          });
      });

      container.appendChild(btn);
    });
}

// 5. 첨부파일 전체 다운로드 버튼 주입
function injectDownloadAllButton(menu) {
  if (!menu || menu.querySelector(".ext-dl-all-btn")) return;

  const links = Array.from(
    menu.querySelectorAll("li a[href*='procFileDownload']"),
  );
  if (links.length < 2) return;

  const INTERVAL_MS = 300;

  const btnLi = document.createElement("li");
  btnLi.style.cssText =
    "border-bottom: 1px solid #e2e8f0; margin-bottom: 4px; padding-bottom: 4px;";

  const btn = document.createElement("a");
  btn.className = "ext-dl-all-btn";
  btn.href = "#";
  btn.innerHTML = `<i class="fas fa-download"></i> <span>전체 다운로드 (${links.length}개)</span>`;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const span = btn.querySelector("span");
    span.textContent = `다운로드 중... (${links.length}개)`;
    btn.style.color = "#64748b";

    links.forEach((link, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = link.href;
        a.download = "";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * INTERVAL_MS);
    });

    setTimeout(
      () => {
        span.textContent = `전체 다운로드 (${links.length}개)`;
        btn.style.color = "#0284c7";
      },
      links.length * INTERVAL_MS + 500,
    );
  });

  btnLi.appendChild(btn);
  menu.insertBefore(btnLi, menu.firstChild);
}

// 4. 개드립콘 컨텍스트 메뉴 제어
function openDogconMenu(e, dataEl, isAlreadyBlocked) {
  const menu = document.getElementById("ext-dogcon-menu");
  currentActiveDogconData = {
    srl: dataEl.dataset.srl,
    fileSrl: dataEl.dataset.fileSrl,
    title: dataEl.dataset.title,
    alt: dataEl.dataset.alt,
    isSingleBlocked: dataEl.dataset.isSingleBlocked === "true",
    isGroupBlocked: dataEl.dataset.isGroupBlocked === "true",
  };
  const singleActionText = currentActiveDogconData.isSingleBlocked
    ? "🟢 이 개드립콘 차단 해제"
    : "❌ 이 개드립콘만 차단";
  const singleClass = currentActiveDogconData.isSingleBlocked
    ? "unblock-action"
    : "block-action";
  const groupActionText = currentActiveDogconData.isGroupBlocked
    ? "🟢 이 그룹 전체 차단 해제"
    : "❌ 이 개드립콘 그룹 전체 차단";
  const groupClass = currentActiveDogconData.isGroupBlocked
    ? "unblock-action"
    : "block-action";
  const infoUrl = `https://www.dogdrip.net/?mid=dogcon&dogcon_srl=${currentActiveDogconData.srl}`;
  const infoMenuItemHtml = `<div style="border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 4px;"><a href="${infoUrl}" target="_blank" class="dogcon-menu-item" style="text-decoration: none; color: #475569;"><span>🔗 ${currentActiveDogconData.title} 정보</span></a></div>`;
  if (currentActiveDogconData.isGroupBlocked) {
    menu.innerHTML = `<div class="dogcon-menu-item ${groupClass}" id="ext-dogcon-action-group">${groupActionText}</div>${infoMenuItemHtml}`;
  } else {
    menu.innerHTML = `<div class="dogcon-menu-item ${singleClass}" id="ext-dogcon-action-single">${singleActionText}</div><div class="dogcon-menu-item ${groupClass}" id="ext-dogcon-action-group">${groupActionText}</div>${infoMenuItemHtml}`;
  }
  const menuInfoLink = menu.querySelector('a[href*="mid=dogcon"]');
  if (menuInfoLink) {
    menuInfoLink.addEventListener("click", () => {
      menu.style.display = "none";
    });
  }
  menu.style.left = `${e.pageX}px`;
  menu.style.top = `${e.pageY}px`;
  menu.style.display = "block";
  const singleBtn = document.getElementById("ext-dogcon-action-single");
  const groupBtn = document.getElementById("ext-dogcon-action-group");
  if (singleBtn) singleBtn.addEventListener("click", handleSingleBlockToggle);
  if (groupBtn) groupBtn.addEventListener("click", handleGroupBlockToggle);
}

document.addEventListener("click", (event) => {
  const menu = document.getElementById("ext-dogcon-menu");
  if (menu) menu.style.display = "none";
  const userLink = event.target.closest("a[class*='member_']");
  if (userLink) {
    const nickname = userLink.textContent.trim();
    const match = userLink.className.match(/member_(\d+)/);
    if (match) {
      lastClickedUserData.memberId = match[1];
      lastClickedUserData.nickname = nickname;
    }
  }
});

function handleSingleBlockToggle() {
  if (!currentActiveDogconData) return;
  const targetId = currentActiveDogconData.fileSrl;
  const targetName = `${currentActiveDogconData.title}(${currentActiveDogconData.alt})`;
  chrome.storage.local.get(["blockedDogcons"], (result) => {
    let list = result.blockedDogcons || [];
    if (currentActiveDogconData.isSingleBlocked) {
      list = list.filter((item) => item.id !== targetId);
    } else {
      if (!list.some((item) => item.id === targetId)) {
        list.push({ id: targetId, name: targetName });
      }
    }
    chrome.storage.local.set({ blockedDogcons: list }, () => {
      window.location.reload();
    });
  });
}

function handleGroupBlockToggle() {
  if (!currentActiveDogconData) return;
  const targetId = currentActiveDogconData.srl;
  const targetName = currentActiveDogconData.title;
  chrome.storage.local.get(["blockedDogconGroups"], (result) => {
    let list = result.blockedDogconGroups || [];
    if (currentActiveDogconData.isGroupBlocked) {
      list = list.filter((item) => item.id !== targetId);
    } else {
      if (!list.some((item) => item.id === targetId)) {
        list.push({ id: targetId, name: targetName });
      }
    }
    chrome.storage.local.set({ blockedDogconGroups: list }, () => {
      window.location.reload();
    });
  });
}

function openBlockModal(nickname, memberId) {
  targetNicknameToBlock = nickname;
  targetMemberIdToBlock = memberId;
  const reasonInput = document.getElementById("ext-block-reason-input");
  if (reasonInput) reasonInput.value = "";
  const msgEl = document.getElementById("modal-msg");
  const modalEl = document.getElementById("ext-block-modal");
  if (msgEl && modalEl) {
    msgEl.innerHTML = `<strong>${nickname}${memberId ? `(${memberId})` : ""}</strong>님을 차단하시겠습니까?<br />차단 시 대상의 글과 댓글이 보이지 않습니다.`;
    modalEl.style.display = "flex";
  }
}

function closeBlockModal() {
  const modalEl = document.getElementById("ext-block-modal");
  if (modalEl) modalEl.style.display = "none";
  targetNicknameToBlock = "";
  targetMemberIdToBlock = "";
  const reasonInput = document.getElementById("ext-block-reason-input");
  if (reasonInput) reasonInput.value = "";
}

function bindBlockModalEvents() {
  const confirmBtn = document.getElementById("modal-confirm-btn");
  const cancelBtn = document.getElementById("modal-cancel-btn");
  if (cancelBtn) cancelBtn.addEventListener("click", closeBlockModal);
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      if (
        typeof chrome === "undefined" ||
        !chrome.runtime ||
        !chrome.runtime.id
      ) {
        alert("📢 데이터 통신 연결이 해제되어 페이지를 다시 로드합니다.");
        window.location.reload();
        return;
      }
      if (!targetNicknameToBlock || !targetMemberIdToBlock) {
        closeBlockModal();
        return;
      }

      const reasonInput = document.getElementById("ext-block-reason-input");
      const blockReason = reasonInput ? reasonInput.value.trim() : "";

      const newBlockUserObj = {
        date: getTodayDateStr(),
        member_num: String(targetMemberIdToBlock).trim(),
        memo: blockReason,
      };

      chrome.storage.local.get(["blocked_users"], (result) => {
        if (chrome.runtime?.lastError) return;
        const list = result.blocked_users || [];
        const isAlreadyExist = list.some(
          (item) => String(item.member_num) === String(targetMemberIdToBlock),
        );

        if (!isAlreadyExist) {
          list.push(newBlockUserObj);
          chrome.storage.local.set({ blocked_users: list }, () => {
            closeBlockModal();
            window.location.reload();
          });
        } else {
          closeBlockModal();
        }
      });
    });
  }
}

function openUserMemoModal(nickname, memberId, memoEntry) {
  targetMemoMemberId = memberId;
  const currentMemoText = memoEntry?.memo || "";
  selectedMemoColorStyle = memoEntry?.color || "blue";

  const titleEl = document.getElementById("ext-memo-modal-title");
  const inputEl = document.getElementById("ext-user-memo-modal-input");
  const deleteBtn = document.getElementById("memo-modal-delete-btn");
  if (titleEl)
    titleEl.innerHTML = `📝 <strong>${nickname}</strong> 유저 메모 관리`;
  if (inputEl) {
    inputEl.value = currentMemoText;
    setTimeout(() => inputEl.focus(), 50);
  }
  if (deleteBtn) {
    deleteBtn.style.display = currentMemoText !== "" ? "block" : "none";
  }
  renderMemoColorPickerUI();
  memoModal.style.display = "flex";
}

function closeUserMemoModal() {
  memoModal.style.display = "none";
  targetMemoMemberId = "";
  const inputEl = document.getElementById("ext-user-memo-modal-input");
  if (inputEl) inputEl.value = "";
}

function renderMemoColorPickerUI() {
  const pickerContainer = document.getElementById("ext-memo-color-picker");
  if (!pickerContainer) return;
  pickerContainer.innerHTML = "";
  const colorPalette = [
    { key: "blue", hex: "#3b82f6", name: "블루" },
    { key: "green", hex: "#10b981", name: "그린" },
    { key: "red", hex: "#ef4444", name: "레드" },
    { key: "yellow", hex: "#f59e0b", name: "옐로우" },
    { key: "purple", hex: "#8b5cf6", name: "퍼플" },
    { key: "pink", hex: "#ec4899", name: "핑크" },
    { key: "cyan", hex: "#06b6d4", name: "시안" },
    { key: "orange", hex: "#f97316", name: "오렌지" },
    { key: "teal", hex: "#14b8a6", name: "티일" },
    { key: "gray", hex: "#64748b", name: "그레이" },
  ];
  colorPalette.forEach((color) => {
    const chip = document.createElement("div");
    chip.className = `ext-memo-color-chip-item ${color.key}`;
    chip.style.cssText = `width: 22px; height: 22px; border-radius: 50%; background-color: ${color.hex}; cursor: pointer; box-sizing: border-box; transition: all 0.15s ease; border: 2px solid transparent;`;
    chip.title = color.name;
    if (selectedMemoColorStyle === color.key) {
      chip.style.borderColor = "#111827";
      chip.style.transform = "scale(1.15)";
      chip.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
    }
    chip.addEventListener("click", () => {
      selectedMemoColorStyle = color.key;
      pickerContainer
        .querySelectorAll(".ext-memo-color-chip-item")
        .forEach((el) => {
          el.style.borderColor = "transparent";
          el.style.transform = "scale(1)";
          el.style.boxShadow = "none";
        });
      chip.style.borderColor = "#111827";
      chip.style.transform = "scale(1.15)";
      chip.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
    });
    pickerContainer.appendChild(chip);
  });
}

function bindMemoModalEvents() {
  const confirmBtn = document.getElementById("memo-modal-confirm-btn");
  const cancelBtn = document.getElementById("memo-modal-cancel-btn");
  const deleteBtn = document.getElementById("memo-modal-delete-btn");
  const inputEl = document.getElementById("ext-user-memo-modal-input");
  if (!confirmBtn || !cancelBtn || !deleteBtn || !inputEl) return;
  cancelBtn.addEventListener("click", closeUserMemoModal);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmBtn.click();
    }
  });
  deleteBtn.addEventListener("click", () => {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      !chrome.runtime.id
    ) {
      window.location.reload();
      return;
    }
    if (!targetMemoMemberId) {
      closeUserMemoModal();
      return;
    }
    chrome.storage.local.get(["userMemos"], (res) => {
      const arr = Array.isArray(res.userMemos) ? res.userMemos : [];
      const updated = arr.filter(
        (m) => String(m.member_num) !== String(targetMemoMemberId),
      );
      chrome.storage.local.set({ userMemos: updated }, () => {
        closeUserMemoModal();
        window.location.reload();
      });
    });
  });
  confirmBtn.addEventListener("click", () => {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      !chrome.runtime.id
    ) {
      window.location.reload();
      return;
    }
    if (!targetMemoMemberId) {
      closeUserMemoModal();
      return;
    }
    const memoText = inputEl.value.trim();
    chrome.storage.local.get(["userMemos"], (res) => {
      const arr = Array.isArray(res.userMemos) ? res.userMemos : [];
      const filtered = arr.filter(
        (m) => String(m.member_num) !== String(targetMemoMemberId),
      );
      if (memoText !== "") {
        filtered.push({
          member_num: String(targetMemoMemberId),
          memo: memoText,
          date: getTodayDateStr(),
          color: selectedMemoColorStyle,
        });
      }
      chrome.storage.local.set({ userMemos: filtered }, () => {
        closeUserMemoModal();
        window.location.reload();
      });
    });
  });
}

function handlePopupMenuDetected(popupElement) {
  const currentDisplay = window.getComputedStyle(popupElement).display;
  if (currentDisplay === "none") return;
  if (lastClickedUserData.memberId) {
    chrome.storage.local.get(["blocked_users", "userMemos"], (result) => {
      if (chrome.runtime?.lastError || !chrome.runtime || !chrome.runtime.id)
        return;
      const list = result.blocked_users || [];
      const memosArr = Array.isArray(result.userMemos) ? result.userMemos : [];
      const isAlreadyBlocked = list.some(
        (item) =>
          String(item.member_num) === String(lastClickedUserData.memberId),
      );
      const memoEntry =
        memosArr.find(
          (m) => String(m.member_num) === String(lastClickedUserData.memberId),
        ) || null;
      insertMemberMenu(
        lastClickedUserData.memberId,
        lastClickedUserData.nickname,
        isAlreadyBlocked,
        memoEntry,
      );
    });
  }
}

function insertMemberMenu(memberId, nickname, isAlreadyBlocked, memoEntry) {
  const popupMenuParentEl = document.getElementById("popup_menu_area");
  if (!popupMenuParentEl) return;
  const popupMenuEl = popupMenuParentEl.querySelector("ul");
  if (!popupMenuEl) return;
  popupMenuEl
    .querySelectorAll(
      ".ext-inserted-member-block, .ext-inserted-member-memo-link",
    )
    .forEach((el) => el.remove());
  const pureMemoText = memoEntry?.memo || "";
  const memoLi = document.createElement("li");
  memoLi.className = "ext-inserted-member-memo-link";
  const memoSuffix =
    pureMemoText !== ""
      ? ` <span style="font-weight:normal; font-size:11px; color:#64748b;">(${pureMemoText.length > 8 ? pureMemoText.slice(0, 8) + "..." : pureMemoText})</span>`
      : "";
  memoLi.innerHTML = `<a href="#" style="color: #0284c7; font-weight: bold;">메모${memoSuffix}</a>`;
  memoLi.querySelector("a").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    popupMenuParentEl.style.display = "none";
    openUserMemoModal(nickname, memberId, memoEntry);
  });
  const blockItem = document.createElement("li");
  blockItem.className = "ext-inserted-member-block";
  if (isAlreadyBlocked) {
    blockItem.innerHTML = `<a href="#" style="color: #${grantColor}; font-weight: bold;">차단 해제</a>`;
    blockItem.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      popupMenuParentEl.style.display = "none";
      chrome.storage.local.get(["blocked_users"], (res) => {
        if (chrome.runtime?.lastError) return;
        let currentList = res.blocked_users || [];
        currentList = currentList.filter(
          (item) => String(item.member_num) !== String(memberId),
        );
        chrome.storage.local.set({ blocked_users: currentList }, () => {
          window.location.reload();
        });
      });
    });
  } else {
    blockItem.innerHTML = `<a href="#" style="color: #${blockColor}; font-weight: bold;">차단</a>`;
    blockItem.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      popupMenuParentEl.style.display = "none";
      openBlockModal(nickname, memberId);
    });
  }
  popupMenuEl.appendChild(memoLi);
  popupMenuEl.appendChild(blockItem);
}

const popupObserver = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const hasNewDogcon = node.querySelector?.(
            "img.dogcon-clickable, img[data-dogcon-srl]",
          );
          const hasNewMemberLink = node.querySelector?.('a[class*="member_"]');
          if (
            hasNewDogcon ||
            hasNewMemberLink ||
            (node.className &&
              node.className.includes("ext-blind-container")) ||
            (node.tagName &&
              ["IMG", "DIV", "LI", "TR", "A"].includes(node.tagName))
          ) {
            setTimeout(() => {
              attachBlindToggleEvents(document.body);
              const targetImgs = document.querySelectorAll(
                "img.dogcon-clickable:not([data-ext-processed]), img[data-dogcon-srl]:not([data-ext-processed])",
              );
              if (targetImgs.length > 0 || hasNewMemberLink) {
                executeFilterWithMinTime();
              }
            }, 50);
          }
          // 첨부파일 드롭다운 동적 감지
          const attachMenu = node.matches?.("ul.ed.dropdown-menu")
            ? node
            : node.querySelector?.("ul.ed.dropdown-menu");
          if (attachMenu && !attachMenu.querySelector(".ext-dl-all-btn")) {
            injectDownloadAllButton(attachMenu);
          }
          if (node.id === targetPopupMenuId) {
            handlePopupMenuDetected(node);
          } else {
            const nestedPopup = node.querySelector?.(`#${targetPopupMenuId}`);
            if (nestedPopup) handlePopupMenuDetected(nestedPopup);
          }
        }
      });
    } else if (
      mutation.type === "attributes" &&
      mutation.attributeName === "style"
    ) {
      const targetNode = mutation.target;
      if (targetNode.id === targetPopupMenuId) {
        handlePopupMenuDetected(targetNode);
      }
    }
  }
});

if (document.body) {
  startPopupObservation();
} else {
  document.addEventListener("DOMContentLoaded", startPopupObservation);
}
function startPopupObservation() {
  popupObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style"],
  });
}

// 폰트 주입 팩토리: 확장프로그램 내부 CSS를 개드립 헤더에 꽂아 넣습니다.
function injectPretendardFont() {
  // 1. 첫 번째 폰트 ID를 기준으로 중복 삽입 완벽 방어
  if (document.getElementById("ext-pretendard-static-font")) return;

  const fontList = [
    {
      fontName: "pretendard-static",
      url: "assets/fonts/Pretendard/web/static/pretendard.css",
    },
    {
      fontName: "pretendard-variable",
      url: "assets/fonts/Pretendard/web/variable/pretendardvariable.css",
    },
    {
      fontName: "pretendardJP-static",
      url: "assets/fonts/PretendardJP/web/static/pretendard-jp.css",
    },
    {
      fontName: "pretendardJP-variable",
      url: "assets/fonts/PretendardJP/web/variable/pretendardvariable-jp.css",
    },
  ];

  // 2. head가 아직 생성 전이더라도 html(documentElement) 최상단에 강제 주입
  const targetNode = document.head || document.documentElement;

  fontList.forEach((item) => {
    const fontLink = document.createElement("link");
    fontLink.id = `ext-${item.fontName}-font`;
    fontLink.rel = "stylesheet";

    // chrome.runtime.getURL을 써서 현재 확장프로그램의 '절대 경로' 매핑
    fontLink.href = chrome.runtime.getURL(item.url);

    targetNode.appendChild(fontLink);
  });
}

// 스크립트 실행 즉시 폰트부터 최우선 장전 (깜빡임 원천 차단)
injectPretendardFont();

if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  executeFilterWithMinTime();
} else {
  document.addEventListener("DOMContentLoaded", () => {
    executeFilterWithMinTime();
  });
}
window.addEventListener("load", () => {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
    removeLoadingOverlay();
  } else {
    const overlay = document.getElementById("ext-loading-overlay");
    if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.remove();
      }, 200);
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "Esc") {
    const blockModal = document.getElementById("ext-block-modal");
    if (blockModal && blockModal.style.display === "flex") {
      if (typeof closeBlockModal === "function") {
        closeBlockModal();
      } else {
        blockModal.style.display = "none";
      }
    }

    const memoModal =
      document.getElementById("ext-ext-memo-modal") ||
      document.getElementById("ext-memo-modal");
    if (memoModal && memoModal.style.display === "flex") {
      if (typeof closeUserMemoModal === "function") {
        closeUserMemoModal();
      } else {
        memoModal.style.display = "none";
      }
    }
  }
});

/* ================= 🚀 퀵버튼 패널 ================= */

const COOKIE_URL_QK = "https://www.dogdrip.net";
const THEME_COOKIE_QK = "theme";
const TXT_COOKIE_QK = "txtmode";
const COLOR_CHEME_COOKIE_QK = "rx_color_scheme";

function initQuickPanel() {
  // 구형 도구모음 사용 설정이면 퀵패널 생성하지 않음
  chrome.storage.local.get(["legacyToolbar"], (res) => {
    if (res.legacyToolbar) return;
    _buildQuickPanel();
  });
}

function _buildQuickPanel() {
  // 게시물 여부: 개드립 사이트의 스크롤 퀵버튼 박스가 있으면 게시물
  const isPost = !!document.querySelector("div.eq.button-scroll-tool-box");

  const panel = document.createElement("div");
  panel.id = "ext-quick-panel";

  // 공통 버튼 정의
  const commonBtns = [
    {
      id: "extqk-top",
      icon: "fas fa-arrow-up",
      tooltip: "맨 위로",
      onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    },
    {
      id: "extqk-bottom",
      icon: "fas fa-arrow-down",
      tooltip: "맨 아래로",
      onClick: () =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        }),
    },
    {
      id: "extqk-readability",
      icon: "fas fa-book-open",
      tooltip: "가독성 모드",
      onClick: () => toggleReadabilityMode(),
    },
    {
      id: "extqk-dogcon",
      icon: "far fa-smile-wink",
      tooltip: "개드립콘 절약",
      onClick: () => toggleTxtModeQk(),
    },
    {
      id: "extqk-dark",
      icon: "fas fa-sun",
      tooltip: "다크모드",
      onClick: () => toggleThemeQk(),
    },
  ];

  // 게시물 전용 버튼
  const postBtns = [
    {
      id: "extqk-comment",
      icon: "fas fa-comments",
      tooltip: "댓글 목록",
      onClick: () => {
        const target = document.getElementById("comment_top");
        if (target) target.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      id: "extqk-content",
      icon: "fas fa-align-left",
      tooltip: "본문",
      onClick: () => {
        const target = document.querySelector(".xe_content, .document_79");
        if (target) target.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      id: "extqk-list",
      icon: "fas fa-list-alt",
      tooltip: "목록으로",
      onClick: () => {
        const target = document.getElementById("comment_end");
        if (target) target.scrollIntoView({ behavior: "smooth" });
      },
    },
  ];

  const buttons = isPost ? [...commonBtns, ...postBtns] : commonBtns;

  buttons.forEach(({ id, icon, tooltip, onClick }) => {
    const btn = document.createElement("button");
    btn.id = id;
    btn.className = "ext-qk-btn";
    btn.setAttribute("data-tooltip", tooltip);
    btn.innerHTML = `<span class="ext-qk-label">${tooltip}</span><i class="${icon}"></i>`;
    btn.addEventListener("click", onClick);
    panel.appendChild(btn);
  });

  document.body.appendChild(panel);

  // 초기 상태 반영
  syncQuickPanelState();
}

function syncQuickPanelState() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id)
    return;

  // 가독성 모드
  chrome.storage.local.get(["readabilityMode"], (res) => {
    const isOn = !!res.readabilityMode;
    const btn = document.getElementById("extqk-readability");
    const label = isOn ? "📖 가독성 모드 ON" : "가독성 모드";
    if (isOn) {
      document.documentElement.classList.add("ext-readability-mode");
    } else {
      document.documentElement.classList.remove("ext-readability-mode");
    }
    if (!btn) return;
    btn.classList.toggle("ext-qk-active", isOn);
    btn.setAttribute("data-tooltip", label);
    const labelEl = btn.querySelector(".ext-qk-label");
    if (labelEl) labelEl.textContent = label;
  });

  chrome.runtime.sendMessage(
    { type: "GET_COOKIE", name: THEME_COOKIE_QK },
    (res) => {
      const btn = document.getElementById("extqk-dark");
      if (!btn) return;
      const isDark = res && res.value === "b";
      const label = isDark ? "🌙 다크모드 ON" : "다크모드";
      btn.classList.toggle("ext-qk-active", isDark);
      btn.setAttribute("data-tooltip", label);
      const labelEl = btn.querySelector(".ext-qk-label");
      if (labelEl) labelEl.textContent = label;
      const iconEl = btn.querySelector("i");
      if (iconEl) iconEl.className = isDark ? "fas fa-moon" : "fas fa-sun";
    },
  );

  chrome.runtime.sendMessage(
    { type: "GET_COOKIE", name: TXT_COOKIE_QK },
    (res) => {
      const btn = document.getElementById("extqk-dogcon");
      if (!btn) return;
      const isTxt = res && res.value === "1";
      const label = isTxt ? "😶 개드립콘 절약 ON" : "개드립콘 절약";
      btn.classList.toggle("ext-qk-active", isTxt);
      btn.setAttribute("data-tooltip", label);
      const labelEl = btn.querySelector(".ext-qk-label");
      if (labelEl) labelEl.textContent = label;
      const iconEl = btn.querySelector("i");
      if (iconEl)
        iconEl.className = isTxt ? "fas fa-meh-blank" : "far fa-smile-wink";
    },
  );
}

function toggleReadabilityMode() {
  chrome.storage.local.get(["readabilityMode"], (res) => {
    const newVal = !res.readabilityMode;
    chrome.storage.local.set({ readabilityMode: newVal }, () => {
      syncQuickPanelState();
    });
  });
}

function toggleThemeQk() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id)
    return;
  chrome.runtime.sendMessage(
    { type: "GET_COOKIE", name: THEME_COOKIE_QK },
    (res) => {
      const newVal = res && res.value === "b" ? "a" : "b";
      const isDark = newVal === "b";

      // body 클래스 즉시 전환 (새로고침 전 깜빡임 방지)
      document.body.classList.toggle("color_scheme_dark", isDark);
      document.body.classList.toggle("color_scheme_light", !isDark);

      chrome.runtime.sendMessage(
        { type: "SET_COOKIE", name: THEME_COOKIE_QK, value: newVal },
        () => {
          syncQuickPanelState();
          window.location.reload();
        },
      );
    },
  );
  chrome.runtime.sendMessage(
    { type: "GET_COOKIE", name: COLOR_CHEME_COOKIE_QK },
    (res) => {
      const newVal = res && res.value === "light" ? "dark" : "light";
      const isDark = newVal === "dark";

      chrome.runtime.sendMessage(
        { type: "SET_COOKIE", name: COLOR_CHEME_COOKIE_QK, value: newVal },
        () => {
          syncQuickPanelState();
          window.location.reload();
        },
      );
    },
  );
}

function toggleTxtModeQk() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id)
    return;
  chrome.runtime.sendMessage(
    { type: "GET_COOKIE", name: TXT_COOKIE_QK },
    (res) => {
      const newVal = res && res.value === "1" ? "0" : "1";
      chrome.runtime.sendMessage(
        { type: "SET_COOKIE", name: TXT_COOKIE_QK, value: newVal },
        () => {
          syncQuickPanelState();
          window.location.reload();
        },
      );
    },
  );
}

// DOMContentLoaded 이후 패널 삽입
if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  initQuickPanel();
} else {
  document.addEventListener("DOMContentLoaded", initQuickPanel);
}
