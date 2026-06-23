import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// ====================================================================
// Demo 模式假資料 — 供 Supabase 尚未設定時的商業簡報展示使用
// ====================================================================
const DEMO_DATA = {
  // 管理員測試帳號 — 預設為健康海龜，已累積 150g 減塑
  'U735e28c5b4fd267ab0e92c9890d4f232': {
    line_uid: 'U735e28c5b4fd267ab0e92c9890d4f232',
    turtle_status: 2,
    continuous_inactive_days: 0,
    total_saved_grams: 150,
    last_scan_date: new Date().toISOString(),
  },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { userId } = req.query;

    // 驗證 userId 是否存在
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId parameter' });
    }

    // ====================================================================
    // Demo 模式：Supabase 未設定時直接回傳假資料，確保前端能正常展示
    // ====================================================================
    if (!isSupabaseConfigured) {
      const demoUser = DEMO_DATA[userId] || {
        line_uid: userId,
        turtle_status: 2,
        continuous_inactive_days: 0,
        total_saved_grams: 50,
        last_scan_date: new Date().toISOString(),
      };
      return res.status(200).json({
        success: true,
        data: demoUser,
        demo: true,
        message: 'Demo 模式：Supabase 尚未設定，回傳展示用假資料。',
      });
    }

    // ====================================================================
    // 正式模式：查詢 Supabase 資料庫
    // ====================================================================
    try {
      const { data: user, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('line_uid', userId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 為 PostgREST 的無資料代碼，若非此代碼，代表資料庫查詢出錯
        throw selectError;
      }

      if (user) {
        // 使用者已存在，動態計算最新的未打卡天數
        const now = new Date();
        const lastScan = new Date(user.last_scan_date);
        const diffTime = Math.abs(now - lastScan);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let nextStatus = user.turtle_status;
        if (diffDays >= 7) {
          nextStatus = 0; // 死亡
        } else if (diffDays >= 3) {
          nextStatus = 1; // 生病混濁
        } else {
          nextStatus = 2; // 健康
        }
        
        // 如果有更新，同步寫回資料庫
        if (user.continuous_inactive_days !== diffDays || user.turtle_status !== nextStatus) {
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
              continuous_inactive_days: diffDays,
              turtle_status: nextStatus
            })
            .eq('line_uid', userId)
            .select()
            .single();
            
          if (!updateError && updatedUser) {
            return res.status(200).json({ success: true, data: updatedUser });
          }
        }
        
        user.continuous_inactive_days = diffDays;
        user.turtle_status = nextStatus;
        return res.status(200).json({ success: true, data: user });
      } else {
        // 使用者不存在（首次透過 LIFF 登入）：在資料庫新增一筆預設的健康海龜狀態
        const now = new Date().toISOString();
        const defaultUser = {
          line_uid: userId,
          turtle_status: 2, // 健康
          continuous_inactive_days: 0,
          total_saved_grams: 0,
          last_scan_date: now,
        };

        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert(defaultUser)
          .select()
          .single();

        if (insertError) throw insertError;

        return res.status(201).json({ success: true, data: insertedUser });
      }
    } catch (error) {
      console.error('Fetch user status error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
    }
  } else if (req.method === 'POST') {
    const { userId, simulateDays } = req.body;

    // 驗證 userId 是否存在
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId parameter' });
    }

    // ====================================================================
    // Demo 模式：Supabase 未設定時直接回傳成功，確保前端能正常展示
    // ====================================================================
    if (!isSupabaseConfigured) {
      return res.status(200).json({
        success: true,
        message: 'Demo 模式：打卡模擬成功。',
      });
    }

    // ====================================================================
    // 正式模式：在 Supabase 更新減塑打卡狀態 或 模擬未打卡狀態
    // ====================================================================
    try {
      // 先查詢使用者資料
      const { data: user, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('line_uid', userId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      const now = new Date().toISOString();

      // 情境 A：開發者模擬未打卡天數
      if (simulateDays !== undefined) {
        const days = parseInt(simulateDays, 10);
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - days);
        const targetIso = targetDate.toISOString();

        let targetStatus = 2;
        if (days >= 7) targetStatus = 0;
        else if (days >= 3) targetStatus = 1;

        if (user) {
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
              continuous_inactive_days: days,
              turtle_status: targetStatus,
              last_scan_date: targetIso,
            })
            .eq('line_uid', userId)
            .select()
            .single();

          if (updateError) throw updateError;
          return res.status(200).json({ success: true, data: updatedUser });
        } else {
          const defaultUser = {
            line_uid: userId,
            turtle_status: targetStatus,
            continuous_inactive_days: days,
            total_saved_grams: 0,
            last_scan_date: targetIso,
          };

          const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert(defaultUser)
            .select()
            .single();

          if (insertError) throw insertError;
          return res.status(201).json({ success: true, data: insertedUser });
        }
      }

      // 情境 B：正常減塑打卡
      if (user) {
        // 使用者已存在，更新累計減塑克數與打卡天數
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            continuous_inactive_days: 0,
            turtle_status: 2,
            total_saved_grams: (user.total_saved_grams || 0) + 10,
            last_scan_date: now,
          })
          .eq('line_uid', userId)
          .select()
          .single();

        if (updateError) throw updateError;
        return res.status(200).json({ success: true, data: updatedUser });
      } else {
        // 使用者不存在，新增一筆打卡資料
        const defaultUser = {
          line_uid: userId,
          turtle_status: 2,
          continuous_inactive_days: 0,
          total_saved_grams: 10,
          last_scan_date: now,
        };

        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert(defaultUser)
          .select()
          .single();

        if (insertError) throw insertError;
        return res.status(201).json({ success: true, data: insertedUser });
      }
    } catch (error) {
      console.error('Update checkin status error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
