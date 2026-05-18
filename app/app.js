/**
 * 개드립(dogdrip.net) 전용 통합 차단 필터 & 레이아웃 제어 스크립트 (js/app.js)
 */

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

let targetNicknameToBlock = "";
let currentActiveDogconData = null;

// 3. 종합 필터링 및 레이아웃 제어 집행부
function executeFilterWithMinTime() {
  const minTimePromise = new Promise((resolve) => setTimeout(resolve, 1000));

  const filterPromise = new Promise((resolve) => {
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
        "contentWidth", // 💡 스토리지 데이터 수집 활성화
      ],
      (result) => {
        const filterKeywords = result.keywords || [];
        const filterNicknames = result.nicknames || [];
        const blockedDogcons = result.blockedDogcons || [];
        const blockedDogconGroups = result.blockedDogconGroups || [];

        const blockedDogconIds = blockedDogcons.map((item) => item.id);
        const blockedDogconGroupIds = blockedDogconGroups.map(
          (item) => item.id,
        );

        // ==========================================
        // 💡 [초고속 렌더링 스위칭 클래스 및 동적 폭 변수 주입]
        // ==========================================
        const htmlEl = document.documentElement;
        if (htmlEl) {
          // 사용자가 설정한 가변 넓이 텍스트 값이 존재한다면 CSS 전역 변수로 즉시 강제 바인딩
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

        // ① 웹진형 레이아웃 필터링
        document.querySelectorAll("li.webzine").forEach((article) => {
          const titleElement = article.querySelector(".title-link");
          const nicknameElement = article.querySelector('a[class*="member_"]');
          let shouldRemove = false;

          if (titleElement && filterKeywords.length > 0) {
            const titleText = titleElement.textContent.trim();
            if (filterKeywords.some((keyword) => titleText.includes(keyword)))
              shouldRemove = true;
          }
          if (!shouldRemove && nicknameElement && filterNicknames.length > 0) {
            const nicknameText = nicknameElement.textContent.trim();
            if (filterNicknames.some((nick) => nicknameText.includes(nick)))
              shouldRemove = true;
          }
          if (shouldRemove) article.remove();
        });

        // ② 최근 게시물 목록 필터링
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

        // ③ 페이지별 인기글 목록 필터링
        if (filterKeywords.length > 0) {
          document.querySelectorAll("li span.title a").forEach((link) => {
            const titleText = link.textContent.trim();
            if (filterKeywords.some((keyword) => titleText.includes(keyword))) {
              const parentLi = link.closest("li");
              if (parentLi) parentLi.remove();
            }
          });
        }

        // ④ 테이블형 레이아웃 필터링
        document.querySelectorAll("tr.ed").forEach((row) => {
          const titleElement = row.querySelector(".title");
          const authorElement = row.querySelector(".author");
          let shouldRemove = false;

          if (titleElement && filterKeywords.length > 0) {
            const titleText = titleElement.textContent.trim();
            if (filterKeywords.some((keyword) => titleText.includes(keyword)))
              shouldRemove = true;
          }
          if (!shouldRemove && authorElement && filterNicknames.length > 0) {
            const authorText = authorElement.textContent.trim();
            if (filterNicknames.some((nick) => authorText.includes(nick)))
              shouldRemove = true;
          }
          if (shouldRemove) row.remove();
        });

        // ⑤ 댓글 영역 필터링 및 직접 차단 버튼 주입
        document.querySelectorAll(".ed.comment-content").forEach((comment) => {
          const nicknameElement = comment.querySelector('a[class*="member_"]');
          if (nicknameElement) {
            const nicknameText = nicknameElement.textContent.trim();
            if (filterNicknames.some((nick) => nicknameText.includes(nick))) {
              comment.remove();
              return;
            }

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
                  openBlockModal(nicknameText);
                });
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
            const blockLi = document.createElement("li");
            blockLi.innerHTML = `<a class="ext-block-menu-item" href="#popup_menu_area" onclick="return false;"><span class="ed icon"><i class="fas fa-user-slash"></i></span> 이 사용자 차단</a>`;
            blockLi.querySelector("a").addEventListener("click", (e) => {
              e.preventDefault();
              openBlockModal(authorNickname);
            });
            dropdownMenu.insertBefore(blockLi, dropdownMenu.firstChild);
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

        // ⑧ 추천기능 비활성화 세부 필터링 처리 (disableVote)
        if (result.disableVote === true) {
          // 테이블형 게시판 목록 추천수 교체
          document
            .querySelectorAll("td.ed.voteNum.text-primary")
            .forEach((td) => {
              if (!td.dataset.extVoteProcessed) {
                td.dataset.extVoteProcessed = "true";
                td.innerHTML = '<i class="fas fa-baby"></i>';
              }
            });

          // 웹진형 게시판 목록 추천 요소 아기콘 치환 및 숫자 삭제
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

          // 🛠️ 댓글 영역 추천/비추천 버튼 처리 및 뇌절 부모 span 구조 분쇄 평탄화
          document.querySelectorAll("a.votebtn").forEach((btn) => {
            if (btn.dataset.extVoteProcessed) return;
            btn.dataset.extVoteProcessed = "true";

            if (btn.getAttribute("title") === "추천") {
              const icon = btn.querySelector("i");
              if (icon) icon.className = "fas fa-baby";

              // 내부에 생존해 있던 자식 숫자 count 엘리먼트 저격 소멸
              const countSpan = btn.querySelector("span.count");
              if (countSpan) countSpan.remove();

              // 버튼을 부조리하게 감싸고 있던 상위 부모 <span> 레이어를 해체하여 추출 평탄화
              const parentSpan = btn.parentElement;
              if (parentSpan && parentSpan.tagName.toLowerCase() === "span") {
                parentSpan.parentNode.insertBefore(btn, parentSpan);
                parentSpan.remove();
              }
            }

            // 비추천 버트는 흔적도 없이 영구 파괴
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

        // ⑩ [가변 폭 처리] 사용자가 직접 수치 지정을 안 했을 때만 Fallback으로 960px 기본 와이드화 보정 연산 집행
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

document.addEventListener("click", () => {
  const menu = document.getElementById("ext-dogcon-menu");
  if (menu) menu.style.display = "none";
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

// 5. 유저 수동 차단 컨포넌트용 모달 제어
function openBlockModal(nickname) {
  targetNicknameToBlock = nickname;
  const msgEl = document.getElementById("modal-msg");
  const modalEl = document.getElementById("ext-block-modal");
  msgEl.innerHTML = `<strong>${nickname}</strong>님을 차단하시겠습니까?<br />차단 시 대상의 글과 댓글이 보이지 않습니다.`;
  modalEl.style.display = "flex";
}

function closeBlockModal() {
  const modalEl = document.getElementById("ext-block-modal");
  if (modalEl) modalEl.style.display = "none";
  targetNicknameToBlock = "";
}

document.getElementById("modal-confirm-btn").addEventListener("click", () => {
  if (!targetNicknameToBlock) return;
  chrome.storage.local.get(["nicknames"], (result) => {
    const list = result.nicknames || [];
    if (!list.includes(targetNicknameToBlock)) {
      list.push(targetNicknameToBlock);
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

if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  executeFilterWithMinTime();
} else {
  document.addEventListener("DOMContentLoaded", executeFilterWithMinTime);
}
window.addEventListener("load", removeLoadingOverlay);
