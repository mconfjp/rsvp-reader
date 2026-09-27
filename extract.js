// Webページから記事の本文を取り出す。ブックマークレットとiPhoneショートカットで共用する。
// 段落（p）の文字数が一番多く集まっている要素を本文とみなし、その中の見出し・段落・リストなどを順に拾う。
function rsvpExtract() {
  var sel = String(getSelection()).trim();
  if (sel) return sel;

  var SKIP = 'nav,header,footer,aside,form,figure,button,script,style,noscript,[role=navigation],[role=complementary],[aria-hidden=true]';
  // 折りたたまれて非表示の要素は innerText が空になるので textContent で補う
  var txt = function (el) { return (el.innerText || '').trim() || (el.textContent || '').trim(); };
  var scores = new Map();
  var add = function (el, v) { if (el) scores.set(el, (scores.get(el) || 0) + v); };
  document.querySelectorAll('p,pre,blockquote').forEach(function (p) {
    if (p.closest(SKIP)) return;
    var len = txt(p).length;
    if (len < 20) return;
    add(p.parentElement, len);
    add(p.parentElement && p.parentElement.parentElement, len / 2);
  });
  var root = document.body;
  var best = 0;
  scores.forEach(function (v, el) { if (v > best) { best = v; root = el; } });

  var blocks = [];
  root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,dt,dd,td').forEach(function (el) {
    if (el.closest(SKIP) && !root.closest(SKIP)) return;
    if (el.parentElement.closest('p,li,blockquote,pre,dd,td') && root.contains(el.parentElement.closest('p,li,blockquote,pre,dd,td'))) return;
    var t = txt(el).replace(/\s*\n\s*/g, '\n').replace(/↩︎?/g, '').replace(/\[\d{1,3}\]/g, '').trim();
    if (t) blocks.push(t);
  });
  var text = blocks.join('\n').replace(/\n\s*\n+/g, '\n');
  if (!text) text = root.innerText.trim();

  var h1 = document.querySelector('h1');
  var title = (h1 && h1.innerText.trim()) || document.title;
  if (title && text.indexOf(title) !== 0) text = title + '\n' + text;
  return text;
}
