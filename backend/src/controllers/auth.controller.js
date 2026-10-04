const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const { unauthorized } = require('../utils/errors');
const { logger } = require('../utils/logger');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .is('deleted_at', null)
      .single();

    if (error || !user) return next(unauthorized('Invalid email or password'));
    if (!user.is_active) return next(unauthorized('Account is deactivated'));

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return next(unauthorized('Invalid email or password'));

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      org_id: user.org_id,
      full_name: user.full_name,
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    await supabase.from('audit_logs').insert({
      org_id: user.org_id,
      user_id: user.id,
      action: 'login',
      entity_type: 'user',
      entity_id: user.id,
      outcome: 'success',
    });

    res.json({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          org_id: user.org_id,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .is('deleted_at', null)
      .single();

    if (error || !user || !user.is_active) return next(unauthorized('Invalid refresh token'));

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      org_id: user.org_id,
      full_name: user.full_name,
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    res.json({ data: { accessToken } });
  } catch (err) {
    next(unauthorized('Invalid refresh token'));
  }
}

async function logout(req, res) {
  if (req.user) {
    await supabase.from('audit_logs').insert({
      org_id: req.user.org_id,
      user_id: req.user.id,
      action: 'logout',
      entity_type: 'user',
      entity_id: req.user.id,
      outcome: 'success',
    });
  }
  res.json({ message: 'Logged out successfully' });
}

module.exports = { login, refresh, logout };
