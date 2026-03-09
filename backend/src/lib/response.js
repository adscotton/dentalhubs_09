function sendSupabaseError(res, error, fallbackStatus = 400) {
  const status = Number.isInteger(error?.status) ? error.status : fallbackStatus;

  return res.status(status).json({
    error: error?.message || 'Supabase request failed.',
    code: error?.code || null,
    details: error?.details || null,
    hint: error?.hint || null,
  });
}

module.exports = {
  sendSupabaseError,
};
