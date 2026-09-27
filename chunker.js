// 日本語テキストを「文節っぽい単位」に分割する。
// Intl.Segmenter で単語に分けたあと、助詞・助動詞・句読点などを前の語にくっつける。
(function (global) {
  'use strict';

  // 前の語にくっつける機能語（ひらがなのみのトークンとして現れるもの）
  const FUNC = new Set((
    // 助詞
    'は が を に へ と で や の も か ね よ な わ ぞ さ ぜ から まで より ので のに けど けれど けれども ' +
    'し ば って て ても でも など なんか ほど くらい ぐらい だけ しか ばかり こそ さえ すら なら とか ' +
    'ながら つつ たり だり には では とは での への との からの までの について により による として ' +
    // 助動詞・活用語尾
    'だ だっ だろ だろう です でし でしょ でしょう ます まし ませ ましょ ましょう ん た だ たか ' +
    'ない なかっ なく なけれ なきゃ ぬ ず れる られ られる れ ら せる させ させる せ たい たく たかっ ' +
    'ろう う よう ような ように ちゃ ちゃう じゃ いる い いた いま います いない いれ おり おります んで んだ っ って ' +
    // する・できる
    'して した する すれ され させ しま します しない しなかっ せず でき できる できない できま ' +
    // 接尾辞
    'さん くん ちゃん たち'
  ).split(/\s+/).filter(Boolean));

  const OPEN = /^[「『（(［\[｛{〈《【〔“‘"'＜<]+$/u;
  // この文字で終わったチャンクには、以降の語をくっつけない
  const CLOSER = /[、。，．,.!！?？…‥・;；:：]$/u;
  const HIRA_ONLY = /^[\p{Script=Hiragana}ー]+$/u;
  // 語頭に来ない文字（ん・っ・小書き）で始まるひらがなトークン
  const NON_INITIAL = /^[んっぁぃぅぇぉゃゅょゎー]/u;

  const isKanji = (c) => /[\p{Script=Han}々〆ヶ]/u.test(c);
  const isKata = (c) => /[\p{Script=Katakana}ー]/u.test(c);
  const isDigit = (c) => /[0-9０-９]/u.test(c);

  function shouldAttach(chunk, tok) {
    if (CLOSER.test(chunk.text)) return false;
    const last = chunk.text[chunk.text.length - 1];
    const first = tok[0];
    if (HIRA_ONLY.test(tok)) {
      if (FUNC.has(tok) || NON_INITIAL.test(tok)) return true;
      // 1文字の漢字（動詞・形容詞の語幹）に続く送り仮名：使|えば、書|く
      if (chunk.lastTok.length === 1 && isKanji(chunk.lastTok)) return true;
    }
    if (isKanji(last) && isKanji(first)) return true; // 複合名詞
    if (isKata(last) && isKata(first)) return true;
    if (isDigit(last) && (isDigit(first) || isKanji(first))) return true; // 3人、2026年
    return false;
  }

  /**
   * @returns {{chunks: {text:string,start:number,sent:number}[],
   *            sentences: {start:number,end:number,first:number,last:number}[]}}
   *  start/end は元テキスト内の文字オフセット、first/last はチャンク番号。
   */
  function chunkText(text) {
    const sentSeg = new Intl.Segmenter('ja', { granularity: 'sentence' });
    const wordSeg = new Intl.Segmenter('ja', { granularity: 'word' });
    const chunks = [];
    const sentences = [];

    // ICU は「。「」の「を前の文に含めるので、文末の開き括弧は次の文へ回す
    const ranges = [];
    let carry = 0;
    for (const seg of sentSeg.segment(text)) {
      const start = seg.index - carry;
      const m = seg.segment.match(/[「『（(［\[｛{〈《【〔“‘]+\s*$/u);
      carry = m ? m[0].length : 0;
      ranges.push({ index: start, segment: text.slice(start, seg.index + seg.segment.length - carry) });
    }
    if (carry && ranges.length) {
      const r = ranges[ranges.length - 1];
      r.segment = text.slice(r.index);
    }

    for (const s of ranges) {
      if (!s.segment.trim()) continue;
      const sentIdx = sentences.length;
      const firstChunk = chunks.length;
      let cur = null;
      let prefix = '';
      let prefixStart = 0;
      const flush = () => { if (cur) { chunks.push(cur); cur = null; } };

      for (const w of wordSeg.segment(s.segment)) {
        const t = w.segment;
        const off = s.index + w.index;
        if (/^\s+$/u.test(t)) { flush(); continue; }
        if (!w.isWordLike) {
          if (OPEN.test(t)) {
            flush();
            if (!prefix) prefixStart = off;
            prefix += t;
          } else if (cur) {
            cur.text += t;
          } else if (prefix) {
            prefix += t;
          } else if (chunks.length > firstChunk) {
            chunks[chunks.length - 1].text += t; // 空白のあとの句読点など
          } else {
            cur = { text: t, start: off, sent: sentIdx, lastTok: t };
          }
          continue;
        }
        if (cur && !prefix && shouldAttach(cur, t)) {
          cur.text += t;
          cur.lastTok = t;
        } else {
          flush();
          cur = { text: prefix + t, start: prefix ? prefixStart : off, sent: sentIdx, lastTok: t };
          prefix = '';
        }
      }
      if (prefix) {
        if (cur) cur.text += prefix;
        else cur = { text: prefix, start: prefixStart, sent: sentIdx, lastTok: prefix };
      }
      flush();
      if (chunks.length > firstChunk) {
        sentences.push({
          start: s.index,
          end: s.index + s.segment.trimEnd().length,
          first: firstChunk,
          last: chunks.length - 1,
        });
      }
    }
    return { chunks, sentences };
  }

  global.chunkText = chunkText;
  if (typeof module !== 'undefined') module.exports = { chunkText };
})(typeof window !== 'undefined' ? window : globalThis);
