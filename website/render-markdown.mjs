// Raw HTML, embedded images and active URL schemes are never rendered from contributions.
export function renderDocument(MarkdownIt, text) {
  const md = new MarkdownIt({ html:false, linkify:false }).disable('image');
  const base = text.match(/https:\/\/github\.com\/thuygom\/code-to-work-standards\/blob\/master\/[a-z0-9/.-]+\.md/)?.[0]
    || 'https://github.com/thuygom/code-to-work-standards/blob/master/';
  md.renderer.rules.link_open = (tokens,index,options,env,self) => {
    const token = tokens[index];
    let href = '#';
    try {
      const url = new URL(token.attrGet('href'),base);
      if (['https:','http:'].includes(url.protocol)) href = url.href;
    } catch { /* Keep malformed contributed links inert. */ }
    token.attrSet('href',href);
    token.attrSet('target','_blank'); token.attrSet('rel','noopener noreferrer');
    return self.renderToken(tokens,index,options);
  };
  return md.render(text.replace(/^<a id="[a-z0-9-]+"><\/a>\s*$/gm,''));
}
