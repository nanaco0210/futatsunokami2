// script2.js（完全版）
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

function normalizeInput(str) {
  return str
    .replace(/＃/g, '#')
    .replace(/[－–ー]/g, '-')
    .replace(/[．・／]/g, '/')
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .trim();
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

function getFormattedDateTime() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

saveButton.addEventListener('click', () => {
  const text = memoInput.value.trim();
  const tags = normalizeInput(tagInput.value).split(/\s+/).filter(tag => tag.startsWith('#'));
  const date = getFormattedDateTime();
  if (text.length > 0) {
    memoryStorage.push({ text, tags, date });
    localStorage.setItem('memoryStorage', JSON.stringify(memoryStorage));
    showAbsorbAnimation(text);
    memoInput.value = '';
    tagInput.value = '';
  }
});

recallButton.addEventListener('click', () => {
  const query = searchInput.value.trim();
  const tagQuery = normalizeInput(searchTagInput.value).split(/\s+/).filter(tag => tag.startsWith('#'));
  const dateQuery = normalizeInput(searchDateInput.value);
  searchResult.innerHTML = '';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ 想起結果を閉じる';
  closeBtn.className = 'clear-btn';
  closeBtn.addEventListener('click', () => {
    searchResult.innerHTML = '';
  });
  searchResult.appendChild(closeBtn);

  let results = memoryStorage.filter(item => {
    const memoText = item.text || '';
    const memoTags = item.tags || [];
    const memoDate = item.date || '';

    const matchText = query === '' || memoText.includes(query);
    const matchTags = tagQuery.length === 0 || tagQuery.every(t => memoTags.includes(t));
    const matchDate = matchDateFilter(memoDate, dateQuery);

    return matchText && matchTags && matchDate;
  });

  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  let shownCount = 0;
  const maxInitial = 10;

  function renderEntries(count) {
    const toShow = results.slice(shownCount, shownCount + count);
    toShow.forEach(item => {
      const memoText = item.text;
      const memoDate = item.date;

      const wrapper = document.createElement('div');
      wrapper.className = 'memory-entry';

      const displayText = escapeHTML(memoText).replace(/\n/g, '<br>').replace(/ {2}/g, '&nbsp;&nbsp;');

      const preview = document.createElement('div');
      preview.className = 'content-wrapper';
      preview.innerHTML = displayText;

      document.body.appendChild(preview);
      const height = preview.scrollHeight;
      document.body.removeChild(preview);

      const lineThreshold = 3;
      const lineHeight = 18; // px（CSSと合わせる）

      if (height > lineHeight * lineThreshold || memoText.length > 80) {
        preview.style.maxHeight = `${lineHeight * lineThreshold}px`;
        preview.style.overflow = 'hidden';

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '▼もっと見る';
        toggleBtn.className = 'toggle-btn';

        let expanded = false;
        toggleBtn.addEventListener('click', () => {
          expanded = !expanded;
          preview.style.maxHeight = expanded ? 'none' : `${lineHeight * lineThreshold}px`;
          preview.style.overflow = expanded ? 'visible' : 'hidden';
          toggleBtn.textContent = expanded ? '▲閉じる' : '▼もっと見る';
        });

        wrapper.appendChild(preview);
        wrapper.appendChild(toggleBtn);
      } else {
        const p = document.createElement('p');
        p.className = 'memory-text';
        p.innerHTML = displayText;
        wrapper.appendChild(p);
      }

      if (memoDate) {
        const dateEl = document.createElement('span');
        dateEl.className = 'date-display';
        dateEl.textContent = memoDate.slice(0, 16);
        wrapper.appendChild(dateEl);
      }

      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.className = 'delete-btn';
      delBtn.addEventListener('click', () => {
        const confirmed = confirm('この記憶は削除されます。本当に削除してよろしいですか？');
        if (!confirmed) return;
        memoryStorage = memoryStorage.filter(m => m.text !== memoText || m.date !== memoDate);
        localStorage.setItem('memoryStorage', JSON.stringify(memoryStorage));
        wrapper.remove();
      });

      wrapper.appendChild(delBtn);
      searchResult.insertBefore(wrapper, searchResult.querySelector('#moreButton') || null);
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

function matchDateFilter(entryDate, input) {
  if (!input) return true;
  const entryDay = entryDate.split(' ')[0];
  const rangeMatch = input.match(/^(\d{4}\/\d{2}\/\d{2})-(\d{4}\/\d{2}\/\d{2})$/);
  if (rangeMatch) {
    const from = rangeMatch[1];
    const to = rangeMatch[2];
    return entryDay >= from && entryDay <= to;
  } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(input)) {
    return entryDay === input;
  }
  return true;
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

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
