import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const config = JSON.parse(await fs.readFile(path.join(cwd, 'config/site.json'), 'utf8'));
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || path.basename(cwd);
const basePath = (config.siteBasePath || `/${repoName}`).replace(/\/$/, '');
const sourceDir = path.resolve(cwd, process.env.NOTES_DRAFTS_PUBLISHED_DIR || config.defaultSourceDir || `../notes-drafts/${repoName}/published`);
const sharedSourceDir = path.resolve(cwd, process.env.NOTES_DRAFTS_SHARED_ASSETS_DIR || config.defaultSharedAssetsDir || `../notes-drafts/${repoName}/shared-assets`);
const contentRoot = path.resolve(cwd, config.contentRoot || 'content');
const postsRoot = path.resolve(cwd, config.postsRoot || 'content/posts');
const pagesRoot = path.resolve(cwd, config.pagesRoot || 'content/pages');
const sharedAssetsRoot = path.resolve(cwd, config.sharedAssetsRoot || 'content/shared-assets');
const templateName = process.env.SITE_TEMPLATE || config.activeTemplate || 'default';

const pageTemplate = await fs.readFile(path.join(cwd, 'templates', templateName, 'layouts', 'page.html'), 'utf8');
const postTemplate = await fs.readFile(path.join(cwd, 'templates', templateName, 'layouts', 'post.html'), 'utf8');

await ensureDir(postsRoot);
await ensureDir(pagesRoot);
await ensureDir(sharedAssetsRoot);
await clearGeneratedDirectory(postsRoot);
await clearGeneratedDirectory(sharedAssetsRoot);

const articleDirs = await listArticleDirectories(sourceDir);
const rawArticles = [];

for (const dirent of articleDirs) {
  const articleDir = path.join(sourceDir, dirent.name);
  const markdownPath = path.join(articleDir, 'index.md');
  const markdown = await fs.readFile(markdownPath, 'utf8');
  const parsed = parseFrontMatter(markdown);
  const data = parsed.data;
  const slug = (data.slug || dirent.name || '').trim();

  rawArticles.push({
    slug,
    dirName: dirent.name,
    articleDir,
    markdownBody: parsed.body,
    data: {
      title: data.title || slug,
      slug,
      site: data.site || repoName,
      status: data.status || 'published',
      date: data.date || '',
      updated: data.updated || data.date || '',
      summary: data.summary || '',
      tags: Array.isArray(data.tags) ? data.tags : []
    }
  });
}

const errors = [];
const slugMap = new Map();

for (const article of rawArticles) {
  if (!article.slug) {
    errors.push('slug が空の記事があります。');
    continue;
  }
  if (article.slug !== article.dirName) {
    errors.push(`slug とディレクトリ名が一致しません: ${article.dirName} / ${article.slug}`);
  }
  if (slugMap.has(article.slug)) {
    errors.push(`slug が重複しています: ${article.slug}`);
  }
  slugMap.set(article.slug, article);
}

for (const article of rawArticles) {
  const articleHtml = renderMarkdown(article.markdownBody, {
    slugMap,
    currentSlug: article.slug,
    basePath,
    errors
  });

  const postHtml = applyTemplate(postTemplate, {
    title: article.data.title,
    date: article.data.date,
    updated: article.data.updated,
    summary: article.data.summary,
    content: articleHtml,
    basePath
  });

  const pageHtml = applyTemplate(pageTemplate, {
    title: article.data.title,
    summary: article.data.summary,
    content: postHtml,
    basePath
  });

  const outputDir = path.join(postsRoot, article.slug);
  await ensureDir(outputDir);
  await fs.writeFile(path.join(outputDir, 'index.html'), pageHtml, 'utf8');

  const assetsSourceDir = path.join(article.articleDir, 'assets');
  const assetsOutputDir = path.join(outputDir, 'assets');
  if (await exists(assetsSourceDir)) {
    await copyDirectory(assetsSourceDir, assetsOutputDir);
  }
}

if (await exists(sharedSourceDir)) {
  await copyDirectory(sharedSourceDir, sharedAssetsRoot);
}

if (errors.length > 0) {
  throw new Error(`Build failed:\n- ${errors.join('\n- ')}`);
}

const sortedArticles = [...rawArticles].sort((a, b) => `${b.data.date}`.localeCompare(`${a.data.date}`));
const homeContent = [
  '<section>',
  `  <h1>${escapeHtml(config.siteName || repoName)}</h1>`,
  `  <p>${escapeHtml(config.siteDescription || '')}</p>`,
  '</section>',
  '<section>',
  '  <h2>Posts</h2>',
  '  <ul class="post-list">',
  ...sortedArticles.map((article) => {
    const summary = article.data.summary ? `<p>${escapeHtml(article.data.summary)}</p>` : '';
    const date = article.data.date ? `<p class="article-meta">${escapeHtml(article.data.date)}</p>` : '';
    return `    <li><a href="${basePath}/posts/${article.slug}/">${escapeHtml(article.data.title)}</a>${date}${summary}</li>`;
  }),
  '  </ul>',
  '</section>'
].join('\n');

const homeHtml = applyTemplate(pageTemplate, {
  title: config.siteName || repoName,
  summary: config.siteDescription || '',
  content: homeContent,
  basePath
});

await fs.writeFile(path.join(contentRoot, 'index.html'), homeHtml, 'utf8');
await fs.writeFile(path.join(pagesRoot, 'index.html'), homeHtml, 'utf8');

console.log(`Built ${rawArticles.length} article(s) from ${sourceDir}`);

function parseFrontMatter(raw) {
  if (!raw.startsWith('---\n')) {
    return { data: {}, body: raw };
  }

  const endMarker = '\n---\n';
  const endIndex = raw.indexOf(endMarker, 4);
  if (endIndex === -1) {
    return { data: {}, body: raw };
  }

  const frontMatterText = raw.slice(4, endIndex);
  const body = raw.slice(endIndex + endMarker.length);
  const data = {};
  let currentArrayKey = null;

  for (const line of frontMatterText.split(/\r?\n/)) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      if (value === '') {
        data[key] = [];
        currentArrayKey = key;
      } else {
        data[key] = stripQuotes(value.trim());
        currentArrayKey = null;
      }
      continue;
    }

    const itemMatch = line.match(/^\s*-\s+(.*)$/);
    if (itemMatch && currentArrayKey) {
      data[currentArrayKey].push(stripQuotes(itemMatch[1].trim()));
      continue;
    }

    currentArrayKey = null;
  }

  return { data, body };
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '');
}

function renderMarkdown(markdown, context) {
  const html = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let paragraph = [];
  let listItems = [];
  let listType = null;
  let quoteLines = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeLanguage = '';

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(' '), context)}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0 || !listType) return;
    html.push(`<${listType}>`);
    for (const item of listItems) {
      html.push(`<li>${renderInline(item, context)}</li>`);
    }
    html.push(`</${listType}>`);
    listItems = [];
    listType = null;
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    html.push(`<blockquote><p>${renderInline(quoteLines.join('<br>'), context)}</p></blockquote>`);
    quoteLines = [];
  };

  const flushCode = () => {
    const languageClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : '';
    html.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    codeLines = [];
    codeLanguage = '';
  };

  for (const rawLine of lines) {
    const line = rawLine;

    if (inCodeBlock) {
      if (line.startsWith('```')) {
        inCodeBlock = false;
        flushCode();
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (line.startsWith('```')) {
      flushParagraph();
      flushList();
      flushQuote();
      inCodeBlock = true;
      codeLanguage = line.slice(3).trim();
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2], context)}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
      flushQuote();
      html.push('<hr>');
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      continue;
    }

    flushQuote();
    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushQuote();
  if (inCodeBlock) flushCode();

  return html.join('\n');
}

function renderInline(text, context) {
  let result = escapeHtml(text);

  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    return `<img src="${resolveAssetUrl(url, context)}" alt="${escapeHtml(alt)}">`;
  });

  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    return `<a href="${resolveAssetUrl(url, context)}">${label}</a>`;
  });

  result = result.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, slug, label) => {
    const resolved = resolveSlug(slug.trim(), context);
    return `<a href="${resolved}">${escapeHtml(label.trim())}</a>`;
  });

  result = result.replace(/\[\[([^\]]+)\]\]/g, (_, slug) => {
    const cleanSlug = slug.trim();
    const target = context.slugMap.get(cleanSlug);
    const label = target?.data?.title || cleanSlug;
    const resolved = resolveSlug(cleanSlug, context);
    return `<a href="${resolved}">${escapeHtml(label)}</a>`;
  });

  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return result;
}

function resolveSlug(slug, context) {
  if (!context.slugMap.has(slug)) {
    context.errors.push(`未解決の内部リンクがあります: ${context.currentSlug} -> ${slug}`);
  }
  return `${context.basePath}/posts/${slug}/`;
}

function resolveAssetUrl(url, context) {
  if (/^(https?:)?\/\//.test(url)) return url;
  if (url.startsWith('./assets/')) {
    return `${context.basePath}/posts/${context.currentSlug}/assets/${url.slice('./assets/'.length)}`;
  }
  if (url.startsWith('assets/')) {
    return `${context.basePath}/posts/${context.currentSlug}/assets/${url.slice('assets/'.length)}`;
  }
  if (url.startsWith('../shared-assets/')) {
    return `${context.basePath}/shared-assets/${url.slice('../shared-assets/'.length)}`;
  }
  if (url.startsWith('./shared-assets/')) {
    return `${context.basePath}/shared-assets/${url.slice('./shared-assets/'.length)}`;
  }
  if (url.startsWith('shared-assets/')) {
    return `${context.basePath}/shared-assets/${url.slice('shared-assets/'.length)}`;
  }
  return url;
}

function applyTemplate(template, data) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return data[key] ?? '';
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function listArticleDirectories(dir) {
  if (!(await exists(dir))) {
    return [];
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));
}

async function clearGeneratedDirectory(dir) {
  if (!(await exists(dir))) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    await fs.rm(path.join(dir, entry.name), { recursive: true, force: true });
  }
}

async function copyDirectory(source, destination) {
  await ensureDir(destination);
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else {
      await ensureDir(path.dirname(destinationPath));
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
