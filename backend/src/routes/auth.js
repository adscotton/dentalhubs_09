const express = require('express');
const { createSupabaseClient } = require('../supabase');
const { getBearerToken, requireAccessToken } = require('../middleware/auth');
const { sendSupabaseError } = require('../lib/response');

const router = express.Router();

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveLoginEmail(login) {
  const client = createSupabaseClient();
  const { data, error } = await client.rpc('resolve_login_email', { p_username: login });
  if (error) throw error;
  return normalizeString(data);
}

router.post('/login', async (req, res) => {
  try {
    const login = normalizeString(req.body?.login);
    const password = normalizeString(req.body?.password);

    if (!login || !password) {
      return res.status(400).json({ error: 'login and password are required.' });
    }

    const resolvedEmail = await resolveLoginEmail(login);
    if (!resolvedEmail) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const client = createSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });

    if (error) return sendSupabaseError(res, error, 401);

    return res.json({
      message: 'Login successful.',
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const login = normalizeString(req.body?.login);
    const redirectTo = normalizeString(req.body?.redirectTo) || 'http://localhost:5173/reset-password';

    if (!login) {
      return res.status(400).json({ error: 'login is required.' });
    }

    const resolvedEmail = await resolveLoginEmail(login);
    if (!resolvedEmail) {
      return res.status(404).json({ error: 'No active staff account found for that login.' });
    }

    const client = createSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(resolvedEmail, { redirectTo });

    if (error) return sendSupabaseError(res, error);

    return res.json({
      message: 'Password reset email sent.',
      email: resolvedEmail,
      redirectTo,
    });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.post('/refresh-session', async (req, res) => {
  try {
    const refreshToken = normalizeString(req.body?.refreshToken);
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required.' });
    }

    const client = createSupabaseClient();
    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) return sendSupabaseError(res, error, 401);

    return res.json({
      message: 'Session refreshed.',
      session: data.session,
      user: data.user,
    });
  } catch (error) {
    return sendSupabaseError(res, error, 500);
  }
});

router.get('/me', requireAccessToken, async (req, res) => {
  try {
    const client = createSupabaseClient({ accessToken: req.accessToken });
    const { data, error } = await client.auth.getUser();

    if (error) return sendSupabaseError(res, error, 401);

    return res.json({ user: data.user });
  } catch (error) {
    return sendSupabaseError(res, error, 500);
  }
});

router.post('/update-password', requireAccessToken, async (req, res) => {
  try {
    const newPassword = normalizeString(req.body?.newPassword);
    if (!newPassword) {
      return res.status(400).json({ error: 'newPassword is required.' });
    }

    const client = createSupabaseClient({ accessToken: req.accessToken });
    const { data, error } = await client.auth.updateUser({ password: newPassword });

    if (error) return sendSupabaseError(res, error);

    return res.json({
      message: 'Password updated successfully.',
      user: data.user,
    });
  } catch (error) {
    return sendSupabaseError(res, error, 500);
  }
});

router.post('/logout', async (req, res) => {
  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(400).json({
        error: 'Missing bearer token. Add Authorization: Bearer <access_token>.',
      });
    }

    const client = createSupabaseClient({ accessToken });
    const { error } = await client.auth.signOut();
    if (error) return sendSupabaseError(res, error);

    return res.json({ message: 'Logged out.' });
  } catch (error) {
    return sendSupabaseError(res, error, 500);
  }
});

module.exports = router;
