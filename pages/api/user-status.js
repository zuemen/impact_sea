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
  // 僅允許 GET 請求
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

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
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
