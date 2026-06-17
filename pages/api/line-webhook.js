import { Client } from '@line/bot-sdk';
import crypto from 'crypto';
import { supabase } from '../../lib/supabase';

// 停用 Next.js 的預設 bodyParser，以便讀取原始 Request Body 進行 LINE 簽章驗證
export const config = {
  api: {
    bodyParser: false,
  },
};

// 讀取環境變數，若無則使用提供好的真實金鑰
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '35247eb3ad1aa7e748c11cf5c17f1e4d';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dLMnahck3kseitiWmMu8Y8zLcTsfYnn01BiUA5rJ4JTV208lhF2KVtI4qntpo/26peCRGkNd6apPXH79oBetYFj762vRd7w6ovaefNxHBQV9MD14aCktvO4+9ZwZ6B0qfkz79QWVb1h25uuxEB4b/gdB04t89/1O/w1cDnyilFU=';

// 初始化 LINE Bot SDK Client
const lineClient = new Client({
  channelAccessToken: CHANNEL_ACCESS_TOKEN,
  channelSecret: CHANNEL_SECRET,
});

// 毒舌金句庫 (融合微塑膠大腦病變等健康恐懼訴求)
const TOXIC_QUOTES = [
  '打卡成功！你今天拯救了 10g 塑膠。不過你知道你大腦裡可能已經累積了無數微塑膠嗎？沒關係，反正大腦病變、記憶退化只是早晚的事，繼續加油喔！🐢',
  '感謝你的減塑打卡。不過，海龜被塑膠吸管卡住氣管，跟你血管被微塑膠填滿堵塞，其實也差不了多少。祝你健康！💀',
  '打卡完成，累計減塑 +10g。你知道塑化劑會透過食物鏈再流回你的餐桌嗎？你今天少丟的塑膠，可能明天就在你自帶餐盒的便當裡了。🐢',
  '恭喜！海龜今天稍微能喘口氣。但你每天喝的瓶裝水裡，含有上百萬顆奈米級微塑膠。它們現在可能正在穿過你的血腦屏障、進入神經元裡散步呢。🧠',
  '打卡成功。但別高興太早，微塑膠已經在人類的心臟、血液跟大腦中被發現。你現在才自備環保杯，是在跟體內的微塑膠妥協嗎？🐢',
  '打卡紀錄完成。海龜雖然不用被網袋纏住，但你體內的微塑膠已經在干擾你的內分泌了。別擔心，反正大家都一樣，對吧？💀'
];

// 雙北特約店假資料
const DUMMY_SHOPS = `【海龜特約 雙北無塑店家清單】
1. 減塑綠洲 (台北市大安區新生南路三段90號) 
   - 優惠：自備杯折 10 元
2. 龜途咖啡 (新北市板橋區文化路二段120號) 
   - 優惠：自備容器外帶享 9 折
3. 珊瑚樹小館 (台北市信義區忠孝東路五段300號) 
   - 優惠：不主動提供一次性餐具，消費滿百送海龜貼紙
4. 綠色角落 (新北市永和區中正路450號) 
   - 優惠：自備購物袋享現折 5 元
* 請向店員出示 LINE 條碼或掃描店內打卡碼，即可完成減塑打卡！🐢`;

// 輔助函式：自 Raw Request 讀取原始的 Body Buffer
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const rawBody = await getRawBody(req);
    const bodyString = rawBody.toString('utf-8');

    // 1. 驗證 LINE 簽章，防止惡意請求
    const signature = req.headers['x-line-signature'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const hash = crypto
      .createHmac('sha256', CHANNEL_SECRET)
      .update(rawBody)
      .digest('base64');

    if (hash !== signature) {
      console.error('Signature verification failed');
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // 解析 Webhook 傳來的事件內容
    const { events } = JSON.parse(bodyString);

    // 2. 依序處理每個事件
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();
        const lineUid = event.source.userId;

        if (!lineUid) continue;

        // 邏輯判定一：查詢附近店家
        if (text.startsWith('#查詢附近店家')) {
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: DUMMY_SHOPS,
          });
        } 
        // 邏輯判定二：實體掃碼打卡成功
        else if (text.startsWith('#SCAN_SHOP_')) {
          // A. 查詢 Supabase 確認使用者是否存在
          const { data: user, error: selectError } = await supabase
            .from('users')
            .select('*')
            .eq('line_uid', lineUid)
            .single();

          const now = new Date().toISOString();

          if (selectError && selectError.code !== 'PGRST116') {
            // PGRST116 代表找不到該 rows (無此使用者)
            console.error('Database query error:', selectError);
            throw selectError;
          }

          if (user) {
            // 使用者已存在：更新打卡天數歸零、狀態恢復為 2 (健康)、累計公克 + 10、更新打卡時間
            const { error: updateError } = await supabase
              .from('users')
              .update({
                continuous_inactive_days: 0,
                turtle_status: 2,
                total_saved_grams: (user.total_saved_grams || 0) + 10,
                last_scan_date: now,
              })
              .eq('line_uid', lineUid);

            if (updateError) throw updateError;
          } else {
            // 使用者不存在：直接新增預設值 (累計公克為 10，狀態為 2)
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                line_uid: lineUid,
                turtle_status: 2,
                continuous_inactive_days: 0,
                total_saved_grams: 10,
                last_scan_date: now,
              });

            if (insertError) throw insertError;
          }

          // B. 從「毒舌金句庫」隨機抽出海龜厭世恐懼金句
          const randomQuote = TOXIC_QUOTES[Math.floor(Math.random() * TOXIC_QUOTES.length)];

          // C. 使用 LINE replyMessage 回傳給使用者
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: randomQuote,
          });
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
