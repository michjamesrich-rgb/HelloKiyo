import {
  BOX_TIERS,
  canAddItem,
  gaugeFill01,
  impactBand,
  remainingBudgetUsd,
} from "./economics.js?v=ship-20260425";
import {
  DESTINATIONS,
  getDefaultDestination,
  getDefaultShippingOption,
  SHIPPING_OPTIONS,
  shippingQuoteUsd,
  shippingRangeUsd,
} from "./shipping.js?v=ship-20260425";
import { track } from "./analytics.js";

// ---------------------------------------------------------------------------
// Unit-cost constants. See canvases/fx-margin-review.canvas.tsx for rationale.
//   USD_TO_JPY_RATE: 158 = ~1% cushion below live mid-market (~159.4). Applied
//     consistently across scrapers (backend/scrapers/*) and this frontend.
//   CURATED_WHOLESALE_FACTOR: only applies to Kiyo's $50 curated box (bulk buy).
//   CUSTOM_FACTOR: inventory-free model assumes near-retail procurement for
//     customizable boxes (we cannot rely on wholesale).
// Shipping to the customer is handled separately in src/shipping.js.
// ---------------------------------------------------------------------------
const USD_TO_JPY_RATE = 158;
const CURATED_WHOLESALE_FACTOR = 0.65;
const CUSTOM_FACTOR = 1.0;
const CURATED_INBOUND_PER_ITEM_USD = 0.25;

const els = {
  boxPicker: byId("boxPicker"),
  resetBtn: byId("resetBtn"),
  boxFill: byId("boxFill"),
  boxMiniStrip: byId("boxMiniStrip"),
  itemCount: byId("itemCount"),
  gaugePct: byId("gaugePct"),
  itemRemaining: byId("itemRemaining"),
  cart: byId("cart"),
  missions: byId("missionsGrid"),
  checkoutBtn: byId("checkoutBtn"),
  productGrid: byId("productGrid"),
  catalogTitle: byId("catalogTitle"),
  catalogEyebrow: byId("catalogEyebrow"),
  catalogMeta: byId("catalogMeta"),
  catalogPrevBtn: byId("catalogPrevBtn"),
  catalogPageText: byId("catalogPageText"),
  catalogNextBtn: byId("catalogNextBtn"),
  filters: byId("filters"),
  subFilters: byId("subFilters"),
  showcaseGrid: byId("showcaseGrid"),
  showcaseViewport: byId("showcaseViewport"),
  showcasePrev: byId("showcasePrev"),
  showcaseNext: byId("showcaseNext"),
  showcaseDots: byId("showcaseDots"),
  showcaseCarousel: byId("showcaseCarousel"),
  backToCollectionsBtn: byId("backToCollectionsBtn"),
  searchInput: byId("searchInput"),
  toast: byId("toast"),
  shipOptions: byId("shipOptions"),
  shipDestination: byId("shipDestination"),
  giftWrapOptions: byId("giftWrapOptions"),
  giftWrapMeta: byId("giftWrapMeta"),
  giftPreview: byId("giftPreview"),
  vibeBtn: byId("vibeBtn"),
  aiPickBtn: byId("aiPickBtn"),
  vibeDialog: byId("vibeDialog"),
  vibeCategories: byId("vibeCategories"),
  vibeAesthetic: byId("vibeAesthetic"),
  saveVibeBtn: byId("saveVibeBtn"),
  mysteryDialog: byId("mysteryDialog"),
  mysteryCapsules: byId("mysteryCapsules"),
  mysteryResult: byId("mysteryResult"),
  mysteryChoices: byId("mysteryChoices"),
  claimMysteryBtn: byId("claimMysteryBtn"),
  productDialog: byId("productDialog"),
  productDialogTitle: byId("productDialogTitle"),
  productDialogCategory: byId("productDialogCategory"),
  productDialogImage: byId("productDialogImage"),
  productDialogDesc: byId("productDialogDesc"),
  productDialogAddBtn: byId("productDialogAddBtn"),
  soundToggle: byId("soundToggle"),
  expandBoxBtn: byId("expandBoxBtn"),
  boxDialog: byId("boxDialog"),
  boxDialogTitle: byId("boxDialogTitle"),
  boxDialogSub: byId("boxDialogSub"),
  boxDialogGaugeFill: byId("boxDialogGaugeFill"),
  boxDialogGaugePct: byId("boxDialogGaugePct"),
  boxDialogGaugeItems: byId("boxDialogGaugeItems"),
  boxDialogGaugeTier: byId("boxDialogGaugeTier"),
  boxDialogStatus: byId("boxDialogStatus"),
  boxDialogList: byId("boxDialogList"),
  boxDialogCheckoutBtn: byId("boxDialogCheckoutBtn"),
};

const GIFT_WRAP_OPTIONS = [
  { id: "sakura-blush", label: "Sakura Blush", styleClass: "wrapSakura", priceUsd: 10 },
  { id: "indigo-wave", label: "Indigo Wave", styleClass: "wrapIndigo", priceUsd: 12 },
  { id: "matcha-gold", label: "Matcha Gold", styleClass: "wrapMatcha", priceUsd: 15 },
  { id: "sunset-origami", label: "Sunset Origami", styleClass: "wrapSunset", priceUsd: 18 },
  { id: "midnight-festival", label: "Midnight Festival", styleClass: "wrapMidnight", priceUsd: 20 },
];

const MYSTERY_SESSION_KEY = "hk_mystery_claimed_v2";
const DEFAULT_BOX_PRICE = 99;

// The $50 box is a CURATED starter: no custom picks, just Kiyo's hand-chosen
// candy + snack lineup. The frontend locks add/AI/qty actions in this mode.
const CURATED_TIER_PRICE = 50;
const CURATED_CATEGORIES = ["Japanese Candy Party", "Snack Market"];
const CURATED_TARGET_FILL = 0.9; // aim to fill ~90% of the $50 budget

const state = {
  boxTier: BOX_TIERS.find((t) => t.priceUsd === DEFAULT_BOX_PRICE) || BOX_TIERS[1],
  curatedLocked: false,
  items: [],
  bonusItems: [],
  products: [],
  // Default to "All" so the catalog matches whatever categories exist in the
  // loaded dataset (demo JSON uses Snacks/Beauty/…, not the full JP taxonomy).
  activeCategory: "All",
  activeSubcategory: null,
  catalogPage: 1,
  catalogPageSize: 18,
  searchQuery: "",
  shipping: getDefaultShippingOption(),
  destination: getDefaultDestination(),
  giftWrap: null,
  productDialogItem: null,
  mysteryReward: null,
  mysterySelectionId: null,
  soundEnabled: true,
  audioCtx: null,
  prefs: {
    categories: new Set(),
    aesthetic: new Set(),
  },
};

/* ---------------- Category + subcategory taxonomy ---------------- */
// Decorations (kanji label, gradient colors, emoji) shown on showcase cards.
const CATEGORY_DECOR = {
  "Japanese Candy Party": {
    kanji: "和菓子 • Okashi",
    cardA: "#ffd9eb",
    cardB: "#fff2a8",
    emoji: "🍬",
    teaser: "Chocolate, gummies, hard candy & milky favorites.",
  },
  "Travel-Size Beauty": {
    kanji: "美容 • Bihaku",
    cardA: "#ffd6e8",
    cardB: "#e5dcff",
    emoji: "💄",
    teaser: "Mini sheet masks, lip balms and dewy Tokyo skincare.",
  },
  "Cup Ramen Flavors": {
    kanji: "ラーメン • Ramen",
    cardA: "#ffd8c2",
    cardB: "#ffeaa8",
    emoji: "🍜",
    teaser: "Tonkotsu, curry, spicy, seafood and cozy classics.",
  },
  "Kawaii Stationery": {
    kanji: "文房具 • Bunbogu",
    cardA: "#d6eaff",
    cardB: "#ffe3f0",
    emoji: "✏️",
    teaser: "Pilot pens, Tombow erasers, notebooks and stickers.",
  },
  "Snack Market": {
    kanji: "お菓子 • Konbini",
    cardA: "#ffe7b0",
    cardB: "#ffd0de",
    emoji: "🍪",
    teaser: "Calbee chips, Pocky, senbei rice crackers and tea.",
  },
  "Plush & Keychains": {
    kanji: "ぬいぐるみ • Plush",
    cardA: "#ffd6ec",
    cardB: "#d9d0ff",
    emoji: "🧸",
    teaser: "Sanrio, Chiikawa, Pokemon and Ghibli characters.",
  },
  "Crafts & DIY": {
    kanji: "手芸 • Shugei",
    cardA: "#ffe3c2",
    cardB: "#d9ecff",
    emoji: "🎨",
    teaser: "Origami, deco clay, washi tape, resin & brush pens.",
  },
};

// Subcategories per main category. Each has an id, label, emoji, and a list of
// match patterns. Patterns are lowercased regex alternation strings. We match
// against a blob that includes both the ORIGINAL scraped title (CJK) and the
// English title so classification works before/after translation.
const SUBCATEGORIES = {
  "Japanese Candy Party": [
    {
      id: "chocolate",
      label: "Chocolate",
      emoji: "🍫",
      patterns: ["chocolate", "choco", "kit\\s*kat", "pocky", "meltyblend", "巧克力", "ガーナ", "香烤巧克力"],
    },
    {
      id: "gummy",
      label: "Gummy",
      emoji: "🍬",
      patterns: ["gumm", "cororo", "hi-?chew", "hichew", "qq\\s*糖", "软糖", "忍者饭", "pure\\s", "puchao", "ゼリー", "果汁软糖"],
    },
    {
      id: "jelly",
      label: "Jelly",
      emoji: "🍮",
      patterns: ["jelly", "konjac", "蒟蒻", "果冻", "orihiro"],
    },
    {
      id: "hard-candy",
      label: "Hard Candy",
      emoji: "🍭",
      patterns: ["mintia", "throat", "ryukakusan", "kamukamu", "硬糖", "喉糖", "ドロップ", "drop\\s*candy", "lemon\\s*candy", "柠檬"],
    },
    {
      id: "milky-caramel",
      label: "Milky & Caramel",
      emoji: "🥛",
      patterns: ["milk", "milky", "caramel", "牛奶糖", "焦糖", "浓厚牛奶", "morinaga.*milk", "nobel.*牛奶"],
    },
  ],
  "Travel-Size Beauty": [
    {
      id: "sheet-mask",
      label: "Sheet Masks",
      emoji: "🧖‍♀️",
      patterns: ["sheet\\s*mask", "clear\\s*turn", "lululun", "mediheal", "face\\s*mask", "面膜", "パック"],
    },
    {
      id: "lip",
      label: "Lip Care",
      emoji: "💄",
      patterns: ["lip", "lipstick", "lip\\s*balm", "rouge", "唇膏", "リップ"],
    },
    {
      id: "skincare",
      label: "Skincare",
      emoji: "✨",
      patterns: ["lotion", "serum", "essence", "toner", "moistur", "cleanser", "cream", "化粧水", "美容液", "乳液", "精华", "クリーム"],
    },
    {
      id: "nail",
      label: "Nail Care",
      emoji: "💅",
      patterns: ["nail", "manicure", "指甲", "cuticle", "美甲", "精华指缘"],
    },
    {
      id: "hair",
      label: "Hair",
      emoji: "💇‍♀️",
      patterns: ["shampoo", "conditioner", "hair\\s*oil", "hair\\s*care", "洗发", "护发", "シャンプー"],
    },
    {
      id: "makeup",
      label: "Makeup",
      emoji: "🌸",
      patterns: ["bb\\s*cream", "foundation", "concealer", "blush", "eyeshadow", "眉笔", "粉底", "bb霜", "眼影", "チーク"],
    },
  ],
  "Cup Ramen Flavors": [
    {
      id: "classic",
      label: "Classic",
      emoji: "🍜",
      patterns: ["cup\\s*noodle", "nissin.*original", "classic", "经典", "原味", "カップヌードル"],
    },
    {
      id: "spicy",
      label: "Spicy",
      emoji: "🌶️",
      patterns: ["spicy", "chili", "hot\\s", "激辣", "辣", "tom\\s*yum", "泰式酸辣"],
    },
    {
      id: "tonkotsu",
      label: "Tonkotsu",
      emoji: "🐷",
      patterns: ["tonkotsu", "pork", "ichiran", "一蘭", "豚骨", "一兰"],
    },
    {
      id: "seafood",
      label: "Seafood",
      emoji: "🦐",
      patterns: ["seafood", "shrimp", "prawn", "海鲜", "虾", "シーフード"],
    },
    {
      id: "curry",
      label: "Curry",
      emoji: "🍛",
      patterns: ["curry", "咖喱", "カレー"],
    },
    {
      id: "udon-soba",
      label: "Udon & Soba",
      emoji: "🍥",
      patterns: ["udon", "soba", "yakisoba", "乌冬", "荞麦", "炒面", "うどん"],
    },
  ],
  "Kawaii Stationery": [
    {
      id: "pens",
      label: "Pens",
      emoji: "🖊️",
      patterns: ["pilot", "frixion", "pen\\b", "gel\\s*pen", "中性笔", "圆珠笔", "ボールペン"],
    },
    {
      id: "pencils",
      label: "Pencils",
      emoji: "✏️",
      patterns: ["pencil", "mechanical\\s*pencil", "铅笔", "鉛筆", "k9800"],
    },
    {
      id: "erasers",
      label: "Erasers",
      emoji: "🧽",
      patterns: ["eraser", "橡皮擦", "mono\\s*eraser", "air-?in", "消しゴム"],
    },
    {
      id: "markers",
      label: "Markers",
      emoji: "🖍️",
      patterns: ["marker", "highlighter", "荧光笔", "マーカー"],
    },
    {
      id: "paper",
      label: "Paper & Notebooks",
      emoji: "📓",
      patterns: ["notebook", "journal", "5mm", "sakamoto.*方格", "笔记本", "ノート"],
    },
    {
      id: "stickers",
      label: "Stickers & Washi",
      emoji: "🏷️",
      patterns: ["sticker", "washi", "tape", "贴纸", "テープ"],
    },
  ],
  "Snack Market": [
    {
      id: "chips",
      label: "Chips",
      emoji: "🍟",
      patterns: ["calbee", "jagabee", "chip", "薯条", "薯片", "potato", "ポテト"],
    },
    {
      id: "biscuit-cookie",
      label: "Biscuits",
      emoji: "🍪",
      patterns: ["biscuit", "cookie", "cracker", "pocky", "饼干", "曲奇", "collon", "cheeza", "ビスケット"],
    },
    {
      id: "senbei",
      label: "Rice Crackers",
      emoji: "🍘",
      patterns: ["senbei", "rice\\s*cracker", "仙贝", "歌舞伎", "せんべい"],
    },
    {
      id: "chocolate-snack",
      label: "Chocolate",
      emoji: "🍫",
      patterns: ["chocolate", "choco", "kit\\s*kat", "巧克力"],
    },
    {
      id: "tea-drink",
      label: "Tea",
      emoji: "🍵",
      patterns: ["\\bitoen\\b", "tea\\s*bag", "matcha", "抹茶", "茶", "伊藤园"],
    },
    {
      id: "energy-bars",
      label: "Energy & Bars",
      emoji: "⚡",
      patterns: ["caloriemate", "energy\\s*bar", "能量棒", "balance"],
    },
  ],
  "Crafts & DIY": [
    // IMPORTANT: order matters. The classifier stops at the first match.
    // Put the MOST SPECIFIC patterns first. "Origami" goes last because its
    // generic "washi" pattern would otherwise swallow washi-tape / stickers.
    {
      id: "washi-tape",
      label: "Washi Tape",
      emoji: "🎀",
      patterns: [
        "washi\\s*tape",
        "masking\\s*tape",
        "\\bmt\\s*washi\\b",
        "マスキング",
        "マステ",
      ],
    },
    {
      id: "stickers",
      label: "Stickers",
      emoji: "💗",
      patterns: [
        "sticker",
        "\\bflake\\b",
        "\\bbgm\\b",
        "deco\\s*sticker",
        "シール",
      ],
    },
    {
      id: "brush-pens",
      label: "Brush Pens",
      emoji: "🖌️",
      patterns: [
        "brush\\s*pen",
        "fudenosuke",
        "\\bfude\\b",
        "kuretake",
        "tombow",
        "akashiya",
        "calligraphy",
        "shod[oō]",
        "筆ペン",
        "書道",
      ],
    },
    {
      id: "clay",
      label: "Deco Clay",
      emoji: "🧁",
      patterns: [
        "\\bclay\\b",
        "polymer",
        "padico",
        "hearty",
        "sweets?\\s*deco",
        "deco\\s*cream",
        "whip(ped)?\\s*cream",
        "silicone\\s*mold",
        "粘土",
        "スイーツデコ",
      ],
    },
    {
      id: "resin",
      label: "Resin & Charms",
      emoji: "💎",
      patterns: [
        "\\bresin\\b",
        "uv\\s*resin",
        "jewelry\\s*findings?",
        "keychain\\s*findings?",
        "mix-?in",
        "\\bbails?\\b",
        "レジン",
      ],
    },
    {
      id: "beads",
      label: "Beads & Aquabeads",
      emoji: "🫧",
      patterns: [
        "aquabead",
        "aqua\\s*beads?",
        "perler",
        "fuse\\s*beads?",
        "bracelet\\s*bead",
        "\\bbead",
        "ビーズ",
      ],
    },
    {
      id: "origami",
      label: "Origami & Washi",
      emoji: "🎴",
      patterns: [
        "origami",
        "chiyogami",
        "washi\\s*origami",
        "\\bwashi\\s*paper",
        "foil\\s*paper",
        "折り紙",
        "和紙",
        "千代紙",
      ],
    },
  ],
  "Plush & Keychains": [
    {
      id: "sanrio",
      label: "Sanrio",
      emoji: "🎀",
      patterns: ["sanrio", "hello\\s*kitty", "my\\s*melody", "cinnamoroll", "kuromi", "pompompurin", "pochacco", "pekkle"],
    },
    {
      id: "chiikawa",
      label: "Chiikawa",
      emoji: "🥺",
      patterns: ["chiikawa", "hachiware", "usagi", "momonga"],
    },
    {
      id: "pokemon",
      label: "Pokemon",
      emoji: "⚡",
      patterns: ["pokemon", "pikachu", "eevee", "jigglypuff", "snorlax", "psyduck"],
    },
    {
      id: "ghibli",
      label: "Ghibli",
      emoji: "🌿",
      patterns: ["ghibli", "totoro", "jiji", "kodama", "soot\\s*sprite"],
    },
    {
      id: "miffy-rilakkuma",
      label: "Miffy & Rilakkuma",
      emoji: "🐻",
      patterns: ["miffy", "rilakkuma", "korilakkuma", "kiiroitori"],
    },
    {
      id: "sumikko",
      label: "Sumikko Gurashi",
      emoji: "🧸",
      patterns: ["sumikko", "shirokuma", "\\bneko\\b"],
    },
  ],
};

// Map a product to its subcategory using the combined blob of available text.
// Returns {id, label, emoji} or a fallback {id: "other", label: "More", emoji: "✨"}.
function classifyProduct(categoryName, blob) {
  const defs = SUBCATEGORIES[categoryName] || [];
  const text = String(blob || "").toLowerCase();
  for (const sub of defs) {
    for (const pat of sub.patterns) {
      try {
        const re = new RegExp(pat, "i");
        if (re.test(text)) return { id: sub.id, label: sub.label, emoji: sub.emoji };
      } catch (_) {
        if (text.includes(pat.toLowerCase())) {
          return { id: sub.id, label: sub.label, emoji: sub.emoji };
        }
      }
    }
  }
  return { id: "other", label: "More favorites", emoji: "✨" };
}

const MISSIONS = [
  {
    id: "mix_and_match",
    title: "Mix & Match Mission",
    description: "Add 1 candy/snack + 1 beauty + 1 kawaii item to unlock a bonus.",
    requiresCategoryGroups: [["snack", "candy"], ["beauty"], ["kawaii", "stationery"]],
    bonusLabel: "Bonus cute sticker pack",
  },
  {
    id: "beauty_trio",
    title: "Beauty Trio Bonus",
    description: "Add any 3 beauty picks to unlock a free travel-size bonus.",
    requiresCategoryGroups: [["beauty"], ["beauty"], ["beauty"]],
    requiresUniqueItems: 3,
    bonusLabel: "Bonus travel-size beauty item",
  },
];

boot();

function syncActiveCategoryWithCatalog() {
  if (state.activeCategory === "All") return;
  const has = state.products.some((p) => p.category === state.activeCategory);
  if (!has) state.activeCategory = "All";
}

async function boot() {
  renderBoxPicker();
  wireEvents();
  state.products = await loadProducts();
  syncActiveCategoryWithCatalog();
  applyTierPricingToCatalog();
  renderFilters();
  renderShipping();
  renderGiftWrap();
  renderVibeDialog();
  renderMysteryGame();
  renderShowcase();
  renderCatalog();
  updateCatalogHeader();
  renderCart();
  renderMissions();
  renderGauge();
  applyDemoModeFromUrl();
  maybeOpenMysteryDialog();
  updateSoundToggleLabel();
}

function applyDemoModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (![...params.keys()].length) return;

  if (params.get("hideHero") === "1") {
    document.body.classList.add("hideHero");
  }

  const box = Number(params.get("box"));
  if (Number.isFinite(box) && box > 0) {
    const tier = BOX_TIERS.find((t) => t.priceUsd === box);
    if (tier) {
      state.boxTier = tier;
      state.items = [];
      applyTierPricingToCatalog();
      syncActiveTier();
    }
  }

  const vibeCats = (params.get("vibeCats") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const c of vibeCats) state.prefs.categories.add(c);

  const vibeAesthetic = (params.get("vibeAesthetic") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const v of vibeAesthetic) state.prefs.aesthetic.add(v);

  const autofill = params.get("autofill") === "1";
  if (autofill && state.boxTier) autoFillBox();

  const dialog = params.get("dialog");
  if (dialog === "vibe") {
    renderVibeDialog();
    els.vibeDialog.showModal();
  }

  renderAll();
}

function wireEvents() {
  els.resetBtn.addEventListener("click", () => {
    if (isCuratedLocked()) {
      // Reset re-rolls Kiyo's curated starter (slightly different picks) instead
      // of emptying the box — since the $50 tier doesn't allow empty/custom.
      applyCuratedBoxIfNeeded();
      track("reset_clicked", { hasBox: true, curated: true });
      playSfx("reset");
      toast("Kiyo restocked your curated starter ♡");
      renderAll();
      return;
    }
    state.items = [];
    state.bonusItems = getPersistentBonusItems();
    track("reset_clicked", { hasBox: Boolean(state.boxTier) });
    playSfx("reset");
    toast("Reset!");
    renderAll();
  });

  els.checkoutBtn.addEventListener("click", () => {
    toast("Checkout is a demo placeholder.");
  });

  if (els.expandBoxBtn) {
    els.expandBoxBtn.addEventListener("click", () => {
      openBoxDialog();
    });
  }
  if (els.boxDialogCheckoutBtn) {
    els.boxDialogCheckoutBtn.addEventListener("click", () => {
      toast("Checkout is a demo placeholder.");
    });
  }

  els.vibeBtn.addEventListener("click", () => {
    els.vibeDialog.showModal();
    track("vibe_dialog_opened");
  });

  els.aiPickBtn.addEventListener("click", () => {
    if (!state.boxTier) {
      toast("Pick a box first.");
      return;
    }
    if (isCuratedLocked()) {
      playSfx("error");
      toast("Kiyo's $50 box is already curated 💝 Upgrade to $99 to customize.");
      return;
    }
    const picked = autoFillBox();
    if (picked.added === 0) {
      playSfx("error");
      toast("No picks fit right now. Try a bigger box.");
    } else {
      playSfx("win");
      burstConfetti(window.innerWidth * 0.5, 220, 12);
      toast(`AI added ${picked.added} item${picked.added === 1 ? "" : "s"}!`);
    }
    track("ai_pick_clicked", { added: picked.added, boxTierId: state.boxTier.id });
    renderAll();
  });

  els.saveVibeBtn.addEventListener("click", () => {
    track("vibe_saved", {
      categories: [...state.prefs.categories],
      aesthetic: [...state.prefs.aesthetic],
    });
    playSfx("select");
    toast("Saved your vibe.");
    renderCatalog();
  });

  els.claimMysteryBtn.addEventListener("click", () => {
    claimMysteryReward();
  });

  els.productDialogAddBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (!state.productDialogItem) return;
    addProductFromCatalog(state.productDialogItem);
  });

  els.catalogPrevBtn.addEventListener("click", () => {
    if (state.catalogPage <= 1) return;
    state.catalogPage -= 1;
    renderCatalog();
  });
  els.catalogNextBtn.addEventListener("click", () => {
    state.catalogPage += 1;
    renderCatalog();
  });

  if (els.backToCollectionsBtn) {
    els.backToCollectionsBtn.addEventListener("click", () => {
      state.activeCategory = "All";
      state.activeSubcategory = null;
      state.catalogPage = 1;
      state.searchQuery = "";
      if (els.searchInput) els.searchInput.value = "";
      renderFilters();
      renderCatalog();
      updateCatalogHeader();
      requestAnimationFrame(() => {
        const target = document.getElementById("discover");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      track("back_to_collections");
    });
  }

  els.soundToggle.addEventListener("click", async () => {
    state.soundEnabled = !state.soundEnabled;
    if (state.soundEnabled) {
      await ensureAudio();
      playSfx("toggle_on");
    }
    updateSoundToggleLabel();
    track("sound_toggled", { enabled: state.soundEnabled });
  });

  if (els.searchInput) {
    let debounceId = null;
    els.searchInput.addEventListener("input", () => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        state.searchQuery = els.searchInput.value.trim();
        state.catalogPage = 1;
        renderCatalog();
        track("search_updated", { query: state.searchQuery });
      }, 140);
    });
  }

  if (els.shipDestination) {
    els.shipDestination.addEventListener("change", () => {
      const id = String(els.shipDestination.value || "us");
      state.destination = DESTINATIONS.find((d) => d.id === id) || DESTINATIONS[0];
      renderAll();
      track("shipping_destination_selected", { destinationId: state.destination.id });
    });
  }
}

function renderAll() {
  renderShipping();
  renderGiftWrap();
  renderShowcase();
  renderCatalog();
  updateCatalogHeader();
  renderCart();
  renderMissions();
  renderGauge();
  // Keep the expanded Your Box view in sync whenever anything changes.
  if (els.boxDialog && els.boxDialog.open) {
    renderBoxDialog();
  }
}

function renderBoxPicker() {
  els.boxPicker.innerHTML = "";
  const labels = {
    50: "Kiyo's Mini 💝",
    99: "Cutie Classic 🎀",
    169: "Sparkle Spree ✨",
    249: "Ultimate Kawaii 🌸",
  };
  for (const tier of BOX_TIERS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.innerHTML = `$${tier.priceUsd} <small>${
      labels[tier.priceUsd] || "Japan spree"
    }</small>`;
    btn.addEventListener("click", () => {
      state.boxTier = tier;
      state.items = [];
      state.bonusItems = getPersistentBonusItems();
      applyTierPricingToCatalog();
      if (tier.priceUsd === CURATED_TIER_PRICE) {
        applyCuratedBoxIfNeeded();
        toast("💝 Kiyo's $50 curated starter is ready!");
      } else {
        state.curatedLocked = false;
        toast(`Picked the $${tier.priceUsd} box. Let's go!`);
      }
      track("box_selected", {
        boxTierId: tier.id,
        priceUsd: tier.priceUsd,
        curated: state.curatedLocked,
      });
      playSfx("coin");
      syncActiveTier();
      renderAll();
    });
    btn.dataset.tierId = tier.id;
    els.boxPicker.appendChild(btn);
  }
  syncActiveTier();
}

function syncActiveTier() {
  const activeId = state.boxTier?.id ?? null;
  for (const el of els.boxPicker.querySelectorAll(".chip")) {
    el.classList.toggle("active", el.dataset.tierId === activeId);
  }
}

function renderGauge() {
  const tier = state.boxTier;
  if (!tier) {
    setBoxFill(0);
    els.itemCount.textContent = "0";
    els.gaugePct.textContent = "0%";
    els.itemRemaining.textContent = "Pick a box to start";
    renderBoxMiniStrip();
    els.checkoutBtn.disabled = true;
    els.checkoutBtn.textContent = "Checkout (demo)";
    return;
  }

  const fill = gaugeFill01({ boxTier: tier, items: state.items });
  const remaining = remainingBudgetUsd({ boxTier: tier, items: state.items });
  setBoxFill(fill);
  renderBoxMiniStrip();

  els.itemCount.textContent = String(state.items.length);
  els.gaugePct.textContent = `${Math.round(fill * 100)}%`;
  els.checkoutBtn.disabled = state.items.length === 0;
  const ship = shippingQuoteForState();
  const parts = [];
  if (ship > 0) parts.push(`Shipping +$${ship.toFixed(2)}`);
  if (state.giftWrap) parts.push(`Gift wrap +$${state.giftWrap.priceUsd.toFixed(2)}`);
  els.checkoutBtn.textContent = parts.length ? `Checkout • ${parts.join(" • ")}` : "Checkout (demo)";

  els.itemRemaining.textContent = estimateRemainingItemsLabel({ remainingBudgetUsd: remaining });
}

function renderBoxMiniStrip() {
  const items = state.items.concat(state.bonusItems).slice(-18);
  els.boxMiniStrip.innerHTML = "";
  for (const it of items) {
    const img = document.createElement("img");
    img.className = "boxMiniThumb";
    img.alt = it.title || "Item";
    img.loading = "lazy";
    img.src = it.image || buildFallbackImageDataUrl(it);
    img.addEventListener("error", () => {
      img.src = buildFallbackImageDataUrl(it);
    });
    els.boxMiniStrip.appendChild(img);
  }
}

function renderShipping() {
  els.shipOptions.innerHTML = "";
  if (els.shipDestination) {
    els.shipDestination.value = state.destination?.id || "us";
  }
  for (const opt of SHIPPING_OPTIONS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.classList.toggle("active", state.shipping?.id === opt.id);
    const tierId = state.boxTier?.id || "box_99";
    const destinationId = state.destination?.id || "us";
    const range = shippingRangeUsd({ boxTierId: tierId, destinationId, optionId: opt.id });
    b.innerHTML = `${escapeHtml(opt.label)} <small>${escapeHtml(opt.speedLabel)} • $${range.min.toFixed(
      2
    )}–$${range.max.toFixed(2)} (est.)</small>`;
    b.addEventListener("click", () => {
      state.shipping = opt;
      renderShipping();
      const quoteUsd = shippingQuoteUsd({ boxTierId: tierId, destinationId, optionId: opt.id });
      track("shipping_selected", {
        shippingId: opt.id,
        destinationId,
        quoteUsd,
        rangeMinUsd: range.min,
        rangeMaxUsd: range.max,
      });
      playSfx("select");
      toast(`Shipping: ${opt.label}`);
    });
    els.shipOptions.appendChild(b);
  }
}

function shippingQuoteForState() {
  const tierId = state.boxTier?.id || "box_99";
  const destinationId = state.destination?.id || "us";
  const optionId = state.shipping?.id || "standard";
  return shippingQuoteUsd({ boxTierId: tierId, destinationId, optionId });
}

function applyTierPricingToCatalog() {
  const tier = state.boxTier || BOX_TIERS[1];
  state.products = state.products.map((p) => applyTierCosts(p, tier));
}

function applyTierCosts(p, tier) {
  const currency = String(p.currency || "JPY").toUpperCase();
  const listPrice = Number(p.listPrice || p.list_price || 0);
  const derivedRetailYen =
    currency === "JPY" ? listPrice : listPrice * USD_TO_JPY_RATE;
  const retailYen = Number(p.retailYen || derivedRetailYen || 0);
  const isCurated = tier.priceUsd === CURATED_TIER_PRICE;
  const factor = isCurated ? CURATED_WHOLESALE_FACTOR : CUSTOM_FACTOR;
  const supplierUnitCostUsd = Math.max(0.35, (retailYen * factor) / USD_TO_JPY_RATE);
  const expectedJapanToUSShippingAllocationUsd = isCurated ? CURATED_INBOUND_PER_ITEM_USD : 0;
  const handlingAllowanceUsd = 0;
  return {
    ...p,
    retailYen,
    supplierUnitCostUsd,
    expectedJapanToUSShippingAllocationUsd,
    handlingAllowanceUsd,
  };
}

function renderGiftWrap() {
  els.giftWrapOptions.innerHTML = "";
  for (const opt of GIFT_WRAP_OPTIONS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.classList.toggle("active", state.giftWrap?.id === opt.id);
    b.innerHTML = `${escapeHtml(opt.label)} <small>+$${opt.priceUsd.toFixed(2)}</small>`;
    b.addEventListener("click", () => {
      state.giftWrap = state.giftWrap?.id === opt.id ? null : opt;
      renderAll();
      track("gift_wrap_selected", { wrapId: state.giftWrap?.id ?? null });
      playSfx("select");
      toast(
        state.giftWrap
          ? `Gift wrap: ${state.giftWrap.label} (+$${state.giftWrap.priceUsd.toFixed(2)})`
          : "Gift wrap removed"
      );
    });
    els.giftWrapOptions.appendChild(b);
  }

  const cloth = els.giftPreview.querySelector(".giftPreviewCloth");
  if (cloth) {
    cloth.classList.remove("wrapSakura", "wrapIndigo", "wrapMatcha", "wrapSunset", "wrapMidnight");
    if (state.giftWrap) cloth.classList.add(state.giftWrap.styleClass);
  }
  els.giftWrapMeta.textContent = state.giftWrap
    ? `${state.giftWrap.label} selected • +$${state.giftWrap.priceUsd.toFixed(2)}`
    : "No wrap selected";
}

function setBoxFill(fill01) {
  els.boxFill.style.height = `${Math.round(clamp01(fill01) * 100)}%`;
  const color =
    fill01 < 0.35
      ? "linear-gradient(180deg, rgba(255,79,163,.75), rgba(42,209,201,.6))"
      : fill01 < 0.75
      ? "linear-gradient(180deg, rgba(255,79,163,.8), rgba(47,70,255,.7))"
      : "linear-gradient(180deg, rgba(47,70,255,.8), rgba(255,79,163,.72))";
  els.boxFill.style.background = color;
}

function estimateRemainingItemsLabel({ remainingBudgetUsd }) {
  const avg =
    state.products.length > 0
      ? state.products.reduce((s, p) => s + estimateItemCostBasis(p), 0) / state.products.length
      : 2.5;
  const rem = Math.max(0, Number(remainingBudgetUsd) || 0);
  const approx = Math.max(0, Math.floor(rem / Math.max(0.75, avg)));

  if (!state.boxTier) return "Pick a box to start";
  if (approx === 0) return "At the limit — ready to check out";
  if (approx === 1) return "About 1 item left";
  return `About ${approx} items left`;
}

function estimateItemCostBasis(p) {
  const a = Number(p.supplierUnitCostUsd) || 0;
  const b = Number(p.expectedJapanToUSShippingAllocationUsd) || 0;
  const c = Number(p.handlingAllowanceUsd) || 0;
  return a + b + c;
}

function renderCart() {
  els.cart.innerHTML = "";

  if (isCuratedLocked()) {
    const banner = document.createElement("div");
    banner.className = "curatedBanner";
    banner.innerHTML = `
      <div class="curatedBannerIcon" aria-hidden="true">💝</div>
      <div class="curatedBannerCopy">
        <div class="curatedBannerTitle">Kiyo's $50 Curated Starter</div>
        <div class="curatedBannerSub">Candy &amp; snacks hand-picked by Kiyo — no swaps, just vibes. Upgrade to $99 to customize.</div>
      </div>
    `;
    els.cart.appendChild(banner);
  }

  if (state.items.length === 0 && state.bonusItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "cartEmpty";
    empty.innerHTML = `
      <div style="font-size:22px; margin-bottom:6px;">🎀</div>
      <div style="font-weight:800; color:var(--text); margin-bottom:4px;">Your box is empty</div>
      <div>Tap a cute pick to start filling it up!</div>
    `;
    els.cart.appendChild(empty);
    return;
  }

  for (const it of state.items.concat(state.bonusItems)) {
    const row = document.createElement("div");
    row.className = "cartItem";
    const isBonus = Boolean(it._isBonus);
    const imgSrc = it.image || buildFallbackImageDataUrl(it);
    row.innerHTML = `
      <div class="cartLeft">
        <img class="cartItemThumb" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(it.title)}" loading="lazy" />
        <div class="cartItemInfo">
          <div class="cartItemTitle" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</div>
          <div class="cartItemMeta">${
            isBonus
              ? `<span class="bonusPill">BONUS</span>`
              : `<span class="pill">${escapeHtml(it.category)}</span>`
          }</div>
        </div>
      </div>
      ${
        isBonus || isCuratedLocked()
          ? ""
          : `<button class="remove" type="button" aria-label="Remove ${escapeHtml(
              it.title
            )}">✕</button>`
      }
    `;
    const thumb = row.querySelector(".cartItemThumb");
    if (thumb) {
      thumb.addEventListener("error", () => {
        thumb.src = buildFallbackImageDataUrl(it);
      });
    }
    const removeBtn = row.querySelector(".remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        state.items = state.items.filter((x) => x._instanceId !== it._instanceId);
        track("item_removed", { productId: it.id, title: it.title });
        playSfx("remove");
        renderAll();
      });
    }
    els.cart.appendChild(row);
  }
}

const BOX_TIER_LABELS = {
  50: "Kiyo's Mini",
  99: "Cutie Classic",
  169: "Sparkle Spree",
  249: "Ultimate Kawaii",
};

// True when the current box is Kiyo's locked $50 curated starter.
function isCuratedLocked() {
  return (
    state.curatedLocked &&
    state.boxTier?.priceUsd === CURATED_TIER_PRICE
  );
}

// Kiyo's personal picks: take the most colorful, cheapest items from
// the candy + snack categories and fill the $50 box to ~90% capacity.
function buildKiyoCuratedBox(tier) {
  if (!tier || !state.products.length) return [];
  const pool = state.products
    .filter((p) => CURATED_CATEGORIES.includes(p.category))
    .slice()
    .sort(
      (a, b) =>
        visualAppeal(b) - visualAppeal(a) ||
        priceNumber(a) - priceNumber(b)
    );

  const chosen = [];
  const seenIds = new Set();
  // Pass 1: target variety — one from each subcategory first so the
  // curated box doesn't end up being all chocolate or all chips.
  const bySub = new Map();
  for (const p of pool) {
    const key = `${p.category}|${p.subcategoryId || p.subcategoryLabel || "x"}`;
    if (!bySub.has(key)) bySub.set(key, []);
    bySub.get(key).push(p);
  }
  for (const bucket of bySub.values()) {
    const pick = bucket[0];
    if (!pick || seenIds.has(pick.id)) continue;
    const trial = chosen.concat([{ ...pick, _instanceId: crypto.randomUUID(), _curated: true }]);
    if (canAddItem({ boxTier: tier, items: trial.slice(0, -1), candidateItem: pick })) {
      chosen.push(trial[trial.length - 1]);
      seenIds.add(pick.id);
    }
    const fill = gaugeFill01({ boxTier: tier, items: chosen });
    if (fill >= CURATED_TARGET_FILL) break;
  }
  // Pass 2: top up with additional colorful/cheap picks up to capacity.
  if (gaugeFill01({ boxTier: tier, items: chosen }) < CURATED_TARGET_FILL) {
    for (const p of pool) {
      if (seenIds.has(p.id)) continue;
      if (
        !canAddItem({
          boxTier: tier,
          items: chosen,
          candidateItem: p,
        })
      )
        continue;
      chosen.push({ ...p, _instanceId: crypto.randomUUID(), _curated: true });
      seenIds.add(p.id);
      const fill = gaugeFill01({ boxTier: tier, items: chosen });
      if (fill >= CURATED_TARGET_FILL) break;
    }
  }
  return chosen;
}

// Apply / refresh the curated box based on current tier.
function applyCuratedBoxIfNeeded() {
  if (state.boxTier?.priceUsd !== CURATED_TIER_PRICE) return;
  state.curatedLocked = true;
  const items = buildKiyoCuratedBox(state.boxTier);
  state.items = items;
  state.bonusItems = getPersistentBonusItems();
}

function renderBoxDialog() {
  if (!els.boxDialog) return;

  const tier = state.boxTier;
  const tierLabel = tier
    ? BOX_TIER_LABELS[tier.priceUsd] || `$${tier.priceUsd}`
    : "";
  if (tier) {
    els.boxDialogTitle.textContent = `Your $${tier.priceUsd} ${tierLabel} Spree`;
    els.boxDialogGaugeTier.textContent = `$${tier.priceUsd} · ${tierLabel}`;
  } else {
    els.boxDialogTitle.textContent = "Your Spree";
    els.boxDialogGaugeTier.textContent = "Pick a box";
  }

  const fill = tier ? gaugeFill01({ boxTier: tier, items: state.items }) : 0;
  const pct = Math.round(Math.min(1, Math.max(0, fill)) * 100);
  els.boxDialogGaugeFill.style.width = `${pct}%`;
  els.boxDialogGaugePct.textContent = `${pct}%`;
  els.boxDialogGaugeItems.textContent = `${state.items.length + state.bonusItems.length} item${
    state.items.length + state.bonusItems.length === 1 ? "" : "s"
  }`;

  const remaining = tier ? remainingBudgetUsd({ boxTier: tier, items: state.items }) : 0;
  els.boxDialogStatus.textContent = tier
    ? estimateRemainingItemsLabel({ remainingBudgetUsd: remaining })
    : "Pick a box size";

  els.boxDialogSub.textContent = isCuratedLocked()
    ? "Kiyo's curated candy + snacks starter. No swaps — upgrade to $99 to customize."
    : state.items.length === 0 && state.bonusItems.length === 0
      ? "Your box is empty. Close this window and tap Explore Collections to add cute picks."
      : "Review your picks, adjust quantities, or remove anything.";

  // Render list grouped by product id + bonus flag so each group has a qty.
  els.boxDialogList.innerHTML = "";

  if (isCuratedLocked()) {
    const banner = document.createElement("div");
    banner.className = "curatedBanner curatedBanner--dialog";
    banner.innerHTML = `
      <div class="curatedBannerIcon" aria-hidden="true">💝</div>
      <div class="curatedBannerCopy">
        <div class="curatedBannerTitle">Kiyo's $50 Curated Starter</div>
        <div class="curatedBannerSub">Candy &amp; snacks personally picked by Kiyo. Same box every time, always cute. Upgrade to $99 to start customizing.</div>
      </div>
    `;
    els.boxDialogList.appendChild(banner);
  }

  if (state.items.length === 0 && state.bonusItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "boxDialogEmpty";
    empty.innerHTML = `🎀 <div style="margin-top:6px;font-weight:800;color:var(--text)">Nothing in your box yet</div>
      <div style="margin-top:4px;color:var(--muted);font-size:13px">Close this view and pick something cute from Collections!</div>`;
    els.boxDialogList.appendChild(empty);
    return;
  }

  const groups = new Map();
  for (const it of state.items) {
    const key = `P|${it.id}`;
    const g = groups.get(key) || {
      key,
      product: it,
      instances: [],
      isBonus: false,
    };
    g.instances.push(it);
    groups.set(key, g);
  }
  for (const it of state.bonusItems) {
    const key = `B|${it.id}|${it._missionId || ""}`;
    const g = groups.get(key) || {
      key,
      product: it,
      instances: [],
      isBonus: true,
    };
    g.instances.push(it);
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    const p = g.product;
    const qty = g.instances.length;
    const imgSrc = p.image || buildFallbackImageDataUrl(p);
    const desc =
      p.description?.trim() ||
      composeDescription({
        categoryName: p.category,
        title: p.title,
        productId: String(p.id || ""),
      });
    const subLabel =
      p.subcategoryLabel && p.subcategoryLabel !== "More favorites"
        ? `${p.subcategoryEmoji || ""} ${p.subcategoryLabel}`.trim()
        : "";
    const catTape = g.isBonus
      ? "BONUS UNLOCK"
      : subLabel
        ? `${p.category} · ${subLabel}`
        : p.category;

    const tierForCapacity = state.boxTier;
    const addDisabled =
      g.isBonus ||
      !tierForCapacity ||
      !canAddItem({
        boxTier: tierForCapacity,
        items: state.items,
        candidateItem: p,
      });

    const card = document.createElement("div");
    card.className = "boxDialogItem";
    card.setAttribute("role", "listitem");
    card.innerHTML = `
      <div class="boxDialogItemImgWrap">
        <img class="boxDialogItemImg" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.title)}" loading="lazy" />
      </div>
      <div class="boxDialogItemBody">
        <div class="boxDialogItemCat">${escapeHtml(catTape)}</div>
        <h3 class="boxDialogItemTitle">${escapeHtml(p.title)}</h3>
        <p class="boxDialogItemDesc">${escapeHtml(desc)}</p>
        <div class="boxDialogItemMeta">
          <span class="pill">${escapeHtml((p.vibe ?? [])[0] || "Kawaii")}</span>
          <span class="pill">${escapeHtml(impactBand(p))} impact</span>
          ${
            g.isBonus
              ? `<span class="pill" style="background:linear-gradient(90deg,#fff0a8,#ffd66a);color:#7a4a00">Free bonus</span>`
              : ""
          }
        </div>
        <div class="boxDialogItemActions">
          ${
            g.isBonus
              ? `<span class="pill" style="background:#fff;border:1px solid rgba(0,0,0,0.08)">Bonus · qty ${qty}</span>`
              : isCuratedLocked()
                ? `<span class="pill curatedPill">Curated · qty ${qty}</span>`
                : `<div class="qtyControl" role="group" aria-label="Quantity controls for ${escapeHtml(p.title)}">
                  <button class="qtyBtn qtyMinus" type="button" aria-label="Decrease quantity">−</button>
                  <span class="qtyValue">${qty}</span>
                  <button class="qtyBtn qtyPlus" type="button" aria-label="Increase quantity" ${addDisabled ? "disabled" : ""}>+</button>
                </div>`
          }
          ${
            isCuratedLocked() && !g.isBonus
              ? ""
              : `<button class="boxDialogItemRemove" type="button" aria-label="Remove ${escapeHtml(p.title)}">
            ${g.isBonus ? "Remove bonus" : "Remove all"}
          </button>`
          }
        </div>
      </div>
    `;

    const imgEl = card.querySelector(".boxDialogItemImg");
    if (imgEl) {
      imgEl.addEventListener("error", () => {
        imgEl.src = buildFallbackImageDataUrl(p);
      });
    }

    const plusBtn = card.querySelector(".qtyPlus");
    const minusBtn = card.querySelector(".qtyMinus");
    const removeBtn = card.querySelector(".boxDialogItemRemove");

    if (plusBtn && !g.isBonus) {
      plusBtn.addEventListener("click", (e) => {
        if (!state.boxTier) {
          toast("Pick a box first.");
          return;
        }
        if (!canAddItem({ boxTier: state.boxTier, items: state.items, candidateItem: p })) {
          playSfx("error");
          toast("That would push you over the limit.");
          return;
        }
        const instance = { ...p, _instanceId: crypto.randomUUID() };
        state.items = state.items.concat([instance]);
        spark(e);
        playSfx("grab");
        track("cart_qty_increased", { productId: p.id });
        renderAll();
      });
    }

    if (minusBtn && !g.isBonus) {
      minusBtn.addEventListener("click", () => {
        // Remove the last instance of this product id from items.
        const idx = [...state.items].reverse().findIndex((x) => x.id === p.id);
        if (idx === -1) return;
        const realIdx = state.items.length - 1 - idx;
        state.items = state.items.slice(0, realIdx).concat(state.items.slice(realIdx + 1));
        playSfx("remove");
        track("cart_qty_decreased", { productId: p.id });
        renderAll();
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        if (g.isBonus) {
          state.bonusItems = state.bonusItems.filter(
            (x) =>
              !(x.id === p.id && (x._missionId || "") === (p._missionId || ""))
          );
        } else {
          state.items = state.items.filter((x) => x.id !== p.id);
        }
        playSfx("remove");
        track("cart_group_removed", { productId: p.id, isBonus: g.isBonus });
        toast(`${p.title} removed`);
        renderAll();
      });
    }

    els.boxDialogList.appendChild(card);
  }
}

function openBoxDialog() {
  if (!els.boxDialog) return;
  renderBoxDialog();
  try {
    if (els.boxDialog.open) els.boxDialog.close();
  } catch (_) {}
  try {
    if (typeof els.boxDialog.showModal === "function") {
      els.boxDialog.showModal();
    } else {
      els.boxDialog.setAttribute("open", "open");
    }
  } catch (err) {
    console.warn("[hk] boxDialog.showModal failed", err);
    els.boxDialog.setAttribute("open", "open");
  }
  track("box_dialog_opened", {
    itemCount: state.items.length,
    bonusCount: state.bonusItems.length,
  });
}

function renderMissions() {
  els.missions.innerHTML = "";
  if (!state.boxTier) return;

  for (const m of MISSIONS) {
    const unlocked = isMissionUnlocked(m);
    const claimed = Boolean(state.bonusItems.find((b) => b._missionId === m.id));
    const status = claimed ? "Claimed" : unlocked ? "Unlocked" : "Locked";

    const card = document.createElement("div");
    card.className = "missionCard";
    card.innerHTML = `
      <div class="missionRow">
        <div>
          <div class="missionTitle">${escapeHtml(m.title)}</div>
          <div class="missionSub">${escapeHtml(m.description)}</div>
        </div>
        <div class="pill">${escapeHtml(status)}</div>
      </div>
      <div class="missionRow">
        <div class="bonusPill">${escapeHtml(m.bonusLabel)}</div>
        <button class="ghost" type="button" ${unlocked && !claimed ? "" : "disabled"}>
          Claim bonus
        </button>
      </div>
    `;

    card.querySelector("button").addEventListener("click", () => {
      if (!isMissionUnlocked(m)) return;
      if (state.bonusItems.find((b) => b._missionId === m.id)) return;
      const bonus = getMissionBonusItem(m);
      if (!bonus) {
        toast("Bonus item not available (missing in catalog).");
        return;
      }
      state.bonusItems = state.bonusItems.concat([
        { ...bonus, _instanceId: crypto.randomUUID(), _isBonus: true, _missionId: m.id },
      ]);
      track("bonus_claimed", { missionId: m.id, bonusProductId: bonus.id });
      playSfx("jackpot");
      burstConfetti(window.innerWidth * 0.5, 220, 18);
      toast("Bonus unlocked!");
      renderAll();
    });

    els.missions.appendChild(card);
  }
}

function isMissionUnlocked(m) {
  const categories = state.items.map((x) => String(x.category || "").toLowerCase());
  const groups = m.requiresCategoryGroups || [];

  if (m.requiresUniqueItems) {
    const keyword = groups[0]?.[0];
    const matches = state.items.filter((it) =>
      String(it.category || "").toLowerCase().includes(keyword)
    );
    return matches.length >= m.requiresUniqueItems;
  }

  return groups.every((group) =>
    group.some((keyword) => categories.some((cat) => cat.includes(keyword)))
  );
}

function getMissionBonusItem(m) {
  const keywordPreference =
    m.id === "beauty_trio"
      ? ["beauty"]
      : ["kawaii", "stationery", "candy", "snack"];
  for (const keyword of keywordPreference) {
    const match = state.products.find((p) =>
      String(p.category || "").toLowerCase().includes(keyword)
    );
    if (match) return match;
  }
  return state.products[0];
}

function renderFilters() {
  const presentCategories = Array.from(
    new Set(state.products.map((p) => p.category))
  );
  const categories = ["All", ...presentCategories];

  els.filters.innerHTML = "";
  for (const cat of categories) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    const decor = CATEGORY_DECOR[cat];
    b.textContent = decor?.emoji ? `${decor.emoji} ${cat}` : cat;
    b.classList.toggle("active", state.activeCategory === cat);
    b.addEventListener("click", () => {
      state.activeCategory = cat;
      state.activeSubcategory = null;
      state.catalogPage = 1;
      renderFilters();
      renderCatalog();
      updateCatalogHeader();
    });
    els.filters.appendChild(b);
  }

  renderSubFilters();
}

function renderSubFilters() {
  if (!els.subFilters) return;
  els.subFilters.innerHTML = "";

  if (state.activeCategory === "All") {
    els.subFilters.hidden = true;
    return;
  }

  const defs = SUBCATEGORIES[state.activeCategory] || [];
  if (defs.length === 0) {
    els.subFilters.hidden = true;
    return;
  }

  // Only show subcategories that actually have products in the current dataset.
  const productsInCat = state.products.filter(
    (p) => p.category === state.activeCategory
  );
  const availableIds = new Set(productsInCat.map((p) => p.subcategoryId));
  const liveDefs = defs.filter((d) => availableIds.has(d.id));

  // "Other" bucket for items that didn't match any pattern.
  const hasOther = productsInCat.some((p) => p.subcategoryId === "other");

  if (liveDefs.length === 0 && !hasOther) {
    els.subFilters.hidden = true;
    return;
  }

  els.subFilters.hidden = false;

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "chip";
  allChip.textContent = `All ${state.activeCategory}`;
  allChip.classList.toggle("active", !state.activeSubcategory);
  allChip.addEventListener("click", () => {
    state.activeSubcategory = null;
    state.catalogPage = 1;
    renderSubFilters();
    renderCatalog();
    updateCatalogHeader();
  });
  els.subFilters.appendChild(allChip);

  for (const sub of liveDefs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = `${sub.emoji} ${sub.label}`;
    b.classList.toggle("active", state.activeSubcategory === sub.id);
    b.addEventListener("click", () => {
      state.activeSubcategory = sub.id;
      state.catalogPage = 1;
      renderSubFilters();
      renderCatalog();
      updateCatalogHeader();
    });
    els.subFilters.appendChild(b);
  }

  if (hasOther) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = "✨ More favorites";
    b.classList.toggle("active", state.activeSubcategory === "other");
    b.addEventListener("click", () => {
      state.activeSubcategory = "other";
      state.catalogPage = 1;
      renderSubFilters();
      renderCatalog();
      updateCatalogHeader();
    });
    els.subFilters.appendChild(b);
  }
}

// Cute per-category SVG illustrations used in the hero "Explore Collections"
// cards. We intentionally avoid product photos here and use bright, flat,
// hand-drawn-feeling icons instead so the hero reads as a playful entry point.
const CATEGORY_ICON_SVG = {
  "Japanese Candy Party": `
<svg viewBox='0 0 360 160' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
  <defs>
    <radialGradient id='candyBody' cx='35%' cy='32%' r='70%'>
      <stop offset='0' stop-color='#ffe3f1'/>
      <stop offset='0.55' stop-color='#ffb3d8'/>
      <stop offset='1' stop-color='#ff6ba8'/>
    </radialGradient>
  </defs>
  <g transform='translate(170 90)'>
    <path d='M -82 -4 L -46 -28 L -44 0 L -46 28 Z' fill='#ffb3d8' stroke='#c23f7e' stroke-width='3' stroke-linejoin='round'/>
    <path d='M 82 -4 L 46 -28 L 44 0 L 46 28 Z' fill='#ffb3d8' stroke='#c23f7e' stroke-width='3' stroke-linejoin='round'/>
    <circle r='46' fill='url(#candyBody)' stroke='#c23f7e' stroke-width='3.5'/>
    <path d='M -20 -14 Q 0 -30 20 -14' stroke='#fff' stroke-width='4' fill='none' stroke-linecap='round' opacity='.85'/>
    <circle cx='18' cy='-20' r='4' fill='#fff' opacity='.9'/>
  </g>
  <g transform='translate(292 98)'>
    <rect x='-3' y='-4' width='6' height='52' rx='2' fill='#fff' stroke='#b7a8c8' stroke-width='2'/>
    <circle cx='0' cy='-10' r='30' fill='#ffe072' stroke='#e09422' stroke-width='3'/>
    <path d='M 0 -10 m -18 0 a 18 18 0 1 0 18 18' stroke='#ff6ba8' stroke-width='5' fill='none' stroke-linecap='round'/>
    <path d='M 0 -10 m -8 0 a 8 8 0 1 0 8 8' stroke='#ff6ba8' stroke-width='4' fill='none' stroke-linecap='round'/>
  </g>
  <g transform='translate(68 46)' fill='#ffd93d' stroke='#e09422' stroke-width='2' stroke-linejoin='round'>
    <path d='M 0 -16 L 5 -5 L 16 0 L 5 5 L 0 16 L -5 5 L -16 0 L -5 -5 Z'/>
  </g>
</svg>`,

  "Travel-Size Beauty": `
<svg viewBox='0 0 360 160' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
  <g transform='translate(110 90)'>
    <circle r='50' fill='#ffe3ee' stroke='#c23f7e' stroke-width='3'/>
    <circle r='36' fill='#fff' stroke='#f9c5d9' stroke-width='2.5'/>
    <path d='M -20 -10 Q 0 -28 24 -8' stroke='#ffb3d8' stroke-width='6' fill='none' stroke-linecap='round' opacity='.75'/>
    <circle cx='-12' cy='-8' r='5' fill='#fff' opacity='.9'/>
  </g>
  <g transform='translate(238 40)'>
    <path d='M -18 22 L 18 22 L 12 -6 L -6 -22 Z' fill='#ff6ba8' stroke='#c23f7e' stroke-width='2.5' stroke-linejoin='round'/>
    <rect x='-22' y='22' width='44' height='16' rx='3' fill='#f9c5d9' stroke='#c23f7e' stroke-width='2.5'/>
    <rect x='-18' y='36' width='36' height='60' rx='4' fill='#ffb3d8' stroke='#c23f7e' stroke-width='2.5'/>
    <rect x='-12' y='42' width='4' height='46' rx='2' fill='#fff' opacity='.6'/>
  </g>
  <g fill='#ffd93d' stroke='#e09422' stroke-width='1.8' stroke-linejoin='round'>
    <path d='M 52 30 L 55 39 L 64 42 L 55 45 L 52 54 L 49 45 L 40 42 L 49 39 Z'/>
    <path d='M 310 118 L 312 125 L 319 127 L 312 129 L 310 136 L 308 129 L 301 127 L 308 125 Z'/>
  </g>
</svg>`,

  "Cup Ramen Flavors": `
<svg viewBox='0 0 360 160' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
  <g transform='translate(180 92)'>
    <path d='M -30 -74 q -12 12 0 24 q 12 12 0 24' stroke='#a8c4d6' stroke-width='5' fill='none' stroke-linecap='round' opacity='.6'/>
    <path d='M 0 -78 q -12 12 0 24 q 12 12 0 24' stroke='#a8c4d6' stroke-width='5' fill='none' stroke-linecap='round' opacity='.5'/>
    <path d='M 30 -74 q -12 12 0 24 q 12 12 0 24' stroke='#a8c4d6' stroke-width='5' fill='none' stroke-linecap='round' opacity='.4'/>
    <g transform='rotate(14) translate(-14 -20)'>
      <rect x='-2' y='-50' width='5' height='80' rx='2' fill='#e5c793' stroke='#a6813f' stroke-width='1.5'/>
    </g>
    <g transform='rotate(22) translate(-28 -8)'>
      <rect x='-2' y='-50' width='5' height='80' rx='2' fill='#e5c793' stroke='#a6813f' stroke-width='1.5'/>
    </g>
    <path d='M -64 -22 L 64 -22 L 56 58 L -56 58 Z' fill='#ffffff' stroke='#c23f7e' stroke-width='3.5' stroke-linejoin='round'/>
    <path d='M -64 -22 L 64 -22 L 61 -4 L -61 -4 Z' fill='#ff5a5f' stroke='#c23f3f' stroke-width='1.5'/>
    <circle cx='0' cy='-13' r='6' fill='#fff' stroke='#c23f3f' stroke-width='1.5'/>
    <circle cx='0' cy='-13' r='3' fill='#ff5a5f'/>
    <path d='M -44 -22 q 12 -14 0 -26' stroke='#f6d26b' stroke-width='4' fill='none' stroke-linecap='round'/>
    <path d='M -20 -22 q 12 -16 0 -30' stroke='#f6d26b' stroke-width='4' fill='none' stroke-linecap='round'/>
    <path d='M 20 -22 q 12 -16 0 -30' stroke='#f6d26b' stroke-width='4' fill='none' stroke-linecap='round'/>
    <path d='M 44 -22 q 12 -14 0 -26' stroke='#f6d26b' stroke-width='4' fill='none' stroke-linecap='round'/>
    <rect x='-28' y='18' width='6' height='20' fill='#ff5a5f' opacity='.8' rx='1'/>
    <rect x='-14' y='14' width='6' height='24' fill='#ff5a5f' opacity='.8' rx='1'/>
    <rect x='0' y='18' width='6' height='20' fill='#ff5a5f' opacity='.8' rx='1'/>
    <rect x='14' y='14' width='6' height='24' fill='#ff5a5f' opacity='.8' rx='1'/>
  </g>
</svg>`,

  "Kawaii Stationery": `
<svg viewBox='0 0 360 160' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
  <g transform='translate(190 82) rotate(-18)'>
    <rect x='-108' y='-14' width='14' height='28' fill='#ffb3d8' stroke='#c23f7e' stroke-width='2.5' rx='3'/>
    <rect x='-96' y='-14' width='6' height='28' fill='#d0d0d0' stroke='#808080' stroke-width='1.5'/>
    <rect x='-90' y='-14' width='130' height='28' fill='#ffd972' stroke='#b8842e' stroke-width='2.5' rx='2'/>
    <line x1='-70' y1='-14' x2='-70' y2='14' stroke='#b8842e' stroke-width='1.5' opacity='.6'/>
    <line x1='-20' y1='-14' x2='-20' y2='14' stroke='#b8842e' stroke-width='1.5' opacity='.6'/>
    <line x1='25' y1='-14' x2='25' y2='14' stroke='#b8842e' stroke-width='1.5' opacity='.6'/>
    <path d='M 40 -14 L 66 0 L 40 14 Z' fill='#e8c07d' stroke='#b8842e' stroke-width='2.5' stroke-linejoin='round'/>
    <path d='M 56 -6 L 66 0 L 56 6 Z' fill='#2d2d2d'/>
  </g>
  <g transform='translate(60 120)'>
    <rect x='-28' y='-18' width='56' height='36' fill='#ffb3d8' stroke='#c23f7e' stroke-width='2.5' rx='5'/>
    <rect x='-28' y='-8' width='56' height='10' fill='#fff' stroke='#c23f7e' stroke-width='2'/>
  </g>
  <g transform='translate(300 44)'>
    <path d='M 0 -24 L 7 -8 L 24 -6 L 11 6 L 15 24 L 0 15 L -15 24 L -11 6 L -24 -6 L -7 -8 Z' fill='#7dd3fc' stroke='#0284c7' stroke-width='2.5' stroke-linejoin='round'/>
    <circle cx='-4' cy='-4' r='3' fill='#fff' opacity='.9'/>
  </g>
</svg>`,

  "Snack Market": `
<svg viewBox='0 0 360 160' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
  <g transform='translate(100 92)'>
    <circle r='46' fill='#edbf80' stroke='#a67935' stroke-width='3'/>
    <rect x='-34' y='-11' width='68' height='22' fill='#2d3d5c' rx='2' stroke='#0f1b36' stroke-width='1.5'/>
    <ellipse cx='-14' cy='-28' rx='16' ry='6' fill='#fff' opacity='.5'/>
    <circle cx='24' cy='22' r='3' fill='#a67935' opacity='.6'/>
    <circle cx='-26' cy='24' r='2.5' fill='#a67935' opacity='.6'/>
  </g>
  <g transform='translate(238 56) rotate(-22)'>
    <rect x='-62' y='-5' width='86' height='10' fill='#f3d9a3' stroke='#c99a5a' stroke-width='1.8' rx='3'/>
    <rect x='-62' y='-7' width='40' height='14' fill='#7a4a2a' stroke='#4a2a14' stroke-width='1.8' rx='3'/>
    <circle cx='-56' cy='-2' r='1.8' fill='#ffb3d8'/>
    <circle cx='-46' cy='3' r='1.8' fill='#fff'/>
    <circle cx='-34' cy='-2' r='1.8' fill='#7dd3fc'/>
  </g>
  <g transform='translate(296 112)'>
    <path d='M -24 -20 L 24 -20 L 20 18 L -20 18 Z' fill='#fff' stroke='#8ab4d0' stroke-width='2.8' stroke-linejoin='round'/>
    <ellipse cx='0' cy='-20' rx='24' ry='5' fill='#7a9e2a' stroke='#4a5e14' stroke-width='2'/>
    <path d='M 24 -8 q 12 2 10 14 q -2 10 -12 8' stroke='#8ab4d0' stroke-width='2.8' fill='none'/>
  </g>
</svg>`,

  "Crafts & DIY": `
<svg viewBox='0 0 360 160' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
  <!-- Origami crane on the left -->
  <g transform='translate(88 86)'>
    <path d='M -46 14 L 0 -34 L 46 14 L 30 18 L 0 6 L -30 18 Z' fill='#ffd6ea' stroke='#c23f7e' stroke-width='2.8' stroke-linejoin='round'/>
    <path d='M 0 -34 L 14 -48 L 22 -42' fill='none' stroke='#c23f7e' stroke-width='2.8' stroke-linejoin='round'/>
    <path d='M 22 -42 L 30 -38 L 22 -34' fill='#ffd6ea' stroke='#c23f7e' stroke-width='2' stroke-linejoin='round'/>
    <path d='M 0 6 L 0 24 L -8 34 L 0 26' fill='none' stroke='#c23f7e' stroke-width='2.6' stroke-linejoin='round'/>
    <path d='M 0 -10 L 24 -2' stroke='#ffb3d8' stroke-width='2' opacity='.7'/>
  </g>
  <!-- Brush pen center -->
  <g transform='translate(210 54) rotate(30)'>
    <rect x='-4' y='-4' width='90' height='8' rx='2' fill='#ffe7a8' stroke='#c99a5a' stroke-width='2'/>
    <rect x='62' y='-5' width='30' height='10' rx='2' fill='#c23f7e' stroke='#6a1d40' stroke-width='2'/>
    <path d='M -4 -4 L -22 -10 L -26 0 L -22 10 L -4 4 Z' fill='#2d2d2d' stroke='#0f172a' stroke-width='2' stroke-linejoin='round'/>
    <path d='M -22 -10 q -12 10 0 20' fill='none' stroke='#0f172a' stroke-width='1.5' opacity='.5'/>
  </g>
  <!-- Washi tape roll upper right -->
  <g transform='translate(292 56)'>
    <circle r='26' fill='#e0f3ff' stroke='#6aa8ff' stroke-width='3'/>
    <circle r='12' fill='#fff' stroke='#6aa8ff' stroke-width='2.5'/>
    <circle r='12' fill='none' stroke='#6aa8ff' stroke-width='1' stroke-dasharray='2 3'/>
    <path d='M 26 0 q 20 0 34 10' fill='none' stroke='#6aa8ff' stroke-width='6' stroke-linecap='round'/>
    <circle cx='-6' cy='-8' r='2.6' fill='#ff6fa9'/>
    <circle cx='6' cy='6' r='2.6' fill='#ff6fa9'/>
    <circle cx='-4' cy='8' r='2.2' fill='#ff6fa9' opacity='.8'/>
  </g>
  <!-- Resin heart charm lower right -->
  <g transform='translate(286 118)'>
    <path d='M 0 20 C -18 6 -24 -10 -12 -18 C -4 -22 2 -16 0 -8 C -2 -16 4 -22 12 -18 C 24 -10 18 6 0 20 Z' fill='#ffd6ea' stroke='#ff4fa3' stroke-width='2.5' stroke-linejoin='round'/>
    <circle cx='-5' cy='-6' r='2.4' fill='#fff' opacity='.9'/>
    <circle cx='10' cy='0' r='6' fill='none' stroke='#ff4fa3' stroke-width='2'/>
    <path d='M 10 -6 L 10 -12' stroke='#ff4fa3' stroke-width='2' stroke-linecap='round'/>
  </g>
  <!-- Clay dots lower left -->
  <g transform='translate(60 124)'>
    <circle cx='-18' cy='0' r='8' fill='#ffd6ea' stroke='#c23f7e' stroke-width='1.5'/>
    <circle cx='0' cy='-4' r='10' fill='#fff1a8' stroke='#c9a333' stroke-width='1.5'/>
    <circle cx='18' cy='2' r='8' fill='#b8ebd3' stroke='#3aaa6f' stroke-width='1.5'/>
  </g>
  <!-- Sparkle top -->
  <g fill='#ffd93d' stroke='#e09422' stroke-width='1.6' stroke-linejoin='round'>
    <path d='M 40 28 L 43 36 L 52 38 L 43 40 L 40 48 L 37 40 L 28 38 L 37 36 Z'/>
  </g>
</svg>`,

  "Plush & Keychains": `
<svg viewBox='0 0 360 160' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
  <g transform='translate(62 90)'>
    <circle r='22' fill='none' stroke='#b79ee0' stroke-width='6'/>
    <circle cx='22' cy='0' r='5' fill='#b79ee0'/>
    <line x1='26' y1='0' x2='44' y2='0' stroke='#b79ee0' stroke-width='4'/>
    <line x1='44' y1='-6' x2='44' y2='6' stroke='#b79ee0' stroke-width='4'/>
    <line x1='38' y1='-4' x2='38' y2='4' stroke='#b79ee0' stroke-width='3'/>
  </g>
  <g transform='translate(210 82)'>
    <path d='M -52 -32 L -74 -62 L -30 -44 Z' fill='#fff' stroke='#c23f7e' stroke-width='3' stroke-linejoin='round'/>
    <path d='M 52 -32 L 74 -62 L 30 -44 Z' fill='#fff' stroke='#c23f7e' stroke-width='3' stroke-linejoin='round'/>
    <path d='M -62 -58 L -40 -46' stroke='#ffb3d8' stroke-width='3' stroke-linecap='round'/>
    <path d='M 60 -58 L 38 -46' stroke='#ffb3d8' stroke-width='3' stroke-linecap='round'/>
    <ellipse cx='0' cy='0' rx='62' ry='54' fill='#fff' stroke='#c23f7e' stroke-width='3'/>
    <ellipse cx='0' cy='0' rx='62' ry='54' fill='none' stroke='#fff' stroke-width='1.5' opacity='.6'/>
    <circle cx='-24' cy='-4' r='6' fill='#2d2d2d'/>
    <circle cx='24' cy='-4' r='6' fill='#2d2d2d'/>
    <circle cx='-22' cy='-6' r='2' fill='#fff'/>
    <circle cx='26' cy='-6' r='2' fill='#fff'/>
    <circle cx='-36' cy='12' r='7' fill='#ffb3d8' opacity='.85'/>
    <circle cx='36' cy='12' r='7' fill='#ffb3d8' opacity='.85'/>
    <path d='M -8 16 q 8 8 16 0' stroke='#2d2d2d' stroke-width='3' fill='none' stroke-linecap='round'/>
    <line x1='-42' y1='4' x2='-60' y2='0' stroke='#c0a8c8' stroke-width='1.8'/>
    <line x1='-42' y1='12' x2='-60' y2='14' stroke='#c0a8c8' stroke-width='1.8'/>
    <line x1='42' y1='4' x2='60' y2='0' stroke='#c0a8c8' stroke-width='1.8'/>
    <line x1='42' y1='12' x2='60' y2='14' stroke='#c0a8c8' stroke-width='1.8'/>
    <g transform='translate(-38 -46)'>
      <path d='M 0 0 L -14 -10 L -14 10 Z' fill='#ff6ba8' stroke='#c23f7e' stroke-width='2' stroke-linejoin='round'/>
      <path d='M 0 0 L 14 -10 L 14 10 Z' fill='#ff6ba8' stroke='#c23f7e' stroke-width='2' stroke-linejoin='round'/>
      <circle r='5' fill='#ffb3d8' stroke='#c23f7e' stroke-width='2'/>
    </g>
  </g>
</svg>`,
};

function categoryIconSvg(catName, decor) {
  const svg = CATEGORY_ICON_SVG[catName];
  if (svg) return svg;
  // Fallback: big emoji on a soft panel so any future category still looks tidy.
  const emoji = (decor && decor.emoji) || "✨";
  return `
<svg viewBox='0 0 360 160' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
  <text x='180' y='112' text-anchor='middle' font-size='110'>${emoji}</text>
</svg>`;
}

function renderShowcase() {
  if (!els.showcaseGrid) return;
  els.showcaseGrid.innerHTML = "";

  // Build one showcase card per category that actually has products.
  const cats = Array.from(new Set(state.products.map((p) => p.category)));
  // Preserve a stable ordering with plush last.
  const order = [
    "Japanese Candy Party",
    "Travel-Size Beauty",
    "Kawaii Stationery",
    "Cup Ramen Flavors",
    "Snack Market",
    "Plush & Keychains",
  ];
  cats.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for (const catName of cats) {
    const decor = CATEGORY_DECOR[catName] || {
      kanji: catName,
      cardA: "#ffd9eb",
      cardB: "#e5dcff",
      emoji: "✨",
      teaser: "",
    };
    const items = state.products.filter((p) => p.category === catName);
    if (items.length === 0) continue;

    // Subcategory chips: all subcats with at least one product in this cat.
    const defs = SUBCATEGORIES[catName] || [];
    const presentSubIds = new Set(items.map((p) => p.subcategoryId));
    const liveSubs = defs.filter((d) => presentSubIds.has(d.id));
    const topSubs = liveSubs.slice(0, 5);

    const card = document.createElement("article");
    card.className = "showcaseCard";
    card.style.setProperty("--card-a", decor.cardA);
    card.style.setProperty("--card-b", decor.cardB);

    // Per-category illustration instead of product photos.
    const iconHtml = `<div class="showcaseIcon" aria-hidden="true">${categoryIconSvg(catName, decor)}</div>`;

    const chipsHtml = topSubs
      .map(
        (s) =>
          `<button type="button" class="showcaseChip" data-sub="${escapeHtml(s.id)}">${s.emoji} ${escapeHtml(s.label)}</button>`
      )
      .join("");

    card.innerHTML = `
      <div class="showcaseHeader">
        <div class="showcaseTitleGroup">
          <div class="showcaseKanji">${escapeHtml(decor.kanji)}</div>
          <h3 class="showcaseTitle">${decor.emoji} ${escapeHtml(catName)}</h3>
          <p class="showcaseSub">${escapeHtml(decor.teaser || "")}</p>
        </div>
        <span class="showcaseCount">${items.length} picks</span>
      </div>
      ${iconHtml}
      <div class="showcaseChips">${chipsHtml}</div>
      <span class="showcaseExplore">Explore ${escapeHtml(catName)} →</span>
    `;

    card.addEventListener("click", (e) => {
      const chipEl = e.target.closest(".showcaseChip");
      const subId = chipEl ? chipEl.dataset.sub : null;
      openCategory(catName, subId);
    });

    els.showcaseGrid.appendChild(card);
  }

  setupShowcaseCarousel();
}

/* ---------------- Showcase carousel controls ---------------- */
// Single source of truth for the carousel so re-renders don't stack timers or listeners.
const _carousel = {
  index: 0,
  autoTimer: null,
  paused: false,
  wired: false,
};

// Number of cards visible per view, computed from the actual card + gap widths.
// Uses the first card's rendered width so it stays in sync with CSS container queries.
function cardsPerView() {
  const vp = els.showcaseViewport;
  const grid = els.showcaseGrid;
  if (!vp || !grid || !grid.children.length) return 1;
  const first = grid.children[0];
  const cardW = first.offsetWidth;
  // CSS gap is 18px; read it off the computed style so changes stay in sync.
  const gap = parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap || "18") || 18;
  if (cardW <= 0) return 1;
  return Math.max(1, Math.round((vp.clientWidth + gap) / (cardW + gap)));
}

// Max "leftmost" index so the rightmost card never leaves a gap at the end.
function maxShowcaseIndex() {
  const n = els.showcaseGrid ? els.showcaseGrid.children.length : 0;
  return Math.max(0, n - cardsPerView());
}

function setupShowcaseCarousel() {
  if (!els.showcaseViewport || !els.showcaseGrid) return;

  renderShowcaseDots();

  // Wire prev/next + hover-pause + auto-advance once.
  if (!_carousel.wired) {
    _carousel.wired = true;

    if (els.showcasePrev) {
      els.showcasePrev.addEventListener("click", () => {
        _carousel.index = Math.max(0, _carousel.index - 1);
        scrollShowcaseToIndex(_carousel.index, true);
        restartShowcaseAuto();
      });
    }
    if (els.showcaseNext) {
      els.showcaseNext.addEventListener("click", () => {
        _carousel.index = Math.min(maxShowcaseIndex(), _carousel.index + 1);
        scrollShowcaseToIndex(_carousel.index, true);
        restartShowcaseAuto();
      });
    }
    if (els.showcaseCarousel) {
      const pause = () => { _carousel.paused = true; };
      const resume = () => { _carousel.paused = false; };
      els.showcaseCarousel.addEventListener("mouseenter", pause);
      els.showcaseCarousel.addEventListener("mouseleave", resume);
      els.showcaseCarousel.addEventListener("focusin", pause);
      els.showcaseCarousel.addEventListener("focusout", resume);
    }
    if (els.showcaseViewport) {
      // Keep the active dot in sync when the user scrolls/swipes manually.
      let scrollTimer = null;
      els.showcaseViewport.addEventListener("scroll", () => {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const idx = Math.min(currentShowcaseIndex(), maxShowcaseIndex());
          if (idx !== _carousel.index) {
            _carousel.index = idx;
            updateShowcaseDots();
          }
        }, 120);
      });
    }

    // Recompute bounds + dot count when the viewport changes size.
    window.addEventListener("resize", () => {
      renderShowcaseDots();
      _carousel.index = Math.min(_carousel.index, maxShowcaseIndex());
      scrollShowcaseToIndex(_carousel.index, false);
    });
  }

  updateShowcaseDots();
  restartShowcaseAuto();
}

// One dot per leftmost-position (n - cardsPerView + 1), so each dot represents
// a unique "view" rather than each individual card.
function renderShowcaseDots() {
  if (!els.showcaseDots || !els.showcaseGrid) return;
  els.showcaseDots.innerHTML = "";
  const dotCount = maxShowcaseIndex() + 1;
  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carouselDot" + (i === _carousel.index ? " active" : "");
    dot.setAttribute("aria-label", `Go to collection view ${i + 1}`);
    dot.addEventListener("click", () => {
      _carousel.index = i;
      scrollShowcaseToIndex(i, true);
      restartShowcaseAuto();
    });
    els.showcaseDots.appendChild(dot);
  }
}

function currentShowcaseIndex() {
  if (!els.showcaseViewport || !els.showcaseGrid) return 0;
  const vp = els.showcaseViewport;
  const cards = els.showcaseGrid.children;
  if (cards.length === 0) return 0;
  // Match by LEFT edge (3-up slider snaps cards to the left of the viewport).
  const vpLeft = vp.getBoundingClientRect().left;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < cards.length; i++) {
    const diff = Math.abs(cards[i].getBoundingClientRect().left - vpLeft);
    if (diff < bestDist) { bestDist = diff; best = i; }
  }
  return best;
}

function scrollShowcaseToIndex(index, smooth) {
  if (!els.showcaseViewport || !els.showcaseGrid) return;
  const card = els.showcaseGrid.children[index];
  if (!card) return;
  const vp = els.showcaseViewport;
  // Resolve target relative to the scroll container so padding/positioning doesn't skew it.
  const delta = card.getBoundingClientRect().left - vp.getBoundingClientRect().left;
  const target = Math.max(0, vp.scrollLeft + delta);
  vp.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
  updateShowcaseDots();
  updateShowcaseButtons();
}

function updateShowcaseDots() {
  if (!els.showcaseDots) return;
  const dots = els.showcaseDots.children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle("active", i === _carousel.index);
  }
  updateShowcaseButtons();
}

function updateShowcaseButtons() {
  const max = maxShowcaseIndex();
  if (els.showcasePrev) els.showcasePrev.disabled = _carousel.index <= 0;
  if (els.showcaseNext) els.showcaseNext.disabled = _carousel.index >= max;
}

function restartShowcaseAuto() {
  if (_carousel.autoTimer) {
    clearInterval(_carousel.autoTimer);
    _carousel.autoTimer = null;
  }
  _carousel.autoTimer = setInterval(() => {
    if (_carousel.paused) return;
    const max = maxShowcaseIndex();
    if (max <= 0) return;
    // Advance one card at a time; loop back to the start when reaching the end.
    _carousel.index = _carousel.index >= max ? 0 : _carousel.index + 1;
    scrollShowcaseToIndex(_carousel.index, true);
  }, 4000);
}

// Return up to n products with as many distinct subcategoryIds as possible.
function pickDiverseSubcategories(items, n) {
  const seen = new Set();
  const picked = [];
  for (const p of items) {
    if (picked.length >= n) break;
    if (seen.has(p.subcategoryId)) continue;
    seen.add(p.subcategoryId);
    picked.push(p);
  }
  // Fill remaining slots with any products if we didn't find enough distinct subs.
  if (picked.length < n) {
    for (const p of items) {
      if (picked.length >= n) break;
      if (picked.indexOf(p) === -1) picked.push(p);
    }
  }
  return picked;
}

function openCategory(catName, subId = null) {
  state.activeCategory = catName;
  state.activeSubcategory = subId;
  state.catalogPage = 1;
  state.searchQuery = "";
  if (els.searchInput) els.searchInput.value = "";
  renderFilters();
  renderCatalog();
  updateCatalogHeader();
  // Scroll to catalog after a short tick so DOM is ready.
  requestAnimationFrame(() => {
    const target = document.getElementById("catalog");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  track("category_opened", { category: catName, subcategory: subId });
}

function updateCatalogHeader() {
  if (!els.catalogTitle || !els.catalogEyebrow) return;

  const decor = CATEGORY_DECOR[state.activeCategory];
  const subDef = state.activeSubcategory
    ? (SUBCATEGORIES[state.activeCategory] || []).find(
        (s) => s.id === state.activeSubcategory
      )
    : null;

  if (state.activeCategory === "All") {
    els.catalogEyebrow.textContent = "お買い物 ✦ Featured picks";
    els.catalogTitle.textContent = "Featured picks this week";
    if (els.backToCollectionsBtn) els.backToCollectionsBtn.hidden = true;
  } else {
    els.catalogEyebrow.textContent = decor?.kanji || state.activeCategory;
    const suffix = subDef ? ` · ${subDef.emoji} ${subDef.label}` : "";
    const other = state.activeSubcategory === "other" ? " · More favorites" : "";
    els.catalogTitle.textContent = `${state.activeCategory}${suffix}${other}`;
    if (els.backToCollectionsBtn) els.backToCollectionsBtn.hidden = false;
  }
}

function renderCatalog() {
  els.productGrid.innerHTML = "";
  const tier = state.boxTier;

  let products;
  const isAllView = state.activeCategory === "All";

  if (isAllView) {
    // Featured mix: grab a diverse set across every category so the flat
    // landing catalog doesn't feel overwhelming. Users drill in via showcase.
    products = featuredMix(state.products, 24);
  } else {
    products = state.products.filter((p) => p.category === state.activeCategory);
    if (state.activeSubcategory) {
      products = products.filter((p) => p.subcategoryId === state.activeSubcategory);
    }
    // Colorful + cheapest first within the filtered scope.
    products = sortColorfulCheapFirst(products);
  }

  const q = (state.searchQuery || "").toLowerCase();
  if (q) {
    // When searching, always search across the full catalog so results aren't
    // accidentally hidden by the current filter.
    const pool = state.products;
    products = pool.filter((p) => {
      const blob = `${p.title || ""} ${p.description || ""} ${p.category || ""} ${
        p.subcategoryLabel || ""
      } ${(p.vibe || []).join(" ")}`.toLowerCase();
      return blob.includes(q);
    });
  }

  if (state.prefs.categories.size > 0 && !state.activeSubcategory && !q) {
    products = products
      .slice()
      .sort((a, b) => scorePref(b) - scorePref(a));
  }

  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / state.catalogPageSize));
  state.catalogPage = Math.min(Math.max(1, state.catalogPage), totalPages);
  const start = (state.catalogPage - 1) * state.catalogPageSize;
  const pageProducts = products.slice(start, start + state.catalogPageSize);
  updateCatalogMeta(total, totalPages, start, pageProducts.length);

  for (const p of pageProducts) {
    const card = document.createElement("div");
    card.className = "card";

    const locked = isCuratedLocked();
    const addDisabled =
      locked ||
      !tier ||
      !canAddItem({ boxTier: tier, items: state.items, candidateItem: p });
    const band = impactBand(p);
    const bandLabel = band === "Low" ? "Low impact" : band === "Medium" ? "Med impact" : "High impact";
    const teaser = shortTeaser(p);

    const img = p.image
      ? `<img class="thumbImg" src="${escapeHtml(p.image)}" alt="${escapeHtml(
          p.title
        )}" loading="lazy" />`
      : "";

    const subLabel = p.subcategoryLabel && p.subcategoryLabel !== "More favorites"
      ? `${p.subcategoryEmoji || ""} ${p.subcategoryLabel}`.trim()
      : "";
    const tapeHtml = subLabel
      ? `${escapeHtml(p.category)} • ${escapeHtml(subLabel)}`
      : escapeHtml(p.category);

    card.innerHTML = `
      <div class="cardCategoryTape">${tapeHtml}</div>
      <div class="thumb">${img}<div class="heartBadge" aria-hidden="true">♥</div></div>
      <div class="cardBody">
        <div class="cardTitle">${escapeHtml(p.title)}</div>
        <div class="cardTeaser">${escapeHtml(teaser)}</div>
        <div class="cardMeta">
          <span class="vibePill">${escapeHtml((p.vibe ?? [])[0] || "Kawaii")}</span>
          <span>${escapeHtml(bandLabel)}</span>
        </div>
        <div class="addRow">
          <button class="addBtn" type="button" ${addDisabled ? "disabled" : ""}>
            ${
              !tier
                ? "Pick a box"
                : locked
                  ? "Curated by Kiyo 💝"
                  : addDisabled
                    ? "At limit"
                    : "Add to box ♡"
            }
          </button>
        </div>
      </div>
    `;

    const btn = card.querySelector(".addBtn");
    const imgEl = card.querySelector(".thumbImg");
    if (imgEl) {
      imgEl.addEventListener("error", () => {
        imgEl.src = buildFallbackImageDataUrl(p);
      });
    }
    card.querySelector(".cardTitle").addEventListener("click", () => openProductDialog(p));
    card.querySelector(".thumb").addEventListener("click", () => openProductDialog(p));
    btn.addEventListener("click", (e) => {
      addProductFromCatalog(p, e);
    });

    els.productGrid.appendChild(card);
  }
}

// Visual appeal score (higher = more colorful / more demographic-appropriate).
// Used to sort so the brightest, cutest picks surface first.
const COLOR_KEYWORDS = [
  "pink",
  "sakura",
  "cherry",
  "strawberry",
  "ichigo",
  "peach",
  "momo",
  "rainbow",
  "pastel",
  "glitter",
  "sparkle",
  "star",
  "heart",
  "bunny",
  "kitten",
  "character",
  "sanrio",
  "hello kitty",
  "melody",
  "cinnamoroll",
  "kuromi",
  "pompompurin",
  "chiikawa",
  "hachiware",
  "pikachu",
  "eevee",
  "jigglypuff",
  "rilakkuma",
  "korilakkuma",
  "totoro",
  "jiji",
  "miffy",
  "sumikko",
  "plush",
  "keychain",
  "charm",
  "candy",
  "gummy",
  "gummi",
  "jelly",
  "chocolate",
  "choco",
  "sticker",
  "pocky",
  "hi-chew",
  "hichew",
  "matcha",
  "lemon",
  "yuzu",
  "grape",
  "soda",
  "ramune",
];
function visualAppeal(p) {
  let score = 0;
  if (p.image) score += 5;
  if (p.subcategoryId && p.subcategoryId !== "other") score += 2;
  const blob = `${p.title || ""} ${p.description || ""} ${(p.vibe || []).join(
    " "
  )} ${p.subcategoryLabel || ""}`.toLowerCase();
  let kwHits = 0;
  for (const kw of COLOR_KEYWORDS) {
    if (blob.includes(kw)) kwHits += 1;
    if (kwHits >= 6) break;
  }
  score += kwHits * 0.8;
  const cat = (p.category || "").toLowerCase();
  if (cat.includes("plush")) score += 3;
  if (cat.includes("candy")) score += 1.5;
  if (cat.includes("stationery")) score += 0.5;
  return score;
}

// Convert list price to a normalized USD-like number for cross-currency sort.
function priceNumber(p) {
  const price = Number(p.listPrice || 0);
  if (!price) return Infinity;
  if ((p.currency || "JPY").toUpperCase() === "JPY") return price / USD_TO_JPY_RATE;
  return price;
}

// Sort: most-colorful first, cheapest as tiebreaker. Returns a new array.
function sortColorfulCheapFirst(products) {
  return products.slice().sort((a, b) => {
    const aScore = visualAppeal(a);
    const bScore = visualAppeal(b);
    if (Math.abs(bScore - aScore) > 0.01) return bScore - aScore;
    return priceNumber(a) - priceNumber(b);
  });
}

// Balanced, "featured" mix for the "All" view. Deterministic per render so the
// hero-adjacent catalog looks intentional rather than random.
function featuredMix(products, n) {
  if (!products.length) return [];
  const byCat = new Map();
  for (const p of products) {
    const arr = byCat.get(p.category) || [];
    arr.push(p);
    byCat.set(p.category, arr);
  }
  const cats = Array.from(byCat.keys());
  // Sort within each category by colorful+cheap-first so featured mixes lead
  // with the most visually appealing, lowest-priced picks.
  for (const cat of cats) {
    byCat.set(cat, sortColorfulCheapFirst(byCat.get(cat)));
  }
  const picked = [];
  let i = 0;
  while (picked.length < n) {
    let addedThisRound = 0;
    for (const cat of cats) {
      const arr = byCat.get(cat);
      if (arr && arr[i]) {
        picked.push(arr[i]);
        addedThisRound += 1;
        if (picked.length >= n) break;
      }
    }
    if (addedThisRound === 0) break;
    i += 1;
  }
  return picked;
}

function shortTeaser(p) {
  const desc = String(p.description || "").trim();
  if (!desc) return "";
  const firstSentence = desc.split(/(?<=[.!?])\s+/)[0];
  return firstSentence.length > 110 ? firstSentence.slice(0, 107).trimEnd() + "…" : firstSentence;
}

function updateCatalogMeta(total, totalPages, start, shown) {
  const safeStart = total === 0 ? 0 : start + 1;
  const end = Math.min(total, start + shown);
  const q = state.searchQuery ? ` matching “${state.searchQuery}”` : "";

  let scope;
  if (state.searchQuery) {
    scope = "across every collection";
  } else if (state.activeCategory === "All") {
    scope = "featured across every collection";
  } else {
    const subDef = state.activeSubcategory
      ? (SUBCATEGORIES[state.activeCategory] || []).find(
          (s) => s.id === state.activeSubcategory
        )
      : null;
    const suffix =
      state.activeSubcategory === "other"
        ? " · More favorites"
        : subDef
          ? ` · ${subDef.emoji} ${subDef.label}`
          : "";
    scope = `in ${state.activeCategory}${suffix}`;
  }

  els.catalogMeta.textContent =
    total === 0
      ? `No cute picks ${scope}${q} yet. Try another filter.`
      : `${total} curated picks ${scope}${q} • showing ${safeStart}–${end}`;
  els.catalogPageText.textContent = `Page ${state.catalogPage} / ${totalPages}`;
  els.catalogPrevBtn.disabled = state.catalogPage <= 1;
  els.catalogNextBtn.disabled = state.catalogPage >= totalPages;
}

function addProductFromCatalog(p, evt = null) {
  if (!state.boxTier) return;
  if (isCuratedLocked()) {
    playSfx("error");
    toast("Kiyo's $50 box is curated — upgrade to $99 to add your own picks 💝");
    return;
  }
  const candidate = applyTierCosts(p, state.boxTier);
  if (!canAddItem({ boxTier: state.boxTier, items: state.items, candidateItem: candidate })) {
    playSfx("error");
    toast("That would push you over the limit. Try a lower-impact pick.");
    return;
  }
  const instance = { ...candidate, _instanceId: crypto.randomUUID() };
  state.items = state.items.concat([instance]);
  if (evt) spark(evt);
  playSfx("grab");
  track("item_added", { productId: p.id, title: p.title, category: p.category });
  renderAll();
  toast("Added!");
}

function openProductDialog(p) {
  state.productDialogItem = p;
  els.productDialogTitle.textContent = p.title;
  const vibeText = (p.vibe || []).slice(0, 3).join(" • ") || "Kawaii";
  els.productDialogCategory.textContent = `${p.category} • ${vibeText} • Impact: ${impactBand(p)}`;
  const desc = p.description?.trim()
    ? p.description
    : composeDescription({ categoryName: p.category, title: p.title, productId: String(p.id || "") });
  const safeSource = p.sourceUrl
    ? `<div style="margin-top:8px"><a class="productDialogSource" href="${escapeHtml(
        p.sourceUrl
      )}" target="_blank" rel="noopener noreferrer">View source product ↗</a></div>`
    : "";
  els.productDialogDesc.innerHTML = `${escapeHtml(desc)}${safeSource}`;
  els.productDialogImage.src = p.image || buildFallbackImageDataUrl(p);
  els.productDialogImage.alt = p.title;
  els.productDialogImage.onerror = () => {
    els.productDialogImage.src = buildFallbackImageDataUrl(p);
  };
  els.productDialog.showModal();
}

function scorePref(p) {
  let s = 0;
  if (state.prefs.categories.has(p.category)) s += 3;
  for (const v of p.vibe ?? []) if (state.prefs.aesthetic.has(v)) s += 1;
  return s;
}

function autoFillBox() {
  const tier = state.boxTier;
  if (!tier) return { added: 0 };

  const budgeted = [];
  const pool = state.products
    .slice()
    .sort((a, b) => scorePref(b) - scorePref(a) || Math.random() - 0.5);

  const wantCategories = new Set(
    state.prefs.categories.size ? [...state.prefs.categories] : []
  );

  let added = 0;
  for (const p of pool) {
    const candidate = applyTierCosts(p, tier);
    if (!canAddItem({ boxTier: tier, items: state.items.concat(budgeted), candidateItem: candidate }))
      continue;

    if (wantCategories.size > 0 && !wantCategories.has(p.category) && added < 5) continue;

    const instance = { ...candidate, _instanceId: crypto.randomUUID() };
    budgeted.push(instance);
    added += 1;
    wantCategories.delete(p.category);

    const fill = gaugeFill01({ boxTier: tier, items: state.items.concat(budgeted) });
    if (fill >= 0.92) break;
  }

  if (added > 0) state.items = state.items.concat(budgeted);
  return { added };
}

function renderMysteryGame() {
  els.mysteryCapsules.innerHTML = "";
  for (let i = 0; i < 3; i += 1) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mysteryCapsule";
    b.textContent = `Capsule ${i + 1}`;
    b.addEventListener("click", () => revealMysteryReward(i));
    els.mysteryCapsules.appendChild(b);
  }
  els.claimMysteryBtn.disabled = true;
  els.mysteryChoices.innerHTML = "";
  els.mysteryResult.textContent = "Pick one capsule to reveal your reward.";
}

function revealMysteryReward(seed) {
  const rng = (Date.now() + seed * 7919) % 100;
  const snackCandy = state.products.filter((p) =>
    ["snack", "candy"].some((k) => String(p.category || "").toLowerCase().includes(k))
  );
  if (snackCandy.length === 0) return;

  if (rng < 55) {
    const choices = pickUnique(snackCandy, 3);
    state.mysteryReward = { type: "pick_one", choices };
    state.mysterySelectionId = null;
    els.mysteryResult.textContent = "Lucky draw! Pick 1 free snack or candy bonus item.";
    playSfx("mystery");
    renderMysteryChoices();
  } else {
    const bonusPack = pickUnique(snackCandy, 3);
    state.mysteryReward = { type: "bonus_pack", choices: bonusPack };
    state.mysterySelectionId = "__pack__";
    els.mysteryResult.textContent = "JACKPOT! You unlocked a 3-item bonus pack.";
    playSfx("jackpot");
    burstConfetti(window.innerWidth * 0.5, window.innerHeight * 0.3, 24);
    renderMysteryChoices();
  }
  els.claimMysteryBtn.disabled = false;
}

function renderMysteryChoices() {
  els.mysteryChoices.innerHTML = "";
  if (!state.mysteryReward) return;

  if (state.mysteryReward.type === "pick_one") {
    for (const p of state.mysteryReward.choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.classList.toggle("active", state.mysterySelectionId === p.id);
      b.textContent = p.title;
      b.addEventListener("click", () => {
        state.mysterySelectionId = p.id;
        renderMysteryChoices();
      });
      els.mysteryChoices.appendChild(b);
    }
    els.claimMysteryBtn.disabled = !state.mysterySelectionId;
    return;
  }

  for (const p of state.mysteryReward.choices) {
    const item = document.createElement("div");
    item.className = "pill";
    item.textContent = p.title;
    els.mysteryChoices.appendChild(item);
  }
}

function claimMysteryReward() {
  if (!state.mysteryReward) return;
  if (state.mysteryReward.type === "pick_one") {
    const p = state.mysteryReward.choices.find((x) => x.id === state.mysterySelectionId);
    if (!p) return;
    addMysteryBonusItems([p], "mystery_pick_one");
  } else {
    addMysteryBonusItems(state.mysteryReward.choices, "mystery_bonus_pack");
  }
  localStorage.setItem(MYSTERY_SESSION_KEY, "1");
  els.mysteryDialog.close();
  state.mysteryReward = null;
  state.mysterySelectionId = null;
  renderAll();
}

function addMysteryBonusItems(items, source) {
  for (const p of items) {
    if (state.bonusItems.some((b) => b.id === p.id && b._mysteryReward)) continue;
    state.bonusItems = state.bonusItems.concat([
      { ...p, _instanceId: crypto.randomUUID(), _isBonus: true, _mysteryReward: true },
    ]);
  }
  track("mystery_reward_claimed", { source, itemCount: items.length, itemIds: items.map((x) => x.id) });
  playSfx(items.length > 1 ? "jackpot" : "win");
  toast(`Mystery reward claimed! +${items.length} bonus item${items.length === 1 ? "" : "s"}.`);
}

function getPersistentBonusItems() {
  return state.bonusItems.filter((b) => b._mysteryReward);
}

function maybeOpenMysteryDialog() {
  const already = localStorage.getItem(MYSTERY_SESSION_KEY) === "1";
  if (!already) {
    els.mysteryDialog.showModal();
    track("mystery_dialog_opened");
  }
}

function pickUnique(arr, n) {
  const clone = arr.slice();
  const out = [];
  while (clone.length && out.length < n) {
    const i = Math.floor(Math.random() * clone.length);
    out.push(clone.splice(i, 1)[0]);
  }
  return out;
}

function renderVibeDialog() {
  const categories = [...new Set(state.products.map((p) => p.category)).values()];
  const aestheticOptions = ["Pink", "Pastel", "Sparkle", "Rainbow", "Cute", "Glow", "Glitter", "Floral"];

  renderToggleChips({
    mount: els.vibeCategories,
    options: categories,
    selected: state.prefs.categories,
  });

  renderToggleChips({
    mount: els.vibeAesthetic,
    options: aestheticOptions,
    selected: state.prefs.aesthetic,
  });
}

function renderToggleChips({ mount, options, selected }) {
  mount.innerHTML = "";
  for (const opt of options) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = opt;
    b.classList.toggle("active", selected.has(opt));
    b.addEventListener("click", () => {
      if (selected.has(opt)) selected.delete(opt);
      else selected.add(opt);
      b.classList.toggle("active", selected.has(opt));
    });
    mount.appendChild(b);
  }
}

/* ---------------- Data loading + English translation + demographic filter ---------------- */

async function loadProducts() {
  const params = new URLSearchParams(window.location.search);
  // Cloudflare Pages deploy is static; default to local fallback catalog.
  // If you want to point at a live API, pass ?apiBase=https://your-api.example.com
  const apiBase = params.get("apiBase") || "";

  try {
    if (!apiBase) throw new Error("No apiBase provided; using local fallback.");
    const categoriesRes = await fetch(`${apiBase}/api/categories`, { cache: "no-store" });
    if (!categoriesRes.ok) {
      throw new Error(`Failed categories request (${categoriesRes.status})`);
    }
    const categories = await categoriesRes.json();
    const out = [];

    for (const cat of categories) {
      const total = Number(cat.product_count || 0);
      const pageSize = 40;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      for (let page = 1; page <= totalPages; page += 1) {
        const res = await fetch(
          `${apiBase}/api/categories/${encodeURIComponent(cat.slug)}/products?page=${page}&page_size=${pageSize}`,
          { cache: "no-store" }
        );
        if (!res.ok) break;
        const data = await res.json();
        for (const row of data.products || []) {
          const normalized = normalizeApiProduct(row, cat.name);
          if (!isTeenGirlAppropriate(normalized)) continue;
          out.push(normalized);
        }
      }
    }

    if (out.length > 0) return out;
    throw new Error("No products loaded from backend.");
  } catch (err) {
    console.warn("Backend scraped catalog unavailable, using local fallback.", err);
    const res = await fetch("./data/products.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load products fallback (${res.status})`);
    const raw = await res.json();
    return enrichLocalCatalogProducts(Array.isArray(raw) ? raw : []);
  }
}

/** Adds subcategory fields to static JSON rows (same path API rows already get). */
function enrichLocalCatalogProducts(products) {
  return products.map((p) => {
    const classifyBlob = [p.title, p.description, (p.vibe || []).join(" ")]
      .filter(Boolean)
      .join(" \n ");
    const sub = classifyProduct(p.category, classifyBlob);
    return {
      ...p,
      subcategoryId: sub.id,
      subcategoryLabel: sub.label,
      subcategoryEmoji: sub.emoji,
    };
  });
}

function normalizeApiProduct(row, categoryName) {
  const listPrice = Number(row.list_price || 0);
  const currency = String(row.currency || "JPY").toUpperCase();
  const retailYen =
    currency === "JPY" ? listPrice : listPrice * USD_TO_JPY_RATE;
  const priced = applyTierCosts({ retailYen }, state.boxTier || BOX_TIERS[1]);

  const englishTitle = toEnglishText(row.title, categoryName, "title");
  const englishDescription = composeDescription({
    categoryName,
    title: englishTitle,
    productId: String(row.id ?? ""),
  });

  // Classify subcategory using a blob that combines the raw (possibly CJK)
  // title, description, tags and the English title so classification works
  // regardless of translation state.
  const classifyBlob = [
    row.title,
    row.description,
    row.tags,
    row.source_collection,
    englishTitle,
  ]
    .filter(Boolean)
    .join(" \n ");
  const sub = classifyProduct(categoryName, classifyBlob);

  return {
    id: `api-${row.id}`,
    title: englishTitle,
    category: categoryName || "Shop",
    subcategoryId: sub.id,
    subcategoryLabel: sub.label,
    subcategoryEmoji: sub.emoji,
    vibe: inferVibes(englishTitle, categoryName),
    description: englishDescription,
    image: row.image_url || "",
    sourceUrl: row.source_url || "",
    sourceSite: row.source_site || "",
    retailYen,
    supplierUnitCostUsd: priced.supplierUnitCostUsd,
    expectedJapanToUSShippingAllocationUsd: priced.expectedJapanToUSShippingAllocationUsd,
    handlingAllowanceUsd: priced.handlingAllowanceUsd,
    listPrice: listPrice || 0,
    currency,
  };
}

function toEnglishText(original, categoryName, kind) {
  const raw = String(original || "").trim();
  const asciiRatio = raw.length > 0 ? countAscii(raw) / raw.length : 0;

  if (kind === "title") {
    if (raw && asciiRatio >= 0.78) {
      const cleaned = stripNoiseFromTitle(raw);
      if (hasMeaningfulWords(cleaned)) return prettifyTitle(cleaned);
    }
    return synthesizeEnglishTitle(raw, categoryName);
  }
  return raw;
}

function stripNoiseFromTitle(str) {
  if (!str) return "";
  return String(str)
    .replace(/\s*号仓\s*/gi, " ")
    .replace(/\s*号倉\s*/gi, " ")
    .replace(/^\s*(no\.?\s*)?\d+\s*[-–—]\s*/i, "")
    .replace(/^\s*\d+\s*[-–—]\s*/g, "")
    .replace(/^\s*\d+\s*号\s*/i, "")
    .replace(/[【】「」『』\[\]{}()（）]/g, " ")
    .replace(/\b\d+\s*(g|ml|粒|pcs|pack|packs|count|ct)\b/gi, " ")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[-–—,.\s]+|[-–—,.\s]+$/g, "")
    .trim();
}

function hasMeaningfulWords(str) {
  if (!str) return false;
  const words = String(str)
    .split(/\s+/)
    .filter((w) => /[a-zA-Z]/.test(w) && w.replace(/[^a-zA-Z]/g, "").length >= 3);
  return words.length >= 2;
}

function countAscii(str) {
  let n = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code < 128) n += 1;
  }
  return n;
}

function synthesizeEnglishTitle(raw, categoryName) {
  const asciiOnly = raw.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, " ").trim();
  const cleaned = stripNoiseFromTitle(asciiOnly);
  if (hasMeaningfulWords(cleaned)) {
    return prettifyTitle(cleaned);
  }
  const cat = (categoryName || "").toLowerCase();
  const picks = {
    candy: [
      "Kawaii Candy Drop",
      "Fruity Gummy Pop",
      "Sakura Soft Candy",
      "Peach Milk Chew",
      "Strawberry Candy Star",
    ],
    snack: [
      "Crispy Konbini Snack",
      "Rice Cracker Favorite",
      "Cute Japan Snack",
      "Matcha Crunch Bite",
    ],
    beauty: [
      "Travel-size J-Beauty",
      "Petal Glow Pick",
      "Dewy Tokyo Essential",
      "Kawaii Beauty Mini",
    ],
    ramen: [
      "Cozy Cup Ramen",
      "Tokyo Comfort Cup",
      "Sakura Cup Ramen",
    ],
    kawaii: [
      "Tiny Kawaii Charm",
      "Pastel Plush Friend",
      "Cute Character Pick",
    ],
    stationery: [
      "Kawaii Stationery Pick",
      "Sakura Sticker Set",
      "Cute Study Essential",
    ],
    default: ["Hello Kiyo Kawaii Pick", "Japan-inspired Cutie"],
  };

  let bucket = picks.default;
  if (cat.includes("candy")) bucket = picks.candy;
  else if (cat.includes("snack")) bucket = picks.snack;
  else if (cat.includes("beauty")) bucket = picks.beauty;
  else if (cat.includes("ramen")) bucket = picks.ramen;
  else if (cat.includes("kawaii")) bucket = picks.kawaii;
  else if (cat.includes("stationery")) bucket = picks.stationery;

  const idx = hashString(`${categoryName}:${raw}`) % bucket.length;
  return bucket[idx];
}

function prettifyTitle(str) {
  const cleaned = str
    .replace(/\s+/g, " ")
    .replace(/[\[\]{}]/g, "")
    .replace(/[（(][^)）]{0,40}[)）]/g, "")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 9);
  return words
    .map((w) => {
      if (/^[A-Z0-9&+\-.]+$/.test(w) && w.length <= 4) return w;
      return w.length > 3 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase();
    })
    .join(" ");
}

/**
 * Build a rich, on-brand description that varies per product. Deterministic by id+title
 * so the same product always reads the same. Multiple templates per category, flavor-aware.
 */
function composeDescription({ categoryName, title, productId }) {
  const cat = (categoryName || "").toLowerCase();
  const lowerTitle = (title || "").toLowerCase();

  const flavor =
    pickMatch(lowerTitle, [
      ["sakura", "sakura"],
      ["cherry", "cherry"],
      ["strawberry|ichigo", "strawberry"],
      ["peach|momo", "peach"],
      ["grape|budou|budo", "grape"],
      ["melon", "melon"],
      ["lemon|yuzu|citrus|orange", "citrus"],
      ["apple|ringo", "apple"],
      ["milk", "milky"],
      ["matcha|green tea", "matcha"],
      ["chocolate|choco", "chocolate"],
      ["vanilla", "vanilla"],
      ["berry", "berry"],
      ["ramune|soda|cola", "soda"],
      ["caramel", "caramel"],
    ]) || "";

  const flavorPhrase = flavor ? `${flavor} ` : "";
  const flavorCapped = flavor ? `${flavor.charAt(0).toUpperCase()}${flavor.slice(1)}` : "Fruity";

  const candy = [
    `Soft, chewy Japanese candy with a big ${flavorCapped.toLowerCase()} pop and packaging too cute to throw away. Low-impact pick, huge smile energy.`,
    `A Tokyo konbini classic. Dreamy pastel wrapper, melt-in-your-mouth ${flavorPhrase}bite, and ✨main character✨ vibes in every piece.`,
    `Tiny, iconic ${flavorPhrase}sweet from Japan. Perfect to share with your best friend (or keep the whole pack to yourself, no judgment).`,
    `Kawaii Japanese candy with a juicy ${flavorPhrase}center. Looks like a sticker, tastes like a dream.`,
    `Fruity, fluffy, and fun. A ${flavorPhrase}Japanese candy with that soft-girl aesthetic packaged in every piece.`,
  ];
  const snack = [
    `Crispy Japanese ${flavorPhrase}snack with the lightest crunch and a wrapper worth photographing. Disappears in about 10 seconds, iconic behavior.`,
    `A must-have konbini snack you'll instantly recognize from any Tokyo haul video. Salty-sweet, crunchy, criminally cute.`,
    `Low-key cult favorite Japanese snack. Playful shape, addictive texture, and zero chill on the flavor.`,
    `The kind of Japanese snack you'll message your friends about. Light, crunchy, and secretly the best thing in your box.`,
  ];
  const beauty = [
    `Travel-size J-beauty with petal-soft packaging. Gentle formula, giftable vibe, and the exact pink your pouch was missing.`,
    `Kawaii Japanese beauty essential with a dewy, glass-skin finish. Slips into any bag and always starts compliments.`,
    `A soft, girly Tokyo beauty moment in mini form. Minimalist label, dreamy feel, 100% giftable.`,
    `Japan's quiet beauty flex: clean formula, cute bottle, and a glow that's instantly addictive.`,
  ];
  const ramen = [
    `A warm, slurpable Japanese cup ramen with a flavor hit that'll ruin grocery-store noodles for you. Cozy after-school energy.`,
    `Tokyo comfort in a tiny cup. Bold Japanese broth, springy noodles, and a wrapper too pretty to toss.`,
    `Your new dorm room MVP. Japanese cup ramen with bold, slurp-worthy flavor and soft-girl packaging.`,
  ];
  const kawaii = [
    `Pure kawaii chaos. Desk buddy, bag charm, or surprise gift — and always the thing people ask about.`,
    `Unapologetically cute Japanese design. Pastel-core, collectible, and suspiciously easy to buy 3 of.`,
    `Tiny, adorable, and instantly smile-triggering. The kind of cute that makes a whole day better.`,
  ];
  const stationery = [
    `Kawaii Japanese stationery that makes homework feel like a soft-girl ritual. Pretty enough to show off, too cute to not use.`,
    `Sakura-pink ink dreams. Japanese stationery with main-character energy — study session upgrade confirmed.`,
    `Peak kawaii study vibes. Collectible Japanese stationery that makes your desk look like a Pinterest board.`,
  ];
  const defaults = [
    `Hand-picked Japanese find with cute, colorful energy. Big personality, tiny footprint in your box.`,
    `A playful Japan-inspired pick with serious ✨vibes✨. Low-impact and 100% smile-generating.`,
    `Cute, collectible, and made to spark joy — Hello Kiyo approved.`,
  ];

  let bucket = defaults;
  if (cat.includes("candy")) bucket = candy;
  else if (cat.includes("snack")) bucket = snack;
  else if (cat.includes("beauty")) bucket = beauty;
  else if (cat.includes("ramen")) bucket = ramen;
  else if (cat.includes("kawaii")) bucket = kawaii;
  else if (cat.includes("stationery")) bucket = stationery;

  const seed = `${productId}|${title}|${categoryName}`;
  const idx = hashString(seed) % bucket.length;
  return bucket[idx];
}

function pickMatch(text, pairs) {
  for (const [pattern, label] of pairs) {
    if (new RegExp(pattern).test(text)) return label;
  }
  return null;
}

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function inferVibes(title, categoryName) {
  const text = `${title || ""} ${categoryName || ""}`.toLowerCase();
  const vibes = [];
  if (/(candy|sweet|gummy|chocolate|pocky)/.test(text)) vibes.push("Sweet");
  if (/(snack|chip|cracker|senbei)/.test(text)) vibes.push("Fun");
  if (/(beauty|mask|skin|lip|glow|lotion)/.test(text)) vibes.push("Glow");
  if (/(kawaii|cute|charm|sticker|plush)/.test(text)) vibes.push("Cute");
  if (/(ramen|noodle|soup)/.test(text)) vibes.push("Savory");
  if (/(pink|rose|berry|strawberry|peach)/.test(text)) vibes.push("Pink");
  if (/(rainbow|sparkle|glitter|shimmer)/.test(text)) vibes.push("Sparkle");
  if (vibes.length === 0) vibes.push("Colorful");
  return vibes;
}

function isTeenGirlAppropriate(p) {
  const blob = `${p.title || ""} ${p.description || ""} ${p.category || ""}`.toLowerCase();

  const excludeKeywords = [
    "men's",
    " mens ",
    "men ",
    "shaving",
    "shaver",
    "beard",
    "whisky",
    "whiskey",
    "sake",
    "beer",
    "alcohol",
    "liquor",
    "cigarette",
    "tobacco",
    "denture",
    "dad",
    "papa",
    "salary",
    "salt & pepper",
    "black coffee",
    "muscle",
  ];
  if (excludeKeywords.some((k) => blob.includes(k))) return false;

  const colorfulKeywords = [
    "pink",
    "rose",
    "strawberry",
    "peach",
    "rainbow",
    "sparkle",
    "glitter",
    "pastel",
    "floral",
    "sakura",
    "kawaii",
    "cute",
    "heart",
    "cherry",
    "berry",
    "candy",
    "gummy",
    "chocolate",
    "pocky",
    "lollipop",
    "fruit",
    "matcha",
    "milk tea",
    "shimmer",
    "glow",
    "mask",
    "lip",
    "nail",
    "sticker",
    "plush",
    "charm",
    "stationery",
    "journal",
    "notebook",
    "cup ramen",
    "ramen",
    "udon",
    "character",
  ];
  const categoryIsSafe = /(candy|snack|beauty|kawaii|stationery|ramen|plush|keychain|craft)/i.test(
    p.category || ""
  );
  const hasColorfulCue = colorfulKeywords.some((k) => blob.includes(k));

  if (categoryIsSafe) return true;

  return hasColorfulCue;
}

/* ---------------- Utility ---------------- */

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => els.toast.classList.remove("show"), 1400);
}

function spark(evt) {
  const s = document.createElement("div");
  s.className = "spark";
  const x = evt.clientX;
  const y = evt.clientY;
  s.style.left = `${x - 5}px`;
  s.style.top = `${y - 5}px`;
  document.body.appendChild(s);

  const dx = (Math.random() - 0.5) * 120;
  const dy = -40 - Math.random() * 70;
  const start = performance.now();
  const dur = 450;

  const tick = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const ease = 1 - Math.pow(1 - p, 3);
    s.style.transform = `translate(${dx * ease}px, ${dy * ease}px) scale(${1 - p * 0.3})`;
    s.style.opacity = String(1 - p);
    if (p < 1) requestAnimationFrame(tick);
    else s.remove();
  };
  requestAnimationFrame(tick);
}

function burstConfetti(x, y, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
    c.style.background = ["#ff4fa3", "#2ad1c9", "#2f46ff", "#ffe36a", "#b69dff"][i % 5];
    document.body.appendChild(c);

    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.45;
    const speed = 60 + Math.random() * 90;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 36;
    const start = performance.now();
    const dur = 620 + Math.random() * 320;

    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      c.style.transform = `translate(${dx * p}px, ${dy * p + 86 * p * p}px) rotate(${560 * p}deg)`;
      c.style.opacity = String(1 - p);
      if (p < 1) requestAnimationFrame(tick);
      else c.remove();
    };
    requestAnimationFrame(tick);
  }
}

async function ensureAudio() {
  if (state.audioCtx) return state.audioCtx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  state.audioCtx = new AudioCtx();
  if (state.audioCtx.state === "suspended") {
    await state.audioCtx.resume();
  }
  return state.audioCtx;
}

function playSfx(type) {
  if (!state.soundEnabled) return;
  ensureAudio().then((ctx) => {
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.05;
    out.connect(ctx.destination);

    const blip = (freq, t, dur, wave = "triangle") => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dur + 0.01);
    };

    switch (type) {
      case "coin":
        blip(780, now, 0.08, "sine");
        blip(1040, now + 0.08, 0.08, "sine");
        break;
      case "grab":
        blip(520, now, 0.09);
        blip(680, now + 0.08, 0.08);
        break;
      case "win":
        blip(620, now, 0.09);
        blip(860, now + 0.1, 0.12);
        break;
      case "jackpot":
        blip(620, now, 0.1);
        blip(760, now + 0.1, 0.1);
        blip(920, now + 0.2, 0.12);
        blip(1180, now + 0.32, 0.18);
        break;
      case "error":
        blip(220, now, 0.11, "sawtooth");
        blip(190, now + 0.1, 0.11, "sawtooth");
        break;
      case "remove":
        blip(300, now, 0.08);
        break;
      case "select":
        blip(540, now, 0.08);
        break;
      case "mystery":
        blip(560, now, 0.08);
        blip(780, now + 0.12, 0.1);
        break;
      case "reset":
        blip(500, now, 0.09);
        blip(320, now + 0.07, 0.1);
        break;
      case "toggle_on":
        blip(660, now, 0.08);
        blip(880, now + 0.08, 0.08);
        break;
      default:
        blip(520, now, 0.08);
    }
  });
}

function updateSoundToggleLabel() {
  const on = state.soundEnabled;
  const compact =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width: 720px)").matches;
  els.soundToggle.textContent = compact ? (on ? "🔊" : "🔇") : on ? "Sound On" : "Sound Off";
  els.soundToggle.setAttribute("aria-pressed", on ? "true" : "false");
  els.soundToggle.setAttribute("aria-label", on ? "Sound on" : "Sound off");
}

function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildFallbackImageDataUrl(p) {
  const title = String(p.title || "HelloKiyo Pick");
  const category = String(p.category || "Kawaii");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 260'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#ff4fa3'/>
        <stop offset='50%' stop-color='#2ad1c9'/>
        <stop offset='100%' stop-color='#2f46ff'/>
      </linearGradient>
    </defs>
    <rect width='420' height='260' fill='url(#g)' opacity='0.22'/>
    <rect x='14' y='14' width='392' height='232' rx='18' fill='white' opacity='0.8'/>
    <text x='210' y='100' text-anchor='middle' font-family='Arial, sans-serif' font-size='18' font-weight='700' fill='#0f172a'>${escapeForSvg(
      title
    )}</text>
    <text x='210' y='136' text-anchor='middle' font-family='Arial, sans-serif' font-size='13' fill='#334155'>${escapeForSvg(
      category
    )}</text>
    <text x='210' y='180' text-anchor='middle' font-family='Arial, sans-serif' font-size='24'>🎀 🍬 ✨</text>
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
