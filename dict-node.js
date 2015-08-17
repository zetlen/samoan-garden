"use strict";

var _regeneratorRuntime = require('babel-runtime/regenerator')['default'];

var _getIterator = require('babel-runtime/core-js/get-iterator')['default'];

var MIN_WORD_SIZE = 4;

var emptyString = '';
var spacesRE = /\s/g;
var trimSpaces = function trimSpaces(word) {
  return word.replace(spacesRE, emptyString);
};

function DictNode(letter, final, depth, minWordSize) {
  this.letter = letter || '';
  this.final = final || false;
  this.depth = depth || 0;
  this.minWordSize = minWordSize || MIN_WORD_SIZE;
  this.children = {};
}

var dP = DictNode.prototype;

dP.add = function (realWord) {
  var node = this;
  realWord.split('').forEach(function (letter, index) {
    if (!node.children[letter]) {
      node.children[letter] = new DictNode(letter, index === realWord.length - 1, index + 1, node.minWordSize);
    }
    node = node.children[letter];
  });
};

dP.anagram = function (letters) {
  var tiles = letters.split('').reduce(function (tiles, letter) {
    tiles[letter] = (tiles[letter] || 0) + 1;
    return tiles;
  }, {});
  return this._buildAnagram(tiles, [], this, letters.length);
};

dP._buildAnagram = _regeneratorRuntime.mark(function callee$0$0(tiles, path, root, minLength) {
  var word, _length, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, w, letter, count, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2;

  return _regeneratorRuntime.wrap(function callee$0$0$(context$1$0) {
    while (1) switch (context$1$0.prev = context$1$0.next) {
      case 0:
        if (!(this.final && this.depth >= this.minWordSize)) {
          context$1$0.next = 34;
          break;
        }

        word = path.join('');
        _length = trimSpaces(word).length;

        if (!(_length >= minLength)) {
          context$1$0.next = 6;
          break;
        }

        context$1$0.next = 6;
        return word;

      case 6:
        path.push(' ');
        _iteratorNormalCompletion = true;
        _didIteratorError = false;
        _iteratorError = undefined;
        context$1$0.prev = 10;
        _iterator = _getIterator(root._buildAnagram(tiles, path, root, minLength));

      case 12:
        if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
          context$1$0.next = 19;
          break;
        }

        w = _step.value;
        context$1$0.next = 16;
        return w;

      case 16:
        _iteratorNormalCompletion = true;
        context$1$0.next = 12;
        break;

      case 19:
        context$1$0.next = 25;
        break;

      case 21:
        context$1$0.prev = 21;
        context$1$0.t0 = context$1$0['catch'](10);
        _didIteratorError = true;
        _iteratorError = context$1$0.t0;

      case 25:
        context$1$0.prev = 25;
        context$1$0.prev = 26;

        if (!_iteratorNormalCompletion && _iterator['return']) {
          _iterator['return']();
        }

      case 28:
        context$1$0.prev = 28;

        if (!_didIteratorError) {
          context$1$0.next = 31;
          break;
        }

        throw _iteratorError;

      case 31:
        return context$1$0.finish(28);

      case 32:
        return context$1$0.finish(25);

      case 33:
        path.pop();

      case 34:
        context$1$0.t1 = _regeneratorRuntime.keys(this.children);

      case 35:
        if ((context$1$0.t2 = context$1$0.t1()).done) {
          context$1$0.next = 74;
          break;
        }

        letter = context$1$0.t2.value;

        if (this.children.hasOwnProperty(letter)) {
          context$1$0.next = 39;
          break;
        }

        return context$1$0.abrupt('continue', 35);

      case 39:
        count = tiles[letter] || 0;

        if (!(count === 0)) {
          context$1$0.next = 42;
          break;
        }

        return context$1$0.abrupt('continue', 35);

      case 42:
        tiles[letter] = count - 1;
        path.push(letter);
        _iteratorNormalCompletion2 = true;
        _didIteratorError2 = false;
        _iteratorError2 = undefined;
        context$1$0.prev = 47;
        _iterator2 = _getIterator(this.children[letter]._buildAnagram(tiles, path, root, minLength));

      case 49:
        if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
          context$1$0.next = 56;
          break;
        }

        w = _step2.value;
        context$1$0.next = 53;
        return w;

      case 53:
        _iteratorNormalCompletion2 = true;
        context$1$0.next = 49;
        break;

      case 56:
        context$1$0.next = 62;
        break;

      case 58:
        context$1$0.prev = 58;
        context$1$0.t3 = context$1$0['catch'](47);
        _didIteratorError2 = true;
        _iteratorError2 = context$1$0.t3;

      case 62:
        context$1$0.prev = 62;
        context$1$0.prev = 63;

        if (!_iteratorNormalCompletion2 && _iterator2['return']) {
          _iterator2['return']();
        }

      case 65:
        context$1$0.prev = 65;

        if (!_didIteratorError2) {
          context$1$0.next = 68;
          break;
        }

        throw _iteratorError2;

      case 68:
        return context$1$0.finish(65);

      case 69:
        return context$1$0.finish(62);

      case 70:
        path.pop();
        tiles[letter] = count;
        context$1$0.next = 35;
        break;

      case 74:
      case 'end':
        return context$1$0.stop();
    }
  }, callee$0$0, this, [[10, 21, 25, 33], [26,, 28, 32], [47, 58, 62, 70], [63,, 65, 69]]);
});

module.exports = DictNode;

