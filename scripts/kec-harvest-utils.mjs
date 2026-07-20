/**
 * Helpers for harvesting downloadable files from Kenya Education Cloud (KEC) LMS.
 */

export const LMS_BASE = 'https://lms.kec.ac.ke';
export const EBOOKS_BASE = `${LMS_BASE}/ebooks`;

export const ROOT_CATEGORIES = {
  primary: { id: 66, label: 'Primary Education' },
  junior: { id: 67, label: 'Junior School' },
};

export const GRADE_CATEGORY_IDS = {
  74: 'grade-1',
  80: 'grade-2',
  90: 'grade-3',
  92: 'grade-4',
  94: 'grade-5',
  151: 'grade-6',
  102: 'grade-7',
  107: 'grade-8',
  653: 'grade-9',
};

export const EBOOK_CATEGORY_BY_GRADE = {
  74: 78,
  80: 319,
  90: 320,
};

const SKIP_EXTENSIONS = /\.(mp3|mp4|wav|webm|m4a|ogg|avi|mov|wmv|flv|mkv)(\?|$)/i;
const DOC_EXTENSIONS = /\.(pdf|epub|doc|docx|xls|xlsx|ppt|pptx|zip)(\?|$)/i;

export function absolutize(url, base = LMS_BASE) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url.split('#')[0];
  if (url.startsWith('//')) return `https:${url.split('#')[0]}`;
  if (url.startsWith('/')) return `${LMS_BASE}${url.split('#')[0]}`;
  return new URL(url, `${base.replace(/\/$/, '')}/`).href.split('#')[0];
}

export function isDownloadableFile(url) {
  if (!url) return false;
  if (SKIP_EXTENSIONS.test(url)) return false;
  if (url.includes('/pluginfile.php/')) return DOC_EXTENSIONS.test(url) || /\.pdf/i.test(url);
  if (url.includes('/ebooks/')) return DOC_EXTENSIONS.test(url);
  if (url.includes('/mod/resource/')) return true;
  if (url.includes('/mod/folder/')) return true;
  if (url.includes('/mod/book/')) return true;
  return DOC_EXTENSIONS.test(url);
}

export function inferGradeFromText(...parts) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  // Underscores are word chars, so ENGLISH_GRADE_4 needs a non-\b pattern.
  const numeric = text.match(/grade[_\s-]*([1-9]|1[0-2])(?![0-9])/i);
  if (numeric) return `grade-${numeric[1]}`;
  const word = text.match(/grade[_\s-]*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?![a-z])/i);
  if (word) {
    const map = {
      one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
      seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
    };
    return `grade-${map[word[1].toLowerCase()]}`;
  }
  const gredi = text.match(/\bgredi\s*la\s*([1-9])\b/i);
  if (gredi) return `grade-${gredi[1]}`;
  if (/\bform\s*([1-4])\b/i.test(text)) return `form-${text.match(/\bform\s*([1-4])\b/i)[1]}`;
  if (text.includes('pre-primary') || text.includes('pp1')) return 'pre-primary';
  if (text.includes('pp2')) return 'pp-2';
  return null;
}

export function inferSubjectFromText(...parts) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  const subjects = [
    ['mathematics', 'mathematics'],
    ['maths', 'mathematics'],
    ['english', 'english'],
    ['kiswahili', 'kiswahili'],
    ['science and technology', 'science-and-technology'],
    ['science & technology', 'science-and-technology'],
    ['science', 'science-and-technology'],
    ['social studies', 'social-studies'],
    ['agriculture', 'agriculture'],
    ['cre', 'cre'],
    ['ire', 'ire'],
    ['h.r.e', 'hre'],
    ['hygiene', 'hygiene-and-nutrition'],
    ['home science', 'home-science'],
    ['creative arts', 'creative-arts'],
    ['environmental', 'environmental-activities'],
    ['music', 'music'],
    ['physical education', 'physical-education'],
    ['kenya sign language', 'kenya-sign-language'],
  ];
  for (const [needle, slug] of subjects) {
    if (text.includes(needle)) return slug;
  }
  return null;
}

export function extractLinksFromHtml(html, pageUrl) {
  const links = new Set();

  for (const match of html.matchAll(/href="([^"]+)"/gi)) {
    links.add(absolutize(match[1], pageUrl));
  }
  for (const match of html.matchAll(/src="([^"]+)"/gi)) {
    links.add(absolutize(match[1], pageUrl));
  }
  for (const match of html.matchAll(/(https?:\/\/lms\.kec\.ac\.ke\/(?:pluginfile\.php\/|ebooks\/)[^\s"'<>]+)/gi)) {
    links.add(match[1].split('#')[0]);
  }

  return [...links].filter(Boolean);
}

export function extractCategoryLinks(html) {
  const categories = [];
  const courseLinks = [];
  const regex = /href="(https:\/\/lms\.kec\.ac\.ke\/course\/(?:index\.php\?categoryid=(\d+)|view\.php\?id=(\d+)))">([^<]+)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const label = match[4].trim();
    if (match[2]) categories.push({ id: Number(match[2]), label, url: match[1] });
    if (match[3]) courseLinks.push({ id: Number(match[3]), label, url: match[1] });
  }
  return { categories, courseLinks };
}

export function extractDirectoryLinks(html, currentUrl) {
  const entries = [];
  const regex = /href="([^"]+)"/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    if (href === '/' || href === '../' || href.includes('Parent Directory')) continue;
    const url = absolutize(href, currentUrl);
    if (!url.startsWith(EBOOKS_BASE)) continue;
    entries.push(url);
  }
  return entries;
}

export function buildMirrorRecord({
  url,
  title = null,
  grade = null,
  subject = null,
  sourceType,
  sourceUrl = null,
  courseId = null,
  categoryId = null,
}) {
  const filename = decodeURIComponent(url.split('/').pop().split('?')[0]);
  return {
    url,
    title: title || filename,
    filename,
    grade,
    subject,
    sourceType,
    sourceUrl,
    courseId,
    categoryId,
    downloadable: true,
  };
}
