import { supabase } from "./supabase.js";

const list = document.getElementById("habitList");

async function loadHabits() {
  const { data } = await supabase.from("habits").select("*");
  list.innerHTML = data.map(h => `<li>${h.title}</li>`).join("");
}

window.addHabit = async () => {
  const title = document.getElementById("habitInput").value;
  await supabase.from("habits").insert({ title });
  loadHabits();
};

loadHabits();
