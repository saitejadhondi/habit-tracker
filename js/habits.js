import { supabase } from "./supabase.js";

async function loadHabits() {
  const { data } = await supabase.from("habits").select("*");
  document.getElementById("habitList").innerHTML =
    data.map(h => `
      <li>
        ${h.title}
        <button onclick="markDone('${h.id}')">✔</button>
        🔥 ${calculateStreak(h.completed_dates)} days
      </li>
    `).join("");
}

window.markDone = async (id) => {
  const today = new Date().toISOString().split("T")[0];

  await supabase.rpc("add_completion", {
    habit_id: id,
    completion_date: today
  });

  loadHabits();
};

function calculateStreak(dates = []) {
  let streak = 0;
  let day = new Date();

  while (dates.includes(day.toISOString().split("T")[0])) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

loadHabits();

function renderChart(habits) {
  const data = habits.map(h => h.completed_dates.length);
  const labels = habits.map(h => h.title);

  new Chart(document.getElementById("progressChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ data }]
    }
  });
}
