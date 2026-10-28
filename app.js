const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE_KEY = "daymark-journal-v1";
const covers = ["cover-yellow","cover-blue","cover-orange","cover-purple","cover-green","cover-cream"];
const categoryCovers = {
  "Productivity":{title:"Deep Work",author:"Cal Newport",image:"https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg",cover:"cover-purple"},
  "Personal Growth":{title:"Atomic Habits",author:"James Clear",image:"https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",cover:"cover-yellow"},
  "Technology":{title:"The Design of Everyday Things",author:"Don Norman",image:"https://covers.openlibrary.org/b/isbn/9780465050659-L.jpg",cover:"cover-blue"},
  "Learning":{title:"Make It Stick",author:"Peter C. Brown",image:"https://covers.openlibrary.org/b/isbn/9780674729018-L.jpg",cover:"cover-green"},
  "Fiction":{title:"The Midnight Library",author:"Matt Haig",image:"https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg",cover:"cover-orange"},
  "Business":{title:"Zero to One",author:"Peter Thiel",image:"https://covers.openlibrary.org/b/isbn/9780804139298-L.jpg",cover:"cover-cream"},
  "Health & Habits":{title:"The Power of Habit",author:"Charles Duhigg",image:"https://covers.openlibrary.org/b/isbn/9780812981605-L.jpg",cover:"cover-green"},
  "Favorites":{title:"The Alchemist",author:"Paulo Coelho",image:"https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg",cover:"cover-yellow"}
};
const categoryNames = ["Productivity","Personal Growth","Technology","Learning","Fiction","Business","Health & Habits","Favorites"];
const defaultState = {
  profile:{name:"Daymark",readingGoal:20,dailyTaskGoal:3},
  onboarding:{completed:false,name:"",goals:[],journalPreference:""},
  books:[
    {id:"b1",title:"Atomic Habits",author:"James Clear",category:"Personal Growth",pages:320,currentPage:78,status:"reading",favorite:true,cover:"cover-yellow",image:"https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",notes:"Small habits compound over time."},
    {id:"b2",title:"The Design of Everyday Things",author:"Don Norman",category:"Technology",pages:368,currentPage:0,status:"planned",favorite:false,cover:"cover-blue",image:"https://covers.openlibrary.org/b/isbn/9780465050659-L.jpg",notes:""},
    {id:"b3",title:"Deep Work",author:"Cal Newport",category:"Productivity",pages:296,currentPage:0,status:"planned",favorite:false,cover:"cover-purple",image:"https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg",notes:""},
    {id:"b4",title:"The Practicing Mind",author:"Thomas Sterner",category:"Personal Growth",pages:160,currentPage:0,status:"planned",favorite:false,cover:"cover-cream",image:"https://covers.openlibrary.org/b/isbn/9780977657209-L.jpg",notes:""}
  ],
  shelves:[
    {id:"s1",name:"Productivity",category:"Productivity"},
    {id:"s2",name:"Personal Growth",category:"Personal Growth"},
    {id:"s3",name:"Technology",category:"Technology"},
    {id:"s4",name:"Favorites",category:"Favorites"}
  ],
  tasks:[
    {id:"t1",title:"Read 10 pages",description:"Make time for a quiet reading session.",due:todayISO(),priority:"medium",category:"Reading",done:false,created:Date.now()},
    {id:"t2",title:"Write today's journal entry",description:"Capture one lesson from today.",due:todayISO(),priority:"high",category:"Personal",done:false,created:Date.now()},
    {id:"t3",title:"Review weekly goals",description:"",due:todayISO(),priority:"low",category:"Planning",done:true,created:Date.now()}
  ],
  goals:[],
  entries:[],
  settings:{theme:"light",onboarded:false,notifications:false}
};
let state = loadState();
if (state.settings.onboarded && !state.onboarding.completed) {
  state.onboarding.completed = true;
}
let currentPage = "home";
let onboardingStep = 1;
let taskFilter = "all";
let bookSearch = "";
let bookStatus = "all";
let bookCategory = "all";
let deferredInstallPrompt = null;
let toastTimer;
let goalClock = null;
let pageLoaderTimer = null;

function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function uid(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function escapeHTML(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function loadState(){
  try{const saved=localStorage.getItem(STORAGE_KEY);if(saved){const parsed=JSON.parse(saved);return {...structuredClone(defaultState),...parsed,profile:{...defaultState.profile,...parsed.profile},settings:{...defaultState.settings,...parsed.settings}};}}
  catch(error){console.warn("Could not read data; using defaults.",error);}
  return structuredClone(defaultState);
}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch(error){console.error(error);showToast("Could not save.");return false;}}
function showToast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function simulateRequest(action, delay=420){return new Promise((resolve,reject)=>{setTimeout(()=>{try{resolve(action());}catch(error){reject(error);}},delay);});}
function dateLabel(value){if(!value)return "No due date";const d=new Date(`${value}T12:00:00`);return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:d.getFullYear()!==new Date().getFullYear()?"numeric":undefined});}
function timeGreeting(){const h=new Date().getHours();return h<12?"Good morning":h<18?"Good afternoon":"Good evening";}
function isInstalled(){return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone===true;}
function updateMode(){document.body.classList.toggle("installed",isInstalled());$("#installBtn").hidden=isInstalled();}
function showPageLoader(){const loader=$("#pageLoader");if(loader){loader.hidden=false;document.body.classList.add("is-loading");}}
function hidePageLoader(){const loader=$("#pageLoader");if(loader){loader.hidden=true;document.body.classList.remove("is-loading");}}
function setPage(page){
  if(page===currentPage&&!pageLoaderTimer)return;
  currentPage=page;
  $("#mobileMenu").hidden=true;$("#menuToggle").setAttribute("aria-expanded","false");
  $$(".nav-link,.bottom-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  showPageLoader();
  clearTimeout(pageLoaderTimer);
  pageLoaderTimer=setTimeout(()=>{
    pageLoaderTimer=null;
    try{renderPage();}finally{hidePageLoader();}
    $("#mainContent").focus({preventScroll:true});
    window.scrollTo({top:0,behavior:"smooth"});
  },1200);
}
function coverFor(book){return book.image||(categoryCovers[book.category]||{}).image||"";}
function shelfBooks(category){
  const owned=state.books.filter(b=>category==="Favorites"?b.favorite:b.category===category).map(b=>({title:b.title,author:b.author,cover:b.cover,image:coverFor(b)}));
  if(owned.length)return owned.slice(0,3);
  const rep=categoryCovers[category]||categoryCovers.Favorites;
  return rep?[{title:rep.title,author:rep.author,cover:rep.cover,image:rep.image,representative:true}]:[];
}
function bookCover(book){const image=coverFor(book);return `<div class="book-cover ${escapeHTML(book.cover||"cover-cream")}">${image?`<img class="cover-img" src="${escapeHTML(image)}" alt="Cover of ${escapeHTML(book.title)}" loading="lazy" onerror="this.style.display='none'">`:""}<strong>${escapeHTML(book.title)}</strong><small>${escapeHTML(book.author)}</small></div>`;}
function emptyState(title,description,action,label){return `<div class="empty-state"><strong>${escapeHTML(title)}</strong><div>${escapeHTML(description)}</div>${action?`<button class="button button-primary" style="margin-top:16px" data-action="${action}">${escapeHTML(label||"Add new")}</button>`:""}</div>`;}
function renderPage(){
  const pages={home:renderHome,library:renderLibrary,journal:renderJournal,todo:renderTodo,goals:renderGoals,categories:renderCategories,stats:renderStats,settings:renderSettings,docs:renderDocs};
  $("#mainContent").innerHTML=(pages[currentPage]||renderHome)();
  bindPageEvents();
  if(currentPage==="goals")startGoalClock();
  else if(goalClock){clearInterval(goalClock);goalClock=null;}
}
function renderHome(){
  const todayTasks=state.tasks.filter(t=>t.due===todayISO()),done=todayTasks.filter(t=>t.done).length;
  const reading=state.books.filter(b=>b.status==="reading"),completed=state.books.filter(b=>b.status==="completed");
  const pagesRead=state.books.reduce((sum,b)=>sum+(Number(b.currentPage)||0),0);
  const nextTask=state.tasks.filter(t=>!t.done).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"))[0];
  return `<section class="page-heading"><div><p class="eyebrow">YOUR PERSONAL SPACE</p><h1>${timeGreeting()}, ${escapeHTML(state.profile.name||"Daymark")}.</h1><p class="subtitle">A little reading, a little reflection, a more intentional day.</p></div><button class="button button-primary" data-action="new-task">＋ Add a task</button></section>
  <div class="grid stats-grid">
    <article class="stat-card"><div class="stat-top"><span>Currently reading</span><span class="stat-mark">▤</span></div><div class="stat-number">${reading.length}</div><small class="subtitle">Books in progress</small></article>
    <article class="stat-card"><div class="stat-top"><span>Books completed</span><span class="stat-mark">✓</span></div><div class="stat-number">${completed.length}</div><small class="subtitle">Your reading milestones</small></article>
    <article class="stat-card"><div class="stat-top"><span>Pages read</span><span class="stat-mark">↗</span></div><div class="stat-number">${pagesRead}</div><small class="subtitle">Across your library</small></article>
    <article class="stat-card"><div class="stat-top"><span>Journal entries</span><span class="stat-mark">✎</span></div><div class="stat-number">${state.entries.length}</div><small class="subtitle">Thoughts captured</small></article>
  </div>
  <section class="section"><div class="section-heading"><h2>My shelves</h2><button class="text-button" data-page="library">View library →</button></div>
  <div class="shelf-list">${state.shelves.slice(0,4).map(s=>{const owned=state.books.filter(b=>s.category==="Favorites"?b.favorite:b.category===s.category),thumbs=shelfBooks(s.category);return `<article class="shelf-card" data-shelf="${escapeHTML(s.category)}"><div class="shelf-art ${thumbs.length===1?"single":""}" style="background:${s.category==="Technology"?"#d8eafa":s.category==="Productivity"?"#ffe7d6":s.category==="Favorites"?"#eee4ff":"#f8eebf"}">${thumbs.map(b=>`<div class="mini-cover">${b.image?`<img src="${escapeHTML(b.image)}" alt="Cover of ${escapeHTML(b.title)}" loading="lazy" onerror="this.style.display='none'">`:""}<span>${escapeHTML(b.title)}</span></div>`).join("")||`<div class="mini-cover"><span>YOUR BOOKS</span></div>`}</div><div class="shelf-meta"><div><h3>${escapeHTML(s.name)}</h3><p>${owned.length} ${owned.length===1?"book":"books"}</p></div><span>↗</span></div></article>`}).join("")}</div></section>
  <section class="section dashboard-grid"><article class="panel"><div class="section-heading"><h2>Today's focus</h2><button class="text-button" data-page="todo">All tasks →</button></div>
  ${nextTask?`<div class="focus-item"><div class="focus-icon">☑</div><div style="flex:1"><strong>${escapeHTML(nextTask.title)}</strong><p>${escapeHTML(nextTask.description||"One small step is still progress.")}</p><div class="card-meta" style="margin-top:9px"><span>${dateLabel(nextTask.due)}</span><span class="priority priority-${nextTask.priority}">${escapeHTML(nextTask.priority)} priority</span></div></div></div>`:`<div class="empty-state"><strong>You're all caught up.</strong>Enjoy the space you've made.</div>`}
  <div style="margin-top:20px;display:flex;justify-content:space-between"><span class="subtitle">Today's tasks</span><strong>${done}/${todayTasks.length} complete</strong></div><div class="progress-track"><div class="progress-fill" style="width:${todayTasks.length?done/todayTasks.length*100:0}%"></div></div></article>
  <article class="panel"><div class="section-heading"><h2>Quick reflection</h2><span>✦</span></div><div class="journal-prompt"><p>What is one thing you learned today that you want to remember?</p></div><button class="button button-secondary" data-action="new-entry" style="width:100%">Write in your journal</button><div style="height:14px"></div><button class="button button-secondary" data-page="stats" style="width:100%">View your progress</button></article></section>`;
}
function renderLibrary(){
  const list=state.books.filter(b=>(`${b.title} ${b.author}`.toLowerCase().includes(bookSearch.toLowerCase()))&&(bookStatus==="all"||b.status===bookStatus)&&(bookCategory==="all"||(bookCategory==="Favorites"?b.favorite:b.category===bookCategory)));
  return `<section class="page-heading"><div><p class="eyebrow">YOUR COLLECTION</p><h1>My library</h1><p class="subtitle">Keep your current reads, future favorites, and finished books together.</p></div><button class="button button-primary" data-action="new-book">＋ Add book</button></section>
  <div class="toolbar"><input class="field search-field" id="bookSearch" placeholder="Search books or authors..." value="${escapeHTML(bookSearch)}" aria-label="Search books"><select class="field" id="bookStatus" aria-label="Filter by reading status"><option value="all">All statuses</option><option value="reading">Reading</option><option value="planned">Want to read</option><option value="completed">Completed</option></select><button class="button button-secondary" data-action="new-shelf">＋ Shelf</button>${bookCategory!=="all"?`<button class="filter-btn active" data-action="clear-category">${escapeHTML(bookCategory)} ×</button>`:""}</div>
  ${list.length?`<div class="book-grid">${list.map(b=>`<article class="book-card" data-book="${b.id}" tabindex="0" role="button" aria-label="Open ${escapeHTML(b.title)}">${bookCover(b)}<div class="book-info"><strong>${escapeHTML(b.title)}</strong><small>${escapeHTML(b.author)} · ${escapeHTML(b.status==="reading"?"Reading":b.status==="completed"?"Completed":"Want to read")}</small>${b.status==="reading"?`<div class="book-progress"><span style="width:${Math.min(100,Math.round((b.currentPage/Math.max(1,b.pages))*100))}%"></span></div>`:""}</div></article>`).join("")}</div>`:emptyState("No books found","Add a book or change your search filters.","new-book","Add your first book")}`;
}
function renderJournal(){
  const entries=[...state.entries].sort((a,b)=>b.updated-a.updated);
  return `<section class="page-heading"><div><p class="eyebrow">A SPACE FOR YOUR THOUGHTS</p><h1>My journal</h1><p class="subtitle">Collect ideas, notice patterns, and keep the thoughts worth remembering.</p></div><button class="button button-primary" data-action="new-entry">＋ New entry</button></section>
  <div class="journal-layout"><section><div class="journal-prompt"><p class="eyebrow">A PROMPT FOR TODAY</p><p>What made you feel curious, grateful, or proud today?</p></div><div class="toolbar"><input class="field" id="journalSearch" placeholder="Search your entries..." aria-label="Search journal entries"></div><div class="journal-list" id="journalList">${entries.length?entries.map(entryCard).join(""):emptyState("Your story starts here","Write your first entry.","new-entry","Write an entry")}</div></section>
  <aside class="panel"><p class="eyebrow">YOUR WRITING SPACE</p><h2>Write freely.</h2><p class="subtitle"></p><div class="section"><div class="stat-top"><span>Entries written</span><strong>${state.entries.length}</strong></div><div class="stat-top" style="margin-top:12px"><span>Words captured</span><strong>${state.entries.reduce((n,e)=>n+(e.body.trim()?e.body.trim().split(/\\s+/).length:0),0)}</strong></div></div><div class="form-stack" style="margin-top:24px"><button class="button button-secondary" style="width:100%" data-action="export-journal">Export journal</button><button class="button button-secondary" style="width:100%" data-action="import-journal">Import journal</button></div></aside></div>`;
}
function entryCard(e){const img=e.image?`<img class="entry-img" src="${escapeHTML(e.image)}" alt="Entry photo" loading="lazy" onerror="this.style.display='none'">`:"";return `<article class="journal-card" data-entry-card="${e.id}">${img}<div class="card-meta"><span>${dateLabel(e.date)} · ${new Date(e.updated).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span><div class="card-actions"><button class="small-btn" data-action="edit-entry" data-id="${e.id}">Edit</button><button class="small-btn" data-action="delete-entry" data-id="${e.id}">Delete</button></div></div><h3 style="margin-top:12px">${escapeHTML(e.title||"Untitled reflection")}</h3><p>${escapeHTML(e.body.length>260?e.body.slice(0,260)+"…":e.body)}</p>${e.tag?`<span class="pill">${escapeHTML(e.tag)}</span>`:""}</article>`;}
function renderTodo(){
  const all=[...state.tasks].sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"));
  const tasks=all.filter(t=>taskFilter==="all"||(taskFilter==="today"&&t.due===todayISO())||(taskFilter==="upcoming"&&t.due>todayISO()&&!t.done)||(taskFilter==="completed"&&t.done));
  const today=state.tasks.filter(t=>t.due===todayISO()),done=today.filter(t=>t.done).length;
  return `<section class="page-heading"><div><p class="eyebrow">MAKE ROOM FOR WHAT MATTERS</p><h1>Today's to-do</h1><p class="subtitle">${new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})} · One thing at a time.</p></div><button class="button button-primary" data-action="new-task">＋ Add task</button></section>
  <div class="todo-summary"><div class="todo-progress"><p class="eyebrow">DAILY PROGRESS</p><h2>${done} of ${today.length} tasks done</h2><p>${today.length&&done===today.length?"Everything on today's list is complete. Well done.":`${Math.max(0,today.length-done)} tasks left on today's list.`}</p><div class="progress-track"><div class="progress-fill" style="width:${today.length?done/today.length*100:0}%"></div></div></div><article class="stat-card"><div class="stat-top"><span>All tasks</span><span class="stat-mark">☑</span></div><div class="stat-number">${state.tasks.length}</div><p class="subtitle">${state.tasks.filter(t=>t.done).length} completed in total</p><button class="text-button" data-action="new-task">Plan another task →</button></article></div>
  <div class="section-heading"><h2>Your tasks</h2><span class="pill">${tasks.length} shown</span></div><div class="task-filters">${[["all","All"],["today","Today"],["upcoming","Upcoming"],["completed","Completed"]].map(([id,label])=>`<button class="filter-btn ${taskFilter===id?"active":""}" data-task-filter="${id}">${label}</button>`).join("")}</div>
  <div class="task-list">${tasks.length?tasks.map(t=>`<article class="task-card ${t.done?"done":""}"><input class="task-check" type="checkbox" data-toggle-task="${t.id}" ${t.done?"checked":""} aria-label="Mark ${escapeHTML(t.title)} complete"><div class="task-main"><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.category||"General")} · ${dateLabel(t.due)}${t.description?` · ${escapeHTML(t.description)}`:""}</small></div><span class="priority priority-${t.priority}">${escapeHTML(t.priority)}</span><button class="small-btn" data-action="edit-task" data-id="${t.id}" aria-label="Edit task">Edit</button><button class="small-btn" data-action="delete-task" data-id="${t.id}" aria-label="Delete task">×</button></article>`).join(""):emptyState("Nothing on this list","Add a task when you're ready to plan your next step.","new-task","Add task")}</div>`;
}
function goalDaysLeft(goal){if(!goal.due)return null;return Math.ceil((new Date(`${goal.due}T12:00:00`)-new Date())/86400000);}
function goalStatus(goal){const days=goalDaysLeft(goal);if(goal.done)return "Completed";if(days===null)return "No deadline";if(days<0)return `${Math.abs(days)} ${Math.abs(days)===1?"day":"days"} overdue`;if(days===0)return "Due today";return `${days} ${days===1?"day":"days"} left`;}
function renderGoals(){
  const list=[...state.goals].sort((a,b)=>Number(a.done)-Number(b.done)||(a.due||"9999").localeCompare(b.due||"9999"));
  const done=list.filter(g=>g.done).length,active=list.length-done,dueSoon=list.filter(g=>!g.done&&g.due&&goalDaysLeft(g)<=7).length;
  return `<section class="page-heading"><div><p class="eyebrow">TURN INTENTIONS INTO ACTION</p><h1>My goals</h1><p class="subtitle">Give the things that matter a target, then take one step at a time.</p></div><button class="button button-primary" data-action="new-goal">＋ Add goal</button></section>
  <div class="grid stats-grid"><article class="stat-card"><div class="stat-top"><span>All goals</span><span class="stat-mark">★</span></div><div class="stat-number">${list.length}</div><small class="subtitle">On your list</small></article><article class="stat-card"><div class="stat-top"><span>In progress</span><span class="stat-mark">↗</span></div><div class="stat-number">${active}</div><small class="subtitle">Still moving</small></article><article class="stat-card"><div class="stat-top"><span>Completed</span><span class="stat-mark">✓</span></div><div class="stat-number">${done}</div><small class="subtitle">Goals achieved</small></article><article class="stat-card"><div class="stat-top"><span>Due soon</span><span class="stat-mark">◷</span></div><div class="stat-number">${dueSoon}</div><small class="subtitle">Next 7 days</small></article></div>
  <section class="section"><div class="section-heading"><h2>Your goals</h2><span class="pill">${list.length} total</span></div><div class="task-list">${list.length?list.map(goalCard).join(""):emptyState("No goals yet","Add a goal to give your next steps a direction.","new-goal","Add your first goal")}</div></section>`;
}
function goalCard(g){
  return `<article class="task-card ${g.done?"done":""}"><div class="task-main"><strong>${escapeHTML(g.title)}</strong><small>${escapeHTML(g.description||"No description")} · <span data-goal-status="${g.id}">${goalStatus(g)}</span></small>${typeof g.progress==="number"?`<div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,Math.max(0,g.progress))}%"></div></div>`:""}</div><span class="pill">${g.progress||0}%</span><button class="small-btn" data-action="toggle-goal" data-id="${g.id}">${g.done?"Undo":"Done"}</button><button class="small-btn" data-action="edit-goal" data-id="${g.id}">Edit</button><button class="small-btn" data-action="delete-goal" data-id="${g.id}" aria-label="Delete goal">×</button></article>`;
}
function goalForm(goal={}){
  openModal(goal.id?"Edit goal":"Add a goal",`<form id="goalForm" class="form-stack">${formField("Goal","goalTitle",goal.title||"","text",true)}<div class="form-field"><label for="goalDescription">Description</label><textarea class="field" id="goalDescription" name="description" placeholder="Why does this matter?">${escapeHTML(goal.description||"")}</textarea></div><div class="form-row">${formField("Target date","goalDue",goal.due||"","date")}<div class="form-field"><label for="goalProgress">Progress (%)</label><input class="field" id="goalProgress" type="number" min="0" max="100" value="${Number(goal.progress)||0}"></div></div><div class="form-actions"><button type="button" class="button button-secondary" id="cancelForm">Cancel</button><button type="submit" class="button button-primary">Save</button></div></form>`);
  $("#cancelForm").onclick=closeModal;
  $("#goalForm").onsubmit=async e=>{e.preventDefault();const btn=$('button[type="submit"]',e.currentTarget);btn.disabled=true;btn.textContent="Saving…";try{await simulateRequest(()=>{const data={title:$("#goalTitle").value.trim(),description:$("#goalDescription").value.trim(),due:$("#goalDue").value,progress:Math.min(100,Math.max(0,Number($("#goalProgress").value)||0))};if(!data.title)throw Error("Enter a goal title.");if(goal.id)Object.assign(goal,data,{warnedSoon:false,warnedLate:false});else state.goals.push({id:uid(),...data,done:false,created:Date.now()});persist();},400);closeModal();renderPage();showToast("Saved");}catch(err){btn.disabled=false;btn.textContent="Save";showToast(err.message||"Could not save.");}};
}
function startGoalClock(){
  const tick=()=>{$$("[data-goal-status]").forEach(el=>{const g=state.goals.find(x=>x.id===el.dataset.goalStatus);if(g)el.textContent=goalStatus(g);});};
  tick();
  if(goalClock)clearInterval(goalClock);
  goalClock=setInterval(tick,60000);
}
function checkGoalAlerts(){
  state.goals.filter(g=>!g.done&&g.due).forEach(g=>{
    const days=goalDaysLeft(g);if(days===null)return;
    if(days<0&&!g.warnedLate){g.warnedLate=true;persist();showToast(`"${g.title}" is overdue`);}
    else if(days>=0&&days<=1&&!g.warnedSoon){g.warnedSoon=true;persist();showToast(`"${g.title}" is due ${days===0?"today":"tomorrow"}`);}
  });
}
function renderCategories(){
  const icons=["◷","✦","⌘","▤","◇","↗","♡","★"],colors=["#fff0bd","#e8ddff","#dceefa","#ffe0d1","#e8e0d0","#dcefe5","#ffe0e7","#fff0bd"];
  return `<section class="page-heading"><div><p class="eyebrow">MAKE IT YOURS</p><h1>Categories</h1><p class="subtitle">Find the right shelf for the things you want to explore.</p></div><button class="button button-primary" data-action="new-shelf">＋ Add shelf</button></section><div class="grid category-grid">${categoryNames.map((name,i)=>`<article class="category-card" data-category="${escapeHTML(name)}"><div class="category-blob" style="background:${colors[i]}">${icons[i]}</div><h3>${escapeHTML(name)}</h3><p>${state.books.filter(b=>name==="Favorites"?b.favorite:b.category===name).length} books</p></article>`).join("")}${state.shelves.filter(s=>!categoryNames.includes(s.name)).map(s=>`<article class="category-card" data-category="${escapeHTML(s.category)}"><div class="category-blob" style="background:#e8ddff">▤</div><h3>${escapeHTML(s.name)}</h3><p>${state.books.filter(b=>b.category===s.category).length} books</p></article>`).join("")}</div>`;
}
function renderStats(){
  const books=state.books,tasks=state.tasks,entries=state.entries;
  const totalPages=books.reduce((n,b)=>n+Number(b.pages||0),0),readPages=books.reduce((n,b)=>n+Number(b.currentPage||0),0);
  const readingPct=totalPages?Math.min(100,Math.round(readPages/totalPages*100)):0;
  const completedBooks=books.filter(b=>b.status==="completed").length,reading=books.filter(b=>b.status==="reading").length,planned=books.filter(b=>b.status==="planned").length;
  const completedTasks=tasks.filter(t=>t.done).length,taskPct=tasks.length?Math.round(completedTasks/tasks.length*100):0;
  const words=entries.reduce((n,e)=>n+(e.body&&e.body.trim()?e.body.trim().split(/\s+/).length:0),0);
  const today=new Date();
  const days=[...Array(7)].map((_,i)=>{const d=new Date(today);d.setDate(d.getDate()-(6-i));const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;const count=entries.filter(e=>e.date===key).length+tasks.filter(t=>t.done&&t.due===key).length;return {label:d.toLocaleDateString(undefined,{weekday:"short"}),count};});
  const maxDay=Math.max(1,...days.map(d=>d.count));
  const categories=categoryNames.map(name=>({name,count:books.filter(b=>name==="Favorites"?b.favorite:b.category===name).length})).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  const maxCat=Math.max(1,...categories.map(c=>c.count));
  return `<section class="page-heading"><div><p class="eyebrow">SMALL STEPS ADD UP</p><h1>Your progress</h1><p class="subtitle">A clear view of your reading, reflection, and daily follow-through.</p></div><span class="pill">Updated ${today.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}</span></section>
  <div class="stats-hero">
    <article class="kpi-card"><span class="kpi-icon">▤</span><div class="kpi-value">${books.length}</div><div class="kpi-label">Books in library</div><small>${reading} reading · ${planned} planned</small></article>
    <article class="kpi-card"><span class="kpi-icon">✓</span><div class="kpi-value">${completedBooks}</div><div class="kpi-label">Books completed</div><small>${readingPct}% of pages read</small></article>
    <article class="kpi-card"><span class="kpi-icon">☑</span><div class="kpi-value">${completedTasks}</div><div class="kpi-label">Tasks completed</div><small>${taskPct}% completion rate</small></article>
    <article class="kpi-card"><span class="kpi-icon">✎</span><div class="kpi-value">${entries.length}</div><div class="kpi-label">Journal entries</div><small>${words.toLocaleString()} words captured</small></article>
  </div>
  <div class="stats-panels">
    <section class="panel chart-card"><div class="section-heading"><h2>Reading progress</h2><span class="pill">${readingPct}%</span></div><div class="donut" style="--value:${readingPct}"><div class="donut-center"><strong>${readingPct}%</strong><span>of pages</span></div></div><div class="legend"><div class="legend-row"><span><i class="legend-dot"></i>Pages read</span><strong>${readPages.toLocaleString()}</strong></div><div class="legend-row"><span><i class="legend-dot muted"></i>Pages remaining</span><strong>${Math.max(0,totalPages-readPages).toLocaleString()}</strong></div></div></section>
    <section class="panel chart-card"><div class="section-heading"><h2>Task completion</h2><span class="pill">${taskPct}%</span></div><div class="metric-row"><div class="metric-top"><span>Completed</span><strong>${completedTasks} / ${tasks.length}</strong></div><div class="metric-track"><div class="metric-fill" style="width:${taskPct}%"></div></div></div><div class="metric-row"><div class="metric-top"><span>Still open</span><strong>${tasks.length-completedTasks}</strong></div><div class="metric-track"><div class="metric-fill navy" style="width:${tasks.length?Math.round((tasks.length-completedTasks)/tasks.length*100):0}%"></div></div></div><div class="legend" style="margin-top:20px"><div class="legend-row"><span><i class="legend-dot"></i>Completed</span><strong>${completedTasks}</strong></div><div class="legend-row"><span><i class="legend-dot muted"></i>Open</span><strong>${tasks.length-completedTasks}</strong></div></div></section>
  </div>
  <section class="panel chart-card" style="margin-bottom:18px"><div class="section-heading"><h2>Last 7 days</h2><span class="subtitle">Entries and completed tasks</span></div><div class="week-chart">${days.map(d=>`<div class="week-col"><div class="week-bar" style="height:${d.count?Math.max(8,Math.round(d.count/maxDay*100)):2}%"><span>${d.count}</span></div><small>${d.label}</small></div>`).join("")}</div></section>
  <section class="panel chart-card"><div class="section-heading"><h2>Library by category</h2><span class="subtitle">${categories.length} active</span></div>${categories.length?`<div class="category-bars">${categories.map(c=>`<div class="category-bar-row"><div class="category-bar-top"><span>${escapeHTML(c.name)}</span><span>${c.count} ${c.count===1?"book":"books"}</span></div><div class="category-bar-track"><div class="category-bar-fill" style="width:${Math.round(c.count/maxCat*100)}%"></div></div></div>`).join("")}</div>`:`<p class="stats-empty">Add books to see how your library is distributed.</p>`}</section>`;
}
function renderSettings(){
  const notif="Notification" in window?Notification.permission:"unsupported";
  const notifLabel=notif==="granted"?"Enabled":notif==="denied"?"Blocked":notif==="unsupported"?"Not supported":"Not requested";
  return `<section class="page-heading"><div><p class="eyebrow">MAKE YOUR SPACE YOURS</p><h1>Settings</h1><p class="subtitle">Personalize your journal and keep your data safe.</p></div></section>
  <div class="settings-grid">
    <section class="settings-group"><div class="settings-group-head"><span class="group-icon">◉</span><div><h2>Profile</h2><p>How your space greets you</p></div></div>
      <div class="setting-row"><span class="setting-icon">Aa</span><div class="setting-text"><strong>Your name</strong><p>Used in your home greeting</p></div><input class="field setting-control" id="profileName" value="${escapeHTML(state.profile.name)}" aria-label="Your name"></div>
      <div class="setting-row"><span class="setting-icon">◎</span><div class="setting-text"><strong>Daily reading goal</strong><p>Pages to aim for each day</p></div><input class="field setting-control" type="number" min="1" max="500" id="readingGoal" value="${state.profile.readingGoal}" aria-label="Daily reading goal"></div>
      <div class="setting-row"><span class="setting-icon">✎</span><div class="setting-text"><strong>Journal preference</strong><p>How you like to journal</p></div><select class="field setting-control" id="settingsJournalPref"><option value="">Not set</option>${["Free writing","Guided prompts","Mood check-ins","A combination"].map(p=>`<option ${p===state.onboarding.journalPreference?"selected":""}>${p}</option>`).join("")}</select></div>
      <div class="setting-row"><span class="setting-icon">🎯</span><div class="setting-text"><strong>Your goals</strong><p>${(state.onboarding.goals||[]).length?(state.onboarding.goals||[]).join(", "):"Not set"}</p></div></div>
      <div class="setting-row"><span class="setting-icon">↩</span><div class="setting-text"><strong>Edit onboarding preferences</strong><p>Re-run setup to change your name, goals, or journal style</p></div><button class="button button-secondary" data-action="onboard-edit">Edit preferences</button></div>
    </section>
    <section class="settings-group"><div class="settings-group-head"><span class="group-icon">◐</span><div><h2>Preferences</h2><p>Appearance and reminders</p></div></div>
      <div class="setting-row"><span class="setting-icon">◐</span><div class="setting-text"><strong>Appearance</strong><p>${state.settings.theme==="dark"?"Dark theme is on":"Light theme is on"}</p></div><button class="button button-secondary" id="settingsTheme">${state.settings.theme==="dark"?"Use light theme":"Use dark theme"}</button></div>
      <div class="setting-row"><span class="setting-icon">◔</span><div class="setting-text"><strong>Notifications</strong><p>${notifLabel}</p></div><button class="button button-secondary" id="enableNotif">Enable notifications</button></div>
    </section>
    <section class="settings-group"><div class="settings-group-head"><span class="group-icon">↕</span><div><h2>Your data</h2><p>Back up, move, or share</p></div></div>
      <div class="setting-row"><span class="setting-icon">↧</span><div class="setting-text"><strong>Export everything</strong><p>Download a full JSON backup</p></div><button class="button button-secondary" data-action="export">Export</button></div>
      <div class="setting-row"><span class="setting-icon">↥</span><div class="setting-text"><strong>Import everything</strong><p>Restore from a backup file</p></div><button class="button button-secondary" data-action="import">Choose file</button></div>
      <div class="setting-row"><span class="setting-icon">↗</span><div class="setting-text"><strong>Share</strong><p>Invite someone to your space</p></div><button class="button button-secondary" data-action="share">Share</button></div>
    </section>
    <section class="settings-group danger"><div class="settings-group-head"><span class="group-icon">!</span><div><h2>Danger zone</h2><p>This cannot be undone</p></div></div>
      <div class="setting-row"><span class="setting-icon">⟲</span><div class="setting-text"><strong>Reset all data</strong><p>Delete books, tasks, and entries</p></div><button class="button button-danger" data-action="reset">Reset</button></div>
    </section>
  </div>
  <div class="settings-actions"><p>Save to apply your name and reading goal across the journal.</p><button class="button button-primary" data-action="save-settings">Save changes</button></div>`;
}
function renderDocs(){
  return `<section class="page-heading"><div><p class="eyebrow">GETTING STARTED</p><h1>How to use Daymark JOURNAL</h1><p class="subtitle">A quick guide to your books, thoughts, and daily goals.</p></div></section>
  <section class="section"><div class="section-heading"><h2>1. Build your library</h2></div>
    <p>Go to Library and tap <strong>＋ Add book</strong>. Enter the title, author, category, and page count. You can upload your own cover image; if you skip it, a cover matching the category is used. Your book then shows on the matching shelf on Home.</p>
  </section>
  <section class="section"><div class="section-heading"><h2>2. Organize with shelves</h2></div>
    <p>Shelves group books by category such as Productivity, Fiction, or Technology. Tap a shelf on Home to jump to that category in the library. Create your own shelves from Library using <strong>＋ Shelf</strong>.</p>
  </section>
  <section class="section"><div class="section-heading"><h2>3. Track your reading</h2></div>
    <p>Open any book to update your current page. Mark it complete when you finish. Progress appears on the book card and in your Stats.</p>
  </section>
  <section class="section"><div class="section-heading"><h2>4. Write in your journal</h2></div>
    <p>Tap <strong>＋ New entry</strong> to capture a reflection. Add a title, a tag, and optionally attach a photo. Entries show newest first and count toward your Stats.</p>
  </section>
  <section class="section"><div class="section-heading"><h2>5. Manage tasks and goals</h2></div>
    <p>Add tasks with due dates and priorities, then check them off as you complete them. Add longer-term goals with target dates and track progress as a percentage.</p>
  </section>
  <section class="section"><div class="section-heading"><h2>6. Keep your data safe</h2></div>
    <p>In Settings you can export your journal as a JSON backup, import a backup, update your name, or switch themes. Your data is saved locally in your browser.</p>
  </section>
  <section class="section"><div class="section-heading"><h2>7. Install the app</h2></div>
    <p>Tap <strong>Get the app</strong> in the top bar (or use your browser's "Add to Home screen") to install Daymark JOURNAL. Once installed, the bottom navigation appears and the app works offline.</p>
  </section>`;
}
function renderOnboardingFlow(){
  $("#onboarding").innerHTML=renderOnboarding(onboardingStep);
  bindOnboardingEvents();
}
function renderOnboarding(step){
  const brand=`<div class="onboarding-brand">Daymark <span>JOURNAL</span></div>`;
  const progress=`<div class="onboarding-progress">Step ${step} of 3</div>`;
  let body="";
  if(step===1)body=renderOnboardingName();
  else if(step===2)body=renderOnboardingGoals();
  else body=renderOnboardingJournal();
  const back=step>1?`<button class="button button-secondary" data-action="onboard-back">Back</button>`:"";
  const next=step===3?`<button class="button button-primary" data-action="onboard-finish">Finish setup</button>`:`<button class="button button-primary" data-action="onboard-next">Next</button>`;
  const skip=step===3?`<a class="onboarding-skip" href="#" data-action="onboard-skip-all">Skip setup</a>`:`<a class="onboarding-skip" href="#" data-action="onboard-skip-step">Skip question</a>`;
  return `<div class="onboarding-container"><div class="onboarding-header">${brand}<p class="onboarding-subtitle">Let's set up your space</p>${progress}</div><div class="onboarding-body">${body}</div><div class="onboarding-footer">${back}${next}${skip}</div></div>`;
}
function renderOnboardingName(){
  const name=state.onboarding.name||"";
  return `<div class="onboarding-step active" data-step="1"><h2>What should we call you?</h2><p>This personalizes your greetings and dashboard.</p><div class="onboarding-field"><label for="onboardName">Your name</label><input class="field" id="onboardName" type="text" placeholder="e.g. Alpha" value="${escapeHTML(name)}"></div></div>`;
}
function renderOnboardingGoals(){
  const goals=["Personal journaling","Manage daily tasks","Build better habits","Track goals","All of the above"];
  const selected=new Set(state.onboarding.goals||[]);
  const chips=goals.map(g=>{const sel=selected.has(g)||selected.has("All of the above");return `<label class="onboarding-option ${sel?"selected":""}"><input type="checkbox" value="${escapeHTML(g)}" ${sel?"checked":""}><span>${escapeHTML(g)}</span><span class="checkmark">✓</span></label>`}).join("");
  return `<div class="onboarding-step active" data-step="2"><h2>What are your goals?</h2><p>Select all that apply so we can tailor your experience.</p><div class="onboarding-options">${chips}</div></div>`;
}
function renderOnboardingJournal(){
  const prefs=["Free writing","Guided prompts","Mood check-ins","A combination"];
  const selected=state.onboarding.journalPreference||"";
  const chips=prefs.map(p=>{const sel=p===selected;return `<label class="onboarding-option ${sel?"selected":""}"><input type="radio" name="onboardJournal" value="${escapeHTML(p)}" ${sel?"checked":""}><span>${escapeHTML(p)}</span><span class="checkmark">✓</span></label>`}).join("");
  return `<div class="onboarding-step active" data-step="3"><h2>How do you prefer to journal?</h2><p>Choose the style that fits you best.</p><div class="onboarding-options">${chips}</div></div>`;
}
function bindOnboardingEvents(){
  $("#onboardName")?.addEventListener("input",e=>{state.onboarding.name=e.target.value.trim();});
  $$("#onboarding [data-step='2'] .onboarding-option input[type='checkbox']").forEach(input=>{
    input.addEventListener("change",e=>{
      const val=e.target.value;
      if(val==="All of the above"){state.onboarding.goals=e.target.checked?goalsAll():state.onboarding.goals.filter(g=>g!=="All of the above");}
      else{
        state.onboarding.goals=state.onboarding.goals.filter(g=>g!=="All of the above");
        if(e.target.checked){if(!state.onboarding.goals.includes(val))state.onboarding.goals.push(val);}
        else state.onboarding.goals=state.onboarding.goals.filter(g=>g!==val);
      }
      renderOnboardingFlow();
    });
  });
  $$("#onboarding [data-step='3'] .onboarding-option input[type='radio']").forEach(input=>{
    input.addEventListener("change",e=>{state.onboarding.journalPreference=e.target.value;});
  });
}
function goalsAll(){return["Personal journaling","Manage daily tasks","Build better habits","Track goals","All of the above"];}
function nextOnboardingStep(){
  if(onboardingStep===1){const name=($("#onboardName")||{}).value?.trim()||"";state.onboarding.name=name;if(name)state.profile.name=name;}
  onboardingStep=Math.min(3,onboardingStep+1);
  renderOnboardingFlow();
}
function prevOnboardingStep(){onboardingStep=Math.max(1,onboardingStep-1);renderOnboardingFlow();}
function completeOnboarding(){
  state.onboarding.completed=true;
  state.settings.onboarded=true;
  if(!state.profile.name)state.profile.name="Daymark";
  persist();
  $("#onboarding").hidden=true;
  $("#appShell").hidden=false;
  renderPage();
  showToast("Welcome to Daymark, "+escapeHTML(state.profile.name)+"!");
}
function bindPageEvents(){
  $("#bookSearch")?.addEventListener("input",e=>{bookSearch=e.target.value;const pos=e.target.selectionStart;renderPage();const field=$("#bookSearch");field.focus();field.setSelectionRange(pos,pos);});
  $("#bookStatus")?.addEventListener("change",e=>{bookStatus=e.target.value;renderPage();$("#bookStatus").value=bookStatus;});
  $("#journalSearch")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();$$("[data-entry-card]").forEach(card=>card.hidden=!card.textContent.toLowerCase().includes(q));});
  $$("[data-book]").forEach(card=>{const open=()=>openBook(card.dataset.book);card.addEventListener("click",open);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});});
  $$("[data-shelf]").forEach(card=>card.addEventListener("click",()=>{bookSearch="";bookStatus="all";bookCategory=card.dataset.shelf;setPage("library");showToast(`Opened ${card.dataset.shelf} shelf`);}));
  $$("[data-category]").forEach(card=>card.addEventListener("click",()=>{bookSearch="";bookStatus="all";bookCategory=card.dataset.category;setPage("library");}));
  $$("[data-task-filter]").forEach(btn=>btn.addEventListener("click",()=>{taskFilter=btn.dataset.taskFilter;renderPage();}));
  $$("[data-toggle-task]").forEach(input=>input.addEventListener("change",async()=>{const task=state.tasks.find(t=>t.id===input.dataset.toggleTask);if(!task)return;input.disabled=true;try{await simulateRequest(()=>{task.done=input.checked;task.updated=Date.now();persist();},300);renderPage();showToast(task.done?"Task completed":"Task marked incomplete");}catch{showToast("Could not update task.");}}));
}
function openModal(title,content){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=content;$("#modalBackdrop").hidden=false;document.body.style.overflow="hidden";const first=$("#modalBody input,#modalBody textarea,#modalBody select");if(first)setTimeout(()=>first.focus(),50);}
function closeModal(){ $("#modalBackdrop").hidden=true;document.body.style.overflow=""; }
function formField(label,name,value="",type="text",required=false,extra=""){return `<div class="form-field"><label for="${name}">${label}${required?" *":""}</label><input class="field" id="${name}" name="${name}" type="${type}" value="${escapeHTML(value)}" ${required?"required":""} ${extra}></div>`;}
function taskForm(task={}){
  openModal(task.id?"Edit task":"Add a task",`<form id="taskForm" class="form-stack">${formField("Task title","taskTitle",task.title||"", "text",true)}<div class="form-field"><label for="taskDescription">Description</label><textarea class="field" id="taskDescription" name="description" placeholder="...">${escapeHTML(task.description||"")}</textarea></div><div class="form-row">${formField("Due date","taskDue",task.due||todayISO(),"date")}<div class="form-field"><label for="taskPriority">Priority</label><select class="field" id="taskPriority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div></div>${formField("Category","taskCategory",task.category||"Personal")}<div class="form-actions"><button type="button" class="button button-secondary" id="cancelForm">Cancel</button><button class="button button-primary" type="submit">Save</button></div></form>`);
  $("#taskPriority").value=task.priority||"medium";
  $("#cancelForm").onclick=closeModal;
  $("#taskForm").onsubmit=async e=>{e.preventDefault();const submit=$('button[type="submit"]',e.currentTarget);submit.disabled=true;submit.textContent="Saving…";try{await simulateRequest(()=>{const data={title:$("#taskTitle").value.trim(),description:$("#taskDescription").value.trim(),due:$("#taskDue").value,priority:$("#taskPriority").value,category:$("#taskCategory").value.trim()||"Personal"};if(!data.title)throw Error("Enter a task title.");if(task.id)Object.assign(task,data,{updated:Date.now()});else state.tasks.push({id:uid(),...data,done:false,created:Date.now()});persist();},450);closeModal();renderPage();showToast("Saved");}catch(err){submit.disabled=false;submit.textContent="Save";showToast(err.message||"Could not save.");}};
}
function resizeImage(file,max=760){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error("Could not read that image."));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(Error("That file is not a valid image."));img.onload=()=>{let w=img.width,h=img.height;if(w>max||h>max){const scale=Math.min(max/w,max/h);w=Math.round(w*scale);h=Math.round(h*scale);}const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL("image/jpeg",.82));};img.src=reader.result;};reader.readAsDataURL(file);});}
function bookForm(book={}){
  let selectedImage=book.image||"";
  const defaultImage=()=>(categoryCovers[$("#bookCategory").value]||{}).image||"";
  const initialImage=selectedImage||(categoryCovers[book.category||"Productivity"]||{}).image||"";
  openModal(book.id?"Edit book":"Add a book",`<form id="bookForm" class="form-stack">${formField("Book title","bookTitle",book.title||"","text",true)}${formField("Author","bookAuthor",book.author||"","text",true)}<div class="form-row"><div class="form-field"><label for="bookCategory">Category</label><select class="field" id="bookCategory">${categoryNames.filter(n=>n!=="Favorites").map(n=>`<option>${n}</option>`).join("")}</select></div><div class="form-field"><label for="bookStatusForm">Status</label><select class="field" id="bookStatusForm"><option value="planned">Want to read</option><option value="reading">Reading</option><option value="completed">Completed</option></select></div></div><div class="form-row">${formField("Total pages","bookPages",book.pages||"","number",true,'min="1"')}${formField("Current page","bookCurrent",book.currentPage||0,"number",false,'min="0"')}</div><div class="form-field"><label for="bookImage">Book cover image</label><div class="cover-upload"><img class="cover-preview" id="bookImagePreview" src="${escapeHTML(initialImage)}" alt="Book cover preview" ${initialImage?"":"hidden"}><input class="field" id="bookImage" type="file" accept="image/*"><button type="button" class="button button-secondary" id="resetBookImage">Use category cover</button><small class="subtitle">Upload your own cover. If you skip this, a matching cover for the category is used.</small></div></div><div class="form-field"><label for="bookNotes">Notes</label><textarea class="field" id="bookNotes" placeholder="Notes...">${escapeHTML(book.notes||"")}</textarea></div><div class="form-actions"><button type="button" class="button button-secondary" id="cancelForm">Cancel</button><button type="submit" class="button button-primary">Save</button></div></form>`);
  $("#bookCategory").value=book.category||"Productivity";$("#bookStatusForm").value=book.status||"planned";$("#cancelForm").onclick=closeModal;
  const updatePreview=src=>{const img=$("#bookImagePreview");img.src=src||"";img.hidden=!src;};
  $("#bookCategory").onchange=()=>{if(!selectedImage)updatePreview(defaultImage());};
  $("#bookImage").onchange=async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;try{selectedImage=await resizeImage(file);updatePreview(selectedImage);}catch(err){showToast(err.message||"Could not read image.");}};
  $("#resetBookImage").onclick=()=>{selectedImage="";updatePreview(defaultImage());};
  $("#bookForm").onsubmit=async e=>{e.preventDefault();const btn=$('button[type="submit"]',e.currentTarget);btn.disabled=true;btn.textContent="Saving…";try{await simulateRequest(()=>{const pages=Math.max(1,Number($("#bookPages").value)),current=Math.min(pages,Math.max(0,Number($("#bookCurrent").value)||0)),status=$("#bookStatusForm").value,image=selectedImage||defaultImage();const data={title:$("#bookTitle").value.trim(),author:$("#bookAuthor").value.trim(),category:$("#bookCategory").value,pages,currentPage:status==="completed"?pages:current,status,favorite:book.favorite||false,cover:book.cover||covers[Math.floor(Math.random()*covers.length)],image,notes:$("#bookNotes").value.trim()};if(!data.title||!data.author)throw Error("Enter a title and author.");if(book.id)Object.assign(book,data);else state.books.push({id:uid(),...data});persist();},500);closeModal();renderPage();showToast("Saved");}catch(err){btn.disabled=false;btn.textContent="Save";showToast(err.message||"Could not save.");}};
}
function entryForm(entry={}){
  let selectedEntryImage=entry.image||"";
  const updateEntryPreview=src=>{const img=$("#entryImagePreview");img.src=src||"";img.hidden=!src;};
  openModal(entry.id?"Edit entry":"New entry",`<form id="entryForm" class="form-stack">${formField("Title (optional)","entryTitle",entry.title||"")}<div class="form-field"><label for="entryBody">Your thoughts *</label><textarea class="field" id="entryBody" required placeholder="Start writing here…">${escapeHTML(entry.body||"")}</textarea><small id="wordCount" class="subtitle">0 words</small></div><div class="form-field"><label for="entryImage">Attach a photo (optional)</label><div class="cover-upload"><img class="cover-preview" id="entryImagePreview" src="${escapeHTML(entry.image||"")}" alt="Photo preview" ${entry.image?"":"hidden"}><input class="field" id="entryImage" type="file" accept="image/*"><button type="button" class="button button-secondary" id="resetEntryImage">Remove photo</button><small class="subtitle">Add a photo to your journal entry.</small></div></div><div class="form-field"><label for="entryTag">Tag</label><select class="field" id="entryTag"><option value="">No tag</option>${["Reflection","Ideas","Learning","Personal","Gratitude"].map(t=>`<option>${t}</option>`).join("")}</select></div><p class="subtitle"></p><div class="form-actions"><button type="button" class="button button-secondary" id="cancelForm">Cancel</button><button type="submit" class="button button-primary">Save</button></div></form>`);
  $("#entryTag").value=entry.tag||"";const count=()=>{$("#wordCount").textContent=`${$("#entryBody").value.trim()?$("#entryBody").value.trim().split(/\s+/).length:0} words`;};$("#entryBody").addEventListener("input",count);count();$("#cancelForm").onclick=closeModal;
  $("#entryImage").onchange=async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;try{selectedEntryImage=await resizeImage(file);updateEntryPreview(selectedEntryImage);}catch(err){showToast(err.message||"Could not read image.");}};
  $("#resetEntryImage").onclick=()=>{selectedEntryImage="";updateEntryPreview("");};
  $("#entryForm").onsubmit=async e=>{e.preventDefault();const btn=$('button[type="submit"]',e.currentTarget);btn.disabled=true;btn.textContent="Saving…";try{await simulateRequest(()=>{const body=$("#entryBody").value.trim();if(!body)throw Error("Write something before saving.");const now=Date.now(),data={title:$("#entryTitle").value.trim(),body,tag:$("#entryTag").value,image:selectedEntryImage||"",date:entry.date||todayISO(),updated:now};if(entry.id)Object.assign(entry,data);else state.entries.push({id:uid(),...data,created:now});persist();},350);closeModal();renderPage();showToast("Saved");}catch(err){btn.disabled=false;btn.textContent="Save";showToast(err.message||"Could not save.");}};
}
function openBook(id){
  const b=state.books.find(x=>x.id===id);if(!b)return;
  openModal("Book details",`<div style="display:grid;grid-template-columns:110px 1fr;gap:18px;align-items:start">${bookCover(b).replace('class="book-cover','style="width:110px" class="book-cover')}<div><h2>${escapeHTML(b.title)}</h2><p class="subtitle">${escapeHTML(b.author)}</p><span class="pill">${escapeHTML(b.category)}</span><p style="margin-top:14px;font-size:13px">${escapeHTML(b.notes||"No personal notes yet.")}</p></div></div><div class="section"><div class="stat-top"><span>Reading progress</span><strong>${Math.round(b.currentPage/Math.max(1,b.pages)*100)}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,b.currentPage/Math.max(1,b.pages)*100)}%"></div></div><p class="subtitle" style="margin-top:8px">${b.currentPage} of ${b.pages} pages</p></div><div class="form-stack"><div class="form-field"><label for="detailPage">Current page</label><input class="field" id="detailPage" type="number" min="0" max="${b.pages}" value="${b.currentPage}"></div><div class="form-actions" style="justify-content:space-between"><button class="button button-secondary" id="deleteBook">Delete</button><div class="card-actions"><button class="button button-secondary" id="editBook">Edit</button><button class="button button-primary" id="saveProgress">Save progress</button></div></div><button class="button button-secondary" id="favoriteBook">${b.favorite?"★ Remove favorite":"☆ Add to favorites"}</button></div>`);
  $("#saveProgress").onclick=()=>{b.currentPage=Math.min(b.pages,Math.max(0,Number($("#detailPage").value)||0));if(b.currentPage>=b.pages)b.status="completed";else if(b.currentPage>0)b.status="reading";persist();closeModal();renderPage();showToast("Reading progress updated");};
  $("#editBook").onclick=()=>{closeModal();bookForm(b);};$("#deleteBook").onclick=()=>{if(confirm(`Delete "${b.title}" from your library?`)){state.books=state.books.filter(x=>x.id!==id);persist();closeModal();renderPage();showToast("Book deleted");}};
  $("#favoriteBook").onclick=()=>{b.favorite=!b.favorite;persist();closeModal();renderPage();showToast(b.favorite?"Added to favorites":"Removed from favorites");};
}
function shelfForm(){
  openModal("Create a shelf",`<form id="shelfForm" class="form-stack">${formField("Shelf name","shelfName","","text",true)}<div class="form-field"><label for="shelfCategory">Category</label><select class="field" id="shelfCategory">${categoryNames.filter(n=>n!=="Favorites").map(n=>`<option>${n}</option>`).join("")}</select></div><div class="form-actions"><button type="button" class="button button-secondary" id="cancelForm">Cancel</button><button type="submit" class="button button-primary">Create shelf</button></div></form>`);
  $("#cancelForm").onclick=closeModal;$("#shelfForm").onsubmit=e=>{e.preventDefault();const name=$("#shelfName").value.trim();if(!name)return;state.shelves.push({id:uid(),name,category:$("#shelfCategory").value});persist();closeModal();renderPage();showToast("Shelf created");};
}
function exportData(){
  const blob=new Blob([JSON.stringify({app:"DAYMARK JOURNAL",version:2,exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="daymark-journal-backup.json";a.click();URL.revokeObjectURL(url);showToast("Exported");
}
function importData(){const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()),incoming=parsed.data||parsed;if(!incoming.books&&!incoming.tasks&&!incoming.entries&&!incoming.goals)throw Error("Invalid backup.");if(!confirm("Replace current data?"))return;state={...structuredClone(defaultState),...incoming,profile:{...defaultState.profile,...incoming.profile},settings:{...defaultState.settings,...incoming.settings},goals:incoming.goals||[]};persist();renderPage();showToast("Imported");}catch(err){showToast(err.message||"Could not import.");}};input.click();}
function saveSettings(){
  const nameInput=$("#profileName"),goalInput=$("#readingGoal"),prefInput=$("#settingsJournalPref");
  if(nameInput)state.profile.name=nameInput.value.trim()||"Daymark";
  if(goalInput)state.profile.readingGoal=Math.max(1,Number(goalInput.value)||20);
  if(prefInput)state.onboarding.journalPreference=prefInput.value;
  persist();showToast("Changes saved");
}
function exportJournal(){
  const entries=[...state.entries].sort((a,b)=>b.updated-a.updated);
  if(!entries.length){showToast("No journal entries to export.");return;}
  const blob=new Blob([JSON.stringify({app:"DAYMARK JOURNAL",type:"journal",version:1,exportedAt:new Date().toISOString(),entries},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="daymark-journal-entries.json";a.click();URL.revokeObjectURL(url);showToast(`Exported ${entries.length} ${entries.length===1?"entry":"entries"}`);
}
function importJournal(){
  const input=document.createElement("input");input.type="file";input.accept=".json,application/json";
  input.onchange=async()=>{const file=input.files&&input.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());const incoming=Array.isArray(parsed)?parsed:(parsed.entries||(parsed.data&&parsed.data.entries)||[]);if(!Array.isArray(incoming)||!incoming.length)throw Error("No journal entries found.");let added=0;incoming.forEach(item=>{const body=String(item&&item.body||"").trim();if(!body)return;const duplicate=state.entries.some(entry=>entry.id===item.id||(entry.body===body&&entry.date===item.date));if(duplicate)return;state.entries.push({id:item.id||uid(),title:String(item.title||""),body,tag:String(item.tag||""),date:item.date||todayISO(),created:Number(item.created)||Date.now(),updated:Number(item.updated)||Date.now()});added++;});if(!added){showToast("Those entries are already in your journal.");return;}persist();renderPage();showToast(`Imported ${added} ${added===1?"entry":"entries"}`);}catch(err){showToast(err.message||"Could not import journal.");}};
  input.click();
}
async function shareApp(){const data={title:"DAYMARK JOURNAL",text:"A thoughtful space for reading, journaling, and daily goals.",url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);showToast("App link copied");}}catch(error){if(error.name!=="AbortError")showToast("Sharing isn't available in this browser.");}}
function resetData(){if(!confirm("Remove all data?"))return;state=structuredClone(defaultState);persist();setPage("home");showToast("Reset"); if(goalClock)clearInterval(goalClock);}
document.addEventListener("click",e=>{
  const pageBtn=e.target.closest("[data-page]");if(pageBtn){e.preventDefault();setPage(pageBtn.dataset.page);return;}
  const actionBtn=e.target.closest("[data-action]");if(!actionBtn)return;
  const {action,id}=actionBtn.dataset;
  if(action==="new-task")taskForm();if(action==="edit-task"){const t=state.tasks.find(x=>x.id===id);if(t)taskForm(t);}
  if(action==="delete-task"&&confirm("Delete this task?")){state.tasks=state.tasks.filter(t=>t.id!==id);persist();renderPage();showToast("Task deleted");}
  if(action==="new-book")bookForm();if(action==="new-entry")entryForm();if(action==="edit-entry"){const entry=state.entries.find(x=>x.id===id);if(entry)entryForm(entry);}
  if(action==="delete-entry"&&confirm("Delete this journal entry?")){state.entries=state.entries.filter(x=>x.id!==id);persist();renderPage();showToast("Entry deleted");}
  if(action==="new-shelf")shelfForm();if(action==="export")exportData();if(action==="import")importData();if(action==="share")shareApp();if(action==="reset")resetData();
  if(action==="export-journal")exportJournal();if(action==="import-journal")importJournal();
  if(action==="save-settings")saveSettings();
  if(action==="onboard-next"){e.preventDefault();nextOnboardingStep();}
  if(action==="onboard-back"){e.preventDefault();prevOnboardingStep();}
  if(action==="onboard-finish"){e.preventDefault();completeOnboarding();}
  if(action==="onboard-edit"){e.preventDefault();state.onboarding.completed=false;state.onboarding.step=1;onboardingStep=1;$("#onboarding").hidden=false;$("#appShell").hidden=true;renderOnboardingFlow();}
  if(action==="onboard-skip-step"){e.preventDefault();nextOnboardingStep();}
  if(action==="onboard-skip-all"){e.preventDefault();completeOnboarding();}
  if(action==="clear-category"){bookCategory="all";renderPage();showToast("Filter cleared");}
  if(action==="new-goal")goalForm();
  if(action==="edit-goal"){const g=state.goals.find(x=>x.id===id);if(g)goalForm(g);}
  if(action==="toggle-goal"){const g=state.goals.find(x=>x.id===id);if(g){g.done=!g.done;g.warnedSoon=g.done?false:g.warnedSoon;g.warnedLate=g.done?false:g.warnedLate;persist();renderPage();showToast(g.done?"Goal completed":"Marked incomplete");}}
  if(action==="delete-goal"&&confirm("Delete this goal?")){state.goals=state.goals.filter(x=>x.id!==id);persist();renderPage();showToast("Goal deleted");}
});
$("#menuToggle").addEventListener("click",()=>{const menu=$("#mobileMenu");menu.hidden=!menu.hidden;$("#menuToggle").setAttribute("aria-expanded",String(!menu.hidden));});
$("#closeModal").addEventListener("click",closeModal);
$("#modalBackdrop").addEventListener("click",e=>{if(e.target===$("#modalBackdrop"))closeModal();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();$("#mobileMenu").hidden=true;$("#menuToggle").setAttribute("aria-expanded","false");}});
function toggleTheme(){state.settings.theme=state.settings.theme==="dark"?"light":"dark";document.body.classList.toggle("dark",state.settings.theme==="dark");persist();if(currentPage==="settings")renderPage();showToast(`${state.settings.theme==="dark"?"Dark":"Light"} theme enabled`);}
$("#themeToggle").addEventListener("click",toggleTheme);
document.addEventListener("click",e=>{
  if(e.target.id==="enableNotif"){
    if(!("Notification" in window)){showToast("Notifications not supported");return;}
    Notification.requestPermission().then(p=>{state.settings.notifications=p==="granted";persist();showToast(p==="granted"?"Notifications enabled":"Notifications blocked");if(currentPage==="settings")renderPage();});
    return;
  }
  if(e.target.id==="settingsTheme")toggleTheme();
});
$("#installBtn").addEventListener("click",async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$("#installBtn").hidden=true;}else if(/iphone|ipad|ipod/i.test(navigator.userAgent)){showToast("To install: tap Share, then Add to Home Screen.");}else showToast("Use your browser menu and choose Install app or Add to Home screen.");});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("#installBtn").hidden=false;});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;updateMode();showToast("DAYMARK JOURNAL installed");});
window.matchMedia("(display-mode: standalone)").addEventListener?.("change",updateMode);

async function init(){
  updateMode();document.body.classList.toggle("dark",state.settings.theme==="dark");
  await new Promise(resolve=>setTimeout(resolve,800));
  $("#splash").style.opacity="0";setTimeout(()=>{$("#splash").hidden=true;if(!state.onboarding.completed){$("#appShell").hidden=true;$("#onboarding").hidden=false;renderOnboardingFlow();}else{$("#appShell").hidden=false;renderPage();}},350);
  if("serviceWorker" in navigator && location.protocol!=="file:"){navigator.serviceWorker.register("./sw.js").catch(()=>{});}
  setInterval(checkGoalAlerts,60000);
  setInterval(()=>{if(currentPage==="home"&&!pageLoaderTimer){const h=$("#mainContent h1");if(h)h.textContent=`${timeGreeting()}, ${state.profile.name||"Daymark"}.`;}},60000);
}
init();
