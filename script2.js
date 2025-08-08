const memoInput = document.getElementById('memoInput');
const searchInput = document.getElementById('searchInput');
const tagInput = document.getElementById('tagInput');
const searchTagInput = document.getElementById('searchTagInput');
const searchDateInput = document.getElementById('searchDateInput');
const searchResult = document.getElementById('searchResult');
const saveButton = document.getElementById('saveButton');
const recallButton = document.getElementById('recallButton');

let memoryStorage = [];

const savedMemory = localStorage.getItem('memoryStorage');
if (savedMemory) {
  try {
    memoryStorage = JSON.parse(savedMemory);
  } catch (e) {
    console.error('記憶の読み込みエラー:', e);
    memoryStorage = [];
  }
}

// 全角→半角などの正規化
function normalizeInput(str) {
  return str
    .replace(/＃/g, '#')
    .replace(/[－–ー]/g, '-')
    .replace(/[．・／]/g, '/')
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .trim();
}

// 吸い込みアニメ
function showAbsorbAnimation(text) {
  const container = document.getElementById('absorbAnimationContainer');
  const anim = document.createElement('div');
  anim.className = 'absorb-text';
  anim.textContent = text.length > 30 ? text.slice(0, 30) + '…' : text;

  const rect = memoInput.getBoundingClientRect();
  anim.style.left = `${rect.left + rect.width / 2 - 60}px`;
  anim.style.top = `${rect.top + window.scrollY + rect.height / 2 - 10}px`;

  container.appendChild(anim);
  setTimeout(() => container.removeChild(anim), 1000);
}

// 日時："YYYY/MM/DD HH:mm:ss"
function getFormattedDateTime() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// 記憶する
saveButton.addEventListener('click', () => {
  const text = memoInput.value.trim();
  const tags = normalizeInput(tagInput.value).split(/\s+/).filter(t => t.startsWith('#'));
  const date = getFormattedDateTime();
  if (!text) return;

  memoryStorage.push({ text, tags, date });
  localStorage.setItem('memoryStorage', JSON.stringify(memoryStorage));
  showAbsorbAnimation(text);
  memoInput.value = '';
  tagInput.value = '';
});

// 想起する
recallButton.addEventListener('click', () => {
  const query = searchInput.value.trim();
  const tagQuery = normalizeInput(searchTagInput.value).split(/\s+/).filter(t => t.startsWith('#'));
  const dateQuery = normalizeInput(searchDateInput.value);

  searchResult.innerHTML = '';

  // 閉じる
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ 想起結果を閉じる';
  closeBtn.className = 'clear-btn';
  closeBtn.addEventListener('click', () => searchResult.innerHTML = '');
  searchResult.appendChild(closeBtn);

  // フィルタ
  let results = memoryStorage.filter(item => {
    const memoText = item.text || '';
    const memoTags = item.tags || [];
    const memoDate = item.date || '';

    const okText = query === '' || memoText.includes(query);
    const okTags = tagQuery.length === 0 || tagQuery.every(t => memoTags.includes(t));
    const okDate = matchDateFilter(memoDate, dateQuery);
    return okText && okTags && okDate;
  });

  // 新しい日時順
  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  let shownCount = 0;
  const maxInitial = 10;

  function renderEntries(count) {
    const toShow = results.slice(shownCount, shownCount + count);

    toShow.forEach(item => {
      const wrapper = document.createElement('div');
      wrapper.className = 'memory-entry';

      // テキスト（HTML整形）
      const display = escapeHTML(item.text)
        .replace(/\n/g, '<br>')
        .replace(/ {2}/g, '&nbsp;&nbsp;');

      // まずは常に“折りたたみ状態”で挿入（line-clamp）
      const preview = document.createElement('div');
      preview.className = 'content-wrapper clamp-3';
      preview.innerHTML = display;
      wrapper.appendChild(preview);

      // 実DOMで溢れているか判定（スマホでも正確）
      const needsToggle = preview.scrollHeight > preview.clientHeight + 1;
      if (needsToggle) {
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '▼もっと見る';
        toggleBtn.className = 'toggle-btn';
        let expanded = false;
        toggleBtn.addEventListener('click', () => {
          expanded = !expanded;
          preview.classList.toggle('expanded', expanded);
          if (expanded) {
            preview.classList.remove('clamp-3');
            toggleBtn.textContent = '▲閉じる';
          } else {
            preview.classList.add('clamp-3');
            toggleBtn.textContent = '▼もっと見る';
          }
        });
        wrapper.appendChild(toggleBtn);
      } else {
        // 3行以内ならクランプ解除＆ボタン不要
        preview.classList.remove('clamp-3');
      }

      // 日付表示（分まで）
      if (item.date) {
        const dateEl = document.createElement('span');
        dateEl.className = 'date-display';
        dateEl.textContent = item.date.slice(0, 16); // "YYYY/MM/DD HH:mm"
        wrapper.appendChild(dateEl);
      }

      // 削除
      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.className = 'delete-btn';
      delBtn.addEventListener('click', () => {
        const ok = confirm('この記憶は削除されます。本当に削除してよろしいですか？');
        if (!ok) return;
        memoryStorage = memoryStorage.filter(m => !(m.text === item.text && m.date === item.date));
        localStorage.setItem('memoryStorage', JSON.stringify(memoryStorage));
        wrapper.remove();
      });
      wrapper.appendChild(delBtn);

      // 新しい順で先頭に（Moreボタンの手前）
      searchResult.insertBefore(wrapper, searchResult.querySelector('#moreButton') || null);
    });

    shownCount += count;

    const existingMore = document.getElementById('moreButton');
    if (existingMore) existingMore.remove();

    if (shownCount < results.length) {
      const moreBtn = document.createElement('button');
      moreBtn.id = 'moreButton';
      moreBtn.textContent = `残り${results.length - shownCount}件 → もっと見る`;
      moreBtn.className = 'more-btn';
      moreBtn.addEventListener('click', () => renderEntries(10));
      searchResult.appendChild(moreBtn);
    }
  }

  renderEntries(maxInitial);
});

// 日付検索：単日 or 範囲（YYYY/MM/DD[-YYYY/MM/DD]）
function matchDateFilter(entryDateTime, inputRaw) {
  if (!inputRaw) return true;
  const input = normalizeInput(inputRaw);

  const entryDay = (entryDateTime || '').split(' ')[0]; // "YYYY/MM/DD"

  const m = input.match(/^(\d{4}\/\d{2}\/\d{2})(?:-(\d{4}\/\d{2}\/\d{2}))?$/);
  if (!m) return true;

  const from = m[1];
  const to = m[2];
  if (!to) {
    return entryDay === from;
  }
  return entryDay >= from && entryDay <= to;
}

// HTMLエスケープ
function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// 入力が全部空なら結果を消す
function setupAutoClear() {
  [searchInput, searchTagInput, searchDateInput].forEach(inp => {
    inp.addEventListener('input', () => {
      const q = searchInput.value.trim();
      const t = searchTagInput.value.trim();
      const d = searchDateInput.value.trim();
      if (q === '' && t === '' && d === '') searchResult.innerHTML = '';
    });
  });
}
setupAutoClear();
