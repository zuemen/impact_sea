import { createClient } from '@supabase/supabase-js';

// 從環境變數讀取 Supabase URL 與 Anon Key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// 進行基本安全檢查，避免建置時缺少變數而崩潰
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '警告：缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 環境變數。請在 .env.local 檔案中設定。'
  );
}

// 實例化並導出 Supabase Client，供 API 端與前端元件使用
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
