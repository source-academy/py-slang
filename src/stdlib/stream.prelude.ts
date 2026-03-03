export const streamPrelude = `


def stream_tail(xs):
  """
  stream_tail returns the second component of the given pair
  throws an error if the argument is not a pair
  """
  if is_pair(xs):
    the_tail = tail(xs)
    if is_function(the_tail):
      return the_tail()
    else:
      error(the_tail,
        'stream_tail(xs) expects a function as ' +
        'the tail of the argument pair xs, ' +
        'but encountered ')
    
  else:
    error(xs, 'stream_tail(xs) expects a pair as ' +
      'argument xs, but encountered ')
  


def is_stream(xs):
  """
  is_stream recurses down the stream and checks that it ends with the
  empty list None
  """
  return is_none(xs) or
    (is_pair(xs) and
    is_function(tail(xs)) and
    arity(tail(xs)) === 0 and
    is_stream(stream_tail(xs)))


  

def list_to_stream(xs):
  """
  A stream is either None or a pair whose tail is
  a nullary function that returns a stream.
  """
  return None if is_none(xs) else pair(head(xs),
      lambda: list_to_stream(tail(xs)))


def stream_to_list(xs):
  """
  stream_to_list transforms a given stream to a list
  Lazy? No: stream_to_list needs to force the whole stream
  """
  return None if is_none(xs) else pair(head(xs), stream_to_list(stream_tail(xs)))


def stream_length(xs):
  """
  stream_length returns the length of a given argument stream
  throws an exception if the argument is not a stream
  Lazy? No: The function needs to explore the whole stream
  """
  return 0 if is_none(xs) else 1 + stream_length(stream_tail(xs))


def stream_map(f, s):
  """
  stream_map applies first arg f to the elements of the second
  argument, assumed to be a stream.
  f is applied element-by-element:
  stream_map(f,list_to_stream(list(1,2)) results in
  the same as list_to_stream(list(f(1),f(2)))
  stream_map throws an exception if the second argument is not a
  stream, and if the second argument is a nonempty stream and the
  first argument is not a function.
  Lazy? Yes: The argument stream is only explored as forced by
             the result stream.
  """
  return None if is_none(s) else pair(f(head(s)),
      lambda : stream_map(f, stream_tail(s)))


def build_stream(fun, n):
  """
  build_stream takes a function fun as first argument, 
  and a nonnegative integer n as second argument,
  build_stream returns a stream of n elements, that results from
  applying fun to the numbers from 0 to n-1.
  Lazy? Yes: The result stream forces the applications of fun
             for the next element
  """
  def build(i):
    return None if i >= n else pair(fun(i),
        lambda : build(i + 1))
  
  return build(0)


def stream_for_each(fun, xs):
  """
  stream_for_each applies first arg fun to the elements of the stream
  passed as second argument. fun is applied element-by-element:
  for_each(fun,list_to_stream(list(1, 2,None))) results in the calls fun(1)
  and fun(2).
  stream_for_each returns True.
  stream_for_each throws an exception if the second argument is not a
  stream, and if the second argument is a nonempty stream and the
  first argument is not a function.
  Lazy? No: stream_for_each forces the exploration of the entire stream
  """
  if is_none(xs):
    return True
  else:
    fun(head(xs))
    return stream_for_each(fun, stream_tail(xs))
  


def stream_reverse(xs):
  """
  stream_reverse reverses the argument stream
  stream_reverse throws an exception if the argument is not a stream.
  Lazy? No: stream_reverse forces the exploration of the entire stream
  """
  def rev(original, reversed):
    return reversed if is_none(original) else rev(stream_tail(original),
           pair(head(original), lambda : reversed))
  
  return rev(xs, None)


def stream_append(xs, ys):
  """
  stream_append appends first argument stream and second argument stream.
  In the result, None at the end of the first argument stream
  is replaced by the second argument stream
  stream_append throws an exception if the first argument is not a
  stream.
  Lazy? Yes: the result stream forces the actual append operation
  """
  return ys if is_none(xs) else pair(head(xs),
      lambda : stream_append(stream_tail(xs), ys))


def stream_member(x, s):
  """
  stream_member looks for a given first-argument element in a given
  second argument stream. It returns the first postfix substream
  that starts with the given element. It returns None if the
  element does not occur in the stream
  Lazy? Sort-of: stream_member forces the stream only until the element is found.
  """
  return None if is_none(s) else s if head(s) === x else stream_member(x, stream_tail(s))


def stream_remove(v, xs):
  """
  stream_remove removes the first occurrence of a given first-argument element
  in a given second-argument list. Returns the original list
  if there is no occurrence.
  Lazy? Yes: the result stream forces the construction of each next element
  """
  return None if is_none(xs) else stream_tail(xs) if v === head(xs) else pair(head(xs),
        lambda : stream_remove(v, stream_tail(xs)))


def stream_remove_all(v, xs):
  """
  stream_remove_all removes all instances of v instead of just the first.
  Lazy? Yes: the result stream forces the construction of each next element
  """
  return None if is_none(xs) else stream_remove_all(v, stream_tail(xs)) if v === head(xs) else pair(head(xs), lambda : stream_remove_all(v, stream_tail(xs)))


def stream_filter(p, s):
  """
  filter returns the substream of elements of given stream s
  for which the given predicate function p returns True.
  Lazy? Yes: The result stream forces the construction of
             each next element. Of course, the construction
             of the next element needs to go down the stream
             until an element is found for which p holds.
  """
  return None if is_none(s) else pair(head(s),
        lambda : stream_filter(p, stream_tail(s))) if p(head(s)) else stream_filter(p, stream_tail(s))


def enum_stream(start, end):
  """
  enumerates numbers starting from start,
  using a step size of 1, until the number
  exceeds end.
  Lazy? Yes: The result stream forces the construction of
             each next element
  """
  return None if start > end else pair(start,
      lambda : enum_stream(start + 1, end))


def integers_from(n):
  """
  integers_from constructs an infinite stream of integers
  starting at a given number n
  Lazy? Yes: The result stream forces the construction of
             each next element
  """
  return pair(n,
    lambda : integers_from(n + 1))


def eval_stream(s, n):
  """
  eval_stream constructs the list of the first n elements
  of a given stream s
  Lazy? Sort-of: eval_stream only forces the computation of
                 the first n elements, and leaves the rest of
                 the stream untouched.
  """
    def es(s, n):
        return list(head(s)) if n === 1 else pair(head(s), 
                      es(stream_tail(s), n - 1))
    
    return None if n === 0 else es(s, n)


def stream_ref(s, n):
  """
  Returns the item in stream s at index n (the first item is at position 0)
  Lazy? Sort-of: stream_ref only forces the computation of
                 the first n elements, and leaves the rest of
                 the stream untouched.
  """
  return head(s) if n === 0 else stream_ref(stream_tail(s), n - 1)

`