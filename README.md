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
var scrabbleWords = require.resolve('./sowpods.txt');

sg(
  scrabbleWords, 
  { minLargestWordSize: 7 }, 
  function(e, grow) {
    if (e) throw e;
    grow.one('random sample', { timeout: 5000 }, function(e, sample) {
      console.log(sample);
    })
  }
);

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

the `samoanGarden` function takes a dictionary, that can be:

 - a falsy value like `null` to use a default enclosed scrabble dictionary
 - a string path to find a dictionary file on the filesystem
 - an array of words
 - a text stream that will output words separated by linebreaks
 - an [Rx.Observable][1] that will output words

an optional options object, that can include:

 - `minWordSize` - minimum size of the smallest word in each match *(default 4)*
 - `minLargestWordSize` - minimum size of the largest word in the match *(default none)*
 - `async` - `true` for all operations to be asynchronous. slows you down but keeps the system responsive; long gardening trips can lock your process for minutes. if `async` is false then `timeout` and `generate.cancel` have no effect. *(default false)*
 - `sep` - separator for words in the dictionary *(default `"\n"`, or linebreak)*

and a callback, that will receive (node-style) an error if anything happens, and a generate method. this generate method can take a phrase, and generate anagrams from the dictionary.

### generate method

the generate method takes a phrase and returns an [Rx.Observable][1] that will emit anagrams for the phrase. subscribe by calling `subscribeOnNext` on the observable, and your callback will be called once for each word.

the generate method also has two auxiliary methods:

#### `generate.one`
like `generate` itself, but instead of a stream of anagrams, emit one anagram, a random anagram from the stream of possible anagrams. since a random value from a stream could take a long time to resolve, you can provide a millisecond timeout in an options collection:

```js
generate.one(phrase, { timeout: 5000 })
```

the default timeout is 30 seconds; the above will emit a random anagram in maximum 5 seconds (less if all anagrams are calculated before then). if no anagrams are available yet, it will emit `undefined`.

#### `generate.cancel`
if you created your garden with `{ async: true }` then you have the ability to cancel generate operations by calling this method with no arguments. save the planet.

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