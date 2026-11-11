const STORAGE_KEY = "baby-food-calendar";
const START_DATE_KEY = "baby-food-start-date";
const D_DAY_DATE_KEY = "baby-food-d-day-date";
const D_DAY_NUMBER_KEY = "baby-food-d-day-number";
const OLD_INGREDIENT_KEY = "baby-food-ingredients";
const INGREDIENT_KEY = "baby-food-ingredients-v2"; // [{id, name, aliases, category}]
// 카테고리별 기본 재료. "이름|별칭|별칭" 형식 (별칭도 메뉴명 매칭에 사용)
const INGREDIENT_DEFAULTS = {
  "곡류": ["쌀", "흑미", "오트밀|귀리", "찹쌀", "밀가루", "수수", "퀴노아", "현미"],
  "채소류": ["브로콜리", "애호박", "비타민", "양배추|적양배추", "당근", "청경채", "시금치", "콜리플라워|콜리", "얼갈이배추|얼갈이", "무", "비트", "아보카도", "양파", "새송이버섯|새송이", "팽이버섯|팽이", "가지"],
  "구황작물류": ["고구마|자색고구마", "단호박", "감자", "옥수수"],
  "육류, 알류": ["소고기|한우|쇠고기", "닭고기|닭", "계란|달걀|노른자"],
  "과일류": ["사과", "바나나", "배", "자두|건자두|푸룬"],
  "유제품류": ["요거트|요구르트"],
  "콩류": ["두부"],
  "생선류": ["흰살생선|흰살|대구"],
};
const INGREDIENT_CATEGORIES = [...Object.keys(INGREDIENT_DEFAULTS), "기타"];
let ingredientFilter = "전체";
const NOTES_KEY = "baby-food-notes"; // { common: "", months: { "YYYY-MM": "" } }
const DAY_MEMO_KEY = "baby-food-day-memos"; // { "YYYY-MM-DD": "메모" }
const CATEGORY_COLORS = {
  "곡류": "#e6c34a",
  "채소류": "#6cbf84",
  "구황작물류": "#f2a65a",
  "육류, 알류": "#e57373",
  "과일류": "#d98cb3",
  "유제품류": "#6c8fd6",
  "콩류": "#a78bda",
  "생선류": "#4fb3bf",
  "기타": "#9aa0a6",
};

const calendarGrid = document.getElementById("calendarGrid");
const monthTitle = document.getElementById("monthTitle");
const modalOverlay = document.getElementById("modalOverlay");
const modalDate = document.getElementById("modalDate");
const modalSub = document.getElementById("modalSub");
const entryList = document.getElementById("entryList");
const formTitle = document.getElementById("formTitle");
const mealName = document.getElementById("mealName");
const mealMemo = document.getElementById("mealMemo");
const mealAmount = document.getElementById("mealAmount");
const cancelButton = document.getElementById("cancelButton");
const saveButton = document.getElementById("saveButton");
const startDateInput = document.getElementById("startDateInput");
const startInfo = document.getElementById("startInfo");
const dDayDateInput = document.getElementById("dDayDateInput");
const dDayNumberInput = document.getElementById("dDayNumberInput");
const memoButton = document.getElementById("memoButton");
const memoOverlay = document.getElementById("memoOverlay");
const memoTitle = document.getElementById("memoTitle");
const dayMemoInput = document.getElementById("dayMemoInput");
const ingredientCard = document.getElementById("ingredientCard");
const ingredientList = document.getElementById("ingredientList");
const ingredientInput = document.getElementById("ingredientInput");
const ingredientCategory = document.getElementById("ingredientCategory");
const noteButton = document.getElementById("noteButton");
const noteOverlay = document.getElementById("noteOverlay");
const noteTabMonth = document.getElementById("noteTabMonth");
const noteTabCommon = document.getElementById("noteTabCommon");
const noteMonthInput = document.getElementById("noteMonthInput");
const noteCommonInput = document.getElementById("noteCommonInput");
const settingsOverlay = document.getElementById("settingsOverlay");
const ingredientFilterBox = document.getElementById("ingredientFilter");

INGREDIENT_CATEGORIES.forEach((cat) => {
  const option = document.createElement("option");
  option.value = option.textContent = cat;
  ingredientCategory.appendChild(option);
});

let currentDate = new Date();
let selectedDateKey = null;
let editingId = null;

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayDiff(aKey, bKey) {
  const a = new Date(`${aKey}T00:00:00`);
  const b = new Date(`${bKey}T00:00:00`);
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function getDDayNumber(dateKey) {
  const referenceDate = localStorage.getItem(D_DAY_DATE_KEY);
  const referenceNumber = Number(localStorage.getItem(D_DAY_NUMBER_KEY));

  if (!referenceDate || Number.isNaN(referenceNumber)) return null;

  return referenceNumber + dayDiff(dateKey, referenceDate);
}

// 이유식 시작일 기준 n일차 (시작일 = 1일차). 시작일 이전/미설정이면 null
function getStartDayNumber(dateKey) {
  const start = localStorage.getItem(START_DATE_KEY);
  if (!start) return null;
  const n = dayDiff(dateKey, start) + 1;
  return n >= 1 ? n : null;
}

function getDateKey(year, month, day) {
  const monthString = String(month + 1).padStart(2, "0");
  const dayString = String(day).padStart(2, "0");
  return `${year}-${monthString}-${dayString}`;
}

function getMeals() {
  const savedData = localStorage.getItem(STORAGE_KEY);
  return savedData ? JSON.parse(savedData) : {};
}

function saveMeals(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getIngredients() {
  let list = readJSON(INGREDIENT_KEY, null);
  if (!Array.isArray(list)) {
    list = [];
    Object.entries(INGREDIENT_DEFAULTS).forEach(([category, items]) => {
      items.forEach((entry) => {
        const [name, ...aliases] = entry.split("|");
        list.push({ id: `def-${name}`, name, aliases, category, });
      });
    });
    // 이전 버전에서 직접 추가했던 재료는 '기타'로 이어받기
    readJSON(OLD_INGREDIENT_KEY, []).forEach((old) => {
      if (!list.some((ing) => ing.name === old.name)) {
        list.push({ ...old, aliases: [], category: "기타" });
      }
    });
    saveIngredients(list);
  }
  return list;
}

// 한 글자/흔한 단어는 '배변', '한가지'처럼 다른 말에 섞여 오인되므로 단어 단위로만 인정
const STRICT_TERMS = new Set(["배", "무", "가지"]);
const PARTICLES = "은는이가을를도와과로의에랑만";

function termRegex(term) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^가-힣])${esc}(?=$|[^가-힣]|[${PARTICLES}])`);
}

// 텍스트(메뉴명+메모)에 들어 있는 재료 id 집합.
// 긴 단어부터 소거해서 '양배추'가 '배'로, '찹쌀'이 '쌀'로 중복 집계되지 않게 함
function matchedIngredients(text, ingredients) {
  const terms = [];
  ingredients.forEach((ing) => {
    [ing.name, ...(ing.aliases || [])].forEach((t) => t && terms.push({ t, id: ing.id }));
  });
  terms.sort((a, b) => b.t.length - a.t.length);

  const hit = new Set();
  let rest = text;
  terms.forEach(({ t, id }) => {
    const mask = "\u0000".repeat(t.length);
    if (STRICT_TERMS.has(t)) {
      const re = termRegex(t);
      if (re.test(rest)) {
        hit.add(id);
        rest = rest.replace(re, (m, pre) => pre + mask);
      }
    } else if (rest.includes(t)) {
      hit.add(id);
      rest = rest.split(t).join(mask);
    }
  });
  return hit;
}

function mealText(meal) {
  return `${meal.name} ${meal.memo || ""}`;
}

function parseKeywords(input) {
  return [...new Set(input.split(/[,，、]/).map((x) => x.trim()).filter(Boolean))];
}

// 기존 저장 데이터에 새 기본 키워드를 1회 합쳐 넣기 (이후 직접 수정한 키워드는 유지)
function ensureDefaultAliases() {
  const VERSION = "2";
  if (localStorage.getItem("baby-food-alias-version") === VERSION) return;
  const list = getIngredients();
  Object.values(INGREDIENT_DEFAULTS).flat().forEach((entry) => {
    const [name, ...aliases] = entry.split("|");
    const item = list.find((ing) => ing.id === `def-${name}`);
    if (item) item.aliases = [...new Set([...(item.aliases || []), ...aliases])];
  });
  saveIngredients(list);
  localStorage.setItem("baby-food-alias-version", VERSION);
}

function saveIngredients(list) {
  localStorage.setItem(INGREDIENT_KEY, JSON.stringify(list));
}

function getDayMemos() {
  return readJSON(DAY_MEMO_KEY, {});
}

function updateMemoButton() {
  memoButton.textContent = getDayMemos()[selectedDateKey] ? "📝 오늘의 메모 ✓" : "📝 오늘의 메모";
}

// 재료 카드: 카테고리 필터 + 재료 목록(추가/삭제) + 재료별 횟수/첫 섭취일
function renderIngredients() {
  const list = getIngredients();
  const meals = getMeals();
  const stats = {};

  Object.keys(meals).sort().forEach((key) => {
    meals[key].forEach((meal) => {
      matchedIngredients(mealText(meal), list).forEach((id) => {
        if (!stats[id]) stats[id] = { count: 0, first: key };
        stats[id].count++;
      });
    });
  });

  ingredientFilterBox.innerHTML = "";
  ["전체", ...INGREDIENT_CATEGORIES].forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (cat === ingredientFilter ? " active" : "");
    chip.style.setProperty("--chip", CATEGORY_COLORS[cat] || "var(--primary)");
    chip.textContent = cat;
    chip.addEventListener("click", () => {
      ingredientFilter = cat;
      if (cat !== "전체") ingredientCategory.value = cat;
      renderIngredients();
      renderCalendar();
    });
    ingredientFilterBox.appendChild(chip);
  });

  ingredientList.innerHTML = "";

  INGREDIENT_CATEGORIES.forEach((cat) => {
    if (ingredientFilter !== "전체" && cat !== ingredientFilter) return;

    const items = list.filter((ing) => (ing.category || "기타") === cat);
    if (!items.length && ingredientFilter === "전체") return;

    const eaten = items.filter((ing) => stats[ing.id]).length;
    const title = document.createElement("div");
    title.className = "ingredient-group-title";
    title.style.color = CATEGORY_COLORS[cat];
    title.textContent = `● ${cat}  ${eaten}/${items.length}`;
    ingredientList.appendChild(title);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "entry-empty";
      empty.textContent = "재료를 추가해 보세요.";
      ingredientList.appendChild(empty);
      return;
    }

    items.forEach((ing) => {
      const stat = stats[ing.id];
      const row = document.createElement("div");
      row.className = "ingredient-row" + (stat ? " eaten" : "");

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = CATEGORY_COLORS[cat];

      const name = document.createElement("span");
      name.className = "ingredient-name";
      name.textContent = ing.name;
      if (ing.aliases && ing.aliases.length) {
        const alias = document.createElement("small");
        alias.className = "ingredient-alias";
        alias.textContent = ing.aliases.join(", ");
        name.appendChild(alias);
      }

      const meta = document.createElement("span");
      meta.className = "ingredient-meta";
      meta.textContent = stat ? `${stat.count}회 · ${stat.first.slice(5).replace("-", "/")}` : "";

      const edit = document.createElement("button");
      edit.className = "entry-btn";
      edit.textContent = "✎";
      edit.title = "재료 수정";
      edit.addEventListener("click", () => openIngredientEdit(ing));

      const del = document.createElement("button");
      del.className = "entry-btn danger";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        if (!confirm(`'${ing.name}' 재료를 삭제할까요?`)) return;
        saveIngredients(getIngredients().filter((item) => item.id !== ing.id));
        renderIngredients();
        renderCalendar();
      });

      row.append(dot, name, meta, edit, del);
      ingredientList.appendChild(row);
    });
  });
}

function updateStartInfo() {
  const start = localStorage.getItem(START_DATE_KEY);
  if (!start) {
    startInfo.textContent = "";
    return;
  }
  const diff = dayDiff(formatLocalDate(new Date()), start);
  startInfo.textContent =
    diff >= 0 ? `오늘 이유식 ${diff + 1}일차` : `시작까지 D-${-diff}`;
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const allIngredients = getIngredients();
  const dayMemos = getDayMemos();
  const meals = getMeals();
  updateNoteIndicator();

  monthTitle.textContent = `${year}년 ${month + 1}월`;
  calendarGrid.innerHTML = "";

  for (let i = 0; i < firstDay; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day empty";
    calendarGrid.appendChild(emptyDay);
  }

  for (let day = 1; day <= lastDate; day++) {
    const dateKey = getDateKey(year, month, day);
    const dayOfWeek = new Date(year, month, day).getDay();

    const dayElement = document.createElement("div");
    dayElement.className = "calendar-day";

    if (dayOfWeek === 0) dayElement.classList.add("sunday");
    if (dayOfWeek === 6) dayElement.classList.add("saturday");

    if (
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
    ) {
      dayElement.classList.add("today");
    }

    const dateNumber = document.createElement("div");
    dateNumber.className = "date-number";
    dateNumber.textContent = day;
    dayElement.appendChild(dateNumber);

    const badgeRow = document.createElement("div");
    badgeRow.className = "badge-row";

    const dDayNumber = getDDayNumber(dateKey);
    if (dDayNumber !== null && dDayNumber >= 0) {
      const dDayBadge = document.createElement("div");
      dDayBadge.className = "d-day-badge";
      dDayBadge.textContent = `D+${dDayNumber}`;
      badgeRow.appendChild(dDayBadge);
    }

    const startDay = getStartDayNumber(dateKey);
    if (startDay !== null) {
      const startBadge = document.createElement("div");
      startBadge.className = "start-badge";
      startBadge.textContent = startDay === 1 ? "시작" : `${startDay}일차`;
      badgeRow.appendChild(startBadge);
    }

    if (badgeRow.children.length) dayElement.appendChild(badgeRow);

    const mealList = document.createElement("div");
    mealList.className = "meal-list";

    if (meals[dateKey]) {
      meals[dateKey].forEach((meal) => {
        const mealItem = document.createElement("div");
        mealItem.className = "meal-item";
        // 전체 재료로 매칭한 뒤, 필터에 맞는 카테고리만 색 점으로 표시
        const hit = matchedIngredients(mealText(meal), allIngredients);
        const cats = new Set(
          allIngredients
            .filter((ing) => hit.has(ing.id))
            .map((ing) => ing.category || "기타")
            .filter((cat) => ingredientFilter === "전체" || cat === ingredientFilter)
        );
        INGREDIENT_CATEGORIES.filter((cat) => cats.has(cat)).forEach((cat) => {
          const dot = document.createElement("span");
          dot.className = "dot";
          dot.style.background = CATEGORY_COLORS[cat];
          dot.title = cat;
          mealItem.appendChild(dot);
        });
        mealItem.append(meal.name + (meal.memo ? " 📝" : ""));
        mealItem.title = meal.memo ? `${meal.name}\n${meal.memo}` : meal.name;
        mealList.appendChild(mealItem);
      });
    }

    if (dayMemos[dateKey]) {
      const memoLine = document.createElement("div");
      memoLine.className = "day-memo";
      memoLine.textContent = `📝 ${dayMemos[dateKey]}`;
      mealList.appendChild(memoLine);
    }

    dayElement.appendChild(mealList);

    dayElement.addEventListener("click", () => {
      openModal(dateKey, year, month, day);
    });

    calendarGrid.appendChild(dayElement);
  }

  const totalCells = firstDay + lastDate;
  const remainingCells = (7 - (totalCells % 7)) % 7;

  for (let i = 0; i < remainingCells; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day empty";
    calendarGrid.appendChild(emptyDay);
  }
}

// 입력 폼을 '새 기록 추가' 상태로 초기화
function resetForm() {
  editingId = null;
  mealName.value = "";
  mealMemo.value = "";
  mealAmount.value = "";
  formTitle.textContent = "새 기록 추가";
  saveButton.textContent = "추가";
  cancelButton.textContent = "닫기";
}

// 모달 상단: 선택한 날짜의 기존 기록 목록
function renderEntries() {
  const list = getMeals()[selectedDateKey] || [];
  entryList.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "entry-empty";
    empty.textContent = "아직 기록이 없어요.";
    entryList.appendChild(empty);
    return;
  }

  list.forEach((meal) => {
    const entry = document.createElement("div");
    entry.className = "entry";
    if (meal.id === editingId) entry.classList.add("editing");

    const body = document.createElement("div");
    body.className = "entry-body";

    const name = document.createElement("div");
    name.className = "entry-name";
    name.textContent = meal.name;
    if (meal.amount != null) {
      const amount = document.createElement("span");
      amount.className = "entry-amount";
      amount.textContent = `${meal.amount}${meal.unit || ""}`;
      name.appendChild(amount);
    }
    body.appendChild(name);

    if (meal.memo) {
      const memo = document.createElement("div");
      memo.className = "entry-memo";
      memo.textContent = meal.memo;
      body.appendChild(memo);
    }

    const actions = document.createElement("div");
    actions.className = "entry-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "entry-btn";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => startEdit(meal));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "entry-btn danger";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", () => deleteMeal(meal.id));

    actions.append(editBtn, deleteBtn);
    entry.append(body, actions);
    entryList.appendChild(entry);
  });
}

function startEdit(meal) {
  editingId = meal.id;
  mealName.value = meal.name;
  mealMemo.value = meal.memo || "";
  mealAmount.value = meal.amount ?? "";
  formTitle.textContent = "기록 수정";
  saveButton.textContent = "수정 저장";
  cancelButton.textContent = "수정 취소";
  renderEntries();
  mealName.focus();
}

function deleteMeal(id) {
  if (!confirm("이 기록을 삭제할까요?")) return;

  const meals = getMeals();
  const list = (meals[selectedDateKey] || []).filter((m) => m.id !== id);

  if (list.length) meals[selectedDateKey] = list;
  else delete meals[selectedDateKey];

  saveMeals(meals);
  if (editingId === id) resetForm();
  renderIngredients();
  renderEntries();
  renderCalendar();
}

function openModal(dateKey, year, month, day) {
  selectedDateKey = dateKey;
  modalDate.textContent = `${year}년 ${month + 1}월 ${day}일 이유식 기록`;

  const startDay = getStartDayNumber(dateKey);
  modalSub.textContent = startDay !== null ? `이유식 ${startDay}일차` : "";

  resetForm();
  renderEntries();
  updateMemoButton();
  modalOverlay.classList.add("show");
  mealName.focus();
}

function closeModal() {
  modalOverlay.classList.remove("show");
  selectedDateKey = null;
  editingId = null;
}

startDateInput.value = localStorage.getItem(START_DATE_KEY) || "";
dDayDateInput.value = localStorage.getItem(D_DAY_DATE_KEY) || "";
dDayNumberInput.value = localStorage.getItem(D_DAY_NUMBER_KEY) || "";

startDateInput.addEventListener("change", (event) => {
  const value = event.target.value;
  if (value) localStorage.setItem(START_DATE_KEY, value);
  else localStorage.removeItem(START_DATE_KEY);

  updateStartInfo();
  renderCalendar();
});

function saveDDayReference() {
  const date = dDayDateInput.value;
  const number = dDayNumberInput.value;

  if (date && number !== "") {
    localStorage.setItem(D_DAY_DATE_KEY, date);
    localStorage.setItem(D_DAY_NUMBER_KEY, number);
  } else {
    localStorage.removeItem(D_DAY_DATE_KEY);
    localStorage.removeItem(D_DAY_NUMBER_KEY);
  }

  renderCalendar();
}

dDayDateInput.addEventListener("change", saveDDayReference);
dDayNumberInput.addEventListener("change", saveDDayReference);

document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

document.getElementById("todayButton").addEventListener("click", () => {
  currentDate = new Date();
  renderCalendar();
});

// 편집 중이면 '수정 취소', 아니면 모달 닫기
cancelButton.addEventListener("click", () => {
  if (editingId !== null) {
    resetForm();
    renderEntries();
  } else {
    closeModal();
  }
});

saveButton.addEventListener("click", () => {
  const name = mealName.value.trim();
  const memo = mealMemo.value.trim();

  if (!name) {
    alert("이유식 메뉴를 입력해주세요.");
    mealName.focus();
    return;
  }

  // 양: 비워두면 null, 입력하면 숫자 (그래프용으로 amount + unit 저장)
  const amountText = mealAmount.value.trim();
  const amount = amountText === "" ? null : Number(amountText);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    alert("양은 0 이상의 숫자로 입력해주세요.");
    mealAmount.focus();
    return;
  }
  const unit = "g"; // 단위는 g 고정

  const meals = getMeals();
  if (!meals[selectedDateKey]) meals[selectedDateKey] = [];

  if (editingId !== null) {
    const target = meals[selectedDateKey].find((m) => m.id === editingId);
    if (target) {
      target.name = name;
      target.memo = memo;
      target.amount = amount;
      target.unit = unit;
    }
  } else {
    meals[selectedDateKey].push({ id: Date.now(), name, memo, amount, unit });
  }

  saveMeals(meals);
  resetForm();
  renderEntries();
  renderCalendar();
  renderIngredients();
  mealName.focus();
});

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeModal();
  }
});

// 재료 수정 모달 (이름 / 인식 키워드 / 카테고리)
const ingredientEditOverlay = document.getElementById("ingredientEditOverlay");
const ingEditName = document.getElementById("ingEditName");
const ingEditAliases = document.getElementById("ingEditAliases");
const ingEditCategory = document.getElementById("ingEditCategory");
let editingIngredientId = null;

INGREDIENT_CATEGORIES.forEach((cat) => {
  const option = document.createElement("option");
  option.value = option.textContent = cat;
  ingEditCategory.appendChild(option);
});

function openIngredientEdit(ing) {
  editingIngredientId = ing.id;
  ingEditName.value = ing.name;
  ingEditAliases.value = (ing.aliases || []).join(", ");
  ingEditCategory.value = INGREDIENT_CATEGORIES.includes(ing.category) ? ing.category : "기타";
  ingredientEditOverlay.classList.add("show");
  ingEditName.focus();
}

function closeIngredientEdit() {
  ingredientEditOverlay.classList.remove("show");
  editingIngredientId = null;
}

function saveIngredientEdit() {
  const name = ingEditName.value.trim();
  if (!name) {
    alert("재료 이름을 입력해주세요.");
    ingEditName.focus();
    return;
  }

  const list = getIngredients();
  if (list.some((item) => item.id !== editingIngredientId && item.name === name)) {
    alert("같은 이름의 재료가 이미 있어요.");
    ingEditName.focus();
    return;
  }

  const target = list.find((item) => item.id === editingIngredientId);
  if (target) {
    target.name = name;
    target.aliases = parseKeywords(ingEditAliases.value).filter((k) => k !== name);
    target.category = ingEditCategory.value;
    saveIngredients(list);
  }

  closeIngredientEdit();
  renderIngredients();
  renderCalendar();
}

document.getElementById("ingEditSave").addEventListener("click", saveIngredientEdit);
document.getElementById("ingEditCancel").addEventListener("click", closeIngredientEdit);
[ingEditName, ingEditAliases].forEach((input) =>
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveIngredientEdit();
  })
);
ingredientEditOverlay.addEventListener("click", (event) => {
  if (event.target === ingredientEditOverlay) closeIngredientEdit();
});

// 먹어본 재료 카드
const ingredientBackdrop = document.getElementById("ingredientBackdrop");
const desktopQuery = window.matchMedia("(min-width: 1025px)");

function setIngredientCard(open) {
  ingredientCard.classList.toggle("show", open);
  ingredientBackdrop.classList.toggle("show", open);
  document.body.classList.toggle("card-open", open);
}

ingredientBackdrop.addEventListener("click", () => setIngredientCard(false));
// 데스크탑 <-> 태블릿 이하 전환 시: 데스크탑은 열림, 그 외는 닫힘(바텀시트가 갑자기 뜨지 않게)
desktopQuery.addEventListener("change", (event) => setIngredientCard(event.matches));

document.getElementById("ingredientToggle").addEventListener("click", () => {
  setIngredientCard(!ingredientCard.classList.contains("show"));
});

document.getElementById("ingredientClose").addEventListener("click", () => {
  setIngredientCard(false);
});

document.getElementById("ingredientForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const [name, ...aliases] = parseKeywords(ingredientInput.value);
  if (!name) return;

  const list = getIngredients();
  if (!list.some((ing) => ing.name === name)) {
    list.push({ id: Date.now(), name, aliases, category: ingredientCategory.value });
    saveIngredients(list);
  }

  ingredientInput.value = "";
  renderIngredients();
  renderCalendar();
});

// 하루 메모 모달
function closeMemoModal() {
  memoOverlay.classList.remove("show");
}

memoButton.addEventListener("click", () => {
  if (!selectedDateKey) return;
  memoTitle.textContent = modalDate.textContent.replace(" 이유식 기록", " 메모");
  dayMemoInput.value = getDayMemos()[selectedDateKey] || "";
  memoOverlay.classList.add("show");
  dayMemoInput.focus();
});

document.getElementById("memoCancel").addEventListener("click", closeMemoModal);

document.getElementById("memoSave").addEventListener("click", () => {
  const memos = getDayMemos();
  const text = dayMemoInput.value.trim();

  if (text) memos[selectedDateKey] = text;
  else delete memos[selectedDateKey];

  localStorage.setItem(DAY_MEMO_KEY, JSON.stringify(memos));
  closeMemoModal();
  updateMemoButton();
  renderCalendar();
});

memoOverlay.addEventListener("click", (event) => {
  if (event.target === memoOverlay) closeMemoModal();
});

// 데이터 내보내기 / 불러오기 (baby-food-* 키 전체를 JSON 파일 하나로)
const BACKUP_APP = "baby-food-calendar";
const BACKUP_VERSION = 1;
const KEY_PREFIX = "baby-food-";

function exportData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith(KEY_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw; // 날짜 문자열 등 JSON이 아닌 값은 그대로
    }
  }

  const backup = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `baby-food-backup-${formatLocalDate(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// 올바른 백업 파일이면 data 객체를, 아니면 null 반환
function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isPlainObject(backup) || backup.app !== BACKUP_APP || typeof backup.version !== "number") return null;
  if (backup.version > BACKUP_VERSION || !isPlainObject(backup.data)) return null;

  const data = backup.data;
  if (!Object.keys(data).every((key) => key.startsWith(KEY_PREFIX))) return null;

  const shape = {
    [STORAGE_KEY]: isPlainObject,
    [DAY_MEMO_KEY]: isPlainObject,
    [NOTES_KEY]: isPlainObject,
    [INGREDIENT_KEY]: Array.isArray,
  };
  const valid = Object.entries(shape).every(([key, check]) => !(key in data) || check(data[key]));
  return valid ? data : null;
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const data = parseBackup(String(reader.result));
    if (!data) {
      alert("올바른 백업 파일이 아니에요. 내보내기로 저장한 JSON 파일을 선택해주세요.");
      return;
    }

    if (!confirm("⚠️ 현재 저장된 모든 데이터가 삭제되고, 불러온 파일의 데이터로 교체됩니다.\n이 작업은 되돌릴 수 없어요. 계속할까요?")) {
      return;
    }

    Object.keys(localStorage)
      .filter((key) => key.startsWith(KEY_PREFIX))
      .forEach((key) => localStorage.removeItem(key));

    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    });

    alert("데이터를 불러왔어요.");
    location.reload();
  };
  reader.onerror = () => alert("파일을 읽지 못했어요.");
  reader.readAsText(file);
}

const importFile = document.getElementById("importFile");
document.getElementById("exportButton").addEventListener("click", exportData);
document.getElementById("importButton").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  importFile.value = ""; // 같은 파일을 다시 선택해도 동작하도록
  if (file) importData(file);
});

// 설정 모달 (이유식 시작일 / D-Day 기준)
document.getElementById("settingsButton").addEventListener("click", () => {
  updateStartInfo();
  settingsOverlay.classList.add("show");
});
document.getElementById("settingsClose").addEventListener("click", () => {
  settingsOverlay.classList.remove("show");
});
settingsOverlay.addEventListener("click", (event) => {
  if (event.target === settingsOverlay) settingsOverlay.classList.remove("show");
});

// 헤더 메모: 달별 / 전체 공통 탭
function getNotes() {
  const saved = readJSON(NOTES_KEY, {});
  return { common: saved.common || "", months: saved.months || {} };
}

function currentMonthKey() {
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
}

function updateNoteIndicator() {
  const notes = getNotes();
  noteButton.classList.toggle("has", !!(notes.common || notes.months[currentMonthKey()]));
}

function showNoteTab(tab) {
  const isMonth = tab === "month";
  noteTabMonth.classList.toggle("active", isMonth);
  noteTabCommon.classList.toggle("active", !isMonth);
  noteMonthInput.hidden = !isMonth;
  noteCommonInput.hidden = isMonth;
  (isMonth ? noteMonthInput : noteCommonInput).focus();
}

noteButton.addEventListener("click", () => {
  const notes = getNotes();
  noteTabMonth.textContent = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;
  noteMonthInput.value = notes.months[currentMonthKey()] || "";
  noteCommonInput.value = notes.common;
  noteOverlay.classList.add("show");
  showNoteTab("month");
});

noteTabMonth.addEventListener("click", () => showNoteTab("month"));
noteTabCommon.addEventListener("click", () => showNoteTab("common"));
document.getElementById("noteCancel").addEventListener("click", () => noteOverlay.classList.remove("show"));

document.getElementById("noteSave").addEventListener("click", () => {
  const notes = getNotes();
  const key = currentMonthKey();
  const monthText = noteMonthInput.value.trim();

  if (monthText) notes.months[key] = monthText;
  else delete notes.months[key];
  notes.common = noteCommonInput.value.trim();

  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  noteOverlay.classList.remove("show");
  updateNoteIndicator();
});

noteOverlay.addEventListener("click", (event) => {
  if (event.target === noteOverlay) noteOverlay.classList.remove("show");
});

// 다크모드 (설정 모달 토글, localStorage 저장)
const THEME_KEY = "baby-food-theme";
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute("aria-checked", String(theme === "dark"));
}

applyTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

ensureDefaultAliases();
setIngredientCard(desktopQuery.matches);
updateStartInfo();
renderIngredients();
renderCalendar();
