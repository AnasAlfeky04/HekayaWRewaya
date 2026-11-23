
/* =========================================
   حكاية ورواية - ربط الموقع بـ Supabase
   ========================================= */

   const SUPABASE_URL = "https://aibgixalrifqbsotiogu.supabase.co";
   const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB";
   
   const db = window.supabase.createClient(
     SUPABASE_URL,
     SUPABASE_PUBLISHABLE_KEY
   );
   
   const grid = document.getElementById("bookGrid");
   const emptyMessage = document.getElementById("emptyMessage");

   document.querySelectorAll(".library-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      currentLibraryFilter = tab.dataset.filter;
  
      document.querySelectorAll(".library-tab").forEach(button => {
        button.classList.toggle("active", button === tab);
      });
  
      renderBooks();
    });
  });
   
   let allBooks = [];
   let currentLibraryFilter = "all";
   let currentUser = null;
   let currentProfile = null;
   let authBusy = false;
   
   /* ---------- أدوات مساعدة ---------- */
   
   function escapeHTML(value) {
     return String(value ?? "").replace(/[&<>"']/g, function (char) {
       return {
         "&": "&amp;",
         "<": "&lt;",
         ">": "&gt;",
         '"': "&quot;",
         "'": "&#39;"
       }[char];
     });
   }
   
   function showInfo(title, message) {
     document.getElementById("dialogTitle").textContent = title;
     document.getElementById("dialogMessage").textContent = message;
   
     const dialog = document.getElementById("infoDialog");
   
     if (typeof dialog.showModal === "function") {
       if (!dialog.open) dialog.showModal();
     } else {
       alert(title + "\n\n" + message);
     }
   }
   
   function closeInfo() {
     const dialog = document.getElementById("infoDialog");
     if (dialog.open) dialog.close();
   }
   
   function setButtonText(id, text) {
     const button = document.getElementById(id);
     if (button) button.textContent = text;
   }
   
   /* ---------- نافذة النماذج ---------- */
   
   function openForm(title, fields, submitText, onSubmit) {
     const old = document.getElementById("HekayaWRewayaFormOverlay");
     if (old) old.remove();
   
     const overlay = document.createElement("div");
     overlay.id = "HekayaWRewayaFormOverlay";
   
     overlay.style.cssText = [
       "position:fixed",
       "inset:0",
       "z-index:9999",
       "background:rgba(0,0,0,.65)",
       "display:flex",
       "align-items:center",
       "justify-content:center",
       "padding:20px"
     ].join(";");
   
     const form = document.createElement("form");
     form.style.cssText = [
       "background:#fffdf7",
       "color:#26382d",
       "width:100%",
       "max-width:420px",
       "padding:25px",
       "border-radius:16px",
       "box-sizing:border-box",
       "font-family:inherit",
       "max-height:90vh",
       "overflow:auto"
     ].join(";");
   
     const heading = document.createElement("h2");
     heading.textContent = title;
     heading.style.marginTop = "0";
     form.appendChild(heading);
   
     const error = document.createElement("p");
     error.style.cssText = "color:#b42318;font-size:14px;";
     error.hidden = true;
   
     const inputs = {};
   
     fields.forEach(function (field) {
       const wrapper = document.createElement("div");
       wrapper.style.marginBottom = "14px";
   
       const label = document.createElement("label");
       label.textContent = field.label;
       label.style.cssText = "display:block;margin-bottom:6px;font-size:14px;";
       label.htmlFor = "HekayaWRewaya-" + field.name;
   
       let input;
   
       if (field.type === "select") {
         input = document.createElement("select");
   
         field.options.forEach(function (option) {
           const optionElement = document.createElement("option");
           optionElement.value = option.value;
           optionElement.textContent = option.label;
           input.appendChild(optionElement);
         });
       } else {
         input = document.createElement("input");
         input.type = field.type || "text";
       }
   
       input.id = "HekayaWRewaya-" + field.name;
       input.name = field.name;
       input.required = field.required !== false;
       input.autocomplete = field.autocomplete || "off";
   
       input.style.cssText = [
         "width:100%",
         "box-sizing:border-box",
         "padding:11px",
         "border:1px solid #d7d8ce",
         "border-radius:8px",
         "font:inherit"
       ].join(";");
   
       if (field.minLength) input.minLength = field.minLength;
       if (field.type === "email") input.autocomplete = "email";
       if (field.name === "password") input.autocomplete = "current-password";
   
       inputs[field.name] = input;
   
       wrapper.appendChild(label);
       wrapper.appendChild(input);
       form.appendChild(wrapper);
     });
   
     form.appendChild(error);
   
     const actions = document.createElement("div");
     actions.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;";
   
     const submit = document.createElement("button");
     submit.type = "submit";
     submit.textContent = submitText;
     submit.style.cssText = [
       "background:#285b42",
       "color:white",
       "border:0",
       "padding:11px 18px",
       "border-radius:8px",
       "cursor:pointer",
       "font:inherit"
     ].join(";");
   
     const cancel = document.createElement("button");
     cancel.type = "button";
     cancel.textContent = "إلغاء";
     cancel.style.cssText = [
       "background:#e9e7dc",
       "color:#26382d",
       "border:0",
       "padding:11px 18px",
       "border-radius:8px",
       "cursor:pointer",
       "font:inherit"
     ].join(";");
   
     cancel.addEventListener("click", function () {
       overlay.remove();
     });
   
     actions.appendChild(submit);
     actions.appendChild(cancel);
     form.appendChild(actions);
     overlay.appendChild(form);
     document.body.appendChild(overlay);
   
     if (fields.length) inputs[fields[0].name].focus();
   
     form.addEventListener("submit", async function (event) {
       event.preventDefault();
   
       if (authBusy) return;
   
       error.hidden = true;
       submit.disabled = true;
       submit.textContent = "جارٍ التنفيذ...";
   
       const values = {};
   
       fields.forEach(function (field) {
         values[field.name] = inputs[field.name].value.trim();
       });
   
       try {
         authBusy = true;
         await onSubmit(values, function (message) {
           error.textContent = message;
           error.hidden = false;
         });
   
         if (overlay.isConnected) overlay.remove();
       } catch (err) {
         error.textContent = err.message || "حصل خطأ غير متوقع.";
         error.hidden = false;
       } finally {
         authBusy = false;
         if (submit.isConnected) {
           submit.disabled = false;
           submit.textContent = submitText;
         }
       }
     });
   }
   
   /* ---------- عرض حالة الحساب ---------- */
   
   async function refreshProfile() {
     const result = await db.auth.getUser();
   
     if (result.error || !result.data.user) {
       currentUser = null;
       currentProfile = null;
       updateAccountButtons();
       return;
     }
   
     currentUser = result.data.user;
   
     const profileResult = await db
       .from("profiles")
       .select("display_name, role")
       .eq("id", currentUser.id)
       .maybeSingle();
   
     currentProfile = profileResult.data || null;
     updateAccountButtons();
   }
   
   function updateAccountButtons() {
    const loginButton = document.getElementById("loginBtn");
    const accountButton = document.getElementById("signupBtn");
    const libraryButton = document.getElementById("myLibraryBtn");
  
    if (!loginButton || !accountButton) return;
  
    if (currentUser) {
      loginButton.hidden = true;
  
      accountButton.hidden = false;
      accountButton.textContent = "حسابي";
  
      if (libraryButton) {
        libraryButton.hidden = false;
      }
    } else {
      loginButton.hidden = false;
      loginButton.textContent = "تسجيل الدخول";
  
      accountButton.hidden = false;
      accountButton.textContent = "إنشاء حساب";
  
      if (libraryButton) {
        libraryButton.hidden = true;
      }
    }
  }
   
   /* ---------- إنشاء حساب ---------- */
   
   function signup() {
     openForm(
       "إنشاء حساب جديد",
       [
         {
           name: "display_name",
           label: "الاسم الظاهر",
           type: "text",
           autocomplete: "name",
           minLength: 2
         },
         {
           name: "email",
           label: "البريد الإلكتروني",
           type: "email",
           autocomplete: "email"
         },
         {
           name: "password",
           label: "كلمة المرور (8 أحرف على الأقل)",
           type: "password",
           autocomplete: "new-password",
           minLength: 8
         },
         {
           name: "account_type",
           label: "نوع الحساب",
           type: "select",
           options: [
             { value: "reader", label: "قارئ" },
             { value: "author", label: "كاتب" }
           ]
         }
       ],
       "إنشاء الحساب",
       async function (values, setError) {
         const result = await db.auth.signUp({
           email: values.email,
           password: values.password,
           options: {
             data: {
               display_name: values.display_name,
               account_type: values.account_type
             }
           }
         });
   
         if (result.error) throw result.error;
   
         if (!result.data.session) {
           showInfo(
             "راجع بريدك الإلكتروني",
             "تم إرسال طلب إنشاء الحساب. لو تأكيد البريد مفعّل في Supabase، افتح رسالة التأكيد ثم ارجع للموقع وسجّل الدخول."
           );
           return;
         }
   
         await refreshProfile();
   
         showInfo(
           "أهلًا بيك في موقع حكاية ورواية",
           "تم إنشاء الحساب بنجاح. لو اخترت حساب كاتب، هتقدر تكمل خطوات رفع الكتب حسب صلاحيات الحساب."
         );
       }
     );
   }
   
   /* ---------- تسجيل الدخول ---------- */
   
   function login() {
     openForm(
       "تسجيل الدخول",
       [
         {
           name: "email",
           label: "البريد الإلكتروني",
           type: "email",
           autocomplete: "email"
         },
         {
           name: "password",
           label: "كلمة المرور",
           type: "password",
           autocomplete: "current-password"
         }
       ],
       "دخول",
       async function (values) {
         const result = await db.auth.signInWithPassword({
           email: values.email,
           password: values.password
         });
   
         if (result.error) throw result.error;
   
         await refreshProfile();
         await loadBooks();
   
         showInfo("تم تسجيل الدخول", "أهلًا بيك في موقع حكاية ورواية.");
       }
     );
   }
   
   async function logout() {
     const result = await db.auth.signOut();
   
     if (result.error) {
       showInfo("تعذر تسجيل الخروج", result.error.message);
       return;
     }
   
     currentUser = null;
     currentProfile = null;
     updateAccountButtons();
     showInfo("تم تسجيل الخروج", "خرجت من حسابك بنجاح.");
   }



   /* =========================================
   التصنيفات الرئيسية
========================================= */

const homeCategoryGrid = document.getElementById("homeCategoryGrid");

const categoryArtwork = {
  romance: `
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M50 78S17 58 17 35C17 15 42 12 50 33C58 12 83 15 83 35C83 58 50 78 50 78Z"
        stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M50 33C46 43 39 49 31 53"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M76 13C76 18 73 21 68 21C73 21 76 24 76 29C76 24 79 21 84 21C79 21 76 18 76 13Z"
        fill="#c5a15c"/>
    </svg>
  `,

  mystery: `
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx="43" cy="42" r="23"
        stroke="currentColor" stroke-width="3"/>
      <path d="M60 59L82 81"
        stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <path d="M36 34C36 27 49 27 49 36C49 42 42 43 42 49"
        stroke="#c5a15c" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="42" cy="56" r="2" fill="#c5a15c"/>
    </svg>
  `,

  psychology: `
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M59 15C40 12 24 27 24 47C24 66 38 79 56 79H67L76 89V65C83 53 82 36 72 25"
        stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M40 43H49V34H61V46H52V57H65"
        stroke="#c5a15c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="39" cy="59" r="2" fill="currentColor"/>
    </svg>
  `,

  fantasy: `
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M25 80V42L37 31V43L50 29L63 43V31L75 42V80H25Z"
        stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M43 80V61C43 51 57 51 57 61V80"
        stroke="#c5a15c" stroke-width="2.5"/>
      <path d="M50 10L53 19L62 22L53 25L50 34L47 25L38 22L47 19L50 10Z"
        fill="#c5a15c"/>
      <path d="M18 22V30M14 26H22M82 52V60M78 56H86"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  science: `
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="12"
        stroke="#c5a15c" stroke-width="2.5"/>
      <ellipse cx="50" cy="50" rx="37" ry="15"
        stroke="currentColor" stroke-width="2.5"
        transform="rotate(-35 50 50)"/>
      <ellipse cx="50" cy="50" rx="37" ry="15"
        stroke="currentColor" stroke-width="2"
        transform="rotate(55 50 50)"/>
      <circle cx="77" cy="26" r="4" fill="#c5a15c"/>
      <circle cx="23" cy="70" r="3" fill="currentColor"/>
    </svg>
  `,

  historical: `
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M14 39L50 17L86 39H14Z"
        stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M21 43V76M39 43V76M61 43V76M79 43V76"
        stroke="currentColor" stroke-width="3"/>
      <path d="M15 80H85M10 87H90"
        stroke="#c5a15c" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M45 17V11H55V17"
        stroke="#c5a15c" stroke-width="2"/>
    </svg>
  `,

  social: `
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx="35" cy="34" r="10"
        stroke="currentColor" stroke-width="2.5"/>
      <circle cx="66" cy="34" r="10"
        stroke="currentColor" stroke-width="2.5"/>
      <path d="M15 77C15 60 23 52 35 52C47 52 54 60 54 77"
        stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M46 77C46 60 54 52 66 52C78 52 85 60 85 77"
        stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M44 18L50 12L56 18"
        stroke="#c5a15c" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `,

  horror: `
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M19 80V45L50 20L81 45V80H19Z"
        stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M42 80V59C42 48 58 48 58 59V80"
        stroke="currentColor" stroke-width="2.5"/>
      <path d="M72 13C65 20 67 31 78 34C70 38 59 31 61 21C62 14 68 10 72 13Z"
        fill="#c5a15c"/>
      <path d="M34 47L39 52M66 47L61 52"
        stroke="#c5a15c" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `,

  adventure: `
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="34"
        stroke="currentColor" stroke-width="2.5"/>
      <circle cx="50" cy="50" r="25"
        stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 4"/>
      <path d="M62 32L55 55L38 68L45 45L62 32Z"
        fill="#c5a15c" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M50 12V19M50 81V88M12 50H19M81 50H88"
        stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `,

  thriller: `
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M56 10L29 53H47L40 89L73 43H54L56 10Z"
        stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M17 23H31M12 32H24M76 70H88M72 79H84"
        stroke="#c5a15c" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `,

  other: `
    <svg viewBox="0 0 100 100" fill="none">
      <rect x="19" y="19" width="62" height="62" rx="15"
        stroke="currentColor" stroke-width="2.5"/>
      <circle cx="35" cy="50" r="4" fill="#c5a15c"/>
      <circle cx="50" cy="50" r="4" fill="currentColor"/>
      <circle cx="65" cy="50" r="4" fill="#c5a15c"/>
      <path d="M30 12V19M70 81V88M12 30H19M81 70H88"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  all: `
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M18 25C30 19 41 21 50 29C59 21 70 19 82 25V75C70 69 59 71 50 79C41 71 30 69 18 75V25Z"
        stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M50 29V79M28 36C35 34 40 36 44 39M28 47C35 45 40 47 44 50M56 39C60 36 65 34 72 36M56 50C60 47 65 45 72 47"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M76 13V23M71 18H81"
        stroke="#c5a15c" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `
};

function getCategoryArtwork(category) {
  const artworkBySlug = {
    "mystery-crime": "mystery",
    "romance": "romance",
    "psychological-thriller": "psychology",
    "fantasy": "fantasy",
    "science-fiction": "science",
    "historical-fiction": "historical",
    "social-drama": "social",
    "horror": "horror",
    "adventure": "adventure",
    "thriller": "thriller",
    "other": "other"
  };

  const artworkKey = artworkBySlug[category.slug] || "other";

  return categoryArtwork[artworkKey];
}

/* تحميل التصنيفات من Supabase */
async function loadHomeCategories() {
  if (!homeCategoryGrid) return;

  const result = await db
    .from("categories")
    .select("id, name, slug")
    .order("name");

  if (result.error) {
    console.error("Home categories error:", result.error);
    homeCategoryGrid.innerHTML =
      '<p class="category-loading">تعذر تحميل التصنيفات حاليًا.</p>';
    return;
  }

  const categories = result.data || [];

if (!categories.length) {
  homeCategoryGrid.innerHTML =
    '<p class="category-loading">لا توجد تصنيفات متاحة حاليًا.</p>';
  return;
}

// ترتيب التصنيفات: أخرى في النهاية
categories.sort(function (a, b) {
  const aIsOther = String(a.name || "").trim() === "أخرى";
  const bIsOther = String(b.name || "").trim() === "أخرى";

  if (aIsOther && !bIsOther) return 1;
  if (!aIsOther && bIsOther) return -1;
  return String(a.name || "").localeCompare(String(b.name || ""), "ar");
});

// بطاقة كل الروايات
const allBooksCard = `
  <a
    class="category-card category-all-books"
    href="/Library/library.html"
    aria-label="استكشف كل الروايات"
  >
    <span class="category-artwork" aria-hidden="true">
      <svg viewBox="0 0 100 100" fill="none">
        <path d="M18 25C30 19 41 21 50 29C59 21 70 19 82 25V75C70 69 59 71 50 79C41 71 30 69 18 75V25Z"
          stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M50 29V79M28 36C35 34 40 36 44 39M28 47C35 45 40 47 44 50M56 39C60 36 65 34 72 36M56 50C60 47 65 45 72 47"
          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M76 13V23M71 18H81"
          stroke="#c5a15c" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </span>
    <span class="category-card-name">كل الروايات</span>
    <span class="category-card-arrow" aria-hidden="true">←</span>
  </a>
`;

const categoryCards = categories.map(function (category, index) {
  const name = escapeHTML(category.name || "تصنيف");
  const slug = encodeURIComponent(category.slug || category.id);

  return `
    <a
      class="category-card category-tone-${index % 6 + 1}"
      href="/Library/library.html?category=${slug}"
      aria-label="استكشف تصنيف ${name}"
    >
      <span class="category-artwork" aria-hidden="true">
        ${getCategoryArtwork(category)}
      </span>

      <span class="category-card-name">${name}</span>

      <span class="category-card-arrow" aria-hidden="true">←</span>
    </a>
  `;
}).join("");

homeCategoryGrid.innerHTML = allBooksCard + categoryCards;
}


   
   
   /* ---------- تحميل الكتب المنشورة ---------- */
   

   async function loadBooks() {
    grid.innerHTML = "<p>جارٍ تحميل الكتب...</p>";
    emptyMessage.hidden = true;
  
    const result = await db.rpc("get_best_selling_books");

console.log("RPC error:", result.error);
console.table(
  (result.data || []).map(function (book) {
    return {
      title: book.title,
      sales_count: book.sales_count,
      price: book.price
    };
  })
);
  
    if (result.error) {
      grid.innerHTML = "";
      emptyMessage.hidden = false;
      emptyMessage.textContent =
        "تعذر تحميل الكتب. تأكد من إعدادات قاعدة البيانات.";
      console.error("Supabase best-selling books error:", result.error);
      return;
    }
  
    allBooks = (result.data || []).sort(function (a, b) {
      const salesA = Number(a.sales_count ?? 0);
      const salesB = Number(b.sales_count ?? 0);
    
      if (salesA !== salesB) {
        return salesB - salesA;
      }
    
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    
    console.table(
      allBooks.map(function (book) {
        return {
          title: book.title,
          sales: book.sales_count,
          price: book.price
        };
      })
    );
  
    const coverResults = await Promise.all(
      allBooks.map(async function (book) {
        if (!book.cover_path) return [book.id, null];
  
        const coverResult = await db.storage
          .from("book-covers")
          .createSignedUrl(book.cover_path, 3600);
  
        if (coverResult.error) {
          console.warn(
            "تعذر تحميل غلاف الكتاب:",
            book.id,
            coverResult.error
          );
          return [book.id, null];
        }
  
        return [book.id, coverResult.data.signedUrl];
      })
    );
  
    const coverMap = new Map(coverResults);
  
    allBooks = allBooks.map(function (book) {
      return {
        ...book,
        coverUrl: coverMap.get(book.id) || null,
        categoryName: book.category_name || "عام",
        authorName: book.author_name || "كاتب غير معروف"
      };
    });
  
    renderBooks();
    renderLatestBooks();
  }
   
   /* ---------- البحث والتصنيفات ---------- */
   

   function renderBooks() {
    const filteredBooks = allBooks.filter(book => {
      const price = Number(book.price ?? 0);
  
      if (currentLibraryFilter === "free") return price === 0;
      if (currentLibraryFilter === "paid") return price > 0;
  
      return true;
    });
  
    const featuredBooks = filteredBooks.slice(0, 4);
  
    if (featuredBooks.length === 0) {
      grid.innerHTML = "";
      emptyMessage.hidden = false;
      emptyMessage.textContent =
        currentLibraryFilter === "free"
          ? "لا توجد روايات مجانية متاحة حاليًا."
          : currentLibraryFilter === "paid"
          ? "لا توجد روايات مدفوعة متاحة حاليًا."
          : "لسه مفيش روايات منشورة. ارجع لنا قريبًا!";
      return;
    }
  
    emptyMessage.hidden = true;
  
    grid.innerHTML = featuredBooks.map(function (book, index) {
      const safeTitle = escapeHTML(book.title || "رواية بدون عنوان");
      const safeCategory = escapeHTML(book.categoryName || "رواية");
      const safeAuthor = escapeHTML(book.authorName || "كاتب");
  
      const price = Number(book.price ?? 0);
      const isFree = !Number.isFinite(price) || price <= 0;
  
      const priceLabel = isFree
        ? "مجاني"
        : price.toLocaleString("ar-EG", {
            maximumFractionDigits: 2
          }) + " ج.م";
  
      const cover = book.coverUrl
        ? `<img
             src="${escapeHTML(book.coverUrl)}"
             alt="غلاف ${safeTitle}"
             loading="lazy"
           >`
        : `<div class="premium-cover-placeholder">
             <span>حكاية ورواية</span>
             <strong>${safeTitle}</strong>
             <small>كتاب إلكتروني</small>
           </div>`;
  
      return `
        <article
          class="book-card premium-book-card"
          role="link"
          tabindex="0"
          data-book-id="${encodeURIComponent(book.id)}"
          aria-label="عرض تفاصيل رواية ${safeTitle}"
        >
          <div class="premium-book-cover">
            ${cover}
  
            <div class="premium-cover-shade"></div>
  
            
          </div>
  
          <div class="premium-book-info">

            <h3 class="premium-book-title">${safeTitle}</h3>

            <span class="premium-book-category">
              ${safeCategory}
            </span>
  
            <div class="premium-book-author">
              <span class="premium-author-mark">✦</span>
              <span>${safeAuthor}</span>
            </div>
  
            <div class="premium-book-divider"></div>
  
            <div class="premium-book-footer">
              <span class="premium-book-price ${isFree ? "is-free" : "is-paid"}">
                ${isFree ? "✓" : "◆"}
                ${priceLabel}
              </span>
  
              <span class="premium-book-open" aria-hidden="true">
                ←
              </span>
            </div>
          </div>
        </article>
      `;
    }).join("");
  
    grid.querySelectorAll(".premium-book-card").forEach(function (card) {
      function goToBookDetails() {
        const bookId = card.dataset.bookId;
        if (!bookId) return;
  
        window.location.href =
          "/Library/library.html?book=" + encodeURIComponent(bookId);
      }
  
      card.addEventListener("click", goToBookDetails);
  
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToBookDetails();
        }
      });
    });
  }




/* =========================================
   LATEST RELEASES - 3D CIRCULAR ORBIT
========================================= */

function renderLatestBooks() {
  const stage = document.getElementById("latestOrbitStage");

  if (!stage) return;

  const latestBooks = allBooks
    .slice()
    .sort(function (a, b) {
      return new Date(b.created_at || 0) -
             new Date(a.created_at || 0);
    })
    .slice(0, 8);

  if (!latestBooks.length) {
    stage.innerHTML = `
      <p style="
        position:absolute;
        top:50%;
        left:50%;
        transform:translate(-50%,-50%);
        color:#737d76;
        white-space:nowrap;
        direction:rtl;
      ">
        لا توجد روايات منشورة حاليًا.
      </p>
    `;
    return;
  }

  stage.innerHTML = latestBooks.map(function (book) {
    const safeTitle = escapeHTML(book.title || "رواية بدون عنوان");
    const safeCategory = escapeHTML(book.categoryName || "رواية");
    const safeAuthor = escapeHTML(book.authorName || "كاتب");

    const price = Number(book.price ?? 0);
    const isFree = Number.isFinite(price) && price <= 0;

    const priceLabel = isFree
      ? "مجاني"
      : price.toLocaleString("ar-EG", {
          maximumFractionDigits: 2
        }) + " ج.م";

    const cover = book.coverUrl
      ? `<img
           src="${escapeHTML(book.coverUrl)}"
           alt="غلاف ${safeTitle}"
           loading="eager"
         >`
      : `<div class="latest-orbit-placeholder">
           <span>حكاية ورواية</span>
           <strong>${safeTitle}</strong>
           <small>كتاب إلكتروني</small>
         </div>`;

    return `
      <article
        class="latest-orbit-card"
        role="link"
        tabindex="0"
        data-book-id="${encodeURIComponent(book.id)}"
        aria-label="عرض رواية ${safeTitle}"
      >
        <div class="latest-orbit-cover">
          ${cover}

          <div class="latest-orbit-cover-shade"></div>
        </div>

        <div class="latest-orbit-info">

          <h3 class="latest-orbit-title">${safeTitle}</h3>

          <span class="latest-orbit-category">
            ${safeCategory}
          </span>

          <div class="latest-orbit-author">
            <span class="latest-orbit-author-mark">✦</span>
            <span>${safeAuthor}</span>
          </div>

          <div class="latest-orbit-divider"></div>

          <div class="latest-orbit-footer">
            <span class="latest-orbit-price ${isFree ? "is-free" : "is-paid"}">
              ${isFree ? "✓" : "◆"}
              ${priceLabel}
            </span>

            <span class="latest-orbit-open" aria-hidden="true">←</span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // فتح الرواية عند الضغط عليها
stage.onclick = function (event) {
  const card =
    stage._latestOrbitPressedCard ||
    event.target.closest(".latest-orbit-card");

  stage._latestOrbitPressedCard = null;

  if (!card || !stage.contains(card)) return;

  const bookId = card.dataset.bookId;
  if (!bookId) return;

  window.location.href =
    "/Library/library.html?book=" + encodeURIComponent(bookId);
};

// دعم فتح الرواية بلوحة المفاتيح
stage.querySelectorAll(".latest-orbit-card").forEach(function (card) {
  card.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      const bookId = card.dataset.bookId;
      if (!bookId) return;

      window.location.href =
        "/Library/library.html?book=" + encodeURIComponent(bookId);
    }
  });
});

  initLatestOrbit();
}



/* الحركة الدائرية ثلاثية الأبعاد مع التحكم بالسحب */
function initLatestOrbit() {
  const stage = document.getElementById("latestOrbitStage");

  if (!stage) return;

  if (stage._latestOrbitFrame) {
    cancelAnimationFrame(stage._latestOrbitFrame);
  }

  if (stage._latestOrbitObserver) {
    stage._latestOrbitObserver.disconnect();
  }

  const cards = Array.from(
    stage.querySelectorAll(".latest-orbit-card")
  );

  const count = cards.length;

  if (!count) return;

  let phase = 0;
  let lastTime = 0;
  let animationFrame = null;

  // حالات السحب
  let isDragging = false;
  let hasDragged = false;
  let dragStartX = 0;
  let lastPointerX = 0;
  let activePointerId = null;
  let resumeAt = 0;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  function getRadiusX() {
    const width = stage.clientWidth;
  
    if (window.innerWidth <= 700) {
      return Math.max(width * 0.62, 210);
    }
  
    return Math.max(1, Math.min(width * 0.43, 470));
  }

  function positionCards() {
    const radiusX = getRadiusX();

    cards.forEach(function (card, index) {
      const angle =
        phase + (index * Math.PI * 2 / count);

      const depth = Math.cos(angle);
      const x = Math.sin(angle) * radiusX;
      const y = 0;

      const scale = 0.70 + ((depth + 1) / 2) * 0.30;
      const opacity = 0.48 + ((depth + 1) / 2) * 0.52;

      const tilt = -Math.sin(angle) * (
        window.innerWidth <= 700 ? 24 : 24
      );

      card.style.zIndex = String(
        Math.round((depth + 1) * 100)
      );

      card.style.opacity = opacity;

      card.style.transform =
        `translate(-50%, -50%) ` +
        `translate3d(${x}px, ${y}px, ${depth * 120}px) ` +
        `rotateY(${tilt}deg) ` +
        `scale(${scale})`;
    });
  }

  /* بداية السحب */
  function startDragging(event) {
    if (!event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
  
    // الاحتفاظ بالرواية التي بدأ المستخدم الضغط عليها
    stage._latestOrbitPressedCard =
      event.currentTarget.closest(".latest-orbit-card");
  
    activePointerId = event.pointerId;
  
    dragStartX = event.clientX;
    lastPointerX = event.clientX;
  
    isDragging = true;
    hasDragged = false;
  
    stage._latestOrbitSuppressClick = false;
  
    try {
      stage.setPointerCapture(event.pointerId);
    } catch (error) {
      console.warn("Pointer capture unavailable:", error);
    }
  }
  
  // استقبال الضغط مباشرة من كل كارت
  cards.forEach(function (card) {
    card.onpointerdown = startDragging;
  });

  /* تحريك الروايات مع الماوس أو الإصبع */
  stage.onpointermove = function (event) {
    if (!isDragging || event.pointerId !== activePointerId) return;

    const deltaX = event.clientX - lastPointerX;
    lastPointerX = event.clientX;

    if (!hasDragged) {
      const totalDelta = event.clientX - dragStartX;

      if (Math.abs(totalDelta) <= 6) return;

      hasDragged = true;
      stage.classList.add("is-dragging");

      phase += totalDelta / getRadiusX();
      positionCards();

      return;
    }

    phase += deltaX / getRadiusX();
    positionCards();
  };

  /* انتهاء السحب */
  function finishDragging(event) {
    if (!isDragging) return;
    if (event.pointerId !== activePointerId) return;

    isDragging = false;

    stage.classList.remove("is-dragging");

    stage._latestOrbitSuppressClick = hasDragged;

    // لو المستخدم سحب، نستنى ثانيتين قبل استئناف الدوران
    resumeAt = hasDragged
      ? performance.now() + 2000
      : performance.now();

    activePointerId = null;
    hasDragged = false;
  }

  stage.onpointerup = finishDragging;
  stage.onpointercancel = finishDragging;

  /* منع فتح الرواية بالخطأ بعد السحب */
  if (stage._latestOrbitClickGuard) {
    stage.removeEventListener(
      "click",
      stage._latestOrbitClickGuard,
      true
    );
  }

  stage._latestOrbitClickGuard = function (event) {
    if (!stage._latestOrbitSuppressClick) return;

    stage._latestOrbitSuppressClick = false;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  stage.addEventListener(
    "click",
    stage._latestOrbitClickGuard,
    true
  );

  /* الحركة التلقائية */
  function animate(time) {
    if (!lastTime) lastTime = time;

    const delta = Math.min((time - lastTime) / 1000, 0.04);
    lastTime = time;

    if (!isDragging && time >= resumeAt) {
      // سرعة ثابتة واتجاه الحركة من اليسار إلى اليمين
      phase += delta * 0.15;
    }

    positionCards();

    animationFrame = requestAnimationFrame(animate);
    stage._latestOrbitFrame = animationFrame;
  }

  positionCards();

  const resizeObserver = new ResizeObserver(function () {
    positionCards();
  });

  resizeObserver.observe(stage);
  stage._latestOrbitObserver = resizeObserver;

  if (!reducedMotion) {
    animationFrame = requestAnimationFrame(animate);
    stage._latestOrbitFrame = animationFrame;
  }
}




   
   /* ---------- قارئ الكتب ---------- */
   
   function openBook(book) {
     if (!currentUser) {
       showInfo(
         "سجّل الدخول أولًا",
         "علشان تقرأ الكتب، لازم تسجّل الدخول أو تنشئ حسابًا مجانيًا."
       );
       login();
       return;
     }
   
     showReaderMessage(
       "جارٍ فتح الكتاب...",
       "بنجهز رابط القراءة الآمن. استنى لحظات."
     );
   
     getBookUrl(book.id);
   }
   
   function getReaderDialog() {
     let dialog = document.getElementById("bookReaderDialog");
   
     if (dialog) return dialog;
   
     dialog = document.createElement("dialog");
     dialog.id = "bookReaderDialog";
     dialog.style.cssText = [
       "width:min(1000px,94vw)",
       "height:85vh",
       "padding:12px",
       "border:0",
       "border-radius:14px",
       "box-sizing:border-box",
       "background:#fffdf7"
     ].join(";");
   
     dialog.innerHTML = `
       <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
         <h2 id="bookReaderTitle" style="margin:0;font-size:18px;">قارئ حكاية ورواية</h2>
         <button type="button" id="closeBookReader"
           style="padding:8px 12px;border:0;border-radius:8px;cursor:pointer;">
           إغلاق
         </button>
       </div>
       <p id="bookReaderStatus">جارٍ التحميل...</p>
       <iframe id="bookReaderFrame" title="قارئ الكتب"
         style="display:none;width:100%;height:calc(100% - 55px);border:0;"
         referrerpolicy="no-referrer"></iframe>
     `;
   
     document.body.appendChild(dialog);
   
     dialog.querySelector("#closeBookReader").addEventListener("click", function () {
       dialog.querySelector("#bookReaderFrame").src = "about:blank";
       dialog.close();
     });
   
     return dialog;
   }
   
   function showReaderMessage(title, message) {
     const dialog = getReaderDialog();
   
     dialog.querySelector("#bookReaderTitle").textContent = title;
     dialog.querySelector("#bookReaderStatus").textContent = message;
     dialog.querySelector("#bookReaderStatus").style.display = "block";
     dialog.querySelector("#bookReaderFrame").style.display = "none";
   
     if (!dialog.open) dialog.showModal();
   }
   
   async function getBookUrl(bookId) {
     const dialog = getReaderDialog();
   
     const result = await db.functions.invoke("get-book-url", {
       body: { book_id: bookId }
     });
   
     if (result.error || !result.data || !result.data.url) {
       console.error("Book reader error:", result.error || result.data);
   
       dialog.querySelector("#bookReaderStatus").textContent =
         "تعذر فتح الكتاب. تأكد من تسجيل الدخول ومن أن الكتاب منشور وملفه موجود.";
       return;
     }
   
     dialog.querySelector("#bookReaderStatus").style.display = "none";

     const frame = dialog.querySelector("#bookReaderFrame");
     frame.style.display = "block";
     frame.src = result.data.url;
     
     // تسجيل قراءة الرواية لحساب الأكثر قراءة
     const readResult = await db.rpc("record_book_read", {
       p_book_id: bookId
     });
     
     if (readResult.error) {
       console.error("Book read tracking error:", readResult.error);
     }
   }
   
   /* ---------- مساحة الكُتّاب ---------- */
   
   
async function authorArea() {
  // لو المستخدم مش مسجل الدخول
  if (!currentUser) {
    window.location.href = "/Auth/auth.html?mode=signup";
    return;
  }

  // نتأكد إن بيانات الحساب محمّلة
  if (!currentProfile) {
    await refreshProfile();
  }

  // لو بيانات الحساب لسه مش موجودة
  if (!currentProfile) {
    showInfo(
      "تعذر تحميل بيانات حسابك. سجّل الخروج وحاول تسجيل الدخول مرة أخرى."
    );
    return;
  }

  const role = String(currentProfile.role || "").toLowerCase();

  // لو المستخدم كاتب بالفعل
  if (role === "author") {
    window.location.href = "/Author Dashboard/author-dashboard.html";
    return;
  }

  // لو المستخدم أدمن
  if (role === "admin") {
    showInfo("أنت مسجل الدخول بالفعل بحساب الإدارة.");
    return;
  }

  // لو المستخدم قارئ، نفتح صفحة الملف الشخصي
  if (role === "reader") {
    window.location.href = "/Profile/profile.html?notice=become-author";
    return;
  }

  // أي نوع حساب غير معروف
  showInfo("تعذر تحديد نوع حسابك. حاول تحديث الصفحة.");
}

      
   
   document.getElementById("loginBtn").addEventListener("click", function () {
    window.location.href = "/Auth/auth.html?mode=login";
  });

document.getElementById("signupBtn").addEventListener("click", function () {
  if (currentUser) {
    window.location.href = "/Profile/profile.html";
  } else {
    window.location.href = "/Auth/auth.html?mode=signup";
  }
});
   
   
const authorButtons = [
  document.getElementById("authorBtn"),
  document.getElementById("aboutAuthorBtn")
];

authorButtons.forEach(function (button) {
  if (button) {
    button.addEventListener("click", authorArea);
  }
});

   
   document.getElementById("closeDialog").addEventListener("click", closeInfo);
   document.getElementById("dialogOk").addEventListener("click", closeInfo);
   
   document.getElementById("year").textContent = new Date().getFullYear();
   
   /* ---------- بدء الموقع ---------- */
   
   db.auth.onAuthStateChange(function (event, session) {
    currentUser = session ? session.user : null;
  
    if (event === "SIGNED_OUT") {
      currentProfile = null;
    }
  
    updateAccountButtons();
  
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      setTimeout(async function () {
        await refreshProfile();
      }, 0);
    }
  });


/* =========================================
   HOME STATISTICS - SUPABASE RPC
========================================= */

async function loadHomeStats() {
  const elements = {
    books: document.getElementById("statBooks"),
    readers: document.getElementById("statReaders"),
    authors: document.getElementById("statAuthors")
  };

  if (!elements.books || !elements.readers || !elements.authors) return;

  const { data, error } = await db.rpc("get_home_stats");

  if (error) {
    console.error("Home statistics error:", error);
    return;
  }

  const stats = data?.[0];

  if (!stats) return;

  elements.books.textContent =
    Number(stats.books_count || 0).toLocaleString("en-US");

  elements.readers.textContent =
    Number(stats.readers_count || 0).toLocaleString("en-US");

  elements.authors.textContent =
    Number(stats.authors_count || 0).toLocaleString("en-US");
}



// =========================================
// HERO - RANDOM PUBLISHED BOOKS
// =========================================

async function loadHeroBooks() {
  const heroBooks = document.getElementById("heroBooks");

  if (!heroBooks) return;

  try {
    // تحميل جميع الروايات المنشورة التي لديها غلاف
    const { data, error } = await db
      .from("books")
      .select("id, title, cover_path")
      .eq("status", "published");

    if (error) throw error;

    const candidates = (data || []).filter(function (book) {
      return book.id && book.title && book.cover_path;
    });

    // خلط الروايات عشوائيًا
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [candidates[i], candidates[j]] = [
        candidates[j],
        candidates[i]
      ];
    }

    // اختيار 3 روايات
    const selectedBooks = candidates.slice(0, 3);

    if (!selectedBooks.length) {
      heroBooks.textContent = "لا توجد روايات متاحة حاليًا.";
      return;
    }

    // إنشاء روابط آمنة للأغلفة
    const booksWithCovers = await Promise.all(
      selectedBooks.map(async function (book) {
        const { data: coverData, error: coverError } = await db.storage
          .from("book-covers")
          .createSignedUrl(book.cover_path, 3600);

        if (coverError || !coverData?.signedUrl) {
          console.warn(
            "تعذر تحميل غلاف الرواية:",
            book.id,
            coverError
          );

          return null;
        }

        return {
          ...book,
          coverUrl: coverData.signedUrl
        };
      })
    );

    const validBooks = booksWithCovers.filter(Boolean);

    // إزالة رسالة التحميل
    heroBooks.replaceChildren();

    if (!validBooks.length) {
      heroBooks.textContent = "تعذر تحميل أغلفة الروايات حاليًا.";
      return;
    }

    // عرض الأغلفة
    validBooks.forEach(function (book, index) {
      const link = document.createElement("a");

      link.className = "hero-book";
      link.style.position = "absolute";
      link.style.zIndex = index === 1 ? "9999" : index === 0 ? "1" : "2";
      link.href =
        "/Library/library.html?book=" +
        encodeURIComponent(book.id);

      link.setAttribute(
        "aria-label",
        "عرض رواية " + book.title
      );

      const cover = document.createElement("img");

      cover.src = book.coverUrl;
      cover.alt = "غلاف رواية " + book.title;
      cover.loading = "eager";
      cover.decoding = "async";

      const shade = document.createElement("span");
      shade.className = "hero-book-shade";

      const title = document.createElement("span");
      title.className = "hero-book-title";
      title.textContent = book.title;

      shade.appendChild(title);
      link.appendChild(cover);
      link.appendChild(shade);

      heroBooks.appendChild(link);
    });

  } catch (error) {
    console.error("Hero books loading error:", error);
    heroBooks.textContent = "تعذر تحميل الروايات حاليًا.";
  }
}


   
async function startApp() {
  await refreshProfile();

  await Promise.all([
    loadBooks(),
    loadHomeCategories(),
    loadHomeStats(),
    loadHeroBooks()
  ]);
}

   
/* التمرير السلس لروابط الهيدر فقط */
document.querySelectorAll('.navbar nav a[href^="#"]').forEach(function (link) {
  link.addEventListener("click", function (event) {
    const targetId = this.getAttribute("href");
    const target = document.querySelector(targetId);

    if (!target) return;

    event.preventDefault();

    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    history.replaceState(null, "", targetId);
  });
});



function initFloatingStatsLogos() {
  const container = document.querySelector(".stats-floating-logos");

  if (!container) return;

  const logos = container.querySelectorAll(".stats-floating-logo");

  logos.forEach((logo, index) => {
    if (index !== 0) logo.remove();
  });

  const logo = logos[0];
  if (!logo) return;

  let startTime = null;

  function animate(time) {
    if (!startTime) startTime = time;

    const elapsed = (time - startTime) / 1000;

    const isMobile = window.innerWidth <= 600;

    const baseX = isMobile ? -50 : 0;
    const baseY = isMobile ? -35 : 0;

    const x = Math.sin(elapsed * 0.7) * 5;
    const y = Math.sin(elapsed * 0.9 + 1.2) * 5;
    const rotation = Math.sin(elapsed * 0.6) * 2;

    logo.style.transform = `
      translate3d(${baseX + x}px, ${baseY + y}px, 0)
      rotate(${rotation}deg)
    `;

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}






/* =========================================
   Opening Book Intro Controller
========================================= */



(function initOpeningBookIntro() {
  const introOverlay = document.getElementById("introBookOverlay");

  if (!introOverlay) return;

  let alreadyShown = false;

  try {
    alreadyShown = sessionStorage.getItem("hikayaIntroShown") === "1";
  } catch (error) {}

  if (alreadyShown) {
    introOverlay.remove();
    return;
  }

  try {
    sessionStorage.setItem("hikayaIntroShown", "1");
  } catch (error) {}

  // Hide scrollbar during the entire intro

  introOverlay.classList.add("is-active");

  // Keep the cover visible for 2.5 seconds
  setTimeout(() => {
    introOverlay.classList.add("is-opening");
  }, 2500);

  // Finish opening animation
  setTimeout(() => {
    introOverlay.classList.add("is-hidden");

    // Remove cover, then restore scrollbar
    setTimeout(() => {
      
      introOverlay.remove();

    }, 400);

  }, 4000);
})();






initFloatingStatsLogos();

startApp();