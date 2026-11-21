
/* =========================================================
   حكاية ورواية | لوحة تحكم مدير المنصة
   Supabase + Row Level Security (RLS)
   ========================================================= */

   (() => {
    'use strict';
  
    // ---------------------------------------------------------
    // 1. إعداد Supabase
    // ---------------------------------------------------------
  
    const SUPABASE_URL =
      'https://aibgixalrifqbsotiogu.supabase.co';
  
    const SUPABASE_PUBLISHABLE_KEY =
      'sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB';
  
    const db = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );



let sessionExpiredRedirecting = false;

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" && !sessionExpiredRedirecting) {
    sessionExpiredRedirecting = true;

    showNotice(
      "انتهت صلاحية جلسة تسجيل الدخول. يُرجى تسجيل الدخول مرة أخرى للمتابعة.",
      "error"
    );

    setTimeout(() => {
      window.location.replace("/Auth/auth.html?mode=login");
    }, 2500);
  }
});


  
    const $ = (id) => document.getElementById(id);
  
    const state = {
      user: null,
      profile: null,
      books: [],
      users: [],
      categories: [],
      revisions: [],
      confirmAction: null,
      toastTimer: null,
      purchaseRequests: [],
      sales: [],
      withdrawals: [],
      withdrawalsLoadError: '',
      activeWithdrawal: null,
      withdrawalProofFile: null,
      withdrawalsView: 'pending',
      purchaseRequestsView: 'pending',
    };
  
    const roleLabels = {
      reader: 'قارئ',
      author: 'كاتب',
      admin: 'مدير المنصة'
    };
  
    const statusLabels = {
      pending: 'قيد المراجعة',
      published: 'منشور',
      rejected: 'مرفوض'
    };
  
    const pageLabels = {
      overview: 'نظرة عامة',
      published: 'الروايات المنشورة',
      books: 'كل الروايات',
      revisions: 'مراجعة تعديلات الروايات',
      users: 'المستخدمون',
      statistics: 'الإحصائيات',
      purchases: 'طلبات الشراء',
      earnings: 'أرباح المنصة',
      withdrawals: 'طلبات السحب'
    };
  
    // ---------------------------------------------------------
    // 2. أدوات مساعدة
    // ---------------------------------------------------------
  
    function esc(value = '') {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]);
    }
  
    function dateLabel(value) {
      if (!value) return '—';
  
      const date = new Date(value);
  
      if (Number.isNaN(date.getTime())) {
        return '—';
      }
  
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  
    function statusBadge(status) {
      const label = statusLabels[status] || status || 'غير معروف';
  
      return `
        <span class="status-badge status-${esc(status)}">
          ${esc(label)}
        </span>
      `;
    }
  
    function showNotice(message, type = 'info') {
      const element = $('pageMessage');
  
      element.textContent = message;
      element.className = `notice ${type}`;
      element.hidden = false;
    }
  
    function hideNotice() {
      $('pageMessage').hidden = true;
    }
  
    function toast(message) {
      const element = $('toast');
  
      element.textContent = message;
      element.hidden = false;
  
      clearTimeout(state.toastTimer);
  
      state.toastTimer = setTimeout(() => {
        element.hidden = true;
      }, 4500);
    }
  
    function empty(message) {
      return `
        <div class="empty-state">
          ${esc(message)}
        </div>
      `;
    }
  
    function getErrorMessage(error) {
      if (!error) return 'خطأ غير معروف';
  
      const parts = [
        error.message,
        error.code ? `Code: ${error.code}` : null,
        error.details ? `Details: ${error.details}` : null,
        error.hint ? `Hint: ${error.hint}` : null
      ].filter(Boolean);
  
      return parts.join(' | ');
    }
  
    
function bookCover(book, small = false) {
  const coverClass = small ? 'mini-cover' : 'book-cover';

  if (!book.cover_path) {
    return `
      <div class="${coverClass}">
        ح
      </div>
    `;
  }

  const escapedTitle = esc(book.title || 'الرواية');

  return `
    <div
      class="${coverClass}"
      data-cover-container
      data-cover-path="${esc(book.cover_path)}"
    >
      <div class="cover-loading">جارٍ تحميل الغلاف...</div>
    </div>
  `;
}


async function loadBookCovers(root = document) {
  const containers = root.querySelectorAll(
    '[data-cover-container]:not([data-cover-loaded])'
  );

  await Promise.all(
    Array.from(containers).map(async (container) => {
      const path = container.dataset.coverPath;

      if (!path) return;

      container.dataset.coverLoaded = 'true';

      try {
        const { data, error } = await db.storage
          .from('book-covers')
          .createSignedUrl(path, 3600);

        if (error) throw error;

        if (!data?.signedUrl) {
          throw new Error('لم يتم إنشاء رابط الغلاف.');
        }

        const img = document.createElement('img');
        img.src = data.signedUrl;
        img.alt = 'غلاف الرواية';
        img.loading = 'lazy';

        img.onerror = () => {
          container.textContent = 'تعذر تحميل الغلاف';
        };

        container.replaceChildren(img);
      } catch (error) {
        console.error('Book cover loading failed:', {
          path,
          error
        });

        container.textContent = 'تعذر تحميل الغلاف';
      }
    })
  );
}

  
    function authorName(book) {
      return book.author_name || 'كاتب غير معروف';
    }
  
    function matchesBook(book, query) {
      const search = query.trim().toLocaleLowerCase('ar');
  
      if (!search) return true;
  
      return [
        book.title,
        book.description,
        authorName(book),
        book.id
      ].some((value) =>
        String(value || '')
          .toLocaleLowerCase('ar')
          .includes(search)
      );
    }
  
    // ---------------------------------------------------------
    // 3. إدارة النوافذ وتأكيد العمليات
    // ---------------------------------------------------------
  
    

    function updateBodyScroll() {
      const bookModal = $('bookDetailsModal');
      const userModal = $('userDetailsModal');
      const revisionDetailsModal = $('revisionDetailsModal');
      const confirmModal = $('confirmModal');
      const rejectionModal = $('rejectionModal');
      const revisionRejectionModal = $('revisionRejectionModal');
    
      const withdrawalCompleteModal = $('withdrawalCompleteModal');
      const withdrawalRejectModal = $('withdrawalRejectModal');
    
      const anyModalOpen =
        (bookModal && !bookModal.hidden) ||
        (userModal && !userModal.hidden) ||
        (rejectionModal && !rejectionModal.hidden) ||
        (revisionRejectionModal && !revisionRejectionModal.hidden) ||
        (revisionDetailsModal && !revisionDetailsModal.hidden) ||
        (confirmModal && !confirmModal.hidden) ||
        (withdrawalCompleteModal && !withdrawalCompleteModal.hidden) ||
        (withdrawalRejectModal && !withdrawalRejectModal.hidden);
    
      document.body.style.overflow = anyModalOpen ? 'hidden' : '';
    
      const globalScrollbar = $('global-scrollbar');
    
      if (globalScrollbar) {
        globalScrollbar.style.display = anyModalOpen ? 'none' : '';
      }
    }
    
  
    function confirm(options, action) {
      $('confirmTitle').textContent = options.title;
      $('confirmText').textContent = options.text;
      $('confirmSymbol').textContent = options.symbol || '!';
      $('acceptConfirm').textContent = options.accept || 'تأكيد';
  
      $('acceptConfirm').className =
        `btn ${options.danger === false ? 'btn-primary' : 'btn-danger'}`;
  
      state.confirmAction = action;
  
      $('confirmModal').hidden = false;
      updateBodyScroll();
      $('acceptConfirm').focus();
    }
  
    function closeConfirm() {
      $('confirmModal').hidden = true;
      state.confirmAction = null;
      updateBodyScroll();
    }
  
    $('cancelConfirm').addEventListener('click', closeConfirm);
  
    $('confirmModal').addEventListener('click', (event) => {
      if (event.target === $('confirmModal')) {
        closeConfirm();
      }
    });
  
    $('acceptConfirm').addEventListener('click', async () => {
      if (!state.confirmAction) return;
  
      const button = $('acceptConfirm');
      const action = state.confirmAction;
  
      button.disabled = true;
  
      try {
        await action();
        closeConfirm();
      } catch (error) {
        console.error('Admin action failed:', error);
        toast(error.message || 'تعذر إتمام العملية.');
      } finally {
        button.disabled = false;
      }
    });
  
    // ---------------------------------------------------------
    // 4. التحقق من حساب مدير المنصة
    // ---------------------------------------------------------
  

    async function requireAdmin() {
      function isSessionExpired(error) {
        const message = (error?.message || '').toLowerCase();
        const code = (error?.code || '').toLowerCase();
    
        return (
          message.includes('jwt expired') ||
          message.includes('token expired') ||
          message.includes('session expired') ||
          message.includes('refresh token') ||
          message.includes('invalid jwt') ||
          code.includes('token_expired')
        );
      }
    
      function redirectToLogin(message) {
        showNotice(message, 'error');
    
        setTimeout(() => {
          location.replace('/Auth/auth.html?mode=login');
        }, 2500);
    
        return false;
      }
    
      const { data, error } = await db.auth.getUser();
    
      if (error) {
        console.error('Admin authentication failed:', error);
    
        if (isSessionExpired(error)) {
          return redirectToLogin(
            'انتهت صلاحية جلسة تسجيل الدخول. يُرجى تسجيل الدخول مرة أخرى للمتابعة.'
          );
        }
    
        return redirectToLogin(
          'تعذر التحقق من جلسة تسجيل الدخول. يُرجى تسجيل الدخول مرة أخرى.'
        );
      }
    
      if (!data.user) {
        return redirectToLogin(
          'يجب تسجيل الدخول أولًا للوصول إلى لوحة التحكم.'
        );
      }
    
      state.user = data.user;
    
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('id, display_name, role, avatar_path')
        .eq('id', state.user.id)
        .maybeSingle();
    
      if (profileError) {
        console.error('Profile verification failed:', profileError);
    
        if (isSessionExpired(profileError)) {
          return redirectToLogin(
            'انتهت صلاحية جلسة تسجيل الدخول. يُرجى تسجيل الدخول مرة أخرى للمتابعة.'
          );
        }
    
        showNotice(
          'تعذر التحقق من بيانات حسابك حاليًا. يُرجى المحاولة مرة أخرى.',
          'error'
        );
    
        return false;
      }
    
      if (!profile) {
        showNotice(
          'تعذر العثور على بيانات حسابك. يُرجى التواصل مع إدارة المنصة.',
          'error'
        );
    
        return false;
      }
    
      state.profile = profile;
    
      if (state.profile.role !== 'admin') {
        showNotice(
          'عذرًا، هذه الصفحة مخصصة لمدير المنصة فقط.',
          'error'
        );
    
        setTimeout(() => {
          location.replace('/Profile/profile.html');
        }, 1400);
    
        return false;
      }
    
      console.info('Admin authenticated:', state.user.id);
    
      return true;
    }
    
  
    // ---------------------------------------------------------
    // 5. تحميل بيانات المنصة
    // ---------------------------------------------------------
  
    async function loadData() {
      hideNotice();
  
      $('refreshBtn').disabled = true;
      $('refreshBtn').innerHTML = '↻ <span>جارٍ التحديث…</span>';
  
      
try {
  const [booksRes, usersRes, categoriesRes, revisionsRes, userBooksRes] =
  await Promise.all([
      db.from('books')
        .select(
          'id, author_id, category_id, title, description, cover_path, file_path, status, price, rejection_reason, created_at'
        )
        .order('created_at', { ascending: false }),

      db.from('profiles')
        .select('id, display_name, role, avatar_path, created_at'),

      db.from('categories')
        .select('id, name'),

      db.from('book_revisions')
        .select(
          'id, book_id, author_id, proposed_category_id, proposed_title, proposed_description, proposed_cover_path, proposed_file_path, status, rejection_reason, submitted_at, reviewed_at, reviewed_by'
        )
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false }),

      db.from('user_books')
        .select('user_id, created_at, book:books(id, status)')
    ]);

  if (booksRes.error) {
    throw new Error(
      'تعذر تحميل الروايات: ' + getErrorMessage(booksRes.error)
    );
  }

  if (usersRes.error) {
    throw new Error(
      'تعذر تحميل المستخدمين: ' + getErrorMessage(usersRes.error)
    );
  }


  if (userBooksRes.error) {
    throw new Error(
      'تعذر تحميل إحصائيات المكتبات الشخصية: ' +
      getErrorMessage(userBooksRes.error)
    );
  }
  

  if (revisionsRes.error) {
    console.error(
      'تعذر تحميل التعديلات المقترحة:',
      revisionsRes.error
    );
  }

  state.books = booksRes.data || [];
  state.users = usersRes.data || [];
  state.categories = categoriesRes.error
    ? []
    : (categoriesRes.data || []);

    state.revisions = revisionsRes.error
    ? []
    : (revisionsRes.data || []);

    state.revisionsLoadError = revisionsRes.error
    ? 'تعذر تحميل التعديلات المقترحة. اضغط على تحديث وحاول مرة أخرى.'
    : '';

  if (categoriesRes.error) {
    console.warn(
      'Categories could not be loaded:',
      categoriesRes.error
    );
  }

  const authorNames = new Map(
    state.users.map((user) => [
      user.id,
      user.display_name || 'مستخدم بدون اسم'
    ])
  );

  const categoryNames = new Map(
    state.categories.map((category) => [
      String(category.id),
      category.name
    ])
  );

  state.books = state.books.map((book) => ({
    ...book,
    author_name:
      authorNames.get(book.author_id) || 'كاتب غير معروف',
    category_name:
      categoryNames.get(String(book.category_id)) || 'غير محدد'
  }));


  // حساب عدد الروايات الموجودة في المكتبة الشخصية لكل مستخدم

  
  // تجهيز الروايات الموجودة في المكتبات الشخصية
// مع الاحتفاظ ببيانات الرواية وتاريخ إضافتها
state.userBooks = (userBooksRes.data || [])
.filter((item) => item.book && item.book.status === 'published')
.map((item) => {
  const book = state.books.find(
    (b) => String(b.id) === String(item.book.id)
  );

  return {
    user_id: item.user_id,
    added_at: item.created_at,
    book: book || null
  };
})
.filter((item) => item.book);


// حساب عدد الروايات في المكتبة الشخصية لكل مستخدم
const libraryCounts = new Map();

state.userBooks.forEach((item) => {
const userId = String(item.user_id);

libraryCounts.set(
  userId,
  (libraryCounts.get(userId) || 0) + 1
);
});


  // ربط إحصائيات المكتبة وعدد الروايات المنشورة بكل مستخدم
  state.users = state.users.map((user) => {
    const userId = String(user.id);

    const libraryBooksCount =
      libraryCounts.get(userId) || 0;

    const publishedBooksCount = state.books.filter(
      (book) =>
        String(book.author_id) === userId &&
        book.status === 'published'
    ).length;

    return {
      ...user,
      library_books_count: libraryBooksCount,
      published_books_count: publishedBooksCount
    };
  });

  // ترتيب المستخدمين: المدير أولًا، ثم الأحدث إنشاءً
  state.users.sort((a, b) => {
    // حساب المدير يظل دائمًا في أول القائمة
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;

    // باقي الحسابات من الأحدث إلى الأقدم
    return new Date(b.created_at) - new Date(a.created_at);
  });

  
state.revisions = state.revisions.map((revision) => {
  const book = state.books.find(
    (item) => String(item.id) === String(revision.book_id)
  );

  return {
    ...revision,
    book: book || null,

    author_name:
      authorNames.get(revision.author_id) || 'كاتب غير معروف',

    current_title:
      book?.title || 'رواية غير موجود',

    current_description:
      book?.description || '',

    current_cover_path:
      book?.cover_path || null,

    current_file_path:
      book?.file_path || null,

    current_category_name:
      book?.category_name || 'غير محدد',

    proposed_category_name:
      categoryNames.get(
        String(revision.proposed_category_id)
      ) || 'غير محدد'
  };
});


  renderAll();

  await loadPurchaseAndSalesData();
  await loadWithdrawalsData();
  
  loadBookCovers();

  $('lastUpdated').textContent =
    'آخر تحديث: ' +
    new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });

}

      catch (error) {
        console.error('Dashboard loading failed:', error);
  
        showNotice(
          error.message || 'تعذر تحميل بيانات المنصة.',
          'error'
        );
  
        [
          'recentBooks',
          'publishedBooks',
          'allBooks'
        ].forEach((id) => {
          $(id).innerHTML = `
            <div class="error-state">
              تعذر تحميل البيانات. حاول تحديث الصفحة.
            </div>
          `;
        });
  
        $('usersTable').innerHTML = `
          <tr>
            <td colspan="4" class="error-state">
              تعذر تحميل المستخدمين.
            </td>
          </tr>
        `;
  
      } finally {
        $('refreshBtn').disabled = false;
        $('refreshBtn').innerHTML = '↻ <span>تحديث البيانات</span>';
      }
    }
  
    // ---------------------------------------------------------
    // 6. الإحصائيات
    // ---------------------------------------------------------
  
    function counts() {
      const regularUsers = state.users.filter(
        (user) => user.role === 'reader' || user.role === 'author'
      );
  
      return {
        all: state.books.length,
  
        pending: state.books.filter(
          (book) => book.status === 'pending'
        ).length,
  
        published: state.books.filter(
          (book) => book.status === 'published'
        ).length,
  
        rejected: state.books.filter(
          (book) => book.status === 'rejected'
        ).length,
  
        users: regularUsers.length,
  
        readers: regularUsers.filter(
          (user) => user.role === 'reader'
        ).length,
  
        authors: regularUsers.filter(
          (user) => user.role === 'author'
        ).length
      };
    }
  
    function renderStats() {
      const totals = counts();
  
      [
        ['statAll', totals.all],
        ['statPending', totals.pending],
        ['statPublished', totals.published],
        ['statRejected', totals.rejected],
        ['statUsers', totals.users],
        ['detailAll', totals.all],
        ['readerCount', totals.readers],
        ['authorCount', totals.authors]
      ].forEach(([id, number]) => {
        $(id).textContent = number.toLocaleString('ar-EG');
      });
  
      $('publishRate').textContent =
        (totals.all
          ? Math.round(totals.published / totals.all * 100)
          : 0
        ).toLocaleString('ar-EG') + '٪';
  
      $('reviewRate').textContent =
        (totals.all
          ? Math.round(
              (totals.published + totals.rejected) /
              totals.all * 100
            )
          : 0
        ).toLocaleString('ar-EG') + '٪';
    }
  
    function renderRecent() {
      const container = $('recentBooks');
      const recentBooks = state.books.slice(0, 5);
  
      container.innerHTML = recentBooks.length
        ? recentBooks.map((book) => `
            <div class="recent-row">
              ${bookCover(book, true)}
  
              <div class="recent-info">
                <strong>${esc(book.title)}</strong>
                <small>
                  ${esc(authorName(book))} · ${dateLabel(book.created_at)}
                </small>
              </div>
  
              ${statusBadge(book.status)}
            </div>
          `).join('')
        : empty('لسه مفيش روايات مسجلة في المنصة.');
    }
  
    function renderCharts() {
      const totals = counts();
  
      const max = Math.max(
        totals.pending,
        totals.published,
        totals.rejected,
        1
      );
  
      const rows = [
        ['pending', 'قيد المراجعة', totals.pending],
        ['published', 'منشور', totals.published],
        ['rejected', 'مرفوض', totals.rejected]
      ];
  
      $('statusChart').innerHTML = rows.map(
        ([key, label, number]) => `
          <div class="bar-row">
            <span class="bar-label">${label}</span>
  
            <div class="bar-track">
              <div
                class="bar-fill ${key}"
                style="width:${Math.round(number / max * 100)}%"
              ></div>
            </div>
  
            <strong class="bar-number">
              ${number.toLocaleString('ar-EG')}
            </strong>
          </div>
        `
      ).join('');
    }
  
    // ---------------------------------------------------------
    // 7. بطاقات الروايات
    // ---------------------------------------------------------
  
    function bookCard(book) {
      const status = book.status || 'pending';
  
      let actions = `
        <button
          type="button"
          class="btn btn-light"
          data-action="preview"
          data-id="${esc(book.id)}"
        >
          ▣ معاينة الرواية
        </button>
      `;
  
      if (status === 'pending') {
        actions += `
          <button
            type="button"
            class="btn btn-primary"
            data-action="approve"
            data-id="${esc(book.id)}"
          >
            ✓ قبول
          </button>
  
          <button
            type="button"
            class="btn btn-light"
            data-action="reject"
            data-id="${esc(book.id)}"
          >
            رفض
          </button>
        `;
      }
  
      if (status === 'published' || status === 'rejected') {
        actions += `
          <button
            type="button"
            class="btn btn-danger"
            data-action="delete"
            data-id="${esc(book.id)}"
          >
            حذف
          </button>
        `;
      }
  
      const priceLabel =
        book.price == null || Number(book.price) === 0
          ? 'مجاني'
          : `${esc(book.price)} ج.م`;
  
      return `
        <article
          class="book-card"
          data-book-card
          data-id="${esc(book.id)}"
          tabindex="0"
          role="group"
          aria-label="تفاصيل الرواية ${esc(book.title)}"
        >
          ${bookCover(book)}
  
          <div class="book-main">
            <h3 class="book-title">${esc(book.title)}</h3>
  
            <span class="book-author">
              ✍ ${esc(authorName(book))}
            </span>
  
            <span class="book-date">
              ${esc(book.category_name)} · ${dateLabel(book.created_at)}
            </span>
  
            <p class="book-desc">
              ${esc(book.description || 'لا يوجد وصف للرواية.')}
            </p>
  
            <div class="book-meta">
              ${statusBadge(status)}
              <span class="book-date">${priceLabel}</span>
            </div>
  
            <div class="book-actions">
              ${actions}
            </div>
          </div>
        </article>
      `;
    }
  
    function renderPublished() {
      const books = state.books.filter((book) =>
        book.status === 'published' &&
        matchesBook(book, $('publishedSearch').value)
      );
  
      const total = state.books.filter(
        (book) => book.status === 'published'
      ).length;
  
      $('publishedCount').textContent =
        total.toLocaleString('ar-EG') + ' رواية';
  
      $('publishedBooks').innerHTML = books.length
        ? books.map(bookCard).join('')
        : empty('لا توجد روايات منشورة تطابق البحث.');
    }
  
    function renderBooks() {
      const query = $('booksSearch').value;
      const selectedStatus = $('statusFilter').value;
  
      const books = state.books.filter((book) =>
        (selectedStatus === 'all' ||
          book.status === selectedStatus) &&
        matchesBook(book, query)
      );
  
      $('allBooksCount').textContent =
        state.books.length.toLocaleString('ar-EG') + ' رواية';
  
      $('allBooks').innerHTML = books.length
        ? books.map(bookCard).join('')
        : empty('لا توجد روايات تطابق البحث والتصفية.');
    }


    

    function renderRevisions() {
      const container = $('revisionsList');
      if (!container) return;
    
      if (state.revisionsLoadError) {
        container.innerHTML = `
          <div class="error-state">
            ${esc(state.revisionsLoadError)}
          </div>
        `;
        return;
      }
    
      const query = $('revisionsSearch')
        ? $('revisionsSearch').value.trim().toLocaleLowerCase('ar')
        : '';
    
      const revisions = (state.revisions || []).filter((revision) => {
        return [
          revision.current_title,
          revision.proposed_title,
          revision.author_name
        ].some((value) =>
          String(value || '').toLocaleLowerCase('ar').includes(query)
        );
      });
    
      container.innerHTML = revisions.length
        ? revisions.map((revision) => `
            <article
              class="revision-card revision-card-compact"
              data-revision-card
              data-revision-id="${esc(revision.id)}"
              tabindex="0"
              role="button"
              aria-label="عرض تفاصيل تعديلات ${esc(revision.current_title)}"
            >
              ${bookCover({
                title: revision.current_title,
                cover_path: revision.current_cover_path
              }, true)}
    
              <div class="revision-card-main">
                <div class="revision-card-header">
                  <div class="revision-card-heading">
                    <h3 class="revision-card-title">
                      ${esc(revision.current_title)}
                    </h3>
    
                    <p>✍ ${esc(revision.author_name)}</p>
                  </div>
    
                  <span class="revision-count">تعديل منتظر</span>
                </div>
    
                <div class="revision-card-summary">
                  <span>
                    <small>العنوان المقترح</small>
                    <strong>${esc(
                      revision.proposed_title || revision.current_title
                    )}</strong>
                  </span>
    
                  <span>
                    <small>التصنيف المقترح</small>
                    <strong>${esc(
                      revision.proposed_category_name || 'غير محدد'
                    )}</strong>
                  </span>
                </div>
    
                <div class="revision-card-footer">
                  <span>تاريخ الإرسال: ${dateLabel(revision.submitted_at)}</span>
                  <span class="revision-open-hint">عرض المقارنة ←</span>
                </div>
              </div>
            </article>
          `).join('')
        : empty(
            query
              ? 'لا توجد تعديلات تطابق البحث.'
              : 'لا توجد تعديلات مقترحة تحتاج إلى مراجعة.'
          );
    
      loadBookCovers(container);
    }


    

    function closeRevisionDetails() {
      const modal = $('revisionDetailsModal');
    
      if (!modal) return;
    
      modal.hidden = true;
      updateBodyScroll();
    }
        
    
    
function openRevisionDetails(revisionId) {
  const revision = (state.revisions || []).find(
    (item) => String(item.id) === String(revisionId)
  );

  if (!revision) {
    toast('التعديل غير موجود أو تم تحديث القائمة.');
    return;
  }

  const modal = $('revisionDetailsModal');
  const content = $('revisionDetailsContent');
  const subtitle = $('revisionDetailsSubtitle');

  if (!modal || !content) {
    toast('تعذر فتح نافذة تفاصيل التعديل.');
    return;
  }

  const currentTitle = revision.current_title || 'بدون عنوان';
  const proposedTitle = revision.proposed_title || currentTitle;

  const currentDescription =
    revision.current_description || 'لا يوجد وصف';

  const proposedDescription =
    revision.proposed_description || currentDescription;

  const currentCategory =
    revision.current_category_name || 'غير محدد';

  const proposedCategory =
    revision.proposed_category_name || currentCategory;

  const currentCover = revision.current_cover_path
    ? bookCover({
        title: currentTitle,
        cover_path: revision.current_cover_path
      })
    : '<div class="revision-no-cover">لا يوجد غلاف حالي</div>';

  const proposedCover = revision.proposed_cover_path
    ? bookCover({
        title: proposedTitle,
        cover_path: revision.proposed_cover_path
      })
    : '<div class="revision-no-cover">لم يتم اقتراح غلاف جديد</div>';

  const currentFile = revision.current_file_path
    ? 'يوجد ملف PDF'
    : 'لا يوجد ملف PDF';

  const proposedFile = revision.proposed_file_path
    ? 'يوجد ملف PDF مقترح'
    : 'لم يتم اقتراح ملف PDF جديد';


    // فحص الحقول التي تم تعديلها
const normalizeValue = (value) =>
String(value ?? '').trim();

const titleChanged =
normalizeValue(currentTitle) !== normalizeValue(proposedTitle);

const categoryChanged =
normalizeValue(currentCategory) !== normalizeValue(proposedCategory);

const descriptionChanged =
normalizeValue(currentDescription) !== normalizeValue(proposedDescription);

const coverChanged =
Boolean(revision.proposed_cover_path) &&
normalizeValue(revision.current_cover_path) !==
normalizeValue(revision.proposed_cover_path);

const fileChanged =
Boolean(revision.proposed_file_path) &&
normalizeValue(revision.current_file_path) !==
normalizeValue(revision.proposed_file_path);

  if (subtitle) {
    subtitle.textContent =
      `الكاتب: ${revision.author_name || 'كاتب غير معروف'}`;
  }

  content.innerHTML = `
    <div class="revision-details">

      <div class="revision-comparison-legend">
        <span>
          <span class="revision-legend-dot current"></span>
          النسخة الحالية المنشورة
        </span>

        <span>
          <span class="revision-legend-dot proposed"></span>
          التعديل المقترح
        </span>
      </div>

      <div class="revision-comparison-table-wrap">
        <table class="revision-comparison-table">
          <thead>
            <tr>
              <th scope="col">النسخة الحالية</th>
              <th scope="col">التعديل المقترح</th>
            </tr>
          </thead>

          <tbody>
            <tr class="${titleChanged ? 'revision-row-changed' : ''}">
              <td>
                <span class="revision-field-label">عنوان الرواية</span>
                <strong>${esc(currentTitle)}</strong>
              </td>

              <td>
                <span class="revision-field-label">عنوان الرواية</span>
                <strong>${esc(proposedTitle)}</strong>
              </td>
            </tr>

            <tr class="${categoryChanged ? 'revision-row-changed' : ''}">
              <td>
                <span class="revision-field-label">التصنيف</span>
                <span>${esc(currentCategory)}</span>
              </td>

              <td>
                <span class="revision-field-label">التصنيف</span>
                <span>${esc(proposedCategory)}</span>
              </td>
            </tr>

            <tr class="${descriptionChanged ? 'revision-row-changed' : ''}">
              <td>
                <span class="revision-field-label">الوصف</span>
                <p>${esc(currentDescription)}</p>
              </td>

              <td>
                <span class="revision-field-label">الوصف</span>
                <p>${esc(proposedDescription)}</p>
              </td>
            </tr>

            <tr class="${coverChanged ? 'revision-row-changed' : ''}">
              <td>
                <span class="revision-field-label">الغلاف الحالي</span>
                <div class="revision-comparison-cover">
                  ${currentCover}
                </div>
              </td>

              <td>
                <span class="revision-field-label">الغلاف المقترح</span>
                <div class="revision-comparison-cover">
                  ${proposedCover}
                </div>
              </td>
            </tr>

            <tr class="${fileChanged ? 'revision-row-changed' : ''}">
              <td>
                <span class="revision-field-label">ملف الرواية</span>
                <span>${esc(currentFile)}</span>
              </td>

              <td>
                <span class="revision-field-label">ملف الرواية</span>
                <span>${esc(proposedFile)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="revision-details-actions">
        <button
          type="button"
          class="btn btn-secondary"
          data-action="revision-preview"
          data-revision-id="${esc(revision.id)}"
        >
          معاينة التعديل المقترح
        </button>

        <button
          type="button"
          class="btn btn-primary"
          data-action="revision-approve"
          data-revision-id="${esc(revision.id)}"
        >
          الموافقة على التعديل
        </button>

        <button
          type="button"
          class="btn btn-danger"
          data-action="revision-reject"
          data-revision-id="${esc(revision.id)}"
        >
          رفض التعديل
        </button>
      </div>

    </div>
  `;

  modal.hidden = false;
  updateBodyScroll();

  loadBookCovers(content);
}
  
    // ---------------------------------------------------------
    // 8. نافذة تفاصيل الرواية
    // ---------------------------------------------------------
  
    function openBookDetails(bookId) {
      const book = state.books.find(
        (item) => String(item.id) === String(bookId)
      );
  
      if (!book) {
        toast('لم يتم العثور على الرواية. حدّث البيانات وحاول مجددًا.');
        return;
      }
  
      const status = book.status || 'pending';
  
      const priceLabel =
        book.price == null || Number(book.price) === 0
          ? 'مجاني'
          : `${esc(book.price)} ج.م`;
  
      let actions = `
        <button
          type="button"
          class="btn btn-light"
          data-action="preview"
          data-id="${esc(book.id)}"
        >
          ▣ معاينة الرواية
        </button>
      `;
  
      if (status === 'pending') {
        actions += `
          <button
            type="button"
            class="btn btn-primary"
            data-action="approve"
            data-id="${esc(book.id)}"
          >
            ✓ قبول ونشر
          </button>
  
          <button
            type="button"
            class="btn btn-light"
            data-action="reject"
            data-id="${esc(book.id)}"
          >
            رفض الرواية
          </button>
        `;
      }
  
      if (status === 'published' || status === 'rejected') {
        actions += `
          <button
            type="button"
            class="btn btn-danger"
            data-action="delete"
            data-id="${esc(book.id)}"
          >
            حذف الرواية
          </button>
        `;
      }
  
      $('bookDetailsContent').innerHTML = `
        <div class="book-details-main">
  
          <div class="book-details-cover">
            ${bookCover(book)}
          </div>
  
          <div class="book-details-info">
  
            <h3 class="book-details-title">
              ${esc(book.title || 'رواية بدون عنوان')}
            </h3>
  
            <p class="book-details-author">
              ✍ ${esc(authorName(book))}
            </p>
  
            <div class="book-details-meta">
              <span class="book-details-meta-item">
                التصنيف: ${esc(book.category_name || 'غير محدد')}
              </span>
  
              <span class="book-details-meta-item">
                تاريخ الإضافة: ${dateLabel(book.created_at)}
              </span>
  
              <span class="book-details-meta-item">
                السعر: ${priceLabel}
              </span>
            </div>
  
            <h4 class="book-details-description-title">
              نبذة عن الرواية
            </h4>
  
            <p class="book-details-description">
              ${esc(book.description || 'لا يوجد وصف لهذا الرواية.')}
            </p>
  
            <div class="book-details-status">
              <span class="book-details-status-label">
                حالة الرواية الحالية
              </span>
  
              ${statusBadge(status)}
            </div>
  
            <div class="book-details-actions">
              ${actions}
            </div>
  
          </div>
        </div>
      `;
  
      $('bookDetailsModal').hidden = false;
      loadBookCovers($('bookDetailsContent'));
      updateBodyScroll();
      $('closeBookDetails').focus();
    }
  
    function closeBookDetails() {
      $('bookDetailsModal').hidden = true;
      updateBodyScroll();
    }
  
    $('closeBookDetails').addEventListener(
      'click',
      closeBookDetails
    );
  
    $('bookDetailsModal').addEventListener('click', (event) => {
      if (event.target === $('bookDetailsModal')) {
        closeBookDetails();
      }
    });

    $('revisionDetailsModal').addEventListener('click', (event) => {
      if (event.target === $('revisionDetailsModal')) {
        closeRevisionDetails();
      }
    });
    
    $('closeRevisionDetails').addEventListener('click', () => {
      closeRevisionDetails();
    });

    $('usersTable').addEventListener('click', (event) => {
      if (event.target.closest('[data-action="copy-user"]')) {
        return;
      }
    
      const row = event.target.closest('[data-action="open-user"]');
    
      if (!row) return;
    
      openUserDetails(row.dataset.id);
    });
    
    
    $('usersTable').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
    
      const row = event.target.closest('[data-action="open-user"]');
    
      if (!row) return;
    
      event.preventDefault();
      openUserDetails(row.dataset.id);
    });
  
    // ---------------------------------------------------------
    // 9. نافذة تفاصيل المستخدم
    // ---------------------------------------------------------
  
    function openUserDetails(userId) {
      const user = state.users.find(
        (item) => String(item.id) === String(userId)
      );
    
      if (!user) {
        toast('لم يتم العثور على المستخدم. حدّث البيانات وحاول مجددًا.');
        return;
      }
    
      // الروايات الموجودة في المكتبة الشخصية للمستخدم
      const libraryBooks = (state.userBooks || [])
        .filter((item) => String(item.user_id) === String(user.id))
        .map((item) => ({
          ...item.book,
          added_at: item.added_at
        }))
        .filter((book) => book && book.status === 'published');
    
      // الروايات المنشورة التي ألّفها المستخدم
      const publishedBooks = state.books.filter(
        (book) =>
          String(book.author_id) === String(user.id) &&
          book.status === 'published'
      );
    
      const avatarUrl = user.avatar_path
        ? db.storage.from('avatars').getPublicUrl(user.avatar_path).data.publicUrl
        : '';
    
      const initial = (user.display_name || 'م').trim().charAt(0) || 'م';
    
      const roleClass = ['reader', 'author', 'admin'].includes(user.role)
        ? user.role
        : 'reader';
    
      // إنشاء كارت الرواية
      function renderUserBookCard(book, dateText, dateValue) {
        const price =
          book.price == null || Number(book.price) === 0
            ? 'مجاني'
            : `${esc(book.price)} ج.م`;
    
        return `
          <article class="book-card user-library-book-card">
    
            ${bookCover(book)}
    
            <div class="book-main">
    
              <h4 class="book-title">
                ${esc(book.title)}
              </h4>
    
              <p class="book-desc">
                ${esc(book.description || 'لا يوجد وصف للرواية.')}
              </p>
    
              <div class="user-library-book-category">
                <span>التصنيف</span>
                <strong>
                  ${esc(book.category_name || 'غير محدد')}
                </strong>
              </div>
    
              <div class="user-library-book-meta">
    
                <span class="user-library-book-price">
                  ${price}
                </span>
    
                ${
                  dateValue
                    ? `<span class="user-library-book-date">
                        ${dateText} ${dateLabel(dateValue)}
                      </span>`
                    : ''
                }
    
              </div>
    
              <div class="book-actions">
                <button
                  type="button"
                  class="btn btn-light"
                  data-action="preview"
                  data-id="${esc(book.id)}"
                >
                  ▣ معاينة الرواية
                </button>
              </div>
    
            </div>
          </article>
        `;
      }
    
      // كروت المكتبة الشخصية
      const libraryBooksHtml = libraryBooks.length
        ? libraryBooks.map((book) =>
            renderUserBookCard(
              book,
              'أُضيفت للمكتبة في',
              book.added_at
            )
          ).join('')
        : empty('لا توجد روايات منشورة في المكتبة الشخصية لهذا المستخدم حتى الآن.');
    
      // كروت الروايات المنشورة للمؤلف
      const publishedBooksHtml = publishedBooks.length
        ? publishedBooks.map((book) =>
            renderUserBookCard(
              book,
              'تاريخ النشر:',
              book.created_at
            )
          ).join('')
        : empty('لم ينشر هذا الكاتب أي روايات حتى الآن.');
    
      // التبويب الثاني يظهر للكاتب فقط
      const hasAuthorTab = user.role === 'author';
    
      $('userDetailsContent').innerHTML = `
    
        <div class="user-profile-summary">
    
          <div class="user-profile-avatar">
            ${
              avatarUrl
                ? `<img src="${esc(avatarUrl)}" alt="صورة المستخدم"
                       onerror="this.remove()">`
                : esc(initial)
            }
          </div>
    
          <div class="user-profile-info">
    
            <h3>${esc(user.display_name || 'مستخدم بدون اسم')}</h3>
    
            <p>
              <span class="role-badge role-${roleClass}">
                ${esc(roleLabels[user.role] || 'غير محدد')}
              </span>
            </p>
    
            <p>معرّف الحساب:</p>
    
            <div class="user-id-box">
              ${esc(user.id)}
            </div>
    
          </div>
    
        </div>
    
    
        <div class="user-detail-stats">
    
          <div class="user-detail-stat">
            <span>روايات في مكتبته</span>
            <strong>
              ${libraryBooks.length.toLocaleString('ar-EG')}
            </strong>
          </div>
    
          <div class="user-detail-stat">
            <span>روايات منشورة من تأليفه</span>
            <strong>
              ${publishedBooks.length.toLocaleString('ar-EG')}
            </strong>
          </div>
    
        </div>
    
    
        <div class="user-library-tabs" role="tablist">
    
          <button
            type="button"
            class="user-library-tab active"
            data-user-tab="library"
            role="tab"
            aria-selected="true"
          >
            مكتبته
            <span>${libraryBooks.length.toLocaleString('ar-EG')}</span>
          </button>
    
          ${
            hasAuthorTab
              ? `
                <button
                  type="button"
                  class="user-library-tab"
                  data-user-tab="published"
                  role="tab"
                  aria-selected="false"
                >
                  رواياته المنشورة
                  <span>${publishedBooks.length.toLocaleString('ar-EG')}</span>
                </button>
              `
              : ''
          }
    
        </div>
    
    
        <section
          class="user-library-panel"
          data-user-panel="library"
          role="tabpanel"
        >
    
          <div class="user-books-heading">
    
            <div>
              <h3>مكتبته الشخصية</h3>
              <p>الروايات المنشورة التي أضافها المستخدم إلى مكتبته.</p>
            </div>
    
            <span class="count-pill">
              ${libraryBooks.length.toLocaleString('ar-EG')} رواية
            </span>
    
          </div>
    
          <div class="user-books-grid user-library-books-grid">
            ${libraryBooksHtml}
          </div>
    
        </section>
    
    
        ${
          hasAuthorTab
            ? `
              <section
                class="user-library-panel"
                data-user-panel="published"
                role="tabpanel"
                hidden
              >
    
                <div class="user-books-heading">
    
                  <div>
                    <h3>رواياته المنشورة</h3>
                    <p>جميع الروايات المنشورة التي قام هذا الكاتب بتأليفها.</p>
                  </div>
    
                  <span class="count-pill">
                    ${publishedBooks.length.toLocaleString('ar-EG')} رواية
                  </span>
    
                </div>
    
                <div class="user-books-grid user-library-books-grid">
                  ${publishedBooksHtml}
                </div>
    
              </section>
            `
            : ''
        }
    
      `;
    
    
      // التحكم في التبديل بين التبويبات
      const tabButtons = $('userDetailsContent').querySelectorAll(
        '[data-user-tab]'
      );
    
      const tabPanels = $('userDetailsContent').querySelectorAll(
        '[data-user-panel]'
      );
    
      tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const selectedTab = button.dataset.userTab;
    
          tabButtons.forEach((tab) => {
            const isActive = tab.dataset.userTab === selectedTab;
    
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
          });
    
          tabPanels.forEach((panel) => {
            panel.hidden = panel.dataset.userPanel !== selectedTab;
          });
        });
      });
    
    
      $('userDetailsModal').hidden = false;
    
      loadBookCovers($('userDetailsContent'));
    
      updateBodyScroll();
    
      $('closeUserDetails').focus();
    }
  
    function closeUserDetails() {
      $('userDetailsModal').hidden = true;
      updateBodyScroll();
    }
  
    $('closeUserDetails').addEventListener(
      'click',
      closeUserDetails
    );
  
    $('userDetailsModal').addEventListener('click', (event) => {
      if (event.target === $('userDetailsModal')) {
        closeUserDetails();
      }
    });
  
    // ---------------------------------------------------------
    // 10. عرض جميع بيانات لوحة التحكم
    // ---------------------------------------------------------
  
    function renderUsers() {
      const query = $('usersSearch').value
        .trim()
        .toLocaleLowerCase('ar');
    
      const selectedRole = $('roleFilter').value;
    
      const users = state.users.filter((user) => {
        const matchesRole =
          selectedRole === 'all' || user.role === selectedRole;
    
        const matchesSearch =
          !query ||
          [
            user.display_name,
            user.id,
            user.role
          ].some((value) =>
            String(value || '')
              .toLocaleLowerCase('ar')
              .includes(query)
          );
    
        return matchesRole && matchesSearch;
      });
    
      $('usersCount').textContent =
        state.users.length.toLocaleString('ar-EG') + ' مستخدم';
    
      $('usersTable').innerHTML = users.length
        ? users.map((user) => {
            const avatarUrl = user.avatar_path
              ? db.storage.from('avatars').getPublicUrl(user.avatar_path).data.publicUrl
              : '';
    
            const displayName =
              user.display_name || 'مستخدم بدون اسم';
    
            const initial = displayName.trim().charAt(0) || '؟';
    
            const libraryCount = user.library_books_count || 0;
            const publishedCount = user.published_books_count || 0;
    
            return `
              <tr
                class="user-clickable-row"
                data-action="open-user"
                data-id="${esc(user.id)}"
                tabindex="0"
                role="button"
                aria-label="عرض تفاصيل ${esc(displayName)}"
              >
    
                <!-- المستخدم -->
                <td>
                  <div class="user-table-profile">
    
                    <div class="user-table-avatar">
                      ${
                        avatarUrl
                          ? `
                            <img
                              src="${esc(avatarUrl)}"
                              alt="${esc(displayName)}"
                            >
                          `
                          : `
                            <span>${esc(initial)}</span>
                          `
                      }
                    </div>
    
                    <div class="user-table-info">
                      <span class="user-table-name">
                        ${esc(displayName)}
                      </span>
                    </div>
    
                  </div>
                </td>
    
                <!-- نوع الحساب -->
                <td>
                  <span class="role-badge role-${esc(user.role)}">
                    ${esc(roleLabels[user.role] || user.role || 'غير محدد')}
                  </span>
                </td>
    
                <!-- الإحصائيات -->
                <td>
                  <div class="user-table-stats">
    
                    ${
                      user.role === 'author'
                        ? `
                          <div class="user-table-stat">
                            <span class="user-table-stat-value">
                              ${publishedCount.toLocaleString('ar-EG')}
                            </span>
                            <span class="user-table-stat-label">
                              رواية منشورة
                            </span>
                          </div>
                        `
                        : ''
                    }
    
                    <div class="user-table-stat">
                      <span class="user-table-stat-value">
                        ${libraryCount.toLocaleString('ar-EG')}
                      </span>
                      <span class="user-table-stat-label">
                        في مكتبته
                      </span>
                    </div>
    
                  </div>
                </td>
    
                <!-- معرّف المستخدم -->
                <td>
                  <button
                    type="button"
                    class="table-action"
                    data-action="copy-user"
                    data-id="${esc(user.id)}"
                  >
                    <span>نسخ المعرّف</span>
                  </button>
                </td>
    
              </tr>
            `;
          }).join('')
        : `
            <tr>
              <td colspan="4">
                ${empty('لا توجد حسابات تطابق البحث.')}
              </td>
            </tr>
          `;
    }



    // =========================================
// تحميل طلبات الشراء ومبيعات المنصة
// =========================================

async function loadPurchaseAndSalesData() {
  try {
    const [purchasesResult, salesResult] = await Promise.all([
      db
        .from('purchase_requests')
        .select('*')
        .order('submitted_at', { ascending: false }),

      db
        .from('author_sales')
        .select('*')
        .order('sold_at', { ascending: false })
    ]);

    if (purchasesResult.error) throw purchasesResult.error;
    if (salesResult.error) throw salesResult.error;

    state.purchaseRequests = purchasesResult.data || [];
    state.sales = salesResult.data || [];

    renderPurchaseRequests();
    renderPlatformEarnings();

  } catch (error) {
    console.error('Load purchases and sales error:', error);
    toast('حدث خطأ أثناء تحميل طلبات الشراء والأرباح.');
  }
}




// =========================================
// تحميل طلبات سحب الأرباح
// =========================================

async function loadWithdrawalsData() {
  const container = $('withdrawalsContent');

  if (container) {
    container.innerHTML = `
      <div class="loading-state">
        جارٍ تحميل طلبات السحب…
      </div>
    `;
  }

  try {
    const { data, error } = await db
      .from('author_withdrawals')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error) throw error;

    state.withdrawals = data || [];
    state.withdrawalsLoadError = '';

    renderWithdrawals();

  } catch (error) {
    console.error('Load withdrawals error:', error);

    state.withdrawals = [];
    state.withdrawalsLoadError =
      'تعذر تحميل طلبات السحب: ' + getErrorMessage(error);

    if (container) {
      container.innerHTML = `
        <div class="error-state">
          ${esc(state.withdrawalsLoadError)}
        </div>
      `;
    }
  }
}





// =========================================
// نوافذ مراجعة طلبات السحب
// =========================================

function openWithdrawalCompleteModal(withdrawal) {
  state.activeWithdrawal = withdrawal;
  state.withdrawalProofFile = null;

  $('withdrawalProofInput').value = '';
  $('confirmWithdrawalComplete').disabled = true;
  $('withdrawalProofPreview').hidden = true;
  $('withdrawalProofPreview').innerHTML = '';

  const amount = Number(withdrawal.amount || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  $('withdrawalCompleteDetails').innerHTML = `
    <div>
      <span>مبلغ السحب</span>
      <strong>${amount} جنيه</strong>
    </div>
    <div>
      <span>اسم صاحب الحساب</span>
      <strong>${esc(withdrawal.account_name || 'غير محدد')}</strong>
    </div>
    <div>
      <span>بيانات التحويل</span>
      <strong dir="ltr">${esc(withdrawal.account_identifier || '')}</strong>
    </div>
  `;

  $('withdrawalCompleteModal').hidden = false;
  updateBodyScroll();
}

function closeWithdrawalCompleteModal() {
  $('withdrawalCompleteModal').hidden = true;

  const preview = $('withdrawalProofPreview');

  if (preview.dataset.objectUrl) {
    URL.revokeObjectURL(preview.dataset.objectUrl);
  }

  preview.dataset.objectUrl = '';
  preview.innerHTML = '';
  preview.hidden = true;

  $('withdrawalProofInput').value = '';
  $('confirmWithdrawalComplete').disabled = true;

  state.activeWithdrawal = null;
  state.withdrawalProofFile = null;

  updateBodyScroll();
}

function openWithdrawalRejectModal(withdrawal) {
  state.activeWithdrawal = withdrawal;

  $('withdrawalRejectReason').value = '';
  $('confirmWithdrawalReject').disabled = true;

  const amount = Number(withdrawal.amount || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  $('withdrawalRejectDetails').innerHTML = `
    <div>
      <span>مبلغ السحب</span>
      <strong>${amount} جنيه</strong>
    </div>
    <div>
      <span>اسم صاحب الحساب</span>
      <strong>${esc(withdrawal.account_name || 'غير محدد')}</strong>
    </div>
  `;

  $('withdrawalRejectModal').hidden = false;
  updateBodyScroll();

  $('withdrawalRejectReason').focus();
}

function closeWithdrawalRejectModal() {
  $('withdrawalRejectModal').hidden = true;
  $('withdrawalRejectReason').value = '';
  $('confirmWithdrawalReject').disabled = true;

  state.activeWithdrawal = null;

  updateBodyScroll();
}


// اختيار إيصال التحويل والتحقق منه
$('withdrawalProofInput').addEventListener('change', (event) => {
  const file = event.target.files?.[0];

  state.withdrawalProofFile = null;
  $('confirmWithdrawalComplete').disabled = true;

  const preview = $('withdrawalProofPreview');

  if (preview.dataset.objectUrl) {
    URL.revokeObjectURL(preview.dataset.objectUrl);
  }

  preview.dataset.objectUrl = '';
  preview.innerHTML = '';
  preview.hidden = true;

  if (!file) return;

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];

  if (!allowedTypes.includes(file.type)) {
    toast('نوع الملف غير مدعوم. اختر صورة أو ملف PDF.');
    event.target.value = '';
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    toast('حجم الإيصال يجب ألا يتجاوز 10 ميجابايت.');
    event.target.value = '';
    return;
  }

  state.withdrawalProofFile = file;

  const fileSize = (file.size / (1024 * 1024)).toFixed(2);

  if (file.type.startsWith('image/')) {
    const objectUrl = URL.createObjectURL(file);
    preview.dataset.objectUrl = objectUrl;

    preview.innerHTML = `
      <img src="${objectUrl}" alt="معاينة إيصال التحويل">
      <div>
        <strong>${esc(file.name)}</strong>
        <small>${fileSize} MB</small>
      </div>
    `;
  } else {
    preview.innerHTML = `
      <div>
        <strong>📄 ${esc(file.name)}</strong>
        <small>${fileSize} MB · ملف PDF</small>
      </div>
    `;
  }

  preview.hidden = false;
  $('confirmWithdrawalComplete').disabled = false;
});


// تفعيل زر الرفض عند كتابة السبب
$('withdrawalRejectReason').addEventListener('input', () => {
  $('confirmWithdrawalReject').disabled =
    !$('withdrawalRejectReason').value.trim();
});


// أزرار إغلاق نافذة تأكيد التحويل
$('closeWithdrawalCompleteModal').addEventListener(
  'click',
  closeWithdrawalCompleteModal
);

$('cancelWithdrawalComplete').addEventListener(
  'click',
  closeWithdrawalCompleteModal
);

$('withdrawalCompleteModal').addEventListener('click', (event) => {
  if (event.target === $('withdrawalCompleteModal')) {
    closeWithdrawalCompleteModal();
  }
});


// أزرار إغلاق نافذة الرفض
$('closeWithdrawalRejectModal').addEventListener(
  'click',
  closeWithdrawalRejectModal
);

$('cancelWithdrawalReject').addEventListener(
  'click',
  closeWithdrawalRejectModal
);

$('withdrawalRejectModal').addEventListener('click', (event) => {
  if (event.target === $('withdrawalRejectModal')) {
    closeWithdrawalRejectModal();
  }

});

// =========================================
// تأكيد رفض طلب السحب
// =========================================

$('confirmWithdrawalReject').addEventListener('click', async () => {
  const withdrawal = state.activeWithdrawal;
  const reason = $('withdrawalRejectReason').value.trim();
  const button = $('confirmWithdrawalReject');

  if (!withdrawal) {
    toast('لم يتم تحديد طلب السحب.');
    return;
  }

  if (withdrawal.status !== 'pending') {
    toast('هذا الطلب لم يعد قيد الانتظار.');
    return;
  }

  if (!reason) {
    toast('يجب كتابة سبب رفض الطلب.');
    return;
  }

  button.disabled = true;

  try {
    const { error } = await db.rpc('admin_review_withdrawal', {
      p_withdrawal_id: withdrawal.id,
      p_decision: 'rejected',
      p_admin_notes: reason
    });

    if (error) throw error;

    closeWithdrawalRejectModal();

    await loadWithdrawalsData();

    toast('تم رفض طلب السحب وإعادة المبلغ إلى رصيد الكاتب.');

  } catch (error) {
    console.error('Withdrawal rejection error:', error);

    toast(getErrorMessage(error));

    button.disabled = false;
  }
});



// =========================================
// تأكيد تحويل أرباح الكاتب ورفع الإيصال
// =========================================



$('confirmWithdrawalComplete').addEventListener('click', async () => {
  const withdrawal = state.activeWithdrawal;
  const file = state.withdrawalProofFile;
  const button = $('confirmWithdrawalComplete');

  if (!withdrawal) {
    toast('لم يتم تحديد طلب السحب.');
    return;
  }

  if (withdrawal.status !== 'pending') {
    toast('هذا الطلب لم يعد قيد الانتظار.');
    return;
  }

  if (!file) {
    toast('يجب اختيار إيصال التحويل أولًا.');
    return;
  }

  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
  };

  const extension = extensions[file.type];

  if (!extension) {
    toast('نوع ملف الإيصال غير مدعوم.');
    return;
  }

  button.disabled = true;

  let proofPath = null;
  let approvalCompleted = false;

  try {
    // 1. رفع الإيصال إلى Storage

    proofPath =
      `${withdrawal.author_id}/${withdrawal.id}/` +
      `${Date.now()}-receipt.${extension}`;

    const { error: uploadError } = await db.storage
      .from('withdrawal-proofs')
      .upload(proofPath, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: '0'
      });

    if (uploadError) throw uploadError;


    // 2. تسجيل الموافقة على الطلب

    const { error: reviewError } = await db.rpc(
      'admin_review_withdrawal',
      {
        p_withdrawal_id: withdrawal.id,
        p_decision: 'approved',
        p_admin_notes: null
      }
    );

    if (reviewError) throw reviewError;

    approvalCompleted = true;


    // 3. تسجيل اكتمال التحويل وإرفاق الإيصال

    const { error: completeError } = await db.rpc(
      'admin_complete_withdrawal',
      {
        p_withdrawal_id: withdrawal.id,
        p_proof_path: proofPath
      }
    );

    if (completeError) throw completeError;


    // نجاح العملية بالكامل

    closeWithdrawalCompleteModal();

    await loadWithdrawalsData();

    toast('تم تأكيد التحويل وتسجيل الطلب كمدفوع.');

  } catch (error) {
    console.error('Withdrawal completion error:', error);

    // الموافقة تمت لكن تسجيل الدفع فشل
    if (approvalCompleted) {
      closeWithdrawalCompleteModal();

      await loadWithdrawalsData();

      toast(
        'تم رفع الإيصال والموافقة على الطلب، لكن تعذر تسجيل اكتمال الدفع. راجع الطلب قبل إعادة المحاولة. ' +
        getErrorMessage(error)
      );

      return;
    }

    // لو فشل تسجيل الموافقة بعد رفع الإيصال،
    // نحاول حذف الملف الذي تم رفعه
    if (proofPath) {
      const { error: removeError } = await db.storage
        .from('withdrawal-proofs')
        .remove([proofPath]);

      if (removeError) {
        console.error('Receipt cleanup error:', removeError);
      }
    }

    toast(getErrorMessage(error));

    button.disabled = false;
  }
});



// =========================================
// عرض طلبات سحب الأرباح
// =========================================

function renderWithdrawals() {
  const container = $('withdrawalsContent');
  if (!container) return;

  const withdrawals = state.withdrawals || [];


  const visibleWithdrawals = withdrawals.filter(item =>
    state.withdrawalsView === 'pending'
      ? item.status === 'pending'
      : item.status !== 'pending'
  );


  // تحديث عدد الطلبات في القائمة الجانبية
  const navCount = $('navWithdrawals');

  if (navCount) {
    navCount.textContent = withdrawals.filter(
      item => item.status === 'pending'
    ).length.toLocaleString('en-US');
  }

  if (state.withdrawalsLoadError) {
    container.innerHTML = `
      <div class="error-state">
        ${esc(state.withdrawalsLoadError)}
      </div>
    `;
    return;
  }

  if (!visibleWithdrawals.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>لا توجد طلبات سحب حتى الآن.</p>
      </div>
    `;
    return;
  }

  const statusLabels = {
    pending: 'قيد المراجعة',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
    paid: 'تم التحويل'
  };

  const methodLabels = {
    instapay: 'إنستاباي',
    wallet: 'محفظة إلكترونية'
  };

  const formatMoney = amount =>
    new Intl.NumberFormat('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(amount || 0));

  container.innerHTML = `
    <div class="withdrawals-list">
      ${visibleWithdrawals.map(withdrawal => {
        const author = state.users.find(
          user => String(user.id) === String(withdrawal.author_id)
        );

        const authorName =
          author?.display_name || 'كاتب غير معروف';

        const status =
          statusLabels[withdrawal.status] ||
          withdrawal.status ||
          'غير معروف';

        const method =
          methodLabels[withdrawal.payout_method] ||
          withdrawal.payout_method ||
          'غير محدد';

        // إضافة @instapay إلى اسم المستخدم تلقائياً
        const accountIdentifier =
          withdrawal.payout_method === 'instapay'
            ? String(withdrawal.account_identifier || '')
                .trim()
                .replace(/\s+/g, '')
                .replace(/@instapay$/i, '') + '@instapay'
            : withdrawal.account_identifier;

        return `
          <article class="withdrawal-card">

            <div class="withdrawal-card-header">
              <div>
                <h3>${esc(authorName)}</h3>
                <span>طلب سحب أرباح</span>
              </div>

              <span class="withdrawal-status ${esc(withdrawal.status)}">
                ${esc(status)}
              </span>
            </div>

            <div class="withdrawal-amount">
              ${formatMoney(withdrawal.amount)}
              <span>جنيه</span>
            </div>

            <div class="withdrawal-details">

              <div>
                <span>وسيلة السحب</span>
                <strong>${esc(method)}</strong>
              </div>

              <div>
                <span>اسم صاحب الحساب</span>
                <strong>${esc(withdrawal.account_name)}</strong>
              </div>

              <div>
                <span>بيانات التحويل</span>
                <strong dir="ltr">${esc(accountIdentifier)}</strong>
              </div>

              <div>
                <span>تاريخ الطلب</span>
                <strong>${dateLabel(withdrawal.requested_at)}</strong>
              </div>

              ${
                withdrawal.admin_notes
                  ? `
                    <div class="withdrawal-notes">
                      <span>ملاحظات الإدارة</span>
                      <strong>${esc(withdrawal.admin_notes)}</strong>
                    </div>
                  `
                  : ''
              }

              ${
                withdrawal.transfer_reference
                  ? `
                    <div>
                      <span>مرجع التحويل</span>
                      <strong>${esc(withdrawal.transfer_reference)}</strong>
                    </div>
                  `
                  : ''
              }

              ${
                withdrawal.processed_at
                  ? `
                    <div>
                      <span>تاريخ المعالجة</span>
                      <strong>${dateLabel(withdrawal.processed_at)}</strong>
                    </div>
                  `
                  : ''
              }

            </div>

            
              ${
                withdrawal.status === 'pending'
                  ? `
                    <div class="withdrawal-actions">
                      <button
                        type="button"
                        class="withdrawal-btn approve"
                        data-withdrawal-action="approve"
                        data-id="${esc(withdrawal.id)}">
                        ✓ موافقة على السحب
                      </button>
              
                      <button
                        type="button"
                        class="withdrawal-btn reject"
                        data-withdrawal-action="reject"
                        data-id="${esc(withdrawal.id)}">
                        ✕ رفض الطلب
                      </button>
                    </div>
                  `
                  : ''
              }


          </article>
        `;
      }).join('')}
    </div>
  `;
}







// =========================================
// عرض طلبات الشراء
// =========================================

async function renderPurchaseRequests() {
  const container = $('purchaseRequestsList');
  if (!container) return;

  

  const requests = state.purchaseRequests || [];

const currentView = state.purchaseRequestsView || 'pending';

const visibleRequests = requests.filter(request =>
  currentView === 'pending'
    ? request.status === 'pending'
    : request.status !== 'pending'
);

// تحديث عداد الطلبات المعلقة في القائمة الجانبية
const navCount = $('navPurchases');

if (navCount) {
  navCount.textContent = requests.filter(
    request => request.status === 'pending'
  ).length.toLocaleString('en-US');
}

if (!visibleRequests.length) {
  container.innerHTML = `
    <div class="empty-state">
      <p>${
        currentView === 'pending'
          ? 'لا توجد طلبات شراء معلقة حاليًا.'
          : 'لا توجد عمليات شراء تمت مراجعتها حتى الآن.'
      }</p>
    </div>
  `;
  return;
}



  const cards = await Promise.all(visibleRequests.map(async (request) => {
    let proofUrl = '';

    if (request.proof_path) {
      const { data, error } = await db.storage
        .from('purchase-proofs')
        .createSignedUrl(request.proof_path, 3600);

      if (!error && data) {
        proofUrl = data.signedUrl;
      }
    }

    const statusLabels = {
      pending: 'قيد المراجعة',
      approved: 'مقبول',
      rejected: 'مرفوض'
    };

    const status = statusLabels[request.status] || request.status;

    return `
      <article class="purchase-card">
        <div class="purchase-card-header">
          <div>
            <h3>${esc(request.book_title || 'رواية بدون عنوان')}</h3>
            <span>${esc(request.buyer_name || 'غير معروف')}</span>
          </div>

          <span class="purchase-status ${esc(request.status)}">
            ${esc(status)}
          </span>
        </div>

        <div class="purchase-card-details">
          <div>
            <span>قيمة الطلب</span>
            <strong>${Number(request.book_price || 0).toLocaleString('ar-EG')} ج.م</strong>
          </div>

          <div>
            <span>رقم التحويل</span>
            <strong>${esc(request.transfer_phone || '—')}</strong>
          </div>

          <div>
            <span>تاريخ الطلب</span>
            <strong>${esc(dateLabel(request.submitted_at) || '—')}</strong>
          </div>
        </div>

        <div class="purchase-card-proof">
          ${
            proofUrl
              ? `<a href="${esc(proofUrl)}" target="_blank" rel="noopener noreferrer">معاينة إثبات التحويل</a>`
              : '<span>تعذرت معاينة إثبات التحويل</span>'
          }
        </div>

        ${
          request.status === 'pending'
            ? `
              <div class="purchase-card-actions">
                <button type="button"
                  class="btn btn-primary"
                  data-action="purchase-approve"
                  data-id="${esc(request.id)}">
                  قبول الطلب
                </button>

                <button type="button"
                  class="btn btn-danger"
                  data-action="purchase-reject"
                  data-id="${esc(request.id)}">
                  <span style="
                    color: #ffffff !important;
                    -webkit-text-fill-color: #ffffff !important;
                    display: inline !important;
                    visibility: visible !important;
                  ">رفض الطلب</span>
                </button>
              </div>
            `
            : request.status === 'rejected' && request.rejection_reason
              ? `<p class="purchase-rejection-reason">سبب الرفض: ${esc(request.rejection_reason)}</p>`
              : ''
        }
      </article>
    `;
  }));

  container.innerHTML = cards.join('');
}







// =========================================
// أرباح المنصة فقط
// =========================================





function renderPlatformEarnings() {
  const container = $("earningsContent");
  if (!container) return;

  const period = state.earningsPeriod || "month";
  const now = new Date();
  const sales = state.sales || [];

  const periodLabels = {
    day: "اليوم",
    week: "آخر 7 أيام",
    month: "آخر 12 شهرًا",
    year: "آخر 5 سنوات"
  };

  const formatMoney = amount =>
    new Intl.NumberFormat("ar-EG", {
      maximumFractionDigits: 2
    }).format(Number(amount || 0));

  const getDateKey = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatFullDate = date =>
    date.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  // تجهيز الفترات بنفس نظام لوحة الكاتب
  const buckets = [];

  if (period === "day") {
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
        key: `${getDateKey(start)}-${i * 4}`,
        label: `${startHour}:00`,
        tooltipLabel: `${startHour}:00 — ${endHour}:00`,
        value: 0,
        salesCount: 0,
        grossSales: 0
      });
    }
  }

  if (period === "week") {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      buckets.push({
        key: getDateKey(date),
        label: date.toLocaleDateString("ar-EG", {
          weekday: "short",
          day: "numeric"
        }),
        tooltipLabel: formatFullDate(date),
        value: 0,
        salesCount: 0,
        grossSales: 0
      });
    }
  }

  if (period === "month") {
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

      buckets.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString("ar-EG", {
          month: "short"
        }),
        tooltipLabel: date.toLocaleDateString("ar-EG", {
          month: "long",
          year: "numeric"
        }),
        value: 0,
        salesCount: 0,
        grossSales: 0
      });
    }
  }

  if (period === "year") {
    const currentYear = now.getFullYear();

    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i;

      buckets.push({
        key: String(year),
        label: String(year),
        tooltipLabel: `سنة ${year}`,
        value: 0,
        salesCount: 0,
        grossSales: 0
      });
    }
  }

  // تحديد الفترة المناسبة لكل عملية بيع
  sales.forEach(sale => {
    if (!sale.sold_at) return;

    const date = new Date(sale.sold_at);
    if (Number.isNaN(date.getTime())) return;

    let key;

    if (period === "day") {
      const hour = Math.floor(date.getHours() / 4) * 4;
      key = `${getDateKey(date)}-${hour}`;
    } else if (period === "week") {
      key = getDateKey(date);
    } else if (period === "month") {
      key = `${date.getFullYear()}-${date.getMonth()}`;
    } else {
      key = String(date.getFullYear());
    }

    const bucket = buckets.find(item => item.key === key);
    if (!bucket) return;

    bucket.salesCount += 1;
    bucket.value += Number(sale.platform_fee || 0);
    bucket.grossSales += Number(sale.gross_price || 0);
  });

  const filteredSales = sales.filter(sale => {
    if (!sale.sold_at) return false;

    const date = new Date(sale.sold_at);
    if (Number.isNaN(date.getTime())) return false;

    if (period === "day") {
      return getDateKey(date) === getDateKey(now);
    }

    if (period === "week") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 6);
      return date >= start;
    }

    if (period === "month") {
      const start = new Date(
        now.getFullYear(),
        now.getMonth() - 11,
        1
      );
      return date >= start;
    }

    return date.getFullYear() >= now.getFullYear() - 4;
  }).sort((a, b) =>
    new Date(b.sold_at) - new Date(a.sold_at)
  );

  const totalFees = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.platform_fee || 0),
    0
  );

  const totalGross = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.gross_price || 0),
    0
  );

  const salesCount = filteredSales.length;

  const averageFee = salesCount
    ? totalFees / salesCount
    : 0;

  // المقياس الرأسي: يبدأ من 50 بتدرج 10 ويتوسع تلقائيًا
  const maxValue = Math.max(
    ...buckets.map(bucket => bucket.value),
    0
  );

  const axisStep = 10 * Math.max(1, Math.ceil(maxValue / 50));
  const roundedMax = axisStep * 5;

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

  const points = buckets.map((bucket, index) => {
    const x = buckets.length === 1
      ? width / 2
      : margin.left +
        (index / (buckets.length - 1)) * plotWidth;

    const y = margin.top + plotHeight -
      (bucket.value / roundedMax) * plotHeight;

    return { x, y, bucket };
  });

  const svgNS = "http://www.w3.org/2000/svg";

  const createSvgElement = (tag, attributes = {}) => {
    const element = document.createElementNS(svgNS, tag);

    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });

    return element;
  };

  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: "100%",
    role: "img",
    "aria-label": "رسم بياني لعمولات المنصة"
  });

  // خطوط الشبكة والتدريج الرأسي
  for (let i = 0; i <= 5; i++) {
    const y = margin.top +
      (plotHeight / 5) * (5 - i);

    svg.appendChild(createSvgElement("line", {
      x1: margin.left,
      y1: y,
      x2: width - margin.right,
      y2: y,
      stroke: "#e8eeeb",
      "stroke-width": 1
    }));

    const label = createSvgElement("text", {
      x: margin.left - 12,
      y: y + 5,
      "text-anchor": "end",
      fill: "#89938f",
      "font-size": 13
    });

    label.textContent = Math.round(
      axisStep * i
    ).toLocaleString("ar-EG");

    svg.appendChild(label);
  }

  // الخط البياني
  const pathData = points.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
  ).join(" ");

  if (points.length) {
    svg.appendChild(createSvgElement("path", {
      d: pathData,
      fill: "none",
      stroke: "#104b3d",
      "stroke-width": 4,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }));
  }

  // نافذة التفاصيل الاحترافية
  const tooltip = document.createElement("div");
  tooltip.className = "earnings-chart-tooltip";

  tooltip.innerHTML = `
    <span class="earnings-tooltip-date"></span>

    <div class="earnings-tooltip-row">
      <span class="earnings-tooltip-label">عمليات البيع</span>
      <span class="earnings-tooltip-value tooltip-sales-count"></span>
    </div>

    <div class="earnings-tooltip-divider"></div>

    <div class="earnings-tooltip-row">
      <span class="earnings-tooltip-label">إجمالي المبيعات</span>
      <span class="earnings-tooltip-value tooltip-gross"></span>
    </div>

    <div class="earnings-tooltip-divider"></div>

    <div class="earnings-tooltip-row">
      <span class="earnings-tooltip-label">عمولة المنصة</span>
      <span class="earnings-tooltip-value tooltip-platform-fee"></span>
    </div>
  `;

  const tooltipDate = tooltip.querySelector(
    ".earnings-tooltip-date"
  );

  const tooltipSales = tooltip.querySelector(
    ".tooltip-sales-count"
  );

  const tooltipGross = tooltip.querySelector(
    ".tooltip-gross"
  );

  const tooltipFee = tooltip.querySelector(
    ".tooltip-platform-fee"
  );

  const chart = document.createElement("div");
  chart.className = "earnings-chart";

  const showTooltip = (event, bucket) => {
    tooltipDate.textContent =
      bucket.tooltipLabel || bucket.label;

    tooltipSales.textContent =
      bucket.salesCount.toLocaleString("ar-EG");

    tooltipGross.textContent =
      `${formatMoney(bucket.grossSales)} جنيه`;

    tooltipFee.textContent =
      `${formatMoney(bucket.value)} جنيه`;

    const rect = chart.getBoundingClientRect();

    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top -
      tooltip.offsetHeight - 14;

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

  // النقاط والتواريخ
  points.forEach(point => {
    const circle = createSvgElement("circle", {
      cx: point.x,
      cy: point.y,
      r: 6,
      fill: "#104b3d",
      stroke: "#ffffff",
      "stroke-width": 2,
      style: "cursor:pointer"
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

    const label = createSvgElement("text", {
      x: point.x,
      y: height - 20,
      "text-anchor": "middle",
      fill: "#89938f",
      "font-size": 13
    });

    label.textContent = point.bucket.label;
    svg.appendChild(label);
  });

  chart.append(svg, tooltip);

  // واجهة الأرباح وسجل المبيعات
  container.innerHTML = `
    <div class="earnings-period-switch">
      ${Object.entries({
        day: "يومي",
        week: "أسبوعي",
        month: "شهري",
        year: "سنوي"
      }).map(([key, label]) => `
        <button
          type="button"
          class="${period === key ? "active" : ""}"
          data-action="earning-period"
          data-period="${key}"
        >${label}</button>
      `).join("")}
    </div>

    <div class="earnings-stats">
      <div class="earnings-stat-card">
        <span>إجمالي عمولات المنصة</span>
        <strong>${formatMoney(totalFees)} جنيه</strong>
        <small>${periodLabels[period]}</small>
      </div>

      <div class="earnings-stat-card">
        <span>عمليات البيع الناجحة</span>
        <strong>${salesCount.toLocaleString("ar-EG")}</strong>
        <small>${periodLabels[period]}</small>
      </div>

      <div class="earnings-stat-card">
        <span>متوسط العمولة للعملية</span>
        <strong>${formatMoney(averageFee)} جنيه</strong>
        <small>لكل عملية بيع</small>
      </div>
    </div>

    <div class="earnings-chart-card">
      <h3>حركة إيرادات المنصة</h3>
      <p>عمولات المنصة من عمليات البيع الناجحة</p>
    </div>

    <div class="earnings-sales-card">
      <h3>سجل عمليات البيع</h3>

      <div class="earnings-table-wrapper">
        <table class="earnings-table">
          <thead>
            <tr>
              <th>الرواية</th>
              <th>التاريخ</th>
              <th>سعر البيع</th>
              <th>عمولة المنصة</th>
            </tr>
          </thead>

          <tbody>
            ${filteredSales.length ? filteredSales.map(sale => `
              <tr>
                <td>${esc(sale.book_title || "رواية بدون عنوان")}</td>
                <td>${dateLabel(sale.sold_at)}</td>
                <td>${formatMoney(sale.gross_price)} جنيه</td>
                <td class="platform-income">
                  ${formatMoney(sale.platform_fee)} جنيه
                </td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="4" class="earnings-empty">
                  لا توجد عمليات بيع خلال هذه الفترة.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const chartCard = container.querySelector(
    ".earnings-chart-card"
  );

  if (chartCard) {
    chartCard.appendChild(chart);
  }
}










  
    
function renderAll() {
  renderStats();
  renderRecent();
  renderPublished();
  renderBooks();
  renderUsers();
  renderCharts();
  renderRevisions();

  $('navPublished').textContent = counts().published;
  $('navRevisions').textContent = state.revisions.length;
  $('revisionsCount').textContent =
    state.revisions.length + ' تعديل';

  $('footerYear').textContent = new Date().getFullYear();
}

  
    // ---------------------------------------------------------
    // 11. التنقل بين صفحات لوحة التحكم
    // ---------------------------------------------------------
  
    function go(tab) {
      if (!pageLabels[tab]) return;
  
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle(
          'active',
          panel.id === `panel-${tab}`
        );
      });
  
      document.querySelectorAll('.nav-item').forEach((button) => {
        button.classList.toggle(
          'active',
          button.dataset.tab === tab
        );
      });
  
      $('pageTitle').textContent = pageLabels[tab];
      $('breadcrumbCurrent').textContent = pageLabels[tab];
  
      $('sidebar').classList.remove('open');
      document.body.classList.remove('menu-open');
  
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  
    // ---------------------------------------------------------
    // 12. معاينة الرواية
    // ---------------------------------------------------------
  

    async function previewBook(book) {
      if (!book.file_path) {
        throw new Error('لا يوجد ملف PDF مسجل لهذه الرواية.');
      }
    
      // فتح التبويب فور الضغط لتقليل احتمالية منعه من المتصفح.
      const previewWindow = window.open('about:blank', '_blank');
    
      try {
        const { data, error } = await db.storage
          .from('book-files')
          .createSignedUrl(book.file_path, 90);
    
        if (error) {
          throw new Error(
            'تعذرت معاينة الرواية: ' + getErrorMessage(error)
          );
        }
    
        if (!data?.signedUrl) {
          throw new Error('لم يتم إنشاء رابط معاينة الرواية.');
        }
    
        if (previewWindow) {
          previewWindow.location.href = data.signedUrl;
        } else {
          // بديل إذا منع المتصفح فتح تبويب جديد.
          location.href = data.signedUrl;
        }
      } catch (error) {
        if (previewWindow && !previewWindow.closed) {
          previewWindow.close();
        }
    
        console.error('Preview error:', error);
        throw error;
      }
    }    
  
    // ---------------------------------------------------------
    // 13. قبول الرواية أو رفضه
    // ---------------------------------------------------------
  

    async function changeStatus(book, status, rejectionReason = null) {
      if (state.profile?.role !== 'admin') {
        throw new Error('غير مصرح بتنفيذ العملية.');
      }
    
      if (!['published', 'rejected'].includes(status)) {
        throw new Error('حالة الرواية غير صحيحة.');
      }
    
      if (status === 'rejected' && !rejectionReason?.trim()) {
        throw new Error('اكتب سبب الرفض أولًا.');
      }
    
      const updateData = {
        status,
        rejection_reason:
          status === 'rejected' ? rejectionReason.trim() : null
      };
    
      const { data, error } = await db
        .from('books')
        .update(updateData)
        .eq('id', book.id)
        .eq('status', 'pending')
        .select('id');
    
      if (error) {
        console.error('Update book error:', error);
    
        throw new Error(
          'تعذر تحديث حالة الرواية: ' + getErrorMessage(error)
        );
      }
    
      if (!data || data.length !== 1) {
        await loadData();
    
        throw new Error(
          'لم تتغير حالة الرواية. ربما تمت مراجعته بالفعل.'
        );
      }
    
      closeBookDetails();
    
      await loadData();
    
      toast(
        status === 'published'
          ? 'تمت الموافقة على الرواية ونشرها.'
          : 'تم رفض الرواية وحفظ سبب الرفض.'
      );
    }


    
let rejectionBook = null;

function openRejectionModal(book) {
  rejectionBook = book;

  $('rejectionBookTitle').textContent =
    book.title || 'رواية بدون عنوان';

  $('rejectionReason').value = '';
  $('rejectionModal').hidden = false;

  updateBodyScroll();
  $('rejectionReason').focus();
}


let rejectionRevision = null;

function openRevisionRejectionModal(revision) {
  rejectionRevision = revision;

  $('revisionRejectionBookTitle').textContent =
    revision.current_title || 'رواية بدون عنوان';

  $('revisionRejectionReason').value = '';
  $('revisionRejectionModal').hidden = false;

  updateBodyScroll();
  $('revisionRejectionReason').focus();
}

function closeRevisionRejectionModal() {
  $('revisionRejectionModal').hidden = true;
  rejectionRevision = null;

  updateBodyScroll();
}

function closeRejectionModal() {
  $('rejectionModal').hidden = true;
  rejectionBook = null;

  updateBodyScroll();
}

$('closeRejectionModal').addEventListener(
  'click',
  closeRejectionModal
);

$('cancelRejection').addEventListener(
  'click',
  closeRejectionModal
);

$('rejectionModal').addEventListener('click', (event) => {
  if (event.target === $('rejectionModal')) {
    closeRejectionModal();
  }
});

$('closeRevisionRejectionModal').addEventListener(
  'click',
  closeRevisionRejectionModal
);

$('cancelRevisionRejection').addEventListener(
  'click',
  closeRevisionRejectionModal
);

$('revisionRejectionModal').addEventListener('click', (event) => {
  if (event.target === $('revisionRejectionModal')) {
    closeRevisionRejectionModal();
  }
});

$('submitRejection').addEventListener('click', async () => {
  const reason = $('rejectionReason').value.trim();

  if (!rejectionBook) return;

  if (!reason) {
    toast('اكتب سبب الرفض قبل التأكيد.');
    $('rejectionReason').focus();
    return;
  }

  const button = $('submitRejection');
  const book = rejectionBook;

  button.disabled = true;
  button.textContent = 'جارٍ حفظ الرفض...';

  try {
    await changeStatus(book, 'rejected', reason);
    closeRejectionModal();
  } catch (error) {
    console.error('Reject book failed:', error);
    toast(error.message || 'تعذر رفض الرواية.');
  } finally {
    button.disabled = false;
    button.textContent = 'تأكيد الرفض';
  }
});


$('submitRevisionRejection').addEventListener('click', async () => {
  const reason = $('revisionRejectionReason').value.trim();

  if (!rejectionRevision) return;

  if (!reason) {
    toast('اكتب سبب رفض التعديل قبل التأكيد.');
    $('revisionRejectionReason').focus();
    return;
  }

  const button = $('submitRevisionRejection');
  const revision = rejectionRevision;

  button.disabled = true;
  button.textContent = 'جارٍ حفظ الرفض...';

  try {
    const { error } = await db.rpc('admin_review_book_revision', {
      p_revision_id: revision.id,
      p_decision: 'rejected',
      p_rejection_reason: reason
    });

    if (error) {
      throw new Error(getErrorMessage(error));
    }

    closeRevisionRejectionModal();
    await loadData();

    toast('تم رفض التعديل وحفظ السبب بنجاح.');
  } catch (error) {
    console.error('Reject revision failed:', error);
    toast(error.message || 'تعذر رفض التعديل.');
  } finally {
    button.disabled = false;
    button.textContent = 'تأكيد الرفض';
  }
});


    
  
    // ---------------------------------------------------------
    // 14. حذف الرواية بأمان
    // ---------------------------------------------------------
  
    async function deleteBook(book) {
      if (state.profile?.role !== 'admin') {
        throw new Error('غير مصرح بتنفيذ العملية.');
      }
  
      if (!book?.id) {
        throw new Error('معرّف الرواية غير صحيح.');
      }
  
      const { data, error } = await db
        .from('books')
        .delete()
        .eq('id', book.id)
        .select('id');
  
      if (error) {
        console.error('DELETE BOOK DATABASE ERROR:', error);
  
        throw new Error(
          'فشل حذف سجل الرواية: ' + getErrorMessage(error)
        );
      }
  
      if (!data || data.length !== 1) {
        throw new Error(
          'لم يتم حذف الرواية. لم تُرجع قاعدة البيانات سجلًا محذوفًا؛ تحقق من صلاحيات RLS.'
        );
      }
  
      // حذف السجل نجح؛ أغلق النافذة وأزل الرواية من الواجهة.
      closeBookDetails();
  
      state.books = state.books.filter(
        (item) => String(item.id) !== String(book.id)
      );
  
      renderAll();
  
      const files = [
        book.cover_path
          ? { bucket: 'book-covers', path: book.cover_path }
          : null,
  
        book.file_path
          ? { bucket: 'book-files', path: book.file_path }
          : null
      ].filter(Boolean);
  
      const cleanupErrors = [];
  
      for (const file of files) {
        const { error: storageError } = await db.storage
          .from(file.bucket)
          .remove([file.path]);
  
        if (storageError) {
          console.error(
            `Storage cleanup failed (${file.bucket}):`,
            storageError
          );
  
          cleanupErrors.push(file.bucket);
        }
      }
  
      if (cleanupErrors.length > 0) {
        showNotice(
          'تم حذف سجل الرواية، لكن تعذر حذف بعض الملفات من التخزين: ' +
          [...new Set(cleanupErrors)].join('، ') +
          '. راجع صلاحيات Storage.',
          'error'
        );
  
        toast('تم حذف سجل الرواية، مع وجود مشكلة في تنظيف الملفات.');
        return;
      }
  
      toast('تم حذف الرواية وملفاته المرتبطة بنجاح.');
    }
  
    // ---------------------------------------------------------
    // 15. ربط أزرار التنقل والبحث
    // ---------------------------------------------------------
  
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        go(button.dataset.tab);
      });
    });
  
    document.querySelectorAll('[data-go]').forEach((button) => {
      button.addEventListener('click', () => {
        go(button.dataset.go);
      });
    });
  
    $('menuToggle').addEventListener('click', () => {
      document.body.classList.toggle('menu-open');
      $('sidebar').classList.toggle('open');
    });
  
    $('refreshBtn').addEventListener('click', loadData);
    $('publishedRefresh').addEventListener('click', loadData);
  
    $('publishedSearch').addEventListener('input', renderPublished);
    $('booksSearch').addEventListener('input', renderBooks);
    $('statusFilter').addEventListener('change', renderBooks);

    // Custom status filter dropdown
(() => {
  const dropdown = $('statusFilterDropdown');
  const trigger = $('statusFilterTrigger');
  const menu = $('statusFilterMenu');
  const nativeSelect = $('statusFilter');
  const label = $('statusFilterLabel');

  if (!dropdown || !trigger || !menu || !nativeSelect || !label) return;

  const options = menu.querySelectorAll('.status-filter-option');

  function closeDropdown() {
    dropdown.classList.remove('open');
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  function openDropdown() {
    dropdown.classList.add('open');
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  }

  function syncDropdown() {
    const selectedValue = nativeSelect.value;
    const selectedOption = [...options].find(
      option => option.dataset.value === selectedValue
    );

    if (!selectedOption) return;

    label.textContent = selectedOption.querySelector('span:nth-child(2)').textContent;

    options.forEach(option => {
      const isActive = option.dataset.value === selectedValue;

      option.classList.toggle('active', isActive);
      option.setAttribute('aria-selected', String(isActive));
    });
  }

  trigger.addEventListener('click', () => {
    if (menu.hidden) {
      openDropdown();
    } else {
      closeDropdown();
    }
  });

  options.forEach(option => {
    option.addEventListener('click', () => {
      nativeSelect.value = option.dataset.value;

      nativeSelect.dispatchEvent(new Event('change', {
        bubbles: true
      }));

      syncDropdown();
      closeDropdown();
    });
  });

  document.addEventListener('click', event => {
    if (!dropdown.contains(event.target)) {
      closeDropdown();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeDropdown();
    }
  });

  nativeSelect.addEventListener('change', syncDropdown);

  syncDropdown();
})();

    $('usersSearch').addEventListener('input', renderUsers);
    $('roleFilter').addEventListener('change', renderUsers);

    // Custom role filter dropdown
(() => {
  const dropdown = $('roleFilterDropdown');
  const trigger = $('roleFilterTrigger');
  const menu = $('roleFilterMenu');
  const nativeSelect = $('roleFilter');
  const label = $('roleFilterLabel');

  if (!dropdown || !trigger || !menu || !nativeSelect || !label) {
    return;
  }

  const options = menu.querySelectorAll('.role-filter-option');

  function closeDropdown() {
    dropdown.classList.remove('open');
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  function openDropdown() {
    dropdown.classList.add('open');
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  }

  function syncDropdown() {
    const selectedValue = nativeSelect.value;

    const selectedOption = [...options].find(
      option => option.dataset.value === selectedValue
    );

    if (!selectedOption) return;

    label.textContent =
      selectedOption.querySelector('.role-option-label').textContent;

    options.forEach(option => {
      const isActive = option.dataset.value === selectedValue;

      option.classList.toggle('active', isActive);
      option.setAttribute('aria-selected', String(isActive));
    });
  }

  trigger.addEventListener('click', () => {
    if (menu.hidden) {
      openDropdown();
    } else {
      closeDropdown();
    }
  });

  options.forEach(option => {
    option.addEventListener('click', () => {
      nativeSelect.value = option.dataset.value;

      nativeSelect.dispatchEvent(
        new Event('change', { bubbles: true })
      );

      syncDropdown();
      closeDropdown();
    });
  });

  document.addEventListener('click', event => {
    if (!dropdown.contains(event.target)) {
      closeDropdown();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeDropdown();
    }
  });

  nativeSelect.addEventListener('change', syncDropdown);

  syncDropdown();
})();


    $('revisionsSearch').addEventListener('input', renderRevisions);
    $('revisionsRefresh').addEventListener('click', loadData);

  
    // ---------------------------------------------------------
    // 16. التعامل مع الضغط على بطاقات الروايات
    // ---------------------------------------------------------
  



document.addEventListener('click', async (event) => {

  const button = event.target.closest(
    '[data-action], [data-withdrawal-action]'
  );

  if (!button) {
    const revisionCard = event.target.closest('[data-revision-card]');

    if (revisionCard) {
      openRevisionDetails(revisionCard.dataset.revisionId);
      return;
    }

    const card = event.target.closest('[data-book-card]');

    if (card) {
      openBookDetails(card.dataset.id);
    }

    return;
  }

  const action =
    button.dataset.action || button.dataset.withdrawalAction;

  const { id } = button.dataset;


  // =========================================
  // مراجعة طلبات سحب الأرباح
  // =========================================

  const withdrawalAction = button.dataset.withdrawalAction;

  if (
    withdrawalAction === 'approve' ||
    withdrawalAction === 'reject'
  ) {
    const withdrawal = (state.withdrawals || []).find(
      item => String(item.id) === String(id)
    );

    if (!withdrawal) {
      toast('طلب السحب غير موجود أو تم تحديثه.');
      return;
    }

    if (withdrawal.status !== 'pending') {
      toast('هذا الطلب لم يعد قيد الانتظار.');
      return;
    }

    if (withdrawalAction === 'approve') {
      openWithdrawalCompleteModal(withdrawal);
      return;
    }

    if (withdrawalAction === 'reject') {
      openWithdrawalRejectModal(withdrawal);
      return;
    }
  }


  // =========================================
  // فلاتر أرباح المنصة
  // =========================================

  if (action === 'earning-period') {
    state.earningsPeriod = button.dataset.period;
    renderPlatformEarnings();
    return;
  }


  // =========================================
  // مراجعة طلبات الشراء
  // =========================================

  if (action === 'purchase-approve') {
    const request = state.purchaseRequests.find(
      (item) => String(item.id) === String(id)
    );

    if (!request) {
      toast('طلب الشراء غير موجود أو تم تحديثه.');
      return;
    }

    confirm(
      {
        title: 'قبول طلب الشراء',
        text: `هل تريد قبول طلب شراء «${request.book_title}»؟ سيتم إضافة الرواية إلى مكتبة المشتري وتسجيل عملية البيع.`,
        accept: 'نعم، اقبل الطلب',
        danger: false
      },
      async () => {
        try {
          const { error } = await db.rpc('admin_review_purchase', {
            p_request_id: request.id,
            p_decision: 'approved',
            p_rejection_reason: null
          });

          if (error) {
            throw new Error(getErrorMessage(error));
          }

          await loadData();
          await loadPurchaseAndSalesData();

          toast('تم قبول الطلب وإضافة الرواية إلى مكتبة المشتري.');
        } catch (error) {
          console.error('Purchase approval failed:', error);
          toast(error.message || 'تعذر قبول طلب الشراء.');
        }
      }
    );

    return;
  }

  if (action === 'purchase-reject') {
    const request = state.purchaseRequests.find(
      (item) => String(item.id) === String(id)
    );

    if (!request) {
      toast('طلب الشراء غير موجود أو تم تحديثه.');
      return;
    }

    const reason = window.prompt(
      `اكتب سبب رفض طلب شراء «${request.book_title}»:`
    );

    if (reason === null) return;

    if (!reason.trim()) {
      toast('يجب كتابة سبب رفض الطلب.');
      return;
    }

    try {
      const { error } = await db.rpc('admin_review_purchase', {
        p_request_id: request.id,
        p_decision: 'rejected',
        p_rejection_reason: reason.trim()
      });

      if (error) {
        throw new Error(getErrorMessage(error));
      }

      await loadPurchaseAndSalesData();

      toast('تم رفض طلب الشراء بنجاح.');
    } catch (error) {
      console.error('Purchase rejection failed:', error);
      toast(error.message || 'تعذر رفض طلب الشراء.');
    }

    return;
  }


  // =========================================
  // إجراءات مراجعة تعديلات الروايات المنشورة
  // =========================================

  if (action && action.startsWith('revision-')) {
    const revision = (state.revisions || []).find(
      (item) => String(item.id) === String(button.dataset.revisionId)
    );

    if (!revision) {
      toast('التعديل غير موجود أو تم تحديث القائمة.');
      return;
    }

    try {
      if (action === 'revision-preview') {
        const book = state.books.find(
          (item) => String(item.id) === String(revision.book_id)
        );

        if (!book) {
          toast('الرواية الأصلية غير موجودة.');
          return;
        }

        await previewBook({
          ...book,
          title: revision.proposed_title || book.title,
          description:
            revision.proposed_description || book.description,
          cover_path:
            revision.proposed_cover_path || book.cover_path,
          file_path:
            revision.proposed_file_path || book.file_path
        });

        return;
      }

      if (action === 'revision-approve') {
        confirm(
          {
            title: 'الموافقة على تعديل الرواية',
            text:
              `هل تريد اعتماد التعديلات المقترحة على «${revision.current_title}»؟`,
            accept: 'نعم، اعتمد التعديل',
            danger: false
          },
          async () => {
            const { error } = await db.rpc(
              'admin_review_book_revision',
              {
                p_revision_id: revision.id,
                p_decision: 'approved',
                p_rejection_reason: null
              }
            );

            if (error) {
              throw new Error(getErrorMessage(error));
            }

            await loadData();
            closeRevisionDetails();
            toast('تم اعتماد التعديلات بنجاح.');
          }
        );

        return;
      }

      if (action === 'revision-reject') {
        openRevisionRejectionModal(revision);
        return;
      }
    } catch (error) {
      console.error('Revision action failed:', error);
      toast(error.message || 'حدث خطأ أثناء تنفيذ الإجراء.');
    }

    return;
  }


  if (action === 'user-details') {
    openUserDetails(id);
    return;
  }

  if (action === 'copy-user') {
    try {
      await navigator.clipboard.writeText(id);
      toast('تم نسخ معرّف الحساب.');
    } catch (error) {
      console.error('Copy user ID failed:', error);

      toast(
        'تعذر النسخ تلقائيًا؛ يمكنك نسخ المعرّف من الجدول.'
      );
    }

    return;
  }


  const book = state.books.find(
    (item) => String(item.id) === String(id)
  );

  if (!book) return;

  try {
    if (action === 'preview') {
      await previewBook(book);
      return;
    }

    if (action === 'approve') {
      confirm(
        {
          title: 'الموافقة على الرواية',
          text: `هل تريد نشر «${book.title}»؟ ستظهر الرواية ضمن الروايات المنشورة.`,
          accept: 'نعم، انشر الرواية',
          danger: false
        },
        () => changeStatus(book, 'published')
      );

      return;
    }

    if (action === 'reject') {
      openRejectionModal(book);
      return;
    }

    if (action === 'delete') {
      confirm(
        {
          title: 'حذف الرواية نهائيًا',
          text:
            `سيتم حذف سجل «${book.title}» ثم محاولة حذف ملف PDF والغلاف المرتبطين به. لا يمكن التراجع عن حذف السجل.`,
          accept: 'حذف نهائي',
          danger: true
        },
        () => deleteBook(book)
      );
    }

  } catch (error) {
    console.error('Action execution failed:', error);
    toast(error.message || 'حدث خطأ أثناء تنفيذ العملية.');
  }
});






  
    // ---------------------------------------------------------
    // 17. دعم لوحة المفاتيح وإغلاق النوافذ
    // ---------------------------------------------------------
  
    
document.addEventListener('keydown', (event) => {
  // فتح تفاصيل بطاقة الرواية أو التعديل باستخدام Enter أو Space.
  if (event.key === 'Enter' || event.key === ' ') {
    const revisionCard = event.target.closest?.('[data-revision-card]');

    if (revisionCard && event.target === revisionCard) {
      event.preventDefault();
      openRevisionDetails(revisionCard.dataset.revisionId);
      return;
    }

    const card = event.target.closest?.('[data-book-card]');

    if (card && event.target === card) {
      event.preventDefault();
      openBookDetails(card.dataset.id);
      return;
    }
  }

  if (event.key !== 'Escape') return;

  if (!$('confirmModal').hidden) {
    closeConfirm();
    return;
  }

  if (!$('revisionRejectionModal').hidden) {
    closeRevisionRejectionModal();
    return;
  }

  if (!$('rejectionModal').hidden) {
    closeRejectionModal();
    return;
  }

  if (!$('revisionDetailsModal').hidden) {
    closeRevisionDetails();
    return;
  }

  if (!$('bookDetailsModal').hidden) {
    closeBookDetails();
    return;
  }

  if (!$('userDetailsModal').hidden) {
    closeUserDetails();
  }
});
  
    // ---------------------------------------------------------
    // 18. بدء تشغيل لوحة التحكم
    // ---------------------------------------------------------
  
    (async function initDashboard() {
      try {
        const isAdmin = await requireAdmin();
  
        if (isAdmin) {
          await loadData();
        }
      } catch (error) {
        console.error('Dashboard initialization failed:', error);
  
        showNotice(
          'تعذر تشغيل لوحة التحكم. افتح Console لمعرفة تفاصيل الخطأ.',
          'error'
        );
      }
    })();

// التبديل بين الطلبات المعلقة وسجل العمليات
document.addEventListener('click', function (event) {
  const button = event.target.closest('[data-withdrawals-view]');
  if (!button) return;

  event.preventDefault();

  state.withdrawalsView = button.dataset.withdrawalsView;

  document.querySelectorAll('[data-withdrawals-view]').forEach(item => {
    item.classList.toggle(
      'active',
      item.dataset.withdrawalsView === state.withdrawalsView
    );
  });

  renderWithdrawals();
}, true);


document.addEventListener('click', function (event) {
  const button = event.target.closest('[data-purchases-view]');
  if (!button) return;

  event.preventDefault();

  state.purchaseRequestsView = button.dataset.purchasesView;

  document.querySelectorAll('[data-purchases-view]').forEach(item => {
    item.classList.toggle(
      'active',
      item.dataset.purchasesView === state.purchaseRequestsView
    );
  });

  renderPurchaseRequests();
}, true);

  
  })();

  
