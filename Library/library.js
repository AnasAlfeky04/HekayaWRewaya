
const SUPABASE_URL = "https://aibgixalrifqbsotiogu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const bookGrid = document.getElementById("libraryBookGrid");
const categoryBox = document.getElementById("libraryCategories");
const searchInput = document.getElementById("librarySearch");
const clearSearchBtn = document.getElementById("clearSearch");
const sortSelect = document.getElementById("librarySort");
const resultsCount = document.getElementById("libraryResultsCount");
const messageBox = document.getElementById("libraryMessage");
const pagination = document.getElementById("libraryPagination");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const homeBtn = document.getElementById("homeBtn");
const readerModal = document.getElementById("readerModal");
const readerTitle = document.getElementById("readerTitle");
const readerMessage = document.getElementById("readerMessage");
const readerFrame = document.getElementById("readerFrame");
const closeReaderBtn = document.getElementById("closeReader");

const bookDetailsModal = document.getElementById("bookDetailsModal");
const closeBookDetailsBtn = document.getElementById("closeBookDetails");

const detailsBookCover = document.getElementById("detailsBookCover");
const detailsCoverPlaceholder = document.getElementById("detailsCoverPlaceholder");
const detailsBookCategory = document.getElementById("detailsBookCategory");
const detailsBookTitle = document.getElementById("detailsBookTitle");
const detailsBookAuthorName = document.getElementById("detailsBookAuthorName");
const detailsBookPrice = document.getElementById("detailsBookPrice");
const detailsBookOwnerCountValue = document.getElementById(
  "detailsBookOwnerCountValue"
);
const detailsBookDescription = document.getElementById("detailsBookDescription");
const detailsBookAction = document.getElementById("detailsBookAction");
const detailsBookMessage = document.getElementById("detailsBookMessage");

let selectedBookForDetails = null;

function openBookDetails(book) {
  selectedBookForDetails = book;

  detailsBookTitle.textContent =
    book.title || "رواية بدون عنوان";

  detailsBookCategory.textContent =
    book.categories?.name || "غير مصنف";

  detailsBookAuthorName.textContent =
    book.authorName || "كاتب غير معروف";

  detailsBookDescription.textContent =
    book.description || "لا يوجد وصف متاح لهذه الرواية.";

  const price = Number(book.price || 0);

  detailsBookPrice.textContent =
    price <= 0
      ? "مجانية"
      : `${price.toLocaleString("ar-EG")} جنيه`;

  detailsBookMessage.textContent = "";

  const ownerCount = bookOwnerCounts.get(book.id) || 0;

  detailsBookOwnerCountValue.textContent =
    ownerCount.toLocaleString("ar-EG");

  if (book.coverUrl) {
    detailsBookCover.src = book.coverUrl;
    detailsBookCover.alt =
      `غلاف رواية ${book.title || ""}`;
    detailsBookCover.hidden = false;
    detailsCoverPlaceholder.hidden = true;
  } else {
    detailsBookCover.removeAttribute("src");
    detailsBookCover.alt = "";
    detailsBookCover.hidden = true;
    detailsCoverPlaceholder.hidden = false;
  }

  detailsBookAction.disabled = false;

  if (myBookIds.has(book.id)) {
    detailsBookAction.textContent = "اقرأ الرواية";
  } else {
    detailsBookAction.textContent =
      price <= 0 ? "احصل على الرواية مجانًا" : "شراء الرواية";
  }

  bookDetailsModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeBookDetails() {
  bookDetailsModal.hidden = true;
  document.body.style.overflow = "";
  selectedBookForDetails = null;
}

closeBookDetailsBtn.addEventListener("click", closeBookDetails);

detailsBookAction.addEventListener("click", handleBookDetailsAction);

bookDetailsModal.addEventListener("click", function (event) {
  if (event.target === bookDetailsModal) {
    closeBookDetails();
  }
});

document.addEventListener("keydown", function (event) {
  if (
    event.key === "Escape" &&
    !bookDetailsModal.hidden
  ) {
    closeBookDetails();
  }
});

const PAGE_SIZE = 12;

let allBooks = [];
let categories = [];
let selectedCategory = "all";
let currentPage = 1;
let currentUser = null;
let myBookIds = new Set();
let bookOwnerCounts = new Map();

async function loadBookOwnerCounts(bookIds) {
  bookOwnerCounts = new Map();

  if (!bookIds || bookIds.length === 0) {
    return;
  }

  const { data, error } = await db.rpc(
    "get_book_owner_counts",
    {
      p_book_ids: bookIds
    }
  );

  if (error) {
    console.error("Book owner counts error:", error);
    return;
  }

  (data || []).forEach(function (item) {
    bookOwnerCounts.set(
      item.book_id,
      Number(item.owner_count) || 0
    );
  });
}

function showMessage(message) {
  messageBox.textContent = message;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char];
  });
}


async function loadMyBookIds() {
  myBookIds = new Set();

  if (!currentUser) {
    return;
  }

  const { data, error } = await db
    .from("user_books")
    .select("book_id")
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("My library error:", error);
    return;
  }

  myBookIds = new Set(
    (data || []).map(function (item) {
      return item.book_id;
    })
  );
}



async function loadCategories() {
    const { data, error } = await db
      .from("categories")
      .select("id, name, slug")
      .order("name");
  
    if (error) {
      console.error("Categories error:", error);
      return;
    }
  
    categories = (data || []).sort(function (a, b) {
      if (a.slug === "other") return 1;
      if (b.slug === "other") return -1;
  
      return a.name.localeCompare(b.name, "ar");
    });
  
    renderCategories();
  }  


  function renderCategories() {
    categoryBox.innerHTML = "";
  
    // زر عرض جميع الروايات
    const allButton = document.createElement("button");
  
    allButton.className =
      "library-category" +
      (selectedCategory === "all" ? " active" : "");
  
    allButton.dataset.category = "all";
    allButton.textContent = "كل الروايات";
  
    categoryBox.appendChild(allButton);
  
    // التصنيفات تُحمّل من قاعدة البيانات
    categories.forEach(function (category) {
      const button = document.createElement("button");
  
      button.className =
        "library-category" +
        (String(selectedCategory) === String(category.id)
          ? " active"
          : "");
  
      button.dataset.category = category.id;
      button.textContent = category.name;
  
      categoryBox.appendChild(button);
    });
  }  

async function loadBooks() {
  showMessage("جاري تحميل الروايات...");
  bookGrid.innerHTML = "";
  pagination.innerHTML = "";

  const { data, error } = await db
    .from("books")
    .select(`
      id,
      author_id,
      title,
      description,
      cover_path,
      category_id,
      price,
      created_at,
      categories ( name )
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Books error:", error);
    showMessage("حدثت مشكلة أثناء تحميل الروايات. حاول تحديث الصفحة.");
    resultsCount.textContent = "";
    return;
  }

  allBooks = data || [];

  const authorIds = [
    ...new Set(
      allBooks
        .map((book) => book.author_id)
        .filter(Boolean)
    )
  ];
  
  const authorNames = new Map();
  
  if (authorIds.length > 0) {
    const { data: authors, error: authorsError } = await db
      .from("profiles")
      .select("id, display_name")
      .in("id", authorIds);
  
    if (authorsError) {
      console.error("Authors error:", authorsError);
    } else {
      (authors || []).forEach((author) => {
        authorNames.set(
          author.id,
          author.display_name || "كاتب غير معروف"
        );
      });
    }
  }
  
  allBooks = allBooks.map((book) => ({
    ...book,
    authorName: authorNames.get(book.author_id) || "كاتب غير معروف"
  }));

  await loadBookOwnerCounts(allBooks.map(book => book.id));

  const coverPaths = allBooks
    .map(book => book.cover_path)
    .filter(Boolean);

  const uniquePaths = [...new Set(coverPaths)];
  const coverUrls = {};

  if (uniquePaths.length > 0) {
    const { data: signedCovers, error: coverError } =
      await db.storage
        .from("book-covers")
        .createSignedUrls(uniquePaths, 3600);

    if (coverError) {
      console.error("Cover URLs error:", coverError);
    } else {
      (signedCovers || []).forEach(function (item, index) {
        if (item.signedUrl) {
          coverUrls[uniquePaths[index]] = item.signedUrl;
        }
      });
    }
  }

  allBooks = allBooks.map(function (book) {
    return {
      ...book,
      coverUrl: coverUrls[book.cover_path] || ""
    };
  });

  renderBooks();
}


function getFilteredBooks() {
    const query = searchInput.value.trim().toLocaleLowerCase();
  
    let filtered = allBooks.filter(function (book) {
      const matchesCategory =
        selectedCategory === "all" ||
        String(book.category_id) === String(selectedCategory);
  
      const title = (book.title || "").toLocaleLowerCase();
      const description = (book.description || "").toLocaleLowerCase();
  
      const matchesSearch =
        !query ||
        title.includes(query) ||
        description.includes(query);
  
      return matchesCategory && matchesSearch;
    });
  
    if (sortSelect.value === "oldest") {
      filtered.sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      );
    } else if (sortSelect.value === "title") {
      filtered.sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", "ar")
      );
    } else {
      filtered.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      );
    }
  
    return filtered;
  }  


function renderBooks() {
    const filtered = getFilteredBooks();
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }
  
    if (totalPages === 0) {
      currentPage = 1;
    }
  
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageBooks = filtered.slice(start, start + PAGE_SIZE);
  
    resultsCount.textContent =
      "عدد الروايات: " + filtered.length;
  
    bookGrid.innerHTML = "";
    pagination.innerHTML = "";
  
    if (filtered.length === 0) {
      showMessage(
        allBooks.length === 0
          ? "لا يوجد روايات منشورة في المكتبة."
          : "لا يوجد روايات مطابقة للبحث. حاول بكلمة أخرى."
      );
      return;
    }
  
    showMessage("");
  
    pageBooks.forEach(function (book) {
      const card = document.createElement("article");
      card.className = "library-book-card";
  
      const categoryName = book.categories
        ? book.categories.name
        : "أخرى";

        const ownerCount = bookOwnerCounts.get(book.id) || 0;
        const price = Number(book.price || 0);
  
        const ownerCountHTML = `
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
        `;
  
        const priceHTML = `
          <div class="library-book-price">
            ${
              price <= 0
                ? "مجانية"
                : `${price.toLocaleString("ar-EG")} جنيه`
            }
          </div>
        `;
  
        const cover = book.coverUrl
          ? `<img class="library-book-cover" src="${escapeHTML(book.coverUrl)}" alt="غلاف رواية ${escapeHTML(book.title)}" loading="lazy">`
          : `<div class="library-book-cover" role="img" aria-label="لا يوجد غلاف" style="display:grid;place-items:center;color:#687369">حكاية ورواية</div>`;
  
        card.innerHTML = `
          ${cover}
          <div class="library-book-info">
            <span class="library-book-category">${escapeHTML(categoryName)}</span>
            <h3>${escapeHTML(book.title)}</h3>
            <div class="library-book-author">
              <span class="library-book-author-icon" aria-hidden="true">✍</span>
              <span>${escapeHTML(book.authorName || "كاتب غير معروف")}</span>
            </div>
            <p class="library-book-description">${escapeHTML(book.description || "اكتشف هذه الرواية داخل مكتبة حكاية ورواية.")}</p>
  
            <div class="library-book-meta">
              ${ownerCountHTML}
              ${priceHTML}
            </div>
          </div>
        `;
  
        card.style.cursor = "pointer";
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
        card.setAttribute(
          "aria-label",
          `عرض تفاصيل رواية ${book.title || ""}`
        );
  
        card.addEventListener("click", function (event) {
          if (event.target.closest("button, a")) {
            openBookDetails(book);
            return;
          }
  
          openBookDetails(book);
        });
  
        card.addEventListener("keydown", function (event) {
          if (
            (event.key === "Enter" || event.key === " ") &&
            event.target === card
          ) {
            event.preventDefault();
            openBookDetails(book);
          }
        });
  
        bookGrid.appendChild(card);
  
      bookGrid.appendChild(card);
    });
  
    renderPagination(totalPages);
  }  

function renderPagination(totalPages) {
  pagination.innerHTML = "";

  if (totalPages <= 1) {
    return;
  }

  for (let page = 1; page <= totalPages; page++) {
    const button = document.createElement("button");

    button.className =
      "library-page-btn" + (page === currentPage ? " active" : "");

    button.textContent = page;
    button.type = "button";

    button.addEventListener("click", function () {
      currentPage = page;
      renderBooks();

      document.querySelector(".library-content").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    pagination.appendChild(button);
  }
}



async function updateAuthButton() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    currentUser = null;
  } else {
    currentUser = data.session?.user || null;
  }

  if (currentUser) {
    loginBtn.hidden = true;
    signupBtn.hidden = false;
    signupBtn.textContent = "حسابي";
    homeBtn.hidden = false;
  } else {
    loginBtn.hidden = false;
    loginBtn.textContent = "تسجيل الدخول";
    signupBtn.hidden = false;
    signupBtn.textContent = "إنشاء حساب";
    homeBtn.hidden = true;
  }
}


homeBtn.addEventListener("click", function () {
  window.location.href = "/index.html";
});

loginBtn.addEventListener("click", function () {
  window.location.href = "/Auth/auth.html?mode=login";
});

signupBtn.addEventListener("click", function () {
  if (currentUser) {
    window.location.href = "/Profile/profile.html";
  } else {
    window.location.href = "/Auth/auth.html?mode=signup";
  }
});


signupBtn.addEventListener("click", function () {
  if (currentUser) {
    window.location.href = "/Profile/profile.html";
    return;
  }

  window.location.href = "/Auth/auth.html?mode=signup";
});

async function openBook(book) {
  if (!book) return;

  const {
    data: { session },
    error
  } = await db.auth.getSession();

  if (error || !session) {
    window.location.href = "/Auth/auth.html?mode=login";
    return;
  }

  await loadMyBookIds();

  if (!myBookIds.has(book.id)) {
    showDetailsMessage("لازم تضيف الرواية إلى مكتبتك أولًا قبل قراءتها.");
    return;
  }

  window.location.href =
    "/Reader/reader.html?book=" + encodeURIComponent(book.id);
}

async function handleBookDetailsAction() {
  const book = selectedBookForDetails;

  if (!book) return;

  detailsBookAction.disabled = true;
  detailsBookMessage.textContent = "";

  try {
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData.session?.user;

    if (!user) {
      window.location.href =
        "/Auth/auth.html?mode=login";
      return;
    }

    currentUser = user;

    // تحديث قائمة الروايات التي يمتلكها المستخدم.
    await loadMyBookIds();

    // لو الرواية مملوكة بالفعل، افتحها مباشرة.
    if (myBookIds.has(book.id)) {
      closeBookDetails();
      await openBook(book);
      return;
    }

    const price = Number(book.price || 0);

    // الدفع الحقيقي مؤجل لمرحلة لاحقة.
    if (price > 0) {
      detailsBookMessage.textContent =
        "صفحة شراء الروايات المدفوعة ستكون متاحة قريبًا.";
      return;
    }

    detailsBookMessage.textContent =
      "جاري إضافة الرواية إلى مكتبتك...";

    const { error: insertError } = await db
      .from("user_books")
      .insert({
        user_id: user.id,
        book_id: book.id
      });

    if (insertError) {
      // نتعامل مع احتمال أن الرواية أُضيفت بالفعل.
      if (insertError.code === "23505") {
        await loadMyBookIds();

        if (myBookIds.has(book.id)) {
          detailsBookMessage.textContent =
            "الرواية موجودة بالفعل في مكتبتك.";
          detailsBookAction.textContent = "اقرأ الرواية";
          return;
        }
      }

      throw insertError;
    }

    // تحديث الملكية والعداد والزر.
    myBookIds.add(book.id);

    const newCount = (bookOwnerCounts.get(book.id) || 0) + 1;
    bookOwnerCounts.set(book.id, newCount);

    detailsBookOwnerCountValue.textContent =
      newCount.toLocaleString("ar-EG");

    detailsBookAction.textContent = "اقرأ الرواية";
    detailsBookMessage.textContent =
      "تمت إضافة الرواية إلى مكتبتك بنجاح.";

    renderBooks();
  } catch (error) {
    console.error("Add book to library error:", error);

    detailsBookMessage.textContent =
      "تعذرت إضافة الرواية. تأكد من اتصالك وحاول مرة أخرى.";
  } finally {
    detailsBookAction.disabled = false;
  }
}

function closeReader() {
  readerModal.hidden = true;
  readerFrame.removeAttribute("src");
  readerFrame.hidden = true;
}

closeReaderBtn.addEventListener("click", closeReader);

readerModal.addEventListener("click", function (event) {
  if (event.target === readerModal) {
    closeReader();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeReader();
  }
});

categoryBox.addEventListener("click", function (event) {
  const button = event.target.closest("[data-category]");

  if (!button) {
    return;
  }

  selectedCategory = button.dataset.category === "all"
    ? "all"
    : button.dataset.category;

  currentPage = 1;
  renderCategories();
  renderBooks();
});

searchInput.addEventListener("input", function () {
  currentPage = 1;
  clearSearchBtn.hidden = searchInput.value.length === 0;
  renderBooks();
});

clearSearchBtn.addEventListener("click", function () {
  searchInput.value = "";
  clearSearchBtn.hidden = true;
  currentPage = 1;
  renderBooks();
  searchInput.focus();
});

sortSelect.addEventListener("change", function () {
  currentPage = 1;
  renderBooks();
});



db.auth.onAuthStateChange(function (_event, session) {
  currentUser = session ? session.user : null;

  updateAuthButton().then(async function () {
    await loadMyBookIds();
    renderBooks();
  });
});

async function startLibrary() {
  await updateAuthButton();
  await loadCategories();
  await loadMyBookIds();
  await loadBooks();

  const params = new URLSearchParams(window.location.search);
  const requestedBookId = params.get("book");

  if (!requestedBookId) return;

  const requestedBook = allBooks.find(function (book) {
    return String(book.id) === requestedBookId;
  });

  if (requestedBook) {
    openBookDetails(requestedBook);
  } else {
    showMessage("تعذر العثور على الرواية المطلوبة في المكتبة.");
  }
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

/* ===== Custom Sort Dropdown Behavior ===== */
(() => {
  const wrapper = document.getElementById("customSort");
  const trigger = document.getElementById("sortTrigger");
  const label = document.getElementById("sortCurrentLabel");
  const optionsBox = document.getElementById("sortOptions");
  const nativeSelect = document.getElementById("librarySort");

  if (!wrapper || !trigger || !label || !optionsBox || !nativeSelect) {
    return;
  }

  const options = [...optionsBox.querySelectorAll(".sort-option")];

  function syncSortUI(value) {
    const selected = options.find(option => option.dataset.value === value);
    if (!selected) return;

    label.textContent = selected.querySelector("span").textContent;

    options.forEach(option => {
      const isSelected = option === selected;
      option.classList.toggle("is-selected", isSelected);
      option.setAttribute("aria-selected", String(isSelected));
    });
  }

  function closeSort(focusTrigger = false) {
    optionsBox.hidden = true;
    wrapper.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");

    if (focusTrigger) trigger.focus();
  }

  function openSort() {
    optionsBox.hidden = false;
    wrapper.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
  }

  trigger.addEventListener("click", () => {
    if (optionsBox.hidden) {
      openSort();
    } else {
      closeSort();
    }
  });

  options.forEach(option => {
    option.addEventListener("click", () => {
      const value = option.dataset.value;

      if (nativeSelect.value !== value) {
        nativeSelect.value = value;
        nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }

      syncSortUI(value);
      closeSort(true);
    });
  });

  document.addEventListener("click", event => {
    if (!wrapper.contains(event.target)) {
      closeSort();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !optionsBox.hidden) {
      closeSort(true);
    }
  });

  nativeSelect.addEventListener("change", () => {
    syncSortUI(nativeSelect.value);
  });

  syncSortUI(nativeSelect.value);
})();


startLibrary();