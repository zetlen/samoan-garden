"use strict";
const MIN_WORD_SIZE = 4;

let emptyString = '';
let spacesRE = /\s/g;
let trimSpaces = word => word.replace(spacesRE, emptyString);

function DictNode(letter, final, depth, minWordSize) {
  this.letter = letter || '';
  this.final = final || false;
  this.depth = depth || 0;
  this.minWordSize = minWordSize || MIN_WORD_SIZE;
  this.children = {};
}

var dP = DictNode.prototype;

dP.add = function(realWord) {
  let node = this;
  realWord.split('').forEach((letter, index) => {
    if (!node.children[letter]) {
      node.children[letter] = new DictNode(
        letter, 
        index === realWord.length - 1, 
        index + 1,
        node.minWordSize
      );
    }
    node = node.children[letter];
  });
};

dP.anagram = function(letters) {
  let tiles = letters.split('').reduce((tiles, letter) => {
    tiles[letter] = (tiles[letter] || 0) + 1;
    return tiles;
  }, {});
  return this._buildAnagram(tiles, [], this, letters.length);
};

dP._buildAnagram = function*(tiles, path, root, minLength) {
  if (this.final && this.depth >= this.minWordSize) {
    let word = path.join('');
    let length = trimSpaces(word).length;
    if (length >= minLength) {
      yield word;
    }
    path.push(' ');
    for (var w of root._buildAnagram(tiles, path, root, minLength)) {
      yield w;
    }
    path.pop();
  }
  for (let letter in this.children) {
    if (!this.children.hasOwnProperty(letter)) continue;
    let count = tiles[letter] || 0;
    if (count === 0) continue;
    tiles[letter] = count - 1;
    path.push(letter);
    for (var w of this.children[letter]._buildAnagram(tiles, path, root, minLength)) {
      yield w;
    }
    path.pop();
    tiles[letter] = count;
  }
};

module.exports = DictNode;