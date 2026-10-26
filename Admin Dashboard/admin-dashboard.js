
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
  
    const $ = (id) => document.getElementById(id);
  
    const state = {
      user: null,
      profile: null,
      books: [],
      users: [],
      categories: [],
      revisions: [],
      confirmAction: null,
      toastTimer: null
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
      statistics: 'الإحصائيات'
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

  const anyModalOpen =
    (bookModal && !bookModal.hidden) ||
    (userModal && !userModal.hidden) ||
    (rejectionModal && !rejectionModal.hidden) ||
    (revisionRejectionModal && !revisionRejectionModal.hidden) ||
    (revisionDetailsModal && !revisionDetailsModal.hidden) ||
    (confirmModal && !confirmModal.hidden);

  document.body.style.overflow = anyModalOpen ? 'hidden' : '';
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
      const { data, error } = await db.auth.getUser();
  
      if (error || !data.user) {
        location.replace('/Auth/auth.html?mode=login');
        return false;
      }
  
      state.user = data.user;
  
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('id, display_name, role, avatar_path')
        .eq('id', state.user.id)
        .maybeSingle();
  
      if (profileError || !profile) {
        console.error('Profile verification failed:', profileError);
  
        showNotice(
          'تعذر التحقق من بيانات الحساب وصلاحياته.',
          'error'
        );
  
        return false;
      }
  
      state.profile = profile;
  
      if (state.profile.role !== 'admin') {
        showNotice(
          'هذه الصفحة مخصصة لمدير المنصة فقط.',
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
  const [booksRes, usersRes, categoriesRes, revisionsRes] =
    await Promise.all([
      db.from('books')
        .select(
          'id, author_id, category_id, title, description, cover_path, file_path, status, price, rejection_reason, created_at'
        )
        .order('created_at', { ascending: false }),

      db.from('profiles')
        .select('id, display_name, role, avatar_path'),

      db.from('categories')
        .select('id, name'),

      db.from('book_revisions')
        .select(
          'id, book_id, author_id, proposed_category_id, proposed_title, proposed_description, proposed_cover_path, proposed_file_path, status, rejection_reason, submitted_at, reviewed_at, reviewed_by'
        )
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
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
            <tr>
              <td>
                <span class="revision-field-label">عنوان الرواية</span>
                <strong>${esc(currentTitle)}</strong>
              </td>

              <td>
                <span class="revision-field-label">عنوان الرواية</span>
                <strong>${esc(proposedTitle)}</strong>
              </td>
            </tr>

            <tr>
              <td>
                <span class="revision-field-label">التصنيف</span>
                <span>${esc(currentCategory)}</span>
              </td>

              <td>
                <span class="revision-field-label">التصنيف</span>
                <span>${esc(proposedCategory)}</span>
              </td>
            </tr>

            <tr>
              <td>
                <span class="revision-field-label">الوصف</span>
                <p>${esc(currentDescription)}</p>
              </td>

              <td>
                <span class="revision-field-label">الوصف</span>
                <p>${esc(proposedDescription)}</p>
              </td>
            </tr>

            <tr>
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

            <tr>
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
  
      const userBooks = state.books.filter(
        (book) => String(book.author_id) === String(user.id)
      );
  
      const avatarUrl = user.avatar_path
        ? db.storage.from('avatars').getPublicUrl(user.avatar_path).data.publicUrl
        : '';
  
      const initial = (user.display_name || 'م').trim().charAt(0) || 'م';
  
      const published = userBooks.filter(
        (book) => book.status === 'published'
      ).length;
  
      const pending = userBooks.filter(
        (book) => book.status === 'pending'
      ).length;
  
      const rejected = userBooks.filter(
        (book) => book.status === 'rejected'
      ).length;
  
      const roleClass = ['reader', 'author', 'admin'].includes(user.role)
        ? user.role
        : 'reader';
  
      const booksHtml = userBooks.length
        ? userBooks.map((book) => `
            <article class="book-card">
              ${bookCover(book)}
  
              <div class="book-main">
                <h4 class="book-title">${esc(book.title)}</h4>
  
                <span class="book-author">
                  ${esc(roleLabels[user.role] || 'مستخدم')}
                </span>
  
                <span class="book-date">
                  أُضيف في ${dateLabel(book.created_at)}
                </span>
  
                <p class="book-desc">
                  ${esc(book.description || 'لا يوجد وصف للرواية.')}
                </p>
  
                <div class="book-meta">
                  ${statusBadge(book.status)}
  
                  <span class="book-date">
                    ${
                      book.price == null || Number(book.price) === 0
                        ? 'مجاني'
                        : `${esc(book.price)} ج.م`
                    }
                  </span>
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
          `).join('')
        : empty(
            user.role === 'reader'
              ? 'هذا الحساب قارئ ولا توجد روايات مرتبطة به ككاتب.'
              : 'لم يضف هذا المستخدم أي روايات حتى الآن.'
          );
  
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
            <div class="user-id-box">${esc(user.id)}</div>
          </div>
        </div>
  
        <div class="user-detail-stats">
  
          <div class="user-detail-stat">
            <span>إجمالي الروايات</span>
            <strong>${userBooks.length.toLocaleString('ar-EG')}</strong>
          </div>
  
          <div class="user-detail-stat">
            <span>روايات منشورة</span>
            <strong>${published.toLocaleString('ar-EG')}</strong>
          </div>
  
          <div class="user-detail-stat">
            <span>قيد المراجعة</span>
            <strong>${pending.toLocaleString('ar-EG')}</strong>
          </div>
  
        </div>
  
        <div class="user-books-heading">
          <div>
            <h3>روايات المستخدم</h3>
            <p>تظهر الروايات المنشورة والمعلقة والمرفوضة.</p>
          </div>
  
          <span class="count-pill">
            ${userBooks.length.toLocaleString('ar-EG')} رواية
          </span>
        </div>
  
        ${
          rejected
            ? `<p class="privacy-note">الروايات المرفوضة: ${rejected.toLocaleString('ar-EG')}</p>`
            : ''
        }
  
        <div class="user-books-grid">
          ${booksHtml}
        </div>
      `;
  
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
        ? users.map((user) => `
            <tr>
              <td>
                <div class="user-row-actions">
                  <button
                    type="button"
                    class="table-action"
                    data-action="user-details"
                    data-id="${esc(user.id)}"
                  >
                    عرض التفاصيل ←
                  </button>
  
                  <button
                    type="button"
                    class="table-action"
                    data-action="copy-user"
                    data-id="${esc(user.id)}"
                  >
                    نسخ المعرّف
                  </button>
                </div>
              </td>
  
              <td>
                <span class="role-badge role-${esc(user.role)}">
                  ${esc(roleLabels[user.role] || user.role || 'غير محدد')}
                </span>
              </td>
  
              <td>
                <div class="id-cell" title="${esc(user.id)}">
                  ${esc(user.id)}
                </div>
              </td>
  
              <td>
                <button
                  type="button"
                  class="table-action"
                  data-action="copy-user"
                  data-id="${esc(user.id)}"
                >
                  نسخ المعرّف
                </button>
              </td>
            </tr>
          `).join('')
        : `
            <tr>
              <td colspan="4">
                ${empty('لا توجد حسابات تطابق البحث.')}
              </td>
            </tr>
          `;
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
    $('usersSearch').addEventListener('input', renderUsers);
    $('roleFilter').addEventListener('change', renderUsers);
    $('revisionsSearch').addEventListener('input', renderRevisions);
    $('revisionsRefresh').addEventListener('click', loadData);

  
    // ---------------------------------------------------------
    // 16. التعامل مع الضغط على بطاقات الروايات
    // ---------------------------------------------------------
  
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
  

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
  
      const { action, id } = button.dataset;

      
      // إجراءات مراجعة تعديلات الروايات المنشورة
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
  
  })();