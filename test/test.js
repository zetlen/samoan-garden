var assert = require('assert');

var SG = require('../');

console.log('testing /usr/share/dict/words');
SG('/usr/share/dict/words', { minWordSize: 5, minLargestWordSize: 6 }, function(err, generate) {
  assert(!err, err && err.message);
  var res = generate('samoan garden');
  assert(res.length > 0, "returned zero results :(");
  console.log('/usr/share/dict/words works! "samoan garden" anagrams to, for instance,', res[Math.floor(Math.random() * res.length)]);
});

console.log('testing SOWPODS');
SG('./sowpods.txt', { minWordSize: 5, minLargestWordSize: 6 }, function(err, generate) {
  assert(!err, err && err.message);
  var res = generate('scrabble words');
  assert(res.length > 0, "returned zero results :(");
  console.log('SOWPODS works! "scrabble words" anagrams to, for instance,', res[Math.floor(Math.random() * res.length)]);
});