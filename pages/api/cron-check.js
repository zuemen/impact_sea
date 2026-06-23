import { messagingApi } from '@line/bot-sdk';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// 讀取環境變數，若無則使用提供好的真實金鑰
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '35247eb3ad1aa7e748c11cf5c17f1e4d';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dLMnahck3kseitiWmMu8Y8zLcTsfYnn01BiUA5rJ4JTV208lhF2KVtI4qntpo/26peCRGkNd6apPXH79oBetYFj762vRd7w6ovaefNxHBQV9MD14aCktvO4+9ZwZ6B0qfkz79QWVb1h25uuxEB4b/gdB04t89/1O/w1cDnyilFU=';

// 初始化 LINE Bot SDK Client (v11 規格)
const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: CHANNEL_ACCESS_TOKEN,
});

// 毒舌推播訊息範本
const MSG_SICK = '【🤢 孿生海龜生病警告】\n你的海龜因為你連續 3 天沒打卡而生病了！牠的大腦正被微塑膠慢慢侵蝕。看來你對環保的熱情也只持續了三分鐘呢，真是個三分鐘熱度的廢物人類。🐢';
const MSG_NUDGE = '【🙄 海龜在看著你】\n嗨，是我。你已經 5 天沒理我了。沒關係，反正海水髒不髒、我體內有沒有塑化劑，對你來說大概也不太重要吧？祝你今天喝手搖杯用塑膠吸管用得開心！🥤';
const MSG_DEAD = '【💀 孿生海龜死亡通知】\n恭喜！因為你整整 7 天沒有進行減塑打卡，你的孿生海龜已經不幸死亡。牠最後的遺言是：『祝你在充滿微塑膠的地球裡，慢性病發作愉快，我們地獄見。』💀';
const MSG_SILENT = '【🗑️ 這是最後一則訊息】\n看來你的海龜已經徹底被遺忘了。這也是我們最後一次發送通知，畢竟我們也不想強求一個不在乎海洋的人去帶環保杯。祝你的微塑膠血管通暢，再見。';

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

  if (!isSupabaseConfigured) {
    const { test_uid } = req.query;
    if (test_uid) {
      try {
        await lineClient.pushMessage({
          to: test_uid,
          messages: [{
            type: 'text',
            text: '【🤖 測試情緒勒索通知】\n這是一則手動測試通知！您目前處於 Demo 模式（無 Supabase 資料庫），但 LINE Bot 推播管道一切正常。海龜在看著你喔！🐢'
          }],
        });
        return res.status(200).json({
          success: true,
          message: `Demo 模式：成功發送測試推播至 ${test_uid}！`,
          demo: true,
        });
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: `Demo 模式發送通知失敗：${err.message}`,
          demo: true,
        });
      }
    }
    return res.status(200).json({
      success: true,
      message: 'Demo 模式：Supabase 未設定，跳過每日排程扣血與推播邏輯。您可以在網址加上 `&test_uid=您的LINE_UID` 來測試 LINE 推播發送。',
      demo: true,
    });
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

      // 判定邏輯：依據未打卡天數發送 Duolingo 式提醒
      if (diffDays >= 7) {
        if (user.turtle_status !== 0) {
          nextStatus = 0; // 死亡
          shouldSendPush = true;
          pushMessage = MSG_DEAD;
        } else if (diffDays === 10) {
          shouldSendPush = true;
          pushMessage = MSG_SILENT;
        }
      } else if (diffDays === 5) {
        shouldSendPush = true;
        pushMessage = MSG_NUDGE;
      } else if (diffDays >= 3) {
        if (user.turtle_status === 2) {
          nextStatus = 1; // 生病混濁
          shouldSendPush = true;
          pushMessage = MSG_SICK;
        }
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
          await lineClient.pushMessage({
            to: user.line_uid,
            messages: [{
              type: 'text',
              text: pushMessage,
            }],
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
