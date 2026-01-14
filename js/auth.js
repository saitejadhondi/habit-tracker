import { supabase } from "./supabase.js";
import { showToast } from "./utils.js";

function setDisabled(state) {
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  if (loginBtn) loginBtn.disabled = state;
  if (signupBtn) signupBtn.disabled = state;
}

async function handleLogin() {
  const email = document.getElementById('email')?.value?.trim();
  const password = document.getElementById('password')?.value;
  if (!email || !password) return showToast('Please enter email and password', 'error');
  setDisabled(true);
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    window.location.href = 'dashboard.html';
  } catch (err) {
    showToast(err?.message || 'Login failed', 'error');
  } finally {
    setDisabled(false);
  }
}

async function handleSignup() {
  const email = document.getElementById('email')?.value?.trim();
  const password = document.getElementById('password')?.value;
  if (!email || !password) return showToast('Please enter email and password', 'error');
  setDisabled(true);
  try {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    showToast('Signup successful. Please check your email and login.');
  } catch (err) {
    showToast(err?.message || 'Signup failed', 'error');
  } finally {
    setDisabled(false);
  }
}

async function handleLogout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    // ignore or show error
    console.error('Sign out failed', err);
  }
  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (signupBtn) signupBtn.addEventListener('click', handleSignup);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
});
