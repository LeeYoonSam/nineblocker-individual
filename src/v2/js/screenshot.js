// html2canvas 기반 스크린샷 캡처

async function captureScreenshot(elementId, filename) {
  const element = document.getElementById(elementId);
  if (!element) return;

  // html2canvas CDN 동적 로드
  if (typeof html2canvas === 'undefined') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0a0a1a',
      scale: 2,
      useCORS: true,
    });

    const link = document.createElement('a');
    link.download = filename || 'nineblockers-screenshot.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (e) {
    console.error('스크린샷 캡처 실패:', e);
    alert('스크린샷 캡처에 실패했습니다.');
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
