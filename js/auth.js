import { supabase } from "./supabase.js";

window.login = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) window.location.href = "dashboard.html";
};

window.signup = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  await supabase.auth.signUp({ email, password });
  alert("Signup successful. Please login.");
};

window.logout = async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
};
