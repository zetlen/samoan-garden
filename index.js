/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
 * additional grant of patent rights can be found in the PATENTS file in
 * the same directory.
 */

"use strict";

!(function (global) {
  "use strict";

  var hasOwn = Object.prototype.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var iteratorSymbol = typeof Symbol === "function" && Symbol.iterator || "@@iterator";

  var inModule = typeof module === "object";
  var runtime = global.regeneratorRuntime;
  if (runtime) {
    if (inModule) {
      // If regeneratorRuntime is defined globally and we're in a module,
      // make the exports object identical to regeneratorRuntime.
      module.exports = runtime;
    }
    // Don't bother evaluating the rest of this file if the runtime was
    // already defined globally.
    return;
  }

  // Define the runtime globally (as expected by generated code) as either
  // module.exports (if we're in a module) or a new, empty object.
  runtime = global.regeneratorRuntime = inModule ? module.exports : {};

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided, then outerFn.prototype instanceof Generator.
    var generator = Object.create((outerFn || Generator).prototype);

    generator._invoke = makeInvokeMethod(innerFn, self || null, new Context(tryLocsList || []));

    return generator;
  }
  runtime.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype;
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function (method) {
      prototype[method] = function (arg) {
        return this._invoke(method, arg);
      };
    });
  }

  runtime.isGeneratorFunction = function (genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor ? ctor === GeneratorFunction ||
    // For the native GeneratorFunction constructor, the best we can
    // do is to check its .name property.
    (ctor.displayName || ctor.name) === "GeneratorFunction" : false;
  };

  runtime.mark = function (genFun) {
    genFun.__proto__ = GeneratorFunctionPrototype;
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `value instanceof AwaitArgument` to determine if the yielded value is
  // meant to be awaited. Some may consider the name of this method too
  // cutesy, but they are curmudgeons.
  runtime.awrap = function (arg) {
    return new AwaitArgument(arg);
  };

  function AwaitArgument(arg) {
    this.arg = arg;
  }

  function AsyncIterator(generator) {
    // This invoke function is written in a style that assumes some
    // calling function (or Promise) will handle exceptions.
    function invoke(method, arg) {
      var result = generator[method](arg);
      var value = result.value;
      return value instanceof AwaitArgument ? Promise.resolve(value.arg).then(invokeNext, invokeThrow) : Promise.resolve(value).then(function (unwrapped) {
        // When a yielded Promise is resolved, its final value becomes
        // the .value of the Promise<{value,done}> result for the
        // current iteration. If the Promise is rejected, however, the
        // result for this iteration will be rejected with the same
        // reason. Note that rejections of yielded Promises are not
        // thrown back into the generator function, as is the case
        // when an awaited Promise is rejected. This difference in
        // behavior between yield and await is important, because it
        // allows the consumer to decide what to do with the yielded
        // rejection (swallow it and continue, manually .throw it back
        // into the generator, abandon iteration, whatever). With
        // await, by contrast, there is no opportunity to examine the
        // rejection reason outside the generator function, so the
        // only option is to throw it from the await expression, and
        // let the generator function handle the exception.
        result.value = unwrapped;
        return result;
      });
    }

    if (typeof process === "object" && process.domain) {
      invoke = process.domain.bind(invoke);
    }

    var invokeNext = invoke.bind(generator, "next");
    var invokeThrow = invoke.bind(generator, "throw");
    var invokeReturn = invoke.bind(generator, "return");
    var previousPromise;

    function enqueue(method, arg) {
      var enqueueResult =
      // If enqueue has been called before, then we want to wait until
      // all previous Promises have been resolved before calling invoke,
      // so that results are always delivered in the correct order. If
      // enqueue has not been called before, then it is important to
      // call invoke immediately, without waiting on a callback to fire,
      // so that the async generator function has the opportunity to do
      // any necessary setup in a predictable way. This predictability
      // is why the Promise constructor synchronously invokes its
      // executor callback, and why async functions synchronously
      // execute code before the first await. Since we implement simple
      // async functions in terms of async generators, it is especially
      // important to get this right, even though it requires care.
      previousPromise ? previousPromise.then(function () {
        return invoke(method, arg);
      }) : new Promise(function (resolve) {
        resolve(invoke(method, arg));
      });

      // Avoid propagating enqueueResult failures to Promises returned by
      // later invocations of the iterator.
      previousPromise = enqueueResult["catch"](function (ignored) {});

      return enqueueResult;
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  runtime.async = function (innerFn, outerFn, self, tryLocsList) {
    var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList));

    return runtime.isGeneratorFunction(outerFn) ? iter // If outerFn is a generator, return the full iterator.
    : iter.next().then(function (result) {
      return result.done ? result.value : iter.next();
    });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          if (method === "return" || method === "throw" && delegate.iterator[method] === undefined) {
            // A return or throw (when the delegate iterator has no throw
            // method) always terminates the yield* loop.
            context.delegate = null;

            // If the delegate iterator has a return method, give it a
            // chance to clean up.
            var returnMethod = delegate.iterator["return"];
            if (returnMethod) {
              var record = tryCatch(returnMethod, delegate.iterator, arg);
              if (record.type === "throw") {
                // If the return method threw an exception, let that
                // exception prevail over the original return or throw.
                method = "throw";
                arg = record.arg;
                continue;
              }
            }

            if (method === "return") {
              // Continue with the outer return, now that the delegate
              // iterator has been terminated.
              continue;
            }
          }

          var record = tryCatch(delegate.iterator[method], delegate.iterator, arg);

          if (record.type === "throw") {
            context.delegate = null;

            // Like returning generator.throw(uncaught), but without the
            // overhead of an extra function call.
            method = "throw";
            arg = record.arg;
            continue;
          }

          // Delegate generator ran and handled its own exceptions so
          // regardless of what the method was, we continue as if it is
          // "next" with an undefined arg.
          method = "next";
          arg = undefined;

          var info = record.arg;
          if (info.done) {
            context[delegate.resultName] = info.value;
            context.next = delegate.nextLoc;
          } else {
            state = GenStateSuspendedYield;
            return info;
          }

          context.delegate = null;
        }

        if (method === "next") {
          if (state === GenStateSuspendedYield) {
            context.sent = arg;
          } else {
            context.sent = undefined;
          }
        } else if (method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw arg;
          }

          if (context.dispatchException(arg)) {
            // If the dispatched exception was caught by a catch block,
            // then let that catch block handle the exception normally.
            method = "next";
            arg = undefined;
          }
        } else if (method === "return") {
          context.abrupt("return", arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done ? GenStateCompleted : GenStateSuspendedYield;

          var info = {
            value: record.arg,
            done: context.done
          };

          if (record.arg === ContinueSentinel) {
            if (context.delegate && method === "next") {
              // Deliberately forget the last sent value so that we don't
              // accidentally pass it on to the delegate.
              arg = undefined;
            }
          } else {
            return info;
          }
        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(arg) call above.
          method = "throw";
          arg = record.arg;
        }
      }
    };
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[iteratorSymbol] = function () {
    return this;
  };

  Gp.toString = function () {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  runtime.keys = function (object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1,
            next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  runtime.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function reset(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      this.sent = undefined;
      this.done = false;
      this.delegate = null;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function stop() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function dispatchException(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;
        return !!caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }
          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }
          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }
          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function abrupt(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry && (type === "break" || type === "continue") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.next = finallyEntry.finallyLoc;
      } else {
        this.complete(record);
      }

      return ContinueSentinel;
    },

    complete: function complete(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" || record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = record.arg;
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }
    },

    finish: function finish(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function _catch(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function delegateYield(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      return ContinueSentinel;
    }
  };
})(
// Among the various tricks for obtaining a reference to the global
// object, this seems to be the most reliable technique that does not
// use indirect eval (which violates Content Security Policy).
typeof global === "object" ? global : typeof window === "object" ? window : typeof self === "object" ? self : undefined);
"use strict";
var fs = require('fs');
var Rx = require('rx');
var Reservoir = require('reservoir');
var LRU = require('lru-cache');
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

dP.anagram = regeneratorRuntime.mark(function callee$0$0(tiles, path, root, minLength) {
  var word, length, w, t$1$0, t$1$1, letter, count, t$1$2, t$1$3;

  return regeneratorRuntime.wrap(function callee$0$0$(context$1$0) {
    while (1) switch (context$1$0.prev = context$1$0.next) {
      case 0:
        if (!(this.final && this.depth >= this.minWordSize)) {
          context$1$0.next = 15;
          break;
        }

        word = path.join('');
        length = trimSpaces(word).length;

        if (!(length >= minLength)) {
          context$1$0.next = 6;
          break;
        }

        context$1$0.next = 6;
        return word;
      case 6:
        path.push(' ');
        t$1$0 = regeneratorRuntime.values(root.anagram(tiles, path, root, minLength));
      case 8:
        if ((t$1$1 = t$1$0.next()).done) {
          context$1$0.next = 14;
          break;
        }

        w = t$1$1.value;
        context$1$0.next = 12;
        return w;
      case 12:
        context$1$0.next = 8;
        break;
      case 14:
        path.pop();
      case 15:
        context$1$0.t0 = regeneratorRuntime.keys(this.children);
      case 16:
        if ((context$1$0.t1 = context$1$0.t0()).done) {
          context$1$0.next = 36;
          break;
        }

        letter = context$1$0.t1.value;

        if (this.children.hasOwnProperty(letter)) {
          context$1$0.next = 20;
          break;
        }

        return context$1$0.abrupt("continue", 16);
      case 20:
        count = tiles[letter] || 0;

        if (!(count === 0)) {
          context$1$0.next = 23;
          break;
        }

        return context$1$0.abrupt("continue", 16);
      case 23:
        tiles[letter] = count - 1;
        path.push(letter);
        t$1$2 = regeneratorRuntime.values(this.children[letter].anagram(tiles, path, root, minLength));
      case 26:
        if ((t$1$3 = t$1$2.next()).done) {
          context$1$0.next = 32;
          break;
        }

        w = t$1$3.value;
        context$1$0.next = 30;
        return w;
      case 30:
        context$1$0.next = 26;
        break;
      case 32:
        path.pop();
        tiles[letter] = count;
        context$1$0.next = 16;
        break;
      case 36:
      case "end":
        return context$1$0.stop();
    }
  }, callee$0$0, this);
});

var LF = '\n';

var notLetters = /[^a-z]/g;
function toLetters(str) {
  return str.toLowerCase().replace(notLetters, '');
}

function fillDict(dict, obs) {
  obs.subscribe(function (word) {
    dict.add(word && word.toLowerCase && word.trim().toLowerCase());
  }, Rx.helpers.defaultError);
}

function splitTextStreamOn(textStream, sep) {
  return Rx.Observable.create(function (observer) {
    var buf = '';
    var send = observer.onNext.bind(observer);
    textStream.on('readable', function () {
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

module.exports = function (source, opts, cb) {

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
    cache.set(makeKey(tiles), { iterator: iterator, results: results });
  }
  function getCache(tiles) {
    return cache.get(makeKey(tiles));
  }
  if (opts.cache) {
    cache = LRU(typeof opts.cache === "object" ? opts.cache : {
      max: 400000,
      length: function length(o) {
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

  switch (true) {
    case Array.isArray(source):
      words = Rx.Observable.fromArray(source);
      break;
    case typeof source === "string":
      words = getFileAsLines(source);
      break;
    case typeof source.subscribeOnNext == "function":
      // duck typing Observable
      words = source;
      break;
    case typeof source.pipe == "function":
      // duck typing Stream
      words = splitTextStreamOn(source, sep);
      break;
    default:
      throw new Error("Unfamiliar with the type of source supplied: ", source);
  }

  fillDict(dict, words);

  var canceled;

  var generate = function generate(str, overrideOpts) {

    var theseOpts = overrideOpts ? Object.keys(opts).concat(Object.keys(overrideOpts)).reduce(function (m, k) {
      m[k] = overrideOpts.hasOwnProperty(k) ? overrideOpts[k] : opts[k];
      return m;
    }, {}) : opts;

    var letters = trimSpaces(str);
    var tiles = letters.split('').reduce(function (t, letter) {
      t[letter] = (t[letter] || 0) + 1;
      return t;
    }, {});

    var cached;
    var iterator;
    var results;
    if (theseOpts.cache && (cached = getCache(letters))) {
      iterator = cached.iterator;
      results = cached.results;
    } else {
      iterator = dict.anagram(tiles, [], dict, letters.length);
      results = [];
    }

    var known = Rx.Observable.fromArray(results.slice());

    var first = iterator.next();
    if (first.done) return known;

    var canceled;
    if (theseOpts.timeout) setTimeout(function () {
      return canceled = true;
    }, theseOpts.timeout);
    var rest = Rx.Observable.generate(first.value, theseOpts.cache ? function (x) {
      var finished = x.done || canceled;
      if (finished) {
        putCache(letters, iterator, results);
      }
      return !finished;
    } : function (x) {
      return !(x.done || canceled);
    }, theseOpts.cache ? function () {
      var n = iterator.next();
      if (n.value) results.push(n.value);
      return n;
    } : function () {
      return iterator.next();
    }, function (x) {
      return x.value || x;
    }, !theseOpts.sync ? Rx.Scheduler["default"] : Rx.Scheduler.currentThread);

    if (minLargestWordSizeRE) {
      rest = rest.filter(function (x) {
        return !!minLargestWordSizeRE.exec(x);
      });
    }

    return known.concat(rest);
  };

  generate.one = function (letters, optOverrides, callback) {
    if (arguments.length === 2 && typeof optOverrides === "function") {
      callback = optOverrides;
      optOverrides = {};
    }
    optOverrides = optOverrides || {};
    optOverrides.sync = false;
    var errorHandler = callback || Rx.helpers.defaultError;
    var sampler = Rx.Observable.create(function (observer) {
      var reservoir = Reservoir(opts.poolSize || 50);
      generate(letters, optOverrides).subscribe(function (x) {
        return reservoir.pushSome(x);
      }, errorHandler, function () {
        observer.onNext(reservoir[Math.floor(Math.random() * reservoir.length)]);
        observer.onCompleted();
      });
    });
    sampler.subscribe(function (x) {
      return callback && callback(null, x);
    }, errorHandler);
    return sampler;
  };

  generate._dict = dict;

  words.subscribeOnError(cb);

  words.subscribeOnCompleted(function () {
    cb(null, generate);
  });
};

