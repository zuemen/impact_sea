import { createClient } from '@supabase/supabase-js';

// 從環境變數讀取 Supabase URL 與 Anon Key (支援多種常見命名規格)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 檢查 Supabase 是否已正確設定（非 placeholder 值）
export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
);

// 若未設定，在伺服器端印出警告訊息
if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ 警告：Supabase 尚未設定（缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY）。',
    '系統將自動啟用 Demo 展示模式。'
  );
}

// 實例化並導出 Supabase Client，供 API 端與前端元件使用
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
