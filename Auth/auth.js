
const SUPABASE_URL = "https://aibgixalrifqbsotiogu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const form = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const nameField = document.getElementById("nameField");
const accountTypeField = document.getElementById("accountTypeField");
const displayName = document.getElementById("displayName");
const email = document.getElementById("email");
const password = document.getElementById("password");
const accountType = document.getElementById("accountType");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmit = document.getElementById("authSubmit");
const authStatus = document.getElementById("authStatus");

let mode = "login";
let submitting = false;

function setStatus(message, type) {
  authStatus.textContent = message;
  authStatus.className =
    "auth-status" + (type ? " " + type : "");
}

function setMode(nextMode) {
  mode = nextMode;

  const isSignup = mode === "signup";

  loginTab.classList.toggle("active", !isSignup);
  signupTab.classList.toggle("active", isSignup);

  nameField.hidden = !isSignup;
  accountTypeField.hidden = !isSignup;

  displayName.required = isSignup;
  displayName.disabled = !isSignup;
  accountType.disabled = !isSignup;

  password.autocomplete = isSignup
    ? "new-password"
    : "current-password";

  authTitle.textContent = isSignup
    ? "ابدأ رحلتك معانا"
    : "سعيدين بعودتك!";

  authSubtitle.textContent = isSignup
    ? "أنشئ حسابك واكتشف عالمًا جديدًا من الكتب."
    : "سجّل دخولك وكمل رحلتك في عالم الكتب.";

  authSubmit.textContent = isSignup
    ? "إنشاء الحساب"
    : "تسجيل الدخول";

  setStatus("", "");
}

loginTab.addEventListener("click", function () {
  setMode("login");
});

signupTab.addEventListener("click", function () {
  setMode("signup");
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (submitting) return;

  setStatus("", "");

  // التحقق المخصص قبل الاتصال بـ Supabase
  if (mode === "signup" && !displayName.value.trim()) {
    setStatus(
      "أهلًا بيك في موقع حكاية ورواية! من فضلك اكتب اسمك علشان نقدر ننشئ حسابك.",
      "error"
    );
    displayName.focus();
    return;
  }

  const emailValue = email.value.trim();

  if (!emailValue) {
    setStatus(
      "من فضلك اكتب بريدك الإلكتروني لإكمال تسجيلك في موقع حكاية ورواية.",
      "error"
    );
    email.focus();
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
    setStatus(
      "يبدو إن البريد الإلكتروني غير صحيح. قم بمراجعته وحاول مرة أخرى.",
      "error"
    );
    email.focus();
    return;
  }

  if (!password.value) {
    setStatus(
      "من فضلك اكتب كلمة المرور.",
      "error"
    );
    password.focus();
    return;
  }

  if (password.value.length < 8) {
    setStatus(
      "كلمة المرور يجب أن تكون 8 أحرف على الأقل. اختار كلمة مرور مناسبة وحاول مرة أخرى.",
      "error"
    );
    password.focus();
    return;
  }

  submitting = true;
  authSubmit.disabled = true;
  authSubmit.textContent = "جارٍ التنفيذ...";

  try {
    if (mode === "signup") {
      const result = await db.auth.signUp({
        email: emailValue,
        password: password.value,
        options: {
          data: {
            display_name: displayName.value.trim(),
            account_type: accountType.value
          }
        }
      });

      if (result.error) throw result.error;

      if (!result.data.session) {
        setStatus(
          "طلب إنشاء حسابك وصل بنجاح! راجع بريدك الإلكتروني واضغط على رابط التأكيد إذا وصلك.",
          "success"
        );
        return;
      }

      setStatus(
        "أهلًا بيك في موقع حكاية ورواية! تم إنشاء حسابك بنجاح، جاري تحويلك للصفحة الرئيسية...",
        "success"
      );

      setTimeout(function () {
        window.location.href = "/index.html";
      }, 1200);

      return;
    }

    const result = await db.auth.signInWithPassword({
      email: emailValue,
      password: password.value
    });

    if (result.error) throw result.error;

    setStatus(
      "نورت موقع حكاية ورواية! تم تسجيل الدخول بنجاح، جاري تحويلك...",
      "success"
    );

    setTimeout(function () {
      window.location.href = "/index.html";
    }, 800);

  } catch (error) {
    console.error("Authentication error:", error);

    const errorMessage = (error.message || "").toLowerCase();
    let message = "حصلت مشكلة أثناء تنفيذ طلبك. حاول مرة أخرى بعد قليل.";

    if (
      errorMessage.includes("invalid login") ||
      errorMessage.includes("invalid credentials")
    ) {
      message = "البريد الإلكتروني أو كلمة المرور غير صحيحة. راجع بياناتك وحاول مرة أخرى.";
    } else if (
      errorMessage.includes("already registered") ||
      errorMessage.includes("user already registered")
    ) {
      message = "البريد الإلكتروني مستخدم بالفعل. حاول تسجيل الدخول بدل إنشاء حساب جديد.";
    } else if (
      errorMessage.includes("password") &&
      (
        errorMessage.includes("weak") ||
        errorMessage.includes("short") ||
        errorMessage.includes("least")
      )
    ) {
      message = "كلمة المرور غير مستوفية للشروط المطلوبة. أختر كلمة مرور أقوى مكوّنة من 8 أحرف على الأقل.";
    } else if (
      errorMessage.includes("email not confirmed")
    ) {
      message = "يجب تأكيد بريدك الإلكتروني. افتح رسالة التأكيد اللتي وصلتك، وبعدها حاول تسجيل الدخول.";
    } else if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("too many requests")
    ) {
      message = "تم إجراء محاولات كثيرة في وقت قصير. إنتظر قليلة وحاول مرة أخرى.";
    }

    setStatus(message, "error");

  } finally {
    submitting = false;
    authSubmit.disabled = false;
    authSubmit.textContent = mode === "signup"
      ? "إنشاء الحساب"
      : "تسجيل الدخول";
  }
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


const params = new URLSearchParams(window.location.search);
const initialMode = params.get("mode") === "signup" ? "signup" : "login";

setMode(initialMode);