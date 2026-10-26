/* =========================================
   حكاية ورواية | مكتبتي الشخصية
   Supabase JS v2
========================================= */

const SUPABASE_URL = "https://aibgixalrifqbsotiogu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

const myLibraryGrid = $("myLibraryGrid");
const myLibraryMessage = $("myLibraryMessage");
const myLibraryEmpty = $("myLibraryEmpty");
const myLibraryBookCount = $("myLibraryBookCount");
const myLibrarySearch = $("myLibrarySearch");
const myLibrarySort = $("myLibrarySort");

let currentUser = null;
let myLibraryBooks = [];
let signedCoverUrls = new Map();
let loadingLibrary = false;

function showLibraryMessage(message) {
  myLibraryMessage.textContent = message || "";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function renderMyLibrary() {
  const searchTerm = myLibrarySearch.value
    .trim()
    .toLocaleLowerCase();

  const sortOrder = myLibrarySort.value;

  const filteredBooks = myLibraryBooks.filter((book) => {
    const title = String(book.title || "").toLocaleLowerCase();
    const category = String(
      book.categories?.name || ""
    ).toLocaleLowerCase();

    const author = String(
      book.profiles?.display_name || ""
    ).toLocaleLowerCase();

    return (
      title.includes(searchTerm) ||
      category.includes(searchTerm) ||
      author.includes(searchTerm)
    );
  });

  filteredBooks.sort((a, b) => {
    if (sortOrder === "title") {
      return String(a.title || "").localeCompare(
        String(b.title || ""),
        "ar"
      );
    }

    const aDate = new Date(a.added_at || 0).getTime();
    const bDate = new Date(b.added_at || 0).getTime();

    return sortOrder === "oldest"
      ? aDate - bDate
      : bDate - aDate;
  });

  myLibraryBookCount.textContent = myLibraryBooks.length;

  myLibraryGrid.replaceChildren();

  if (filteredBooks.length === 0) {
    myLibraryEmpty.hidden = false;

    showLibraryMessage(
      myLibraryBooks.length === 0
        ? ""
        : "مفيش روايات مطابقة لبحثك."
    );

    return;
  }

  myLibraryEmpty.hidden = true;
  showLibraryMessage("");

  filteredBooks.forEach((book) => {
    const card = document.createElement("article");
    card.className = "my-library-book-card";

    const coverWrap = document.createElement("div");
    coverWrap.className = "my-library-book-cover-wrap";

    const coverUrl = signedCoverUrls.get(book.cover_path);

    if (coverUrl) {
      const cover = document.createElement("img");

      cover.className = "my-library-book-cover";
      cover.src = coverUrl;
      cover.alt = `غلاف ${book.title || "الرواية"}`;
      cover.loading = "lazy";

      cover.onerror = function () {
        cover.remove();

        const placeholder = document.createElement("div");
        placeholder.className = "my-library-book-cover-placeholder";
        placeholder.textContent = "حكاية ورواية";

        coverWrap.appendChild(placeholder);
      };

      coverWrap.appendChild(cover);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "my-library-book-cover-placeholder";
      placeholder.textContent = "حكاية ورواية";

      coverWrap.appendChild(placeholder);
    }

    const info = document.createElement("div");
    info.className = "my-library-book-info";

    const category = document.createElement("span");
    category.className = "my-library-book-category";
    category.textContent = book.categories?.name || "غير مصنف";

    const title = document.createElement("h3");
    title.className = "my-library-book-title";
    title.textContent = book.title || "رواية بدون عنوان";

    const author = document.createElement("div");
    author.className = "my-library-book-author";

    const authorIcon = document.createElement("span");
    authorIcon.className = "my-library-author-icon";
    authorIcon.textContent = "✍";
    authorIcon.setAttribute("aria-hidden", "true");

    const authorName = document.createElement("span");
    authorName.textContent =
      book.profiles?.display_name || "كاتب غير معروف";

    author.append(authorIcon, authorName);

    const readButton = document.createElement("button");
    readButton.type = "button";
    readButton.className = "my-library-read-btn";
    readButton.textContent = "اقرأ الرواية";

    readButton.addEventListener("click", function () {
      window.location.href =
        `/Reader/reader.html?book_id=${encodeURIComponent(book.id)}`;
    });

    info.append(category, title, author, readButton);
    card.append(coverWrap, info);
    myLibraryGrid.appendChild(card);
  });
}

async function loadMyLibrary() {
  if (loadingLibrary) return;

  loadingLibrary = true;
  showLibraryMessage("جاري تحميل مكتبتك...");
  myLibraryEmpty.hidden = true;

  try {
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) throw sessionError;

    currentUser = sessionData.session?.user || null;

    if (!currentUser) {
      myLibraryBooks = [];
      myLibraryGrid.replaceChildren();
      myLibraryBookCount.textContent = "0";
      showLibraryMessage("سجّل دخولك علشان تشوف الروايات الموجودة في مكتبتك.");
      myLibraryEmpty.hidden = true;
      return;
    }

    const { data, error } = await db
      .from("user_books")
      .select(`
        created_at,
        book:books (
          id,
          title,
          cover_path,
          category_id,
          status,
          categories (
            name
          ),
          profiles:author_id (
            display_name
          )
        )
      `)
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    myLibraryBooks = (data || [])
      .filter((item) => item.book && item.book.status === "published")
      .map((item) => ({
        ...item.book,
        added_at: item.created_at
      }));

    signedCoverUrls = new Map();

    const coverPaths = [
      ...new Set(
        myLibraryBooks
          .map((book) => book.cover_path)
          .filter(Boolean)
      )
    ];

    for (const path of coverPaths) {
      const { data: signedData, error: signedError } = await db
        .storage
        .from("book-covers")
        .createSignedUrl(path, 3600);

      if (!signedError && signedData?.signedUrl) {
        signedCoverUrls.set(path, signedData.signedUrl);
      } else {
        console.warn("تعذر تحميل غلاف رواية:", path, signedError);
      }
    }

    renderMyLibrary();
  } catch (error) {
    console.error("MyLibrary loading error:", error);
    myLibraryBooks = [];
    myLibraryGrid.replaceChildren();
    myLibraryBookCount.textContent = "—";
    myLibraryEmpty.hidden = true;
    showLibraryMessage(
      "حصلت مشكلة أثناء تحميل المكتبة. راجع اتصالك وحاول تحديث الصفحة."
    );
  } finally {
    loadingLibrary = false;
  }
}

myLibrarySearch.addEventListener("input", renderMyLibrary);
myLibrarySort.addEventListener("change", renderMyLibrary);

db.auth.onAuthStateChange(function () {
  loadMyLibrary();
});

loadMyLibrary();