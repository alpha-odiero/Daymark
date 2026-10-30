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

const PAGE_ALIASES = {
  home: "home",
  landing: "landing",
  dashboard: "home",
  freebooks: "freebooks",
  "free-books": "freebooks",
  "free_books": "freebooks",
  freebook: "freebooks",
  discover: "discover",
  "get-inspired": "discover",
  getinspired: "discover",
  reader: "reader",
  library: "library",
  journal: "journal",
  todo: "todo",
  todos: "todo",
  "to-do": "todo",
  goals: "goals",
  categories: "categories",
  stats: "stats",
  statistics: "stats",
  settings: "settings",
  docs: "docs",
  documentation: "docs"
};

const PAGE_TITLES = {
  home: "Daymark JOURNAL",
  landing: "Daymark JOURNAL",
  freebooks: "Free Books — Daymark JOURNAL",
  discover: "Get Inspired — Daymark JOURNAL",
  reader: "Reader — Daymark JOURNAL",
  library: "My Library — Daymark JOURNAL",
  journal: "My Journal — Daymark JOURNAL",
  todo: "To-Do — Daymark JOURNAL",
  goals: "Goals — Daymark JOURNAL",
  categories: "Categories — Daymark JOURNAL",
  stats: "Progress & Statistics — Daymark JOURNAL",
  settings: "Settings — Daymark JOURNAL",
  docs: "Documentation — Daymark JOURNAL"
};

function resolvePage(raw){
  if(!raw) return null;
  const clean = String(raw).trim().toLowerCase().replace(/^#+[/]?/, "").replace(/^\/+|\/+$/g, "").replace(/\.html$/, "");
  return PAGE_ALIASES[clean] || null;
}

function getInitialPage(){
  const fromHash = resolvePage(location.hash);
  if(fromHash) return fromHash;

  try {
    const params = new URLSearchParams(location.search);
    const fromQuery = resolvePage(params.get("page"));
    if(fromQuery) return fromQuery;
  } catch {}

  try {
    const segments = location.pathname.split("/").filter(Boolean);
    if(segments.length){
      const last = segments[segments.length - 1];
      const fromPath = resolvePage(last);
      if(fromPath) return fromPath;
    }
  } catch {}

  return "landing";
}

function updateDocumentTitle(page){
  document.title = PAGE_TITLES[page] || "Daymark JOURNAL";
}

let currentPage = getInitialPage();
let onboardingStep = 1;
let taskFilter = "all";
let bookSearch = "";
let bookStatus = "all";
let bookCategory = "all";
let deferredInstallPrompt = null;
let discoverCategory="Technology";
let discoverBooks=[];
let discoverLoading=false;
let discoverLoadingMore=false;
let discoverError="";
let discoverPage=1;
let discoverHasMore=true;
let toastTimer;
let goalClock = null;
let pageLoaderTimer = null;
let lazyObserver = null;
let discoverRequest = 0;
let discoverDetailToken = 0;
let freeBooks=[];
let freeBooksLoading=false;
let freeBooksLoadingMore=false;
let freeBooksError="";
let freeBooksQuery="";
let freeBooksTopic="all";
let freeBooksNext="";
let freeBooksCount=0;
let freeBooksKey="";
let freeBooksRequest=0;
let freeBooksAbort=null;
let freeBooksSearchTimer=null;
let freeBooksCache={};
let readerBook=null;
let readerFontScale=1;
let readerDark=false;
try{const prefs=JSON.parse(localStorage.getItem("daymark-reader-prefs")||"{}");if(prefs){readerFontScale=Math.min(1.6,Math.max(.8,Number(prefs.fontScale)||1));readerDark=Boolean(prefs.dark);}}catch{}
const DISCOVER_CACHE_KEY = "daymark-discover-cache-v1";
const DISCOVER_TIMEOUT = 1800;
const FREE_BOOKS_API = "https://gutendex.com/books/";
const FREE_BOOKS_TIMEOUT = 4000;
const FREE_BOOKS_TOPICS = [{label:"All",value:"all"},{label:"Fiction",value:"fiction"},{label:"Poetry",value:"poetry"},{label:"Science",value:"science"},{label:"History",value:"history"},{label:"Philosophy",value:"philosophy"},{label:"Adventure",value:"adventure"},{label:"Mystery",value:"mystery"},{label:"Romance",value:"romance"},{label:"Drama",value:"drama"},{label:"Children",value:"children"},{label:"Fantasy",value:"fantasy"},{label:"Horror",value:"horror"}];
const FREE_BOOKS_FALLBACK = [
  {id:1342,title:"Pride and Prejudice",author:"Jane Austen",subjects:["England -- Fiction","Love stories"],topics:["fiction","romance"]},
  {id:11,title:"Alice's Adventures in Wonderland",author:"Lewis Carroll",subjects:["Fantasy fiction","Children's stories"],topics:["children","fantasy","fiction"]},
  {id:1661,title:"The Adventures of Sherlock Holmes",author:"Arthur Conan Doyle",subjects:["Detective and mystery stories","Private investigators -- England"],topics:["mystery","fiction"]},
  {id:2701,title:"Moby Dick; Or, The Whale",author:"Herman Melville",subjects:["Sea stories","Whaling -- Fiction"],topics:["adventure","fiction"]},
  {id:84,title:"Frankenstein; or, The Modern Prometheus",author:"Mary Shelley",subjects:["Horror tales","Science fiction"],topics:["horror","science","fiction"]},
  {id:345,title:"Dracula",author:"Bram Stoker",subjects:["Horror tales","Vampires -- Fiction"],topics:["horror","fiction"]},
  {id:98,title:"A Tale of Two Cities",author:"Charles Dickens",subjects:["Historical fiction","France -- History -- Revolution"],topics:["history","fiction"]},
  {id:1400,title:"Great Expectations",author:"Charles Dickens",subjects:["Orphans -- Fiction","Bildungsromans"],topics:["fiction"]},
  {id:2600,title:"War and Peace",author:"Leo Tolstoy",subjects:["Historical fiction","Napoleonic Wars -- Fiction"],topics:["history","fiction"]},
  {id:1399,title:"Anna Karenina",author:"Leo Tolstoy",subjects:["Love stories","Married women -- Fiction"],topics:["romance","fiction"]},
  {id:1232,title:"The Prince",author:"Niccolo Machiavelli",subjects:["Political science -- Philosophy","State, The"],topics:["philosophy","history"]},
  {id:1497,title:"The Republic",author:"Plato",subjects:["Political science -- Early works","Utopias"],topics:["philosophy"]},
  {id:2680,title:"Meditations",author:"Marcus Aurelius",subjects:["Stoics","Ethics"],topics:["philosophy"]},
  {id:5827,title:"The Problems of Philosophy",author:"Bertrand Russell",subjects:["Knowledge, Theory of","Metaphysics"],topics:["philosophy"]},
  {id:3207,title:"Leviathan",author:"Thomas Hobbes",subjects:["Political science -- Early works","State, The"],topics:["philosophy"]},
  {id:36,title:"The War of the Worlds",author:"H. G. Wells",subjects:["Science fiction","Martians -- Fiction"],topics:["science","adventure","fiction"]},
  {id:35,title:"The Time Machine",author:"H. G. Wells",subjects:["Science fiction","Time travel -- Fiction"],topics:["science","adventure","fiction"]},
  {id:43,title:"The Strange Case of Dr. Jekyll and Mr. Hyde",author:"Robert Louis Stevenson",subjects:["Horror tales","Physicians -- Fiction"],topics:["horror","fiction"]},
  {id:1952,title:"The Yellow Wallpaper",author:"Charlotte Perkins Gilman",subjects:["Psychological fiction","Feminist fiction"],topics:["horror","fiction"]},
  {id:174,title:"The Picture of Dorian Gray",author:"Oscar Wilde",subjects:["Supernatural -- Fiction","Conduct of life -- Fiction"],topics:["horror","fiction"]},
  {id:1260,title:"Jane Eyre",author:"Charlotte Bronte",subjects:["Orphans -- Fiction","Love stories"],topics:["romance","fiction"]},
  {id:103,title:"Around the World in Eighty Days",author:"Jules Verne",subjects:["Voyages around the world","Adventure stories"],topics:["adventure","fiction"]},
  {id:16,title:"Peter Pan",author:"J. M. Barrie",subjects:["Fantasy literature","Pirates -- Fiction"],topics:["children","fantasy"]},
  {id:120,title:"Treasure Island",author:"Robert Louis Stevenson",subjects:["Sea stories","Pirates -- Fiction"],topics:["adventure","children"]},
  {id:76,title:"Adventures of Huckleberry Finn",author:"Mark Twain",subjects:["Adventure stories","Boys -- Fiction"],topics:["adventure","fiction"]},
  {id:2591,title:"Grimms' Fairy Tales",author:"Jacob Grimm",subjects:["Fairy tales -- Germany","Children's stories"],topics:["children","fantasy"]},
  {id:45,title:"Anne of Green Gables",author:"L. M. Montgomery",subjects:["Orphans -- Fiction","Friendship -- Fiction"],topics:["children","romance"]},
  {id:100,title:"The Complete Works of William Shakespeare",author:"William Shakespeare",subjects:["English drama","Plays"],topics:["drama","poetry"]},
  {id:2542,title:"A Doll's House",author:"Henrik Ibsen",subjects:["Marriage -- Drama","Norwegian drama"],topics:["drama"]},
  {id:132,title:"The Art of War",author:"Sun Tzu",subjects:["Military art and science","War -- Early works"],topics:["philosophy","history"]},
  {id:5001,title:"Relativity: The Special and General Theory",author:"Albert Einstein",subjects:["Relativity (Physics)","Physics"],topics:["science"],txt:false},
  {id:7142,title:"The History of the Peloponnesian War",author:"Thucydides",subjects:["Greece -- History","Peloponnesian War"],topics:["history"]},
  {id:8800,title:"The Divine Comedy",author:"Dante Alighieri",subjects:["Epic poetry, Italian","Italian poetry"],topics:["poetry"]},
  {id:844,title:"The Importance of Being Earnest",author:"Oscar Wilde",subjects:["Comedy plays","England -- Drama"],topics:["drama"]},
  {id:55,title:"The Wonderful Wizard of Oz",author:"L. Frank Baum",subjects:["Fantasy literature","Children's stories"],topics:["children","fantasy"]}
];
const discoverFallbacks = {
  Technology:[["The Design of Everyday Things","Don Norman",2013,"9780465050659"],["The Innovators","Walter Isaacson",2014,"9781476708690"],["Clean Architecture","Robert C. Martin",2017,"9780134494166"],["The Phoenix Project","Gene Kim",2013,"9780988262591"]],
  Programming:[["The Pragmatic Programmer","Andrew Hunt",1999,"9780201616224"],["Clean Code","Robert C. Martin",2008,"9780132350884"],["Code Complete","Steve McConnell",2004,"9780735619678"],["Refactoring","Martin Fowler",2018,"9780134757599"]],
  Business:[["Zero to One","Peter Thiel",2014,"9780804139298"],["The Lean Startup","Eric Ries",2011,"9780307887894"],["Good to Great","Jim Collins",2001,"9780066620992"],["Start with Why","Simon Sinek",2009,"9781591846444"]],
  "Personal Development":[["Atomic Habits","James Clear",2018,"9780735211292"],["Deep Work","Cal Newport",2016,"9781455586691"],["The 7 Habits of Highly Effective People","Stephen R. Covey",1989,"9781982137274"],["Mindset","Carol S. Dweck",2006,"9780345472328"]],
  Psychology:[["Thinking, Fast and Slow","Daniel Kahneman",2011,"9780374533557"],["Influence","Robert B. Cialdini",1984,"9780061241895"],["The Power of Habit","Charles Duhigg",2012,"9780812981605"],["Man's Search for Meaning","Viktor E. Frankl",1946,"9780807014295"]],
  Fiction:[["The Midnight Library","Matt Haig",2020,"9780525559474"],["The Alchemist","Paulo Coelho",1988,"9780062315007"],["The Kite Runner","Khaled Hosseini",2003,"9781594631931"],["Life of Pi","Yann Martel",2001,"9780156027328"]],
  Mystery:[["The Girl with the Dragon Tattoo","Stieg Larsson",2005,"9780307454546"],["Gone Girl","Gillian Flynn",2012,"9780307588371"],["The Da Vinci Code","Dan Brown",2003,"9780307474278"],["And Then There Were None","Agatha Christie",1939,"9780062073488"]],
  Romance:[["Pride and Prejudice","Jane Austen",1813,"9780141439518"],["Jane Eyre","Charlotte Brontë",1847,"9780142437209"],["The Notebook","Nicholas Sparks",1996,"9780446605236"],["Me Before You","Jojo Moyes",2012,"9780143124542"]],
  Fantasy:[["The Hobbit","J.R.R. Tolkien",1937,"9780547928227"],["Harry Potter and the Sorcerer's Stone","J.K. Rowling",1997,"9780590353427"],["The Name of the Wind","Patrick Rothfuss",2007,"9780756404741"],["A Game of Thrones","George R.R. Martin",1996,"9780553103540"]],
  Science:[["Sapiens","Yuval Noah Harari",2011,"9780062316097"],["A Brief History of Time","Stephen Hawking",1988,"9780553380163"],["Cosmos","Carl Sagan",1980,"9780345539434"],["The Selfish Gene","Richard Dawkins",1976,"9780198788607"]],
  History:[["Guns, Germs, and Steel","Jared Diamond",1997,"9780393317558"],["1491","Charles C. Mann",2005,"9781400032051"],["SPQR","Mary Beard",2015,"9781631492228"],["The Silk Roads","Peter Frankopan",2015,"9781101912379"]],
  Biography:[["Steve Jobs","Walter Isaacson",2011,"9781451648539"],["The Diary of a Young Girl","Anne Frank",1947,"9780553296983"],["Educated","Tara Westover",2018,"9780399590504"],["Elon Musk","Walter Isaacson",2023,"9781982181284"]]
};
function fallbackBooks(category){
  return (discoverFallbacks[category]||discoverFallbacks.Technology).map(([title,author,year,isbn])=>({title,author,year,isbn,cover:`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,url:`https://openlibrary.org/search?q=${encodeURIComponent(title)}`,fallback:true}));
}
function readDiscoverCache(){
  try{const cache=JSON.parse(localStorage.getItem(DISCOVER_CACHE_KEY)||"{}");return cache&&typeof cache==="object"?cache:{};}catch{return{};}
}
function writeDiscoverCache(category,books,page=1,hasMore=true){
  try{const cache=readDiscoverCache();cache[category]={books,page,hasMore,ts:Date.now()};localStorage.setItem(DISCOVER_CACHE_KEY,JSON.stringify(cache));}catch{}
}
function mapDiscoverDoc(doc){
  return {title:doc.title||"Untitled",author:(doc.author_name||[]).join(", ")||"Unknown author",year:doc.first_publish_year||"",pages:doc.number_of_pages_median||"",key:doc.key||"",cover:doc.cover_i?`https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`:"",url:`https://openlibrary.org${doc.key}`};
}
async function requestDiscoverBooks(category,page=1){
  const limit=12;
  const res=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(category)}&limit=${limit}&page=${page}&fields=title,author_name,first_publish_year,cover_i,key,number_of_pages_median`);
  if(!res.ok)throw new Error("Request failed");
  const data=await res.json();
  const books=(data.docs||[]).map(mapDiscoverDoc);
  const start=Number(data.start)||0;
  const total=Number(data.numFound)||0;
  const hasMore=books.length>=limit && (total?start+books.length<total:true);
  return {books,hasMore};
}
async function prefetchDiscover(category){
  if(readDiscoverCache()[category])return;
  try{const result=await requestDiscoverBooks(category,1);if(result.books.length)writeDiscoverCache(category,result.books,1,result.hasMore);}catch{}
}

function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function uid(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function escapeHTML(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function cloneValue(value){try{return typeof structuredClone==="function"?structuredClone(value):JSON.parse(JSON.stringify(value));}catch{return JSON.parse(JSON.stringify(value));}}
function loadState(){
  const defaults=cloneValue(defaultState);
  try{
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved){
      const parsed=JSON.parse(saved);
      const merged={
        ...defaults,
        ...parsed,
        profile:{...defaults.profile,...parsed.profile},
        onboarding:{...defaults.onboarding,...parsed.onboarding},
        settings:{...defaults.settings,...parsed.settings}
      };
      ["books","shelves","tasks","goals","entries"].forEach(key=>{if(!Array.isArray(merged[key]))merged[key]=[];});
      return merged;
    }
  }
  catch(error){console.warn("Could not read data; using defaults.",error);}
  return defaults;
}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch(error){console.error(error);showToast("Could not save.");return false;}}
function showToast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function simulateRequest(action, delay=420){return new Promise((resolve,reject)=>{setTimeout(()=>{try{resolve(action());}catch(error){reject(error);}},delay);});}
function dateLabel(value){if(!value)return "No due date";const d=new Date(`${value}T12:00:00`);return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:d.getFullYear()!==new Date().getFullYear()?"numeric":undefined});}
function timeGreeting(){const h=new Date().getHours();return h<12?"Good morning":h<18?"Good afternoon":"Good evening";}
function isInstalled(){return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone===true;}
function updateMode(){
  const installed=isInstalled();
  document.body.classList.toggle("installed",installed);
  const btn=$("#installBtn");
  if(btn)btn.hidden=installed;
}
function showPageLoader(){const loader=$("#pageLoader");if(loader){loader.hidden=false;document.body.classList.add("is-loading");}}
function hidePageLoader(){const loader=$("#pageLoader");if(loader){loader.hidden=true;document.body.classList.remove("is-loading");}}
function closeNavDropdowns(except){
  $$("[data-nav-dropdown]").forEach(drop=>{
    if(drop===except)return;
    const toggle=$("[data-nav-toggle]",drop);
    const menu=$(".nav-dropdown-menu,.mobile-submenu",drop);
    if(menu)menu.hidden=true;
    if(toggle)toggle.setAttribute("aria-expanded","false");
    drop.classList.remove("open");
  });
}
function updateNavState(page){
  $$(".nav-link,.bottom-link,#mobileMenu button").forEach(b=>{
    if(b.dataset.page)b.classList.toggle("active",b.dataset.page===page);
  });
  $$("[data-nav-dropdown]").forEach(drop=>{
    const pages=(drop.dataset.pages||"").split(/\s+/).filter(Boolean);
    const active=pages.includes(page);
    drop.classList.toggle("active",active);
    $("[data-nav-toggle]",drop)?.classList.toggle("active",active);
  });
}
function closeMobileMenu(){
  const menu=$("#mobileMenu");
  if(menu)menu.hidden=true;
  document.body.classList.remove("menu-open");
  $("#menuToggle")?.setAttribute("aria-expanded","false");
  closeNavDropdowns();
}
function setPage(page, updateHistory = true){
  const targetPage = resolvePage(page) || "home";
  closeMobileMenu();
  if(targetPage === currentPage && !pageLoaderTimer) return;
  currentPage = targetPage;
  updateNavState(targetPage);

  if(updateHistory){
    try {
      const targetHash = targetPage === "home" ? "" : `#${targetPage}`;
      if(location.hash !== targetHash){
        history.pushState({ page: targetPage }, "", targetHash || (location.pathname.endsWith("/index.html") ? "./" : "./"));
      }
    } catch {}
  }
  updateDocumentTitle(targetPage);
  showPageLoader();
  clearTimeout(pageLoaderTimer);
  const quickPage = targetPage === "discover" || targetPage === "freebooks" || targetPage === "reader";
  if(targetPage === "discover" && !discoverBooks.length && !discoverLoading && !discoverError) fetchDiscover(discoverCategory);
  if(targetPage === "freebooks" && !freeBooks.length && !freeBooksLoading && !freeBooksError) loadFreeBooks(true);
  pageLoaderTimer = setTimeout(() => {
    pageLoaderTimer = null;
    try { renderPage(); }
    catch(error){ console.error("Could not render page.",error); renderFatalError(error); }
    finally { hidePageLoader(); }
    $("#mainContent").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, quickPage ? 0 : 80);
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
function renderFatalError(error){
  const message=error&&error.message?error.message:"Something went wrong.";
  $("#mainContent").innerHTML=`<section class="page-heading"><div><p class="eyebrow">SOMETHING WENT WRONG</p><h1>We couldn't load this page.</h1><p class="subtitle">${escapeHTML(message)}</p></div></section><div class="empty-state"><strong>Try refreshing the app.</strong><div>Your saved data is still safe on this device.</div><button class="button button-primary" style="margin-top:16px" data-action="reload-app">Reload app</button></div>`;
  $("#appShell").hidden=false;
  $("#splash").hidden=true;
  hidePageLoader();
}
function renderPage(){
  const pages = {
    home: renderHome,
    landing: renderLanding,
    discover: renderDiscover,
    freebooks: renderFreeBooks,
    "free-books": renderFreeBooks,
    freeBooks: renderFreeBooks,
    reader: renderReader,
    library: renderLibrary,
    journal: renderJournal,
    todo: renderTodo,
    goals: renderGoals,
    categories: renderCategories,
    stats: renderStats,
    settings: renderSettings,
    docs: renderDocs
  };
  const activePage = resolvePage(currentPage) || "home";
  currentPage = activePage;
  $("#mainContent").innerHTML = (pages[activePage] || renderHome)();
  updateNavState(activePage);
  updateDocumentTitle(activePage);
  bindPageEvents();
  setupLazyLoading();
  if(activePage === "discover" && !discoverBooks.length && !discoverLoading && !discoverError) fetchDiscover(discoverCategory);
  if(activePage === "freebooks" && !freeBooks.length && !freeBooksLoading && !freeBooksError) loadFreeBooks(true);
  if(activePage === "reader") applyReaderSettings();
  if(activePage === "goals") startGoalClock();
  else if(goalClock){ clearInterval(goalClock); goalClock = null; }
}
function setupLazyLoading(){
  if(lazyObserver){lazyObserver.disconnect();lazyObserver=null;}
  if(!("IntersectionObserver" in window))return;
  const targets=["#discoverSentinel","#freeBooksSentinel"].map(selector=>$(selector)).filter(Boolean);
  if(!targets.length)return;
  lazyObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      if(entry.target.id==="discoverSentinel"){
        if(discoverHasMore&&!discoverLoading&&!discoverLoadingMore)fetchDiscover(discoverCategory,false,true);
      }
      if(entry.target.id==="freeBooksSentinel"){
        if(freeBooksNext&&!freeBooksLoading&&!freeBooksLoadingMore)loadFreeBooks(false);
      }
    });
  },{rootMargin:"500px 0px"});
  targets.forEach(target=>lazyObserver.observe(target));
}
function renderDiscover(){
  const cats=["Technology","Programming","Business","Personal Development","Psychology","Fiction","Mystery","Romance","Fantasy","Science","History","Biography"];
  const chips=cats.map(c=>`<button class="filter-btn ${discoverCategory===c?"active":""}" data-discover-cat="${c}">${c}</button>`).join("");
  const bookCards=discoverBooks.map((b,i)=>`<article class="book-card" data-discover-idx="${i}" tabindex="0" role="button" aria-label="View details for ${escapeHTML(b.title)}"><div class="book-cover">${b.cover?`<img src="${escapeHTML(b.cover)}" alt="" loading="lazy" onerror="this.style.display='none'">`:""}</div><div class="book-info"><strong>${escapeHTML(b.title)}</strong><small>${escapeHTML(b.author)}${b.year?` · ${b.year}`:""}</small><div style="display:flex;gap:8px;margin-top:8px"><button class="small-btn add-library-btn" data-action="discover-add" data-idx="${i}" style="background:#111;color:#fff;border-color:#111">Add to Library</button></div></div></article>`).join("");
  const notice=discoverBooks.length&&discoverError?`<div class="inline-notice"><span>${escapeHTML(discoverError)}</span><button class="button button-secondary" data-action="discover-retry">Retry</button></div>`:"";
  const cards=discoverLoading?`<div class="empty-state discover-loading"><strong>Loading recommendations…</strong><div>Finding books for you.</div></div>`:discoverBooks.length?notice+bookCards:discoverError?`<div class="empty-state"><strong>${escapeHTML(discoverError)}</strong><button class="button button-secondary" data-action="discover-retry" style="margin-top:10px">Retry</button></div>`:`<div class="empty-state"><strong>No results.</strong>Try another category.</div>`;
  const more=discoverBooks.length&&discoverHasMore&&!discoverError?`<div class="load-more" id="discoverMore"><button class="button button-primary" data-action="discover-load-more" ${discoverLoadingMore?"disabled":""}>${discoverLoadingMore?"Loading more…":"Load more recommendations"}</button></div><div class="load-more-sentinel" id="discoverSentinel" aria-hidden="true"></div>`:"";
  return `<section class="page-heading"><div><p class="eyebrow">GET INSPIRED</p><h1>What should I read?</h1><p class="subtitle">Real recommendations from Open Library.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="button button-primary" data-page="freebooks">Free Books</button><button class="button button-secondary" data-action="discover-surprise">Surprise Me</button><button class="button button-secondary" data-action="discover-refresh">Refresh</button></div></section><div class="task-filters" style="flex-wrap:wrap">${chips}</div><div class="book-grid">${cards}</div>${more}`;
}function renderLanding(){
  return `<section class="page-heading" style="text-align:center;padding:60px 20px"><div><p class="eyebrow">DAYMARK JOURNAL</p><h1 style="font-size:clamp(36px,6vw,56px)">Make Every Day Count.</h1><p class="subtitle" style="margin:0 auto 24px;max-width:640px">Your personal space to organize your thoughts, manage everyday tasks, track your goals, and make meaningful progress.</p></div><div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><button class="button button-primary" data-page="home">Open Dashboard</button><button class="button button-secondary" data-page="discover">Explore Features</button></div></section>`;
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
  <section class="section"><div class="section-heading"><h2>My shelves</h2><div style="display:flex;gap:12px"><button class="text-button" data-page="freebooks">Free books →</button><button class="text-button" data-page="library">View library →</button></div></div>
  <div class="shelf-list">${state.shelves.slice(0,4).map(s=>{const owned=state.books.filter(b=>s.category==="Favorites"?b.favorite:b.category===s.category),thumbs=shelfBooks(s.category);return `<article class="shelf-card" data-shelf="${escapeHTML(s.category)}"><div class="shelf-art ${thumbs.length===1?"single":""}" style="background:${s.category==="Technology"?"#d8eafa":s.category==="Productivity"?"#ffe7d6":s.category==="Favorites"?"#eee4ff":"#f8eebf"}">${thumbs.map(b=>`<div class="mini-cover">${b.image?`<img src="${escapeHTML(b.image)}" alt="Cover of ${escapeHTML(b.title)}" loading="lazy" onerror="this.style.display='none'">`:""}<span>${escapeHTML(b.title)}</span></div>`).join("")||`<div class="mini-cover"><span>YOUR BOOKS</span></div>`}</div><div class="shelf-meta"><div><h3>${escapeHTML(s.name)}</h3><p>${owned.length} ${owned.length===1?"book":"books"}</p></div><span>↗</span></div></article>`}).join("")}</div></section>
  <section class="section dashboard-grid"><article class="panel"><div class="section-heading"><h2>Today's focus</h2><button class="text-button" data-page="todo">All tasks →</button></div>
  ${nextTask?`<div class="focus-item"><div class="focus-icon">☑</div><div style="flex:1"><strong>${escapeHTML(nextTask.title)}</strong><p>${escapeHTML(nextTask.description||"One small step is still progress.")}</p><div class="card-meta" style="margin-top:9px"><span>${dateLabel(nextTask.due)}</span><span class="priority priority-${nextTask.priority}">${escapeHTML(nextTask.priority)} priority</span></div></div></div>`:`<div class="empty-state"><strong>You're all caught up.</strong>Enjoy the space you've made.</div>`}
  <div style="margin-top:20px;display:flex;justify-content:space-between"><span class="subtitle">Today's tasks</span><strong>${done}/${todayTasks.length} complete</strong></div><div class="progress-track"><div class="progress-fill" style="width:${todayTasks.length?done/todayTasks.length*100:0}%"></div></div></article>
  <article class="panel"><div class="section-heading"><h2>Quick reflection</h2><span>✦</span></div><div class="journal-prompt"><p>What is one thing you learned today that you want to remember?</p></div><button class="button button-secondary" data-action="new-entry" style="width:100%">Write in your journal</button><div style="height:14px"></div><button class="button button-secondary" data-page="stats" style="width:100%">View your progress</button></article></section>`;
}
function renderLibrary(){
  const list=state.books.filter(b=>(`${b.title} ${b.author}`.toLowerCase().includes(bookSearch.toLowerCase()))&&(bookStatus==="all"||b.status===bookStatus)&&(bookCategory==="all"||(bookCategory==="Favorites"?b.favorite:b.category===bookCategory)));
  return `<section class="page-heading"><div><p class="eyebrow">YOUR COLLECTION</p><h1>My library</h1><p class="subtitle">Keep your current reads, future favorites, and finished books together.</p></div><button class="button button-primary" data-action="new-book">＋ Add book</button></section>
  <div class="toolbar"><input class="field search-field" id="bookSearch" placeholder="Search books or authors..." value="${escapeHTML(bookSearch)}" aria-label="Search books"><select class="field" id="bookStatus" aria-label="Filter by reading status"><option value="all">All statuses</option><option value="reading">Reading</option><option value="planned">Want to read</option><option value="completed">Completed</option></select><button class="button button-secondary" data-action="new-shelf">＋ Shelf</button><button class="button button-secondary" data-page="freebooks">Free Books</button>${bookCategory!=="all"?`<button class="filter-btn active" data-action="clear-category">${escapeHTML(bookCategory)} ×</button>`:""}</div>
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
  <section class="section"><div class="section-heading"><h2>7. Browse Get Inspired and Free Books</h2></div>
    <p>Use the <strong>Get Inspired</strong> menu to open Discover or Free Books. Discover shows recommendations from Open Library and loads more as you scroll or tap <strong>Load more recommendations</strong>. Free Books shows public-domain classics; search, filter by category, download EPUB, Kindle, PDF when available, or plain text, or tap <strong>Read Now</strong> to read in the app. The catalog also loads more automatically as you reach the end of the list.</p>
  </section>
  <section class="section"><div class="section-heading"><h2>8. Navigate the app</h2></div>
    <p>The top navigation keeps Home and Library close by. <strong>Get Inspired</strong> contains Discover and Free Books, while <strong>Personal Workspace</strong> contains Journal, To Do, and Goals. On phones and installed PWAs, the menu button opens the same grouped navigation, plus Categories, Statistics, Docs, and Settings. Selecting any item closes the menu and takes you straight to that page.</p>
  </section>
  <section class="section"><div class="section-heading"><h2>9. Install the app</h2></div>
    <p>Tap <strong>Get App</strong> in the top bar. On supported Android and desktop browsers, this opens the native install prompt so Daymark can be added to your home screen or app drawer. If your browser does not offer a native prompt, the app shows step-by-step installation instructions instead. Installation requires HTTPS; once installed, Daymark opens in its own window and works offline after the first visit.</p>
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
  return `<div class="onboarding-card"><div class="onboarding-container"><div class="onboarding-header">${brand}<p class="onboarding-subtitle">Let's set up your space</p>${progress}</div><div class="onboarding-body">${body}</div><div class="onboarding-footer">${back}${next}${skip}</div></div></div>`;
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
async function fetchDiscover(cat,force=false,append=false){
  const target=cat||discoverCategory;
  const changed=target!==discoverCategory;
  if(append&&(changed||discoverLoading||discoverLoadingMore||!discoverHasMore))return;
  if(!append&&discoverLoading&&!changed)return;
  discoverCategory=target;

  if(append){
    const nextPage=discoverPage+1;
    const requestId=++discoverRequest;
    discoverLoadingMore=true;discoverError="";
    if(currentPage==="discover")renderPage();
    try{
      const result=await requestDiscoverBooks(discoverCategory,nextPage);
      if(requestId!==discoverRequest)return;
      const seen=new Set(discoverBooks.map(book=>book.key||`${book.title}|${book.author}`));
      const fresh=result.books.filter(book=>!seen.has(book.key||`${book.title}|${book.author}`));
      if(fresh.length)discoverBooks=discoverBooks.concat(fresh);
      discoverPage=nextPage;
      discoverHasMore=result.hasMore&&fresh.length>0;
      writeDiscoverCache(discoverCategory,discoverBooks,discoverPage,discoverHasMore);
    }catch(error){
      if(requestId===discoverRequest)showToast("Could not load more recommendations.");
    }finally{
      if(requestId===discoverRequest){
        discoverLoadingMore=false;
        if(currentPage==="discover")renderPage();
      }
    }
    return;
  }

  if(changed){
    discoverBooks=[];
    discoverError="";
    discoverPage=1;
    discoverHasMore=true;
  }
  const requestId=++discoverRequest;
  const cached=force?null:readDiscoverCache()[discoverCategory];
  if(cached&&Array.isArray(cached.books)&&cached.books.length){
    discoverBooks=cached.books;
    discoverPage=Number(cached.page)||1;
    discoverHasMore=cached.hasMore!==false;
    discoverError="";
    discoverLoading=false;
    if(currentPage==="discover")renderPage();
    if(Date.now()-(cached.ts||0)<86400000)return;
  }
  discoverLoading=true;discoverError="";
  if(!discoverBooks.length&&currentPage==="discover")renderPage();
  let settled=false;
  const fallbackTimer=setTimeout(()=>{
    if(settled||requestId!==discoverRequest)return;
    settled=true;
    if(!discoverBooks.length){
      discoverBooks=fallbackBooks(discoverCategory);
      discoverPage=1;
      discoverHasMore=false;
      discoverLoading=false;
      discoverLoadingMore=false;
      discoverError="Could not reach Open Library. Showing sample recommendations.";
      if(currentPage==="discover")renderPage();
    }
  },DISCOVER_TIMEOUT);
  try{
    const result=await requestDiscoverBooks(discoverCategory,1);
    clearTimeout(fallbackTimer);
    if(requestId!==discoverRequest)return;
    settled=true;
    discoverBooks=result.books;
    discoverPage=1;
    discoverHasMore=result.hasMore;
    discoverError=result.books.length?"":"No results found.";
    discoverLoading=false;
    discoverLoadingMore=false;
    if(result.books.length)writeDiscoverCache(discoverCategory,discoverBooks,discoverPage,discoverHasMore);
    if(currentPage==="discover")renderPage();
  }catch(e){
    clearTimeout(fallbackTimer);
    if(requestId!==discoverRequest||settled)return;
    settled=true;
    discoverBooks=fallbackBooks(discoverCategory);
    discoverPage=1;
    discoverHasMore=false;
    discoverLoading=false;
    discoverLoadingMore=false;
    discoverError="Could not reach Open Library. Showing sample recommendations.";
    if(currentPage==="discover")renderPage();
  }
}function bindPageEvents(){
  $("#bookSearch")?.addEventListener("input",e=>{bookSearch=e.target.value;const pos=e.target.selectionStart;renderPage();const field=$("#bookSearch");field.focus();field.setSelectionRange(pos,pos);});
  $("#bookStatus")?.addEventListener("change",e=>{bookStatus=e.target.value;renderPage();$("#bookStatus").value=bookStatus;});
  $("#journalSearch")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();$$("[data-entry-card]").forEach(card=>card.hidden=!card.textContent.toLowerCase().includes(q));});
  $$("[data-book]").forEach(card=>{const open=()=>openBook(card.dataset.book);card.addEventListener("click",open);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});});
  $$("[data-shelf]").forEach(card=>card.addEventListener("click",()=>{bookSearch="";bookStatus="all";bookCategory=card.dataset.shelf;setPage("library");showToast(`Opened ${card.dataset.shelf} shelf`);}));
  $$("[data-category]").forEach(card=>card.addEventListener("click",()=>{bookSearch="";bookStatus="all";bookCategory=card.dataset.category;setPage("library");}));
  $$("[data-discover-cat]").forEach(btn=>btn.addEventListener("click",()=>fetchDiscover(btn.dataset.discoverCat)));
  const freeSearch=$("#freeBooksSearch");
  if(freeSearch){
    freeSearch.addEventListener("input",e=>{
      freeBooksQuery=e.target.value;
      const pos=e.target.selectionStart;
      clearTimeout(freeBooksSearchTimer);
      freeBooksSearchTimer=setTimeout(()=>{
        loadFreeBooks(true);
        setTimeout(()=>{const field=$("#freeBooksSearch");if(field){field.focus();if(typeof pos==="number")field.setSelectionRange(pos,pos);}},0);
      },450);
    });
    freeSearch.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();clearTimeout(freeBooksSearchTimer);loadFreeBooks(true);}});
  }
  $$("[data-freebooks-topic]").forEach(btn=>btn.addEventListener("click",()=>{const topic=btn.dataset.freebooksTopic;if(topic===freeBooksTopic)return;clearTimeout(freeBooksSearchTimer);freeBooksTopic=topic;loadFreeBooks(true);}));
  document.querySelectorAll("[data-action=discover-add]").forEach(btn=>btn.addEventListener("click",()=>{const b=discoverBooks[Number(btn.dataset.idx)];if(!b)return;state.books.push({id:uid(),title:b.title,author:b.author,category:discoverCategory,pages:Number(b.pages)||200,currentPage:0,status:"planned",favorite:false,cover:"cover-blue",image:b.cover,notes:""});persist();renderPage();showToast("Added to library");}));
  $$("[data-discover-idx]").forEach(card=>{const open=()=>openDiscoverBook(Number(card.dataset.discoverIdx));card.addEventListener("click",e=>{if(e.target.closest("[data-action=discover-add]"))return;open();});card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});});
  $$("[data-task-filter]").forEach(btn=>btn.addEventListener("click",()=>{taskFilter=btn.dataset.taskFilter;renderPage();}));
  document.querySelector("[data-action=discover-surprise]")?.addEventListener("click",()=>{const cats=["Technology","Programming","Business","Personal Development","Psychology","Fiction","Mystery","Romance","Fantasy","Science","History","Biography"];fetchDiscover(cats[Math.floor(Math.random()*cats.length)],true);});
  document.querySelector("[data-action=discover-refresh]")?.addEventListener("click",()=>fetchDiscover(discoverCategory,true));
  document.querySelector("[data-action=discover-retry]")?.addEventListener("click",()=>fetchDiscover(discoverCategory,true));
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
function shortText(value,max=600){const text=String(value||"").replace(/\s+/g," ").trim();return text.length>max?`${text.slice(0,max).trim()}…`:text;}
function discoverDetailsMarkup(b){
  const pages=b.pages?`${b.pages} pages`:"Pages unknown";
  return `<div style="display:grid;grid-template-columns:120px 1fr;gap:18px;align-items:start"><div class="book-cover cover-blue" style="width:120px">${b.cover?`<img class="cover-img" src="${escapeHTML(b.cover)}" alt="Cover of ${escapeHTML(b.title)}" onerror="this.style.display='none'">`:""}<strong>${escapeHTML(b.title)}</strong><small>${escapeHTML(b.author)}</small></div><div><h2>${escapeHTML(b.title)}</h2><p class="subtitle">${escapeHTML(b.author)}</p><div class="card-meta" style="margin-top:8px"><span>${escapeHTML(String(b.year||"Year unknown"))}</span><span id="discoverPages">${escapeHTML(pages)}</span></div><div class="section" style="margin-top:14px"><h3 style="margin-bottom:4px">What it's about</h3><p class="subtitle" id="discoverSubjects">Loading topics…</p></div><div class="section" style="margin-top:12px"><h3 style="margin-bottom:4px">Summary</h3><p id="discoverSummary" style="font-size:13px;line-height:1.6">Loading summary…</p></div><div class="form-actions" style="margin-top:16px;flex-wrap:wrap"><button class="button button-secondary" id="discoverReadNow">Read Now</button><button class="button button-primary" id="discoverDetailAdd" style="background:#111;color:#fff;border-color:#111">Add to Library</button></div><p class="subtitle" id="discoverReadStatus" style="margin-top:10px"></p></div></div>`;
}
async function resolveDiscoverKey(b){
  if(b.key)return b.key;
  if(b.isbn){
    try{const res=await fetch(`https://openlibrary.org/isbn/${b.isbn}.json`);if(res.ok){const data=await res.json();b.key=(data.works&&data.works[0]&&data.works[0].key)||"";b.pages=b.pages||data.number_of_pages||"";}}catch{}
  }
  if(!b.key&&b.title){
    try{const res=await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(b.title)}&limit=1&fields=key,number_of_pages_median`);if(res.ok){const data=await res.json();const doc=(data.docs||[])[0];if(doc){b.key=doc.key||"";b.pages=b.pages||doc.number_of_pages_median||"";}}}catch{}
  }
  return b.key||"";
}
async function fetchDiscoverDetails(b){
  const key=await resolveDiscoverKey(b);
  if(!key)return null;
  const res=await fetch(`https://openlibrary.org${key}.json`);
  if(!res.ok)return null;
  const data=await res.json();
  const description=typeof data.description==="string"?data.description:(data.description&&data.description.value)||"";
  return {description,subjects:(data.subjects||[]).slice(0,6)};
}
function chooseReadableId(ids){
  const score=id=>{let s=0;if(/gut$/.test(id))s+=4;if(/librivox/.test(id))s-=5;if(/^bwb_/.test(id)||/^isbn_/.test(id))s-=6;if(/0000/.test(id))s-=3;if(/\.edu$/.test(id))s-=2;return s;};
  return [...ids].sort((a,b)=>score(b)-score(a))[0]||"";
}
async function fetchReadAvailability(b){
  const key=await resolveDiscoverKey(b);
  const url=key?`https://openlibrary.org${key}`:"";
  if(!key)return {url};
  try{
    const res=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(`key:${key}`)}&limit=1&fields=ia,ebook_access,public_scan_b`);
    if(!res.ok)return {url};
    const doc=((await res.json()).docs||[])[0]||{};
    const ids=Array.isArray(doc.ia)?doc.ia:[];
    return {url,access:doc.ebook_access||"",publicId:doc.ebook_access==="public"?chooseReadableId(ids):""};
  }catch{return {url};}
}
function openReader(url,title,externalUrl){
  let overlay=$("#readerOverlay");
  if(!overlay){
    overlay=document.createElement("div");
    overlay.id="readerOverlay";overlay.className="reader-overlay";
    overlay.innerHTML=`<div class="reader-bar"><strong id="readerTitle"></strong><div class="reader-actions"><a id="readerExternal" class="button button-secondary" target="_blank" rel="noopener">Open in new tab</a><button class="button button-secondary" id="readerClose">Close</button></div></div><iframe id="readerFrame" allowfullscreen></iframe>`;
    document.body.appendChild(overlay);
    $("#readerClose").addEventListener("click",closeReader);
    overlay.addEventListener("click",e=>{if(e.target===overlay)closeReader();});
  }
  $("#readerTitle").textContent=title;
  $("#readerExternal").href=externalUrl;
  $("#readerFrame").src=url;
  overlay.hidden=false;document.body.style.overflow="hidden";
}
function closeReader(){
  const overlay=$("#readerOverlay");if(!overlay)return;
  overlay.hidden=true;
  const frame=$("#readerFrame");if(frame)frame.src="about:blank";
  if($("#modalBackdrop")&&$("#modalBackdrop").hidden)document.body.style.overflow="";
}
async function startDiscoverRead(b){
  const btn=$("#discoverReadNow"),status=$("#discoverReadStatus");
  if(!btn||btn.disabled)return;
  const original=btn.textContent;btn.disabled=true;btn.textContent="Loading…";
  if(status)status.textContent="Checking available editions…";
  try{
    const info=await fetchReadAvailability(b);
    if(info.publicId){
      if(status)status.textContent="";
      openReader(`https://archive.org/embed/${encodeURIComponent(info.publicId)}`,b.title,`https://archive.org/details/${encodeURIComponent(info.publicId)}`);
    }else if(info.url){
      status.innerHTML=`This book is not available as free full text. Read or borrow it on <a href="${escapeHTML(info.url)}" target="_blank" rel="noopener">Open Library</a>.`;
    }else{
      status.textContent="No full-text copy is available for this book.";
    }
  }catch{
    if(status)status.textContent="Could not load the book right now.";
  }finally{btn.disabled=false;btn.textContent=original;}
}
async function openDiscoverBook(index){
  const b=discoverBooks[index];if(!b)return;
  const token=++discoverDetailToken;
  openModal("Book details",discoverDetailsMarkup(b));
  $("#discoverDetailAdd").onclick=()=>{state.books.push({id:uid(),title:b.title,author:b.author,category:discoverCategory,pages:Number(b.pages)||200,currentPage:0,status:"planned",favorite:false,cover:"cover-blue",image:b.cover,notes:""});persist();closeModal();renderPage();showToast("Added to library");};
  $("#discoverReadNow").onclick=()=>startDiscoverRead(b);
  try{
    const details=await fetchDiscoverDetails(b);
    if(token!==discoverDetailToken||$("#modalBackdrop").hidden)return;
    if(b.pages&&$("#discoverPages"))$("#discoverPages").textContent=`${b.pages} pages`;
    $("#discoverSubjects").textContent=details&&details.subjects.length?details.subjects.join(" · "):"No topics listed.";
    $("#discoverSummary").textContent=details&&details.description?shortText(details.description):"No summary available for this book.";
  }catch{
    if(token!==discoverDetailToken||$("#modalBackdrop").hidden)return;
    $("#discoverSubjects").textContent="No topics listed.";
    $("#discoverSummary").textContent="No summary available for this book.";
  }
}
function fallbackFreeBooks(){
  const query=freeBooksQuery.trim().toLowerCase();
  return FREE_BOOKS_FALLBACK.filter(entry=>{
    if(freeBooksTopic!=="all"&&!entry.topics.includes(freeBooksTopic))return false;
    return !query||`${entry.title} ${entry.author}`.toLowerCase().includes(query);
  }).map(entry=>{
    const formats={
      "text/html":`https://www.gutenberg.org/cache/epub/${entry.id}/pg${entry.id}-images.html`,
      "application/epub+zip":`https://www.gutenberg.org/cache/epub/${entry.id}/pg${entry.id}.epub`,
      "image/jpeg":`https://www.gutenberg.org/cache/epub/${entry.id}/pg${entry.id}.cover.medium.jpg`
    };
    if(entry.txt!==false)formats["text/plain; charset=utf-8"]=`https://www.gutenberg.org/cache/epub/${entry.id}/pg${entry.id}.txt`;
    return {id:entry.id,title:entry.title,authors:[{name:entry.author}],subjects:entry.subjects,formats,fallback:true};
  });
}
function freeBooksUrl(){
  const params=new URLSearchParams();
  const query=freeBooksQuery.trim();
  if(query)params.set("search",query);
  if(freeBooksTopic!=="all")params.set("topic",freeBooksTopic);
  const qs=params.toString();
  return `${FREE_BOOKS_API}${qs?`?${qs}`:""}`;
}
function freeBookFormats(book){
  const formats=book&&book.formats&&typeof book.formats==="object"?book.formats:{};
  const entries=Object.entries(formats).filter(([,url])=>typeof url==="string"&&url);
  const pick=test=>entries.find(([mime])=>test(mime.toLowerCase()))?.[1]||"";
  const htmlEntries=entries.filter(([mime])=>mime.toLowerCase().startsWith("text/html"));
  const html=(htmlEntries.find(([mime])=>/utf-8/.test(mime.toLowerCase()))||htmlEntries[0]||[])[1]||"";
  return {
    html,
    epub:pick(mime=>mime.startsWith("application/epub+zip")),
    kindle:pick(mime=>mime.startsWith("application/x-mobipocket-ebook")),
    pdf:pick(mime=>mime.startsWith("application/pdf")),
    text:pick(mime=>mime.startsWith("text/plain")),
    archive:entries.find(([mime,url])=>(mime.toLowerCase()==="application/zip"||mime.toLowerCase()==="application/octet-stream")&&/\.zip(?:$|\?)/i.test(url))?.[1]||"",
    cover:pick(mime=>mime.startsWith("image/jpeg")||mime.startsWith("image/png"))
  };
}
function downloadUrl(book,url,kind){
  const clean=String(url||"").replace(/^http:/i,"https:");
  if(!clean)return "";
  if(kind==="text"&&/\.txt\.utf-8(?:$|\?)/i.test(clean)){
    const id=encodeURIComponent(book.id);
    return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
  }
  return clean;
}
function gutenbergLanding(book){
  return `https://www.gutenberg.org/ebooks/${encodeURIComponent(book.id)}`;
}
function gutenbergReaderUrl(book,html){
  if(!html)return "";
  const id=encodeURIComponent(book.id);
  if(/\.html\.images$/i.test(html))return `https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.html`;
  return html.replace(/^http:/i,"https:");
}
function freeBookAuthor(book){
  const names=(Array.isArray(book.authors)?book.authors:[]).map(author=>author&&author.name).filter(Boolean);
  return names.length?names.join(", "):"Unknown author";
}
function freeBookDescription(book){
  const summary=Array.isArray(book.summaries)&&book.summaries.length?book.summaries[0]:"";
  const subjects=Array.isArray(book.subjects)&&book.subjects.length?book.subjects.slice(0,2).join(" · "):"";
  return shortText(summary||subjects||"A timeless public-domain classic.",180);
}
function freeBookCard(book){
  const formats=freeBookFormats(book);
  const title=book.title||"Untitled";
  const author=freeBookAuthor(book);
  const landing=gutenbergLanding(book);
  const readerUrl=gutenbergReaderUrl(book,formats.html);
  const downloads=[];
  if(formats.epub)downloads.push({label:"EPUB",url:downloadUrl(book,formats.epub,"epub")});
  if(formats.kindle)downloads.push({label:"Kindle",url:downloadUrl(book,formats.kindle,"kindle")});
  if(formats.pdf)downloads.push({label:"PDF",url:downloadUrl(book,formats.pdf,"pdf")});
  if(formats.text)downloads.push({label:"Plain text",url:downloadUrl(book,formats.text,"text")});
  if(formats.archive)downloads.push({label:"HTML archive",url:downloadUrl(book,formats.archive,"archive")});
  const readButton=readerUrl?`<button class="button button-primary freebook-read" data-action="freebook-read" data-id="${escapeHTML(String(book.id))}">Read Now</button>`:`<a class="button button-primary freebook-read" href="${escapeHTML(landing)}" target="_blank" rel="noopener">Read Now</a>`;
  const downloadMenu=`<details class="download-menu"><summary class="button button-secondary">Download</summary><div class="download-menu-list">${downloads.map(item=>`<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener" download>${escapeHTML(item.label)}</a>`).join("")}<a href="${escapeHTML(landing)}" target="_blank" rel="noopener">Source page</a></div></details>`;
  return `<article class="freebook-card"><div class="freebook-cover"><span class="freebook-cover-fallback">${escapeHTML(title)}</span>${formats.cover?`<img src="${escapeHTML(formats.cover)}" alt="Cover of ${escapeHTML(title)}" loading="lazy" onerror="this.style.display='none'">`:""}<span class="free-tag">FREE</span></div><div class="freebook-body"><span class="pill free-pill">Public domain</span><h3>${escapeHTML(title)}</h3><p class="freebook-author">${escapeHTML(author)}</p><p class="freebook-desc">${escapeHTML(freeBookDescription(book))}</p><div class="freebook-actions">${readButton}${downloadMenu}</div></div></article>`;
}
function renderFreeBooks(){
  const chips=FREE_BOOKS_TOPICS.map(topic=>`<button class="filter-btn ${freeBooksTopic===topic.value?"active":""}" data-freebooks-topic="${topic.value}">${topic.label}</button>`).join("");
  const cards=freeBooks.length?freeBooks.map(freeBookCard).join(""):freeBooksLoading?`<div class="empty-state"><strong>Loading free books…</strong><div>Finding public-domain classics.</div></div>`:freeBooksError?`<div class="empty-state"><strong>${escapeHTML(freeBooksError)}</strong><div>The free book catalog may be temporarily unavailable.</div><button class="button button-secondary" data-action="freebooks-retry" style="margin-top:12px">Try again</button></div>`:`<div class="empty-state"><strong>No books found.</strong><div>Try a different search or category.</div></div>`;
  const count=freeBooks.length?`<p class="freebooks-count">Showing ${freeBooks.length}${freeBooksCount>freeBooks.length?` of ${freeBooksCount}`:""} free books${freeBooksLoading?" · Updating catalog…":""}</p>`:"";
  const notice=freeBooks.length&&freeBooksError?`<div class="freebooks-notice"><span>${escapeHTML(freeBooksError)} Showing the starter shelf instead.</span><button class="button button-secondary" data-action="freebooks-retry">Retry full catalog</button></div>`:"";
  const more=freeBooksNext?`<div class="freebooks-more"><button class="button button-primary" data-action="freebooks-load-more" ${freeBooksLoadingMore?"disabled":""}>${freeBooksLoadingMore?"Loading more…":"Load more books"}</button></div><div class="load-more-sentinel" id="freeBooksSentinel" aria-hidden="true"></div>`:"";
  return `<section class="page-heading"><div><p class="eyebrow">FREE BOOKS LIBRARY</p><h1>Read a classic, free.</h1><p class="subtitle">A hand-picked shelf of public-domain classics with covers, downloads, and instant reading.</p></div><span class="pill free-pill">Always free</span></section><div class="toolbar freebooks-toolbar"><input class="field search-field" id="freeBooksSearch" placeholder="Search by title or author..." value="${escapeHTML(freeBooksQuery)}" aria-label="Search free books by title or author"></div><div class="task-filters">${chips}</div>${count}${notice}<div class="freebook-grid">${cards}</div>${more}`;
}
function renderFreeBooksView(expectedKey){
  if(currentPage!=="freebooks" && currentPage!=="free-books")return;
  if(expectedKey&&freeBooksUrl()!==expectedKey)return;
  const active=document.activeElement;
  const restore=active&&active.id==="freeBooksSearch";
  const pos=restore?active.selectionStart:null;
  renderPage();
  if(restore){
    const field=$("#freeBooksSearch");
    if(field){field.focus();if(typeof pos==="number")field.setSelectionRange(pos,pos);}
  }
}
async function loadFreeBooks(reset=true,force=false){
  const key=freeBooksUrl();
  if(reset){
    if(freeBooksAbort)freeBooksAbort.abort();
    freeBooksRequest++;
    freeBooksLoading=true;freeBooksError="";freeBooksNext="";freeBooksCount=0;
    if(freeBooksKey!==key)freeBooks=[];
    freeBooksKey=key;
    const cached=force?null:freeBooksCache[key];
    if(cached&&cached.books&&cached.books.length){
      freeBooks=cached.books;freeBooksNext=cached.next||"";freeBooksCount=cached.count||cached.books.length;freeBooksLoading=false;
      renderFreeBooksView(key);
      return;
    }
    if(!freeBooks.length)renderFreeBooksView(key);
  }else{
    if(freeBooksLoadingMore||!freeBooksNext)return;
    freeBooksLoadingMore=true;renderFreeBooksView(key);
  }
  const requestId=++freeBooksRequest;
  const controller=new AbortController();freeBooksAbort=controller;
  const timer=setTimeout(()=>controller.abort(),FREE_BOOKS_TIMEOUT);
  try{
    const targetUrl=reset?key:freeBooksNext;
    const res=await fetch(targetUrl,{signal:controller.signal});
    clearTimeout(timer);
    if(!res.ok)throw new Error("Request failed");
    const data=await res.json();
    if(requestId!==freeBooksRequest)return;
    const results=Array.isArray(data.results)?data.results:[];
    if(reset&&!results.length){freeBooks=fallbackFreeBooks();freeBooksNext="";freeBooksCount=freeBooks.length;freeBooksError="No books matched. Showing a starter collection instead.";}
    else{
      if(reset){
        freeBooks=results;
      }else{
        const seen=new Set(freeBooks.map(book=>String(book.id)));
        freeBooks=freeBooks.concat(results.filter(book=>!seen.has(String(book.id))));
      }
      freeBooksNext=data.next&&data.next!==key?data.next:"";
      freeBooksCount=Number(data.count)||freeBooks.length;
      freeBooksError="";
    }
    freeBooksCache[key]={books:freeBooks,next:freeBooksNext,count:freeBooksCount,ts:Date.now()};
  }catch(error){
    clearTimeout(timer);
    if(requestId!==freeBooksRequest)return;
    if(reset){
      if(freeBooks.length){
        showToast("Could not refresh free books.");
      }else{
        freeBooks=fallbackFreeBooks();
        freeBooksNext="";
        freeBooksCount=freeBooks.length;
        freeBooksError="Could not load the full catalog.";
      }
    }else{
      showToast("Could not load more books.");
    }
  }finally{
    if(requestId===freeBooksRequest){
      freeBooksLoading=false;freeBooksLoadingMore=false;
      if(freeBooksAbort===controller)freeBooksAbort=null;
      renderFreeBooksView(key);
    }
  }
}
function saveReaderPrefs(){
  try{localStorage.setItem("daymark-reader-prefs",JSON.stringify({fontScale:readerFontScale,dark:readerDark}));}catch{}
}
function applyReaderSettings(){
  const frame=$("#gutenbergReaderFrame");
  const shell=$("#readerShell");
  if(shell)shell.classList.toggle("reader-dark",readerDark);
  if(!frame)return;
  frame.style.transformOrigin="top left";
  frame.style.transform=readerFontScale===1?"":`scale(${readerFontScale})`;
  frame.style.width=readerFontScale===1?"100%":`${100/readerFontScale}%`;
  frame.style.height=readerFontScale===1?"100%":`${100/readerFontScale}%`;
}
function renderReader(){
  const book=readerBook;
  const back=`<button class="button button-secondary" data-page="freebooks">← Back to Free Books</button>`;
  if(!book)return `<section class="page-heading"><div><p class="eyebrow">READER</p><h1>No book open.</h1><p class="subtitle">Choose a free book to start reading.</p></div><button class="button button-primary" data-page="freebooks">Browse Free Books</button></section>`;
  const formats=freeBookFormats(book);
  const landing=gutenbergLanding(book);
  const readerUrl=gutenbergReaderUrl(book,formats.html);
  if(!readerUrl){
    return `<section class="page-heading"><div><p class="eyebrow">READER</p><h1>${escapeHTML(book.title||"Untitled")}</h1><p class="subtitle">${escapeHTML(freeBookAuthor(book))}</p></div>${back}</section><div class="empty-state"><strong>No in-app reading version is available.</strong><div>Open the source page to choose a reading format.</div><a class="button button-primary" style="margin-top:14px" href="${escapeHTML(landing)}" target="_blank" rel="noopener">Open source page</a></div>`;
  }
  return `<section class="reader-page"><div class="reader-toolbar"><div class="reader-toolbar-main">${back}<div><p class="eyebrow">READING NOW</p><h1>${escapeHTML(book.title||"Untitled")}</h1><p class="subtitle">${escapeHTML(freeBookAuthor(book))}</p></div></div><div class="reader-controls" role="group" aria-label="Reader settings"><button class="icon-btn" data-action="reader-font-dec" aria-label="Decrease text size">A-</button><button class="icon-btn" data-action="reader-font-inc" aria-label="Increase text size">A+</button><button class="icon-btn" data-action="reader-theme" aria-label="Toggle reading theme">◐</button><a class="button button-secondary" href="${escapeHTML(readerUrl)}" target="_blank" rel="noopener">Open in new tab</a></div></div><div class="reader-shell ${readerDark?"reader-dark":""}" id="readerShell"><iframe id="gutenbergReaderFrame" src="${escapeHTML(readerUrl)}" title="${escapeHTML(book.title||"Book")}" referrerpolicy="no-referrer"></iframe></div><div class="reader-note"><span class="pill free-pill">Public domain</span><span class="subtitle">Public-domain edition.</span><a href="${escapeHTML(landing)}" target="_blank" rel="noopener">View source page</a></div></section>`;
}
function openFreeBookReader(book){
  readerBook=book;
  setPage("reader");
}
function shelfForm(){
  openModal("Create a shelf",`<form id="shelfForm" class="form-stack">${formField("Shelf name","shelfName","","text",true)}<div class="form-field"><label for="shelfCategory">Category</label><select class="field" id="shelfCategory">${categoryNames.filter(n=>n!=="Favorites").map(n=>`<option>${n}</option>`).join("")}</select></div><div class="form-actions"><button type="button" class="button button-secondary" id="cancelForm">Cancel</button><button type="submit" class="button button-primary">Create shelf</button></div></form>`);
  $("#cancelForm").onclick=closeModal;$("#shelfForm").onsubmit=e=>{e.preventDefault();const name=$("#shelfName").value.trim();if(!name)return;state.shelves.push({id:uid(),name,category:$("#shelfCategory").value});persist();closeModal();renderPage();showToast("Shelf created");};
}
function exportData(){
  const blob=new Blob([JSON.stringify({app:"DAYMARK JOURNAL",version:2,exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="daymark-journal-backup.json";a.click();URL.revokeObjectURL(url);showToast("Exported");
}
function importData(){const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()),incoming=parsed.data||parsed;if(!incoming.books&&!incoming.tasks&&!incoming.entries&&!incoming.goals)throw Error("Invalid backup.");if(!confirm("Replace current data?"))return;const defaults=cloneValue(defaultState);state={...defaults,...incoming,profile:{...defaults.profile,...incoming.profile},onboarding:{...defaults.onboarding,...incoming.onboarding},settings:{...defaults.settings,...incoming.settings},goals:incoming.goals||[]};persist();renderPage();showToast("Imported");}catch(err){showToast(err.message||"Could not import.");}};input.click();}
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
function resetData(){if(!confirm("Remove all data?"))return;state=cloneValue(defaultState);persist();setPage("home");showToast("Reset"); if(goalClock)clearInterval(goalClock);}
document.addEventListener("click",e=>{
  const navToggle=e.target.closest("[data-nav-toggle]");
  if(navToggle){
    e.preventDefault();
    const drop=navToggle.closest("[data-nav-dropdown]");
    const menu=$(".nav-dropdown-menu,.mobile-submenu",drop);
    const willOpen=menu?menu.hidden:false;
    closeNavDropdowns(drop);
    if(menu)menu.hidden=!willOpen;
    navToggle.setAttribute("aria-expanded",String(Boolean(willOpen)));
    drop?.classList.toggle("open",Boolean(willOpen));
    return;
  }
  const pageBtn=e.target.closest("[data-page]");
  if(pageBtn){
    e.preventDefault();
    closeNavDropdowns();
    setPage(pageBtn.dataset.page);
    return;
  }
  if(!e.target.closest("[data-nav-dropdown]"))closeNavDropdowns();
  if(!e.target.closest("#mobileMenu")&&!e.target.closest("#menuToggle")){
    const menu=$("#mobileMenu");
    if(menu&&!menu.hidden)closeMobileMenu();
  }
  const actionBtn=e.target.closest("[data-action]");if(!actionBtn)return;
  const {action,id}=actionBtn.dataset;
  if(action==="freebook-read"){const book=freeBooks.find(item=>String(item.id)===String(id));if(book)openFreeBookReader(book);return;}
  if(action==="freebooks-load-more"){loadFreeBooks(false);return;}
  if(action==="freebooks-retry"){loadFreeBooks(true,true);return;}
  if(action==="discover-load-more"){fetchDiscover(discoverCategory,false,true);return;}
  if(action==="reload-app"){location.reload();return;}
  if(action==="reader-font-dec"){readerFontScale=Math.max(.8,Number((readerFontScale-.1).toFixed(2)));applyReaderSettings();saveReaderPrefs();return;}
  if(action==="reader-font-inc"){readerFontScale=Math.min(1.6,Number((readerFontScale+.1).toFixed(2)));applyReaderSettings();saveReaderPrefs();return;}
  if(action==="reader-theme"){readerDark=!readerDark;applyReaderSettings();saveReaderPrefs();return;}
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
  if(action==="onboard-edit"){e.preventDefault();state.onboarding.completed=false;state.onboarding.step=1;onboardingStep=1;closeMobileMenu();$("#appShell").hidden=false;$("#onboarding").hidden=false;renderOnboardingFlow();}
  if(action==="onboard-skip-step"){e.preventDefault();nextOnboardingStep();}
  if(action==="onboard-skip-all"){e.preventDefault();completeOnboarding();}
  if(action==="clear-category"){bookCategory="all";renderPage();showToast("Filter cleared");}
  if(action==="new-goal")goalForm();
  if(action==="edit-goal"){const g=state.goals.find(x=>x.id===id);if(g)goalForm(g);}
  if(action==="toggle-goal"){const g=state.goals.find(x=>x.id===id);if(g){g.done=!g.done;g.warnedSoon=g.done?false:g.warnedSoon;g.warnedLate=g.done?false:g.warnedLate;persist();renderPage();showToast(g.done?"Goal completed":"Marked incomplete");}}
  if(action==="delete-goal"&&confirm("Delete this goal?")){state.goals=state.goals.filter(x=>x.id!==id);persist();renderPage();showToast("Goal deleted");}
});
$("#menuToggle").addEventListener("click",()=>{
  const menu=$("#mobileMenu");
  const willOpen=menu.hidden;
  if(willOpen)closeNavDropdowns();
  menu.hidden=!willOpen;
  document.body.classList.toggle("menu-open",willOpen);
  $("#menuToggle").setAttribute("aria-expanded",String(willOpen));
});
$("#closeModal").addEventListener("click",closeModal);
$("#modalBackdrop").addEventListener("click",e=>{if(e.target===$("#modalBackdrop"))closeModal();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeMobileMenu();}});
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
function installInstructionsMarkup(){
  const ua=navigator.userAgent;
  let steps;
  if(/iphone|ipad|ipod/i.test(ua)){
    steps=["Open this site in Safari.","Tap the Share button in the browser toolbar.","Choose Add to Home Screen, then tap Add."];
  }else if(/android/i.test(ua)){
    steps=["Open the browser menu (the three-dot button).","Choose Install app or Add to Home screen.","Confirm the install. Daymark will appear in your app drawer."];
  }else{
    steps=["Open your browser menu.","Choose Install Daymark or Create shortcut.","Confirm the install to add Daymark to your apps."];
  }
  return `<div class="install-help"><p class="subtitle">Your browser doesn't offer an in-app install prompt right now. You can still install Daymark from the browser menu:</p><ol>${steps.map(step=>`<li>${escapeHTML(step)}</li>`).join("")}</ol><p class="subtitle">Installation requires HTTPS and a modern browser. Once installed, Daymark opens in its own window and works offline.</p></div>`;
}
function showInstallHelp(){openModal("Install Daymark JOURNAL",installInstructionsMarkup());}
$("#installBtn").addEventListener("click",async()=>{
  if(isInstalled()){showToast("Daymark is already installed.");return;}
  if(!deferredInstallPrompt){showInstallHelp();return;}
  const prompt=deferredInstallPrompt;
  deferredInstallPrompt=null;
  try{
    prompt.prompt();
    const choice=await prompt.userChoice;
    if(choice.outcome==="accepted"){
      showToast("Finishing installation…");
    }else{
      showToast("Installation cancelled. You can try again with Get App.");
    }
  }catch(error){
    console.warn("Install prompt failed.",error);
    showToast("Installation isn't available right now. Use your browser menu to install.");
    showInstallHelp();
  }finally{
    updateMode();
  }
});
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  const btn=$("#installBtn");
  if(btn)btn.hidden=isInstalled();
});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;updateMode();showToast("Daymark JOURNAL installed");});
window.matchMedia("(display-mode: standalone)").addEventListener?.("change",updateMode);

async function init(){
  updateMode();
  document.body.classList.toggle("dark", state.settings.theme === "dark");
  $("#appShell").hidden=false;
  try{
    currentPage=getInitialPage();
    updateDocumentTitle(currentPage);
    updateNavState(currentPage);
    renderPage();
    if(currentPage !== "discover") prefetchDiscover(discoverCategory);
  }catch(error){
    console.error("Daymark could not start.",error);
    renderFatalError(error);
  }
  if(!state.onboarding.completed){
    $("#appShell").hidden=false;
    $("#onboarding").hidden=false;
    renderOnboardingFlow();
  }
  requestAnimationFrame(()=>{
    const splash=$("#splash");
    if(!splash)return;
    splash.style.opacity="0";
    setTimeout(()=>{splash.hidden=true;},350);
  });
  if("serviceWorker" in navigator && location.protocol !== "file:"){
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  setInterval(checkGoalAlerts, 60000);
  setInterval(() => {
    if(currentPage === "home" && !pageLoaderTimer){
      const h = $("#mainContent h1");
      if(h) h.textContent = `${timeGreeting()}, ${state.profile.name || "Daymark"}.`;
    }
  }, 60000);
}

window.addEventListener("popstate", e => {
  const p = (e.state && e.state.page) || getInitialPage();
  setPage(p, false);
});
window.addEventListener("hashchange", () => {
  const p = getInitialPage();
  setPage(p, false);
});
window.addEventListener("resize", () => {
  if(window.innerWidth > 980) closeMobileMenu();
});

init();






















