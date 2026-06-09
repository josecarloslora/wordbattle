const { query } = require('../db');

let esWords = new Set();
let enWords = new Set();
let loaded = false;

async function loadWords() {
  const { rows } = await query('SELECT word, language FROM words');
  esWords = new Set();
  enWords = new Set();
  for (const row of rows) {
    if (row.language === 'es') esWords.add(row.word.toUpperCase());
    else enWords.add(row.word.toUpperCase());
  }
  loaded = true;
  console.log(`[wordService] Loaded ${esWords.size} ES words, ${enWords.size} EN words`);
}

function getSet(language) {
  return language === 'es' ? esWords : enWords;
}

function getRandomWord(language) {
  const set = getSet(language);
  const arr = Array.from(set);
  return arr[Math.floor(Math.random() * arr.length)];
}

function isValidWord(word, language) {
  return getSet(language).has(word.toUpperCase());
}

async function reloadWords() {
  await loadWords();
}

module.exports = { loadWords, getRandomWord, isValidWord, reloadWords };
