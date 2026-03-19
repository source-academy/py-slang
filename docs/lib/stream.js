// Supporting streams in the Scheme style, following
// "stream discipline"

/**
 * assumes that the tail (second component) of the
 * pair {x} expects 2 arguments, and returns the result of
 * applying that function. Throws an error if the argument
 * is not a pair, or if the tail is not a function.
 * Laziness: Yes: {stream_tail} only forces the direct tail
 * stream, but not the rest of the stream, i.e. not the tail
 * of the tail, etc.
 * @param {stream} <CODE>xs</CODE> - given value
 * @returns {stream} result stream (if stream discipline is used)
 */

function stream_tail(xs) {
  if (is_pair(xs)) {
    const the_tail = tail(xs)
    if (is_function(the_tail)) {
      return the_tail()
    } else {
      error(
        the_tail,
        'stream_tail(xs) expects a function as ' +
          'the tail of the argument pair xs, ' +
          'but encountered '
      )
    }
  } else {
    error(xs, 'stream_tail(xs) expects a pair as ' + 'argument xs, but encountered ')
  }
}

/**
 * Returns True if xs is a stream as defined in the textbook,
 * and False otherwise. Iterative process.
 * Recurses down the stream and checks that it ends with the empty stream None.
 * Laziness:  No: is_stream needs to force the given stream.
 * @param {value} <CODE>xs</CODE> - given value
 * @returns {boolean} whether xs is a stream
 */

function is_stream(xs) {
  return (
    is_none(xs) ||
    (is_pair(xs) && is_function(tail(xs)) && arity(tail(xs)) === 0 && is_stream(stream_tail(xs)))
  )
}

/**
 * Given linked_list xs, returns a stream of same length with
 * the same elements as xs in the same order.
 * Laziness:  Yes: linked_list_to_stream
 * goes down the linked_list only when forced.
 * @param {linked_list} <CODE>xs</CODE> - given linked_list
 * @returns {stream} stream containing all elements of xs
 */

function linked_list_to_stream(xs) {
  return is_none(xs) ? None : pair(head(xs), () => linked_list_to_stream(tail(xs)))
}

/**
 * Given stream xs, returns a linked_list of same length with
 * the same elements as xs in the same order.
 * Laziness:  No: stream_to_linked_list needs to force the whole
 * stream.
 * @param {stream} <CODE>xs</CODE> - given stream
 * @returns {linked_list} containing all elements of xs
 */

function stream_to_linked_list(xs) {
  return is_none(xs) ? None : pair(head(xs), stream_to_linked_list(stream_tail(xs)))
}

/**
 * Given n values, returns a stream of length n.
 * The elements of the stream are the given values in the given order.
 * Lazy? No: A complete linked linked_list is generated,
 * and then a stream using linked_list_to_stream is generated from it.
 * @param {...value} <CODE>value1, value2, ...values</CODE> - given values
 * @returns {stream} stream containing all values
 */

function stream() {
  var the_linked_list = None
  for (var i = arguments.length - 1; i >= 0; i--) {
    the_linked_list = pair(arguments[i], the_linked_list)
  }
  return linked_list_to_stream(the_linked_list)
}

/**
 * Returns the length of the stream xs.
 * Iterative process.
 * Lazy? No: The function needs to explore the whole stream
 * @param {stream} <CODE>xs</CODE> - given stream
 * @returns {integer} length of xs
 */

function stream_length(xs) {
  return is_none(xs) ? 0 : 1 + stream_length(stream_tail(xs))
}

/**
 * Returns a stream that results from stream
 * xsby element-wise application
 * of unary function f.
 * f is applied element-by-element:
 * stream_map(f, stream(1,2)) results in
 * the same as stream(f(1),f(2)).
 * Lazy? Yes: The argument stream is only explored as forced by
 *            the result stream.
 * @param {function} <CODE>f</CODE> - given unary function
 * @param {stream} <CODE>xs</CODE> - given stream
 * @returns {stream} result of mapping
 */
function stream_map(f, s) {
  return is_none(s) ? None : pair(f(head(s)), () => stream_map(f, stream_tail(s)))
}

/**
 * Makes a stream with n
 * elements by applying the unary function f
 * to the numbers 0 to n-1.
 * Lazy? Yes: The result stream forces the application of f
 *           for the next element
 * @param {function} <CODE>f</CODE> - given unary function
 * @param {int} <CODE>n</CODE> - given integer
 * @returns {stream} resulting stream
 */

function build_stream(fun, n) {
  function build(i) {
    return i >= n ? None : pair(fun(i), () => build(i + 1))
  }
  return build(0)
}

/**
 * Applies unary function f to every
 * element of the stream xs.
 * Iterative process.
 * f is applied element-by-element:
 * stream_for_each(f, stream(1, 2)) results in the calls
 * f(1) and f(2).
 * Lazy? No: stream_for_each
 * forces the exploration of the entire stream
 * @param {function} <CODE>f</CODE> - given unary function
 * @param {stream} <CODE>xs</CODE> - given stream
 * @returns {boolean} True
 */

function stream_for_each(fun, xs) {
  if (is_none(xs)) {
    return True
  } else {
    fun(head(xs))
    return stream_for_each(fun, stream_tail(xs))
  }
}

/**
 * Returns stream xs in reverse
 * order. Iterative process.
 * The process is iterative, but consumes space Omega(n)
 * because of the result stream.
 * Lazy? No: stream_reverse
 * forces the exploration of the entire stream
 * @param {stream} <CODE>xs</CODE> - given stream
 * @returns {stream} <CODE>xs</CODE> in reverse
 */

function stream_reverse(xs) {
  function rev(original, reversed) {
    return is_none(original)
      ? reversed
      : rev(
          stream_tail(original),
          pair(head(original), () => reversed)
        )
  }
  return rev(xs, None)
}
/**
 * Returns a stream that results from
 * appending the stream ys to the streamxs.
 * In the result, None at the end of the first argument stream
 * is replaced by the second argument, regardless what the second
 * argument consists of.
 * Lazy? Yes: the result stream forces the actual append operation
 * @param {stream} <CODE>xs</CODE> - given first stream
 * @param {stream} <CODE>ys</CODE> - given second stream
 * @returns {stream} result of appending xs and ys
 */

function stream_append(xs, ys) {
  return is_none(xs) ? ys : pair(head(xs), () => stream_append(stream_tail(xs), ys))
}

/**
 * Returns first postfix substream
 * whose head is identical to
 * v (using ==); returns None if the
 * element does not occur in the stream.
 * Iterative process.
 * Lazy? Sort-of: <CODE>stream_member</CODE>
 * forces the stream only until the element
 * is found.
 * @param {value} <CODE>x</CODE> - given value
 * @param {stream} <CODE>s</CODE> - given stream
 * @returns {stream} postfix substream that starts with x
 */

function stream_member(x, s) {
  return is_none(s) ? None : head(s) === x ? s : stream_member(x, stream_tail(s))
}

/** Returns a stream that results from
 * xs by removing the first item from xs that
 * is identical (<CODE>===</CODE>) to v.
 * Returns the original
 * stream if there is no occurrence.
 * Lazy? Yes: the result stream forces the construction of each next element
 * @param {value} <CODE>v</CODE> - given value
 * @param {stream} <CODE>xs</CODE> - given stream
 * @returns {stream} <CODE>xs</CODE> with first occurrence of v removed
 */

function stream_remove(v, xs) {
  return is_none(xs)
    ? None
    : v === head(xs)
      ? stream_tail(xs)
      : pair(head(xs), () => stream_remove(v, stream_tail(xs)))
}

/**
 * Returns a stream that results from
 * xs by removing all items from xs that
 * are identical (<CODE>==</CODE>) to v.
 * Returns the original
 * stream if there is no occurrence.
 * Recursive process.
 * Lazy? Yes: the result stream forces the construction of each next
 * element
 * @param {value} <CODE>v</CODE> - given value
 * @param {stream} <CODE>xs</CODE> - given stream
 * @returns {stream} xs with all occurrences of v removed
 */

function stream_remove_all(v, xs) {
  return is_none(xs)
    ? None
    : v === head(xs)
      ? stream_remove_all(v, stream_tail(xs))
      : pair(head(xs), () => stream_remove_all(v, stream_tail(xs)))
}

/**
 * Returns a stream that contains
 * only those elements of given stream xs
 * for which the one-argument function
 * pred
 * returns True.
 * Lazy? Yes: The result stream forces the construction of
 *            each next element. Of course, the construction
 *            of the next element needs to go down the stream
 *            until an element is found for which pred holds.
 * @param {function} <CODE>pred</CODE> - given pred - unary function returning boolean value
 * @param {stream} <CODE>s</CODE> - given stream
 * @returns {stream} stream with those elements of xs for which pred holds.
 */

function stream_filter(p, s) {
  return is_none(s)
    ? None
    : p(head(s))
      ? pair(head(s), () => stream_filter(p, stream_tail(s)))
      : stream_filter(p, stream_tail(s))
}

/**
 * Returns a stream that enumerates
 * numbers starting from start using a step size of 1, until
 * the integer exceeds (<CODE>&gt;</CODE>) end.
 * Lazy? Yes: The result stream forces the construction of
 *            each next element
 * @param {integer} <CODE>start</CODE> -start - starting integer
 * @param {integer} <CODE>end</CODE> -end - ending integer
 * @returns {stream} stream from start to end
 */

function enum_stream(start, end) {
  return start > end ? None : pair(start, () => enum_stream(start + 1, end))
}

/**
 * Returns infinite stream if numbers starting
 * at given integer n using a step size of 1.
 * Lazy? Yes: The result stream forces the construction of
 *            each next element
 * @param {integer} <CODE>start</CODE> -start - starting integer
 * @returns {stream} infinite stream from n
 */

function integers_from(n) {
  return pair(n, () => integers_from(n + 1))
}

/**
 * Constructs the linked_list of the first nelements
 * of a given stream s
 * Lazy? Sort-of: eval_stream only forces the computation of
 * the first nelements, and leaves the rest of
 * the stream untouched.
 * @param {stream} <CODE>s</CODE> - given stream
 * @param {integer} <CODE>n</CODE> - given number of elements to place in result linked_list
 * @returns {linked_list} result linked_list
 */

function eval_stream(s, n) {
  function es(s, n) {
    return n === 1 ? linked_list(head(s)) : pair(head(s), es(stream_tail(s), n - 1))
  }
  return n == 0 ? None : es(s, n)
}

/**
 * Returns the element
 * of stream xs at position n,
 * where the first element has index 0.
 * Iterative process.
 * Lazy? Sort-of: stream_ref only forces the computation of
 *                the first n elements, and leaves the rest of
 *                the stream untouched.
 * @param {stream} <CODE>s</CODE> - given stream
 * @param {integer} <CODE>n</CODE> - given position
 * @returns {value} item in xs at position n
 */

function stream_ref(s, n) {
  return n == 0 ? head(s) : stream_ref(stream_tail(s), n - 1)
}

