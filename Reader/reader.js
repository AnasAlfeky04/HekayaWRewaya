/* حكاية ورواية | قارئ PDF مستقل */
const SUPABASE_URL = "https://aibgixalrifqbsotiogu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const bookId = params.get("book") || params.get("book_id");
const els = { title:$("bookTitle"), message:$("readerMessage"), loading:$("loadingState"), spread:$("pageSpread"), left:$("pageLeft"), right:$("pageRight"), total:$("pageTotal"), input:$("pageInput"), caption:$("pageCaption"), progress:$("progressBar"), toast:$("toast")};
let pdfDoc = null, currentPage = 1, zoom = 1, renderToken = 0, toastTimer = null;
const isMobile = () => window.matchMedia("(max-width:760px)").matches;
function notify(message){ els.toast.textContent=message;els.toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>els.toast.classList.remove("show"),2600); }
function showError(message){els.loading.hidden=false;els.spread.hidden=true;els.message.textContent=message;const spinner=els.loading.querySelector(".spinner");if(spinner)spinner.hidden=true;}

function bookmarkKey(){
  return `hikaya-reader-bookmark-${bookId}`;
}

function updateBookmarkButton(){
  const bookmarkBtn = $("bookmarkBtn");
  if(!bookmarkBtn) return;

  let savedPage = null;

  try {
    const saved = localStorage.getItem(bookmarkKey());
    savedPage = saved !== null ? Number(saved) : null;
  } catch(_) {}

  const isBookmarked = savedPage === currentPage;

  bookmarkBtn.classList.toggle("is-bookmarked", isBookmarked);
  bookmarkBtn.title = isBookmarked
    ? "إلغاء العلامة المرجعية"
    : "حفظ علامة مرجعية";

  bookmarkBtn.setAttribute("aria-pressed", String(isBookmarked));
}

function savePosition(){try{localStorage.setItem(`hikaya-reader-page-${bookId}`,String(currentPage));}catch(_){}}
async function getPdfUrl(){
  const {data:sessionData,error:sessionError}=await db.auth.getSession();
  if(sessionError)throw sessionError;
  const session=sessionData.session;
  if(!session){location.href=`/Auth/auth.html?mode=login&next=${encodeURIComponent(location.pathname+location.search)}`;throw new Error("سجّل دخولك أولًا لفتح الرواية.");}
  if(!bookId)throw new Error("معرّف الرواية غير موجود في الرابط.");
  const {data,error}=await db.functions.invoke("get-book-url",{body:{book_id:bookId}});
  if(error)throw error;
  const url=data?.signedUrl||data?.signed_url||data?.url;
  if(!url)throw new Error("لم نتمكن من الحصول على رابط قراءة الرواية.");
  return url;
}


let pageFlipAudioReady = false;

function preparePageFlipSound() {
  const sound = $("pageFlipSound");
  if (!sound) return;

  sound.load();

  sound.addEventListener("canplaythrough", () => {
    pageFlipAudioReady = true;
  }, { once: true });

  sound.addEventListener("error", () => {
    console.error("Page flip audio loading failed:", sound.error);
  });
}

function playPageFlipSound() {
  const sound = $("pageFlipSound");
  if (!sound || sound.readyState < 2) return;

  sound.currentTime = 0;

  sound.play().catch(error => {
    console.error("Page flip audio error:", error);
  });
}


async function initReader(){
  try{
    if(!window.pdfjsLib)throw new Error("مكتبة عرض الصفحات لم يتم تحميلها. حدّث الصفحة وحاول مرة أخرى.");
    const url=await getPdfUrl();

    const task = pdfjsLib.getDocument({
      url,
      withCredentials: false,
      disableFontFace: true
    });

    pdfDoc=await task.promise;
    els.total.textContent=pdfDoc.numPages.toLocaleString("ar-EG");
    els.input.max=pdfDoc.numPages;
    const saved=Number(localStorage.getItem(`hikaya-reader-page-${bookId}`));
    currentPage=Number.isFinite(saved)&&saved>=1&&saved<=pdfDoc.numPages?saved:1;
    els.loading.hidden=true;els.spread.hidden=false;
    await renderSpread();
  }catch(error){console.error("Reader init error:",error);showError(error.message||"تعذّر فتح الرواية. تأكد من تسجيل الدخول وحاول مرة أخرى.");}
}



function tintCanvasPaper(canvas) {
  const context = canvas.getContext("2d");

  if (!context || !canvas.width || !canvas.height) return;

  let imageData;

  try {
    imageData = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
  } catch (error) {
    console.warn("Paper tint skipped:", error);
    return;
  }

  const pixels = imageData.data;

  // لون الورق العاجي
  const targetR = 248;
  const targetG = 242;
  const targetB = 232;

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];

    if (alpha === 0) continue;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);

    // استهداف الأبيض والدرجات القريبة منه فقط
    if (min < 218 || max - min > 20) continue;

    const strength = Math.min(1, (min - 218) / 37);

    pixels[i] = Math.round(r + (targetR - r) * strength);
    pixels[i + 1] = Math.round(g + (targetG - g) * strength);
    pixels[i + 2] = Math.round(b + (targetB - b) * strength);
  }

  context.putImageData(imageData, 0, 0);
}



async function renderOne(pageNumber, canvas, layer, token) {
  const context = canvas.getContext("2d");

  if (pageNumber > pdfDoc.numPages || pageNumber < 1) {
    canvas.width = 1;
    canvas.height = 1;
    context.clearRect(0, 0, 1, 1);
    layer.replaceChildren();
    return;
  }

  const page = await pdfDoc.getPage(pageNumber);

  if (token !== renderToken) return;

  const box = canvas.parentElement;

  box.style.touchAction =
  isMobile() && zoom <= 1.01
    ? "pan-y"
    : "pan-x pan-y";

  const base = page.getViewport({ scale: 1 });

  const availableWidth = Math.max(100, box.clientWidth - 18);
  const availableHeight = Math.max(150, box.clientHeight - 18);

  const fit = Math.min(
    availableWidth / base.width,
    availableHeight / base.height
  );

  const scale = fit * zoom;
  const viewport = page.getViewport({ scale });

  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  layer.replaceChildren();

  await page.render({
    canvasContext: context,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
  }).promise;

  // تحويل درجات الأبيض إلى لون ورق عاجي بعد انتهاء الرسم
  tintCanvasPaper(canvas);
}

async function renderSpread() {
  if (!pdfDoc) return;

  const token = ++renderToken;
  const mobile = isMobile();

  // في القراءة العربية:
  // الصفحة الأولى على اليمين، والثانية على الشمال.
  // على الموبايل نعرض صفحة واحدة فقط.
  const rightNum = currentPage;
  const leftNum = mobile ? 0 : currentPage + 1;

  els.left.parentElement.hidden = mobile;
  document.querySelector(".book-gutter").hidden = mobile;

  els.input.value = currentPage;

  updateBookmarkButton();

  els.caption.textContent =
    `صفحة ${currentPage.toLocaleString("ar-EG")} من ${pdfDoc.numPages.toLocaleString("ar-EG")}`;

  els.progress.style.width =
    `${(currentPage / pdfDoc.numPages) * 100}%`;


// السهم اليمين: السابق
$("prevBtn").disabled = currentPage <= 1;

// السهم الشمال: التالي
$("nextBtn").disabled =
  currentPage + (isMobile() ? 1 : 2) > pdfDoc.numPages;

  $("zoomLabel").textContent = `${Math.round(zoom * 100)}%`;

  try {
    await Promise.all([
      renderOne(leftNum, els.left, $("textLeft"), token),
      renderOne(rightNum, els.right, $("textRight"), token)
    ]);

    savePosition();
  } catch (error) {
    if (token === renderToken) {
      console.error(error);
      notify("حصلت مشكلة في عرض الصفحة.");
    }
  }
}

function goToPage(n){if(!pdfDoc)return;currentPage=Math.max(1,Math.min(pdfDoc.numPages,Math.floor(Number(n)||1)));renderSpread();}

// تحديث أيقونة الوضع الليلي والنهاري
function updateThemeButton() {
  const btn = $("themeBtn");
  if (!btn) return;

  const isDark = document.body.classList.contains("dark");

  btn.innerHTML = isDark
  ? `<svg viewBox="0 0 24 24">
       <circle cx="12" cy="12" r="4"/>
       <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>
     </svg>`
  : `<svg viewBox="0 0 24 24">
       <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z"/>
     </svg>`;

  btn.title = isDark ? "الوضع النهاري" : "الوضع الليلي";
  btn.setAttribute("aria-label", isDark ? "تبديل إلى الوضع النهاري" : "تبديل إلى الوضع الليلي");
}

// تبديل الوضع
function toggleTheme() {
  document.body.classList.toggle("dark");

  try {
    localStorage.setItem(
      "hikaya-reader-theme",
      document.body.classList.contains("dark") ? "dark" : "light"
    );
  } catch (_) {}

  updateThemeButton();
}

function addTextRangeHighlights(div, start, end, layer) {
  const walker = document.createTreeWalker(
    div,
    NodeFilter.SHOW_TEXT
  );

  const layerRect = layer.getBoundingClientRect();
  let offset = 0;
  let node;

  while ((node = walker.nextNode())) {
    const length = node.nodeValue.length;
    const localStart = Math.max(start, offset);
    const localEnd = Math.min(end, offset + length);

    if (localStart < localEnd) {
      const range = document.createRange();
      try {
        range.setStart(node, localStart - offset);
        range.setEnd(node, localEnd - offset);

        const rects = range.getClientRects();
        for (const rect of rects) {
          if (!rect.width || !rect.height) continue;

          const highlight = document.createElement("div");
          highlight.className = "search-hit-overlay";

          // حساب الإحداثيات بدقة نسبية لطبقة النص بغض النظر عن التمرير أو التكبير
          const left = rect.left - layerRect.left;
          const top = rect.top - layerRect.top;

          highlight.style.left = `${left}px`;
          highlight.style.top = `${top}px`;
          highlight.style.width = `${rect.width}px`;
          highlight.style.height = `${rect.height}px`;

          layer.appendChild(highlight);
        }
      } catch (e) {
        console.warn("Highlight range error:", e);
      }
    }
    offset += length;
  }
}

function applySearchHighlights() {
  const query = els.searchInput.value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();

  document.querySelectorAll(".page-sheet").forEach(sheet => {
    const layer = sheet.querySelector(".text-layer");
    if (!layer) return;

    // إزالة التظليل السابق
    layer.querySelectorAll(".search-hit-overlay").forEach(
      highlight => highlight.remove()
    );
    sheet.classList.remove("search-highlight");

    if (!query) return;

    const divs = [...layer.querySelectorAll("[data-search-text]")];
    let fullText = "";
    const records = [];

    divs.forEach((div, index) => {
      const original = div.dataset.searchText || "";
      if (index > 0) fullText += " ";
      const start = fullText.length;
      fullText += original.toLocaleLowerCase();

      records.push({
        div,
        original,
        start,
        end: fullText.length
      });
    });

    const matches = [];
    let position = 0;

    while (true) {
      const found = fullText.indexOf(query, position);
      if (found === -1) break;
      matches.push({
        start: found,
        end: found + query.length
      });
      position = found + query.length;
    }

    if (!matches.length) return;

    let hasHighlight = false;

    records.forEach(record => {
      matches.matchesFromRecord = matches.forEach(match => {
        const start = Math.max(match.start, record.start);
        const end = Math.min(match.end, record.end);

        if (start >= end) return;

        addTextRangeHighlights(
          record.div,
          start - record.start,
          end - record.start,
          layer
        );

        hasHighlight = true;
      });
    });

    if (hasHighlight) {
      sheet.classList.add("search-highlight");
    }
  });
}

async function searchDocument(direction=1){
  const query=els.searchInput.value.trim().toLocaleLowerCase();if(!query){els.searchStatus.textContent="اكتب كلمة";return;}
  if(!searchMatches.length||searchMatches.query!==query){els.searchStatus.textContent="جاري البحث...";searchMatches=[];searchMatches.query=query;
    for(let i=1;i<=pdfDoc.numPages;i++){const page=await pdfDoc.getPage(i);const content=await page.getTextContent();const text=content.items.map(x=>x.str).join(" ").toLocaleLowerCase();let from=0,at;while((at=text.indexOf(query,from))!==-1){searchMatches.push(i);from=at+query.length;}}
  }
  if(!searchMatches.length){els.searchStatus.textContent="لا توجد نتائج";applySearchHighlights();return;}
  searchIndex=(searchIndex+direction+searchMatches.length)%searchMatches.length;goToPage(searchMatches[searchIndex]);els.searchStatus.textContent=`${(searchIndex+1).toLocaleString("ar-EG")} من ${searchMatches.length.toLocaleString("ar-EG")}`;
}

// السهم الموجود على اليمين: الرجوع للصفحات السابقة
$("prevBtn").addEventListener("click", () => {
  if (currentPage <= 1) return;

  playPageFlipSound();
  goToPage(currentPage - (isMobile() ? 1 : 2));
});


// تقليب الصفحات بالسحب بالإصبع على الموبايل
let swipeStart = null;

const bookStage = $("bookStage");

bookStage.addEventListener("pointerdown", (e) => {
  if (!isMobile() || e.pointerType !== "touch" || !e.isPrimary) return;

  if (zoom > 1.01) return;

  if (!e.target.closest(".page-sheet")) return;

  swipeStart = {
    x: e.clientX,
    y: e.clientY,
    pointerId: e.pointerId
  };
});

bookStage.addEventListener("pointerup", (e) => {
  if (!swipeStart || e.pointerId !== swipeStart.pointerId) return;

  const deltaX = e.clientX - swipeStart.x;
  const deltaY = e.clientY - swipeStart.y;

  swipeStart = null;

  // تجاهل السحب القصير أو الرأسي
  if (Math.abs(deltaX) < 55) return;
  if (Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

// السحب من اليسار إلى اليمين: الصفحة التالية
if (deltaX > 0 && currentPage < pdfDoc.numPages) {
  playPageFlipSound();
  goToPage(currentPage + 1);
}

// السحب من اليمين إلى اليسار: الصفحة السابقة
else if (deltaX < 0 && currentPage > 1) {
  playPageFlipSound();
  goToPage(currentPage - 1);
}
});

bookStage.addEventListener("pointercancel", () => {
  swipeStart = null;
});


// السهم الموجود على الشمال: الانتقال للصفحات التالية
$("nextBtn").addEventListener("click", () => {
  if (currentPage + (isMobile() ? 1 : 2) > pdfDoc.numPages) return;

  playPageFlipSound();
  goToPage(currentPage + (isMobile() ? 1 : 2));
});

$("pageForm").addEventListener("submit",e=>{e.preventDefault();goToPage(els.input.value);});


$("zoomIn").addEventListener("click", () => {
  zoom = Math.min(5, zoom + 0.1);
  renderSpread();
});

$("zoomOut").addEventListener("click", () => {
  zoom = Math.max(0.3, zoom - 0.1);
  renderSpread();
});


$("fitBtn").addEventListener("click",()=>{zoom=1;renderSpread();});
$("themeBtn").addEventListener("click",toggleTheme);

const readerApp = document.querySelector(".reader-app");

$("fullscreenBtn").addEventListener("click", async () => {

  // وضع القراءة الموسّع على الموبايل
  if (isMobile()) {
    const active = readerApp.classList.toggle("mobile-reading-mode");

    document.body.classList.toggle(
      "mobile-reading-mode-active",
      active
    );

    setTimeout(renderSpread, 100);
    return;
  }

  // ملء الشاشة الأصلي على الكمبيوتر
  try {
    if (!document.fullscreenElement) {
      await readerApp.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_) {
    notify("تعذّر تفعيل ملء الشاشة.");
  }
});

$("bookmarkBtn").addEventListener("click",()=>{
  try {
    const saved = localStorage.getItem(bookmarkKey());

    if(Number(saved) === currentPage && saved !== null){
      localStorage.removeItem(bookmarkKey());
      notify("تم إلغاء العلامة المرجعية.");
    } else {
      localStorage.setItem(bookmarkKey(),String(currentPage));
      notify("اتحفظت العلامة عند صفحة "+currentPage.toLocaleString("ar-EG"));
    }

    updateBookmarkButton();
  } catch(_) {
    notify("تعذر تحديث العلامة المرجعية على هذا الجهاز.");
  }
});

document.addEventListener("keydown", e => {
  if (e.target.matches("input")) return;

  if (e.key === "ArrowLeft") {
    goToPage(currentPage + (isMobile() ? 1 : 2));
  }

  if (e.key === "ArrowRight") {
    goToPage(currentPage - (isMobile() ? 1 : 2));
  }

  if (e.key === "+") {
    zoom = Math.min(5, zoom + 0.1);
    renderSpread();
  }

  if (e.key === "-") {
    zoom = Math.max(0.3, zoom - 0.1);
    renderSpread();
  }
});

// تحريك الصفحة بالسحب عند التكبير
document.querySelectorAll(".page-sheet").forEach((sheet) => {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;

  sheet.addEventListener("pointerdown", (e) => {
    // السحب بالماوس فقط؛ اللمس يظل بحركته الطبيعية
    if (e.pointerType !== "mouse" || e.button !== 0) return;

    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startScrollLeft = sheet.scrollLeft;
    startScrollTop = sheet.scrollTop;

    sheet.classList.add("is-dragging");
    sheet.setPointerCapture(e.pointerId);
  });

  sheet.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    sheet.scrollLeft = startScrollLeft - (e.clientX - startX);
    sheet.scrollTop = startScrollTop - (e.clientY - startY);
  });

  function stopDragging() {
    dragging = false;
    sheet.classList.remove("is-dragging");
  }

  sheet.addEventListener("pointerup", stopDragging);
  sheet.addEventListener("pointercancel", stopDragging);
  sheet.addEventListener("lostpointercapture", stopDragging);
});

let resizeTimer;
window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderSpread,160);});
try{if(localStorage.getItem("hikaya-reader-theme")==="dark")document.body.classList.add("dark");}catch(_){}

// تغيير أيقونة Fullscreen حسب حالة الشاشة
document.addEventListener("fullscreenchange", () => {
  const btn = $("fullscreenBtn");
  if (!btn) return;

  const isFullscreen = !!document.fullscreenElement;

  btn.innerHTML = isFullscreen
    ? `<svg viewBox="0 0 24 24">
         <path d="M8 3v5H3M16 3v5h5M3 16h5v5M21 16h-5v5"/>
       </svg>`
    : `<svg viewBox="0 0 24 24">
         <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>
       </svg>`;

  btn.title = isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة";
  btn.setAttribute("aria-label", btn.title);
});

preparePageFlipSound();

initReader();