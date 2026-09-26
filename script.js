// ══════════════════ STATE ══════════════════
const SW_KEY = 'swEnrolledCourses';
let allCourses = [];
let currentFilter = 'all';
let currentBatchId = null;
let batchData = null;
let videoTopicSelected = null;
let notesTopicSelected = null;
let currentQualityList = [];

function getEnrolled() {
  try { const v=JSON.parse(localStorage.getItem(SW_KEY)||'[]'); return Array.isArray(v)?v:[]; }
  catch{return[];}
}
function saveEnrolled(ids){ localStorage.setItem(SW_KEY,JSON.stringify(ids)); }

// ══════════════════ JOIN POPUP ══════════════════
function skipJoinPopup(){
  document.getElementById('join-tg-overlay').style.display='none';
  document.body.style.overflow='';
}

// ══════════════════ ROUTING ══════════════════
function parseHash(){
  const h = location.hash.slice(1);
  if(!h||h==='/') return{page:'home',id:null};
  const m=h.match(/^\/batch\/(.+)/);
  return m?{page:'batch',id:m[1]}:{page:'home',id:null};
}
function navigate(page,id=null){
  if(page==='batch') location.hash='/batch/'+id;
  else location.hash='/';
}
function goHome(){ navigate('home'); }

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', ()=>{ initHome(); handleRoute(); });

function handleRoute(){
  const {page,id}=parseHash();
  document.getElementById('page-home').classList.toggle('active',page==='home');
  document.getElementById('page-batch').classList.toggle('active',page==='batch');
  if(page==='batch'&&id){ loadBatch(id); }
}

// ══════════════════ HOME ══════════════════
function toggleHomeSearch(){
  document.getElementById('home-header-inner').style.display='none';
  document.getElementById('home-search-row').style.display='flex';
  document.getElementById('home-search-input').focus();
}
function closeHomeSearch(){
  document.getElementById('home-header-inner').style.display='flex';
  document.getElementById('home-search-row').style.display='none';
  document.getElementById('home-search-input').value='';
  filterCourses();
}

async function initHome(){
  renderCoursesGrid('<div class="loader-center"><div class="dots-loader"><div></div><div></div><div></div></div></div>');
  try{
    const res=await fetch('https://backend.multistreaming.site/api/courses/');
    if(!res.ok) throw new Error('Failed to fetch');
    const j=await res.json();
    if(j.state!==200) throw new Error(j.message||'Error');
    allCourses=(j.data||[]).sort((a,b)=>(a.priority??999)-(b.priority??999));
    updateHeroStats();
    filterCourses();
  }catch(e){
    renderCoursesGrid(`<div class="error-state">
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#ef4444" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <h3>Failed to Load</h3><p>${e.message}</p>
    </div>`);
  }
}

function updateHeroStats(){
  const enrolled=getEnrolled();
  const live=allCourses.filter(c=>c.isLive&&c.status==='active').length;
  document.getElementById('stat-batches').textContent=allCourses.length;
  document.getElementById('stat-live').textContent=live;
  document.getElementById('stat-enrolled').textContent=enrolled.length;
}

function setFilter(f,btn){
  currentFilter=f;
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  filterCourses();
}

function filterCourses(){
  const q=(document.getElementById('home-search-input').value||'').toLowerCase();
  const enrolled=getEnrolled();
  let list=allCourses;
  if(q) list=list.filter(c=>c.title.toLowerCase().includes(q)||((c.short_description||'').toLowerCase().includes(q)));
  if(currentFilter==='live') list=list.filter(c=>c.isLive&&c.status==='active');
  else if(currentFilter==='recorded') list=list.filter(c=>c.isRecorded);
  else if(currentFilter==='enrolled') list=list.filter(c=>enrolled.includes(c.id));

  document.getElementById('courses-count').textContent=list.length+' batch'+(list.length!==1?'es':'');

  if(list.length===0){
    renderCoursesGrid('<div class="empty-state"><div class="empty-icon">🔍</div><h3>No batches found</h3><p>Try a different filter or search.</p></div>');
    return;
  }
  renderCoursesGrid(list.map(renderCourseCard).join(''));
}

function getThumbnail(c){
  return c.banner||c.bannerSquare||'https://placehold.co/400x225/5a4bda/white?text=Course';
}

function renderCourseCard(c){
  const enrolled=getEnrolled().includes(c.id);
  const disc=c.price&&c.price>c.discountPrice?Math.round((1-c.discountPrice/c.price)*100):0;

  let leftBadge='';
  if(c.status==='inactive') leftBadge='<span class="badge badge-inactive">Inactive</span>';
  else if(c.isLive) leftBadge='<span class="badge badge-live"><span class="dot"></span>Live</span>';
  else if(c.isRecorded) leftBadge='<span class="badge badge-recorded">📹 Recorded</span>';

  const rightBadge=enrolled?'<span class="badge badge-enrolled">✓ Enrolled</span>':'';

  const enrollBtn=enrolled
    ?`<button class="btn btn-danger" onclick="event.stopPropagation();unenroll('${c.id}')">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
        Unenroll
      </button>`
    :`<button class="btn btn-outline" onclick="event.stopPropagation();enroll('${c.id}')">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Enroll
      </button>`;

  const discTag=disc>0?`<span class="price-discount">${disc}% off</span>`:'';
  const origTag=c.price&&c.price>c.discountPrice?`<span class="price-original">₹${c.price}</span>`:'';
  const metaLive=c.isLive?'<span class="course-meta-tag">🔴 Live Classes</span>':'';
  const metaRec=c.isRecorded?'<span class="course-meta-tag">📹 Recorded</span>':'';
  const metaVal=c.validity?`<span class="course-meta-tag">⏳ ${c.validity}</span>`:'';

  return `
  <div class="course-card page-enter" onclick="navigate('batch','${c.id}')">
    <div class="course-card-thumb">
      <img class="course-card-img" src="${getThumbnail(c)}" alt="${esc(c.title)}" loading="lazy" onerror="this.src='https://placehold.co/400x225/5a4bda/white?text=Course'" />
      <div class="course-card-badges">${leftBadge}${rightBadge}</div>
    </div>
    <div class="course-card-body">
      <div class="course-card-title">${esc(c.title)}</div>
      ${c.short_description?`<div class="course-card-desc">${esc(c.short_description)}</div>`:''}
      <div class="course-card-price">
        <span class="price-current">₹${c.discountPrice}</span>
        ${origTag}${discTag}
      </div>
      <div class="course-card-meta">${metaLive}${metaRec}${metaVal}</div>
      <div class="course-card-actions">
        <button class="btn btn-primary" onclick="event.stopPropagation();navigate('batch','${c.id}')">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Study
        </button>
        ${enrollBtn}
      </div>
    </div>
  </div>`;
}

function renderCoursesGrid(html){
  document.getElementById('courses-grid').innerHTML=html;
}

function enroll(id){
  const ids=[...getEnrolled(),id];
  saveEnrolled(ids);
  const c=allCourses.find(x=>x.id===id);
  showToast('Enrolled in '+( c?c.title:'batch')+'!','success');
  filterCourses(); updateHeroStats();
}
function unenroll(id){
  saveEnrolled(getEnrolled().filter(x=>x!==id));
  const c=allCourses.find(x=>x.id===id);
  showToast('Unenrolled from '+(c?c.title:'batch'),'error');
  filterCourses(); updateHeroStats();
}

// ══════════════════ BATCH DETAIL ══════════════════
async function loadBatch(id){
  if(currentBatchId===id&&batchData) return;
  currentBatchId=id; batchData=null;
  videoTopicSelected=null; notesTopicSelected=null;

  document.getElementById('batch-tabs-nav').style.display='none';
  document.getElementById('batch-tab-content').style.display='none';
  document.getElementById('batch-header-title').textContent='';
  document.getElementById('batch-hero-inner').innerHTML='<div class="loader-center"><div class="dots-loader"><div></div><div></div><div></div></div></div>';

  try{
    const res=await fetch(`https://backend.multistreaming.site/api/courses/${id}`);
    if(!res.ok) throw new Error('Failed to load batch');
    const j=await res.json();
    if(j.state!==200) throw new Error(j.message||'Error');
    batchData=j.data;
    renderBatchHero(batchData, id);
    renderBatchOverview(batchData);
    document.getElementById('tab-videos').innerHTML='<div id="videos-inner"></div>';
    document.getElementById('tab-notes').innerHTML='<div id="notes-inner"></div>';
    renderTimetabTab(batchData);
    document.getElementById('batch-tabs-nav').style.display='flex';
    document.getElementById('batch-tab-content').style.display='block';
    switchTab('overview', document.querySelector('.tab-btn'));
  }catch(e){
    document.getElementById('batch-hero-inner').innerHTML=`<div class="error-state" style="padding:40px 0;">
      <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#ef4444" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
      </svg>
      <p style="color:white;">${e.message}</p>
    </div>`;
  }
}

function renderBatchHero(b, id){
  const enrolled=getEnrolled().includes(id);
  const disc=b.price&&b.price>b.discountPrice?Math.round((1-b.discountPrice/b.price)*100):0;
  const img=b.banner||'https://placehold.co/520x293/3d2fa8/white?text=Course';

  document.getElementById('batch-header-title').textContent=b.title;
  document.getElementById('batch-hero-inner').innerHTML=`
    <img class="batch-hero-thumb" src="${esc(img)}" alt="${esc(b.title)}" onerror="this.src='https://placehold.co/520x293/3d2fa8/white?text=Course'" />
    <h1 class="batch-hero-title">${esc(b.title)}</h1>
    <div class="batch-hero-price">
      <span class="batch-price-big">₹${b.discountPrice}</span>
      ${b.price&&b.price>b.discountPrice?`<span class="batch-price-orig">₹${b.price}</span><span class="badge badge-green" style="font-size:0.75rem;">${disc}% off</span>`:''}
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      ${b.isLive?'<span class="badge badge-live" style="font-size:0.75rem;"><span class="dot"></span>Live Course</span>':''}
      ${b.isRecorded?'<span class="badge badge-recorded" style="font-size:0.75rem;">📹 Recorded</span>':''}
      ${b.validity?`<span class="badge badge-primary" style="font-size:0.75rem;">⏳ ${esc(b.validity)}</span>`:''}
      ${enrolled?'<span class="badge badge-enrolled" style="font-size:0.75rem;">✓ Enrolled</span>':''}
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
      ${enrolled
        ?`<button class="btn btn-danger" onclick="unenrollBatch('${currentBatchId}')">Unenroll</button>`
        :`<button class="btn btn-primary" style="background:white;color:var(--primary);" onclick="enrollBatch('${currentBatchId}')">
           <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
           Enroll Now
         </button>`}
      <button class="btn" id="download-videos-btn" style="background:rgba(255,255,255,0.15);color:white;border:1.5px solid rgba(255,255,255,0.35);backdrop-filter:blur(8px);" onclick="downloadAllVideos('${currentBatchId}')">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download Video List
      </button>
    </div>
  `;
}

function enrollBatch(id){
  const ids=[...getEnrolled(),id];
  saveEnrolled(ids);
  renderBatchHero(batchData, id);
  updateHeroStats();
  showToast('Enrolled successfully!','success');
}
function unenrollBatch(id){
  saveEnrolled(getEnrolled().filter(x=>x!==id));
  renderBatchHero(batchData, id);
  updateHeroStats();
  showToast('Unenrolled','error');
}

// ── Overview Tab ──
function renderBatchOverview(b){
  let html='<div class="page-enter">';

  if(b.description&&b.description.length>0){
    html+=`<div class="overview-section">
      <h3><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>Course Description</h3>
      <ul>${b.description.map(d=>`<li>${esc(d)}</li>`).join('')}</ul>
    </div>`;
  }

  if(b.courseHighlights&&b.courseHighlights.length>0){
    html+=`<div class="overview-section">
      <h3><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--primary)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Highlights</h3>
      <ul>${b.courseHighlights.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>
    </div>`;
  }

  if(b.facultyDetails){
    const f=b.facultyDetails;
    html+=`<div class="overview-section">
      <h3><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--primary)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Faculty</h3>
      <div class="faculty-card">
        <img class="faculty-img" src="${esc(f.imageUrl||'')}" alt="${esc(f.name)}" onerror="this.src='https://placehold.co/80x80/5a4bda/white?text=${esc(f.name?f.name[0]:'?')}'" />
        <div>
          <div class="faculty-name">${esc(f.name)}</div>
          <div class="faculty-role">${esc(f.designation||'')}</div>
          <div class="faculty-exp">${esc(f.experience||'')}${f.reach?' · '+esc(f.reach):''}</div>
          ${f.bio?`<div class="faculty-bio">${esc(f.bio)}</div>`:''}
        </div>
      </div>
    </div>`;
  }

  if(b.faqs&&b.faqs.length>0){
    html+=`<div class="overview-section">
      <h3><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>FAQs</h3>
      ${b.faqs.map(f=>`
        <div class="faq-item">
          <button class="faq-question" onclick="toggleFaq(this)">${esc(f.question)}
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-answer">${esc(f.answer)}</div>
        </div>`).join('')}
    </div>`;
  }

  html+='</div>';
  document.getElementById('tab-overview').innerHTML=html;
}

function toggleFaq(btn){
  btn.classList.toggle('open');
  btn.nextElementSibling.classList.toggle('open');
}

// ── Videos Tab ──
async function loadVideosTab(){
  const el=document.getElementById('videos-inner');
  if(videoTopicSelected){
    renderVideoTopic(videoTopicSelected);
    return;
  }
  el.innerHTML='<div class="loader-center"><div class="dots-loader"><div></div><div></div><div></div></div></div>';
  try{
    const res=await fetch(`https://backend.multistreaming.site/api/courses/${currentBatchId}/classes?populate=full`);
    const j=await res.json();
    const topics=(j.state===200&&j.data?.classes)?j.data.classes:[];
    const valid=topics.filter(t=>(t.classes||[]).length>0);
    if(valid.length===0){el.innerHTML='<div class="empty-state"><div class="empty-icon">🎬</div><p>No videos available yet.</p></div>';return;}
    el.innerHTML=valid.map((t,i)=>`
      <div class="topic-card" onclick="selectVideoTopic(${i})">
        <div class="topic-icon topic-icon-video">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--primary)" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        </div>
        <div class="topic-info">
          <div class="topic-name">${esc(t.topicName)}</div>
          <div class="topic-sub">${(t.classes||[]).length} lecture${(t.classes||[]).length!==1?'s':''}</div>
        </div>
        <button class="btn-icon">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`).join('');
    el._topics=valid;
  }catch(e){el.innerHTML=`<div class="error-state"><p>${e.message}</p></div>`;}
}

function selectVideoTopic(idx){
  const el=document.getElementById('videos-inner');
  videoTopicSelected=el._topics[idx];
  renderVideoTopic(videoTopicSelected);
}
function renderVideoTopic(topic){
  const items=topic.classes||[];
  const el=document.getElementById('videos-inner');
  el.innerHTML=`
    <button class="btn btn-ghost" style="margin-bottom:12px;" onclick="backToVideoTopics()">
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
      Back to Topics
    </button>
    <h3 style="font-size:1rem;font-weight:700;margin-bottom:14px;">${esc(topic.topicName)}</h3>
    ${items.map(cls=>renderClassCard(cls)).join('')}
  `;
}
function backToVideoTopics(){ videoTopicSelected=null; loadVideosTab(); }

function renderClassCard(cls){
  const isLive=cls.isLive&&cls.streamStatus!=='ended';
  const isUpcoming=cls.startDate&&new Date(cls.startDate)>new Date()&&!isLive;
  const isCompleted=cls.streamStatus==='ended'||(!isLive&&!isUpcoming);
  const hasRec=cls.mp4Recordings&&cls.mp4Recordings.length>0;
  const hasNotes=cls.classPdf&&cls.classPdf.length>0;

  const statusBadge=isLive
    ?'<span class="badge badge-live"><span class="dot"></span>LIVE</span>'
    :isUpcoming?'<span class="badge badge-upcoming">Upcoming</span>'
    :'<span class="badge badge-completed">Completed</span>';

  const dateStr=cls.startDate?`<span class="class-time">
    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    ${new Date(cls.startDate).toLocaleDateString()} &bull; ${new Date(cls.startDate).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
  </span>`:'';

  let videoSection='';
  if(isLive){
    videoSection=`<button class="btn btn-live" style="width:100%;" onclick="openLink('${esc(cls.class_link||'')}')">
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>
      Join Live
    </button>`;
  } else if(isCompleted&&hasRec){
    if(cls.mp4Recordings.length>1){
      videoSection='<div style="display:flex;flex-wrap:wrap;gap:6px;">'+
        cls.mp4Recordings.map(r=>`<button class="btn btn-primary btn-sm" onclick="openLink('${esc(r.url)}')">▶ ${esc(r.quality)}</button>`).join('')+
      '</div>';
    } else {
      videoSection=`<button class="btn btn-primary" style="width:100%;" onclick="openLink('${esc(cls.mp4Recordings[0].url)}')">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Watch Recording
      </button>`;
    }
  } else if(isUpcoming){
    videoSection='<button class="btn btn-disabled" style="width:100%;" disabled>⏳ Upcoming</button>';
  } else {
    videoSection=`<button class="btn btn-outline" style="width:100%;" onclick="openLink('${esc(cls.class_link||'')}')">
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="cu
