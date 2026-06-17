import { Client } from '@line/bot-sdk';
import { supabase } from '../../lib/supabase';

// 讀取環境變數，若無則使用提供好的真實金鑰
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '35247eb3ad1aa7e748c11cf5c17f1e4d';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dLMnahck3kseitiWmMu8Y8zLcTsfYnn01BiUA5rJ4JTV208lhF2KVtI4qntpo/26peCRGkNd6apPXH79oBetYFj762vRd7w6ovaefNxHBQV9MD14aCktvO4+9ZwZ6B0qfkz79QWVb1h25uuxEB4b/gdB04t89/1O/w1cDnyilFU=';

// 初始化 LINE Bot SDK Client
const lineClient = new Client({
  channelAccessToken: CHANNEL_ACCESS_TOKEN,
  channelSecret: CHANNEL_SECRET,
});

// 毒舌推播訊息範本
const MSG_SICK = '哈囉？你的孿生海龜已經因為你超過 3 天沒打卡而【生病】了！海水已經變得混濁不堪，牠的大腦神經元正在被微塑膠慢慢侵蝕。看來你對環保的熱情也只持續了三分鐘，真是個三分鐘熱度的廢物人類呢。🐢';
const MSG_DEAD = '【海龜死亡遺言】恭喜你！因為你整整 7 天沒有進行減塑打卡，你的孿生海龜已經不幸【死亡】了。這是一具殘破的黑白骨架，牠的大腦與內臟完全被你製造的微塑膠塞滿。牠最後的遺言是：『祝你在充滿微塑膠的地球裡，慢性病發作愉快，我們地獄見。』💀';

export default async function handler(req, res) {
  // 為了安全防護，此端點預期由 Vercel Cron 排程或帶有安全密鑰的請求呼叫
  const { secret } = req.query;
  const authHeader = req.headers['authorization'];

  // 本地開發或帶有 secret=test 時允許呼叫，否則驗證 Vercel Cron 的 Secret
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    secret !== 'test'
  ) {
    return res.status(401).json({ error: 'Unauthorized call to cron' });
  }

  try {
    // 1. 撈出 Supabase 資料庫中的所有使用者
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*');

    if (fetchError) throw fetchError;

    const now = new Date();
    const reports = [];

    // 2. 遍歷每位使用者，依據上次打卡時間判定是否扣血
    for (const user of users) {
      const lastScan = new Date(user.last_scan_date);
      const diffTime = Math.abs(now - lastScan);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let nextStatus = user.turtle_status;
      let shouldSendPush = false;
      let pushMessage = '';

      // 判定邏輯：超過 7 天沒打卡且尚未判定死亡
      if (diffDays >= 7 && user.turtle_status !== 0) {
        nextStatus = 0; // 死亡
        shouldSendPush = true;
        pushMessage = MSG_DEAD;
      } 
      // 判定邏輯：超過 3 天沒打卡且原本為健康狀態
      else if (diffDays >= 3 && diffDays < 7 && user.turtle_status === 2) {
        nextStatus = 1; // 生病混濁
        shouldSendPush = true;
        pushMessage = MSG_SICK;
      }

      // 更新使用者的狀態與連續未打卡天數
      const { error: updateError } = await supabase
        .from('users')
        .update({
          turtle_status: nextStatus,
          continuous_inactive_days: diffDays,
        })
        .eq('line_uid', user.line_uid);

      if (updateError) {
        console.error(`Failed to update status for user ${user.line_uid}:`, updateError);
        continue;
      }

      // 3. 如果觸發狀態變更，發送 LINE 主動推播訊息
      if (shouldSendPush) {
        try {
          await lineClient.pushMessage(user.line_uid, {
            type: 'text',
            text: pushMessage,
          });
          reports.push({ userId: user.line_uid, action: `Status changed to ${nextStatus}, message pushed.` });
        } catch (pushErr) {
          console.error(`Failed to send push to ${user.line_uid}:`, pushErr);
          reports.push({ userId: user.line_uid, error: 'Push message block or failed' });
        }
      } else {
        reports.push({ userId: user.line_uid, action: 'No status change' });
      }
    }

    return res.status(200).json({ success: true, processedCount: users.length, reports });
  } catch (error) {
    console.error('Cron check error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
