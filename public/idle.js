// --- Standby / Idle Mode Logic ---

const IDLE_TIMEOUT = 30000; // 30 秒閒置進入待機
let idleTimer = null;
let factIndex = 0;

const ECO_FACTS = [
  "海龜可以憋氣長達幾小時，但如果被廢棄漁網纏住，它們會淹死。",
  "全世界每年有超過 800 萬噸塑膠垃圾流入海洋。",
  "你家門口的排水孔，終點可能就是幾百公里外的珊瑚礁。",
  "北太平洋垃圾帶的面積，已經是台灣的 40 倍大。",
  "一支塑膠吸管需要 200 年才能分解，但我們使用它通常不超過 20 分鐘。",
  "海鳥常誤把塑膠碎片當成食物，最終導致營養不良而死亡。",
  "到 2050 年，海洋中塑膠的重量可能會超過魚類的總重量。",
  "自備環保杯，一年平均可以減少約 500 個一次性紙杯與塑膠杯的使用。",
  "微塑膠已經進入了食物鏈，最後會回到人類的餐桌上。",
  "台灣海岸線總長約 1,200 公里，每一吋都需要我們的守護。",
  "海洋產生了地球上 50% 的氧氣，它就是地球的肺。",
  "珊瑚礁雖然僅佔海洋面積的 0.1%，卻供養了 25% 的海洋生物。",
  "一公克的防曬乳成分，就足以讓一片珊瑚白化。",
  "海洋吸收了人類活動產生的大部分多餘熱量，緩解了氣候變遷。",
  "塑膠袋在海中看起來很像水母，這對海龜來說是致命的誘惑。",
  "台灣的減塑政策目標是在 2030 年全面禁用一次性塑膠製品。",
  "每一個回收的寶特瓶，都能減少石油資源的消耗。",
  "海洋深處的垃圾，可能需要幾千年甚至更久才能消失。",
  "減廢行動不是限制，而是一種對未來生活的負責態度。",
  "你的每一次自備行動，都是在為你想要的世界投票。",
  "藍鯨是地球上最大的動物，但也受困於海洋塑膠污染。",
  "紅樹林是天然的海岸衛士，能抵禦海嘯並淨化水質。",
  "減少肉類攝取，也能間接減少工業畜牧對水資源的污染。",
  "支持在地環保店家，是活絡地方創生與永續發展的關鍵。",
  "美麗的照片背後，需要我們用行動去維持那片風景。",
  "海洋不分國界，我們排放的廢水會隨著洋流環遊世界。",
  "一隻成熟的生蠔一天能過濾多達 190 公升的水。",
  "海洋最深處——馬里亞納海溝，也發現了塑膠垃圾的蹤跡。",
  "永續漁業能確保我們的下一代依然有魚可吃。",
  "減少購買過度包裝的產品，從源頭減少垃圾產生。",
  "海洋資源並非取之不盡，用之不竭，它是有限且脆弱的。",
  "氣候變遷導致的海平面上升，正威脅著低窪島國的生存。",
  "海洋保護區的建立，能顯著提升周邊海域的生物多樣性。",
  "你的每一個微小選擇，累積起來就是巨大的改變。",
  "環保生活不代表不方便，它代表著更純粹與有意義的生活方式。",
  "台灣的白海豚數量極其稀少，保護它們的棲息地迫在眉睫。",
  "廢棄電池如果隨意丟棄，其中的重金屬會嚴重污染地下水與海洋。",
  "海洋廢棄物中，菸蒂是數量最多的單一品項之一。",
  "使用純棉或天然纖維衣物，能減少洗衣時產生的微纖維污染。",
  "參與淨灘活動，是親身體驗海洋污染現狀的最好方式。",
  "節約用水也是保護海洋，因為處理廢水需要耗費大量的能源。",
  "拒絕購買珊瑚、海龜殼等野生動物製品。",
  "了解你所居住城市的排水系統，看看它們流向哪片海。",
  "海洋是所有生命的起源，守護海洋就是守護我們自己。",
  "美麗的夕陽海景，不應該伴隨著沙灘上的垃圾。",
  "鼓勵身邊的朋友一起加入減塑行列，影響力會倍增。",
  "環保是一種愛，是對自然萬物的溫柔相待。",
  "海洋的聲音能撫慰心靈，我們不應讓它充滿引擎的噪音。",
  "台灣的離岸風電發展，需在能源轉型與生態保護間取得平衡。",
  "每一次拒絕使用塑膠袋，都是對大海的一次致謝。",
  "讓我們一起守護這片海，讓它永遠美麗下去。"
];

function resetIdleTimer() {
  clearTimeout(idleTimer);
  hideIdleScreen();
  idleTimer = setTimeout(showIdleScreen, IDLE_TIMEOUT);
}

function showIdleScreen() {
  const screen = document.getElementById('idle-screen');
  screen.style.display = 'flex';
  startFactCycle();
}

function hideIdleScreen() {
  const screen = document.getElementById('idle-screen');
  screen.style.display = 'none';
  stopFactCycle();
}

let cycleInterval = null;

function startFactCycle() {
  const content = document.getElementById('idle-content');
  const rotate = () => {
    content.innerText = ECO_FACTS[factIndex];
    factIndex = (factIndex + 1) % ECO_FACTS.length;
  };
  rotate();
  clearInterval(cycleInterval);
  cycleInterval = setInterval(rotate, 10000);
}

function stopFactCycle() {
  clearInterval(cycleInterval);
}

// 監聽各種互動事件
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(name => {
  document.addEventListener(name, resetIdleTimer, true);
});

// 初始化計時器
resetIdleTimer();
