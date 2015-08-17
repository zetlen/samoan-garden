var fs = require('fs');
var DictNode = require('./dict-node');
var Rx = require('rx');

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
    function(e) {
      throw e;
  });
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

  var minWordSize = opts.minWordSize;
  var minLargestWordSize = opts.minLargestWordSize || minWordSize;
  var sep = opts.sep || LF;

  var minLargestWordSizeRE = RegExp('\\w\{' + minLargestWordSize + '\}');

  var dict = new DictNode();
  if (minWordSize) dict.minWordSize = minWordSize;

  var words;

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

  var generate = function(letters) {
    var res = [];
    for (var word of dict.anagram(toLetters(letters))) {
      if (minLargestWordSizeRE.test(word)) {
        res.push(word);
      }
    }
    return res;
  };

  generate._dict = dict;

  words.subscribeOnError(cb);

  words.subscribeOnCompleted(function() {
    cb(null, generate);
  });

}