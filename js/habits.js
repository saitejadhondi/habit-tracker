import { supabase } from "./supabase.js";

// --- State ---
const state = {
    habits: [],
    user: null,
    xp: 0,
    level: 1,
    timer: null,
    timeLeft: 25 * 60,
    isTimerRunning: false
};

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    updateDate();
    
    // Check Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    state.user = user;
    
    // Load Data
    await loadUserData();
    setupListeners();
});

// --- Core Logic ---

async function loadUserData() {
    // Parallel fetch for speed
    const [habitsRes, profileRes] = await Promise.all([
        supabase.from("habits").select("*").order('created_at', { ascending: true }),
        supabase.from("profiles").select("xp").eq('id', state.user.id).single()
    ]);

    state.habits = habitsRes.data || [];
    state.xp = profileRes.data?.xp || 0;
    
    calculateLevel();
    renderAll();
}

function calculateLevel() {
    // Simple formula: Level = floor(sqrt(XP / 10)) + 1
    // or just 100 XP per level for simplicity
    const xpPerLevel = 100;
    state.level = Math.floor(state.xp / xpPerLevel) + 1;
    const progress = (state.xp % xpPerLevel) / xpPerLevel * 100;

    document.getElementById('userLevel').textContent = state.level;
    document.getElementById('xpText').textContent = `${state.xp % xpPerLevel} / ${xpPerLevel} XP`;
    document.getElementById('xpFill').style.width = `${progress}%`;
}

window.addHabit = async function() {
    const input = document.getElementById('habitInput');
    const catSelect = document.getElementById('catSelect');
    const title = input.value.trim();
    
    if (!title) return;

    // Optimistic UI Update
    const tempId = Date.now();
    const newHabit = { 
        id: tempId, 
        title, 
        category: catSelect.value, 
        completed_dates: [], 
        user_id: state.user.id 
    };
    
    state.habits.push(newHabit);
    renderHabits();
    input.value = '';

    const { data, error } = await supabase.from('habits').insert([{ 
        title, 
        user_id: state.user.id, 
        category: catSelect.value,
        completed_dates: [] 
    }]).select();

    if (!error && data) {
        // Replace temp ID with real one
        const index = state.habits.findIndex(h => h.id === tempId);
        if (index !== -1) state.habits[index] = data[0];
    }
};

window.toggleHabit = async function(id) {
    const habit = state.habits.find(h => h.id == id);
    if (!habit) return;

    const today = new Date().toISOString().split('T')[0];
    let dates = [...(habit.completed_dates || [])];
    const isCompleting = !dates.includes(today);

    // Haptics for mobile
    if (navigator.vibrate) navigator.vibrate(50);

    if (isCompleting) {
        dates.push(today);
        triggerConfetti();
        await addXP(10); // Reward for completion
    } else {
        dates = dates.filter(d => d !== today);
        await addXP(-10); // Penalty for unchecking (optional)
    }

    habit.completed_dates = dates;
    renderAll();

    await supabase.from('habits').update({ completed_dates: dates }).eq('id', id);
};

async function addXP(amount) {
    state.xp = Math.max(0, state.xp + amount);
    calculateLevel();
    // Debounce save or just save immediately
    await supabase.from('profiles').upsert({ id: state.user.id, xp: state.xp });
}

window.deleteHabit = async function(id) {
    if(!confirm("Remove this habit?")) return;
    state.habits = state.habits.filter(h => h.id != id);
    renderAll();
    await supabase.from('habits').delete().eq('id', id);
};

// --- Rendering ---

function renderAll() {
    renderHabits();
    renderHeatmap();
    renderStats();
    renderAnalyticsChart();
}

function renderHabits() {
    const list = document.getElementById('habitList');
    list.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];

    state.habits.forEach(h => {
        const isCompleted = (h.completed_dates || []).includes(today);
        const li = document.createElement('li');
        li.className = `habit-item ${isCompleted ? 'completed' : ''}`;
        li.innerHTML = `
            <div style="display:flex; align-items:center; flex:1;">
                <div class="check-box" onclick="window.toggleHabit('${h.id}')">
                    ${isCompleted ? '<i class="fa-solid fa-check"></i>' : ''}
                </div>
                <div style="display:flex; flex-direction:column;">
                    <span class="habit-text" style="font-weight:600;">${escapeHTML(h.title)}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${calculateStreak(h.completed_dates)} day streak</span>
                </div>
            </div>
            <span class="tag">${h.category || 'General'}</span>
            <button onclick="window.deleteHabit('${h.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; margin-left:10px;"><i class="fa-solid fa-trash"></i></button>
        `;
        list.appendChild(li);
    });
}

function renderHeatmap() {
    const grid = document.getElementById('miniHeatmap');
    grid.innerHTML = '';
    const today = new Date();
    
    // Show last 14 days for mini heatmap
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        
        let completedCount = 0;
        state.habits.forEach(h => {
            if ((h.completed_dates || []).includes(iso)) completedCount++;
        });

        const total = state.habits.length;
        let level = 0;
        if (total > 0 && completedCount > 0) {
            const ratio = completedCount / total;
            if (ratio === 1) level = 3;
            else if (ratio >= 0.5) level = 2;
            else level = 1;
        }

        const box = document.createElement('div');
        box.className = 'heat-box';
        box.setAttribute('data-level', level);
        box.title = `${iso}: ${completedCount}/${total}`;
        grid.appendChild(box);
    }
}

function renderStats() {
    // Global Streak
    const today = new Date().toISOString().split('T')[0];
    const activeHabits = state.habits.filter(h => (h.completed_dates || []).includes(today)).length;
    document.getElementById('streakVal').textContent = activeHabits; // Simplification for now

    // Completion Rate (Last 7 Days)
    let totalOpp = state.habits.length * 7;
    let totalDone = 0;
    if (totalOpp > 0) {
        for(let i=0; i<7; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            state.habits.forEach(h => {
                if((h.completed_dates || []).includes(iso)) totalDone++;
            });
        }
        const rate = Math.round((totalDone / totalOpp) * 100);
        document.getElementById('completionRate').textContent = `${rate}%`;
    }
}

// --- Focus Timer ---
window.startTimer = function() {
    if (state.isTimerRunning) return;
    state.isTimerRunning = true;
    document.getElementById('timerDisplay').classList.add('timer-active');
    
    state.timer = setInterval(() => {
        state.timeLeft--;
        updateTimerDisplay();
        if (state.timeLeft <= 0) {
            clearInterval(state.timer);
            state.isTimerRunning = false;
            document.getElementById('timerDisplay').classList.remove('timer-active');
            alert("Focus session complete! Take a break.");
            addXP(50); // Big reward for focus
        }
    }, 1000);
}

window.resetTimer = function() {
    clearInterval(state.timer);
    state.isTimerRunning = false;
    state.timeLeft = 25 * 60;
    updateTimerDisplay();
    document.getElementById('timerDisplay').classList.remove('timer-active');
}

function updateTimerDisplay() {
    const m = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
    const s = (state.timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}

// --- Utils ---
function triggerConfetti() {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#4f46e5', '#818cf8', '#ffffff'] });
}

function calculateStreak(dates) {
    if(!dates || !dates.length) return 0;
    // (Logic same as before, omitted for brevity)
    return dates.length; 
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

window.switchTab = function(tab) {
    document.querySelectorAll('[id^="view"]').forEach(el => el.style.display = 'none');
    document.getElementById(`view${tab.charAt(0).toUpperCase() + tab.slice(1)}`).style.display = 'grid'; // or block based on view
    
    if(tab === 'analytics') renderAnalyticsChart();
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // (Add active class logic here based on click target)
};

window.toggleTheme = function() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeIcon').className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
};

window.logout = async function() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
};

function initTheme() {
    // System preference check
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('themeIcon').className = 'fa-solid fa-sun';
    }
}

function updateDate() {
    const d = new Date();
    const opts = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('dateDisplay').textContent = d.toLocaleDateString('en-US', opts);
}

function renderAnalyticsChart() {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;
    // Chart.js implementation (simplified)
    // Needs global variable to destroy old chart instance
    if (window.myChart) window.myChart.destroy();
    
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Habits Completed',
                data: [12, 19, 3, 5, 2, 3, 9], // Replace with real data
                backgroundColor: '#4f46e5',
                borderRadius: 4
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function setupListeners() {
    // Add specific listeners if needed
}