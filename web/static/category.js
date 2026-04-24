(function () {
  const slug = window.__CATEGORY_SLUG__;
  let page = Number(window.__INITIAL_PAGE__ || 1);
  const pageSize = 20;

  const grid = document.getElementById("productGrid");
  const metaText = document.getElementById("metaText");
  const pageText = document.getElementById("pageText");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const productDialog = document.getElementById("productDialog");
  const dialogTitle = document.getElementById("dialogTitle");
  const dialogImage = document.getElementById("dialogImage");
  const dialogDesc = document.getElementById("dialogDesc");
  const dialogSource = document.getElementById("dialogSource");

  prevBtn.addEventListener("click", () => {
    if (page > 1) {
      page -= 1;
      load();
    }
  });
  nextBtn.addEventListener("click", () => {
    page += 1;
    load();
  });

  async function load() {
    const res = await fetch(`/api/categories/${slug}/products?page=${page}&page_size=${pageSize}`);
    if (!res.ok) {
      metaText.textContent = "Could not load products.";
      grid.innerHTML = "";
      return;
    }
    const data = await res.json();
    const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));
    if (page > totalPages) {
      page = totalPages;
    }

    metaText.textContent = `${data.total} products in ${data.category_name}`;
    pageText.textContent = `Page ${data.page} / ${totalPages}`;
    prevBtn.disabled = data.page <= 1;
    nextBtn.disabled = data.page >= totalPages;

    grid.innerHTML = "";
    for (const p of data.products) {
      const card = document.createElement("article");
      card.className = "card";
      const safeTitle = escapeHtml(p.title || "");
      const safeDesc = escapeHtml((p.description || "").slice(0, 140));
      const safeImg = escapeHtml(p.image_url || "");
      const safeUrl = escapeHtml(p.source_url || "");
      const price = Number(p.list_price || 0).toFixed(2);
      card.innerHTML = `
        <div class="thumb">${safeImg ? `<img src="${safeImg}" alt="${safeTitle}" loading="lazy" />` : `<div class="imgFallback">No image</div>`}</div>
        <div class="body">
          <h3 class="title">${safeTitle}</h3>
          <p class="desc">${safeDesc}</p>
          <div class="priceRow">
            <div class="price">${p.currency || "USD"} ${price}</div>
            <a class="src" href="${safeUrl}" target="_blank" rel="noopener noreferrer">source</a>
          </div>
        </div>
      `;
      const imgEl = card.querySelector("img");
      if (imgEl) {
        imgEl.addEventListener("error", () => {
          imgEl.src = buildFallbackImageDataUrl(p.title, p.category_name || data.category_name);
        });
      }
      card.addEventListener("click", (ev) => {
        const link = ev.target.closest("a");
        if (link) return;
        openDialog(p, data.category_name);
      });
      grid.appendChild(card);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openDialog(product, categoryName) {
    dialogTitle.textContent = product.title || "Product";
    dialogImage.src = product.image_url || buildFallbackImageDataUrl(product.title, categoryName);
    dialogImage.alt = product.title || "Product image";
    dialogImage.onerror = () => {
      dialogImage.src = buildFallbackImageDataUrl(product.title, categoryName);
    };
    dialogDesc.textContent = product.description || "No description available yet.";
    dialogSource.href = product.source_url || "#";
    dialogSource.textContent = product.source_url ? "Open source page" : "Source not available";
    if (productDialog && typeof productDialog.showModal === "function") {
      productDialog.showModal();
    }
  }

  function buildFallbackImageDataUrl(title, category) {
    const safeTitle = escapeForSvg(title || "HelloKiyo Pick");
    const safeCategory = escapeForSvg(category || "Category");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 260'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='#ff4fa3'/>
          <stop offset='50%' stop-color='#2ad1c9'/>
          <stop offset='100%' stop-color='#2f46ff'/>
        </linearGradient>
      </defs>
      <rect width='420' height='260' fill='url(#g)' opacity='0.18'/>
      <rect x='14' y='14' width='392' height='232' rx='18' fill='white' opacity='0.8'/>
      <text x='210' y='102' text-anchor='middle' font-family='Arial, sans-serif' font-size='18' font-weight='700' fill='#0f172a'>${safeTitle}</text>
      <text x='210' y='138' text-anchor='middle' font-family='Arial, sans-serif' font-size='13' fill='#334155'>${safeCategory}</text>
      <text x='210' y='178' text-anchor='middle' font-family='Arial, sans-serif' font-size='24'>🎀 🍬 ✨</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function escapeForSvg(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  load();
})();

