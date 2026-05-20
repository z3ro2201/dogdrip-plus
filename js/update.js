/**
 * 개드립 Plus + 업데이트 알림 페이지 스크립트 (js/update.js)
 */

const version = chrome.runtime.getManifest().version;

document.getElementById("version-badge").textContent = "v" + version;
document.getElementById("subtitle").textContent =
  "v" + version + " 버전으로 업데이트 되었습니다.";

document.getElementById("close-btn").addEventListener("click", () => {
  window.close();
});

fetch(chrome.runtime.getURL("update.txt"))
  .then((r) => r.text())
  .then((text) => {
    const notes = parseVersionNotes(text, version);
    renderNotes(notes);
  })
  .catch(() => {
    document.getElementById("notes-container").innerHTML =
      '<p class="error">업데이트 노트를 불러오지 못했습니다.</p>';
  });

function parseVersionNotes(text, ver) {
  const versionHeader = "[v" + ver + "]";
  const startIdx = text.indexOf(versionHeader);
  if (startIdx === -1) return null;

  const nextVersionIdx = text.indexOf("\n[v", startIdx + 1);
  const block =
    nextVersionIdx === -1
      ? text.slice(startIdx)
      : text.slice(startIdx, nextVersionIdx);

  const lines = block.split("\n").map((l) => l.replace(/\r$/, "").trim());
  const result = { headline: "", sections: [] };
  let currentSection = null;

  lines.forEach((line, i) => {
    if (i === 0) return;
    if (line.startsWith("---")) return;
    if (line.startsWith("🚀 주요 내용:")) {
      result.headline = line.replace("🚀 주요 내용:", "").trim();
      return;
    }
    if (/^\[(Added|Fixed|Changed|Removed)\]$/.test(line)) {
      currentSection = { type: line.slice(1, -1), items: [] };
      result.sections.push(currentSection);
      return;
    }
    if (line.startsWith("-") && currentSection) {
      currentSection.items.push(line.slice(1).trim());
    } else if (line.startsWith("*") && currentSection) {
      const last = currentSection.items[currentSection.items.length - 1];
      if (last !== undefined) {
        currentSection.items[currentSection.items.length - 1] =
          last + "\n  · " + line.slice(1).trim();
      }
    }
  });

  return result;
}

function renderNotes(notes) {
  const container = document.getElementById("notes-container");
  if (!notes) {
    container.innerHTML =
      '<p style="color:#94a3b8;font-size:13px;">이 버전의 업데이트 노트가 없습니다.</p>';
    return;
  }

  const tagMap = {
    Added: { label: "추가", cls: "tag-added" },
    Fixed: { label: "수정", cls: "tag-fixed" },
    Changed: { label: "변경", cls: "tag-changed" },
    Removed: { label: "제거", cls: "tag-removed" },
  };

  let html = "";
  if (notes.headline) {
    html += '<p class="headline">📌 ' + notes.headline + "</p>";
  }

  notes.sections.forEach(function (section) {
    const tag = tagMap[section.type] || { label: section.type, cls: "" };
    html +=
      '<div class="section-title"><span class="tag ' +
      tag.cls +
      '">' +
      tag.label +
      "</span></div>";
    section.items.forEach(function (item) {
      html +=
        '<div class="change-item">' + item.replace(/\n/g, "<br>") + "</div>";
    });
  });

  if (!html) {
    html =
      '<p style="color:#94a3b8;font-size:13px;">상세 변경 내역이 없습니다.</p>';
  }

  container.innerHTML = html;
}
