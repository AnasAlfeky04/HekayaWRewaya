
   (() => {
    "use strict";
  
    // -------------------------------------------------------
    // 1. إعداد Supabase
    // -------------------------------------------------------
  
    const SUPABASE_URL =
      "https://aibgixalrifqbsotiogu.supabase.co";
  
    const SUPABASE_KEY =
      "sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB";
  
    const db = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );
  



let sessionExpiredRedirecting = false;

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" && !sessionExpiredRedirecting) {
    sessionExpiredRedirecting = true;

    showMessage(
      "انتهت صلاحية جلسة تسجيل الدخول. يُرجى تسجيل الدخول مرة أخرى للمتابعة.",
      "error"
    );

    setTimeout(() => {
      window.location.replace("/Auth/auth.html?mode=login");
    }, 2500);
  }
});



    const $ = (id) => document.getElementById(id);
  
    let currentUser = null;
    let currentProfile = null;
    let allBooks = [];
    let bookOwnerCounts = new Map();
    let categories = [];
    let activeConfirmAction = null;
    let uploading = false;
    let editing = false;
    let pageMessageTimer = null;
    let coverObjectUrl = null;
  
    const MAX_COVER_SIZE = 2 * 1024 * 1024;
    const MAX_PDF_SIZE = 20 * 1024 * 1024;
  
    const ALLOWED_COVER_TYPES = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];
  
    // -------------------------------------------------------
    // 2. أدوات مساعدة
    // -------------------------------------------------------
  
    function escapeHTML(value = "") {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    }
  
    function formatDate(value) {
      if (!value) return "غير محدد";
  
      const date = new Date(value);
  
      if (Number.isNaN(date.getTime())) {
        return "غير محدد";
      }
  
      return date.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
  
    function getStatusInfo(status) {
      const statuses = {
        published: {
          label: "منشورة",
          className: "status-published"
        },
        pending: {
          label: "قيد المراجعة",
          className: "status-pending"
        },
        rejected: {
          label: "مرفوضة",
          className: "status-rejected"
        }
      };
  
      return statuses[status] || {
        label: status || "غير محددة",
        className: "status-other"
      };
    }
  
    function showMessage(message, type = "info") {
      const element = $("pageMessage");
  
      if (!element) {
        console[type === "error" ? "error" : "log"](message);
        return;
      }
  
      clearTimeout(pageMessageTimer);
  
      element.className = `page-message ${type}`;
      element.textContent = message;
      element.hidden = false;
  
      if (typeof element.scrollIntoView === "function") {
        element.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
  
      pageMessageTimer = setTimeout(() => {
        element.hidden = true;
      }, 7000);
    }
  
    function setBusy(button, busy, busyText = "جاري التنفيذ...") {
      if (!button) return;
  
      if (busy) {
        if (!button.dataset.originalHtml) {
          button.dataset.originalHtml = button.innerHTML;
        }
  
        button.disabled = true;
        button.textContent = busyText;
      } else {
        button.disabled = false;
  
        if (button.dataset.originalHtml) {
          button.innerHTML = button.dataset.originalHtml;
          delete button.dataset.originalHtml;
        }
      }
    }
  
    function makeBookId() {
      if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
      ) {
        return window.crypto.randomUUID();
      }
  
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        (char) => {
          const random = Math.random() * 16 | 0;
          const value = char === "x"
            ? random
            : (random & 0x3 | 0x8);
  
          return value.toString(16);
        }
      );
    }
  
    function getFileExtension(file) {
      const parts = file.name.split(".");
  
      return parts.length > 1
        ? parts.pop().toLowerCase()
        : "";
    }
  
    function getCoverPath(book) {
      return book.cover_path || "";
    }
  
    function getBookById(bookId) {
      return allBooks.find(
        (book) => String(book.id) === String(bookId)
      );
    }
  
    function getStorageErrorMessage(error, operation) {
      const message = error && error.message
        ? error.message
        : "خطأ غير معروف";
  
      return `${operation}: ${message}`;
    }
  
    // -------------------------------------------------------
    // 3. نافذة التأكيد
    // -------------------------------------------------------
  
    function openConfirm({
      title = "تأكيد العملية",
      text = "هل أنت متأكد؟",
      confirmText = "تأكيد",
      action
    }) {
      $("confirmTitle").textContent = title;
      $("confirmText").textContent = text;
      $("confirmAccept").textContent = confirmText;
  
      activeConfirmAction = action;
      $("confirmOverlay").hidden = false;
  
      $("confirmAccept").focus();
    }
  
    function closeConfirm() {
      $("confirmOverlay").hidden = true;
      activeConfirmAction = null;
    }
  
    $("confirmCancel").addEventListener("click", closeConfirm);
  
    $("confirmOverlay").addEventListener("click", (event) => {
      if (event.target === $("confirmOverlay")) {
        closeConfirm();
      }
    });
  
    $("confirmAccept").addEventListener("click", async () => {
      if (!activeConfirmAction) return;
  
      const action = activeConfirmAction;
      activeConfirmAction = null;
  
      const button = $("confirmAccept");
  
      setBusy(button, true, "جاري التنفيذ...");
  
      try {
        await action();
      } catch (error) {
        console.error("Confirmation action error:", error);
  
        showMessage(
          error.message || "حصل خطأ أثناء تنفيذ العملية.",
          "error"
        );
      } finally {
        setBusy(button, false);
        closeConfirm();
      }
    });
  
    // -------------------------------------------------------
    // 4. بيانات الحساب
    // -------------------------------------------------------
  

    async function loadCurrentUser() {
      function isSessionExpired(error) {
        const message = (error?.message || "").toLowerCase();
        const code = (error?.code || "").toLowerCase();
    
        return (
          message.includes("jwt expired") ||
          message.includes("token expired") ||
          message.includes("session expired") ||
          message.includes("refresh token") ||
          message.includes("invalid jwt") ||
          code.includes("token_expired")
        );
      }
    
      function redirectToLogin(message) {
        showMessage(message, "error");
    
        setTimeout(() => {
          window.location.replace("/Auth/auth.html?mode=login");
        }, 2500);
    
        return false;
      }
    
      const {
        data: { user },
        error
      } = await db.auth.getUser();
    
      if (error) {
        console.error("Author authentication failed:", error);
    
        if (isSessionExpired(error)) {
          return redirectToLogin(
            "انتهت صلاحية جلسة تسجيل الدخول. يُرجى تسجيل الدخول مرة أخرى للمتابعة."
          );
        }
    
        return redirectToLogin(
          "تعذر التحقق من جلسة تسجيل الدخول. يُرجى تسجيل الدخول مرة أخرى."
        );
      }
    
      if (!user) {
        return redirectToLogin(
          "يجب تسجيل الدخول أولًا للوصول إلى مساحة الكاتب."
        );
      }
    
      currentUser = user;
    
      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("id, display_name, role, avatar_path")
        .eq("id", currentUser.id)
        .maybeSingle();
    
      if (profileError) {
        console.error("Author profile verification failed:", profileError);
    
        if (isSessionExpired(profileError)) {
          return redirectToLogin(
            "انتهت صلاحية جلسة تسجيل الدخول. يُرجى تسجيل الدخول مرة أخرى للمتابعة."
          );
        }
    
        showMessage(
          "تعذر تحميل بيانات حسابك حاليًا. يُرجى المحاولة مرة أخرى.",
          "error"
        );
    
        return false;
      }
    
      if (!profile) {
        showMessage(
          "تعذر العثور على بيانات حسابك. يُرجى التواصل مع إدارة المنصة.",
          "error"
        );
    
        return false;
      }
    
      if (profile.role !== "author") {
        showMessage(
          "هذه الصفحة مخصصة لحسابات الكُتّاب فقط. سيتم تحويلك إلى صفحة حسابك.",
          "error"
        );
    
        setTimeout(() => {
          window.location.replace("/Profile/profile.html");
        }, 1800);
    
        return false;
      }
    
      currentProfile = profile;
    
      const name = profile.display_name || "كاتب حكاية ورواية";
    
      $("sidebarName").textContent = name;
      $("welcomeName").textContent = name;
      $("currentYear").textContent = new Date().getFullYear();
    
      const firstLetter = name.trim().charAt(0) || "ك";
    
      $("sidebarAvatar").textContent = firstLetter;
      $("sidebarAvatar").style.backgroundImage = "";
    
      if (profile.avatar_path) {
        const { data } = db.storage
          .from("avatars")
          .getPublicUrl(profile.avatar_path);
    
        if (data && data.publicUrl) {
          $("sidebarAvatar").style.backgroundImage =
            `url("${data.publicUrl}")`;
    
          $("sidebarAvatar").textContent = "";
        }
      }
    
      return true;
    }
    
  
    // -------------------------------------------------------
    // 5. تحميل التصنيفات
    // -------------------------------------------------------
  
    async function loadCategories() {
      const select = $("bookCategory");
  
      if (select) {
        select.innerHTML =
          '<option value="">جاري تحميل التصنيفات...</option>';
      }
  
      const { data, error } = await db
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true });
  
      if (error) {
        console.error("Categories error:", error);
  
        if (select) {
          select.innerHTML =
            '<option value="">تعذر تحميل التصنيفات</option>';
        }
  
        throw new Error(
          "تعذر تحميل التصنيفات. راجع جدول categories وصلاحيات القراءة."
        );
      }
  
      categories = data || [];
  
      if (!select) return;
  
      if (!categories.length) {
        select.innerHTML =
          '<option value="">لا توجد تصنيفات متاحة</option>';
  
        return;
      }
  
      select.innerHTML =
        '<option value="">اختر تصنيف الرواية</option>' +
        categories.map((category) => `
          <option value="${escapeHTML(category.id)}">
            ${escapeHTML(category.name)}
          </option>
        `).join("");
    }
  
    function buildCategoryOptions(selectedId) {
      return `
        <option value="">اختر تصنيف الرواية</option>
        ${categories.map((category) => `
          <option
            value="${escapeHTML(category.id)}"
            ${String(category.id) === String(selectedId) ? "selected" : ""}
          >
            ${escapeHTML(category.name)}
          </option>
        `).join("")}
      `;
    }
  
    // -------------------------------------------------------
    // 6. تحميل روايات الكاتب
    // -------------------------------------------------------
  
    async function loadMyBooks() {
      $("booksLoading").hidden = false;
      $("booksGrid").hidden = true;
      $("booksEmpty").hidden = true;
      $("noSearchResults").hidden = true;
  
      try {
        const { data, error } = await db
          .from("books")
          .select(`
            id,
            author_id,
            category_id,
            title,
            description,
            cover_path,
            file_path,
            status,
            price,
            rejection_reason,
            created_at
          `)
          .eq("author_id", currentUser.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false });
  
        if (error) throw error;
  
        allBooks = data || [];

// تحديد الروايات المنشورة.
const bookIds = allBooks
  .filter((book) => book.status === "published")
  .map((book) => book.id);

// تحميل عدد القراء الذين يمتلكون كل رواية منشورة.
await loadBookOwnerCounts(bookIds);

// تحميل آخر مراجعة لكل رواية منشورة.


if (bookIds.length > 0) {
  const { data: revisions, error: revisionsError } = await db
    .from("book_revisions")
    .select(`
      id,
      book_id,
      status,
      rejection_reason,
      submitted_at
    `)
    .in("book_id", bookIds)
    .order("submitted_at", { ascending: false });

  if (revisionsError) throw revisionsError;

  const latestRevisionByBook = new Map();

  for (const revision of revisions || []) {
    if (!latestRevisionByBook.has(String(revision.book_id))) {
      latestRevisionByBook.set(String(revision.book_id), revision);
    }
  }

  allBooks = allBooks.map((book) => ({
    ...book,
    latestRevision: latestRevisionByBook.get(String(book.id)) || null
  }));
}

updateStatistics();
await renderBooks();
  
      } catch (error) {
        console.error("Load books error:", error);
  
        $("booksGrid").innerHTML = "";
        $("booksGrid").hidden = true;
        $("booksEmpty").hidden = true;
        $("noSearchResults").hidden = true;
  
        showMessage(
          "تعذر تحميل رواياتك. راجع اتصال Supabase وسياسات القراءة RLS.",
          "error"
        );
  
        // مهم: نعيد الخطأ حتى يستطيع زر التحديث اكتشاف الفشل.
        throw error;
  
      } finally {
        $("booksLoading").hidden = true;
      }
    }


    async function loadBookOwnerCounts(bookIds) {
      bookOwnerCounts = new Map();
    
      if (!bookIds || bookIds.length === 0) return;
    
      const { data, error } = await db.rpc("get_book_owner_counts", {
        p_book_ids: bookIds
      });
    
      if (error) {
        console.error("Book owner counts error:", error);
        return;
      }
    
      (data || []).forEach((item) => {
        bookOwnerCounts.set(
          String(item.book_id),
          Number(item.owner_count) || 0
        );
      });
    }

  
    function updateStatistics() {
        $("totalBooks").textContent = allBooks.length;
      
        $("publishedBooks").textContent =
          allBooks.filter(
            (book) => book.status === "published"
          ).length;
      
        $("pendingBooks").textContent =
          allBooks.filter(
            (book) => book.status === "pending"
          ).length;
      
        $("rejectedBooks").textContent =
          allBooks.filter(
            (book) =>
              book.status === "rejected" ||
              book.latestRevision?.status === "rejected"
          ).length;
      }
  
    // -------------------------------------------------------
    // 7. عرض البطاقات والبحث والفلترة
    // -------------------------------------------------------
  
    async function getCoverUrl(path) {
      if (!path) return null;
  
      const { data, error } = await db.storage
        .from("book-covers")
        .createSignedUrl(path, 3600);
  
      if (error) {
        console.warn("Cover signed URL error:", error);
        return null;
      }
  
      return data && data.signedUrl
        ? data.signedUrl
        : null;
    }
  
    async function renderBooks() {
      const searchTerm = $("bookSearch").value
        .trim()
        .toLocaleLowerCase();
  
      const statusFilter = $("statusFilter").value;
  
      const filteredBooks = allBooks.filter((book) => {
        const matchesSearch = String(book.title || "")
          .toLocaleLowerCase()
          .includes(searchTerm);
  
        const matchesStatus =
          statusFilter === "all" ||
          book.status === statusFilter;
  
        return matchesSearch && matchesStatus;
      });
  
      if (!allBooks.length) {
        $("booksGrid").innerHTML = "";
        $("booksGrid").hidden = true;
        $("booksEmpty").hidden = false;
        $("noSearchResults").hidden = true;
        return;
      }
  
      if (!filteredBooks.length) {
        $("booksGrid").innerHTML = "";
        $("booksGrid").hidden = true;
        $("booksEmpty").hidden = true;
        $("noSearchResults").hidden = false;
        return;
      }
  
      $("booksEmpty").hidden = true;
      $("noSearchResults").hidden = true;
      $("booksGrid").hidden = false;
  
      $("booksGrid").innerHTML = filteredBooks.map((book) => {
        const status = getStatusInfo(book.status);

        const ownerCount = bookOwnerCounts.get(String(book.id)) || 0;

const ownerCountHTML = book.status === "published"
  ? `
    <div class="library-book-owner-count"
         aria-label="عدد الأشخاص الذين يمتلكون الرواية">
      <span class="library-book-owner-eye" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18"
             fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </span>
      <span>${ownerCount.toLocaleString("ar-EG")}</span>
    </div>
  `
  : "";
  
        const rejectedRevision =
  book.latestRevision?.status === "rejected"
    ? book.latestRevision
    : null;

const rejectionHTML =
  book.status === "rejected" && book.rejection_reason
    ? `
      <div class="rejection-note">
        <strong>سبب رفض الرواية</strong>
        <p>${escapeHTML(book.rejection_reason)}</p>
      </div>
    `
    : rejectedRevision
      ? `
        <div class="rejection-note">
          <strong>تم رفض التعديلات المقترحة</strong>
          <p>
            ${
              rejectedRevision.rejection_reason
                ? escapeHTML(rejectedRevision.rejection_reason)
                : "لم يذكر الأدمن سببًا للرفض."
            }
          </p>
        </div>
      `
      : "";
  
        const editRejectedButton = `

          <button
          class="book-action"
          type="button"
          data-action="edit-rejected"
          data-id="${escapeHTML(book.id)}"
          >تعديل</button>
          `;
  
        return `
          <article
            class="book-card"
            data-book-id="${escapeHTML(book.id)}"
          >
            <div class="book-cover-wrap">
              <div class="book-cover-placeholder">▤</div>
  
              <img
                class="book-cover"
                data-cover-book-id="${escapeHTML(book.id)}"
                alt="غلاف ${escapeHTML(book.title)}"
                hidden
              >
  
              <span class="book-status ${status.className}">
                ${escapeHTML(status.label)}
              </span>
            </div>
  
            <div class="book-card-body">
              <h3 class="book-title">
                ${escapeHTML(book.title)}
              </h3>
  
              <div class="book-meta">
                <span>
                  أُضيفت: ${escapeHTML(formatDate(book.created_at))}
                </span>
  
                <span>
                  السعر:
                  ${
                    Number(book.price || 0) === 0
                      ? "مجاني"
                      : escapeHTML(book.price) + " ج.م"
                  }
                </span>
              </div>

              ${ownerCountHTML}
  
              <p class="book-description">
                ${escapeHTML(
                  book.description || "لا توجد نبذة عن الرواية."
                )}
              </p>
  
              ${rejectionHTML}
  
              <div class="book-actions">
                <button
                  class="book-action"
                  type="button"
                  data-action="details"
                  data-id="${escapeHTML(book.id)}"
                >التفاصيل</button>
  
                ${editRejectedButton}
  
                <button
                  class="book-action delete-action"
                  type="button"
                  data-action="delete"
                  data-id="${escapeHTML(book.id)}"
                >حذف</button>
              </div>
            </div>
          </article>
        `;
      }).join("");
  
      // تحميل الأغلفة الخاصة باستخدام روابط موقعة.
      await Promise.all(filteredBooks.map(async (book) => {
        const path = getCoverPath(book);
        if (!path) return;
  
        // نتجنب CSS.escape لزيادة التوافق مع المتصفحات القديمة.
        const images = Array.from(
          document.querySelectorAll("[data-cover-book-id]")
        );
  
        const image = images.find(
          (item) =>
            String(item.dataset.coverBookId) === String(book.id)
        );
  
        if (!image) return;
  
        const url = await getCoverUrl(path);
  
        if (!url || !image.isConnected) return;
  
        image.onload = () => {
          const placeholder =
            image.parentElement.querySelector(
              ".book-cover-placeholder"
            );
  
          if (placeholder) placeholder.hidden = true;
  
          image.hidden = false;
        };
  
        image.onerror = () => {
          image.hidden = true;
        };
  
        image.src = url;
      }));
    }
  
    $("bookSearch").addEventListener("input", () => {
      renderBooks().catch((error) => {
        console.error("Search rendering error:", error);
      });
    });
  
    $("statusFilter").addEventListener("change", () => {
      renderBooks().catch((error) => {
        console.error("Filter rendering error:", error);
      });
    });

    // القائمة المخصصة لفلترة الروايات
(() => {
  const dropdown = document.getElementById("statusDropdown");
  const trigger = document.getElementById("statusDropdownTrigger");
  const menu = document.getElementById("statusDropdownMenu");
  const nativeSelect = document.getElementById("statusFilter");
  const currentLabel = document.getElementById("statusDropdownCurrent");
  const options = Array.from(
    menu.querySelectorAll(".status-dropdown-option")
  );

  if (!dropdown || !trigger || !menu || !nativeSelect || !currentLabel) {
    return;
  }

  function closeMenu() {
    dropdown.classList.remove("is-open");
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    dropdown.classList.add("is-open");
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  function syncDropdown() {
    const selectedOption = nativeSelect.options[nativeSelect.selectedIndex];

    currentLabel.textContent = selectedOption
      ? selectedOption.textContent.trim()
      : "كل الحالات";

    options.forEach((option) => {
      const selected = option.dataset.value === nativeSelect.value;

      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-selected", String(selected));
    });
  }

  trigger.addEventListener("click", () => {
    if (menu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  options.forEach((option) => {
    option.addEventListener("click", () => {
      nativeSelect.value = option.dataset.value;

      // يحافظ على نظام الفلترة الحالي في الصفحة
      nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));

      syncDropdown();
      closeMenu();
      trigger.focus();
    });
  });

  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      closeMenu();
      trigger.focus();
    }
  });

  nativeSelect.addEventListener("change", syncDropdown);

  syncDropdown();
})();
  
    // -------------------------------------------------------
    // 8. زر تحديث الكل
    // -------------------------------------------------------
  
    $("refreshBooksBtn").addEventListener("click", async () => {
      const button = $("refreshBooksBtn");
  
      if (button.disabled) return;
  
      setBusy(button, true, "جاري تحديث البيانات...");
  
      try {
        await Promise.all([
          loadCategories(),
          loadMyBooks(),
          loadPayoutAccount(),
          loadEarningsSummary()
        ]);
  
        showMessage(
          "تم تحديث جميع بيانات لوحة الكاتب بنجاح.",
          "success"
        );
  
      } catch (error) {
        console.error("Dashboard refresh error:", error);
  
        showMessage(
          "تعذر تحديث كل البيانات. راجع Console لمعرفة السبب.",
          "error"
        );
  
      } finally {
        setBusy(button, false);
      }
    });
  
    // -------------------------------------------------------
    // 9. تفاصيل الرواية
    // -------------------------------------------------------
  
    async function showBookDetails(bookId) {
      const book = getBookById(bookId);
    
      if (!book) {
        showMessage("الرواية المطلوبة غير موجودة.", "error");
        return;
      }
    
      const status = getStatusInfo(book.status);
      const coverUrl = await getCoverUrl(book.cover_path);

      const category = categories.find(
        (item) => String(item.id) === String(book.category_id)
      );
      
      const categoryName = category
        ? category.name
        : "بدون تصنيف";
    
      const ownerCount = bookOwnerCounts.get(String(book.id)) || 0;
    
      const isPublished = book.status === "published";
    
      const priceHTML = Number(book.price || 0) === 0
        ? `<span class="details-price-free">مجانية</span>`
        : `<span class="details-price-value">${escapeHTML(book.price)} ج.م</span>`;
    
        const rejectedRevision =
        book.latestRevision?.status === "rejected"
          ? book.latestRevision
          : null;
      
      const rejectionHTML = [
        book.status === "rejected"
          ? `
            <div class="details-rejection">
              <div class="details-rejection-title">
                <span>!</span>
                سبب رفض الرواية
              </div>
              <p>${escapeHTML(
                book.rejection_reason || "لم يذكر الأدمن سببًا للرفض."
              )}</p>
            </div>
          `
          : "",
      
        rejectedRevision
          ? `
            <div class="details-rejection">
              <div class="details-rejection-title">
                <span>!</span>
                تم رفض التعديلات المقترحة
              </div>
              <p>${escapeHTML(
                rejectedRevision.rejection_reason ||
                "لم يذكر الأدمن سببًا لرفض التعديلات."
              )}</p>
            </div>
          `
          : ""
      ].join("");


          $("detailsHeaderStatus").innerHTML = `
            <span class="book-status ${status.className}">
              ${escapeHTML(status.label)}
            </span>
          `;

    
      $("detailsContent").innerHTML = `
        <div class="details-content">
    
          <div class="details-hero">
    
            <div class="details-cover-frame">
              ${
                coverUrl
                  ? `
                    <img
                      class="details-cover"
                      src="${escapeHTML(coverUrl)}"
                      alt="غلاف ${escapeHTML(book.title)}"
                    >
                  `
                  : `
                    <div class="details-cover-placeholder">
                      <span>كُتُبنا</span>
                    </div>
                  `
              }
            </div>
    
            <div class="details-book-info">
              <div class="details-title-row">
                <h3>${escapeHTML(book.title)}</h3>

                <span class="book-status ${status.className}">
                  ${escapeHTML(status.label)}
                </span>
              </div>
    
              <div class="details-book-date">
                <span class="details-small-icon">◷</span>
                تاريخ الإضافة:
                <strong>${escapeHTML(formatDate(book.created_at))}</strong>
              </div>

              <div class="details-category">
                <span class="details-category-icon">▤</span>
                <span>التصنيف:</span>
                <strong>${escapeHTML(categoryName)}</strong>
              </div>
    
              <div class="details-price-box">
                <span>سعر الرواية</span>
                ${priceHTML}
              </div>
            </div>
    
          </div>
    
          ${
            isPublished
              ? `
                <div class="details-owner-card">
                  <div class="details-owner-icon">
                    <svg viewBox="0 0 24 24" width="23" height="23"
                         fill="none" stroke="currentColor" stroke-width="1.8"
                         stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </div>
    
                  <div class="details-owner-text">
                    <strong>${ownerCount.toLocaleString("ar-EG")}</strong>
                    <span>شخص يمتلك هذه الرواية</span>
                  </div>
    
                  <div class="details-owner-label">
                    عدد القراء
                  </div>
                </div>
              `
              : ""
          }
    
          <section class="details-section">
            <div class="details-section-heading">
              <span class="details-section-line"></span>
              <h3>نبذة عن الرواية</h3>
            </div>
    
            <div class="details-description">
              ${escapeHTML(book.description || "لا توجد نبذة مسجلة لهذه الرواية.")}
            </div>
          </section>
    
          ${rejectionHTML}
    
          <div class="details-footer">
            <span>حكاية ورواية</span>
            <span>تفاصيل الكتاب</span>
          </div>
    
        </div>
      `;
    
      $("detailsOverlay").hidden = false;
    }
  
    $("closeDetailsBtn").addEventListener("click", () => {
      $("detailsOverlay").hidden = true;
    });
  
    $("detailsOverlay").addEventListener("click", (event) => {
      if (event.target === $("detailsOverlay")) {
        $("detailsOverlay").hidden = true;
      }
    });
  
    // -------------------------------------------------------
    // 10. حذف الرواية
    // -------------------------------------------------------
  
    async function deleteBook(bookId) {
      const book = getBookById(bookId);
  
      if (!book) {
        throw new Error(
          "الرواية غير موجودة في البيانات المحملة. حدّث الصفحة وحاول مرة أخرى."
        );
      }
  
      // لا نزيل البطاقة من الواجهة قبل تأكيد حذف السجل.
      const { data: deletedRows, error: deleteError } = await db
        .from("books")
        .delete()
        .eq("id", book.id)
        .eq("author_id", currentUser.id)
        .select("id");
  
      if (deleteError) {
        console.error("Delete book error:", deleteError);
  
        throw new Error(
          "حدث خطأ أثناء حذف الرواية، حاول مره أخرى. إذا تكرر الخطأ قم بالتواصل مع خدمة العملاء"
        );
      }
  
      if (!deletedRows || deletedRows.length === 0) {
        /*
          قد ترجع بعض عمليات DELETE بلا خطأ، رغم عدم حذف أي صف
          بسبب RLS أو عدم تطابق شروط الحذف.
        */
        const { data: remainingBook, error: checkError } = await db
          .from("books")
          .select("id")
          .eq("id", book.id)
          .eq("author_id", currentUser.id)
          .maybeSingle();
  
        if (checkError) {
          console.error("Verify deletion error:", checkError);
  
          throw new Error(
            "لم نتمكن من التأكد من حذف الرواية. راجع صلاحيات القراءة والحذف."
          );
        }
  
        if (remainingBook) {
          throw new Error(
            "الرواية ما زالت موجودة في قاعدة البيانات. غالبًا سياسة RLS تمنع الحذف."
          );
        }
  
        // السجل لم يعد ظاهرًا للحساب؛ نعيد تحميل البيانات للتأكد.
        await loadMyBooks();
  
        showMessage(
          "لم يعد سجل الرواية ظاهرًا لحسابك. تم تحديث القائمة من قاعدة البيانات.",
          "success"
        );
  
        return;
      }
  
      // حذف السجل تأكد؛ الآن نحدّث الواجهة.
      allBooks = allBooks.filter(
        (item) => String(item.id) !== String(bookId)
      );
  
      updateStatistics();
      await renderBooks();
  
      showMessage(
        "تم حذف الرواية بنجاح.",
        "success"
      );
  
      // حذف الملفات بعد نجاح حذف السجل.
      const cleanupTasks = [];
  
      if (book.cover_path) {
        cleanupTasks.push({
          bucket: "book-covers",
          path: book.cover_path
        });
      }
  
      if (book.file_path) {
        cleanupTasks.push({
          bucket: "book-files",
          path: book.file_path
        });
      }
  
      const cleanupResults = await Promise.all(
        cleanupTasks.map(async (item) => {
          const { error } = await db.storage
            .from(item.bucket)
            .remove([item.path]);
  
          return {
            bucket: item.bucket,
            path: item.path,
            error
          };
        })
      );
  
      const failedCleanup = cleanupResults.filter(
        (result) => result.error
      );
  
      if (failedCleanup.length > 0) {
        console.error(
          "Storage cleanup failures:",
          failedCleanup
        );
  
        showMessage(
          "تم حذف سجل الرواية، لكن بعض ملفات Storage لم تُحذف. راجع صلاحيات حذف الملفات.",
          "info"
        );
      }
    }
  
    // -------------------------------------------------------
    // 11. التحقق من الملفات
    // -------------------------------------------------------
  
    function validateCoverFile(cover) {
      if (!cover) return;
  
      if (!ALLOWED_COVER_TYPES.includes(cover.type)) {
        throw new Error(
          "صيغة الغلاف غير مدعومة. استخدم JPG أو PNG أو WebP."
        );
      }
  
      if (cover.size > MAX_COVER_SIZE) {
        throw new Error("حجم الغلاف أكبر من 2MB.");
      }
    }
  
    function validatePdfFile(pdf) {
      if (!pdf) return;
  
      if (getFileExtension(pdf) !== "pdf") {
        throw new Error("ملف الرواية يجب أن يكون PDF.");
      }
  
      if (pdf.size > MAX_PDF_SIZE) {
        throw new Error("حجم ملف الرواية أكبر من 20MB.");
      }
  
      if (pdf.type && pdf.type !== "application/pdf") {
        throw new Error(
          "الملف المختار ليس ملف PDF صالحًا حسب نوعه."
        );
      }
    }
  
    function validateUploadFiles(cover, pdf) {
      if (!cover || !pdf) {
        throw new Error(
          "اختار غلاف الرواية وملف PDF أولًا."
        );
      }
  
      validateCoverFile(cover);
      validatePdfFile(pdf);
    }


    // التحكم في سكرول الصفحة عند فتح وإغلاق النوافذ
function updateAuthorBodyScroll() {
  const modalIds = [
    "confirmOverlay",
    "detailsOverlay",
    "rejectedEditOverlay"
  ];

  const anyModalOpen = modalIds.some((id) => {
    const modal = document.getElementById(id);
    return modal && !modal.hidden;
  });

  document.body.style.overflow = anyModalOpen ? "hidden" : "";

  const globalScrollbar = document.getElementById("global-scrollbar");

  if (globalScrollbar) {
    globalScrollbar.style.display = anyModalOpen ? "none" : "";
  }
}

// مراقبة فتح وإغلاق النوافذ تلقائيًا
const authorModalObserver = new MutationObserver(() => {
  updateAuthorBodyScroll();
});

authorModalObserver.observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden", "style", "class"]
});

  
    // -------------------------------------------------------
    // 12. نافذة تعديل الرواية المرفوضة
    // -------------------------------------------------------
  
    function ensureEditModal() {
      if ($("rejectedEditOverlay")) return;
  
      const overlay = document.createElement("div");
  
      overlay.id = "rejectedEditOverlay";
      overlay.hidden = true;
  
      overlay.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:99999",
        "background:rgba(10,20,15,.72)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "padding:16px",
        "overflow-y:auto"
      ].join(";");
  
      overlay.innerHTML = `
      <section class="edit-modal-card" role="dialog" aria-modal="true" aria-labelledby="rejectedEditTitle">

      <header class="edit-modal-header">
        <div class="edit-modal-heading">
          <span class="edit-modal-eyebrow">حكاية ورواية · مساحة الكاتب</span>
          <h2 id="rejectedEditTitle">تحرير الرواية</h2>
          <p id="editModalSubtitle">حدّث بيانات روايتك وملفاتها.</p>
        </div>

        <button id="rejectedEditClose" class="edit-modal-close" type="button" aria-label="إغلاق">×</button>
      </header>

      <div id="rejectedEditReason" class="edit-rejection-reason" hidden></div>

      <form id="rejectedEditForm">

        <section class="edit-form-section">
          <div class="edit-section-heading">
            <span class="edit-section-number">01</span>
            <div>
              <h3>المعلومات الأساسية</h3>
              <p>التفاصيل التي يتعرف بها القراء على روايتك.</p>
            </div>
          </div>

          <div class="edit-field">
            <label for="editBookTitle">عنوان الرواية <span>*</span></label>
            <input id="editBookTitle" type="text" maxlength="200" placeholder="اكتب عنوان الرواية" required>
          </div>

          <div class="edit-field">
            <label for="editBookDescription">نبذة عن الرواية <span>*</span></label>
            <textarea id="editBookDescription" rows="5" maxlength="10000" placeholder="اكتب نبذة جذابة عن روايتك..." required></textarea>
          </div>

          <div class="edit-field">
            <label for="editBookCategory">التصنيف الأدبي <span>*</span></label>
            <select id="editBookCategory" required></select>
          </div>
        </section>

        <section class="edit-form-section">
          <div class="edit-section-heading">
            <span class="edit-section-number">02</span>
            <div>
              <h3>تسعير الرواية</h3>
              <p>حدد إذا كانت روايتك مجانية أو مدفوعة.</p>
            </div>
          </div>

          <div class="edit-price-card">
            <div class="edit-price-top">
              <div>
                <strong>سعر البيع</strong>
                <p>السعر بالجنيه المصري</p>
              </div>
              <span class="edit-price-currency">ج.م</span>
            </div>

            <div class="edit-price-input-wrap">
              <input id="editBookPrice" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="مثال: 50">
            </div>

            <label class="edit-free-toggle" for="editBookFree">
              <input id="editBookFree" type="checkbox">
              <span class="edit-free-check">✓</span>
              <span>
                <strong>رواية مجانية</strong>
                <small>إتاحة الرواية للقراء دون مقابل</small>
              </span>
            </label>

            <p id="editPriceHelp" class="edit-price-help">أدخل سعرًا أكبر من صفر أو اختر رواية مجانية.</p>
          </div>
        </section>

        <section class="edit-form-section">
          <div class="edit-section-heading">
            <span class="edit-section-number">03</span>
            <div>
              <h3>ملفات الرواية</h3>
              <p>استبدل الملفات عند الحاجة فقط.</p>
            </div>
          </div>

          <div class="edit-file-field">
            <label for="editBookPdf">ملف الرواية PDF</label>
            <div class="edit-file-box">
              <span class="edit-file-icon pdf">PDF</span>
              <div>
                <strong>اختيار ملف PDF جديد</strong>
                <small>PDF فقط · بحد أقصى 20MB</small>
              </div>
              <input id="editBookPdf" type="file" accept=".pdf,application/pdf">
            </div>
          </div>

          <div class="edit-file-field">
            <label for="editBookCover">غلاف الرواية</label>
            <div class="edit-file-box">
              <span class="edit-file-icon">▧</span>
              <div>
                <strong>اختيار غلاف جديد</strong>
                <small>JPG أو PNG أو WebP · بحد أقصى 2MB</small>
              </div>
              <input id="editBookCover" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
            </div>
          </div>

          <p class="edit-files-note">إذا لم تختر ملفات جديدة، سنحتفظ بالملفات الحالية.</p>
        </section>

        <footer class="edit-modal-footer">
          <button id="saveRejectedEditBtn" class="edit-save-button" type="submit">
            حفظ التعديلات
          </button>
          <button id="cancelRejectedEditBtn" class="edit-cancel-button" type="button">
            إلغاء
          </button>
        </footer>

      </form>
    </section>
      `;
  
      document.body.appendChild(overlay);
      initEditCategoryDropdown();
  
      $("rejectedEditClose").addEventListener(
        "click",
        closeRejectedEdit
      );
  
      $("cancelRejectedEditBtn").addEventListener(
        "click",
        closeRejectedEdit
      );
  
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          closeRejectedEdit();
        }
      });

      $("editBookFree").addEventListener(
        "change",
        syncEditBookPriceField
      );
  
      $("rejectedEditForm").addEventListener(
        "submit",
        submitRejectedEdit
      );

      updateAuthorBodyScroll();
    }


    function initEditCategoryDropdown() {
      const select = $("editBookCategory");
      if (!select) return;
    
      const field = select.closest(".edit-field");
      select.classList.add("edit-category-native");
      if (!field) return;
    
      let dropdown = field.querySelector(".edit-category-dropdown");
    
      if (!dropdown) {
        dropdown = document.createElement("div");
        dropdown.className = "edit-category-dropdown";
    
        dropdown.innerHTML = `
          <button type="button"
            class="edit-category-trigger"
            aria-expanded="false">
            <span class="edit-category-current">اختر تصنيف الرواية</span>
            <span class="edit-category-arrow">⌄</span>
          </button>
    
          <div class="edit-category-menu" hidden></div>
        `;
    
        select.insertAdjacentElement("afterend", dropdown);
    
        dropdown.querySelector(".edit-category-trigger")
          .addEventListener("click", () => {
            const menu = dropdown.querySelector(".edit-category-menu");
            const trigger = dropdown.querySelector(".edit-category-trigger");
            const willOpen = menu.hidden;
    
            // إغلاق أي قائمة أخرى مفتوحة
            document.querySelectorAll(".edit-category-menu").forEach(item => {
              item.hidden = true;
            });
    
            document.querySelectorAll(".edit-category-trigger").forEach(item => {
              item.setAttribute("aria-expanded", "false");
            });
    
            if (willOpen) {
              renderOptions();
              menu.hidden = false;
              trigger.setAttribute("aria-expanded", "true");
            }
          });
    
        document.addEventListener("click", event => {
          if (!dropdown.contains(event.target)) {
            dropdown.querySelector(".edit-category-menu").hidden = true;
            dropdown.querySelector(".edit-category-trigger")
              .setAttribute("aria-expanded", "false");
          }
        });
      }
    
      function renderOptions() {
        const menu = dropdown.querySelector(".edit-category-menu");
        const current = dropdown.querySelector(".edit-category-current");
    
        menu.innerHTML = "";
    
        [...select.options].forEach(option => {
          if (!option.value) return;
    
          const item = document.createElement("button");
          item.type = "button";
          item.className = "edit-category-option";
    
          const name = document.createElement("span");
          name.textContent = option.textContent;
    
          const check = document.createElement("span");
          check.className = "edit-category-check";
          check.textContent = "✓";
    
          item.append(name, check);
    
          if (option.value === select.value) {
            item.classList.add("selected");
          }
    
          item.addEventListener("click", () => {
            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
    
            current.textContent = option.textContent;
    
            menu.querySelectorAll(".edit-category-option").forEach(button => {
              button.classList.remove("selected");
            });
    
            item.classList.add("selected");
            menu.hidden = true;
    
            dropdown.querySelector(".edit-category-trigger")
              .setAttribute("aria-expanded", "false");
          });
    
          menu.appendChild(item);
        });
    
        const selectedOption = select.options[select.selectedIndex];
        current.textContent = selectedOption?.value
          ? selectedOption.textContent
          : "اختر تصنيف الرواية";
      }
    
      // تحديث اسم التصنيف الظاهر لو القيمة اتغيرت من كود آخر
      select.addEventListener("change", () => {
        const selectedOption = select.options[select.selectedIndex];
        dropdown.querySelector(".edit-category-current").textContent =
          selectedOption?.value
            ? selectedOption.textContent
            : "اختر تصنيف الرواية";
      });
    
      renderOptions();
    }


    function initAddCategoryDropdown() {
      const select = $("bookCategory");
      if (!select) return;
    
      const field = select.closest(".form-field, .edit-field");
      select.classList.add("edit-category-native");
    
      if (!field) return;
    
      let dropdown = field.querySelector(".edit-category-dropdown");
    
      if (!dropdown) {
        dropdown = document.createElement("div");
        dropdown.className = "edit-category-dropdown";
    
        dropdown.innerHTML = `
          <button type="button"
            class="edit-category-trigger"
            aria-expanded="false">
            <span class="edit-category-current">اختر تصنيف الرواية</span>
            <span class="edit-category-arrow">⌄</span>
          </button>
    
          <div class="edit-category-menu" hidden></div>
        `;
    
        select.insertAdjacentElement("afterend", dropdown);
    
        dropdown.querySelector(".edit-category-trigger")
          .addEventListener("click", () => {
            const menu = dropdown.querySelector(".edit-category-menu");
            const trigger = dropdown.querySelector(".edit-category-trigger");
            const willOpen = menu.hidden;
    
            // إغلاق أي قائمة أخرى مفتوحة
            document.querySelectorAll(".edit-category-menu").forEach(item => {
              item.hidden = true;
            });
    
            document.querySelectorAll(".edit-category-trigger").forEach(item => {
              item.setAttribute("aria-expanded", "false");
            });
    
            if (willOpen) {
              renderOptions();
              menu.hidden = false;
              trigger.setAttribute("aria-expanded", "true");
            }
          });
    
        document.addEventListener("click", event => {
          if (!dropdown.contains(event.target)) {
            dropdown.querySelector(".edit-category-menu").hidden = true;
            dropdown.querySelector(".edit-category-trigger")
              .setAttribute("aria-expanded", "false");
          }
        });
      }
    
      function renderOptions() {
        const menu = dropdown.querySelector(".edit-category-menu");
        const current = dropdown.querySelector(".edit-category-current");
    
        menu.innerHTML = "";
    
        [...select.options].forEach(option => {
          if (!option.value) return;
    
          const item = document.createElement("button");
          item.type = "button";
          item.className = "edit-category-option";
    
          const name = document.createElement("span");
          name.textContent = option.textContent;
    
          const check = document.createElement("span");
          check.className = "edit-category-check";
          check.textContent = "✓";
    
          item.append(name, check);
    
          if (option.value === select.value) {
            item.classList.add("selected");
          }
    
          item.addEventListener("click", () => {
            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
    
            current.textContent = option.textContent;
    
            menu.querySelectorAll(".edit-category-option").forEach(button => {
              button.classList.remove("selected");
            });
    
            item.classList.add("selected");
            menu.hidden = true;
    
            dropdown.querySelector(".edit-category-trigger")
              .setAttribute("aria-expanded", "false");
          });
    
          menu.appendChild(item);
        });
    
        const selectedOption = select.options[select.selectedIndex];
    
        current.textContent = selectedOption?.value
          ? selectedOption.textContent
          : "اختر تصنيف الرواية";
      }
    
      // منع إضافة مستمع change أكثر من مرة
      if (select.dataset.addCategoryDropdownInitialized !== "true") {
        select.addEventListener("change", () => {
          const selectedOption = select.options[select.selectedIndex];
    
          dropdown.querySelector(".edit-category-current").textContent =
            selectedOption?.value
              ? selectedOption.textContent
              : "اختر تصنيف الرواية";
        });
    
        select.dataset.addCategoryDropdownInitialized = "true";
      }
    
      renderOptions();
    }

    

    function ensurePendingRevisionModal() {
      if ($("pendingRevisionOverlay")) return;
    
      const overlay = document.createElement("div");
    
      overlay.id = "pendingRevisionOverlay";
      overlay.hidden = true;
    
      overlay.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:100001",
        "background:rgba(10,20,15,.68)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "padding:20px"
      ].join(";");
    
      overlay.innerHTML = `
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="pendingRevisionTitle"
          style="
            width:100%;
            max-width:400px;
            box-sizing:border-box;
            padding:28px 24px;
            border-radius:18px;
            background:#fff;
            color:#202b26;
            text-align:center;
            direction:rtl;
            font-family:inherit;
            box-shadow:0 20px 60px rgba(0,0,0,.25);
          "
        >
          <div style="
            width:58px;
            height:58px;
            margin:0 auto 16px;
            border-radius:50%;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#fff4df;
            color:#a66b13;
            font-size:28px;
          ">!</div>
    
          <h2
            id="pendingRevisionTitle"
            style="margin:0 0 12px;font-size:20px"
          >التعديلات قيد المراجعة</h2>
    
          <p style="
            margin:0 0 24px;
            color:#68766e;
            font-size:14px;
            line-height:1.9;
          ">
            الرواية دي تم إرسال تعديلات عليها بالفعل، ولسه التعديلات قيد مراجعة الأدمن.
            تقدر تعدّلها مرة تانية بعد ما الأدمن يراجع التعديلات الحالية.
          </p>
    
          <button
            id="pendingRevisionConfirm"
            type="button"
            style="
              width:100%;
              padding:12px;
              border:0;
              border-radius:10px;
              background:#174f40;
              color:#fff;
              font:inherit;
              font-weight:bold;
              cursor:pointer;
            "
          >حسنًا، فهمت</button>
        </section>
      `;
    
      document.body.appendChild(overlay);
    
      function closePendingRevisionModal() {
        overlay.hidden = true;
        overlay.style.display = "none";
      }
    
      $("pendingRevisionConfirm").addEventListener(
        "click",
        closePendingRevisionModal
      );
    
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          closePendingRevisionModal();
        }
      });
    }
      
    let editingBookId = null;
  
    function closeRejectedEdit() {
      if (editing) return;
  
      const overlay = $("rejectedEditOverlay");
  
      if (overlay) {
        overlay.hidden = true;
      }
  
      editingBookId = null;
  
      if ($("rejectedEditForm")) {
        $("rejectedEditForm").reset();
      }
    }


    function syncEditBookPriceField() {
      const isFree = $("editBookFree").checked;
      const priceInput = $("editBookPrice");
      const priceHelp = $("editPriceHelp");
    
      priceInput.disabled = isFree;
      priceInput.required = !isFree;
    
      priceHelp.textContent = isFree
        ? "الرواية مجانية ولن يتم احتساب أي سعر عليها."
        : "أدخل السعر بالجنيه المصري، ويجب أن يكون أكبر من صفر.";
    }
  
    

    async function openRejectedEdit(bookId) {
      const book = getBookById(bookId);
    
      if (!book) {
        showMessage(
          "تعذر العثور على الرواية. حدّث البيانات وحاول مرة أخرى.",
          "error"
        );
        return;
      }
    
      // الرواية قيد المراجعة: ننتظر قرار الأدمن.
      if (book.status === "pending") {
        showMessage(
          "الرواية قيد المراجعة حاليًا. تقدر تعدّلها بعد ما الأدمن يحدد حالتها.",
          "info"
        );
        return;
      }
    
      // لا نسمح بالتعديل إلا للمنشورة أو المرفوضة.
      if (!["published", "rejected"].includes(book.status)) {
        showMessage(
          "حالة الرواية الحالية لا تسمح بالتعديل.",
          "error"
        );
        return;
      }
    
      // نفحص وجود تعديلات سابقة قيد المراجعة قبل فتح الشاشة.
      if (book.status === "published") {
        const { data: pendingRevision, error: revisionCheckError } =
          await db
            .from("book_revisions")
            .select("id")
            .eq("book_id", book.id)
            .eq("status", "pending")
            .maybeSingle();
    
        if (revisionCheckError) {
          console.error(
            "Pending revision check error:",
            revisionCheckError
          );
    
          showMessage(
            "تعذر التحقق من حالة التعديلات. حاول مرة أخرى.",
            "error"
          );
          return;
        }
    
        if (pendingRevision) {
          const editOverlay = $("rejectedEditOverlay");
        
          if (editOverlay) {
            editOverlay.hidden = true;
            editOverlay.style.display = "none";
          }
        
          editingBookId = null;
        
          ensurePendingRevisionModal();
        
          const noticeOverlay = $("pendingRevisionOverlay");
        
          noticeOverlay.hidden = false;
          noticeOverlay.style.display = "flex";
        
          $("pendingRevisionConfirm").focus();
        
          return;
        }
      }
    
      if (!categories.length) {
        showMessage(
          "لا توجد تصنيفات متاحة. حدّث البيانات وحاول مرة أخرى.",
          "error"
        );
        return;
      }
    
      ensureEditModal();
    
      editingBookId = book.id;
    
      const isPublished = book.status === "published";
    
      $("rejectedEditTitle").textContent = "تعديل الرواية";
    
      $("rejectedEditTitle").parentElement
        .querySelector("p").textContent = isPublished
          ? "التعديلات المقترحة هتُرسل للأدمن للمراجعة، والرواية المنشورة هتفضل كما هي لحد الموافقة."
          : "عدّل بيانات الرواية المرفوضة، وبعد الحفظ هتُرسل للأدمن للمراجعة من جديد.";
    
      $("saveRejectedEditBtn").textContent = isPublished
        ? "إرسال التعديلات للمراجعة"
        : "حفظ التعديلات وإعادة التقديم";
    
      $("editBookTitle").value = book.title || "";
      $("editBookDescription").value = book.description || "";

      // تحميل السعر الحالي للرواية
      const currentPrice = Number(book.price || 0);

      $("editBookFree").checked = currentPrice <= 0;
      $("editBookPrice").value = currentPrice > 0 ? currentPrice : "";

      syncEditBookPriceField();

      $("editBookCategory").innerHTML =
        buildCategoryOptions(book.category_id);
    
      const reasonBox = $("rejectedEditReason");
    
      if (book.status === "rejected" && book.rejection_reason) {
        reasonBox.textContent =
          "سبب الرفض السابق: " + book.rejection_reason;
    
        reasonBox.hidden = false;
      } else {
        reasonBox.textContent = "";
        reasonBox.hidden = true;
      }
    
      $("editBookCover").value = "";
      $("editBookPdf").value = "";
    
      $("rejectedEditOverlay").hidden = false;
      $("rejectedEditOverlay").style.display = "flex";
      $("editBookTitle").focus();
    }
  
    // -------------------------------------------------------
    // 13. حفظ تعديلات الرواية المرفوضة
    // -------------------------------------------------------
  
    
async function submitRejectedEdit(event) {
    event.preventDefault();
  
    if (editing || !editingBookId) return;
  
    const book = getBookById(editingBookId);
  
    if (
      !book ||
      !["published", "rejected"].includes(book.status)
    ) {
      showMessage(
        "حالة الرواية تغيرت أو لم تعد قابلة للتعديل. حدّث البيانات وحاول مجددًا.",
        "error"
      );
      closeRejectedEdit();
      return;
    }
  
    const isPublished = book.status === "published";
  
    const title = $("editBookTitle").value.trim();
    const description = $("editBookDescription").value.trim();
    const categoryId = $("editBookCategory").value;
    
    // بيانات السعر
    const isFree = $("editBookFree").checked;
    const priceInput = $("editBookPrice").value.trim();
    const newPrice = isFree ? 0 : Number(priceInput);
    
    const cover = $("editBookCover").files[0] || null;
    const pdf = $("editBookPdf").files[0] || null;
  
    if (!title || !description || !categoryId) {
      showMessage(
        "أكمل عنوان الرواية والنبذة والتصنيف.",
        "error"
      );
      return;
    }

    // التحقق من السعر
if (
  !isFree &&
  (!priceInput || !Number.isFinite(newPrice) || newPrice <= 0)
) {
  showMessage(
    "اكتب سعرًا صحيحًا أكبر من صفر، أو اختر أن تكون الرواية مجانية.",
    "error"
  );
  $("editBookPrice").focus();
  return;
}
  
    if (
      !categories.some(
        (category) => String(category.id) === String(categoryId)
      )
    ) {
      showMessage("اختار تصنيفًا صحيحًا من القائمة.", "error");
      return;
    }
  
    try {
      validateCoverFile(cover);
      validatePdfFile(pdf);
    } catch (error) {
      showMessage(error.message, "error");
      return;
    }
  
    const button = $("saveRejectedEditBtn");
  
    editing = true;
    setBusy(button, true, "جاري حفظ التعديلات...");
  
    const token = makeBookId();
    const uploadedFiles = [];

    let publishedPriceUpdated = false;
  
    try {
      // نتحقق من حالة الرواية الحالية قبل تنفيذ أي تعديل.
      const { data: latestBook, error: latestError } = await db
        .from("books")
        .select("id, status, author_id, cover_path, file_path")
        .eq("id", book.id)
        .eq("author_id", currentUser.id)
        .maybeSingle();
  
      if (latestError) throw latestError;
  
      if (!latestBook) {
        throw new Error("لم يتم العثور على الرواية في قاعدة البيانات.");
      }
  
      if (latestBook.status !== book.status) {
        throw new Error(
          "حالة الرواية تغيرت منذ فتح نافذة التعديل. حدّث البيانات وحاول مرة أخرى."
        );
      }
  
      if (
        !["published", "rejected"].includes(latestBook.status)
      ) {
        throw new Error(
          "الرواية لم تعد متاحة للتعديل في حالتها الحالية."
        );
      }
  
      // الرواية المنشورة: لا نسمح بوجود طلب مراجعة آخر قيد الانتظار.
      if (isPublished) {
        const { data: pendingRevision, error: revisionCheckError } =
          await db
            .from("book_revisions")
            .select("id")
            .eq("book_id", book.id)
            .eq("status", "pending")
            .maybeSingle();
  
        if (revisionCheckError) throw revisionCheckError;
  
        if (pendingRevision) {
          uploadedFiles.length = 0;
        
          $("rejectedEditOverlay").hidden = true;
          editingBookId = null;
        
          ensurePendingRevisionModal();
        
          $("pendingRevisionOverlay").hidden = false;
          $("pendingRevisionOverlay").style.display = "flex";
          $("pendingRevisionConfirm").focus();
        
          return;
        }
      }
  
      // ملفات جديدة بمسارات منفصلة؛ لا نستبدل الملفات الحالية.
      const newCoverPath = cover
        ? isPublished
          ? `${currentUser.id}/${book.id}/revision-${token}/cover.${getFileExtension(cover)}`
          : `${currentUser.id}/${book.id}/cover-${token}.${getFileExtension(cover)}`
        : null;
  
      const newPdfPath = pdf
        ? isPublished
          ? `${currentUser.id}/${book.id}/revision-${token}/book.pdf`
          : `${currentUser.id}/${book.id}/book-${token}.pdf`
        : null;
  
      // رفع الغلاف الجديد عند اختياره.
      if (cover) {
        const { error } = await db.storage
          .from("book-covers")
          .upload(newCoverPath, cover, {
            contentType: cover.type,
            upsert: false
          });
  
        if (error) {
          throw new Error(
            getStorageErrorMessage(error, "تعذر رفع الغلاف الجديد.")
          );
        }
  
        uploadedFiles.push({
          bucket: "book-covers",
          path: newCoverPath
        });
      }
  
      // رفع ملف PDF الجديد عند اختياره.
      if (pdf) {
        const { error } = await db.storage
          .from("book-files")
          .upload(newPdfPath, pdf, {
            contentType: "application/pdf",
            upsert: false
          });
  
        if (error) {
          throw new Error(
            getStorageErrorMessage(error, "تعذر رفع ملف PDF الجديد.")
          );
        }
  
        uploadedFiles.push({
          bucket: "book-files",
          path: newPdfPath
        });
      }
  
      if (isPublished) {
        // نحدد هل فيه تغييرات فعلية في بيانات الرواية غير السعر.
        const hasContentChanges =
          title !== (book.title || "") ||
          description !== (book.description || "") ||
          String(categoryId) !== String(book.category_id) ||
          Boolean(cover) ||
          Boolean(pdf);
      
        // نحدد هل السعر اتغير فعلًا.
        const hasPriceChanged =
          newPrice !== Number(book.price || 0);
      
        // لا توجد أي تغييرات.
        if (!hasContentChanges && !hasPriceChanged) {
          showMessage("لم يتم إجراء أي تغييرات على الرواية.", "info");
          return;
        }
      
        // تحديث السعر فقط إذا كان قد تغير.
        if (hasPriceChanged) {
          const { error: priceError } = await db.rpc(
            "author_update_published_book_price",
            {
              p_book_id: book.id,
              p_new_price: newPrice
            }
          );
      
          
if (priceError) {
  console.error("Published book price update error:", priceError);

  const errorMessage = (
    priceError.message ||
    priceError.details ||
    priceError.hint ||
    ""
  ).toLowerCase();

  if (
    errorMessage.includes("لا يمكن نشر رواية مدفوعة") ||
    errorMessage.includes("حساب سحب صالح") ||
    errorMessage.includes("شروط الأرباح")
  ) {
    throw new Error(
      "لا يمكن تحويل الرواية إلى مدفوعة قبل إضافة حساب سحب صالح والموافقة على شروط توزيع الأرباح (80% للكاتب و20% للمنصة). انتقل إلى حساب السحب وأكمل بياناتك أولًا."
    );
  }

  throw new Error(
    priceError.message || "تعذر تحديث سعر الرواية. حاول مرة أخرى."
  );
}
      
          publishedPriceUpdated = true;
        }
      
        // إرسال طلب مراجعة فقط لو فيه تغييرات أخرى غير السعر.
        if (hasContentChanges) {
          const { error: insertError } = await db
            .from("book_revisions")
            .insert({
              book_id: book.id,
              author_id: currentUser.id,
              proposed_title: title,
              proposed_description: description,
              proposed_category_id: categoryId,
              proposed_cover_path: newCoverPath,
              proposed_file_path: newPdfPath,
              status: "pending",
              rejection_reason: null
            });
      
          if (insertError) {
            console.error("Book revision insert error:", insertError);
      
            throw new Error(
              "تم تحديث السعر إن كان قد تغير، لكن تعذر إرسال باقي التعديلات للمراجعة."
            );
          }
      
          // الملفات الجديدة أصبحت مرتبطة بطلب المراجعة.
          uploadedFiles.length = 0;
        }
      
        $("rejectedEditOverlay").hidden = true;
        editingBookId = null;
      
        await loadMyBooks();
      
        if (hasContentChanges && hasPriceChanged) {
          showMessage(
            "تم تحديث السعر فورًا وإرسال باقي التعديلات للأدمن للمراجعة.",
            "success"
          );
        } else if (hasContentChanges) {
          showMessage(
            "تم إرسال تعديلات الرواية للأدمن للمراجعة.",
            "success"
          );
        } else {
          showMessage(
            "تم تحديث سعر الرواية بنجاح دون إرسال طلب مراجعة للأدمن.",
            "success"
          );
        }
      } else {
        // الرواية المرفوضة فقط: تحديثها وإعادة تقديمها.
        const { data: updatedRows, error: updateError } = await db
          .from("books")
          .update({
            title,
            description,
            category_id: categoryId,
            price: newPrice,
            cover_path: newCoverPath || latestBook.cover_path,
            file_path: newPdfPath || latestBook.file_path,
            status: "pending",
            rejection_reason: null
          })
          .eq("id", book.id)
          .eq("author_id", currentUser.id)
          .eq("status", "rejected")
          .select("id");
  
        if (updateError) {
          console.error("Rejected book update error:", updateError);
  
          throw new Error(
            "تعذر إعادة تقديم الرواية. تحقق من سياسات UPDATE في قاعدة البيانات."
          );
        }
  
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error(
            "لم يتم حفظ التعديلات؛ ربما تغيرت حالة الرواية أو لا تسمح صلاحيات قاعدة البيانات بالتعديل."
          );
        }
  
        // الملفات الجديدة أصبحت مستخدمة في سجل الرواية.
        uploadedFiles.length = 0;
  
        $("rejectedEditOverlay").hidden = true;
        editingBookId = null;
  
        await loadMyBooks();
  
        showMessage(
          "تم تحديث بيانات الرواية وسعرها وإعادة تقديمها للمراجعة.",
          "success"
        );
      }
    } catch (error) {
      console.error("Save book edit error:", error);
  
      // محاولة تنظيف الملفات التي رُفعت إذا فشلت عملية الحفظ.
      if (uploadedFiles.length) {
        const cleanupResults = await Promise.all(
          uploadedFiles.map(async (file) => {
            const { error: cleanupError } = await db.storage
              .from(file.bucket)
              .remove([file.path]);
  
            return { ...file, error: cleanupError };
          })
        );
  
        const failures = cleanupResults.filter((item) => item.error);
  
        if (failures.length) {
          console.warn(
            "Some uploaded files could not be cleaned up:",
            failures
          );
        }
      }
  
      showMessage(
        publishedPriceUpdated
          ? "تم تحديث السعر بنجاح، لكن تعذر إرسال باقي التعديلات للمراجعة. يمكنك المحاولة مرة أخرى."
          : error.message || "تعذر حفظ تعديلات الرواية.",
        "error"
      );
    } finally {
      editing = false;
      setBusy(button, false);
    }
  }
  
    // -------------------------------------------------------
    // 14. أحداث بطاقات الروايات
    // -------------------------------------------------------
  
    $("booksGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
  
      if (!button) return;
  
      const action = button.dataset.action;
      const bookId = button.dataset.id;
  
      if (action === "details") {
        showBookDetails(bookId).catch((error) => {
          console.error("Book details error:", error);
  
          showMessage(
            "تعذر عرض تفاصيل الرواية.",
            "error"
          );
        });
  
        return;
      }
  
      if (action === "edit-rejected") {
        openRejectedEdit(bookId);
        return;
      }
  
      if (action === "delete") {
        openConfirm({
          title: "حذف الرواية",
          text:
            "هل أنت متأكد من حذف الرواية؟ سنحاول حذف ملفاتها بعد التأكد من حذف سجلها من قاعدة البيانات.",
          confirmText: "حذف الرواية",
          action: () => deleteBook(bookId)
        });
      }
    });
  
    // -------------------------------------------------------
    // 15. معاينة الملفات قبل الرفع
    // -------------------------------------------------------
  
    $("bookCover").addEventListener("change", () => {
      const file = $("bookCover").files[0];
  
      $("coverFileName").textContent =
        file ? file.name : "لم يتم اختيار ملف";
  
      if (coverObjectUrl) {
        URL.revokeObjectURL(coverObjectUrl);
        coverObjectUrl = null;
      }
  
      if (!file) {
        $("coverPreview").hidden = true;
        $("coverPreview").removeAttribute("src");
        return;
      }
  
      try {
        validateCoverFile(file);
      } catch (error) {
        $("bookCover").value = "";
        $("coverFileName").textContent = "لم يتم اختيار ملف";
        $("coverPreview").hidden = true;
  
        showMessage(error.message, "error");
        return;
      }
  
      coverObjectUrl = URL.createObjectURL(file);
  
      $("coverPreview").src = coverObjectUrl;
      $("coverPreview").hidden = false;
    });
  
    $("bookPdf").addEventListener("change", () => {
      const file = $("bookPdf").files[0];
  
      $("pdfFileName").textContent =
        file ? file.name : "لم يتم اختيار ملف";
  
      if (!file) return;
  
      try {
        validatePdfFile(file);
      } catch (error) {
        $("bookPdf").value = "";
        $("pdfFileName").textContent = "لم يتم اختيار ملف";
  
        showMessage(error.message, "error");
      }
    });


    
let payoutAccountIsValid = false;

function isPayoutAccountValid(data) {
  if (!data) return false;

  const accountName = (data.account_name || "").trim();
  const accountIdentifier = (data.account_identifier || "").trim();

  if (
    !accountName ||
    !accountIdentifier ||
    !["instapay", "wallet"].includes(data.payout_method) ||
    data.terms_accepted !== true ||
    !data.terms_accepted_at ||
    !data.accepted_terms_at
  ) {
    return false;
  }

  if (data.payout_method === "instapay") {
    return Boolean((data.instapay_address || "").trim());
  }

  if (data.payout_method === "wallet") {
    return Boolean(
      (data.wallet_type || "").trim() &&
      (data.wallet_phone || "").trim()
    );
  }

  return false;
}

function updatePaidBookPayoutNotice() {
  const freeCheckbox = $("bookFree");
  const priceInput = $("bookPrice");
  const notice = $("paidBookPayoutNotice");

  if (!freeCheckbox || !priceInput || !notice) return;

  const isPaid =
    !freeCheckbox.checked &&
    Number(priceInput.value) > 0;

  notice.hidden = !(isPaid && !payoutAccountIsValid);
}



    // -------------------------------------------------------
  // التحكم في سعر الرواية المجانية أو المدفوعة
  // -------------------------------------------------------

  function syncBookPriceField() {
    const freeCheckbox = $("bookFree");
    const priceInput = $("bookPrice");
    const priceHelp = $("priceHelp");
    const priceField = priceInput.closest(".price-field");

    const isFree = freeCheckbox.checked;

    priceInput.disabled = isFree;
    priceInput.required = !isFree;

    if (isFree) {
      priceInput.value = "";
      priceHelp.textContent =
        "الرواية مجانية حاليًا. ألغِ التحديد لإضافة سعر.";
    } else {
      priceHelp.textContent =
        "أدخل السعر بالجنيه المصري، ويجب أن يكون أكبر من صفر.";
    }

    priceField.classList.toggle("is-free", isFree);

    updatePaidBookPayoutNotice();
  }

  $("bookFree").addEventListener("change", syncBookPriceField);

  syncBookPriceField();
  
    // -------------------------------------------------------
    // 16. رفع رواية جديدة
    // -------------------------------------------------------
  
    $("bookForm").addEventListener("submit", async (event) => {
      event.preventDefault();
  
      if (uploading) return;
  
      const title = $("bookTitle").value.trim();
      const description = $("bookDescription").value.trim();
      const categoryId = $("bookCategory").value;

      const isFree = $("bookFree").checked;
const enteredPrice = $("bookPrice").value.trim();
const price = isFree ? 0 : Number(enteredPrice);

if (
  !isFree &&
  (
    enteredPrice === "" ||
    !Number.isFinite(price) ||
    price <= 0
  )
) {
  showMessage(
    "أدخل سعرًا صحيحًا أكبر من صفر، أو اختَر «مجانية».",
    "error"
  );

  $("bookPrice").focus();
  return;
}
  
      const cover = $("bookCover").files[0];
      const pdf = $("bookPdf").files[0];
  
      if (!title || !description || !categoryId) {
        showMessage(
          "أكمل عنوان الرواية والنبذة والتصنيف.",
          "error"
        );
        return;
      }
  
      if (!categories.some(
        (category) => String(category.id) === String(categoryId)
      )) {
        showMessage(
          "اختار تصنيفًا صحيحًا من القائمة.",
          "error"
        );
        return;
      }
  
      try {
        validateUploadFiles(cover, pdf);
      } catch (error) {
        showMessage(error.message, "error");
        return;
      }
  
      const button = $("uploadBookBtn");
  
      uploading = true;
      setBusy(button, true, "جاري رفع الرواية...");
  
      const bookId = makeBookId();
  
      const coverPath =
        `${currentUser.id}/${bookId}/cover.${getFileExtension(cover)}`;
  
      const pdfPath =
        `${currentUser.id}/${bookId}/book.pdf`;
  
      let recordCreated = false;
      let coverUploaded = false;
      let pdfUploaded = false;
  
      try {
        // إنشاء سجل الرواية.
        const { error: insertError } = await db
          .from("books")
          .insert({
            id: bookId,
            author_id: currentUser.id,
            category_id: categoryId,
            title,
            description,
            cover_path: coverPath,
            file_path: pdfPath,
            status: "pending",
            price: price,
            rejection_reason: null
          });
  
        if (insertError) throw insertError;
  
        recordCreated = true;
  
        // رفع الغلاف.
        const { error: coverError } = await db.storage
          .from("book-covers")
          .upload(coverPath, cover, {
            contentType: cover.type,
            upsert: false
          });
  
        if (coverError) throw coverError;
  
        coverUploaded = true;
  
        // رفع ملف الرواية.
        const { error: pdfError } = await db.storage
          .from("book-files")
          .upload(pdfPath, pdf, {
            contentType: "application/pdf",
            upsert: false
          });
  
        if (pdfError) throw pdfError;
  
        pdfUploaded = true;
  
        $("bookForm").reset();

        syncBookPriceField();
  
        $("coverFileName").textContent = "لم يتم اختيار ملف";
        $("pdfFileName").textContent = "لم يتم اختيار ملف";
  
        $("coverPreview").hidden = true;
        $("coverPreview").removeAttribute("src");
  
        if (coverObjectUrl) {
          URL.revokeObjectURL(coverObjectUrl);
          coverObjectUrl = null;
        }
  
        await loadMyBooks();
  
        showMessage(
          "تم رفع الرواية بنجاح، وهي الآن قيد المراجعة.",
          "success"
        );
  
        go("my-books");
  
      } catch (error) {
        console.error("Upload book error:", error);
  
        const cleanupErrors = [];
  
        if (pdfUploaded) {
          const { error: cleanupError } = await db.storage
            .from("book-files")
            .remove([pdfPath]);
  
          if (cleanupError) {
            cleanupErrors.push(cleanupError);
          }
        }
  
        if (coverUploaded) {
          const { error: cleanupError } = await db.storage
            .from("book-covers")
            .remove([coverPath]);
  
          if (cleanupError) {
            cleanupErrors.push(cleanupError);
          }
        }
  
        if (recordCreated) {
          const { error: cleanupError } = await db
            .from("books")
            .delete()
            .eq("id", bookId)
            .eq("author_id", currentUser.id)
            .select("id");
  
          if (cleanupError) {
            cleanupErrors.push(cleanupError);
          }
        }
  
        console.error(
          "Upload cleanup errors:",
          cleanupErrors
        );
  
        showMessage(
          cleanupErrors.length
            ? "فشل رفع الرواية، وتعذر تنظيف بعض البيانات أو الملفات. راجع Storage وRLS."
            : `تعذر رفع الرواية: ${error.message || "خطأ غير معروف"}`,
          "error"
        );
  
        try {
          await loadMyBooks();
        } catch (reloadError) {
          console.error(
            "Reload after upload failure:",
            reloadError
          );
        }
  
      } finally {
        uploading = false;
        setBusy(button, false);
      }
    });
  
    // -------------------------------------------------------
    // 17. التنقل بين التابات
    // -------------------------------------------------------

    function go(tab) {
      const panels = document.querySelectorAll("[data-tab-panel]");
      let targetPanel = null;

      panels.forEach((panel) => {
        if (panel.dataset.tabPanel === tab) {
          targetPanel = panel;
        }
      });

      if (!targetPanel) {
        console.error("لم يتم العثور على التاب:", tab);
        console.table(Array.from(panels).map((panel) => ({
          tab: panel.dataset.tabPanel,
          id: panel.id
        })));
        return;
      }

      panels.forEach((panel) => {
        panel.hidden = true;
        panel.classList.remove("active");
      });

      targetPanel.hidden = false;
      targetPanel.classList.add("active");

      if (tab === "earnings") {
        loadEarningsSummary();
      }

      document.querySelectorAll(".sidebar-nav [data-tab]")
        .forEach((link) => {
          const isActive = link.dataset.tab === tab;
          link.classList.toggle("active", isActive);

          if (isActive) {
            link.setAttribute("aria-current", "page");
          } else {
            link.removeAttribute("aria-current");
          }
        });

      // حدّث عنوان الرابط دون ترك المتصفح يقفز إلى موضع قديم.
      if (window.history && typeof window.history.replaceState === "function") {
        window.history.replaceState(null, "", `#${tab}`);
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // مستمع موحّد للتنقل؛ يمنع تكرار تسجيل أحداث الروابط.
    document.addEventListener("click", (event) => {
      const tabLink = event.target.closest(".sidebar-nav [data-tab]");
      const goLink = event.target.closest("[data-go]");
      const uploadLink = event.target.closest("[data-scroll-upload]");

      if (tabLink) {
        event.preventDefault();
        go(tabLink.dataset.tab);
        return;
      }

      if (goLink) {
        event.preventDefault();
        go(goLink.dataset.go);
        return;
      }

      if (uploadLink) {
        event.preventDefault();
        go("upload-section");
      }
    });

    // افتح التاب الموجودة في الرابط إذا كانت صحيحة، وإلا ابدأ بنظرة عامة.
    const requestedTab = window.location.hash.slice(1);
    const validTabs = Array.from(
      document.querySelectorAll("[data-tab-panel]")
    ).map((panel) => panel.dataset.tabPanel);

    go(validTabs.includes(requestedTab) ? requestedTab : "overview");

    // -------------------------------------------------------
    // 18. بدء تشغيل اللوحة
    // -------------------------------------------------------
  

    async function initDashboard() {
      try {
        const allowed = await loadCurrentUser();
    
        if (!allowed || !currentUser) return;
    
        await Promise.all([
          loadCategories(),
          loadMyBooks()
        ]);
    
        await loadPayoutAccount();
    

        // لو لوحة الكاتب بدأت على تاب الأرباح، حمّل بياناته بعد تسجيل الدخول
        const earningsPanel = document.querySelector(
          '[data-tab-panel="earnings"]'
        );
        
        if (earningsPanel && !earningsPanel.hidden) {
          await loadEarningsSummary();
        }
    
      } catch (error) {
        console.error(
          "Dashboard initialization error:",
          error
        );
    
        showMessage(
          error.message || "تعذر تشغيل لوحة الكاتب.",
          "error"
        );
      }
    }


    function initPayoutWalletDropdown() {
      const dropdown = $("payoutWalletDropdown");
      const select = $("payoutWalletType");
      const trigger = $("payoutWalletTrigger");
      const menu = $("payoutWalletMenu");
      const label = $("payoutWalletLabel");
    
      if (!dropdown || !select || !trigger || !menu || !label) return;
    
      function closeDropdown() {
        dropdown.classList.remove("is-open");
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
    
      function syncDropdown() {
        const selectedOption = select.options[select.selectedIndex];
    
        label.textContent = selectedOption
          ? selectedOption.textContent
          : "اختر المحفظة";
    
        menu.querySelectorAll(".payout-wallet-option").forEach(option => {
          const selected = option.dataset.value === select.value;
    
          option.classList.toggle("is-selected", selected);
          option.setAttribute("aria-selected", String(selected));
        });
    
        trigger.disabled = select.disabled;
      }
    
      function openDropdown() {
        if (select.disabled) return;
    
        menu.hidden = false;
        dropdown.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    
      Array.from(select.options).forEach(option => {
        if (!option.value) return;
    
        const button = document.createElement("button");
    
        button.type = "button";
        button.className = "payout-wallet-option";
        button.textContent = option.textContent;
        button.dataset.value = option.value;
        button.setAttribute("role", "option");
    
        button.addEventListener("click", () => {
          select.value = option.value;
    
          select.dispatchEvent(
            new Event("change", { bubbles: true })
          );
    
          syncDropdown();
          closeDropdown();
        });
    
        menu.appendChild(button);
      });
    
      trigger.addEventListener("click", () => {
        if (menu.hidden) {
          openDropdown();
        } else {
          closeDropdown();
        }
      });
    
      document.addEventListener("click", event => {
        if (!dropdown.contains(event.target)) {
          closeDropdown();
        }
      });
    
      document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
          closeDropdown();
        }
      });
    
      select.addEventListener("change", syncDropdown);
    
      syncDropdown();
    
      return syncDropdown;
    }





let earningsSalesData = [];
let earningsChartMode = "sales";
let earningsChartControlsInitialized = false;

// إنشاء عنصر SVG
function createChartElement(tag, attributes = {}) {
  const element = document.createElementNS(
    "http://www.w3.org/2000/svg",
    tag
  );

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

// بداية الأسبوع: الاثنين
function formatChartDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}





function getWeekStart(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));

  return result;
}



function getEarningsChartBuckets(period) {
  const now = new Date();
  const buckets = [];

  const formatDate = date =>
    date.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  
  // اليومي: اليوم كاملًا، نقطة كل 4 ساعات
  if (period === "daily") {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 6; i++) {
      const start = new Date(today);
      start.setHours(i * 4);

      const end = new Date(start);
      end.setHours(end.getHours() + 4);

      const startHour = String(i * 4).padStart(2, "0");
      const endHour = String((i + 1) * 4).padStart(2, "0");

      buckets.push({
        key: `${start.toLocaleDateString("en-CA")}-${i * 4}`,
        label: `${startHour}:00`,
        tooltipLabel: `${startHour}:00 — ${endHour}:00`,
        value: 0,
        salesCount: 0,
        authorEarning: 0,
        start,
        end
      });
    }
  }


  // الأسبوعي: آخر 7 أيام، نقطة لكل يوم
  if (period === "weekly") {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      buckets.push({
        key: date.toLocaleDateString("en-CA"),
        label: date.toLocaleDateString("ar-EG", {
          weekday: "short",
          day: "numeric"
        }),
        tooltipLabel: formatDate(date),
        value: 0,
        salesCount: 0,
        authorEarning: 0,
        start: date,
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      });
    }
  }

  // الشهري: آخر 12 شهرًا
  if (period === "monthly") {
    const firstMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1
    );

    for (let i = 0; i < 12; i++) {
      const date = new Date(
        firstMonth.getFullYear(),
        firstMonth.getMonth() + i,
        1
      );

      const monthLabel = date.toLocaleDateString("ar-EG", {
        month: "long",
        year: "numeric"
      });

      buckets.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString("ar-EG", {
          month: "short"
        }),
        tooltipLabel: monthLabel,
        value: 0,
        salesCount: 0,
        authorEarning: 0,
        start: date,
        end: new Date(date.getFullYear(), date.getMonth() + 1, 1)
      });
    }
  }

  // السنوي: آخر 5 سنوات
  if (period === "yearly") {
    const currentYear = now.getFullYear();

    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i;

      buckets.push({
        key: String(year),
        label: String(year),
        tooltipLabel: `سنة ${year}`,
        value: 0,
        salesCount: 0,
        authorEarning: 0,
        start: new Date(year, 0, 1),
        end: new Date(year + 1, 0, 1)
      });
    }
  }

  return buckets;
}







// رسم البيانات
function renderEarningsChart() {
  const chart = $("earningsChart");
  const empty = $("earningsChartEmpty");
  const loading = $("earningsChartLoading");
  const filter = $("earningsPeriodFilter");

  if (!chart || !empty || !filter) return;

  if (loading) loading.hidden = true;

  const period = filter.value;
  const buckets = getEarningsChartBuckets(period);

  // مفتاح التاريخ المحلي بدون التأثر بتنسيق اللغة
  const getDateKey = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // تحديد النقطة التي تنتمي إليها عملية البيع
  const getBucketKey = date => {
    if (period === "daily") {
      const hour = Math.floor(date.getHours() / 4) * 4;
      return `${getDateKey(date)}-${hour}`;
    }

    if (period === "weekly") {
      return getDateKey(date);
    }

    if (period === "monthly") {
      return `${date.getFullYear()}-${date.getMonth()}`;
    }

    return String(date.getFullYear());
  };

  // تصفير بيانات الفترات
  buckets.forEach(bucket => {
    bucket.salesCount = 0;
    bucket.authorEarning = 0;
    bucket.value = 0;
  });

  const bucketMap = new Map(
    buckets.map((bucket, index) => [bucket.key, index])
  );

  // توزيع المبيعات على الفترات الصحيحة
  earningsSalesData.forEach(item => {
    if (!item.sold_at) return;

    const date = new Date(item.sold_at);

    if (Number.isNaN(date.getTime())) return;

    const index = bucketMap.get(getBucketKey(date));

    if (index === undefined) return;

    const bucket = buckets[index];

    bucket.salesCount += 1;

    const earning = Number(item.author_earning || 0);

    bucket.authorEarning += earning;
    bucket.value += earning;
  });

  // إظهار الرسم حتى لو كل القيم صفر
  chart.hidden = false;
  empty.hidden = true;

  const width = 900;
  const height = 320;

  const margin = {
    top: 25,
    right: 25,
    bottom: 55,
    left: 75
  };

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // مقياس رأسي ديناميكي يبدأ من صفر
  const maxValue = Math.max(
    ...buckets.map(bucket => bucket.value),
    0
  );

  const rawStep = Math.max(maxValue / 5, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalizedStep = rawStep / magnitude;

  const niceStep = normalizedStep <= 1 ? 1
    : normalizedStep <= 2 ? 2
    : normalizedStep <= 5 ? 5
    : 10;

  const axisStep = niceStep * magnitude;
  const roundedMax = axisStep * 5;

  // حساب أماكن النقاط
  const points = buckets.map((bucket, index) => {
    const x = buckets.length === 1
      ? width / 2
      : margin.left + (index / (buckets.length - 1)) * plotWidth;

    const y = margin.top + plotHeight -
      (bucket.value / roundedMax) * plotHeight;

    return { x, y, bucket };
  });

  const svg = createChartElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: "100%",
    role: "img",
    "aria-label": "رسم بياني لأرباح الكاتب"
  });

  // خطوط الخلفية وتدريج المحور الرأسي
  for (let i = 0; i <= 5; i++) {
    const y = margin.top + (plotHeight / 5) * (5 - i);

    svg.appendChild(createChartElement("line", {
      x1: margin.left,
      y1: y,
      x2: width - margin.right,
      y2: y,
      stroke: "#e8eeeb",
      "stroke-width": 1
    }));

    const value = axisStep * i;

    const label = createChartElement("text", {
      x: margin.left - 12,
      y: y + 5,
      "text-anchor": "end",
      fill: "#89938f",
      "font-size": 13
    });

    label.textContent = Math.round(value).toLocaleString("ar-EG");
    svg.appendChild(label);
  }

  // الخط البياني
  const pathData = points.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
  ).join(" ");

  svg.appendChild(createChartElement("path", {
    d: pathData,
    fill: "none",
    stroke: "#104b3d",
    "stroke-width": 4,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  }));

  // تنسيق المبالغ
  const formatMoney = amount =>
    new Intl.NumberFormat("ar-EG", {
      maximumFractionDigits: 2
    }).format(amount);

  // تجهيز نافذة التفاصيل
  const tooltip = document.createElement("div");
  tooltip.className = "earnings-chart-tooltip";

  tooltip.innerHTML = `
    <span class="earnings-tooltip-date"></span>

    <div class="earnings-tooltip-row">
      <span class="earnings-tooltip-label">النسخ المباعة</span>
      <span class="earnings-tooltip-value tooltip-sales-count"></span>
    </div>

    <div class="earnings-tooltip-divider"></div>

    <div class="earnings-tooltip-row">
      <span class="earnings-tooltip-label">إجمالي أرباحك</span>
      <span class="earnings-tooltip-value tooltip-author-earning"></span>
    </div>
  `;

  const tooltipDate = tooltip.querySelector(".earnings-tooltip-date");
  const tooltipSales = tooltip.querySelector(".tooltip-sales-count");
  const tooltipEarning = tooltip.querySelector(".tooltip-author-earning");

  const showTooltip = (event, bucket) => {
    tooltipDate.textContent = bucket.tooltipLabel || bucket.label;

    tooltipSales.textContent =
      `${bucket.salesCount.toLocaleString("ar-EG")} نسخة`;

    tooltipEarning.textContent =
      `${formatMoney(bucket.authorEarning)} جنيه`;

    const rect = chart.getBoundingClientRect();

    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top - tooltip.offsetHeight - 14;

    const halfWidth = tooltip.offsetWidth / 2;

    x = Math.max(
      halfWidth + 8,
      Math.min(x, chart.clientWidth - halfWidth - 8)
    );

    if (y < 8) {
      y = event.clientY - rect.top + 18;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.transform = "translate(-50%, 0)";

    tooltip.classList.add("visible");
  };

  // النقاط وتسميات المحور الأفقي
  points.forEach(point => {
    const circle = createChartElement("circle", {
      cx: point.x,
      cy: point.y,
      r: 6,
      fill: "#104b3d",
      stroke: "#ffffff",
      "stroke-width": 2,
      style: "cursor: pointer"
    });

    circle.addEventListener("mouseenter", event => {
      showTooltip(event, point.bucket);
    });

    circle.addEventListener("mousemove", event => {
      showTooltip(event, point.bucket);
    });

    circle.addEventListener("mouseleave", () => {
      tooltip.classList.remove("visible");
    });

    svg.appendChild(circle);

    const label = createChartElement("text", {
      x: point.x,
      y: height - 20,
      "text-anchor": "middle",
      fill: "#89938f",
      "font-size": 13
    });

    label.textContent = point.bucket.label;
    svg.appendChild(label);
  });

  chart.replaceChildren(svg, tooltip);
}







// ربط أزرار التبديل وفلتر الفترة والقائمة المخصصة
function initEarningsChartControls() {
  if (earningsChartControlsInitialized) return;

  const filter = $("earningsPeriodFilter");
  const buttons = document.querySelectorAll("[data-chart-mode]");

  // أزرار تبديل وضع الرسم
  buttons.forEach(button => {
    button.addEventListener("click", () => {
      earningsChartMode = button.dataset.chartMode;

      buttons.forEach(item => {
        const isActive = item.dataset.chartMode === earningsChartMode;

        item.classList.toggle("active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
      });

      renderEarningsChart();
    });
  });

  // فلتر الفترة الأصلي
  if (filter) {
    filter.addEventListener("change", renderEarningsChart);
  }

  // القائمة المخصصة للفترة
  const dropdown = $("earningsPeriodDropdown");
  const trigger = $("earningsPeriodTrigger");
  const selectedText = $("earningsPeriodSelected");
  const menu = $("earningsPeriodMenu");

  if (dropdown && trigger && selectedText && menu && filter) {

    // فتح وإغلاق القائمة
    trigger.addEventListener("click", () => {
      const isOpen = dropdown.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });

    // اختيار الفترة
    menu.querySelectorAll(".custom-period-option").forEach(option => {
      option.addEventListener("click", () => {
        const value = option.dataset.value;

        filter.value = value;
        selectedText.textContent = option.querySelector("span").textContent;

        menu.querySelectorAll(".custom-period-option").forEach(item => {
          const isActive = item === option;

          item.classList.toggle("active", isActive);
          item.setAttribute("aria-selected", String(isActive));
        });

        dropdown.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");

        filter.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    // إغلاق القائمة عند الضغط خارجها
    document.addEventListener("click", event => {
      if (!dropdown.contains(event.target)) {
        dropdown.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    // إغلاق القائمة بزر Escape
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        dropdown.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ضبط أزرار وضع الرسم عند التحميل
  buttons.forEach(button => {
    const isActive = button.dataset.chartMode === earningsChartMode;

    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  earningsChartControlsInitialized = true;
}







    async function loadEarningsSummary() {
      
      if (!currentUser?.id) {
        console.error("Earnings: currentUser is not available.");
      
        $("salesLoading").hidden = true;
        $("withdrawalsLoading").hidden = true;
      
        $("salesEmpty").hidden = false;
        $("withdrawalsEmpty").hidden = false;
      
        return;
      }
    
      const salesLoading = $("salesLoading");
      const salesEmpty = $("salesEmpty");
      const salesWrapper = $("salesTableWrapper");
    
      const withdrawalsLoading = $("withdrawalsLoading");
      const withdrawalsEmpty = $("withdrawalsEmpty");
      const withdrawalsWrapper = $("withdrawalsTableWrapper");
    
      salesLoading.hidden = false;
      salesEmpty.hidden = true;
      salesWrapper.hidden = true;
    
      withdrawalsLoading.hidden = false;
      withdrawalsEmpty.hidden = true;
      withdrawalsWrapper.hidden = true;
    
      const formatMoney = amount =>
        new Intl.NumberFormat("ar-EG", {
          style: "currency",
          currency: "EGP",
          maximumFractionDigits: 2
        }).format(Number(amount || 0));
    
      const formatDate = value => {
        if (!value) return "—";
    
        const date = new Date(value);
    
        if (Number.isNaN(date.getTime())) return "—";
    
        return date.toLocaleDateString("ar-EG", {
          year: "numeric",
          month: "long",
          day: "numeric"
        });
      };
    
      const createCell = value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        return cell;
      };
    
      try {

        console.log("Earnings refresh started");

        initEarningsChartControls();

        const [
          { data: sales, error: salesError },
          { data: withdrawals, error: withdrawalsError },
          { data: balance, error: balanceError }
        ] = await Promise.all([
          db
            .from("author_sales")
            .select("book_title, gross_price, author_earning, sold_at")
            .eq("author_id", currentUser.id)
            .order("sold_at", { ascending: false }),
    
          db
            .from("author_withdrawals")
            .select("amount, payout_method, requested_at, processed_at, status, admin_notes")
            .eq("author_id", currentUser.id)
            .order("requested_at", { ascending: false }),
    
          db.rpc("get_author_available_balance")
        ]);
    
        if (salesError) throw salesError;
        if (withdrawalsError) throw withdrawalsError;
        if (balanceError) throw balanceError;


        console.log("Fresh sales data:", sales);
        console.log("Fresh withdrawals data:", withdrawals);
        console.log("Fresh balance:", balance);


        // حفظ بيانات المبيعات لاستخدامها في الرسم البياني
        earningsSalesData = sales || [];

        // تحديث الرسم البياني
        renderEarningsChart();

    
        // ملخص المبيعات والأرباح
        const totalSales = (sales || []).reduce(
          (sum, item) => sum + Number(item.gross_price || 0),
          0
        );
    
        const totalEarnings = (sales || []).reduce(
          (sum, item) => sum + Number(item.author_earning || 0),
          0
        );
    
        const salesCount = (sales || []).length;
    
        const reservedBalance = (withdrawals || [])
          .filter(item => ["pending", "approved"].includes(item.status))
          .reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
          );
    
        $("earningsTotalSales").textContent =
          formatMoney(totalSales);
    
        $("earningsTotalProfit").textContent =
          formatMoney(totalEarnings);
    
        $("earningsSalesCount").textContent =
          salesCount.toLocaleString("ar-EG");
    
        $("earningsBalanceTotal").textContent =
          formatMoney(totalEarnings);
    
        $("earningsReservedBalance").textContent =
          formatMoney(reservedBalance);
    
        $("earningsAvailableBalance").textContent =
          formatMoney(balance ?? 0);
    
        // جدول المبيعات
        const salesBody = $("salesTableBody");
        salesBody.replaceChildren();
    
        if (!sales || sales.length === 0) {
          salesEmpty.hidden = false;
        } else {
          sales.forEach(item => {
            const tr = document.createElement("tr");
    
            tr.append(
              createCell(item.book_title || "رواية بدون عنوان"),
              createCell(formatMoney(item.gross_price)),
              createCell(formatMoney(item.author_earning)),
              createCell(formatDate(item.sold_at))
            );
    
            salesBody.appendChild(tr);
          });
    
          salesWrapper.hidden = false;
        }
    
        // جدول السحوبات
        const withdrawalsBody = $("withdrawalsTableBody");
        withdrawalsBody.replaceChildren();
    
        const statusLabels = {
          pending: "قيد المراجعة",
          approved: "تمت الموافقة",
          paid: "تم التحويل",
          rejected: "مرفوض"
        };
    
        const methodLabels = {
          instapay: "إنستاباي",
          wallet: "محفظة إلكترونية"
        };
    
        if (!withdrawals || withdrawals.length === 0) {
          withdrawalsEmpty.hidden = false;
        } else {
          withdrawals.forEach(item => {
            const tr = document.createElement("tr");
    
            const statusCell = document.createElement("td");
            statusCell.textContent =
              statusLabels[item.status] || "غير معروف";
                      
            if (item.status === "rejected" && item.admin_notes) {
              const reason = document.createElement("small");
              reason.textContent = `سبب الرفض: ${item.admin_notes}`;
              reason.style.display = "block";
              reason.style.marginTop = "6px";
              reason.style.whiteSpace = "normal";
              statusCell.appendChild(reason);
            }
    
            tr.append(
              createCell(formatMoney(item.amount)),
              createCell(methodLabels[item.payout_method] || "—"),
              createCell(formatDate(item.requested_at)),
              createCell(formatDate(item.processed_at)),
              statusCell
            );
    
            withdrawalsBody.appendChild(tr);
          });
    
          withdrawalsWrapper.hidden = false;
        }
    
      } catch (error) {
        console.error("Load earnings summary error:", error);
    
        showMessage(
          "تعذر تحميل بيانات الأرباح والمبيعات.",
          "error"
        );
    
      } finally {
        salesLoading.hidden = true;
        withdrawalsLoading.hidden = true;
            
        if ($("earningsChartLoading")) {
          $("earningsChartLoading").hidden = true;
        }
      }
    }
    



/* =========================================
   واجهة اختيار وسيلة حساب السحب
========================================= */


function initPayoutAccountUI() {

  const syncWalletDropdown = initPayoutWalletDropdown();

  const form = $("payoutAccountForm");

  const methods = document.querySelectorAll(
    'input[name="payoutMethod"]'
  );

  const instaPayFields = $("instapayFields");
  const walletFields = $("walletFields");

  const instaPayInput = $("payoutInstaPay");
  const walletType = $("payoutWalletType");
  const walletPhone = $("payoutWalletPhone");

  function updatePayoutMethod() {
    const selected = document.querySelector(
      'input[name="payoutMethod"]:checked'
    )?.value;

    const isWallet = selected === "wallet";

    instaPayFields.hidden = isWallet;
    walletFields.hidden = !isWallet;

    instaPayInput.disabled = isWallet;
    instaPayInput.required = !isWallet;

    walletType.disabled = !isWallet;

    if (syncWalletDropdown) syncWalletDropdown();

    walletType.required = isWallet;

    walletPhone.disabled = !isWallet;
    walletPhone.required = isWallet;
  }

  methods.forEach(method => {
    method.addEventListener("change", updatePayoutMethod);
  });

  updatePayoutMethod();


  $("bookPrice").addEventListener(
    "input",
    updatePaidBookPayoutNotice
  );
  
  $("goPayoutAccountBtn").addEventListener("click", () => {
    go("payout-account");
  });
  
  updatePaidBookPayoutNotice();


  // تحميل بيانات حساب السحب المحفوظة
  async function loadPayoutAccount() {

    if (!currentUser?.id) return;

    const { data, error } = await db
      .from("author_payout_accounts")
      .select("*")
      .eq("author_id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.error("Load payout account error:", error);
      showMessage("تعذر تحميل بيانات حساب السحب.", "error");

      payoutAccountIsValid = false;
      updatePaidBookPayoutNotice();

      return;
    }

    if (!data) {
      updatePayoutMethod();
      payoutAccountIsValid = false;
      updatePaidBookPayoutNotice();
      return;
    }

    $("payoutOwnerName").value = data.owner_name || "";

    const selectedMethod = document.querySelector(
      `input[name="payoutMethod"][value="${data.payout_method}"]`
    );

    if (selectedMethod) {
      selectedMethod.checked = true;
    }

    instaPayInput.value = data.instapay_address || "";

    walletType.value = data.wallet_type || "";

    walletPhone.value = data.wallet_phone || "";

    $("payoutTerms").checked = data.terms_accepted === true;

    payoutAccountIsValid = isPayoutAccountValid(data);
    updatePaidBookPayoutNotice();

    updatePayoutMethod();

    if (syncWalletDropdown) syncWalletDropdown();
  }


  // حفظ بيانات حساب السحب
  form.addEventListener("submit", async event => {

    event.preventDefault();

    if (!form.reportValidity()) return;

    if (!currentUser?.id) {
      showMessage("يرجى تسجيل الدخول أولاً.", "error");
      return;
    }

    const selectedMethod = document.querySelector(
      'input[name="payoutMethod"]:checked'
    )?.value;

    const saveButton = $("savePayoutAccountBtn");

    const originalText = saveButton.textContent;

    const now = new Date().toISOString();

    
const ownerName = $("payoutOwnerName").value.trim();

const accountIdentifier =
  selectedMethod === "instapay"
    ? instaPayInput.value.trim()
    : walletPhone.value.trim();

const payload = {
  author_id: currentUser.id,

  account_name: ownerName,
  account_identifier: accountIdentifier,
  accepted_terms_at: now,

  owner_name: ownerName,
  payout_method: selectedMethod,

  instapay_address:
    selectedMethod === "instapay"
      ? instaPayInput.value.trim()
      : null,

  wallet_type:
    selectedMethod === "wallet"
      ? walletType.value
      : null,

  wallet_phone:
    selectedMethod === "wallet"
      ? walletPhone.value.trim()
      : null,

  terms_accepted: $("payoutTerms").checked,
  terms_accepted_at: now,
  updated_at: now
};

    try {

      saveButton.disabled = true;
      saveButton.textContent = "جارٍ حفظ البيانات...";

      const { error } = await db
        .from("author_payout_accounts")
        .upsert(payload, {
          onConflict: "author_id"
        });

      if (error) throw error;

      payoutAccountIsValid = isPayoutAccountValid(payload);
      updatePaidBookPayoutNotice();

      showMessage(
        "تم حفظ بيانات حساب السحب بنجاح.",
        "success"
      );

    } catch (error) {

      console.error("Save payout account error:", error);

      showMessage(
        error.message || "تعذر حفظ بيانات حساب السحب.",
        "error"
      );

    } finally {

      saveButton.disabled = false;
      saveButton.textContent = originalText;

    }
  });

  return loadPayoutAccount;
}





/* =========================================
   نظام طلب سحب الأرباح
========================================= */

function initWithdrawalUI() {

  const modal = $("withdrawalModal");
  const amountInput = $("withdrawalAmount");
  const balanceLabel = $("withdrawalModalBalance");

  const openBtn = $("requestWithdrawalBtn");
  const closeBtn = $("closeWithdrawalModal");
  const cancelBtn = $("cancelWithdrawalBtn");
  const backdrop = $("withdrawalModalBackdrop");
  const submitBtn = $("submitWithdrawalBtn");

  let availableBalance = 0;

  const formatMoney = amount =>
    new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 2
    }).format(Number(amount || 0));

  function closeModal() {
    modal.hidden = true;
    amountInput.value = "";
  }

  async function openModal() {

    if (!currentUser?.id) {
      showMessage("يرجى تسجيل الدخول أولاً.", "error");
      return;
    }

    if (!payoutAccountIsValid) {
      showMessage(
        "يجب حفظ بيانات حساب استلام الأرباح أولاً.",
        "error"
      );

      go("payout-account");
      return;
    }

    modal.hidden = false;
    balanceLabel.textContent = "جارٍ تحميل الرصيد...";
    amountInput.value = "";
    amountInput.disabled = true;
    submitBtn.disabled = true;

    try {

      const { data, error } = await db.rpc(
        "get_author_available_balance"
      );

      if (error) throw error;

      availableBalance = Number(data || 0);

      balanceLabel.textContent = formatMoney(availableBalance);

      amountInput.max = availableBalance;
      amountInput.disabled = false;

      submitBtn.disabled = availableBalance <= 0;

      if (availableBalance <= 0) {
        showMessage(
          "لا يوجد رصيد متاح للسحب حاليًا.",
          "error"
        );
      }

    } catch (error) {

      console.error("Load withdrawal balance error:", error);

      showMessage(
        "تعذر تحميل الرصيد المتاح. حاول مرة أخرى.",
        "error"
      );

      closeModal();

    }
  }

  openBtn.addEventListener("click", openModal);

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  amountInput.addEventListener("input", () => {
    const amount = Number(amountInput.value);

    submitBtn.disabled =
      !amountInput.value ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > availableBalance;
  });

  submitBtn.addEventListener("click", async () => {

    const amount = Number(amountInput.value);

    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage("أدخل مبلغ سحب صحيحًا.", "error");
      return;
    }

    if (amount > availableBalance) {
      showMessage(
        "مبلغ السحب أكبر من الرصيد المتاح.",
        "error"
      );
      return;
    }

    const originalText = submitBtn.textContent;

    try {

      submitBtn.disabled = true;
      amountInput.disabled = true;
      submitBtn.textContent = "جارٍ إرسال الطلب...";

      const { data, error } = await db.rpc(
        "request_author_withdrawal",
        {
          p_amount: amount
        }
      );

      if (error) throw error;

      console.log("Withdrawal request created:", data);

      closeModal();

      showMessage(
        "تم إرسال طلب السحب بنجاح، وهو الآن قيد المراجعة.",
        "success"
      );

      await loadEarningsSummary();

    } catch (error) {

      console.error("Request withdrawal error:", error);

      showMessage(
        error.message || "تعذر إرسال طلب السحب. حاول مرة أخرى.",
        "error"
      );

    } finally {

      submitBtn.textContent = originalText;
      amountInput.disabled = false;

      if (!modal.hidden) {
        submitBtn.disabled =
          availableBalance <= 0 ||
          !amountInput.value ||
          Number(amountInput.value) <= 0 ||
          Number(amountInput.value) > availableBalance;
      }

    }
  });
}

initWithdrawalUI();





const loadPayoutAccount = initPayoutAccountUI();

initDashboard();
  
})();