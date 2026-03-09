const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

function createSupabaseClient(options = {}) {
  const accessToken = options.accessToken || '';
  const useServiceRole = Boolean(options.useServiceRole);

  const supabaseKey =
    useServiceRole && config.supabaseServiceRoleKey
      ? config.supabaseServiceRoleKey
      : config.supabaseAnonKey;

  const globalHeaders = {};
  if (accessToken) {
    globalHeaders.Authorization = `Bearer ${accessToken}`;
  }

  return createClient(config.supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: globalHeaders },
  });
}

module.exports = { createSupabaseClient };
