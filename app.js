
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
   
   let allBooks = [];
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
  }
   
   /* ---------- البحث والتصنيفات ---------- */
   

   function renderBooks() {
    const featuredBooks = allBooks.slice(0, 4);
  
    if (featuredBooks.length === 0) {
      grid.innerHTML = "";
      emptyMessage.hidden = false;
      emptyMessage.textContent =
        "لسه مفيش روايات منشورة. ارجع لنا قريبًا!";
      return;
    }
  
    emptyMessage.hidden = true;
  
    grid.innerHTML = featuredBooks.map(function (book, index) {
      const coverClass = "cover-" + ((index % 4) + 1);
      const safeTitle = escapeHTML(book.title);
      const safeCategory = escapeHTML(book.categoryName);
      const safeAuthor = escapeHTML(book.authorName);
  
      const price = Number(book.price);
      const priceLabel =
        Number.isFinite(price) && price > 0
          ? price.toLocaleString("ar-EG", {
              maximumFractionDigits: 2
            }) + " ج.م"
          : "مجاني";
  
      const cover = book.coverUrl
        ? `<img src="${escapeHTML(book.coverUrl)}"
                 alt="غلاف ${safeTitle}"
                 loading="lazy"
                 style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`
        : `<small>مكتبة حكاية ورواية</small>
           <strong>${safeTitle}</strong>
           <span>كتاب إلكتروني</span>`;
  
      return `
      <article
      class="book-card"
      role="link"
      tabindex="0"
      data-book-id="${encodeURIComponent(book.id)}"
      aria-label="عرض تفاصيل رواية ${safeTitle}"
    >
          <div class="cover ${coverClass}">
            ${cover}
          </div>
  
          <div class="book-meta">
            <h3>${safeTitle}</h3>
            <p>${safeCategory}</p>
  
            <div class="book-bottom">
              <span class="book-author">
                <span class="author-icon" aria-hidden="true">✍</span>
                ${safeAuthor}
              </span>
              <span class="book-price">${priceLabel}</span>
            </div>
          </div>
        </article>
      `;
    }).join("");

    grid.querySelectorAll(".book-card").forEach(function (card) {
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
   
   async function startApp() {
     await refreshProfile();
     await loadBooks();
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

   
   startApp();