
(() => {
    "use strict";
  
    const initGlobalScrollbar = () => {
      const scrollbar = document.getElementById("global-scrollbar");
      if (!scrollbar) return;
  
      const track = scrollbar.querySelector(".scrollbar-track");
      const thumb = scrollbar.querySelector(".scrollbar-thumb");
  
      if (!track || !thumb) return;
  
      let isDragging = false;
      let dragStartY = 0;
      let dragStartScroll = 0;
      let animationPending = false;
  
      const getMaxScroll = () =>
        Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight
        );
  
      const updateScrollbar = () => {
        animationPending = false;
  
        const trackHeight = scrollbar.clientHeight;
        const maxScroll = getMaxScroll();
  
        if (window.innerWidth < 768 || maxScroll <= 0 || trackHeight <= 0) {
          scrollbar.style.display = "none";
          return;
        }
  
        scrollbar.style.display = "block";
  
        const contentHeight = document.documentElement.scrollHeight;
        const thumbHeight = Math.min(
          trackHeight,
          Math.max(35, (window.innerHeight / contentHeight) * trackHeight)
        );
  
        const maxThumbTop = trackHeight - thumbHeight;
        const scrollRatio = window.scrollY / maxScroll;
  
        thumb.style.height = `${thumbHeight}px`;
        thumb.style.transform =
          `translate3d(0, ${scrollRatio * maxThumbTop}px, 0)`;
      };
  
      const scheduleUpdate = () => {
        if (animationPending) return;
  
        animationPending = true;
        requestAnimationFrame(updateScrollbar);
      };
  
      const scrollToPosition = (clientY) => {
        const rect = scrollbar.getBoundingClientRect();
        const thumbHeight = thumb.offsetHeight;
        const maxThumbTop = rect.height - thumbHeight;
  
        if (maxThumbTop <= 0) return;
  
        const thumbTop = Math.max(
          0,
          Math.min(clientY - rect.top - thumbHeight / 2, maxThumbTop)
        );
  
        window.scrollTo({
          top: (thumbTop / maxThumbTop) * getMaxScroll(),
          behavior: "auto"
        });
      };
  
      thumb.addEventListener("pointerdown", (event) => {
        isDragging = true;
        dragStartY = event.clientY;
        dragStartScroll = window.scrollY;
  
        thumb.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
  
      thumb.addEventListener("pointermove", (event) => {
        if (!isDragging) return;
  
        const maxScroll = getMaxScroll();
        const maxThumbTop = scrollbar.clientHeight - thumb.offsetHeight;
  
        if (maxThumbTop <= 0 || maxScroll <= 0) return;
  
        const deltaY = event.clientY - dragStartY;
        const scrollDelta = (deltaY / maxThumbTop) * maxScroll;
  
        document.documentElement.scrollTop = Math.max(
          0,
          Math.min(dragStartScroll + scrollDelta, maxScroll)
        );
      });
  
      const stopDragging = () => {
        isDragging = false;
      };
  
      thumb.addEventListener("pointerup", stopDragging);
      thumb.addEventListener("pointercancel", stopDragging);
  
      track.addEventListener("pointerdown", (event) => {
        if (event.target === thumb) return;
        scrollToPosition(event.clientY);
      });
  
      window.addEventListener("scroll", scheduleUpdate, { passive: true });
      window.addEventListener("resize", scheduleUpdate);
  
      // تحديث عند تحميل الصور والخطوط، لأن ارتفاع الصفحة قد يتغير.
      window.addEventListener("load", scheduleUpdate);
  
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(scheduleUpdate);
      }
  
      scheduleUpdate();
    };
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initGlobalScrollbar);
    } else {
      initGlobalScrollbar();
    }
  })();  