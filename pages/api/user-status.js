import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  // 僅允許 GET 請求
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { userId } = req.query;

  // 驗證 userId 是否存在
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  try {
    // 查詢 Supabase 資料庫
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
      // 使用者已存在，直接返回資料
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
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
