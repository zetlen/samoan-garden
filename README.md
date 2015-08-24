## samoan garden
### node anagrams

#### so like
```sh
npm i samoan-garden
```

#### and then
```js

var samoanGarden = require('samoan-garden');

samoanGarden(
  '/usr/share/dict/words', 
  {
    minWordSize: 5
  }, 
  function(err, grow) {
    if (err) throw err;
  
    grow('samoan garden').subscribeOnNext(function(plant) {
      console.log(plant);
    });

});

/**
 * console:
 *
 * adarme nongas
 * adman granose
 * adore nagsman
 * adream nongas
 * agena rodsman
 * agenda ramson
 * agenda ransom
 * agnamed arson
 *
 * [...]
 *
 * sedang ramona
 * snead morgana
 * snoga enamdar
 * soger andaman
 * sonar agnamed
 * songman ardea
 * songman aread
 * sorage mandan
 *
 */
```

#### or maybe
```js

var sg = require('./');

sg(function(e, grow) {
  if (e) throw e;
  grow.one('random sample', { timeout: 5000 }, function(e, sample) {
    console.log(sample);
  });
});

/**
 * console:
 *
 * parmesan mold
 *
 */

```

### entry method

```js
var samoanGarden = require('samoan-garden');

samoanGarden('/usr/share/dict/words', {}, function(chauncey) {

})
```

The `samoanGarden` function takes three arguments: first, a **dictionary**, which can be:

 - a falsy value like `null` to use a default enclosed scrabble dictionary
 - a string path to find a dictionary file on the filesystem
 - an array of words
 - a text stream that will output words separated by linebreaks
 - an [Rx.Observable][1] that will output words

The second argument is an (optional) options object, which can have these properties:

 ##### `timeout`
 A length of time, in milliseconds, after which the garden will artificially stop growing. Long gardening trips can produce plants for a **very** long time; often you'll have enough results before every possible plant is produced.

 ##### `minWordSize` *default: `4`*
 The minimum size of the smallest word in each match. Higher numbers mean fewer matches, but faster operation. **This option affects how the garden is planted, so it cannot be overridden later.**

 ##### `minLargestWordSize`
 The minimum size of the largest word in the match. Combining this with a `minWordSize` can result in very few matches; do a little math in your head first.

 ##### `sync` *default: `false`*
 The garden grows asynchronously by default, as Node generally prefers. Set this to `true` for the generation process to be synchronous. The method signatures don't change (you'll still use callbacks) but the underlying generator will run as fast as possible, completing a full sequence before yielding to the event loop. This speeds you up, but long gardening trips can lock the process for minutes. Don't use this in production. If `sync` is true then `timeout` has no effect.

 ##### `sep` *default: `"\n"`*
 The character separator for words in the dictionary. This is almost always a line break, but if you know that your supplied dictionary uses (for example) the comma, then you can set this to `","`. **This option affects how the garden is planted, so it cannot be overridden later.**

 ##### `cache` *default: `false`*
 Set this to `true` to use an internal LRU cache to remember already-calculated sequences. With a reasonable timeout, many anagram sequences don't complete on the first run, but on subsequent runs, the completed portion will come from the cache and it will continue where it left off. **Warning: This uses more memory**, but due to the LRU, it shouldn't leak. The cache persists as long as the `grow` method (described below) does, but has a (large) maximum size. **This option affects how the garden is planted, so it cannot be overridden later.**

The third argument is a callback, that will receive (node-style) an error if anything happens, and a `grow` method. this `grow` method can take a phrase, and generate anagrams from the dictionary.

### the `grow` method

The grow method takes a phrase and returns an [Rx.Observable][1] that will emit anagrams for the phrase. subscribe by calling `subscribe` on the observable, and your callback will be called once for each word.

```js
// simplest case, all defaults
var sg = require('samoan-garden');
sg(function(grow) {
  grow('cool plants').subscribe(console.log);
});
```

### the returned observable
An [Rx.Observable][1] is like an eventEmitter or a stream. It is fast and powerful, but all you have to remember is that it has a `subscribe` method, that takes a data handler first, and then optionally, an error handler and a completion handler. If you want to do something when all the anagrams are done:

```js
grow('neat things').subscribe(
  function(x) {
    console.log(x);
  }, 
  function(e) {
    console.error('Uh oh!', e);
  },
  function() {
    console.log('All done!');
  });
```

You can supply option overrides as well, for the `timeout`, `minLargestWordSize`, and `sync` options:

```js
grow('neat things', { timeout: 10000, minLargestWordSize: 5 }).subscribe(console.log);
```

The grow method also has an auxiliary method: 

### the `grow.one` method

It works like `grow` itself, but:

 - instead of a stream of anagrams, it emit one anagram
 - this anagram is chosen randomly from the stream
 - you can optionally pass a callback argument to receive the single anagram, instead of subscribing to the returned observable

```js
grow.one('prizewinning pumpkin', { timeout: 5000 }, function(one) {
  console.log(one); // "nine zipping rump wink"
})
```

the above will emit a random anagram in maximum 5 seconds (less if all anagrams are calculated before then). if no anagrams are available yet, it will emit `undefined`.

### es6

there is an es6 version of the garden that uses native generators. it is a significant speed boost, perhaps 3x. if you are running an engine which supports native generators (such as node 0.12 with the `--harmony` flag) you can use it:

```js
var samoanGarden = require('samoan-garden/es6');
```

### command line

```sh
$ npm i -g samoan-garden
```

```sh
$ sg --one --min-largest-word-size=7 reince priebus
inscribe puree
```

[1]: https://github.com/Reactive-Extensions/RxJS/tree/master/doc