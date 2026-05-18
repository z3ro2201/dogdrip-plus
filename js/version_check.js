/**
 * 개드립 Plus + - 전역 원격 버전 교차 검증 엔진 (js/version_check.js)
 */

const REMOTE_VERSION_URL =
  "https://raw.githubusercontent.com/z3ro2201/dogdrip-plus/refs/heads/main/version.txt";

// 💡 버전을 비교 가능한 정수형 가중치 숫자로 변환 (parseFloat의 마침표 컷 버그 우회)
function getVersionWeightNumber(versionStr) {
  if (!versionStr) return 0;
  const parts = versionStr
    .replace(/[vV\s]/g, "")
    .split(".")
    .map(Number);

  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;

  // 자릿수 가중치 부여 (예: 1.0.1 -> 1000000 + 0 + 1 = 1000001)
  return major * 1000000 + minor * 1000 + patch;
}

// 🚀 외부에서 호출할 마스터 버전 체크 실행 함수
function execFilterVersionCheck() {
  // 1. 현재 로컬 설치 버전 파싱 및 UI 표기
  const manifestData = chrome.runtime.getManifest();
  const currentVersion = manifestData.version;

  const versionTagEl = document.getElementById("ext-version");
  if (versionTagEl) {
    versionTagEl.innerText = `v ${currentVersion}`;
  }

  // 2. 깃허브 원격 서버 마스터 버전 획득
  fetch(REMOTE_VERSION_URL)
    .then((response) => {
      if (!response.ok) throw new Error("네트워크 응답 불량");
      return response.text();
    })
    .then((remoteRawText) => {
      const remoteVersionStr = remoteRawText.trim();

      const localWeight = getVersionWeightNumber(currentVersion);
      const remoteWeight = getVersionWeightNumber(remoteVersionStr);

      // 3. 정수형 대소 비교 연산 집행 (가장 안전한 대조 기믹)
      if (remoteWeight > localWeight) {
        const updateLinkEl = document.getElementById("check-update-link");
        if (updateLinkEl) {
          // 원격에 기입된 순정 텍스트(예: v 1.0.1)를 발라내어 노출
          updateLinkEl.innerText = `🔥 새 버전 발견 (${remoteVersionStr}) 업데이트 하러가기`;
          updateLinkEl.style.color = "#ea580c";
          updateLinkEl.style.fontWeight = "800";
        }
      }
    })
    .catch((err) => console.warn("원격 버전 조회를 스킵합니다:", err.message));
}
