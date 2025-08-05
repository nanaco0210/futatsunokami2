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

function showAbsorbAnimation(text) {
  const container = document.getElementById('absorbAnimationContainer');
  const anim = document.createElement('div');
  anim.className = 'absorb-text';
  anim.textContent = text.length > 30 ? text.slice(0, 30) + '…' : text;

  const rect = memoInput.getBoundingClientRect();
  anim.style.left = `${rect.left + rect.width / 2 - 60}px`;
  anim.style.top = `${rect.top + window.scrollY + rect.height / 2 - 10}px`;

  container.appendChild(anim);
  setTimeout(() => {
    container.removeChild(anim);
  }, 1000);
}

// 📌 記憶する（テキスト・タグ・日付）
saveButton.addEventListener('click', () => {
  const text = memoInput.value.trim();
  const tags = tagInput.value.trim().split(/\s+/).filter(tag => tag.startsWith('#'));
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/');

  if (text.length > 0) {
    memoryStorage.push({ text, tags, date: dateStr });
    localStorage.setItem('memoryStorage', JSON.stringify(memoryStorage));
    showAbsorbAnimation(text);
    memoInput.value = '';
    tagInput.value = '';
    console.log('記憶されました：', { text, tags, date: dateStr });
  }
});

// 🔍 想起する（検索語 + タグ + 日付）＋折りたたみ＋確認＋もっと見る＋閉じる
recallButton.addEventListener('click', () => {
  const query = searchInput.value.trim();
  const tagQuery = searchTagInput.value.trim().split(/\s+/).filter(tag => tag.startsWith('#'));
  const dateQuery = searchDateInput.value.trim();
  searchResult.innerHTML = '';

  // ✕ 閉じるボタン
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ 想起結果を閉じる';
  closeBtn.className = 'clear-btn';
  closeBtn.addEventListener('click', () => {
    searchResult.innerHTML = '';
  });
  searchResult.appendChild(closeBtn);

  const results = memoryStorage.filter(item => {
    const memoText = typeof item === 'string' ? item : item.text;
    const memoTags = typeof item === 'string' ? [] : item.tags || [];
    const memoDate = typeof item === 'string' ? '' : item.date || '';

    const matchText = query === '' || memoText.includes(query);
    const matchTags = tagQuery.length === 0 || tagQuery.every(t => memoTags.includes(t));
    const matchDate = matchDateFilter(memoDate, dateQuery);

    return matchText && matchTags && matchDate;
  });

  let shownCount = 0;
  const maxInitial = 10;

  function renderEntries(count) {
    const toShow = results.slice(shownCount, shownCount + count);
    toShow.forEach(item => {
      const memoText = typeof item === 'string' ? item : item.text;
      const memoDate = typeof item === 'string' ? null : item.date;

      const wrapper = document.createElement('div');
      wrapper.className = 'memory-entry';

      const lines = memoText.split(/\r?\n/);

      if (lines.length > 3) {
        const shortText = lines.slice(0, 3).join('\n');
        const fullHTML = escapeHTML(memoText).replace(/\n/g, '<br>').replace(/ {2}/g, '&nbsp;&nbsp;');
        const shortHTML = escapeHTML(shortText).replace(/\n/g, '<br>').replace(/ {2}/g, '&nbsp;&nbsp;');

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';
        contentWrapper.innerHTML = shortHTML;

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '▼もっと見る';
        toggleBtn.className = 'toggle-btn';

        let expanded = false;
        toggleBtn.addEventListener('click', () => {
          expanded = !expanded;
          contentWrapper.innerHTML = expanded ? fullHTML : shortHTML;
          toggleBtn.textContent = expanded ? '▲閉じる' : '▼もっと見る';
        });

        wrapper.appendChild(contentWrapper);
        wrapper.appendChild(toggleBtn);
      } else {
        const textEl = document.createElement('p');
        textEl.innerHTML = escapeHTML(memoText).replace(/\n/g, '<br>').replace(/ {2}/g, '&nbsp;&nbsp;');
        wrapper.appendChild(textEl);
      }

      if (memoDate) {
        const dateEl = document.createElement('span');
        dateEl.className = 'date-display';
        dateEl.textContent = memoDate;
        wrapper.appendChild(dateEl);
      }

      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.className = 'delete-btn';
      delBtn.addEventListener('click', () => {
        const confirmed = confirm('この記憶は削除されます。本当に削除してよろしいですか？');
        if (!confirmed) return;

        memoryStorage = memoryStorage.filter(m => {
          if (typeof m === 'string') {
            return m !== memoText;
          } else {
            return !(m.text === memoText && m.date === memoDate);
          }
        });
        localStorage.setItem('memoryStorage', JSON.stringify(memoryStorage));
        wrapper.remove();
      });

      wrapper.appendChild(delBtn);
      searchResult.appendChild(wrapper);
    });

    shownCount += count;

    const existingMoreBtn = document.getElementById('moreButton');
    if (existingMoreBtn) existingMoreBtn.remove();

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

// 📅 日付検索の補助関数
function matchDateFilter(entryDate, input) {
  if (!input) return true;
  const rangeMatch = input.match(/^(\d{4}\/\d{2}\/\d{2})-(\d{4}\/\d{2}\/\d{2})$/);
  if (rangeMatch) {
    const from = rangeMatch[1];
    const to = rangeMatch[2];
    return entryDate >= from && entryDate <= to;
  } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(input)) {
    return entryDate === input;
  }
  return true;
}

// 🔐 HTMLエスケープ
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 🔄 自動クリア機能
function setupAutoClear() {
  [searchInput, searchTagInput, searchDateInput].forEach(input => {
    input.addEventListener('input', () => {
      const q = searchInput.value.trim();
      const t = searchTagInput.value.trim();
      const d = searchDateInput.value.trim();
      if (q === '' && t === '' && d === '') {
        searchResult.innerHTML = '';
      }
    });
  });
}
setupAutoClear();
