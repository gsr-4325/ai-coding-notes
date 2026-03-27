function resolveWikiLinks(text, basePath = "/posts/") {
  return text.replace(/\[\[(.+?)\]\]/g, (_, inner) => {
    const [rawSlug, rawLabel] = inner.split("|");
    const slug = rawSlug.trim();
    const label = (rawLabel || rawSlug).trim();
    return `<a href="${basePath}${slug}/">${label}</a>`;
  });
}

window.resolveWikiLinks = resolveWikiLinks;
