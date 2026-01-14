import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// --- CONFIGURATION ---
const SUPABASE_URL = "https://ogaarunnqtyyykfbcvoz.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nYWFydW5ucXR5eXlrZmJjdm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTc2MjIsImV4cCI6MjA4Mzk3MzYyMn0.X2IWwzXJqSEaIi2uEQm-rFFT-Kzqd24MrAnuHPfN5NU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Audio Assets
const SOUNDS = {
    rain: new Audio('https://cdn.pixabay.com/audio/2022/07/04/audio_34b076b678.mp3'),
    forest: new Audio('https://cdn.pixabay.com/audio/2021/09/06/audio_0316694793.mp3'),
    cafe: new Audio('https://cdn.pixabay.com/audio/2017/08/07/22/04/people-2609055_1280.mp3')
};
Object.values(SOUNDS).forEach(s => s.loop = true);

class App {
    constructor() {
        this.state = {
            user: null,
            habits: [],
            journal: "",
            charts: {}, // Store chart instances here
            xp: 0,
            activeSound: null,
            zenMode: false,
            timer: {
                interval: null,
                timeLeft: 25 * 60,
                totalTime: 25 * 60,
                isRunning: false,
                mode: 'pomodoro',
                sessionsToday: 0
            },
            badges: [
                { id: 'early_bird', icon: 'fa-sun', label: 'Early Bird', desc: 'Complete a habit before 8AM', unlocked: false },
                { id: 'streak_7', icon: 'fa-fire', label: '7 Day Streak', desc: 'Reach a 7 day streak', unlocked: false },
                { id: 'focus_master', icon: 'fa-brain', label: 'Focus Pro', desc: 'Complete 4 Pomodoros in a day', unlocked: false },
                { id: 'zen_master', icon: 'fa-om', label: 'Zen Master', desc: 'Reach Level 5', unlocked: false }
            ]
        };
    }

    async init() {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session && !window.location.href.includes('index.html')) {
            window.location.href = 'index.html';
            return;
        }

        if (session) {
            this.state.user = session.user;
            this.applyTheme(session.user);
            this.updateDate();
            await this.loadData();
            await this.loadJournal();
            this.updateTimerDisplay();
        }
        
        // Setup Chart Defaults
        Chart.defaults.color = '#a1a1aa';
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.borderColor = '#27272a';
    }

    // --- DATA LOADING ---

    async loadData() {
        try {
            const { data, error } = await supabase
                .from("habits")
                .select("*")
                .eq('user_id', this.state.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.state.habits = data || [];
            this.recalcStats();
            this.renderAll();
        } catch (err) {
            console.error('Data load error', err);
        }
    }

    async loadJournal() {
        const today = new Date().toISOString().split('T')[0];
        const savedJournal = this.state.user.user_metadata?.journal?.[today] || "";
        const el = document.getElementById('dailyJournal');
        if(el) el.value = savedJournal;
    }

    // --- CORE FEATURES ---

    async addHabit(title, category) {
        if (!title.trim()) return;
        const input = document.getElementById('habitInput');
        input.value = '';

        const newHabit = {
            title: title,
            category: category || 'General',
            user_id: this.state.user.id,
            completed_dates: []
        };

        const tempId = Date.now();
        this.state.habits.unshift({ ...newHabit, id: tempId });
        this.renderAll();

        const { data, error } = await supabase.from('habits').insert([newHabit]).select();
        
        if(data) {
            const idx = this.state.habits.findIndex(h => h.id === tempId);
            if(idx !== -1) this.state.habits[idx] = data[0];
            this.showToast('Habit added', 'success');
        } else {
            this.showToast('Error adding habit', 'error');
        }
    }

    async toggle(id) {
        const habit = this.state.habits.find(h => h.id === id);
        if (!habit) return;

        const today = new Date().toISOString().split('T')[0];
        const dates = habit.completed_dates || [];
        const isCompletedToday = dates.includes(today);

        let newDates;
        if (isCompletedToday) {
            newDates = dates.filter(d => d !== today);
            this.state.xp -= 10;
        } else {
            newDates = [...dates, today];
            this.state.xp += 10;
            this.checkEarlyBirdBadge();
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#6366f1', '#14b8a6'] });
        }

        habit.completed_dates = newDates;
        this.recalcStats();
        this.renderAll();

        await supabase.from('habits').update({ completed_dates: newDates }).eq('id', id);
    }

    // --- STATS & BADGES ---

    recalcStats() {
        let totalCompletions = 0;
        this.state.habits.forEach(h => totalCompletions += (h.completed_dates || []).length);
        this.state.xp = totalCompletions * 15;

        const maxStreak = Math.max(0, ...this.state.habits.map(h => this.calculateStreakForHabit(h)));
        const level = Math.floor(this.state.xp / 100) + 1;

        if (maxStreak >= 7) this.unlockBadge('streak_7');
        if (level >= 5) this.unlockBadge('zen_master');
        if (this.state.timer.sessionsToday >= 4) this.unlockBadge('focus_master');
    }

    unlockBadge(id) {
        const badge = this.state.badges.find(b => b.id === id);
        if (badge && !badge.unlocked) {
            badge.unlocked = true;
            this.showToast(`🏆 Badge Unlocked: ${badge.label}!`, 'success');
        }
    }

    checkEarlyBirdBadge() {
        const hr = new Date().getHours();
        if (hr < 8) this.unlockBadge('early_bird');
    }

    calculateStreakForHabit(habit) {
        const dates = new Set(habit.completed_dates || []);
        if (dates.size === 0) return 0;
        
        let streak = 0;
        let d = new Date();
        const today = d.toISOString().split('T')[0];
        
        if (dates.has(today)) {
            streak = 1;
            d.setDate(d.getDate() - 1);
        } else {
            // Check yesterday
            const yesterday = new Date(Date.now() - 86400000);
            if (!dates.has(yesterday.toISOString().split('T')[0])) return 0;
            streak = 0; // We start counting from yesterday in loop
            d = yesterday;
        }

        while (dates.has(d.toISOString().split('T')[0])) {
            streak++;
            d.setDate(d.getDate() - 1);
        }
        return streak > 0 && dates.has(today) ? streak : streak - 1 + (dates.has(today)?1:0); 
    }

    // --- RENDERING ---

    renderAll() {
        this.renderHabits();
        this.renderMetrics();
        // Charts only render if the view is active to save resources
        if(document.getElementById('view-analytics').classList.contains('active')){
            this.renderCharts();
        }
    }

    renderHabits() {
        const list = document.getElementById('habitList');
        if(!list) return;
        list.innerHTML = '';
        const today = new Date().toISOString().split('T')[0];

        this.state.habits.forEach(h => {
            const isDone = (h.completed_dates || []).includes(today);
            const streak = this.calculateStreakForHabit(h);
            const el = document.createElement('div');
            el.className = `habit-item ${isDone ? 'done' : ''}`;
            
            el.innerHTML = `
                <div class="checkbox" onclick="event.stopPropagation(); window.app.toggle(${h.id})">
                    ${isDone ? '<i class="fa-solid fa-check"></i>' : ''}
                </div>
                <div class="habit-text" onclick="window.app.openHabitDetails(${h.id})">${h.title}</div>
                <div class="habit-meta" onclick="window.app.openHabitDetails(${h.id})">
                    ${streak > 2 ? `<div class="streak-pill"><i class="fa-solid fa-fire"></i> ${streak}</div>` : ''}
                    <div class="category-dot" style="background: ${this.getCategoryColor(h.category)}"></div>
                </div>
            `;
            list.appendChild(el);
        });
    }

    renderMetrics() {
        const level = Math.floor(this.state.xp / 100) + 1;
        const progress = this.state.xp % 100;
        const elLevel = document.getElementById('levelVal');
        if(elLevel) elLevel.textContent = level;
        const elBar = document.getElementById('xpBar');
        if(elBar) elBar.style.width = `${progress}%`;

        const today = new Date().toISOString().split('T')[0];
        const active = this.state.habits.filter(h => (h.completed_dates || []).includes(today)).length;
        const total = this.state.habits.length;
        
        const rateEl = document.getElementById('completionRate');
        if(rateEl) rateEl.textContent = total === 0 ? '0%' : Math.round((active/total)*100) + '%';
        
        const maxStreak = Math.max(0, ...this.state.habits.map(h => this.calculateStreakForHabit(h)));
        const streakEl = document.getElementById('streakVal');
        if(streakEl) streakEl.textContent = maxStreak;
        const bestEl = document.getElementById('bestStreak');
        if(bestEl) bestEl.textContent = maxStreak;

        this.renderBadges();
    }

    renderBadges() {
        const grid = document.getElementById('dashboardBadges');
        if(!grid) return;
        grid.innerHTML = '';
        this.state.badges.forEach(b => {
            const div = document.createElement('div');
            div.className = `badge ${b.unlocked ? 'unlocked' : ''}`;
            div.title = b.desc;
            div.innerHTML = `<i class="fa-solid ${b.icon}"></i><span>${b.label}</span>`;
            grid.appendChild(div);
        });
    }

    openHabitDetails(id) {
        const habit = this.state.habits.find(h => h.id === id);
        if(!habit) return;

        document.getElementById('habitModal').style.display = 'flex';
        document.getElementById('modalHabitTitle').textContent = habit.title;
        document.getElementById('modalStreak').textContent = this.calculateStreakForHabit(habit);
        
        const cal = document.getElementById('modalCalendar');
        cal.innerHTML = '';
        const dates = new Set(habit.completed_dates || []);
        
        ['S','M','T','W','T','F','S'].forEach(d => {
            cal.innerHTML += `<div class="cal-day-header">${d}</div>`;
        });

        for(let i=29; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            const isDone = dates.has(iso);
            const isToday = iso === new Date().toISOString().split('T')[0];
            
            const div = document.createElement('div');
            div.className = `cal-day ${isDone ? 'active' : ''} ${isToday ? 'today' : ''}`;
            div.textContent = d.getDate();
            cal.appendChild(div);
        }
        document.getElementById('btnDeleteHabit').onclick = () => this.deleteHabit(id);
    }

    // --- PRO ANALYTICS (Charts & Insights) ---

    renderCharts() {
        // Clear existing chart instances to avoid memory leaks
        Object.values(this.state.charts).forEach(c => c.destroy());

        this.renderTrendChart();
        this.renderCategoryChart();
        this.renderDayPerformanceChart();
        this.renderRadarChart();
        this.renderHeatmap();
        this.generateInsights();
        this.renderStatCards();
    }

    renderTrendChart() {
        const ctx = document.getElementById('trendChart');
        if(!ctx) return;

        // Last 14 days
        const labels = [];
        const dataPoints = [];
        for(let i=13; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            labels.push(d.toLocaleDateString('en-US', {weekday:'short'}));
            
            let completed = 0;
            this.state.habits.forEach(h => { if((h.completed_dates||[]).includes(iso)) completed++; });
            const total = this.state.habits.length || 1;
            dataPoints.push(Math.round((completed/total)*100));
        }

        // Gradient
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Primary color
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        this.state.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Completion Rate %',
                    data: dataPoints,
                    borderColor: '#6366f1',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#09090b',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                scales: {
                    y: { min: 0, max: 100, grid: { color: '#27272a' } },
                    x: { grid: { display: false } }
                }
            }
        });

        // Simple math for "Vs Last Week"
        const thisWeek = dataPoints.slice(7).reduce((a,b)=>a+b,0)/7;
        const lastWeek = dataPoints.slice(0,7).reduce((a,b)=>a+b,0)/7;
        const diff = Math.round(thisWeek - lastWeek);
        const el = document.getElementById('trendValue');
        if(el) {
            el.textContent = `${diff > 0 ? '+' : ''}${diff}%`;
            el.parentElement.style.color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
        }
    }

    renderCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if(!ctx) return;

        const counts = {};
        this.state.habits.forEach(h => {
            const c = h.category;
            const completions = (h.completed_dates||[]).length;
            counts[c] = (counts[c] || 0) + completions;
        });

        const labels = Object.keys(counts);
        const data = Object.values(counts);
        const colors = labels.map(l => this.getCategoryColor(l));

        this.state.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: { legend: { display: false } }
            }
        });

        // Custom Legend
        const legend = document.getElementById('catLegend');
        if(legend) {
            legend.innerHTML = labels.map((l, i) => `
                <div style="display:flex;align-items:center;gap:6px;font-size:0.8rem;">
                    <div style="width:8px;height:8px;border-radius:50%;background:${colors[i]}"></div>
                    ${l}
                </div>
            `).join('');
        }
    }

    renderDayPerformanceChart() {
        const ctx = document.getElementById('dayBarChart');
        if(!ctx) return;

        // Aggregating by Day of Week (0=Sun)
        const dayCounts = [0,0,0,0,0,0,0];
        this.state.habits.forEach(h => {
            (h.completed_dates||[]).forEach(iso => {
                const day = new Date(iso).getDay();
                dayCounts[day]++;
            });
        });

        this.state.charts.days = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                    label: 'Total Habits Done',
                    data: dayCounts,
                    backgroundColor: '#14b8a6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { display: false },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    renderRadarChart() {
        const ctx = document.getElementById('radarChart');
        if(!ctx) return;

        // Just mapping individual habit strength based on streak
        const labels = this.state.habits.slice(0, 6).map(h => h.title); // Top 6
        const data = this.state.habits.slice(0, 6).map(h => this.calculateStreakForHabit(h));

        this.state.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Current Streak',
                    data: data,
                    backgroundColor: 'rgba(244, 63, 94, 0.2)',
                    borderColor: '#f43f5e',
                    pointBackgroundColor: '#f43f5e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: '#27272a' },
                        grid: { color: '#27272a' },
                        pointLabels: { color: '#a1a1aa', font: {size: 10} },
                        ticks: { display: false, backdropColor: 'transparent' }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    renderHeatmap() {
        const container = document.getElementById('analyticsHeatmap');
        if(!container) return;
        container.innerHTML = '';
        
        // 365 Days
        for(let i=364; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            
            // Count total completions for this day
            let count = 0;
            this.state.habits.forEach(h => {
                if((h.completed_dates||[]).includes(iso)) count++;
            });

            // Opacity logic
            let color = '#27272a';
            if(count > 0) color = `rgba(99, 102, 241, ${Math.min(0.3 + (count * 0.15), 1)})`;
            if(count >= 5) color = '#6366f1'; // Max intensity

            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.style.backgroundColor = color;
            cell.title = `${d.toDateString()}: ${count} habits`;
            container.appendChild(cell);
        }
    }

    renderStatCards() {
        // Calculate Total Completions
        let total = 0;
        this.state.habits.forEach(h => total += (h.completed_dates||[]).length);
        const elTotal = document.getElementById('statTotalCompletions');
        if(elTotal) elTotal.textContent = total;

        // Calculate "Perfect Days" (where all habits were done)
        const dateCounts = {};
        this.state.habits.forEach(h => {
            (h.completed_dates||[]).forEach(d => {
                dateCounts[d] = (dateCounts[d] || 0) + 1;
            });
        });
        const habitCount = this.state.habits.length;
        let perfect = 0;
        Object.values(dateCounts).forEach(c => { if(c >= habitCount && habitCount > 0) perfect++; });
        
        const elPerfect = document.getElementById('statPerfectDays');
        if(elPerfect) elPerfect.textContent = perfect;
    }

    generateInsights() {
        const el = document.getElementById('aiSuggestion');
        if(!el) return;

        if(this.state.habits.length === 0) {
            el.textContent = "Start by adding your first habit to generate insights.";
            return;
        }

        // Logic to find patterns
        const dayCounts = [0,0,0,0,0,0,0];
        let totalDone = 0;
        this.state.habits.forEach(h => {
            (h.completed_dates||[]).forEach(iso => {
                dayCounts[new Date(iso).getDay()]++;
                totalDone++;
            });
        });

        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const bestDayIndex = dayCounts.indexOf(Math.max(...dayCounts));
        const worstDayIndex = dayCounts.indexOf(Math.min(...dayCounts));

        // Randomize insight type
        const type = Math.floor(Math.random() * 3);

        if (totalDone < 5) {
            el.textContent = "Data is limited. Keep logging for 3 days to see patterns.";
        } else if (type === 0) {
            el.textContent = `You are most productive on ${days[bestDayIndex]}s. Try tackling hard tasks then.`;
        } else if (type === 1) {
            el.textContent = `${days[worstDayIndex]}s seem tough for you. Maybe reduce the load or start smaller?`;
        } else {
            const streak = document.getElementById('streakVal').textContent;
            el.textContent = `You're on a ${streak} day streak. Consistency beats intensity every time.`;
        }
    }

    // --- UTILS ---

    toggleZenMode() {
        this.state.zenMode = !this.state.zenMode;
        if(this.state.zenMode) {
            document.querySelector('.sidebar').style.transform = 'translateX(-100%)';
            document.querySelector('.header').style.display = 'none';
        } else {
            document.querySelector('.sidebar').style.transform = 'translateX(0)';
            document.querySelector('.header').style.display = 'flex';
        }
    }

    async saveJournal() {
        const text = document.getElementById('dailyJournal').value;
        const today = new Date().toISOString().split('T')[0];
        const newMeta = { ...this.state.user.user_metadata, journal: { [today]: text } };
        await supabase.auth.updateUser({ data: newMeta });
        this.showToast('Journal Saved', 'success');
    }

    async deleteHabit(id) {
        if(!confirm('Permanently delete?')) return;
        await supabase.from('habits').delete().eq('id', id);
        this.state.habits = this.state.habits.filter(h => h.id !== id);
        document.getElementById('habitModal').style.display = 'none';
        this.renderAll();
    }

    async updateUserProfile() {
        const name = document.getElementById('userName').value;
        const avatar = document.getElementById('avatarUrl').value;
        const color = document.getElementById('selectedColor').value;
        
        await supabase.auth.updateUser({ data: { full_name: name, avatar_url: avatar, theme_color: color }});
        this.showToast('Profile Updated', 'success');
        document.getElementById('profileModal').style.display = 'none';
        window.location.reload();
    }

    async logout() {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    }

    updateDate() {
        const d = new Date();
        document.getElementById('dateDisplay').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const quotes = ["Make it happen.", "Focus on the process.", "One step at a time.", "Deep work wins."];
        document.getElementById('quote').textContent = quotes[Math.floor(Math.random()*quotes.length)];
    }

    getCategoryColor(cat) {
        const map = { 'Health': '#14b8a6', 'Work': '#6366f1', 'Growth': '#f59e0b', 'Creativity': '#ec4899' };
        return map[cat] || '#a1a1aa';
    }

    applyTheme(user) {
        const meta = user.user_metadata || {};
        if(meta.theme_color) window.selectColor(meta.theme_color);
        if(meta.avatar_url) window.previewAvatar(meta.avatar_url);
        if(meta.full_name) document.getElementById('greeting').textContent = `Hello, ${meta.full_name.split(' ')[0]}`;
        
        document.getElementById('userName').value = meta.full_name || '';
        document.getElementById('avatarUrl').value = meta.avatar_url || '';
    }

    switchView(view) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${view}`).classList.add('active');
        document.getElementById(`nav-${view}`).classList.add('active');
        
        // Trigger chart render if switching to analytics
        if(view === 'analytics') {
            setTimeout(() => this.renderCharts(), 50);
        }
    }

    showToast(msg, type='normal') {
        const t = document.getElementById('toast');
        document.getElementById('toastMsg').textContent = msg;
        t.style.borderLeftColor = type === 'error' ? 'var(--danger)' : 'var(--success)';
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    }

    // Timer functions
    toggleSound(type, btn) {
        if (this.state.activeSound) {
            this.state.activeSound.pause();
            this.state.activeSound.currentTime = 0;
            document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
            if (this.state.activeType === type) {
                this.state.activeSound = null;
                this.state.activeType = null;
                return;
            }
        }
        this.state.activeSound = SOUNDS[type];
        this.state.activeType = type;
        this.state.activeSound.play();
        btn.classList.add('active');
    }

    setTimerMode(minutes, mode, btn) {
        this.stopTimer();
        this.state.timer.mode = mode;
        this.state.timer.timeLeft = minutes * 60;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        if(btn) btn.classList.add('active');
        this.updateTimerDisplay();
        document.getElementById('timerLabel').textContent = mode === 'pomodoro' ? 'DEEP FOCUS' : 'RECHARGE';
    }

    toggleTimer() {
        if(this.state.timer.isRunning) this.stopTimer();
        else this.startTimer();
    }

    startTimer() {
        this.state.timer.isRunning = true;
        document.getElementById('startBtn').innerHTML = 'PAUSE';
        this.state.timer.interval = setInterval(() => {
            this.state.timer.timeLeft--;
            this.updateTimerDisplay();
            if(this.state.timer.timeLeft <= 0) this.completeTimer();
        }, 1000);
    }

    stopTimer() {
        this.state.timer.isRunning = false;
        clearInterval(this.state.timer.interval);
        document.getElementById('startBtn').innerHTML = 'START FOCUS';
    }

    resetTimer() {
        this.stopTimer();
        this.state.timer.timeLeft = 25 * 60;
        this.updateTimerDisplay();
    }

    completeTimer() {
        this.stopTimer();
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play();
        if(this.state.timer.mode === 'pomodoro') {
            this.state.timer.sessionsToday++;
            this.state.xp += 50;
            this.recalcStats();
            document.getElementById('totalFocusHours').textContent = (this.state.timer.sessionsToday * 25 / 60).toFixed(1);
            this.showToast('+50 XP Session Complete!', 'success');
        }
        this.resetTimer();
    }

    updateTimerDisplay() {
        const m = Math.floor(this.state.timer.timeLeft / 60);
        const s = this.state.timer.timeLeft % 60;
        document.getElementById('timerDisplay').textContent = `${m}:${s.toString().padStart(2,'0')}`;
        document.title = this.state.timer.isRunning ? `(${m}:${s}) FocusFlow` : 'FocusFlow Pro';
    }
}

const app = new App();
window.app = app;
document.addEventListener('DOMContentLoaded', () => app.init());