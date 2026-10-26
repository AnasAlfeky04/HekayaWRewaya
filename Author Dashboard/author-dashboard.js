
/* =========================================================
   حكاية ورواية | لوحة تحكم الكاتب
   Supabase JS v2
   - تحميل الروايات والتصنيفات
   - تحديث البيانات مع إظهار الأخطاء
   - حذف الرواية والتحقق من الحذف الفعلي
   - تعديل الروايات المرفوضة قبل إعادة تقديمها
   - الحفاظ على النسخة المنشورة وعدم تعديلها مباشرة
   ========================================================= */

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
  
    const $ = (id) => document.getElementById(id);
  
    let currentUser = null;
    let currentProfile = null;
    let allBooks = [];
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
      const {
        data: { user },
        error
      } = await db.auth.getUser();
  
      if (error) throw error;
  
      if (!user) {
        window.location.replace("/Profile/profile.html");
        return false;
      }
  
      currentUser = user;
  
      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("id, display_name, role, avatar_path")
        .eq("id", currentUser.id)
        .maybeSingle();
  
      if (profileError) throw profileError;
  
      if (!profile) {
        throw new Error("تعذر العثور على بيانات حسابك.");
      }
  
      if (profile.role !== "author") {
        showMessage(
          "الصفحة دي مخصصة لحسابات الكُتّاب فقط. هنرجعك لصفحة حسابك.",
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

// تحميل آخر مراجعة لكل رواية منشورة.
const bookIds = allBooks
  .filter((book) => book.status === "published")
  .map((book) => book.id);

if (bookIds.length > 0) {
  const { data: revisions, error: revisionsError } = await db
    .from("book_revisions")
    .select(`
      id,
      book_id,
      status,
      rejection_reason,
      reviewed_at
    `)
    .in("book_id", bookIds)
    .order("reviewed_at", { ascending: false });

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
          loadMyBooks()
        ]);
  
        showMessage(
          "تم تحديث الروايات والإحصائيات والتصنيفات بنجاح.",
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
  
      const rejectionHTML =
        book.status === "rejected" && book.rejection_reason
          ? `
            <div class="details-rejection">
              <strong>سبب رفض الرفع:</strong>
              <p>${escapeHTML(book.rejection_reason)}</p>
            </div>
          `
          : "";
  
      $("detailsContent").innerHTML = `
        <div class="details-content">
          <div class="details-header">
            ${
              coverUrl
                ? `
                  <img
                    class="details-cover"
                    src="${escapeHTML(coverUrl)}"
                    alt="غلاف الرواية"
                  >
                `
                : '<div class="details-cover"></div>'
            }
  
            <div>
              <span class="book-status ${status.className}">
                ${escapeHTML(status.label)}
              </span>
  
              <h2>${escapeHTML(book.title)}</h2>
  
              <p>
                تاريخ الإضافة:
                ${escapeHTML(formatDate(book.created_at))}
              </p>
  
              <p>
                السعر:
                ${
                  Number(book.price || 0) === 0
                    ? "مجاني"
                    : escapeHTML(book.price) + " ج.م"
                }
              </p>
            </div>
          </div>
  
          <h3>نبذة الرواية</h3>
  
          <p class="details-description">
            ${escapeHTML(book.description || "لا توجد نبذة مسجلة.")}
          </p>
  
          ${rejectionHTML}
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
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="rejectedEditTitle"
          style="
            width:100%;
            max-width:700px;
            max-height:92vh;
            overflow-y:auto;
            background:#fff;
            color:#202b26;
            border-radius:18px;
            padding:24px;
            box-shadow:0 20px 70px rgba(0,0,0,.3);
            direction:rtl;
            font-family:inherit;
          "
        >
          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            margin-bottom:18px;
          ">
            <div>
              <h2 id="rejectedEditTitle" style="margin:0 0 6px">
                تعديل
              </h2>
  
              <p style="margin:0;color:#68766e;font-size:14px">
                عدّل البيانات المطلوبة قبل إعادة إرسال الرواية للمراجعة.
              </p>
            </div>
  
            <button
              id="rejectedEditClose"
              type="button"
              aria-label="إغلاق"
              style="
                border:0;
                background:#edf2ee;
                width:38px;
                height:38px;
                border-radius:10px;
                cursor:pointer;
                font-size:22px;
                flex-shrink:0;
              "
            >×</button>
          </div>
  
          <div
            id="rejectedEditReason"
            style="
              background:#fff4f1;
              color:#8e3730;
              border:1px solid #f0d0ca;
              border-radius:12px;
              padding:12px;
              margin-bottom:18px;
              line-height:1.8;
            "
            hidden
          ></div>
  
          <form id="rejectedEditForm">
            <label for="editBookTitle" style="display:block;margin-bottom:6px">
              عنوان الرواية *
            </label>
  
            <input
              id="editBookTitle"
              type="text"
              maxlength="200"
              required
              style="
                width:100%;
                box-sizing:border-box;
                padding:12px;
                border:1px solid #dce4de;
                border-radius:10px;
                margin-bottom:16px;
                font:inherit;
              "
            >
  
            <label for="editBookDescription" style="display:block;margin-bottom:6px">
              نبذة الرواية *
            </label>
  
            <textarea
              id="editBookDescription"
              rows="5"
              required
              style="
                width:100%;
                box-sizing:border-box;
                padding:12px;
                border:1px solid #dce4de;
                border-radius:10px;
                margin-bottom:16px;
                resize:vertical;
                font:inherit;
              "
            ></textarea>
  
            <label for="editBookCategory" style="display:block;margin-bottom:6px">
              التصنيف *
            </label>
  
            <select
              id="editBookCategory"
              required
              style="
                width:100%;
                box-sizing:border-box;
                padding:12px;
                border:1px solid #dce4de;
                border-radius:10px;
                margin-bottom:18px;
                background:#fff;
                font:inherit;
              "
            ></select>
  
            <div style="
              border-top:1px solid #e6ebe7;
              padding-top:16px;
              margin-bottom:16px;
            ">
              <h3 style="margin:0 0 8px;font-size:16px">
                استبدال الملفات (اختياري)
              </h3>
  
              <p style="margin:0 0 14px;color:#68766e;font-size:13px;line-height:1.8">
                لو الملف الحالي سليم، اترك الحقل فارغًا للاحتفاظ به.
              </p>
  
              <label for="editBookCover" style="display:block;margin-bottom:6px">
                غلاف جديد
              </label>
  
              <input
                id="editBookCover"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                style="display:block;width:100%;margin-bottom:14px"
              >
  
              <label for="editBookPdf" style="display:block;margin-bottom:6px">
                ملف PDF جديد
              </label>
  
              <input
                id="editBookPdf"
                type="file"
                accept=".pdf,application/pdf"
                style="display:block;width:100%;margin-bottom:8px"
              >
  
              <p style="margin:0;color:#68766e;font-size:12px">
                الحد الأقصى للغلاف 2MB، وملف PDF ‏20MB.
              </p>
            </div>
  
            <div style="
              display:flex;
              gap:10px;
              flex-wrap:wrap;
              margin-top:20px;
            ">
              <button
                id="saveRejectedEditBtn"
                type="submit"
                style="
                  flex:1;
                  min-width:180px;
                  padding:13px;
                  border:0;
                  border-radius:10px;
                  background:#174f40;
                  color:#fff;
                  font:inherit;
                  font-weight:bold;
                  cursor:pointer;
                "
              >حفظ التعديلات وإعادة التقديم</button>
  
              <button
                id="cancelRejectedEditBtn"
                type="button"
                style="
                  padding:13px 20px;
                  border:1px solid #dce4de;
                  border-radius:10px;
                  background:#fff;
                  color:#202b26;
                  font:inherit;
                  cursor:pointer;
                "
              >إلغاء</button>
            </div>
          </form>
        </section>
      `;
  
      document.body.appendChild(overlay);
  
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
  
      $("rejectedEditForm").addEventListener(
        "submit",
        submitRejectedEdit
      );
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
  
    const cover = $("editBookCover").files[0] || null;
    const pdf = $("editBookPdf").files[0] || null;
  
    if (!title || !description || !categoryId) {
      showMessage(
        "أكمل عنوان الرواية والنبذة والتصنيف.",
        "error"
      );
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
        // التعديلات المقترحة تُسجّل منفصلة عن بيانات الرواية المنشورة.
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
            "تعذر إرسال التعديلات للمراجعة. تأكد من صلاحيات جدول التعديلات ومسارات الملفات."
          );
        }
  
        // لا نعدّل سجل books ولا نحذف ملفاته الحالية.
        uploadedFiles.length = 0;
  
        $("rejectedEditOverlay").hidden = true;
        editingBookId = null;
  
        await loadMyBooks();
  
        showMessage(
          "تم إرسال التعديلات للأدمن. ستظل الرواية المنشورة كما هي حتى الموافقة.",
          "success"
        );
      } else {
        // الرواية المرفوضة فقط: تحديثها وإعادة تقديمها.
        const { data: updatedRows, error: updateError } = await db
          .from("books")
          .update({
            title,
            description,
            category_id: categoryId,
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
          "تم حفظ التعديلات وإعادة تقديم الرواية للمراجعة.",
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
        error.message || "تعذر حفظ تعديلات الرواية.",
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
  
    initDashboard();
  
  })();