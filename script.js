// দোতলার বারান্দা — Google Sheet থেকে লেখা ও ছবি দেখানোর স্ক্রিপ্ট

document.querySelector('.menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.nav')?.classList.toggle('open');
});

document.getElementById('themeToggle')?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
});

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/1YCfoVNaRcGLA_n6Om9eXLoLmdvVQbh-T6Javx306ZTM/gviz/tq?tqx=out:csv';

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];

    if (c === '"' && quote && n === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      quote = !quote;
    } else if (c === ',' && !quote) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quote) {
      if (c === '\r' && n === '\n') i++;
      row.push(cell);
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some(x => x.trim() !== '')) rows.push(row);
  }

  return rows;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Google Drive-এর বিভিন্ন ধরনের লিংককে ছবি দেখানোর উপযোগী লিংকে বদলায়
function driveImageURL(url) {
  if (!url) return '';

  url = String(url).trim();

  // Google Drive file ID বের করা
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!match) match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);

  if (match && match[1]) {
    const id = match[1];
    // এই URL-টি সাধারণত Google Drive-এর ছবিকে সরাসরি দেখায়
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
  }

  if (/^https?:\/\//i.test(url)) return url;
  return '';
}

function getImageURLs(value) {
  if (!value) return [];
  const text = String(value).trim();
  const links = text.match(/https?:\/\/[^\s,;]+/g) || [];
  const candidates = links.length ? links : [text];
  return [...new Set(candidates.map(raw => {
    const url = raw.replace(/[)\]}"'.,]+$/g, '');
    return driveImageURL(url);
  }).filter(Boolean))];
}

async function loadPublishedPosts() {
  const box = document.getElementById('sheet-posts');
  if (!box) return;

  try {
    const response = await fetch(SHEET_CSV, { cache: 'no-store' });
    if (!response.ok) throw new Error('CSV load failed');

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      box.innerHTML = '<p>এখনও কোনো লেখা জমা পড়েনি।</p>';
      return;
    }

    const headers = rows[0].map(x => x.trim());
    const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[\s\u200b\ufeff\r\n]+/g, '').replace(/[—–_\-\/]/g, ''));

    const findColumn = (names) => {
      const wanted = names.map(x => x.toLowerCase().replace(/[\s\u200b\ufeff\r\n]+/g, '').replace(/[—–_\-\/]/g, ''));
      const index = normalizedHeaders.findIndex(h => wanted.includes(h));
      return index >= 0 ? index : null;
    };

    const titleI = findColumn(['লেখার শিরোনাম', 'Title', 'শিরোনাম']);
    const authorI = findColumn(['লেখকের নাম', 'Author', 'লেখক']);
    const catI = findColumn(['লেখার বিভাগ', 'Category', 'বিভাগ']);
    const contentI = findColumn(['আপনার লেখা এখানে লিখুন', 'Content', 'লেখা']);
    const imageI = findColumn([
      'ছবি বা ফাইল থাকলে দিন',
      'ছবি/ফাইল',
      'ছবি',
      'Image',
      'Photo',
      'File upload',
      'ছবির লিংক'
    ]);
    const statusI = findColumn(['Status', 'status', 'প্রকাশনা']);

    const published = rows.slice(1).filter(row => {
      if (statusI === null) return false;
      const status = String(row[statusI] || '').trim().toLowerCase();
      return ['approved', 'অনুমোদিত', 'প্রকাশিত', 'published'].includes(status);
    });

    if (!published.length) {
      box.innerHTML = '<p>এখনও কোনো লেখা প্রকাশের জন্য অনুমোদিত হয়নি।</p>';
      return;
    }

    box.innerHTML = published.reverse().map(row => {
      const title = escapeHTML(row[titleI] || 'শিরোনামহীন লেখা');
      const author = escapeHTML(row[authorI] || 'পরিবারের সদস্য');
      const cat = escapeHTML(row[catI] || 'লেখা');
      const contentRaw = String(row[contentI] || '');
      const content = escapeHTML(contentRaw).replace(/\n/g, '<br>');
      const preview = content;
      const imageURLs = imageI !== null ? getImageURLs(row[imageI]) : [];

      const imageHTML = imageURLs.length
        ? `<div class="sheet-post-images">${imageURLs.map(url => {
            const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            const id = idMatch ? idMatch[1] : '';
            const fallback1 = id ? `https://lh3.googleusercontent.com/d/${id}=w1600` : '';
            const fallback2 = id ? `https://drive.google.com/uc?export=view&id=${id}` : '';
            return `
            <a href="${escapeHTML(url)}" target="_blank" rel="noopener">
              <img src="${escapeHTML(url)}" alt="${title}" loading="lazy"
                   style="max-width:100%;height:auto;border-radius:12px;margin:12px 0;display:block;"
                   ${fallback1 ? `data-fallback1="${escapeHTML(fallback1)}"` : ''}
                   ${fallback2 ? `data-fallback2="${escapeHTML(fallback2)}"` : ''}
                   onerror="if(this.dataset.fallback1){this.src=this.dataset.fallback1;this.dataset.fallback1='';}else if(this.dataset.fallback2){this.src=this.dataset.fallback2;this.dataset.fallback2='';}else{this.alt='ছবিটি Google Drive থেকে দেখা যাচ্ছে না';}">
            </a>`;
          }).join('')}</div>`
        : '';

      return `
        <article class="article-row" style="display:block;padding:22px">
          <div>
            <em>${cat}</em>
            <h3>${title}</h3>
            <small>লিখেছেন — ${author}</small>
            ${imageHTML}
            <p>${preview}</p>
          </div>
        </article>`;
    }).join('');

  } catch (error) {
    console.error('Google Sheet error:', error);
    box.innerHTML = '<p>লেখা লোড করা যাচ্ছে না। Sheet-এর Publish to web সেটিংস পরীক্ষা করুন।</p>';
  }
}

loadPublishedPosts();
