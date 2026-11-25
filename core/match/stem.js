// Original implementation of the public Porter stemming algorithm (1980).
// Only English word tokens are stemmed; skill phrases retain their identity.
const vowel = (word, index) => /[aeiou]/.test(word[index]) || (word[index] === 'y' && index > 0 && !vowel(word, index - 1));
function measure(word) {
  let count = 0;
  let seenVowel = false;
  for (let i = 0; i < word.length; i++) {
    if (vowel(word,i)) seenVowel = true;
    else if (seenVowel) { count++; seenVowel = false; }
  }
  return count;
}
const hasVowel = word => [...word].some((_,i) => vowel(word,i));
const double = word => word.length > 1 && word.at(-1) === word.at(-2) && !vowel(word,word.length - 1);
const cvc = word => word.length >= 3 && !vowel(word,word.length - 1) && vowel(word,word.length - 2) && !vowel(word,word.length - 3) && !/[wxy]$/.test(word);
const step2 = { ational:'ate', tional:'tion', enci:'ence', anci:'ance', izer:'ize', bli:'ble', alli:'al', entli:'ent', eli:'e', ousli:'ous', ization:'ize', ation:'ate', ator:'ate', alism:'al', iveness:'ive', fulness:'ful', ousness:'ous', aliti:'al', iviti:'ive', biliti:'ble', logi:'log' };
const step3 = { icate:'ic', ative:'', alize:'al', iciti:'ic', ical:'ic', ful:'', ness:'' };
function replaceSuffix(word, replacements, minimum) {
  for (const suffix of Object.keys(replacements).sort((a,b) => b.length - a.length)) {
    if (!word.endsWith(suffix)) continue;
    const base = word.slice(0,-suffix.length);
    return measure(base) > minimum ? base + replacements[suffix] : word;
  }
  return word;
}
export function stem(value) {
  let word = String(value).toLowerCase();
  if (word.length < 3 || !/^[a-z]+$/.test(word)) return word;
  if (word.endsWith('sses')) word = word.slice(0,-2);
  else if (word.endsWith('ies')) word = word.slice(0,-2);
  else if (!word.endsWith('ss') && word.endsWith('s')) word = word.slice(0,-1);
  if (word.endsWith('eed')) {
    if (measure(word.slice(0,-3)) > 0) word = word.slice(0,-1);
  } else {
    const suffix = word.endsWith('ing') ? 'ing' : word.endsWith('ed') ? 'ed' : null;
    if (suffix && hasVowel(word.slice(0,-suffix.length))) {
      word = word.slice(0,-suffix.length);
      if (/(at|bl|iz)$/.test(word)) word += 'e';
      else if (double(word) && !/[lsz]$/.test(word)) word = word.slice(0,-1);
      else if (measure(word) === 1 && cvc(word)) word += 'e';
    }
  }
  if (word.endsWith('y') && hasVowel(word.slice(0,-1))) word = word.slice(0,-1) + 'i';
  word = replaceSuffix(word,step2,0);
  word = replaceSuffix(word,step3,0);
  const ending = ['ement','ance','ence','able','ible','ment','ant','ent','ion','al','er','ic','ou','ism','ate','iti','ous','ive','ize'].find(s => word.endsWith(s));
  if (ending) {
    const base = word.slice(0,-ending.length);
    if (measure(base) > 1 && (ending !== 'ion' || /[st]$/.test(base))) word = base;
  }
  if (word.endsWith('e')) {
    const base = word.slice(0,-1), m = measure(base);
    if (m > 1 || (m === 1 && !cvc(base))) word = base;
  }
  if (measure(word) > 1 && word.endsWith('ll')) word = word.slice(0,-1);
  return word;
}
