"use strict";
var fs = require('fs');
var Rx = require('rx');
var Reservoir = require('reservoir');
var LRU = require('lru-cache');
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

dP.anagram = function*(tiles, path, root, minLength) {
  if (this.final && this.depth >= this.minWordSize) {
    let word = path.join('');
    let length = trimSpaces(word).length;
    if (length >= minLength) {
      yield word;
    }
    path.push(' ');
    for (var w of root.anagram(tiles, path, root, minLength)) {
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
    for (var w of this.children[letter].anagram(tiles, path, root, minLength)) {
      yield w;
    }
    path.pop();
    tiles[letter] = count;
  }
};

var LF = '\n';

var notLetters = /[^a-z]/g;
function toLetters(str) {
  return str.toLowerCase().replace(notLetters, '');
}

function fillDict(dict, obs) {
  obs.subscribe(
    function(word) {
      dict.add(word && word.toLowerCase && word.trim().toLowerCase());
    }, 
    Rx.helpers.defaultError);
}

function splitTextStreamOn(textStream, sep) {
  return Rx.Observable.create(function(observer) {
    var buf = '';
    var send = observer.onNext.bind(observer);
    textStream.on('readable', function() {
      var chunk;
      var lines;
      while (chunk = textStream.read()) {
        buf += chunk;
        var lastNewlinePos = buf.lastIndexOf(sep);
        var lines;
        if (lastNewlinePos === -1) continue;
        if (lastNewlinePos === buf.length - 1) {
          buf.substring(0, buf.length - sep.length).split(sep).forEach(send);
          buf = '';
        } else {
          lines = buf.split(sep);
          buf = lines.pop();
          lines.forEach(send);
        }
      }
    });
    textStream.on('end', observer.onCompleted.bind(observer));
  });
}

function getFileAsLines(path) {
  return splitTextStreamOn(fs.createReadStream(path, 'utf8'), LF);
}

module.exports = function(source, opts, cb) {

  if (typeof opts == "function") {
    cb = opts;
    opts = {};
  }

  var cache;
  function makeKey(letters) {
    return letters.toLowerCase().split('').sort().join('');
  }
  function putCache(tiles, iterator, results) {
    var key = makeKey(tiles);
    var existing = cache.get(key);
    if (existing) {
      results = existing.results.concat(results);  
    }
    cache.set(makeKey(tiles), { iterator, results });
  }
  function getCache(tiles) {
    return cache.get(makeKey(tiles));
  }
  if (opts.cache) {
    cache = LRU(typeof opts.cache === "object" ? opts.cache : {
      max: 400000,
      length: function(o) {
        var len = o.results.length;
        return len > 0 ? len * o.results[0].length : 0;
      }
    });
  }

  var minWordSize = opts.minWordSize || 4;
  var minLargestWordSize = opts.minLargestWordSize;
  var sep = opts.sep || LF;

  var minLargestWordSizeRE = minLargestWordSize && RegExp('\\w\{' + minLargestWordSize + '\}');

  var dict = new DictNode();
  if (minWordSize) dict.minWordSize = minWordSize;

  var words;
  if (!source) source = require.resolve('./sowpods.txt');

  switch(true) {
    case Array.isArray(source):
      words = Rx.Observable.fromArray(source);
      break;
    case typeof source === "string":
      words = getFileAsLines(source);
      break;
    case typeof source.subscribeOnNext == "function": // duck typing Observable
      words = source;
      break;
    case typeof source.pipe == "function": // duck typing Stream
      words = splitTextStreamOn(source, sep);
      break;
    default:
      throw new Error("Unfamiliar with the type of source supplied: ", source);
  }

  fillDict(dict, words);

  var canceled;

  var generate = function(str, overrideOpts) {

    var theseOpts = overrideOpts ? 
      Object.keys(opts).concat(Object.keys(overrideOpts)).reduce((m, k) => {
        m[k] = overrideOpts.hasOwnProperty(k) ? overrideOpts[k] : opts[k];
        return m;
      }, {})
      : opts;

    let letters = trimSpaces(str);
    let tiles = letters.split('').reduce((t, letter) => {
      t[letter] = (t[letter] || 0) + 1;
      return t;
    }, {});

    let cached;
    let iterator;
    let results;
    if (theseOpts.cache && (cached = getCache(letters))) {
      iterator = cached.iterator;
      results = cached.results;
    } else {
      iterator = dict.anagram(tiles, [], dict, letters.length);
      results = [];
    }

    var known = Rx.Observable.fromArray(results.slice());

    let first = iterator.next();
    if (first.done) return known;

    let canceled;
    if (theseOpts.timeout) setTimeout(() => canceled = true, theseOpts.timeout);
    let rest = Rx.Observable.generate(
      first.value,
      theseOpts.cache ? x => {
        var finished = x.done || canceled;
        if (finished) {
          putCache(letters, iterator, results);
        }
        return !finished;
      } : x => !(x.done || canceled),
      theseOpts.cache ? () => {
        var n = iterator.next();
        if (n.value) results.push(n.value);
        return n;
      } : () => iterator.next(),
      x => x.value || x,
      !theseOpts.sync ? Rx.Scheduler.default : Rx.Scheduler.currentThread
    );

    if (minLargestWordSizeRE) {
      rest = rest.filter(x => !!minLargestWordSizeRE.exec(x));
    }

    return known.concat(rest);

  };

  generate.one = function(letters, optOverrides, callback) {
    if (arguments.length === 2 && typeof optOverrides === "function") {
      callback = optOverrides;
      optOverrides = {};
    }
    optOverrides = optOverrides || {};
    optOverrides.sync = false;
    let errorHandler = callback || Rx.helpers.defaultError;
    let sampler = Rx.Observable.create(observer => {
      let reservoir = Reservoir(opts.poolSize || 50);
      generate(letters, optOverrides).subscribe(
        x => reservoir.pushSome(x),
        errorHandler,
        () => {
          observer.onNext(reservoir[Math.floor(Math.random() * reservoir.length)]);
          observer.onCompleted();
        }
      );
    });
    sampler.subscribe(
      x => callback && callback(null, x),
      errorHandler
    );
    return sampler;
  };

  generate._dict = dict;

  words.subscribeOnError(cb);

  words.subscribeOnCompleted(function() {
    cb(null, generate);
  });

}