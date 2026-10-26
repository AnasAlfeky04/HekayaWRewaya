/* =========================================
   حكاية ورواية - صفحة الحساب الشخصي
   ========================================= */

   const SUPABASE_URL = "https://aibgixalrifqbsotiogu.supabase.co";
   const SUPABASE_PUBLISHABLE_KEY =
     "sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB";

   const db = window.supabase.createClient(
     SUPABASE_URL,
     SUPABASE_PUBLISHABLE_KEY
   );

   const $ = (id) => document.getElementById(id);

   let currentUser = null;
   let currentProfile = null;


/* ---------- نافذة التأكيد المخصصة ---------- */

let confirmAction = null;
let confirmPreviousFocus = null;

function openConfirm(options, onConfirm) {
  const overlay = $("confirmOverlay");

  $("confirmIcon").textContent = options.icon || "✓";
  $("confirmTitle").textContent = options.title;
  $("confirmMessage").textContent = options.message;
  $("confirmAccept").textContent = options.acceptText || "تأكيد";

  confirmAction = onConfirm;
  confirmPreviousFocus = document.activeElement;

  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  $("confirmAccept").disabled = false;
  $("confirmCancel").disabled = false;
  $("confirmAccept").focus();
}

function closeConfirm() {
  $("confirmOverlay").hidden = true;
  document.body.style.overflow = "";
  confirmAction = null;

  if (confirmPreviousFocus && confirmPreviousFocus.isConnected) {
    confirmPreviousFocus.focus();
  }
}


function showBecomeAuthorNotice() {
  // إظهار الرسالة للقارئ القادم من زر ابدأ رحلتك ككاتب فقط
  const params = new URLSearchParams(window.location.search);
  
  if (params.get("notice") !== "become-author") {
  return;
  }
  
  // نستهلك العلامة حتى لا تتكرر الرسالة عند تحديث الصفحة
  params.delete("notice");
  
  const remainingQuery = params.toString();
  const newUrl =
  window.location.pathname +
  (remainingQuery ? "?" + remainingQuery : "") +
  window.location.hash;
  
  window.history.replaceState({}, "", newUrl);
  
  // التأكد أن المستخدم قارئ بالفعل
  if (!currentUser || currentProfile?.role !== "reader") {
  return;
  }
  
  openConfirm(
  {
  icon: "✍",
  title: "ابدأ رحلتك ككاتب",
  message:
  "علشان تقدر ترفع أعمالك وتنشر رواياتك، لازم تحوّل حسابك من قارئ إلى كاتب الأول.",
  acceptText: "حسنًا"
  },
  function () {
  closeConfirm();
  }
  );
  
  // إخفاء زر الإلغاء حتى تكون الرسالة مصحوبة بزر حسنًا فقط
  $("confirmCancel").hidden = true;
  }


$("confirmCancel").addEventListener("click", closeConfirm);

$("confirmOverlay").addEventListener("click", function (event) {
  if (event.target === this) {
    closeConfirm();
  }
});

document.addEventListener("keydown", function (event) {
  if ($("confirmOverlay").hidden) return;

  if (event.key === "Escape" &&
      !$("confirmAccept").disabled) {
    closeConfirm();
  }
});

$("confirmAccept").addEventListener("click", async function () {
  if (!confirmAction || this.disabled) return;

  const action = confirmAction;
  this.disabled = true;
  $("confirmCancel").disabled = true;

  try {
    await action();
  } catch (error) {
    console.error("Confirmation action error:", error);

    if (!$("confirmOverlay").hidden) {
      closeConfirm();
      showMessage(
        error.message || "حصل خطأ أثناء تنفيذ العملية. حاول مرة أخرى.",
        "error"
      );
    }
  } finally {
    if (!$("confirmOverlay").hidden) {
      $("confirmAccept").disabled = false;
      $("confirmCancel").disabled = false;
    }
  }
});


   function showMessage(message, type = "info") {
     const box = $("pageMessage");
     box.textContent = message;
     box.className = "page-message " + type;
     box.hidden = false;
     box.scrollIntoView({ behavior: "smooth", block: "nearest" });
   }

   function setBusy(button, busy, busyText, normalText) {
     button.disabled = busy;
     button.textContent = busy ? busyText : normalText;
   }

   function roleLabel(role) {
     const labels = {
       reader: "قارئ",
       author: "كاتب",
       admin: "مدير المنصة"
     };

     return labels[role] || "قارئ";
   }

   function statusLabel(status) {
    const labels = {
      pending: "قيد المراجعة",
      published: "تمت الموافقة",
      rejected: "مرفوض"
    };

    return labels[status] || status;
  }


   function displayAvatar(path) {
    const preview = $("avatarPreview");
    const placeholder = $("avatarPlaceholder");

    if (path) {
      const result = db.storage
        .from("avatars")
        .getPublicUrl(path);

      preview.src = result.data.publicUrl;
      preview.hidden = false;
      placeholder.hidden = true;

      preview.onerror = function () {
        preview.hidden = true;
        placeholder.hidden = false;
      };
    } else {
      preview.removeAttribute("src");
      preview.hidden = true;
      placeholder.hidden = false;
    }
  }  

  
function updateRoleSections() {
  const role = currentProfile?.role || "reader";

  $("roleBadge").textContent = roleLabel(role);

  $("readerActions").hidden = role !== "reader";
  $("authorArea").hidden = role !== "author";
  $("adminArea").hidden = role !== "admin";

  if (role === "admin") {
    $("workspaceTitle").textContent = "لوحة إدارة المنصة";
    $("workspaceDescription").textContent =
      "راجع الكتب المرسلة من الكُتّاب، وأدر محتوى منصة حكاية ورواية.";
  } else if (role === "author") {
    $("workspaceTitle").textContent = "إحصائيات الكاتب";
    $("workspaceDescription").textContent =
      "تابع حالة رواياتك وانتقل إلى لوحة التحكم لإدارة مكتبتك.";
  } else {
    $("workspaceTitle").textContent = "مساحة الكاتب";
    $("workspaceDescription").textContent =
      "حوّل حسابك إلى حساب كاتب لرفع رواياتك على المنصة.";
  }
}


   async function loadProfile() {
     const result = await db.auth.getUser();

     if (result.error || !result.data.user) {
       window.location.replace("/Auth/auth.html?mode=login");
       return false;
     }

     currentUser = result.data.user;

     const profileResult = await db
       .from("profiles")
       .select("id, display_name, role, avatar_path")
       .eq("id", currentUser.id)
       .maybeSingle();

     if (profileResult.error) {
       console.error("Profile load error:", profileResult.error);
       showMessage("تعذر تحميل بيانات الحساب. حاول تحديث الصفحة.", "error");
       return false;
     }

     if (!profileResult.data) {
       showMessage(
         "حدث خطأ أثناء تحميل بياناتك. حاول تحديث الصفحة",
         "error"
       );
       return false;
     }

     currentProfile = profileResult.data;

     const name = currentProfile.display_name || "";
     $("displayName").value = name;
     $("profileNameHeading").textContent = name || "قارئ حكاية ورواية";
     $("emailAddress").value = currentUser.email || "";

     displayAvatar(currentProfile.avatar_path);
     updateRoleSections();


     if (currentProfile.role === "author") {
      await loadAuthorStats();
    } else if (currentProfile.role === "admin") {
      await loadAdminBooks();
    }

     return true;
   }

   /* ---------- حفظ الاسم ---------- */

   $("profileForm").addEventListener("submit", async function (event) {
     event.preventDefault();

     if (!currentUser || !currentProfile) return;

     const name = $("displayName").value.trim();

     if (name.length < 2) {
       showMessage("الاسم يجب أن يكون حرفين على الأقل.", "error");
       return;
     }

     const button = $("saveProfileBtn");
     setBusy(button, true, "جارٍ الحفظ...", "حفظ التغييرات");

     try {
       const result = await db
         .from("profiles")
         .update({ display_name: name })
         .eq("id", currentUser.id);

       if (result.error) throw result.error;

       currentProfile.display_name = name;
       $("profileNameHeading").textContent = name;

       showMessage("تم حفظ اسمك بنجاح.", "success");
     } catch (error) {
       console.error("Profile update error:", error);
       showMessage(
         "تعذر تغير اسمك. يرجى المحاولة مرة ثانية",
         "error"
         );
        } finally {
          setBusy(button, false, "", "حفظ التغييرات");
        }
      });
   
   
   /* ---------- تغيير الصورة الشخصية ---------- */
   
   $("avatarInput").addEventListener("change", async function () {
       const file = this.files?.[0];
   
       if (!file || !currentUser || !currentProfile) return;
   
       const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
   
       if (!allowedTypes.includes(file.type)) {
         showMessage("اختار صورة JPG أو PNG أو WebP.", "error");
         this.value = "";
         return;
       }
   
       if (file.size > 2 * 1024 * 1024) {
         showMessage("حجم الصورة يجب أن يكون 2 ميجابايت أو أقل.", "error");
         this.value = "";
         return;
       }
   
       const extension = {
         "image/jpeg": "jpg",
         "image/png": "png",
         "image/webp": "webp"
       }[file.type];
   
       // اسم جديد لكل صورة لمنع تعارض الملفات والكاش
       const path = `${currentUser.id}/${file.name}`;
       const button = document.querySelector('label[for="avatarInput"]');
       const originalText = button.textContent;
   
       button.textContent = "جارٍ الرفع...";
       button.style.pointerEvents = "none";
   
       try {
         // رفع الصورة الجديدة
         const { error: uploadError } = await db.storage
           .from("avatars")
           .upload(path, file, {
             upsert: false,
             contentType: file.type,
             cacheControl: "0"
           });
   
         if (uploadError) throw uploadError;
   
         // تحديث مسار الصورة في قاعدة البيانات
         const { data: updatedProfile, error: updateError } = await db
           .from("profiles")
           .update({ avatar_path: path })
           .eq("id", currentUser.id)
           .select("id, avatar_path")
           .single();
   
         if (updateError) throw updateError;
   
         if (updatedProfile.avatar_path !== path) {
           throw new Error("لم يتم حفظ مسار الصورة الجديدة في قاعدة البيانات.");
         }
   
         // تحديث البيانات المعروضة في الصفحة
         currentProfile.avatar_path = updatedProfile.avatar_path;
         displayAvatar(updatedProfile.avatar_path);
   
         showMessage("تم تغيير الصورة الشخصية بنجاح.", "success");
   
       } catch (error) {
         console.error("Avatar update error:", error);
         showMessage(
           error.message || "تعذر تغيير الصورة الشخصية.",
           "error"
         );
       } finally {
         button.textContent = originalText;
         button.style.pointerEvents = "";
         this.value = "";
       }
     });
   
   
   /* ---------- حذف الصورة الشخصية ---------- */
   
   $("deleteAvatarBtn").addEventListener("click", function () {
       if (!currentUser || !currentProfile) return;
   
       if (!currentProfile.avatar_path) {
         showMessage("لا يوجد صورة شخصية لحذفها.", "info");
         return;
       }
   
       openConfirm(
         {
           icon: "🗑",
           title: "حذف الصورة الشخصية",
           message: "هل أنت متأكد إنك تريد حذف صورتك الشخصية؟",
           acceptText: "نعم، احذف الصورة"
         },
         async function () {
           const oldPath = currentProfile.avatar_path;
   
           // حذف الصورة من Storage
           const { error: storageError } = await db.storage
             .from("avatars")
             .remove([oldPath]);
   
           if (storageError) {
             console.error("Avatar delete error:", storageError);
             throw new Error("تعذر حذف الصورة من التخزين.");
           }
   
           // مسح مسار الصورة من ملف المستخدم
           const { error: profileError } = await db
             .from("profiles")
             .update({ avatar_path: null })
             .eq("id", currentUser.id);
   
           if (profileError) {
             console.error("Avatar profile update error:", profileError);
             throw new Error("تم حذف الملف، لكن تعذر تحديث بيانات الحساب.");
           }
   
           // تحديث الصفحة
           currentProfile.avatar_path = null;
           displayAvatar(null);
   
           showMessage("تم حذف الصورة الشخصية بنجاح.", "success");
           closeConfirm();
         }
       );
     });
   
   
   
   /* ---------- التحول إلى كاتب ---------- */
   
   $("becomeAuthorBtn").addEventListener("click", function () {
       if (!currentUser) return;
   
       openConfirm(
         {
           icon: "✍",
           title: "ابدأ رحلتك ككاتب",
           message:
             "هل تريد تحويل حسابك من قارئ إلى كاتب؟ هتقدر بعدها ترفع رواياتك وتبعتها للمراجعة.",
           acceptText: "نعم، حوّل حسابي"
         },
         async function () {
           const result = await db.rpc("become_author");
   
           if (result.error) {
             console.error("Become author error:", result.error);
             throw new Error("تعذر تحويل الحساب. حاول مرة أخرى.");
           }
   
           closeConfirm();
   
           const loaded = await loadProfile();
   
           if (loaded) {
             showMessage(
               "مبروك! حسابك أصبح حساب كاتب، وتقدر تبدأ في رفع رواياتك للمراجعة.",
               "success"
             );
           }
         }
       );
     });
   
   
      /* ---------- تحميل التصنيفات ---------- */
   
      async function loadCategories() {
        const select = $("bookCategory");
        select.innerHTML = '<option value="">اختر التصنيف</option>';
   
        const result = await db
          .from("categories")
          .select("id, name")
          .order("name");
   
        if (result.error) {
          console.error("Categories load error:", result.error);
          select.innerHTML = '<option value="">تعذر تحميل التصنيفات</option>';
          return;
        }
   
        (result.data || []).forEach(function (category) {
          const option = document.createElement("option");
          option.value = category.id;
          option.textContent = category.name;
          select.appendChild(option);
        });
      }
   
      /* ---------- عرض كتب الكاتب ---------- */
   
      async function loadMyBooks() {
        const container = $("myBooksList");
        container.textContent = "جارٍ تحميل رواياتك...";
   
        const result = await db
          .from("books")
          .select("id, title, status, created_at")
          .eq("author_id", currentUser.id)
          .order("created_at", { ascending: false });
   
        if (result.error) {
          console.error("My books load error:", result.error);
          container.textContent =
            "تعذر تحميل رواياتك. قد تحتاج إلى مراجعة صلاحيات القراءة في جدول books.";
          return;
        }
   
        if (!result.data || result.data.length === 0) {
          container.textContent = "لسه مرفعتش كتب. ابدأ بأول رواية ليك!";
          return;
        }
   
        container.innerHTML = "";
   
        result.data.forEach(function (book) {
          const row = document.createElement("div");
          row.className = "my-book-row";
   
          const details = document.createElement("div");
   
          const title = document.createElement("strong");
          title.textContent = book.title;
   
          const date = document.createElement("small");
          date.textContent = book.created_at
            ? "تاريخ الإرسال: " +
              new Date(book.created_at).toLocaleDateString("ar-EG")
            : "";
   
          details.appendChild(title);
          details.appendChild(date);
   
          const status = document.createElement("span");
          status.className = "book-status " + book.status;
          status.textContent = statusLabel(book.status);
   
          row.appendChild(details);
          row.appendChild(status);
          container.appendChild(row);
        });
      }

      
/* ---------- إحصائيات الكاتب في صفحة حسابي ---------- */

async function loadAuthorStats() {
  if (currentProfile?.role !== "author" || !currentUser) {
    return;
  }

  const message = $("authorStatsMessage");

  message.hidden = true;
  message.textContent = "";

  const result = await db
    .from("books")
    .select("status")
    .eq("author_id", currentUser.id);

  if (result.error) {
    console.error("Author stats load error:", result.error);

    message.textContent =
      "تعذر تحميل الإحصائيات. تأكد من اتصالك بالإنترنت وصلاحيات قراءة رواياتك.";

    message.hidden = false;
    return;
  }

  const books = result.data || [];

  const total = books.length;

  const pending = books.filter(
    book => book.status === "pending"
  ).length;

  const published = books.filter(
    book => book.status === "published"
  ).length;

  const rejected = books.filter(
    book => book.status === "rejected"
  ).length;

  $("authorTotalBooks").textContent =
    total.toLocaleString("ar-EG");

  $("authorPendingBooks").textContent =
    pending.toLocaleString("ar-EG");

  $("authorPublishedBooks").textContent =
    published.toLocaleString("ar-EG");

  $("authorRejectedBooks").textContent =
    rejected.toLocaleString("ar-EG");
}


/* ---------- تحديث إحصائيات الكاتب ---------- */

$("refreshAuthorStatsBtn").addEventListener(
  "click",
  async function () {
    if (currentProfile?.role !== "author") return;

    const button = this;

    button.disabled = true;
    button.textContent = "جارٍ التحديث...";

    try {
      await loadAuthorStats();
    } catch (error) {
      console.error("Author stats refresh error:", error);

      const message = $("authorStatsMessage");
      message.textContent = "حدث خطأ أثناء تحديث الإحصائيات.";
      message.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "تحديث الإحصائيات ↻";
    }
  }
);


      /* ---------- لوحة إدارة الكتب ---------- */


      async function loadAdminBooks() {
        if (currentProfile?.role !== "admin") return;
      
        const result = await db
          .from("books")
          .select("id, status");
      
        if (result.error) {
          console.error("Admin books stats error:", result.error);
      
          showMessage(
            "تعذر تحميل إحصائيات الكتب. حاول تحديث الصفحة.",
            "error"
          );
      
          return;
        }
      
        const books = result.data || [];
      
        const pendingCount = books.filter(
          book => book.status === "pending"
        ).length;
      
        const approvedCount = books.filter(
          book => book.status === "published"
        ).length;
      
        const rejectedCount = books.filter(
          book => book.status === "rejected"
        ).length;
      
        // تحديث الإحصائيات
        $("pendingBooksCount").textContent =
          pendingCount.toLocaleString("ar-EG");
      
        $("approvedBooksCount").textContent =
          approvedCount.toLocaleString("ar-EG");
      
        $("rejectedBooksCount").textContent =
          rejectedCount.toLocaleString("ar-EG");
      
        // تحديث إشعار المراجعة
        const notice = $("pendingBooksNotice");
        const noticeCount = $("pendingBooksNoticeCount");
        const noPendingMessage = $("noPendingBooksMessage");
      
        noticeCount.textContent =
          pendingCount.toLocaleString("ar-EG");
      
        notice.hidden = pendingCount === 0;
        noPendingMessage.hidden = pendingCount !== 0;
      }      

/* ---------- تغيير حالة الرواية ---------- */

async function updateBookStatus(book, newStatus) {
  if (currentProfile?.role !== "admin") {
    throw new Error("ليس لديك صلاحية لتنفيذ هذا الإجراء.");
  }

  if (!["published", "rejected"].includes(newStatus)) {
    throw new Error("حالة الرواية المطلوبة غير صحيحة.");
  }

  const result = await db
    .from("books")
    .update({ status: newStatus })
    .eq("id", book.id)
    .eq("status", "pending")
    .select("id");

  if (result.error) {
    console.error("Book status update error:", result.error);
    throw new Error("تعذر تحديث حالة الرواية. راجع صلاحيات قاعدة البيانات.");
  }

  if (!result.data || result.data.length !== 1) {
    await loadAdminBooks();
    showMessage(
      "لم يتغير الرواية؛ ربما تمت مراجعته بالفعل. تم تحديث القائمة.",
      "info"
    );
    return;
  }

  await loadAdminBooks();

  showMessage(
    newStatus === "published"
      ? "تمت الموافقة على الرواية بنجاح."
      : "تم رفض الرواية بنجاح.",
    "success"
  );
}

/* ---------- تحديث قائمة الإدارة ---------- */

$("refreshAdminBooksBtn").addEventListener("click", async function () {
  if (currentProfile?.role !== "admin") return;

  this.disabled = true;
  this.textContent = "جارٍ التحديث...";

  try {
    await loadAdminBooks();
  } finally {
    this.disabled = false;
    this.textContent = "تحديث القائمة ↻";
  }
});

/* ---------- رفع رواية جديد ---------- */

function makeBookId() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }
  );
}

$("bookForm")?.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!currentUser || currentProfile?.role !== "author") {
    showMessage("رفع الكتب متاح لحسابات الكُتّاب فقط.", "error");
    return;
  }

  const title = $("bookTitle").value.trim();
  const description = $("bookDescription").value.trim();
  const categoryId = $("bookCategory").value;
  const cover = $("bookCover").files[0];
  const pdf = $("bookPdf").files[0];

  if (!title || !description || !categoryId || !cover || !pdf) {
    showMessage(
      "من فضلك املأ جميع الحقول واختر الغلاف وملف PDF.",
      "error"
    );
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(cover.type)) {
    showMessage("الغلاف يجب أن يكون JPG أو PNG أو WebP.", "error");
    return;
  }

  if (cover.size > 2 * 1024 * 1024) {
    showMessage("حجم الغلاف يجب أن يكون 2 ميجابايت أو أقل.", "error");
    return;
  }

  if (
    pdf.type !== "application/pdf" &&
    !pdf.name.toLowerCase().endsWith(".pdf")
  ) {
    showMessage("الملف المرفوع يجب أن يكون بصيغة PDF.", "error");
    return;
  }

  if (pdf.size > 20 * 1024 * 1024) {
    showMessage("حجم ملف الرواية يجب أن يكون 20 ميجابايت أو أقل.", "error");
    return;
  }

  const button = $("uploadBookBtn");
  setBusy(button, true, "جارٍ رفع الرواية...", "إرسال الرواية للمراجعة");

  let bookId = null;
  let coverPath = null;
  let filePath = null;
  let bookRecordCreated = false;

  try {
    bookId = makeBookId();

    const coverExtension =
      cover.type === "image/png"
        ? "png"
        : cover.type === "image/webp"
          ? "webp"
          : "jpg";

    coverPath = `${currentUser.id}/${bookId}/cover.${coverExtension}`;
    filePath = `${currentUser.id}/${bookId}/book.pdf`;

    // 1. إنشاء سجل الرواية أولًا حتى تسمح سياسة Storage برفع ملفاتها.
    const insertResult = await db
      .from("books")
      .insert({
        id: bookId,
        author_id: currentUser.id,
        category_id: Number(categoryId),
        title: title,
        description: description,
        cover_path: coverPath,
        file_path: filePath,
        status: "pending",
        price: 0
      });

    if (insertResult.error) {
      throw insertResult.error;
    }

    bookRecordCreated = true;

    // 2. رفع الغلاف بعد إنشاء سجل الرواية.
    const coverUpload = await db.storage
      .from("book-covers")
      .upload(coverPath, cover, {
        contentType: cover.type,
        upsert: false
      });

    if (coverUpload.error) {
      throw coverUpload.error;
    }

    // 3. رفع ملف الرواية PDF.
    const pdfUpload = await db.storage
      .from("book-files")
      .upload(filePath, pdf, {
        contentType: "application/pdf",
        upsert: false
      });

    if (pdfUpload.error) {
      throw pdfUpload.error;
    }

    // 4. نجاح الرفع.
    $("bookForm").reset();
    await loadMyBooks();

    showMessage(
      "تم رفع الرواية وإرساله للمراجعة. سوف يظهر في المكتبة بعد موافقة الإدارة.",
      "success"
    );

  } catch (error) {
    console.error("Book upload error:", error);

    // محاولة تنظيف الملفات والسجل عند فشل العملية.
    if (coverPath) {
      const { error: cleanupError } = await db.storage
        .from("book-covers")
        .remove([coverPath]);

      if (cleanupError) {
        console.error("Cover cleanup error:", cleanupError);
      }
    }

    if (filePath) {
      const { error: cleanupError } = await db.storage
        .from("book-files")
        .remove([filePath]);

      if (cleanupError) {
        console.error("PDF cleanup error:", cleanupError);
      }
    }

    if (bookRecordCreated && bookId) {
      const { error: deleteError } = await db
        .from("books")
        .delete()
        .eq("id", bookId)
        .eq("author_id", currentUser.id);

      if (deleteError) {
        console.error("Book record cleanup error:", deleteError);
      }
    }

    showMessage(
      "حدث خطأ أثناء رفع الرواية. يرجى المحاولة مرة أخرى",
      "error"
    );

  } finally {
    setBusy(button, false, "", "إرسال الرواية للمراجعة");
  }
});


/* ---------- تسجيل الخروج ---------- */

$("logoutBtn").addEventListener("click", function () {
  openConfirm(
    {
      icon: "↪",
      title: "تسجيل الخروج",
      message:
        "هل أنت متأكد إنك تريد تسجيل الخروج من حسابك؟ يمكنك الرجوع وتسجيل دخولك في أي وقت.",
      acceptText: "تأكيد تسجيل الخروج"
    },
    async function () {
      const result = await db.auth.signOut();

      if (result.error) {
        console.error("Logout error:", result.error);
        throw new Error("تعذر تسجيل الخروج. حاول مرة أخرى.");
      }

      closeConfirm();
      window.location.replace("/index.html");
    }
  );
});


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



/* ---------- تشغيل الصفحة ---------- */

loadProfile().then(function (loaded) {
  if (loaded) {
  showBecomeAuthorNotice();
  }
  });