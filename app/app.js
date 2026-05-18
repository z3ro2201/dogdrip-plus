/**
 * 개드립(dogdrip.net) 전용 통합 차단 필터 & 레이아웃 제어 스크립트 (js/app.js)
 */

const blockColor = "f43f5e";
const grantColor = "16a34a";

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
        <div class="modal-btns">
            <button id="modal-confirm-btn" class="btn-danger">차단</button>
            <button id="modal-cancel-btn" class="btn-secondary">취소</button>
        </div>
    </div>
`;

const dogconContextMenu = document.createElement("div");
dogconContextMenu.id = "ext-dogcon-menu";
dogconContextMenu.style.display = "none";

// 2. 초기 뼈대 UI 요소 선제 주입 함수
function injectInitialUI() {
  if (
    document.documentElement &&
    !document.getElementById("ext-loading-overlay")
  ) {
    document.documentElement.appendChild(loadingOverlay);
    document.documentElement.appendChild(blockModal);
    document.documentElement.appendChild(dogconContextMenu);
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

// 💡 모달 통신 및 ID 기반 적재용 전역 임시 바구니 확장
let targetNicknameToBlock = "";
let targetMemberIdToBlock = "";
let currentActiveDogconData = null;

let lastClickedUserData = {
  memberId: "",
  nickname: "",
};

// 3. 종합 필터링 및 레이아웃 제어 집행부
function executeFilterWithMinTime() {
  const minTimePromise = new Promise((resolve) => setTimeout(resolve, 1000));

  const filterPromise = new Promise((resolve) => {
    chrome.storage.local.get(
      [
        "keywords",
        "nicknames", // 💡 포맷: ["memberId:닉네임", "memberId:닉네임", ...]
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
        const filterKeywords = result.keywords || [];
        const rawFilterNicknames = result.nicknames || [];
        const blockedDogcons = result.blockedDogcons || [];
        const blockedDogconGroups = result.blockedDogconGroups || [];

        // 💡 [ID 필터 고도화] "memberId:닉네임" 배열에서 memberId만 분리 수집
        const blockedMemberIds = rawFilterNicknames
          .map((item) => {
            if (item.includes(":")) {
              return item.split(":")[0].trim();
            }
            return "";
          })
          .filter((id) => id !== "");

        const blockedDogconIds = blockedDogcons.map((item) => item.id);
        const blockedDogconGroupIds = blockedDogconGroups.map(
          (item) => item.id,
        );

        // ==========================================
        // 💡 [초고속 렌더링 스위칭 클래스 및 동적 폭 변수 주입]
        // ==========================================
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
        }

        // ① 웹진형 레이아웃 필터링 (member_ 뒤의 고유 숫자 분석 저격)
        document.querySelectorAll("li.webzine").forEach((article) => {
          const titleElement = article.querySelector(".title-link");
          const nicknameElement = article.querySelector('a[class*="member_"]');
          let shouldRemove = false;

          if (titleElement && filterKeywords.length > 0) {
            const titleText = titleElement.textContent.trim();
            if (filterKeywords.some((keyword) => titleText.includes(keyword)))
              shouldRemove = true;
          }

          // 💡 [ID 기반 저격] classList 정규식 매칭 대조
          if (!shouldRemove && nicknameElement && blockedMemberIds.length > 0) {
            const match = nicknameElement.className.match(/member_(\d+)/);
            if (match) {
              const currentMemberId = match[1];
              if (blockedMemberIds.includes(currentMemberId))
                shouldRemove = true;
            }
          }
          if (shouldRemove) article.remove();
        });

        // ② 최근 게시물 목록 필터링 (키워드 기준)
        if (filterKeywords.length > 0) {
          document
            .querySelectorAll("li div.eq span.text-link")
            .forEach((span) => {
              const titleText = span.textContent.trim();
              if (
                filterKeywords.some((keyword) => titleText.includes(keyword))
              ) {
                const parentLi = span.closest("li");
                if (parentLi) parentLi.remove();
              }
            });
        }

        // ③ 페이지별 인기글 목록 필터링 (키워드 기준)
        if (filterKeywords.length > 0) {
          document.querySelectorAll("li span.title a").forEach((link) => {
            const titleText = link.textContent.trim();
            if (filterKeywords.some((keyword) => titleText.includes(keyword))) {
              const parentLi = link.closest("li");
              if (parentLi) parentLi.remove();
            }
          });
        }

        // ④ 테이블형 레이아웃 필터링 (tr.ed -> td.author 내부 member_ 고유 ID 저격)
        document.querySelectorAll("tr.ed").forEach((row) => {
          const titleElement = row.querySelector(".title");
          const authorElement = row.querySelector(
            ".author a[class*='member_']",
          );
          let shouldRemove = false;

          if (titleElement && filterKeywords.length > 0) {
            const titleText = titleElement.textContent.trim();
            if (filterKeywords.some((keyword) => titleText.includes(keyword)))
              shouldRemove = true;
          }

          // 💡 [ID 기반 저격] td.author 가변 ID 적발 자동 소멸
          if (!shouldRemove && authorElement && blockedMemberIds.length > 0) {
            const match = authorElement.className.match(/member_(\d+)/);
            if (match) {
              const currentMemberId = match[1];
              if (blockedMemberIds.includes(currentMemberId))
                shouldRemove = true;
            }
          }
          if (shouldRemove) row.remove();
        });

        // ⑤ 댓글 영역 필터링 및 직접 차단 버튼 주입 (댓글도 member_ 고유 번호 저격)
        document.querySelectorAll(".ed.comment-content").forEach((comment) => {
          const nicknameElement = comment.querySelector('a[class*="member_"]');
          if (nicknameElement) {
            const match = nicknameElement.className.match(/member_(\d+)/);
            if (match) {
              const currentMemberId = match[1];
              if (
                blockedMemberIds.length > 0 &&
                blockedMemberIds.includes(currentMemberId)
              ) {
                comment.remove();
                return;
              }

              // 살아남은 댓글 유저에게 수동 차단 단추 바인딩
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
          }
        });

        // ⑥ 게시물 본문 상단 직접 차단 버튼 주입
        const titleToolbar = document.querySelector(".title-toolbar");
        if (titleToolbar) {
          const authorElement = titleToolbar.querySelector(
            'a[class*="member_"]',
          );
          const dropdownMenu = titleToolbar.querySelector("ul.dropdown-menu");

          if (authorElement && dropdownMenu) {
            const authorNickname = authorElement.textContent.trim();
            const match = authorElement.className.match(/member_(\d+)/);

            if (match) {
              const authorMemberId = match[1];

              // 🔒 중복 주입 방어막: 혹시라도 버튼이 이미 생성되어 있다면 선제 제거
              const existingToolbarBtn = dropdownMenu.querySelector(
                ".ext-toolbar-member-block",
              );
              if (existingToolbarBtn) existingToolbarBtn.remove();

              const blockLi = document.createElement("li");
              blockLi.className = "ext-toolbar-member-block"; // 구별용 커스텀 클래스 부여

              // 💡 이미 차단 리스트(blockedMemberIds)에 존재하는 작성자인 경우 ➡️ 녹색 [차단 해제] 주입
              if (blockedMemberIds.includes(authorMemberId)) {
                blockLi.innerHTML = `<a class="ext-block-menu-item" href="#popup_menu_area" onclick="return false;" style="color: #${grantColor}; font-weight: bold;"><span class="ed icon"><i class="fas fa-user-check"></i></span> 차단 해제</a>`;

                blockLi.querySelector("a").addEventListener("click", (e) => {
                  e.preventDefault();

                  // 컨텍스트 파괴 방어막
                  if (
                    typeof chrome === "undefined" ||
                    !chrome.runtime ||
                    !chrome.runtime.id
                  ) {
                    window.location.reload();
                    return;
                  }

                  // 스토리지에서 해당 ID만 싹 필터링해서 날려버리고 즉시 새로고침
                  chrome.storage.local.get(["nicknames"], (res) => {
                    let currentList = res.nicknames || [];
                    currentList = currentList.filter(
                      (item) => !item.startsWith(`${authorMemberId}:`),
                    );

                    chrome.storage.local.set({ nicknames: currentList }, () => {
                      window.location.reload();
                    });
                  });
                });
              }

              // 💡 아직 차단되지 않은 일반 작성자인 경우 ➡️ 기존 빨간색 [이 사용자 차단] 모달 연결
              else {
                blockLi.innerHTML = `<a class="ext-block-menu-item" href="#popup_menu_area" onclick="return false;" style="color: #${blockColor}; font-weight: bold;"><span class="ed icon"><i class="fas fa-user-slash"></i></span> 차단</a>`;

                blockLi.querySelector("a").addEventListener("click", (e) => {
                  e.preventDefault();
                  openBlockModal(authorNickname, authorMemberId);
                });
              }

              // 순정 드롭다운 메뉴의 가장 첫 번째 항목(insertBefore)으로 안착시킵니다.
              dropdownMenu.insertBefore(blockLi, dropdownMenu.firstChild);
            }
          }
        }

        // ⑦ 개드립콘 실시간 처리 구역
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
            blockDiv.innerHTML = `
                        🚫 <span>${title} (${alt}) 차단됨</span>
                        <a href="${infoUrl}" target="_blank" class="dogcon-info-link" style="margin-left:6px; color:#0284c7; text-decoration:underline; font-weight:bold;">[ℹ️ 정보]</a>
                    `;
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

        // ⑧ 추천기능 비활성화 세부 필터링 처리
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
            if (icon.dataset.extVoteProcessed) return;
            icon.dataset.extVoteProcessed = "true";
            icon.className = "fas fa-baby";

            const iconParentSpan = icon.closest("span.text-primary");
            if (iconParentSpan) {
              const nextSpan = iconParentSpan.nextElementSibling;
              if (nextSpan && nextSpan.classList.contains("text-primary")) {
                nextSpan.remove();
              }
            }
          });

          document.querySelectorAll("a.votebtn").forEach((btn) => {
            if (btn.dataset.extVoteProcessed) return;
            btn.dataset.extVoteProcessed = "true";

            if (btn.getAttribute("title") === "추천") {
              const icon = btn.querySelector("i");
              if (icon) icon.className = "fas fa-baby";

              const countSpan = btn.querySelector("span.count");
              if (countSpan) countSpan.remove();

              const parentSpan = btn.parentElement;
              if (parentSpan && parentSpan.tagName.toLowerCase() === "span") {
                parentSpan.parentNode.insertBefore(btn, parentSpan);
                parentSpan.remove();
              }
            }
            if (btn.getAttribute("title") === "비추천") {
              btn.remove();
            }
          });

          document.querySelectorAll("a.comment-item-tool").forEach((link) => {
            link.classList.remove("border-left-dotted");
          });
        }

        // ⑨ 유튜브 임베드 영상 알고리즘 방어 루틴 집행
        if (result.preventYoutubeAlgorithm === true) {
          document
            .querySelectorAll('iframe[src*="youtube.com/embed/"]')
            .forEach((iframe) => {
              if (iframe.dataset.extYoutubeProcessed) return;
              iframe.dataset.extYoutubeProcessed = "true";

              const currentSrc = iframe.getAttribute("src");
              if (currentSrc) {
                const secureSrc = currentSrc.replace(
                  "youtube.com/embed/",
                  "youtube-nocookie.com/embed/",
                );
                iframe.setAttribute("src", secureSrc);
              }
            });
        }

        // ⑩ [가변 폭 처리]
        if (!result.contentWidth || result.contentWidth.trim() === "") {
          document.querySelectorAll(".container").forEach((el) => {
            el.style.maxWidth = "960px";
          });
        }

        resolve();
      },
    );
  });

  Promise.all([minTimePromise, filterPromise]).then(() => {
    removeLoadingOverlay();
  });
}

// 4. 개드립콘용 컨텍스트 메뉴 오버레이 연산 제어
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
  const infoMenuItemHtml = `
        <div style="border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 4px;">
            <a href="${infoUrl}" target="_blank" class="dogcon-menu-item" style="text-decoration: none; color: #475569;">
                <span>🔗 ${currentActiveDogconData.title} 정보</span>
            </a>
        </div>
    `;

  if (currentActiveDogconData.isGroupBlocked) {
    menu.innerHTML = `<div class="dogcon-menu-item ${groupClass}" id="ext-dogcon-action-group">${groupActionText}</div>${infoMenuItemHtml}`;
  } else {
    menu.innerHTML = `
            <div class="dogcon-menu-item ${singleClass}" id="ext-dogcon-action-single">${singleActionText}</div>
            <div class="dogcon-menu-item ${groupClass}" id="ext-dogcon-action-group">${groupActionText}</div>
            ${infoMenuItemHtml}
        `;
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

// 💡 닉네임 클릭 수집용 통합 이벤트 리스너 리팩토링 구역
document.addEventListener("click", (event) => {
  const menu = document.getElementById("ext-dogcon-menu");
  if (menu) menu.style.display = "none";

  const userLink = event.target.closest("a[class*='member_']");

  if (userLink) {
    const nickname = userLink.textContent.trim();
    const match = userLink.className.match(/member_(\d+)/);

    if (match) {
      const memberId = match[1];
      lastClickedUserData.memberId = memberId;
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

// 5. 유저 수동 차단 컴포넌트용 모달 제어
function openBlockModal(nickname, memberId) {
  targetNicknameToBlock = nickname;
  targetMemberIdToBlock = memberId; // 고유 번호 바인딩 적재
  const msgEl = document.getElementById("modal-msg");
  const modalEl = document.getElementById("ext-block-modal");
  msgEl.innerHTML = `<strong>${nickname}${memberId ? `(${memberId})` : ""}</strong>님을 차단하시겠습니까?<br />차단 시 대상의 글과 댓글이 보이지 않습니다.<br />(닉네임이 변경되어도 해당 유저는 계속 차단됩니다.)`;
  modalEl.style.display = "flex";
}

function closeBlockModal() {
  const modalEl = document.getElementById("ext-block-modal");
  if (modalEl) modalEl.style.display = "none";
  targetNicknameToBlock = "";
  targetMemberIdToBlock = "";
}

// [ID 기반 축출 저장 및 컨텍스트 파괴 방어 적용 리스너]
document.getElementById("modal-confirm-btn").addEventListener("click", () => {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
    alert(
      "📢 확장프로그램이 업데이트되었습니다!\n정상적인 차단 등록을 위해 페이지 새로고침(F5)을 진행합니다.",
    );
    window.location.reload();
    return;
  }

  if (!targetNicknameToBlock || !targetMemberIdToBlock) {
    closeBlockModal();
    return;
  }

  const blockStorageValue = `${targetMemberIdToBlock}:${targetNicknameToBlock}`;

  chrome.storage.local.get(["nicknames"], (result) => {
    if (chrome.runtime?.lastError) return;
    const list = result.nicknames || [];

    const isAlreadyExist = list.some((item) =>
      item.startsWith(`${targetMemberIdToBlock}:`),
    );

    if (!isAlreadyExist) {
      list.push(blockStorageValue);
      chrome.storage.local.set({ nicknames: list }, () => {
        closeBlockModal();
        window.location.reload();
      });
    } else {
      closeBlockModal();
    }
  });
});

document
  .getElementById("modal-cancel-btn")
  .addEventListener("click", closeBlockModal);

function removeLoadingOverlay() {
  const overlay = document.getElementById("ext-loading-overlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.remove();
    }, 200);
  }
}

/**
 * =========================================================================
 * ⚙️ 개드립 회원 팝업 메뉴(div#popup_menu_area) 실시간 감지 및 차단/해제 스위칭 주입 구역
 * =========================================================================
 */
const targetPopupMenuId = "popup_menu_area";

function handlePopupMenuDetected(popupElement) {
  const currentDisplay = window.getComputedStyle(popupElement).display;
  if (currentDisplay === "none") return;

  if (lastClickedUserData.memberId) {
    // 💡 [비동기 실시간 대조] 이미 차단된 멤버인지 검사 후 토글 분기 처리
    chrome.storage.local.get(["nicknames"], (result) => {
      if (chrome.runtime?.lastError || !chrome.runtime || !chrome.runtime.id)
        return;
      const list = result.nicknames || [];

      const isAlreadyBlocked = list.some((item) =>
        item.startsWith(`${lastClickedUserData.memberId}:`),
      );

      insertMemberMenu(
        lastClickedUserData.memberId,
        lastClickedUserData.nickname,
        isAlreadyBlocked,
      );
    });
  }
}

function insertMemberMenu(memberId, nickname, isAlreadyBlocked) {
  const popupMenuParentEl = document.getElementById("popup_menu_area");
  if (!popupMenuParentEl) return;

  const popupMenuEl = popupMenuParentEl.querySelector("ul");
  if (!popupMenuEl) return;

  // 🔒 [중복 주입 청소] 와리가리 연속 클릭 시 찌꺼기가 쌓이지 않도록 선제거 집행
  const existingBtn = popupMenuEl.querySelector(".ext-inserted-member-block");
  if (existingBtn) existingBtn.remove();

  const blockItem = document.createElement("li");
  blockItem.className = "ext-inserted-member-block";

  // 💡 1. 이미 차단된 멤버일 때 ➡️ 녹색 "차단 해제" 메뉴 빌드 및 즉시 실행 연동
  if (isAlreadyBlocked) {
    blockItem.innerHTML = `<a href="#" style="color: #${grantColor}; font-weight: bold;">차단 해제</a>`;

    blockItem.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      popupMenuParentEl.style.display = "none";

      chrome.storage.local.get(["nicknames"], (res) => {
        if (chrome.runtime?.lastError) return;
        let currentList = res.nicknames || [];
        currentList = currentList.filter(
          (item) => !item.startsWith(`${memberId}:`),
        );

        chrome.storage.local.set({ nicknames: currentList }, () => {
          window.location.reload();
        });
      });
    });
  }
  // 💡 2. 아직 안 막힌 일반 유저일 때 ➡️ 기존 빨간색 차단 컴포넌트 모달 연동
  else {
    blockItem.innerHTML = `<a href="#" style="color: #${blockColor}; font-weight: bold;">차단</a>`;

    blockItem.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      popupMenuParentEl.style.display = "none";
      openBlockModal(nickname, memberId);
    });
  }

  popupMenuEl.appendChild(blockItem);
}

const popupObserver = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.id === targetPopupMenuId) {
            handlePopupMenuDetected(node);
          } else {
            const nestedPopup = node.querySelector(`#${targetPopupMenuId}`);
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

if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  executeFilterWithMinTime();
} else {
  // 💡 [오류 수정] 불필요하게 꼬여있던 뒤쪽 호출용 소괄호 기호() 탈탈 털어 청소 완료
  document.addEventListener("DOMContentLoaded", executeFilterWithMinTime);
}
window.addEventListener("load", removeLoadingOverlay);
