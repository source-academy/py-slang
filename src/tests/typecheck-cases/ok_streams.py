# Streams: the sieve of Eratosthenes (SICP 3.5.2), with the narrowing that a stream needs.
def sieve(s: Stream[int]) -> Stream[int]:
    if is_none(s):
        return None
    first: int = head(s)
    rest: Stream[int] = stream_tail(s)
    return pair(first, lambda: sieve(stream_filter(lambda x: x % first != 0, rest)))

primes: Stream[int] = sieve(integers_from(2))
print(stream_ref(primes, 10))
print(eval_stream(stream_map(lambda x: x * x, integers_from(1)), 5))

# The tail of a pair is whatever its function returns: it need not be a stream.
labelled: int = stream_tail(pair("label", lambda: 42))
print(labelled)

def add_streams(s1: Stream[int], s2: Stream[int]) -> Stream[int]:
    if is_none(s1) or is_none(s2):
        return None
    return pair(head(s1) + head(s2), lambda: add_streams(stream_tail(s1), stream_tail(s2)))
