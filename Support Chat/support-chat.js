
(() => {
    "use strict";
  
    // منع تشغيل الملف أكثر من مرة
    if (window.__supportChatInitialized) return;
    window.__supportChatInitialized = true;
  
    // Supabase
    const SUPABASE_URL = "https://aibgixalrifqbsotiogu.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_5hGz5nIAT9I_6Y52emiERA_5qbTioxB";
  
    if (!window.supabase?.createClient) {
      console.error("Support Chat: Supabase library was not loaded.");
      return;
    }
  
    const supportDb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );
  
    const GUEST_TOKEN_KEY = "hekaya_support_guest_token";


    const CHAT_OPEN_KEY = "hekaya_support_chat_open";
const CHAT_COLLAPSED_KEY = "hekaya_support_chat_collapsed";

// حفظ واسترجاع حالة الشات
function saveChatState(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    console.warn("Support Chat: Could not save state.", error);
  }
}

function getChatState(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch (error) {
    return false;
  }
}

  
    let conversationId = null;
    let currentIdentity = null;
    let isLoading = false;
    let isSending = false;
    let isOpen = false;
  
    // إنشاء أو استرجاع معرف الزائر
    function getGuestToken() {
      try {
        let token = localStorage.getItem(GUEST_TOKEN_KEY);
  
        if (!token) {
          token = crypto.randomUUID();
          localStorage.setItem(GUEST_TOKEN_KEY, token);
        }
  
        return token;
      } catch (error) {
        console.error("Support Chat: Could not access localStorage.", error);
        return crypto.randomUUID();
      }
    }
  
    // تحديد هوية المستخدم
    async function getIdentity() {
      const { data, error } = await supportDb.auth.getUser();
  
      if (error) {
        console.warn("Support Chat auth check:", error.message);
      }
  
      if (data?.user) {
        return {
          type: "user",
          id: data.user.id
        };
      }
  
      return {
        type: "guest",
        token: getGuestToken()
      };
    }
  
    // إنشاء واجهة المحادثة
    function createWidget() {
      if (document.getElementById("supportChatWidget")) return;
  
      const widget = document.createElement("div");
      widget.id = "supportChatWidget";
  
      widget.innerHTML = `
      
      

      <button
        type="button"
        class="support-chat-launcher"
        id="supportChatLauncher"
        aria-label="فتح خدمة العملاء"
      >
        <span class="support-chat-launcher-icon">✉</span>
        <span class="support-chat-launcher-text">تواصل معنا</span>

        <span
          class="support-chat-unread-badge"
          id="supportChatUnreadBadge"
          aria-label="رسائل غير مقروءة"
          hidden
        >0</span>

        <span
          class="support-chat-dock-arrow"
          id="supportChatDockArrow"
          aria-hidden="true"
        >‹</span>
      </button>


  
        <section
          class="support-chat-window"
          id="supportChatWindow"
          aria-label="خدمة العملاء"
          aria-hidden="true"
        >
          <header class="support-chat-header">
            <div class="support-chat-header-info">
              <div class="support-chat-avatar">ح</div>
              <div>
                <h3>خدمة العملاء</h3>
                <p>أهلاً بك! كيف يمكننا مساعدتك؟</p>
              </div>
            </div>
  
            <button
              type="button"
              class="support-chat-close"
              id="supportChatClose"
              aria-label="إغلاق المحادثة"
            >×</button>
          </header>
  
          <div class="support-chat-messages" id="supportChatMessages">
            <div class="support-chat-welcome">
              <div class="support-chat-welcome-icon">✉</div>
              <h4>أهلاً بك في حكاية ورواية</h4>
              <p>اكتب رسالتك وسنكون سعداء بمساعدتك.</p>
            </div>
          </div>
  
          <form class="support-chat-form" id="supportChatForm">
            <textarea
              id="supportChatInput"
              placeholder="اكتب رسالتك هنا..."
              rows="1"
              maxlength="5000"
              required
            ></textarea>
  
            <button
              type="submit"
              id="supportChatSend"
              aria-label="إرسال الرسالة"
            >
              <span>➤</span>
            </button>
          </form>
  
          <div class="support-chat-footer">
            خدمة عملاء حكاية ورواية
          </div>
        </section>
      `;
  
      document.body.appendChild(widget);
  
      document
        .getElementById("supportChatLauncher")
        .addEventListener("click", openChat);


        document
        .getElementById("supportChatLauncher")
        .addEventListener("click", openChat);
  
      document
        .getElementById("supportChatDockArrow")
        .addEventListener("click", (event) => {
          event.stopPropagation();
          toggleDock();
        });
  
      document
        .getElementById("supportChatClose")
        .addEventListener("click", closeChat);

  
      document
        .getElementById("supportChatClose")
        .addEventListener("click", closeChat);
  
      document
        .getElementById("supportChatForm")
        .addEventListener("submit", sendMessage);
  
      document
        .getElementById("supportChatInput")
        .addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            document
              .getElementById("supportChatForm")
              .requestSubmit();
          }
        });
    }
  
    const getElement = (id) => document.getElementById(id);


    
// تحديث عداد الرسائل غير المقروءة
async function updateUnreadBadge() {
  const badge = getElement("supportChatUnreadBadge");
  if (!badge) return;

  try {
    const identity = await getIdentity();

    let result;

    if (identity.type === "user") {
      result = await supportDb.rpc("support_user_get_unread_count");
    } else {
      result = await supportDb.rpc("support_guest_get_unread_count", {
        p_guest_token: identity.token
      });
    }

    if (result.error) throw result.error;

    const unreadCount = Number(result.data) || 0;

    // لا نظهر العداد أثناء فتح المحادثة
    if (isOpen || unreadCount <= 0) {
      badge.hidden = true;
      return;
    }

    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    badge.hidden = false;

  } catch (error) {
    console.error("Support Chat unread count error:", error);
  }
}



    
  // إظهار وإخفاء زر خدمة العملاء
  function toggleDock() {
    const widget = getElement("supportChatWidget");
    const arrow = getElement("supportChatDockArrow");

    const isCollapsed = widget.classList.toggle("support-chat-collapsed");

    arrow.textContent = isCollapsed ? "›" : "‹";

    getElement("supportChatLauncher").setAttribute(
      "aria-label",
      isCollapsed ? "إظهار زر خدمة العملاء" : "فتح خدمة العملاء"
    );
  }




  
    // فتح المحادثة
    async function openChat() {
      if (isOpen) return;
  
      isOpen = true;
      saveChatState(CHAT_OPEN_KEY, true);
  
      getElement("supportChatWindow").classList.add("is-open");
      getElement("supportChatWindow").setAttribute("aria-hidden", "false");
      getElement("supportChatLauncher").classList.add("is-hidden");
  
      await loadConversation();
    }
  
    // إغلاق المحادثة
    
    function closeChat() {
      isOpen = false;
    
      getElement("supportChatWindow").classList.remove("is-open");
      getElement("supportChatWindow").setAttribute("aria-hidden", "true");
      getElement("supportChatLauncher").classList.remove("is-hidden");
    
      updateUnreadBadge();
    }

  
    // الحصول على المحادثة الحالية أو إنشاؤها
    async function getOrCreateConversation(identity) {
      let result;
  
      if (identity.type === "user") {
        result = await supportDb.rpc("support_user_get_or_create");
      } else {
        result = await supportDb.rpc("support_guest_get_or_create", {
          p_guest_token: identity.token
        });
      }
  
      if (result.error) throw result.error;
  
      return result.data;
    }
  
    // جلب الرسائل
    async function getMessages(identity, id) {
      let result;
  
      if (identity.type === "user") {
        result = await supportDb.rpc("support_user_get_messages", {
          p_conversation_id: id
        });
      } else {
        result = await supportDb.rpc("support_guest_get_messages", {
          p_guest_token: identity.token,
          p_conversation_id: id
        });
      }
  
      if (result.error) throw result.error;
  
      return Array.isArray(result.data) ? result.data : [];
    }
  
    // تحميل المحادثة والرسائل
    async function loadConversation() {
      if (isLoading) return;
  
      isLoading = true;
      showLoading();
  
      try {
        const identity = await getIdentity();
  
        // لو الهوية تغيرت، نبدأ محادثة الهوية الجديدة
        const identityKey = identity.type === "user"
          ? `user:${identity.id}`
          : `guest:${identity.token}`;
  
        if (currentIdentity !== identityKey) {
          conversationId = null;
          currentIdentity = identityKey;
        }
  
        if (!conversationId) {
          conversationId = await getOrCreateConversation(identity);
        }
  
        const messages = await getMessages(identity, conversationId);
  
        renderMessages(messages);
      } catch (error) {
        console.error("Support Chat loading error:", error);
        showError("تعذر تحميل المحادثة. حاول مرة أخرى.");
      } finally {
        isLoading = false;
      }
    }
  
    // إرسال رسالة
    async function sendMessage(event) {
      event.preventDefault();
  
      if (isSending) return;
  
      const input = getElement("supportChatInput");
      const message = input.value.trim();
  
      if (!message) return;
  
      isSending = true;
  
      const sendButton = getElement("supportChatSend");
      sendButton.disabled = true;
  
      try {
        const identity = await getIdentity();
  
        const identityKey = identity.type === "user"
          ? `user:${identity.id}`
          : `guest:${identity.token}`;
  
        if (currentIdentity !== identityKey) {
          conversationId = null;
          currentIdentity = identityKey;
        }
  
        if (!conversationId) {
          conversationId = await getOrCreateConversation(identity);
        }
  
        let result;
  
        if (identity.type === "user") {
          result = await supportDb.rpc("support_user_send_message", {
            p_conversation_id: conversationId,
            p_message: message
          });
        } else {
          result = await supportDb.rpc("support_guest_send_message", {
            p_guest_token: identity.token,
            p_conversation_id: conversationId,
            p_message: message
          });
        }
  
        if (result.error) throw result.error;
  
        input.value = "";
        await loadConversation();
  
      } catch (error) {
        console.error("Support Chat sending error:", error);
        showError("لم نتمكن من إرسال رسالتك. حاول مرة أخرى.");
      } finally {
        isSending = false;
        sendButton.disabled = false;
        input.focus();
      }
    }
  
    // عرض الرسائل
    function renderMessages(messages) {
      const container = getElement("supportChatMessages");
      container.innerHTML = "";
  
      if (!messages.length) {
        container.innerHTML = `
          <div class="support-chat-welcome">
            <div class="support-chat-welcome-icon">✉</div>
            <h4>أهلاً بك في حكاية ورواية</h4>
            <p>اكتب رسالتك وسنكون سعداء بمساعدتك.</p>
          </div>
        `;
        return;
      }
  
      messages.forEach((message) => {
        const isMine = message.sender_type === "user" ||
                       message.sender_type === "guest";
  
        const messageElement = document.createElement("div");
        messageElement.className = isMine
          ? "support-chat-message support-chat-message-mine"
          : "support-chat-message support-chat-message-admin";
  
        const textElement = document.createElement("div");
        textElement.className = "support-chat-message-text";
        textElement.textContent = message.message;
  
        const timeElement = document.createElement("div");
        timeElement.className = "support-chat-message-time";
        timeElement.textContent = formatTime(message.created_at);
  
        messageElement.appendChild(textElement);
        messageElement.appendChild(timeElement);
        container.appendChild(messageElement);
      });
  
      container.scrollTop = container.scrollHeight;
    }
  
    // تنسيق الوقت
    function formatTime(dateValue) {
      if (!dateValue) return "";
  
      const date = new Date(dateValue);
  
      if (Number.isNaN(date.getTime())) return "";
  
      return date.toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  
    // حالات التحميل والأخطاء
    function showLoading() {
      getElement("supportChatMessages").innerHTML = `
        <div class="support-chat-status">
          جارٍ تحميل المحادثة...
        </div>
      `;
    }
  
    function showError(message) {
      const container = getElement("supportChatMessages");
  
      const errorElement = document.createElement("div");
      errorElement.className = "support-chat-error";
      errorElement.textContent = message;
  
      container.appendChild(errorElement);
    }
  
    // تشغيل الواجهة

    function init() {
      createWidget();
    
      // فحص الرسائل غير المقروءة عند تشغيل الشات
      updateUnreadBadge();
    
      // تحديث العداد كل 5 ثوانٍ
      setInterval(updateUnreadBadge, 5000);
    }
    
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  
  })();  