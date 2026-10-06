(() => {
  "use strict";

  const STORAGE_KEY = "daymark-state-v1";
  const projectColors = ["#93a784", "#c3a784", "#8894b0", "#ba91aa", "#89a6a1"];
  const today = localDate(new Date());
  const initialState = {
    projects: [
      { id: "personal", name: "Personal", color: "#91a782" },
      { id: "work", name: "Work", color: "#c0a17e" },
      { id: "learning", name: "Learning", color: "#8595b2" },
      { id: "wellbeing", name: "Wellbeing", color: "#b391a6" }
    ],
    tasks: [
      { id: "sample-1", title: "Plan the week ahead", description: "Make a little room for the big picture.", project: "personal", date: today, priority: "high", completed: false, completedAt: null },
      { id: "sample-2", title: "Send the project update", description: "", project: "work", date: today, priority: "high", completed: false, completedAt: null },
      { id: "sample-3", title: "Read for twenty minutes", description: "", project: "learning", date: today, priority: "low", completed: true, completedAt: today },
      { id: "sample-4", title: "Take a proper lunch break", description: "Step away from the screen for a while.", project: "wellbeing", date: today, priority: "medium", completed: false, completedAt: null },
      { id: "sample-5", title: "Tidy up the desk", description: "", project: "personal", date: today, priority: "low", completed: false, completedAt: null },
      { id: "sample-6", title: "Review design feedback", description: "", project: "work", date: addDays(today, 1), priority: "medium", completed: false, completedAt: null },
      { id: "sample-7", title: "Explore a new recipe", description: "", project: "personal", date: addDays(today, 2), priority: "low", completed: false, completedAt: null },
      { id: "sample-8", title: "Morning walk", description: "", project: "wellbeing", date: addDays(today, 3), priority: "medium", completed: false, completedAt: null }
    ],
    focusSessions: 0,
    focusSessionDate: today
  };

  const elements = {
    todayDate: document.getElementById("today-date"),
    pageTitle: document.getElementById("page-title"),
    pageSubtitle: document.getElementById("page-subtitle"),
    breadcrumb: document.getElementById("breadcrumb-view"),
    taskHeading: document.getElementById("task-heading"),
    taskList: document.getElementById("task-list"),
    emptyState: document.getElementById("empty-state"),
    taskTotal: document.getElementById("task-total"),
    tabs: document.getElementById("task-tabs"),
    modal: document.getElementById("task-modal-backdrop"),
    searchModal: document.getElementById("search-modal-backdrop"),
    searchInput: document.getElementById("search-input"),
    searchResults: document.getElementById("search-results"),
    form: document.getElementById("task-form"),
    titleInput: document.getElementById("task-title"),
    projectSelect: document.getElementById("task-project"),
    projectNav: document.getElementById("project-nav"),
    toast: document.getElementById("toast")
  };

  let state = loadState();
  let currentView = "Today";
  let currentFilter = "all";
  let searchQuery = "";
  let prioritySort = false;
  let toastTimeout;
  let timerRemaining = 25 * 60;
  let timerInterval = null;
  let timerRunning = false;
  let lastFocusedElement = null;

  function localDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDays(dateString, amount) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + amount);
    return localDate(date);
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return structuredClone(initialState);
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.projects)) throw new Error("Saved planner data has an invalid format.");
      if (parsed.focusSessionDate !== today) {
        parsed.focusSessionDate = today;
        parsed.focusSessions = 0;
      }
      return { ...initialState, ...parsed };
    } catch (error) {
      console.error("Could not load saved planner data.", error);
      return structuredClone(initialState);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Could not save planner data.", error);
      showToast("Your changes could not be saved on this device.");
    }
  }

  function html(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function dateFromLocal(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatTaskDate(dateString) {
    const date = dateFromLocal(dateString);
    if (!date) return "No date";
    if (dateString === today) return "Today";
    if (dateString === addDays(today, 1)) return "Tomorrow";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function projectFor(id) {
    return state.projects.find(project => project.id === id);
  }

  function visibleTasks() {
    let tasks = [...state.tasks];
    if (currentView === "Today") tasks = tasks.filter(task => task.date === today);
    else if (currentView === "Upcoming") tasks = tasks.filter(task => task.date > today);
    else if (currentView === "Completed") tasks = tasks.filter(task => task.completed);
    else if (currentView.startsWith("project:")) tasks = tasks.filter(task => task.project === currentView.slice(8));
    if (currentView !== "Completed" && currentFilter === "open") tasks = tasks.filter(task => !task.completed);
    if (currentView !== "Completed" && currentFilter === "completed") tasks = tasks.filter(task => task.completed);
    if (searchQuery) tasks = tasks.filter(task => `${task.title} ${task.description} ${projectFor(task.project)?.name || ""}`.toLowerCase().includes(searchQuery.toLowerCase()));
    tasks.sort((a, b) => {
      if (prioritySort) {
        const order = { high: 0, medium: 1, low: 2 };
        if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
      }
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
    });
    return tasks;
  }

  function taskMarkup(task, index) {
    const project = projectFor(task.project);
    const date = formatTaskDate(task.date);
    return `<article class="task-item${task.completed ? " is-complete" : ""}" style="animation-delay:${index * 35}ms">
      <button class="task-check" data-action="toggle" data-id="${html(task.id)}" aria-label="${task.completed ? "Mark incomplete" : "Complete"}: ${html(task.title)}"><svg class="icon"><use href="#i-check"></use></svg></button>
      <div class="task-main"><p class="task-title">${html(task.title)}</p>${task.description ? `<p class="task-description">${html(task.description)}</p>` : ""}
      <div class="task-meta"><span class="priority-tag ${html(task.priority)}">${html(task.priority[0].toUpperCase() + task.priority.slice(1))}</span><span class="meta-divider"></span><span class="date-tag">${html(date)}</span>${project ? `<span class="meta-divider"></span><span class="project-tag">${html(project.name)}</span>` : ""}</div></div>
      <div class="task-actions"><button data-action="edit" data-id="${html(task.id)}" aria-label="Edit ${html(task.title)}" title="Edit task"><svg class="icon"><use href="#i-more"></use></svg></button><button data-action="delete" data-id="${html(task.id)}" aria-label="Delete ${html(task.title)}" title="Delete task"><svg class="icon"><use href="#i-close"></use></svg></button></div>
    </article>`;
  }

  function setView(view) {
    currentView = view;
    currentFilter = view === "Completed" ? "all" : currentFilter;
    searchQuery = "";
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
    render();
    document.getElementById("sidebar").classList.remove("open");
  }

  function render() {
    const viewName = currentView.startsWith("project:") ? projectFor(currentView.slice(8))?.name || "Project" : currentView;
    elements.breadcrumb.textContent = viewName;
    const headings = {
      Today: ["A fresh start", "A little progress is still progress. Let's make today count.", "Today's tasks"],
      Upcoming: ["On the horizon", "Look ahead at the things you're making time for.", "Upcoming tasks"],
      "All tasks": ["The whole picture", "Everything you've got on your plate, in one place.", "All tasks"],
      Completed: ["Look how far", "Every checked box is a little promise kept.", "Completed tasks"]
    };
    const heading = headings[viewName] || [`${viewName}, in motion`, "Small steps make meaningful things happen.", `${viewName} tasks`];
    elements.pageTitle.innerHTML = `${html(heading[0])}<span>.</span>`;
    elements.pageSubtitle.textContent = heading[1];
    elements.taskHeading.textContent = heading[2];
    elements.todayDate.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();

    const scopedTasks = currentView === "Today" ? state.tasks.filter(task => task.date === today) : currentView.startsWith("project:") ? state.tasks.filter(task => task.project === currentView.slice(8)) : currentView === "Upcoming" ? state.tasks.filter(task => task.date > today) : currentView === "Completed" ? state.tasks.filter(task => task.completed) : state.tasks;
    const tasks = visibleTasks();
    elements.taskList.innerHTML = tasks.map(taskMarkup).join("");
    elements.taskList.classList.toggle("hidden", tasks.length === 0);
    elements.emptyState.classList.toggle("hidden", tasks.length > 0);
    elements.taskTotal.textContent = tasks.length;
    elements.tabs.classList.toggle("hidden", currentView === "Completed");
    const openCount = scopedTasks.filter(task => !task.completed).length;
    const doneCount = scopedTasks.filter(task => task.completed).length;
    document.getElementById("tab-all-count").textContent = scopedTasks.length;
    document.getElementById("tab-open-count").textContent = openCount;
    document.getElementById("tab-completed-count").textContent = doneCount;
    document.getElementById("today-count").textContent = state.tasks.filter(task => task.date === today && !task.completed).length;
    renderProjects();
    renderProgress();
    renderUpcoming();
    renderWeek();
  }

  function renderProgress() {
    const todaysTasks = state.tasks.filter(task => task.date === today);
    const done = todaysTasks.filter(task => task.completed).length;
    const total = todaysTasks.length;
    const percent = total ? Math.round(done / total * 100) : 0;
    document.getElementById("progress-number").textContent = done;
    document.getElementById("progress-total").textContent = total;
    document.getElementById("progress-percent").textContent = `${percent}%`;
    document.getElementById("progress-fill").style.width = `${percent}%`;
    document.getElementById("progress-copy").textContent = total && done === total ? "Everything on your list, done. Take a breath." : total ? "One step at a time. You're doing great." : "A good day starts with a first step.";
  }

  function renderProjects() {
    elements.projectNav.innerHTML = state.projects.map(project => {
      const count = state.tasks.filter(task => task.project === project.id && !task.completed).length;
      return `<button class="nav-item${currentView === `project:${project.id}` ? " active" : ""}" data-project-view="${html(project.id)}"><span class="project-dot" style="--dot:${html(project.color)}"></span><span>${html(project.name)}</span><span class="nav-count">${count || ""}</span></button>`;
    }).join("");
    const selected = elements.projectSelect.value;
    elements.projectSelect.innerHTML = `<option value="">No project</option>${state.projects.map(project => `<option value="${html(project.id)}">${html(project.name)}</option>`).join("")}`;
    if (state.projects.some(project => project.id === selected)) elements.projectSelect.value = selected;
  }

  function renderUpcoming() {
    const upcoming = state.tasks.filter(task => !task.completed && task.date > today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    document.getElementById("upcoming-list").innerHTML = upcoming.length ? upcoming.map(task => `<div class="upcoming-item"><span class="upcoming-dot"></span><div><p>${html(task.title)}</p><small>${html(formatTaskDate(task.date))}</small></div></div>`).join("") : '<div class="upcoming-empty">Nothing on the horizon just yet.</div>';
  }

  function renderWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - weekday);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return localDate(date);
    });
    const counts = days.map(date => state.tasks.filter(task => task.completed && task.completedAt === date).length);
    const max = Math.max(3, ...counts);
    document.getElementById("week-bars").innerHTML = days.map((date, index) => {
      const height = counts[index] ? Math.max(10, Math.round(counts[index] / max * 49)) : 3;
      const letter = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(dateFromLocal(date)).slice(0, 1);
      return `<div class="week-day${date === today ? " today" : ""}"><div class="week-bar-track"><div class="week-bar" style="height:${height}px"></div></div><span>${letter}</span></div>`;
    }).join("");
    const weeklyTotal = counts.reduce((sum, count) => sum + count, 0);
    document.getElementById("week-summary").textContent = `${weeklyTotal} task${weeklyTotal === 1 ? "" : "s"} this week`;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => elements.toast.classList.remove("show"), 2500);
  }

  function openModal(task) {
    lastFocusedElement = document.activeElement;
    elements.form.reset();
    document.getElementById("task-date").value = today;
    document.getElementById("task-priority").value = "medium";
    elements.form.dataset.editing = task?.id || "";
    document.getElementById("modal-title").textContent = task ? "Edit task" : "Add a task";
    elements.form.querySelector(".modal-footer .primary-button").innerHTML = task ? "Save changes" : '<svg class="icon"><use href="#i-plus"></use></svg> Create task';
    if (task) {
      elements.titleInput.value = task.title;
      document.getElementById("task-description").value = task.description || "";
      document.getElementById("task-date").value = task.date || today;
      document.getElementById("task-priority").value = task.priority;
      elements.projectSelect.value = task.project || "";
    } else if (currentView.startsWith("project:")) {
      elements.projectSelect.value = currentView.slice(8);
    }
    elements.modal.classList.remove("hidden");
    requestAnimationFrame(() => elements.titleInput.focus());
  }

  function closeModal() {
    elements.modal.classList.add("hidden");
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
  }

  function openSearch() {
    lastFocusedElement = document.activeElement;
    elements.searchInput.value = "";
    renderSearchResults("");
    elements.searchModal.classList.remove("hidden");
    requestAnimationFrame(() => elements.searchInput.focus());
  }

  function closeSearch() {
    elements.searchModal.classList.add("hidden");
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
  }

  function matchingTasks(query) {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return state.tasks.filter(task => `${task.title} ${task.description} ${projectFor(task.project)?.name || ""}`.toLowerCase().includes(term)).slice(0, 6);
  }

  function renderSearchResults(query) {
    const matches = matchingTasks(query);
    if (!query.trim()) {
      elements.searchResults.innerHTML = '<div class="search-no-results">Start typing to find a task, note, or project.</div>';
      return;
    }
    elements.searchResults.innerHTML = matches.length ? matches.map(task => {
      const project = projectFor(task.project);
      return `<button class="search-result" data-search-task="${html(task.id)}"><svg class="icon"><use href="#i-${task.completed ? "check" : "target"}"></use></svg><span class="search-result-copy"><strong>${html(task.title)}</strong><small>${html(project?.name || "No project")} · ${html(formatTaskDate(task.date))}</small></span><kbd>↵</kbd></button>`;
    }).join("") : '<div class="search-no-results">No matching tasks. Try another search.</div>';
  }

  function selectSearchResult(id) {
    closeSearch();
    currentView = "All tasks";
    currentFilter = "all";
    searchQuery = elements.searchInput.value.trim();
    document.querySelectorAll(".primary-nav .nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === "All tasks"));
    render();
    const target = elements.taskList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function toggleTask(id) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? localDate(new Date()) : null;
    saveState();
    render();
    showToast(task.completed ? "Nicely done. One step at a time." : "Task moved back to your list.");
  }

  function deleteTask(id) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    state.tasks = state.tasks.filter(item => item.id !== id);
    saveState();
    render();
    showToast("Task removed.");
  }

  function handleTaskSubmit(event) {
    event.preventDefault();
    const formData = new FormData(elements.form);
    const title = String(formData.get("title") || "").trim();
    if (!title) {
      elements.titleInput.focus();
      return;
    }
    const editingId = elements.form.dataset.editing;
    if (editingId) {
      const task = state.tasks.find(item => item.id === editingId);
      if (task) Object.assign(task, { title, description: String(formData.get("description") || "").trim(), date: String(formData.get("date") || today), priority: String(formData.get("priority")), project: String(formData.get("project") || "") });
    } else {
      state.tasks.push({ id: crypto.randomUUID(), title, description: String(formData.get("description") || "").trim(), date: String(formData.get("date") || today), priority: String(formData.get("priority")), project: String(formData.get("project") || ""), completed: false, completedAt: null });
    }
    saveState();
    closeModal();
    render();
    showToast(editingId ? "Your task has been updated." : "Task added. You've got this.");
  }

  function setTimerDisplay() {
    const minutes = Math.floor(timerRemaining / 60);
    const seconds = timerRemaining % 60;
    document.getElementById("timer-display").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const fraction = (25 * 60 - timerRemaining) / (25 * 60);
    document.getElementById("timer-ring").style.background = `conic-gradient(#6d886e ${fraction * 360}deg, #dee6da ${fraction * 360}deg)`;
  }

  function stopTimer(reset) {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    if (reset) timerRemaining = 25 * 60;
    document.getElementById("timer-button-label").textContent = "Start focusing";
    document.getElementById("timer-button-icon").innerHTML = '<use href="#i-play"></use>';
    document.getElementById("timer-caption").textContent = "Ready when you are";
    setTimerDisplay();
  }

  function startTimer() {
    timerRunning = true;
    document.getElementById("timer-button-label").textContent = "Pause session";
    document.getElementById("timer-button-icon").innerHTML = '<use href="#i-pause"></use>';
    document.getElementById("timer-caption").textContent = "One thing at a time.";
    timerInterval = setInterval(() => {
      if (timerRemaining > 0) timerRemaining -= 1;
      setTimerDisplay();
      if (timerRemaining === 0) {
        stopTimer(true);
        state.focusSessions += 1;
        saveState();
        renderFocusSessions();
        showToast("Focus session complete. Take a well-earned break.");
      }
    }, 1000);
  }

  function renderFocusSessions() {
    document.getElementById("focus-sessions").textContent = `${state.focusSessions} session${state.focusSessions === 1 ? "" : "s"} today`;
    document.querySelectorAll(".focus-dots i").forEach((dot, index) => dot.classList.toggle("filled", index < state.focusSessions % 5));
  }

  elements.form.addEventListener("submit", handleTaskSubmit);
  document.getElementById("add-task-inline").addEventListener("click", () => openModal());
  document.getElementById("empty-add").addEventListener("click", () => openModal());
  document.getElementById("modal-close").addEventListener("click", closeModal);
  elements.modal.addEventListener("click", event => { if (event.target === elements.modal) closeModal(); });
  elements.taskList.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const task = state.tasks.find(item => item.id === button.dataset.id);
    if (button.dataset.action === "toggle") toggleTask(button.dataset.id);
    if (button.dataset.action === "delete") deleteTask(button.dataset.id);
    if (button.dataset.action === "edit" && task) openModal(task);
  });
  elements.tabs.addEventListener("click", event => {
    const tab = event.target.closest("[data-filter]");
    if (!tab) return;
    currentFilter = tab.dataset.filter;
    elements.tabs.querySelectorAll(".task-tab").forEach(item => item.classList.toggle("active", item === tab));
    render();
    elements.tabs.querySelectorAll(".task-tab").forEach(item => item.classList.toggle("active", item.dataset.filter === currentFilter));
  });
  document.querySelectorAll(".primary-nav [data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  elements.projectNav.addEventListener("click", event => {
    const button = event.target.closest("[data-project-view]");
    if (button) setView(`project:${button.dataset.projectView}`);
  });
  document.getElementById("sort-toggle").addEventListener("click", event => {
    prioritySort = !prioritySort;
    event.currentTarget.querySelector("span").textContent = prioritySort ? "Date" : "Priority";
    render();
  });
  document.getElementById("search-open").addEventListener("click", openSearch);
  document.getElementById("search-close").addEventListener("click", closeSearch);
  elements.searchModal.addEventListener("click", event => { if (event.target === elements.searchModal) closeSearch(); });
  elements.searchInput.addEventListener("input", event => renderSearchResults(event.currentTarget.value));
  elements.searchResults.addEventListener("click", event => {
    const result = event.target.closest("[data-search-task]");
    if (result) selectSearchResult(result.dataset.searchTask);
  });
  elements.searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      const result = matchingTasks(elements.searchInput.value)[0];
      if (result) selectSearchResult(result.id);
      else showToast("No matching tasks found.");
    }
  });
  document.getElementById("see-upcoming").addEventListener("click", () => setView("Upcoming"));
  document.getElementById("view-upcoming").addEventListener("click", () => setView("Upcoming"));
  document.getElementById("mobile-menu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("add-project").addEventListener("click", () => {
    const name = prompt("What would you like to call this project?");
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) return showToast("Project name can't be empty.");
    if (state.projects.some(project => project.name.toLowerCase() === cleanName.toLowerCase())) return showToast("That project already exists.");
    const project = { id: crypto.randomUUID(), name: cleanName.slice(0, 32), color: projectColors[state.projects.length % projectColors.length] };
    state.projects.push(project);
    saveState();
    render();
    showToast("Your new project is ready.");
  });
  document.getElementById("timer-button").addEventListener("click", () => {
    if (timerRunning) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerRunning = false;
      document.getElementById("timer-button-label").textContent = "Resume session";
      document.getElementById("timer-button-icon").innerHTML = '<use href="#i-play"></use>';
      document.getElementById("timer-caption").textContent = "Paused. Take your time.";
    } else startTimer();
  });
  document.getElementById("timer-reset").addEventListener("click", () => stopTimer(true));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (!elements.modal.classList.contains("hidden")) closeModal();
      else if (!elements.searchModal.classList.contains("hidden")) closeSearch();
      else document.getElementById("sidebar").classList.remove("open");
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("search-open").click();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      openModal();
    }
  });

  render();
  renderFocusSessions();
})();
