
"use strict";

/* =========================================
   1. Supabase Configuration
========================================= */

const SUPABASE_URL =
  "https://aibgixalrifqbsotiogu.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


/* =========================================
   2. HTML Elements
========================================= */

const checkoutYear = document.getElementById("checkoutYear");

const checkoutLayout = document.querySelector(".checkout-layout");
const checkoutSteps = document.querySelector(".checkout-steps");
const checkoutBookCover = document.getElementById("checkoutBookCover");
const checkoutCoverPlaceholder = document.getElementById("checkoutCoverPlaceholder");
const checkoutBookCategory = document.getElementById("checkoutBookCategory");
const checkoutBookTitle = document.getElementById("checkoutBookTitle");
const checkoutBookAuthor = document.getElementById("checkoutBookAuthor");
const checkoutBookDescription = document.getElementById("checkoutBookDescription");
const checkoutBookPrice = document.getElementById("checkoutBookPrice");
const checkoutTotalPrice = document.getElementById("checkoutTotalPrice");
const checkoutPaymentLoading = document.getElementById("checkoutPaymentLoading");
const checkoutPaymentMethods = document.getElementById("checkoutPaymentMethods");
const paymentMethodsList = document.getElementById("paymentMethodsList");
const selectedPaymentDetails = document.getElementById("selectedPaymentDetails");
const selectedPaymentName = document.getElementById("selectedPaymentName");
const selectedAccountName = document.getElementById("selectedAccountName");
const selectedAccountIdentifier = document.getElementById("selectedAccountIdentifier");
const selectedIdentifierLabel = document.getElementById("selectedIdentifierLabel");
const selectedPaymentInstructions = document.getElementById("selectedPaymentInstructions");
const buyerNameInput = document.getElementById("buyerName");
const transferPhoneInput = document.getElementById("transferPhone");
const purchaseProofInput = document.getElementById("purchaseProof");
const proofUploadTitle = document.getElementById("proofUploadTitle");
const proofUploadDescription = document.getElementById("proofUploadDescription");
const proofPreviewContainer = document.getElementById("proofPreviewContainer");
const proofPreview = document.getElementById("proofPreview");
const removeProofBtn = document.getElementById("removeProofBtn");
const checkoutMessage = document.getElementById("checkoutMessage");
const submitPurchaseBtn = document.getElementById("submitPurchaseBtn");
const checkoutSuccess = document.getElementById("checkoutSuccess");
const checkoutError = document.getElementById("checkoutError");
const checkoutErrorTitle = document.getElementById("checkoutErrorTitle");
const checkoutErrorMessage = document.getElementById("checkoutErrorMessage");

document.getElementById("year").textContent = new Date().getFullYear();


/* =========================================
   3. Variables
========================================= */

const MAX_PROOF_SIZE = 5 * 1024 * 1024;

const ALLOWED_PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

let currentUser = null;
let currentBook = null;
let paymentMethods = [];
let selectedPaymentMethod = null;
let selectedProofFile = null;
let isSubmitting = false;
let proofPreviewUrl = null;


/* =========================================
   4. General Helpers
========================================= */

function formatPrice(value) {
  return Number(value).toLocaleString("ar-EG") + " جنيه";
}


function showCheckoutMessage(message, type = "info") {
  checkoutMessage.textContent = message;
  checkoutMessage.className = "checkout-message " + type;
}


function clearCheckoutMessage() {
  checkoutMessage.textContent = "";
  checkoutMessage.className = "checkout-message";
}


function showCheckoutError(title, message) {
  checkoutErrorTitle.textContent = title;
  checkoutErrorMessage.textContent = message;

  checkoutLayout.hidden = true;
  checkoutSteps.hidden = true;
  checkoutSuccess.hidden = true;
  checkoutError.hidden = false;
}


function getFileExtension(file) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  return extensions[file.type] || null;
}


function createUniqueFileName() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString() +
    "-" +
    Math.random().toString(36).slice(2)
  );
}


/* =========================================
   5. Check Login
========================================= */

async function checkLogin() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    throw error;
  }

  currentUser = data.session?.user || null;

  if (!currentUser) {
    const returnUrl =
      window.location.pathname + window.location.search;

    window.location.href =
      "/Auth/auth.html?mode=login&redirect=" +
      encodeURIComponent(returnUrl);

    return false;
  }

  return true;
}


/* =========================================
   6. Check User Role
========================================= */


async function checkReaderRole() {
    const { data, error } = await db
      .from("profiles")
      .select("id, role")
      .eq("id", currentUser.id)
      .maybeSingle();
  
    if (error) {
      throw error;
    }
  
    const allowedRoles = ["reader", "author", "admin"];
  
    if (!data || !allowedRoles.includes(data.role)) {
      showCheckoutError(
        "الحساب غير مؤهل للشراء",
        "يجب تسجيل الدخول بحساب قارئ أو كاتب للمتابعة."
      );
  
      return false;
    }
  
    return true;
  }
  

/* =========================================
   7. Load Book
========================================= */

async function loadCheckoutBook() {
  const params = new URLSearchParams(window.location.search);
  const bookId = params.get("book");

  if (!bookId) {
    showCheckoutError(
      "لم يتم تحديد الرواية",
      "ارجع إلى المكتبة واختر الرواية التي تريد شراءها."
    );

    return false;
  }

  const { data: book, error } = await db
    .from("books")
    .select(`
      id,
      author_id,
      title,
      description,
      cover_path,
      category_id,
      price,
      status,
      categories ( name )
    `)
    .eq("id", bookId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!book) {
    showCheckoutError(
      "الرواية غير متاحة",
      "لم نتمكن من العثور على الرواية أو أنها لم تعد منشورة."
    );

    return false;
  }

  currentBook = book;

  const price = Number(book.price || 0);

  if (!Number.isFinite(price) || price <= 0) {
    showCheckoutError(
      "هذه الرواية لا تحتاج إلى شراء",
      "الروايات المجانية يمكن إضافتها إلى مكتبتك مباشرة من صفحة المكتبة."
    );

    return false;
  }

  // التأكد من أن المستخدم لا يمتلك الرواية بالفعل.
  const { data: ownership, error: ownershipError } = await db
    .from("user_books")
    .select("book_id")
    .eq("user_id", currentUser.id)
    .eq("book_id", book.id)
    .maybeSingle();

  if (ownershipError) {
    throw ownershipError;
  }

  if (ownership) {
    window.location.href =
      "/Reader/reader.html?book=" +
      encodeURIComponent(book.id);

    return false;
  }

  await renderCheckoutBook(book);

  return true;
}


/* =========================================
   8. Render Book Details
========================================= */

async function renderCheckoutBook(book) {
  checkoutBookTitle.textContent =
    book.title || "رواية بدون عنوان";

  checkoutBookCategory.textContent =
    book.categories?.name || "غير مصنف";

  checkoutBookDescription.textContent =
    book.description || "لا يوجد وصف متاح لهذه الرواية.";

  checkoutBookPrice.textContent =
    formatPrice(book.price);

  checkoutTotalPrice.textContent =
    formatPrice(book.price);

  const { data: author, error: authorError } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", book.author_id)
    .maybeSingle();

  if (authorError) {
    console.error("Author loading error:", authorError);
  }

  checkoutBookAuthor.textContent =
    author?.display_name || "كاتب غير معروف";

  if (book.cover_path) {
    const { data, error } = await db.storage
      .from("book-covers")
      .createSignedUrl(book.cover_path, 3600);

    if (error) {
      console.error("Book cover error:", error);
    }

    if (data?.signedUrl) {
      checkoutBookCover.src = data.signedUrl;
      checkoutBookCover.hidden = false;
      checkoutCoverPlaceholder.hidden = true;
      return;
    }
  }

  checkoutBookCover.removeAttribute("src");
  checkoutBookCover.hidden = true;
  checkoutCoverPlaceholder.hidden = false;
}


/* =========================================
   9. Load Payment Methods
========================================= */

async function loadPaymentMethods() {
  checkoutPaymentLoading.hidden = false;
  checkoutPaymentMethods.hidden = true;

  const { data, error } = await db
    .from("platform_payment_methods")
    .select(`
      id,
      method_type,
      display_name,
      account_name,
      account_identifier,
      instructions,
      sort_order
    `)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  paymentMethods = data || [];

  checkoutPaymentLoading.hidden = true;

  if (paymentMethods.length === 0) {
    checkoutPaymentLoading.hidden = false;
    checkoutPaymentLoading.textContent =
      "لا توجد طرق دفع متاحة حاليًا. يرجى المحاولة لاحقًا.";

    submitPurchaseBtn.disabled = true;
    return;
  }

  renderPaymentMethods();

  checkoutPaymentMethods.hidden = false;
}


/* =========================================
   10. Render Payment Methods
========================================= */


function renderPaymentMethods() {
    paymentMethodsList.innerHTML = "";
  
    paymentMethods.forEach(function (method, index) {
      const wrapper = document.createElement("div");
      wrapper.className = "payment-method-option";
  
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "paymentMethod";
      input.id = "paymentMethod_" + method.id;
      input.value = method.id;
  
      const label = document.createElement("label");
      label.className = "payment-method-label";
      label.htmlFor = input.id;
  
      const radio = document.createElement("span");
      radio.className = "payment-method-radio";
  
      const image = document.createElement("img");
      image.className = "payment-method-logo";
      image.alt = method.display_name;
  
      if (method.method_type === "instapay") {
        image.src = "instapay.png";
      } else if (method.method_type === "wallet") {
        image.src = "wallet.png";
      }
  
      const text = document.createElement("span");
      text.className = "payment-method-text";
  
      const title = document.createElement("strong");
      title.textContent = method.display_name;
  
      const description = document.createElement("small");
      description.textContent = "طريقة دفع متاحة";
  
      text.appendChild(title);
      text.appendChild(description);
  
      label.appendChild(radio);
      label.appendChild(image);
      label.appendChild(text);
  
      wrapper.appendChild(input);
      wrapper.appendChild(label);
  
      input.addEventListener("change", function () {
        selectPaymentMethod(method);
      });
  
      paymentMethodsList.appendChild(wrapper);
  
      if (index === 0) {
        input.checked = true;
        selectPaymentMethod(method);
      }
    });
  }
  


/* =========================================
   11. Select Payment Method
========================================= */

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;

  selectedPaymentDetails.hidden = false;

  selectedPaymentName.textContent =
    method.display_name;

  selectedAccountName.textContent =
    method.account_name;

  selectedAccountIdentifier.textContent =
    method.account_identifier;

  const normalizedType =
    String(method.method_type || "").toLowerCase();

  if (
    normalizedType.includes("wallet") ||
    normalizedType.includes("phone")
  ) {
    selectedIdentifierLabel.textContent =
      "رقم المحفظة";
  } else if (normalizedType.includes("instapay")) {
    selectedIdentifierLabel.textContent =
      "عنوان أو بيانات إنستاباي";
  } else {
    selectedIdentifierLabel.textContent =
      "بيانات الحساب";
  }

  if (method.instructions && method.instructions.trim()) {
    selectedPaymentInstructions.textContent =
      method.instructions;

    selectedPaymentInstructions.hidden = false;
  } else {
    selectedPaymentInstructions.textContent = "";
    selectedPaymentInstructions.hidden = true;
  }

  updateSubmitButton();
}


/* =========================================
   12. Copy Payment Details
========================================= */

document.querySelectorAll(".copy-button").forEach(function (button) {
  button.addEventListener("click", async function () {
    if (!selectedPaymentMethod) return;

    const type = button.dataset.copy;

    const value =
      type === "accountName"
        ? selectedPaymentMethod.account_name
        : selectedPaymentMethod.account_identifier;

    try {
      await navigator.clipboard.writeText(value);

      const oldText = button.textContent;
      button.textContent = "تم النسخ";

      setTimeout(function () {
        button.textContent = oldText;
      }, 1500);

    } catch (error) {
      console.error("Copy error:", error);
      showCheckoutMessage(
        "تعذر نسخ البيانات. يمكنك تحديدها ونسخها يدويًا.",
        "error"
      );
    }
  });
});


/* =========================================
   13. Proof Image Validation
========================================= */

purchaseProofInput.addEventListener("change", function () {
  clearCheckoutMessage();

  const file = purchaseProofInput.files?.[0];

  if (!file) {
    selectedProofFile = null;
    updateSubmitButton();
    return;
  }

  if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
    clearProofPreview();

    showCheckoutMessage(
      "نوع الملف غير مسموح. ارفع صورة JPG أو PNG أو WebP فقط.",
      "error"
    );

    return;
  }

  if (file.size > MAX_PROOF_SIZE) {
    clearProofPreview();

    showCheckoutMessage(
      "حجم الصورة أكبر من 5 ميجابايت. اختر صورة أصغر.",
      "error"
    );

    return;
  }

  selectedProofFile = file;

  if (proofPreviewUrl) {
    URL.revokeObjectURL(proofPreviewUrl);
  }

  proofPreviewUrl = URL.createObjectURL(file);

  proofPreview.src = proofPreviewUrl;

  proofPreviewContainer.hidden = false;

  proofUploadTitle.textContent = file.name;

  proofUploadDescription.textContent =
    "تم اختيار الصورة بنجاح";

  updateSubmitButton();
});


/* =========================================
   14. Remove Proof Image
========================================= */

function clearProofPreview() {
  selectedProofFile = null;

  purchaseProofInput.value = "";

  if (proofPreviewUrl) {
    URL.revokeObjectURL(proofPreviewUrl);
    proofPreviewUrl = null;
  }

  proofPreview.removeAttribute("src");

  proofPreviewContainer.hidden = true;

  proofUploadTitle.textContent =
    "اضغط لاختيار صورة إثبات التحويل";

  proofUploadDescription.textContent =
    "JPG أو PNG أو WebP — بحد أقصى 5 ميجابايت";

  updateSubmitButton();
}


removeProofBtn.addEventListener("click", function () {
  clearProofPreview();
  clearCheckoutMessage();
});


/* =========================================
   15. Form Validation
========================================= */

function updateSubmitButton() {
  const name = buyerNameInput.value.trim();
  const phone = transferPhoneInput.value.trim();

  const isReady =
    Boolean(selectedPaymentMethod) &&
    name.length >= 2 &&
    /^01[0125][0-9]{8}$/.test(phone) &&
    Boolean(selectedProofFile) &&
    !isSubmitting;

  submitPurchaseBtn.disabled = !isReady;
}


buyerNameInput.addEventListener("input", updateSubmitButton);
transferPhoneInput.addEventListener("input", updateSubmitButton);


/* =========================================
   16. Upload Purchase Proof
========================================= */

async function uploadPurchaseProof() {
  if (!selectedProofFile) {
    throw new Error("لم يتم اختيار صورة إثبات التحويل.");
  }

  const extension = getFileExtension(selectedProofFile);

  if (!extension) {
    throw new Error("صيغة صورة الإثبات غير مدعومة.");
  }

  const fileName =
    createUniqueFileName() + "." + extension;

  const filePath = [
    currentUser.id,
    currentBook.id,
    fileName
  ].join("/");

  const { data, error } = await db.storage
    .from("purchase-proofs")
    .upload(filePath, selectedProofFile, {
      cacheControl: "3600",
      contentType: selectedProofFile.type,
      upsert: false
    });

  if (error) {
    throw error;
  }

  return data.path;
}


/* =========================================
   17. Submit Purchase Request
========================================= */

async function submitPurchaseRequest() {
  if (isSubmitting) return;

  clearCheckoutMessage();

  const buyerName = buyerNameInput.value.trim();
  const transferPhone = transferPhoneInput.value.trim();

  if (!selectedPaymentMethod) {
    showCheckoutMessage(
      "اختر طريقة الدفع أولًا.",
      "error"
    );
    return;
  }

  if (buyerName.length < 2) {
    showCheckoutMessage(
      "اكتب اسم صاحب التحويل بشكل صحيح.",
      "error"
    );
    buyerNameInput.focus();
    return;
  }

  if (!/^01[0125][0-9]{8}$/.test(transferPhone)) {
    showCheckoutMessage(
      "اكتب رقم الهاتف المرتبط بالتحويل.",
      "رقم الهاتف يجب أن يكون 11 رقمًا ويبدأ بـ 010 أو 011 أو 012 أو 015."
    );
    transferPhoneInput.focus();
    return;
  }

  if (!selectedProofFile) {
    showCheckoutMessage(
      "ارفع صورة إثبات التحويل أولًا.",
      "error"
    );
    return;
  }

  isSubmitting = true;

  submitPurchaseBtn.disabled = true;
  submitPurchaseBtn.querySelector("span:first-child").textContent =
    "جاري إرسال الطلب...";

  try {
    // التأكد من أن الجلسة ما زالت صالحة.
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!sessionData.session?.user) {
      throw new Error("انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى.");
    }

    if (sessionData.session.user.id !== currentUser.id) {
      throw new Error("تغير حساب المستخدم. أعد تحميل الصفحة.");
    }

    // رفع صورة الإثبات.
    showCheckoutMessage(
      "جاري رفع صورة إثبات التحويل...",
      "info"
    );

    const proofPath = await uploadPurchaseProof();

    // تسجيل طلب الشراء عبر الدالة الموجودة في قاعدة البيانات.
    showCheckoutMessage(
      "جاري تسجيل طلب الشراء...",
      "info"
    );

    const { error: requestError } = await db.rpc(
        "submit_purchase_request",
        {
          p_book_id: currentBook.id,
          p_buyer_name: buyerName,
          p_transfer_phone: transferPhone,
          p_proof_path: proofPath,
          p_payment_method_id: selectedPaymentMethod.id
        }
      );

    if (requestError) {
      throw requestError;
    }

    // إظهار نجاح العملية.
    checkoutMessage.textContent = "";

    checkoutLayout.hidden = true;
    checkoutSteps.hidden = true;
    checkoutError.hidden = true;
    checkoutSuccess.hidden = false;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {
    console.error("Purchase request error:", error);

    let message =
      "تعذر إرسال طلب الشراء. حاول مرة أخرى.";

    if (error.message) {
      message = error.message;
    }

    showCheckoutMessage(message, "error");

  } finally {
    isSubmitting = false;

    submitPurchaseBtn.querySelector("span:first-child").textContent =
      "إرسال طلب الشراء";

    updateSubmitButton();
  }
}


submitPurchaseBtn.addEventListener(
  "click",
  submitPurchaseRequest
);


/* =========================================
   18. Start Checkout
========================================= */

async function startCheckout() {
  
    if (checkoutYear) {
        checkoutYear.textContent = new Date().getFullYear();
      }

  try {
    const loggedIn = await checkLogin();

    if (!loggedIn) return;

    const validRole = await checkReaderRole();

    if (!validRole) return;

    const validBook = await loadCheckoutBook();

    if (!validBook) return;

    await loadPaymentMethods();

  } catch (error) {
    console.error("Checkout initialization error:", error);

    showCheckoutError(
      "حدثت مشكلة أثناء تحميل الصفحة",
      "تعذر تحميل بيانات الشراء. تأكد من اتصالك بالإنترنت وحاول تحديث الصفحة."
    );
  }
}


startCheckout();